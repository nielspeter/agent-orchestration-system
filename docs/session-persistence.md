# Session Persistence

## Overview

The session persistence system logs all agent interactions as events through a pluggable storage backend.

## Storage Interface

```typescript
interface SessionStorage {
  appendEvent(sessionId: string, event: unknown): Promise<void>;
  readEvents(sessionId: string): Promise<unknown[]>;
  sessionExists(sessionId: string): Promise<boolean>;
}
```

## Storage Implementations

### NoOpStorage
- No persistence (used when storage.type = 'none')
- Zero overhead
- Methods return immediately

### InMemoryStorage
- Stores events in `Map<sessionId, events[]>`
- Data persists for process lifetime
- Provides `clear()`, `getSessionIds()`, `getSessionCount()` utilities

### FilesystemStorage
- Persists to `{basePath}/{sessionId}/events.jsonl`
- One JSON object per line
- Provides `deleteSession()`, `listSessions()` utilities

## Event Types

Events are logged with consistent structure:

```typescript
{
  type: 'user' | 'assistant' | 'tool_call' | 'tool_result' | ...,
  timestamp: number,
  data: { /* event-specific data */ }
}
```

### Core Event Types
- **user**: User input messages
- **assistant**: Agent responses
- **tool_call**: Tool invocations with id, tool name, and parameters
- **tool_result**: Tool execution results linked by toolCallId

### Metadata Event Types
- **delegation**: Parent-child agent delegation
- **agent_start**: Agent execution beginning
- **agent_iteration**: Iteration counter updates
- **agent_complete**: Execution completion with duration
- **todo_update**: Todo list state changes (for display/monitoring)

## Configuration

### agent-config.json
```json
{
  "storage": {
    "type": "none",
    "options": {
      "path": ".agent-sessions"
    }
  }
}
```

Storage types: `"none"` | `"memory"` | `"filesystem"`

### Programmatic Configuration

```typescript
// Use default (NoOpStorage when storage.type = 'none')
const system = await AgentSystemBuilder.default().build();

// Use InMemoryStorage
const system = await AgentSystemBuilder
  .default()
  .withStorage(new InMemoryStorage())
  .build();

// Use FilesystemStorage
const system = await AgentSystemBuilder
  .default()
  .withStorage(new FilesystemStorage('./sessions'))
  .withSessionId('session-123')
  .build();
```

## Components

### EventLogger
Implements `AgentLogger` interface and writes events through storage:

- Maps all log methods to event types
- Uses fire-and-forget async writes
- Maintains tool call ID mappings
- Handles errors with console.error

### TodoManager
Stateless in-memory todo holder:

- No filesystem persistence
- Validates todo business rules (one in-progress, no duplicates)
- `setTodos()` used for recovery from events
- Generates IDs for new todos

### SimpleSessionManager
Reads and converts stored events with **guaranteed recovery from ANY state**:

```typescript
class SimpleSessionManager {
  async recoverSession(sessionId: string): Promise<Message[]>
  hasIncompleteToolCall(messages: Message[]): boolean
  getLastToolCall(messages: Message[]): { id, name, input } | null
  createToolResultMessage(toolCallId: string, result: unknown): Message
  isConversationComplete(messages: Message[]): boolean
}
```

Converts events to LLM message format:
- user events → `{ role: 'user', content: string }`
- assistant events → `{ role: 'assistant', content: string }`
- tool_call events → assistant message with tool_use content
- tool_result events → user message with tool_result content

**CRITICAL**: `recoverSession()` includes automatic message sanitization that ensures sessions can ALWAYS be resumed, regardless of whether they were saved mid-execution with incomplete tool calls or other edge cases. See "Guaranteed Session Recovery" section below.

### AgentSystemBuilder Integration

The builder:
1. Creates storage instance based on configuration
2. Initializes EventLogger with storage and sessionId
3. Creates SimpleSessionManager with storage
4. Passes SessionManager to AgentExecutor for automatic recovery
5. Checks for existing session and recovers todos if TodoWrite tool is enabled
6. Returns storage and sessionManager in BuildResult

### Automatic Session Continuation

Session recovery is **automatic and transparent**. When using the same sessionId:

```typescript
const system = await AgentSystemBuilder.default()
  .withStorage(new FilesystemStorage('./sessions'))
  .withSessionId('session-123')
  .build();

const { executor } = system;

// If session exists, executor automatically recovers and continues
// No need to pass messages - it's handled internally!
const result = await executor.execute(
  'agent-name',
  'Continue working on the task'
);
```

