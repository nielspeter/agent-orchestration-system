# Logging Example

Demonstrates the event logging system for monitoring and debugging agent execution.

## What This Demonstrates

- **Event Logging**: Real-time event streaming
- **Event Types**: Agent lifecycle, tool execution, LLM calls
- **Monitoring**: Track agent behavior and performance
- **Debugging**: Detailed execution traces

## Key Concepts

The logging system provides observability into:

- Agent start/complete events
- Tool execution and results
- LLM API calls and responses
- Token usage and costs
- Error tracking

## Running the Example

```bash
npx tsx packages/examples/logging/logging.ts
```

## Event Types

### Agent Events
- `agent:start` - Agent execution begins
- `agent:complete` - Agent execution finishes
- `agent:error` - Agent encounters error

### Tool Events
- `tool:execute` - Tool is being executed
- `tool:complete` - Tool execution finishes
- `tool:error` - Tool execution fails

### LLM Events
- `llm:call` - LLM API call initiated
- `llm:response` - LLM response received
- `llm:error` - LLM call failed

## Code Highlights

```typescript
const { executor, eventLogger } = await AgentSystemBuilder.default()
  .withLogging({ verbose: true })
  .build();

// Subscribe to events
eventLogger.on('agent:start', (event) => {
  console.log(`Agent ${event.data.agent} started`);
});

eventLogger.on('tool:execute', (event) => {
  console.log(`Tool ${event.data.name} executing`);
});

eventLogger.on('agent:complete', (event) => {
  console.log(`Completed in ${event.data.duration}ms`);
});
```

## Output Format

Events are logged in structured JSON format:

```json
{
  "type": "agent:start",
  "timestamp": "2024-10-16T12:00:00.000Z",
  "data": {
    "agent": "orchestrator",
    "sessionId": "abc123"
  }
}
```

## Use Cases

- **Development**: Debug agent behavior
- **Production**: Monitor performance and errors
- **Analytics**: Track token usage and costs
- **Auditing**: Maintain execution traces

## Next Steps

For production logging, consider:
- Exporting to log aggregation systems (Datadog, CloudWatch)
- Custom event handlers for metrics
- Structured logging to files (JSONL format)
