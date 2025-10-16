# Session Analyzer Example

Demonstrates **session management**, persistence, and the `GetSessionLog` tool for analyzing conversation history.

## What This Demonstrates

- **Session Persistence**: Conversations saved automatically
- **Session Recovery**: Resume from previous state
- **GetSessionLog Tool**: Retrieve conversation history
- **Session Analysis**: Agents can analyze their own history

## Key Concepts

Sessions enable:
- **Continuity**: Multi-turn conversations
- **Context Preservation**: Agent remembers previous interactions
- **Recovery**: Resume after interruption
- **Introspection**: Agents can review their own history

## Running the Example

```bash
npx tsx packages/examples/session-analyzer/session-analyzer.ts
```

## Session Flow

```
1. First Execution
   - Session created with ID
   - Conversation saved to storage

2. Subsequent Executions
   - Session recovered from storage
   - Previous context restored
   - Conversation continues

3. Analysis
   - GetSessionLog retrieves history
   - Agent can reflect on conversation
```

## Storage Backends

### Filesystem (Default)
```typescript
const system = await AgentSystemBuilder.default()
  .withStorage({
    type: 'filesystem',
    path: './sessions'
  })
  .build();
```

### In-Memory
```typescript
const system = await AgentSystemBuilder.default()
  .withStorage({ type: 'memory' })
  .build();
```

## GetSessionLog Tool

Agents can retrieve their own conversation history:

```typescript
// Agent uses GetSessionLog tool
const log = await tools.GetSessionLog.execute({});

// Returns array of messages:
[
  { role: 'user', content: 'Previous request' },
  { role: 'assistant', content: 'Previous response' },
  { role: 'user', content: 'Current request' }
]
```

## Code Highlights

```typescript
// Create session
const { executor } = await AgentSystemBuilder.default()
  .withSessionId('analysis-session')
  .build();

// First interaction
await executor.execute('analyzer', 'Analyze this data');

// Later: Resume session
const { executor: resumed } = await AgentSystemBuilder.default()
  .withSessionId('analysis-session') // Same ID
  .build();

// Agent has full context from previous interactions
await resumed.execute('analyzer', 'What did we discuss?');
```

## Use Cases

- **Long-Running Tasks**: Multi-step workflows
- **Iterative Refinement**: Build on previous results
- **Conversation Context**: Multi-turn dialogues
- **Analysis**: Review decision-making process
- **Debugging**: Inspect execution history

## Session Metadata

```json
{
  "sessionId": "abc123",
  "created": "2024-10-16T12:00:00Z",
  "updated": "2024-10-16T12:05:00Z",
  "messages": 10,
  "agent": "analyzer"
}
```

## Best Practices

1. **Meaningful IDs**: Use descriptive session IDs
2. **Cleanup**: Remove old sessions periodically
3. **Recovery**: Handle session corruption gracefully
4. **Privacy**: Don't store sensitive data in sessions
5. **Size Limits**: Monitor session growth

## Next Steps

For production session management:
- Custom storage backends (Redis, DynamoDB)
- Session expiration policies
- Encryption at rest
- Backup and recovery strategies