The AgentExecutor:
- Automatically checks for existing session on first execute()
- Loads previous messages if session exists
- Continues conversation from where it left off
- Only for top-level calls (not delegated agents)

This enables:
- **Crash recovery**: Seamless resume after unexpected exits
- **Long-running tasks**: Continue work across multiple sessions
- **Zero configuration**: Just use the same sessionId

## Guaranteed Session Recovery

**CRITICAL REQUIREMENT**: Sessions MUST be recoverable from ANY state, including edge cases like incomplete tool calls or corrupted data.

### The Problem
When a session is saved mid-execution (e.g., crash, interruption), it may contain:
- Incomplete tool calls (tool_use without tool_result)
- Orphaned tool results (result without matching call)
- Partial parallel execution (some tools completed, some not)
- Corrupted or invalid messages

These edge cases would cause Anthropic API 400 errors because the API requires matching tool_use/tool_result pairs.

### The Solution: Message Sanitizer

The `sanitizeRecoveredMessages()` function implements a multi-layer defense strategy that **guarantees 100% recovery success**:

#### Multi-Layer Defense Strategy
1. **Layer 1: Structure Validation** - Remove invalid message objects
2. **Layer 2: Message Repair** - Remove empty messages with no content
3. **Layer 3: Relationship Validation** - Fix tool_call/tool_result pairs
4. **Layer 4: Sequence Validation** - Ensure proper message ordering
5. **Layer 5: Final Validation** - Verify API compatibility

#### Progressive Fallback
If sanitization still produces invalid messages, the system applies progressive fallback:
1. Remove last N messages until valid (try 1-5 messages)
2. Keep only first half of messages
3. **Final fallback**: Return empty array (ALWAYS works)

#### Design Principles
- **NEVER throw errors** - Always return valid messages
- **Preserve maximum context** - Keep all text, thinking blocks, complete tool calls
- **Degrade gracefully** - Remove only what's necessary
- **Be transparent** - Log all issues found and fixed

### Usage

The sanitizer is automatically integrated into `SimpleSessionManager.recoverSession()`:

```typescript
const manager = new SimpleSessionManager(storage);
const messages = await manager.recoverSession('session-123');
// Messages are GUARANTEED to be valid, regardless of session state
```

If any issues were found and fixed, they're logged to the console:

```
Session session-123 recovery: Sanitized 2 issue(s): [incomplete_tool_call] Removed 1 incomplete tool call(s): call_abc123
```

### API Reference

```typescript
// Core sanitization function
function sanitizeRecoveredMessages(messages: Message[]): SanitizationResult {
  messages: Message[];    // Cleaned, valid messages
  issues: SanitizationIssue[];  // Log of what was fixed
  recovered: boolean;     // Always true (guaranteed recovery)
}

// Validate message structure
function validateMessageStructure(messages: Message[]): {
  valid: boolean;
  errors: string[];
}

// Format issues for logging
function formatSanitizationIssues(issues: SanitizationIssue[]): string
```

### Supported Recovery Scenarios

The sanitizer handles ALL possible edge cases:
- ✅ Empty sessions (fresh start)
- ✅ Incomplete tool calls at end of session
- ✅ Incomplete tool calls in middle of session
- ✅ Orphaned tool results without matching calls
- ✅ Mixed scenarios (some complete, some incomplete)
- ✅ Partial parallel execution (some tools done, some not)
- ✅ Corrupted or invalid messages
- ✅ Messages with only text (preserved)
- ✅ Messages with thinking blocks (preserved)
- ✅ Complete tool_call/result pairs (untouched)

**Result**: 100% recovery success rate from ANY session state.

## File Structure

With filesystem storage:

```
.agent-sessions/
├── session-abc123/
│   └── events.jsonl
├── session-def456/
│   └── events.jsonl
└── session-ghi789/
    └── events.jsonl
```

Each `events.jsonl` contains:
```jsonl
{"type":"user","timestamp":1701234567890,"data":{"role":"user","content":"Hello"}}
{"type":"assistant","timestamp":1701234568123,"data":{"role":"assistant","content":"Hi!","agent":"default"}}
{"type":"tool_call","timestamp":1701234568456,"data":{"id":"call_123","tool":"Read","params":{"path":"file.txt"},"agent":"default"}}
{"type":"tool_result","timestamp":1701234568789,"data":{"toolCallId":"call_123","result":{"content":"file contents"}}}
```

