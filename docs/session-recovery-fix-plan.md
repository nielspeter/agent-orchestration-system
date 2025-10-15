# Session Recovery Fix Plan: Incomplete Tool Calls

## Executive Summary

Fix the session recovery bug where recovered sessions containing incomplete tool_use/tool_result pairs cause Anthropic API to reject requests with 400 errors.

**Critical Requirement**: ⚠️ **Session recovery MUST work from ANY state** - no matter when the session was saved or what condition it's in, we must be able to resume.

**Impact**: Currently affects ~10% of session continuations, requiring manual cache clearing
**Severity**: High - Breaks continuity, loses conversation context
**Effort**: ~4-6 hours implementation + testing

### Design Principle: Zero Data Loss Recovery

The solution must:
1. ✅ **Never fail to recover** - Sessions must load from any state
2. ✅ **Preserve maximum context** - Keep all text, thinking, and history
3. ✅ **Degrade gracefully** - If tools incomplete, continue without them
4. ✅ **Be transparent** - Log what was cleaned, why, and how to continue

---

## Problem Analysis

### Root Cause

When a session is persisted mid-execution, it may capture an assistant message with `tool_calls` before the tool execution completes. On recovery:

1. **Session Manager** loads messages in OpenAI format:
   ```typescript
   [
     { role: 'assistant', tool_calls: [{ id: 'call_123', function: {...} }] },
     // Missing: { role: 'tool', tool_call_id: 'call_123', content: '...' }
   ]
   ```

2. **Anthropic Provider** converts to Anthropic format:
   ```typescript
   [
     { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_123', ... }] },
     // Missing: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_123', ... }] }
   ]
   ```

3. **Anthropic API** validates and rejects:
   ```
   Error 400: messages.3: `tool_use` ids were found without `tool_result` blocks
   immediately after: toolu_01HWLQbwAa5e2BJwdX1nreqa. Each `tool_use` block must
   have a corresponding `tool_result` block in the next message.
   ```

### Why It Happens

**Timing Issue**: Sessions are saved after each iteration. If an iteration ends with the assistant requesting tools but before those tools are executed, the incomplete state is persisted.

**Scenario**:
```
Iteration N:
  1. LLM responds with tool_calls ✅
  2. Session saved               ✅ <- Incomplete state captured
  3. Tools execute               ❌ <- Process interrupted
  4. Tool results added          ❌
```

### Current Workaround

```bash
rm -rf .agent-sessions/*  # Clear all sessions
```

This works but loses all conversation history.

---

## Solution Design

### Core Principle: Guaranteed Recovery from ANY State

**No matter what state the session is in, we MUST be able to resume.**

#### Possible Session States

| State | Example | Recovery Strategy |
|-------|---------|-------------------|
| **Complete** | All tool calls have results | ✅ Use as-is |
| **Incomplete tool call** | Last msg has tool_calls, no result | 🔧 Remove incomplete tool_calls |
| **Mid-parallel execution** | 3 tools requested, only 2 completed | 🔧 Remove all tool_calls from that turn |
| **Orphaned tool result** | Tool result without matching call | 🔧 Remove orphaned result |
| **Corrupted message** | Invalid JSON, malformed content | 🔧 Skip corrupted message, log warning |
| **Empty session** | No messages | ✅ Start fresh |
| **System message only** | Just system prompts | ✅ Start conversation |
| **Mid-thinking** | Thinking block without conclusion | ✅ Preserve thinking, continue |

**Guarantee**: For EVERY possible state, we have a recovery path.

### Approach: Multi-Layer Message Sanitization

Create a defense-in-depth sanitizer that handles all edge cases:

1. **Layer 1: Structure Validation** - Ensure messages array is valid
2. **Layer 2: Message Repair** - Fix individual malformed messages
3. **Layer 3: Relationship Validation** - Ensure tool_call/tool_result pairs match
4. **Layer 4: Sequence Validation** - Ensure proper role ordering
5. **Layer 5: Final Validation** - Guarantee API compatibility

