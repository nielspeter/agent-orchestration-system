# Implementation Plan: Claude Code's "Pull, Don't Push" Architecture

## Current Problem

Our POC currently passes the entire parent conversation to child agents:
```typescript
// Current implementation in tool-executor.ts
parentMessages: ctx.messages.slice() // ALL parent messages!
```

Child agents see:
- Original user request to parent
- Parent's "I'll read the file..." responses  
- Tool results from parent's work
- Mixed context causing confusion

## Target Architecture (Claude Code's Approach)

Child agents should receive:
1. **Minimal initial context**: Just the delegation prompt (~5-500 tokens)
2. **Their own system prompt**: Role definition and capabilities
3. **Tools to pull information**: Read, Grep, Bash, etc.

## Implementation Steps

### Step 1: Modify Context Delegation
**File**: `src/services/tool-executor.ts`

```typescript
// BEFORE (Current):
async function handleDelegation(args, ctx, executeDelegate) {
  let parentMessages = ctx.messages.slice(); // Full conversation
  
  return executeDelegate(args.subagent_type, args.prompt, {
    ...ctx.executionContext,
    parentMessages  // Passing everything!
  });
}

// AFTER (Claude Code style):
async function handleDelegation(args, ctx, executeDelegate) {
  // Only pass essential data, not conversation history
  const minimalContext = {
    // Key data that child might need (file contents, etc.)
    sharedData: extractSharedData(ctx.messages),
    // Original task context (if needed)
    taskContext: ctx.executionContext.taskContext
  };
  
  return executeDelegate(args.subagent_type, args.prompt, {
    ...ctx.executionContext,
    parentMessages: [], // Empty! Child starts fresh
    minimalContext      // Only essential shared data
  });
}
```

### Step 2: Update Context Setup Middleware
**File**: `src/middleware/context-setup.middleware.ts`

```typescript
// BEFORE:
if (ctx.executionContext.parentMessages) {
  const filteredParentMessages = ctx.executionContext.parentMessages.filter(
    (msg) => msg.role !== 'system'
  );
  ctx.messages.push(...filteredParentMessages); // Inheriting conversation
}

// AFTER:
if (ctx.executionContext.minimalContext) {
  // Only add shared data as a system message if needed
  if (ctx.executionContext.minimalContext.sharedData) {
    ctx.messages.push({
      role: 'system',
      content: `Shared context data: ${JSON.stringify(ctx.executionContext.minimalContext.sharedData)}`
    });
  }
  // No parent conversation inheritance!
}
```

### Step 3: Implement Shared Data Extraction
**New Function**: Extract only essential data to share

```typescript
function extractSharedData(messages: Message[]): any {
  const sharedData: any = {};
  
  // Extract file contents that were read
  messages.forEach(msg => {
    if (msg.role === 'tool' && msg.name === 'Read') {
      const result = JSON.parse(msg.content);
      if (result.content) {
        sharedData.files = sharedData.files || {};
        sharedData.files[result.path] = result.content;
      }
    }
  });
  
  // Extract other relevant data (search results, etc.)
  // But NOT conversation history!
  
  return sharedData;
}
```

### Step 4: Update Agent System Prompts
**File**: `src/middleware/context-setup.middleware.ts`

```typescript
// Enhanced child agent instructions
if (ctx.executionContext.parentAgent) {
  systemPrompt += `
### YOU ARE A DELEGATED SPECIALIST
You have been called to complete a specific task.
You have access to tools to gather any information you need.

YOUR APPROACH:
1. Understand the task from the prompt
2. Use tools to discover and read relevant files
3. Build your understanding progressively
4. Complete the requested work
5. Return a summary of what you accomplished

DO NOT expect context from parent - gather what you need!`;
}
```

### Step 5: Create Test Cases
**File**: `examples/test-pull-architecture.ts`

```typescript
// Test 1: Verify child doesn't see parent conversation
async function testNoParentConversation() {
  const result = await executor.execute('orchestrator', 
    'Read the README.md file, then delegate to analyzer to summarize it'
  );
  
  // Check child agent's messages - should NOT contain parent's "I'll read..." 
}

// Test 2: Verify child can pull information autonomously
async function testChildPullsInfo() {
  const result = await executor.execute('orchestrator',
    'Ask analyzer to debug the auth.ts file'
  );
  
  // Child should use Read tool to get auth.ts, not inherit it
}

// Test 3: Compare token usage
async function testTokenEfficiency() {
  // Measure tokens with old approach vs new approach
  // Should see significant reduction
}
```

## Benefits of This Architecture

### 1. **No Context Confusion**
- Child agents have clean mental model
- No mixed first/third person perspectives
- Clear understanding of their role

### 2. **Token Efficiency**
```
Old: Parent (10K tokens) → Child inherits all (10K wasted)
New: Parent (10K tokens) → Child gets prompt (5 tokens) → Pulls what's needed (500 tokens)
Savings: 95% reduction!
```

### 3. **Scalability**
- Multiple agents can work with minimal memory
- No accumulating context bloat
- Clean separation of concerns

### 4. **Agent Autonomy**
- Agents control their investigation
- Can discover files parent didn't know about
- Build understanding progressively

## Migration Strategy

### Phase 1: Add Configuration Flag
```typescript
interface ExecutionConfig {
  usePullArchitecture?: boolean; // Default false for compatibility
}
```

### Phase 2: Implement Both Modes
- Keep current behavior as default
- New pull mode behind flag
- Test thoroughly

### Phase 3: Gradual Migration
- Update examples to use pull mode
- Document best practices
- Eventually make pull mode default

## Testing Plan

1. **Unit Tests**: Verify context filtering works correctly
2. **Integration Tests**: End-to-end agent delegation scenarios  
3. **Performance Tests**: Measure token usage reduction
4. **Regression Tests**: Ensure existing functionality still works

## Success Metrics

- [ ] Child agents no longer see parent conversation
- [ ] 90%+ reduction in context tokens passed to children
- [ ] No infinite loops or confusion about roles
- [ ] Agents successfully pull needed information via tools
- [ ] All existing tests still pass

## Timeline

- **Day 1**: Implement basic context filtering (Steps 1-2)
- **Day 2**: Add shared data extraction and system prompts (Steps 3-4)
- **Day 3**: Create comprehensive tests (Step 5)
- **Day 4**: Migration strategy and documentation
- **Day 5**: Performance validation and optimization

## Key Files to Modify

1. `src/services/tool-executor.ts` - Remove parent message passing
2. `src/middleware/context-setup.middleware.ts` - Change context inheritance
3. `src/core/agent-executor.ts` - Update execution context type
4. `src/types/middleware.ts` - Add minimalContext field
5. Agent markdown files - Update prompts for pull approach

## Open Questions

1. Should we pass ANY shared data, or pure minimal (just prompt)?
2. How to handle cases where parent has critical context (API keys, etc.)?
3. Should we cache discovered information between agent calls?
4. How to track what agents have already discovered?

## Next Steps

1. Review this plan and get feedback
2. Create feature branch: `feature/pull-architecture`
3. Start with Step 1: Modify context delegation
4. Test each step thoroughly before proceeding
5. Document learnings and adjustments

---

This represents a fundamental shift from "push all context" to "pull what you need" - exactly how Claude Code works!