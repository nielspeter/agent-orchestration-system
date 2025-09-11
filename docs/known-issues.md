# Known Issues

## Session Recovery with Incomplete Tool Calls

### Issue
When recovering a session that has incomplete tool calls (tool_use without corresponding tool_result), the system fails with an error:
```
messages.3: `tool_use` ids were found without `tool_result` blocks immediately after
```

### Symptoms
- Session continuation fails when the previous session ended with pending tool calls
- Error occurs when trying to add a new user message after incomplete tool calls

### Root Cause
The `AgentExecutor.execute()` method recovers previous messages but doesn't check for or handle incomplete tool calls before adding the new user prompt.

### Current Workaround
Delete the problematic session directory:
```bash
rm -rf .agent-sessions/<session-id>
```

### Proposed Solution
The executor should use `SessionManager.hasIncompleteToolCall()` during recovery and either:
1. Complete the pending tool calls before adding new messages
2. Remove incomplete tool calls from the recovered messages
3. Add dummy tool results for incomplete calls

### Code Location
- `src/agents/executor.ts:140-150` - Session recovery logic
- `src/session/manager.ts:105-150` - Methods for detecting incomplete tool calls

### Priority
Medium - Affects session continuation reliability but has a simple workaround