### Architecture

```
┌─────────────────┐
│ Session Storage │
└────────┬────────┘
         │ readEvents()
         ▼
┌─────────────────────┐
│  Session Manager    │
│  recoverSession()   │
└────────┬────────────┘
         │ Messages (may be incomplete)
         ▼
┌─────────────────────┐
│ Message Sanitizer   │ <- NEW
│ sanitize()          │
└────────┬────────────┘
         │ Clean messages
         ▼
┌─────────────────────┐
│  Agent Executor     │
│  execute()          │
└─────────────────────┘
```

### Sanitization Rules

#### Rule 1: Remove Incomplete Tool Calls from Assistant Messages
```typescript
// BEFORE
{ role: 'assistant', tool_calls: [{ id: 'call_123', ... }] }
// <end of messages>

// AFTER
{ role: 'assistant', content: 'Let me check that...' }  // tool_calls removed
// OR remove message entirely if only tool_calls
```

#### Rule 2: Remove Orphaned Tool Results
```typescript
// BEFORE
{ role: 'tool', tool_call_id: 'call_456', content: '...' }  // No matching tool_call

// AFTER
// Message removed
```

#### Rule 3: Preserve Thinking and Text Content
```typescript
// BEFORE
{
  role: 'assistant',
  content: 'Let me analyze this...',
  tool_calls: [{ id: 'call_789', ... }]
}

// AFTER
{
  role: 'assistant',
  content: 'Let me analyze this...'  // Text preserved, tool_calls removed
}
```

#### Rule 4: Validate Message Pairs
```typescript
// Ensure every tool_use has a matching tool_result
for each assistant message with tool_calls:
  check next message is role='tool' with matching tool_call_id
  if not -> apply Rule 1
```

---

## Implementation Plan

### Phase 1: Create Message Sanitizer (2 hours)

**File**: `packages/core/src/session/message-sanitizer.ts`

```typescript
/**
 * Sanitizes recovered session messages to ensure API compatibility
 */
export function sanitizeRecoveredMessages(
  messages: Message[],
  logger?: AgentLogger
): Message[] {
  // Implementation details below
}
```

**Key Functions**:
- `findIncompleteToolCalls(messages)`: Identify problematic messages
- `removeIncompleteToolCalls(msg)`: Clean individual message
- `removeOrphanedToolResults(messages)`: Remove unmatched tool results
- `validateMessageStructure(messages)`: Final validation

**Edge Cases to Handle**:
1. Empty messages after cleanup → Remove entirely
2. Multiple tool_calls, some complete, some not → Remove only incomplete
3. Parallel tool execution → If any incomplete, remove all from that assistant message
4. Last message is user message → Already safe, no changes needed
5. Messages array is empty → Return as-is
6. Single assistant message with no tool_calls → Safe, no changes

### Phase 2: Integration (1 hour)

**File**: `packages/core/src/session/manager.ts`

```typescript
async recoverSession(sessionId: string): Promise<Message[]> {
  const events = await this.storage.readEvents(sessionId);
  const messages: Message[] = [];

  // ... existing conversion logic ...

  // NEW: Sanitize before returning
  const sanitized = sanitizeRecoveredMessages(messages, this.logger);

  if (sanitized.length !== messages.length) {
    this.logger?.logSystemMessage(
      `Session ${sessionId}: Removed ${messages.length - sanitized.length} incomplete messages`
    );
  }

  return sanitized;
}
```

**File**: `packages/core/src/agents/executor.ts`

```typescript
// Log sanitization results
if (initialMessages.length > 0) {
  this.logger.logSystemMessage(
    `Recovered and sanitized ${initialMessages.length} messages from session ${this.sessionId}`
  );
}
```

### Phase 3: Comprehensive Testing (2 hours)

**File**: `packages/core/tests/unit/session/message-sanitizer.test.ts`

**Test Scenarios**:

1. **Incomplete tool call scenarios**:
   - Last message has tool_calls, no tool results
   - Middle message has incomplete tool_calls
   - Multiple incomplete tool_calls in one message

2. **Mixed content scenarios**:
   - Message with text + incomplete tool_calls
   - Message with thinking blocks + incomplete tool_calls
   - Empty message after tool_call removal

3. **Orphaned tool results**:
   - Tool result with no matching tool_call
   - Tool result for tool_call that was removed

4. **Safe messages** (should pass through unchanged):
   - Complete tool_call/tool_result pairs
   - Text-only messages
   - Empty message array

5. **Complex scenarios**:
   - Parallel tool execution (3 tools, 2 complete, 1 incomplete)
   - Nested conversations with delegations
   - Recovery after timeout mid-tool-execution

6. **Edge cases**:
   - Messages with raw_content (thinking blocks)
   - System messages
   - Multiple consecutive assistant messages

**File**: `packages/core/tests/integration/session-recovery.integration.test.ts`

**Integration Tests**:
```typescript
describe('Session Recovery: Resume from ANY State', () => {
  it('should recover from incomplete tool call', async () => {
    // 1. Create session with incomplete tool call
    // 2. Save session mid-execution
    // 3. Recover session
    // 4. Continue execution without errors
    // 5. Verify conversation continues correctly
  });

  it('should recover from corrupted last message', async () => {
    // 1. Create session with valid history
    // 2. Manually corrupt last message in storage
    // 3. Recover session
    // 4. Verify: Recovery succeeds, last message skipped
    // 5. Continue conversation successfully
  });

  it('should recover from parallel tool execution mid-crash', async () => {
    // 1. Start parallel tool execution (3 tools)
    // 2. Crash after 2 tools complete
    // 3. Recover session
    // 4. Verify: All 3 tool_calls removed, can continue
  });

  it('should recover from empty session', async () => {
    // 1. Create empty session
    // 2. Recover
    // 3. Verify: Starts fresh, no errors
  });

  it('should recover from orphaned tool results', async () => {
    // 1. Create session with tool_result but no matching tool_call
    // 2. Recover
    // 3. Verify: Orphaned result removed, session valid
  });

  it('should handle worst-case: completely corrupted session', async () => {
    // 1. Create session with all messages corrupted
    // 2. Recover
    // 3. Verify: Falls back to empty, still works
    // 4. Can start new conversation
  });
});
```

### Phase 4: Documentation (1 hour)

**Update Files**:

1. **`docs/session-management.md`** (new file):
   - Explain session recovery process
   - Document message sanitization
   - Provide troubleshooting guide

2. **`packages/core/src/session/README.md`**:
   - Add section on message sanitization
   - Document recovery behavior

3. **`CLAUDE.md`**:
   - Remove workaround note
   - Add note about automatic recovery

4. **`packages/core/src/session/message-sanitizer.ts`**:
   - Comprehensive JSDoc comments
   - Examples of each scenario

---

## Error Handling and Fallback Strategy

### Principle: Never Throw, Always Recover

The sanitizer MUST NEVER throw an error. Instead:

1. **Log the issue** - Record what went wrong
2. **Apply fix** - Clean or remove problematic messages
3. **Continue** - Return valid messages that work

### Fallback Chain

```
┌─────────────────────────────────┐
│ Try: Use messages as-is          │
└──────────┬──────────────────────┘
           │ Validate
           ▼
    ┌─────────────┐
    │ Valid?      │──Yes──► ✅ Use messages
    └──────┬──────┘
           │ No
           ▼
┌─────────────────────────────────┐
│ Try: Remove incomplete tool calls│
└──────────┬──────────────────────┘
           │ Validate
           ▼
    ┌─────────────┐
    │ Valid?      │──Yes──► ✅ Use cleaned messages
    └──────┬──────┘
           │ No
           ▼
┌─────────────────────────────────┐
│ Try: Remove last N messages      │
└──────────┬──────────────────────┘
           │ Validate
           ▼
    ┌─────────────┐
    │ Valid?      │──Yes──► ⚠️ Use partial messages
    └──────┬──────┘
           │ No
           ▼
┌─────────────────────────────────┐
│ Fallback: Empty message array    │
└──────────┬──────────────────────┘
           ▼
    ✅ Start fresh conversation
```

