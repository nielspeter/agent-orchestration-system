# Known Issues

## Session Recovery with Incomplete Tool Calls

### Issue
In the extremely rare case where a process crashes between writing a `tool_call` event and its corresponding `tool_result` event, session recovery will fail with:
```
messages.3: `tool_use` ids were found without `tool_result` blocks immediately after
```

### Likelihood
**Very Low** - This requires the process to crash in the narrow window between:
1. Writing the tool_call event to storage
2. Writing the tool_result event to storage

Since tool execution is typically fast (reading files, listing directories), this window is usually milliseconds.

### Current Behavior
The system will fail to recover the session and report an error. This is intentional as incomplete tool calls represent an inconsistent state.

### Workaround
If this rare issue occurs, delete the problematic session:
```bash
rm -rf .agent-sessions/<session-id>
```

### Design Decision
We chose not to add complex recovery logic for this edge case because:
1. The likelihood is extremely low (requires precise crash timing)
2. Event writes are atomic, making partial writes unlikely
3. The workaround is simple and effective
4. Complex recovery logic could introduce bugs for a problem that rarely occurs

### Priority
Low - Extremely rare edge case with simple workaround