## API Reference

### SessionStorage Methods

#### `appendEvent(sessionId: string, event: unknown): Promise<void>`
Appends an event to the session log.

#### `readEvents(sessionId: string): Promise<unknown[]>`
Returns all events for a session in chronological order.

#### `sessionExists(sessionId: string): Promise<boolean>`
Checks if a session has been persisted.

### EventLogger Methods

All methods from `AgentLogger` interface:
- `logUserMessage(content: string): void`
- `logAssistantMessage(agent: string, content: string): void`
- `logToolCall(agent: string, tool: string, params: Record<string, unknown>): void`
- `logToolResult(agent: string, tool: string, toolId: string, result: unknown): void`
- Plus delegation, agent lifecycle, and todo logging methods

### SimpleSessionManager Methods

#### `recoverSession(sessionId: string): Promise<Message[]>`
Reads events and converts to LLM message format.

#### `hasIncompleteToolCall(messages: Message[]): boolean`
Returns true if last message is a tool_use without corresponding tool_result.

#### `getLastToolCall(messages: Message[])`
Extracts tool call details from the last message if it's a tool call.

#### `recoverTodos(sessionId: string): Promise<TodoItem[]>`
Finds the last TodoWrite tool call and extracts todos from its parameters.

## Session Continuation Philosophy

### No Explicit Completion Marking
The system does NOT mark sessions as "complete". This is intentional and allows for natural conversation continuation.

### How Continuation Works
When continuing with an existing sessionId:
1. **All messages are loaded** - Including any "final" answers from previous executions
2. **New prompt is added** - Becomes part of the ongoing conversation
3. **LLM figures it out** - Based on context, determines if work is complete or needs continuation

### Example Continuation Behavior
```
History: "Analyze file X" → "Analysis complete: [details]"
New: "Continue working on this"
LLM: "I've completed the analysis of file X. Would you like me to analyze something else or go deeper?"
```

The LLM naturally handles:
- Recognizing completed work
- Understanding new requests in context
- Determining if previous work needs revision
- Continuing partial work after interruption

## Usage Examples

### Basic Logging
```typescript
const storage = new FilesystemStorage();
const logger = new EventLogger(storage, 'session-123');

logger.logUserMessage("Analyze this file");
logger.logAssistantMessage("default", "I'll analyze the file");
logger.logToolCall("default", "Read", { path: "file.txt" });
logger.logToolResult("default", "Read", "call_123", { content: "..." });
```

### Reading Session Events
```typescript
const storage = new FilesystemStorage();
const events = await storage.readEvents('session-123');

for (const event of events) {
  console.log(`${event.type} at ${new Date(event.timestamp)}`);
}
```

### Converting to Messages
```typescript
const manager = new SimpleSessionManager(storage);
const messages = await manager.recoverSession('session-123');

// messages array contains LLM-compatible format
console.log(`Recovered ${messages.length} messages`);
```

## Todo Persistence

Todos are persisted as `tool_call` events for the `TodoWrite` tool:

### Storage
- TodoWrite tool calls contain the complete todo list in params
- Each call replaces the entire todo list (not incremental)
- The last TodoWrite call represents the current state

### Recovery Process
During system initialization with an existing session:

```typescript
// In AgentSystemBuilder.build()
if (todoManager && await storage.sessionExists(sessionId)) {
  const recoveredTodos = await sessionManager.recoverTodos(sessionId);
  if (recoveredTodos.length > 0) {
    todoManager.setTodos(recoveredTodos);
  }
}
```

The system:
1. Finds the most recent TodoWrite tool call in events
2. Extracts the todos array from its params
3. Sets them in the TodoManager's memory

### Architecture Changes
- **Old**: TodoManager wrote to `todos/current-session.json`
- **New**: TodoManager is stateless, todos only in session events
- **Recovery**: From last TodoWrite event, not filesystem

## Notes

- Events are immutable once written
- Session IDs should be unique
- NoOpStorage (type='none') always returns empty results
- FilesystemStorage creates directories as needed
- Event timestamps are Unix milliseconds
- Tool call IDs are generated with crypto.randomUUID()
- Todos are reconstructed from the last TodoWrite tool call