### Recovery Guarantees

| Scenario | Guaranteed Outcome | Context Preserved |
|----------|-------------------|-------------------|
| Normal recovery | Full history | 100% |
| Incomplete tool call | Text + history | 95% (just tool call lost) |
| Corrupted last message | History minus last | 90% |
| Multiple issues | Best effort cleanup | 80%+ |
| Completely corrupted | Empty start | 0% (but still works!) |

**Key Point**: Even in worst case (empty start), the system WORKS and can continue.

---

## Implementation Details

### Message Sanitizer Core Algorithm

```typescript
export function sanitizeRecoveredMessages(
  messages: Message[],
  logger?: AgentLogger
): Message[] {
  if (messages.length === 0) return messages;

  const sanitized: Message[] = [];
  const removalLog: string[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const nextMsg = messages[i + 1];

    // Rule 1: Check for incomplete tool calls
    if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
      const hasMatchingResults = nextMsg?.role === 'tool' &&
        msg.tool_calls.some(tc => tc.id === nextMsg.tool_call_id);

      if (!hasMatchingResults) {
        // Incomplete tool call found
        if (msg.content) {
          // Has text content, preserve it
          sanitized.push({ role: 'assistant', content: msg.content });
          removalLog.push(`Removed incomplete tool_calls from message ${i}`);
        } else {
          // Only tool calls, skip entire message
          removalLog.push(`Removed assistant message ${i} (incomplete tool_calls only)`);
        }
        continue;
      }
    }

    // Rule 2: Check for orphaned tool results
    if (msg.role === 'tool' && msg.tool_call_id) {
      const prevMsg = sanitized[sanitized.length - 1];
      const hasMatchingCall = prevMsg?.role === 'assistant' &&
        prevMsg.tool_calls?.some(tc => tc.id === msg.tool_call_id);

      if (!hasMatchingCall) {
        removalLog.push(`Removed orphaned tool_result ${i} (id: ${msg.tool_call_id})`);
        continue;
      }
    }

    // Message is valid, add to sanitized array
    sanitized.push(msg);
  }

  // Log what was removed
  if (removalLog.length > 0 && logger) {
    logger.logSystemMessage(`Message sanitization: ${removalLog.join('; ')}`);
  }

  return sanitized;
}
```

### Validation Function

```typescript
export function validateMessageStructure(messages: Message[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // Check assistant messages with tool_calls have matching results
    if (msg.role === 'assistant' && msg.tool_calls) {
      const nextMsg = messages[i + 1];
      for (const toolCall of msg.tool_calls) {
        if (nextMsg?.role !== 'tool' || nextMsg.tool_call_id !== toolCall.id) {
          errors.push(
            `Message ${i}: tool_call ${toolCall.id} missing matching tool_result`
          );
        }
      }
    }

    // Check tool results have matching calls
    if (msg.role === 'tool' && msg.tool_call_id) {
      const prevMsg = messages[i - 1];
      const hasMatch = prevMsg?.role === 'assistant' &&
        prevMsg.tool_calls?.some(tc => tc.id === msg.tool_call_id);

      if (!hasMatch) {
        errors.push(`Message ${i}: tool_result ${msg.tool_call_id} missing matching tool_call`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
```

---

## Testing Strategy

### Unit Test Coverage Matrix

| Scenario | Test Case | Expected Behavior |
|----------|-----------|-------------------|
| Incomplete at end | `[asst+tools]` | Remove tool_calls or message |
| Incomplete in middle | `[asst+tools, user]` | Remove tool_calls, keep user |
| Orphaned result | `[tool]` without match | Remove tool message |
| Mixed content | `[asst: text+tools]` | Keep text, remove tools |
| Complete pair | `[asst+tools, tool]` | No changes |
| Parallel incomplete | `[asst: 3 tools, tool: 2 results]` | Remove all tool_calls |
| Empty after cleanup | `[asst: tools only]` → `[]` | Remove message |
| Multiple orphans | Sequential orphaned results | Remove all |

### Integration Test Scenarios

1. **Scenario: Mid-execution recovery**
   - Start agent, request tool
   - Kill process before tool completes
   - Recover and continue
   - Verify: No errors, conversation continues

2. **Scenario: Parallel tool timeout**
   - Request 3 tools in parallel
   - 2 complete, 1 timeouts
   - Recover session
   - Verify: Clean recovery, can continue

3. **Scenario: Delegation with incomplete**
   - Parent delegates to child
   - Child requests tool
   - System crashes before tool result
   - Recover parent session
   - Verify: Clean recovery

---

## Risk Assessment

### Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Over-aggressive cleaning | High | Low | Comprehensive tests, validation |
| Breaking existing sessions | High | Low | Backward compatible, old sessions still load |
| Performance impact | Low | Low | O(n) complexity, minimal overhead |
| Edge case bugs | Medium | Medium | Extensive test coverage |
| Thinking blocks lost | Medium | Low | Preserve raw_content field |

### Rollback Plan

If issues arise:
1. Feature flag: `DISABLE_MESSAGE_SANITIZATION=true`
2. Sanitizer can be disabled in executor
3. Old recovery logic preserved
4. No data migration needed

---

## Success Criteria

✅ **Functional** (MUST HAVE):
- [ ] ⚠️ **CRITICAL**: Sessions recover from ANY state - 100% success rate
- [ ] No more 400 errors from incomplete tool calls - 0 errors
- [ ] Conversations continue naturally after recovery - always
- [ ] Maximum context preserved (text, thinking, history) - ≥95%
- [ ] Graceful degradation when data incomplete - no crashes
- [ ] Clear logging of what was cleaned and why

✅ **Testing**:
- [ ] 100% unit test coverage for sanitizer
- [ ] All edge cases tested
- [ ] Integration tests pass
- [ ] No regression in existing tests

✅ **Performance**:
- [ ] Session recovery < 50ms overhead
- [ ] No memory leaks
- [ ] Scales to 1000+ message sessions

✅ **Documentation**:
- [ ] Code comments comprehensive
- [ ] User-facing docs updated
- [ ] Troubleshooting guide complete

---

## Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Sanitizer | 2 hours | None |
| Phase 2: Integration | 1 hour | Phase 1 |
| Phase 3: Testing | 2 hours | Phase 2 |
| Phase 4: Documentation | 1 hour | Phase 3 |
| **Total** | **6 hours** | |

---

## Future Enhancements

### V2: Proactive Prevention
- Save sessions only at "safe" points (after tool results)
- Add session state machine (WAITING_FOR_TOOLS, COMPLETE, etc.)
- Prevent saving during tool execution

### V3: Recovery Options
- Offer user choice: "Remove incomplete" vs "Re-execute tools"
- Store tool inputs with session for re-execution
- Automatic retry of incomplete tools

### V4: Analytics
- Track how often sanitization occurs
- Identify patterns in incomplete sessions
- Optimize save timing based on data

---

## Appendix

### Related Files

- `packages/core/src/session/manager.ts` - Session recovery
- `packages/core/src/session/types.ts` - Event types
- `packages/core/src/base-types.ts` - Message type
- `packages/core/src/providers/anthropic-provider.ts` - Message conversion
- `packages/core/src/agents/executor.ts` - Session integration

### References

- [Anthropic API Docs: Messages](https://docs.anthropic.com/claude/reference/messages_post)
- [OpenAI API Docs: Chat Completions](https://platform.openai.com/docs/api-reference/chat)
- Session Management Tests: `tests/unit/session/`

---

**Document Status**: Draft
**Author**: Claude (AI Assistant)
**Date**: 2025-10-15
**Version**: 1.0
