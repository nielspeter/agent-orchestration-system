# Event System Architecture

## Overview

The agent system uses an event-driven architecture built on Node.js EventEmitter to enable real-time monitoring, web UI integration, and multi-consumer event processing.

## Core Components

### EventLogger

The `EventLogger` class is the central event hub that:
- Emits events for all agent activities (messages, tool calls, completions)
- Persists events to storage for audit/recovery
- Supports multiple simultaneous subscribers
- Provides wildcard subscriptions (`*` pattern)

```typescript
import { EventLogger } from '@agent-system/core';

const eventLogger = new EventLogger(storage, sessionId);

// Subscribe to specific events
eventLogger.on('message:assistant', (event) => {
  console.log('Agent said:', event.data.content);
});

// Subscribe to all events
eventLogger.on('*', (event) => {
  console.log('Event:', event.type);
});
```

## Event Types

### Message Events
- `message:user` - User input
- `message:assistant` - Agent response
- `message:system` - System messages

### Tool Events
- `tool:call` - Tool execution started
- `tool:result` - Tool execution completed
- `tool:error` - Tool execution failed

### Agent Events
- `agent:start` - Agent execution started
- `agent:iteration` - Agent iteration (LLM call)
- `agent:complete` - Agent execution completed
- `agent:error` - Agent execution failed

### Delegation Events
- `delegation:start` - Agent delegation started
- `delegation:complete` - Delegation completed

### Todo Events
- `todo:update` - Todo list updated

## Event Structure

All events follow a consistent structure:

```typescript
interface SessionEvent {
  type: string;           // Event type (e.g., 'tool:call')
  timestamp: number;      // Unix timestamp in milliseconds
  data: {                 // Event-specific data
    // varies by event type
  };
  metadata?: {            // Optional metadata
    tokens?: number;
    cost?: number;
    model?: string;
    // etc.
  };
}
```

## Subscription Patterns

### Specific Event Subscription

```typescript
eventLogger.on('tool:call', (event) => {
  console.log(`Tool called: ${event.data.tool}`);
});
```

### Wildcard Subscription

```typescript
// Receive ALL events
eventLogger.on('*', (event) => {
  // Handle any event
  processEvent(event);
});
```

### One-Time Subscription

```typescript
eventLogger.once('agent:complete', (event) => {
  console.log('Agent finished!');
});
```

### Unsubscribing

```typescript
const handler = (event) => console.log(event);

eventLogger.on('tool:call', handler);
// Later...
eventLogger.off('tool:call', handler);
```

## Built-in Subscribers

### Storage Subscriber

Storage automatically subscribes to all events in the EventLogger constructor:

```typescript
this.on('*', (event) => {
  this.storage.appendEvent(this.sessionId, event).catch((error) => {
    console.error('Failed to persist event:', error);
  });
});
```

This ensures all events are persisted for audit logs and session recovery.

## Custom Subscribers

### Console Subscriber

Console output is implemented as a subscriber (not shown here for brevity - see source).

### Web UI Subscriber (SSE)

See `docs/web-ui-integration.md` for complete examples.

```typescript
// Express SSE endpoint
app.get('/events/:sessionId', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const handler = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  eventLogger.on('*', handler);
  req.on('close', () => eventLogger.off('*', handler));
});
```

### Metrics Subscriber

```typescript
class MetricsCollector {
  private tokenCount = 0;
  private toolCallCount = 0;
  private cost = 0;

  constructor(eventLogger: EventLogger) {
    eventLogger.on('message:assistant', (event) => {
      if (event.metadata?.tokens) {
        this.tokenCount += event.metadata.tokens;
      }
      if (event.metadata?.cost) {
        this.cost += event.metadata.cost;
      }
    });

    eventLogger.on('tool:call', () => {
      this.toolCallCount++;
    });
  }

  getMetrics() {
    return {
      tokens: this.tokenCount,
      toolCalls: this.toolCallCount,
      cost: this.cost
    };
  }
}
```

## Integration with AgentSystemBuilder

```typescript
const system = await AgentSystemBuilder.default()
  .withAgents(['agents/researcher.md'])
  .withSessionId('session-123')
  .build();

// The EventLogger is accessible via system.eventLogger
system.eventLogger.on('agent:complete', (event) => {
  console.log('Done!', event.data.result);
});

// Execute agent - events will be emitted as execution progresses
const result = await system.executor.execute('researcher', 'Find React docs');
```

## Architecture Benefits

### Multi-Consumer Design

Multiple systems can consume the same events simultaneously:
- Console logger for development
- Storage for audit logs
- Web UI for real-time visualization
- Metrics collector for monitoring
- Custom integrations

### Decoupled Components

Event emission doesn't depend on consumers:
- Add/remove subscribers without changing core code
- Subscribers can't break execution
- Each subscriber processes events independently

### Real-Time Capable

Events are emitted immediately as they occur:
- Web UIs see execution in real-time
- Progress bars update live
- Costs are tracked as incurred
- Errors are visible immediately

## Performance Considerations

### EventEmitter Efficiency

Node.js EventEmitter is highly optimized:
- Minimal overhead per event
- Synchronous by default (no await needed)
- Max listeners set to 20 (configurable)

### Storage Performance

Storage operations are async and non-blocking:
- Event emission happens immediately
- Storage writes happen in background
- Errors don't block execution

## Testing with Events

### Unit Tests

```typescript
test('should emit tool call events', () => {
  const logger = new EventLogger(new MemoryStorage(), 'test');
  const events: any[] = [];

  logger.on('tool:call', (event) => events.push(event));

  logger.logToolCall('agent', 'Read', 'tool-123', { path: '/file.txt' });

  expect(events).toHaveLength(1);
  expect(events[0].data.tool).toBe('Read');
});
```

### Integration Tests

```typescript
test('should stream events to web client', async () => {
  const system = await AgentSystemBuilder.default().build();
  const events: any[] = [];

  system.eventLogger.on('*', (event) => events.push(event));

  await system.executor.execute('agent', 'test task');

  expect(events.length).toBeGreaterThan(0);
  expect(events.some(e => e.type === 'agent:complete')).toBe(true);
});
```

## Best Practices

### Error Handling

Always wrap event handlers in try-catch:

```typescript
eventLogger.on('*', (event) => {
  try {
    processEvent(event);
  } catch (error) {
    console.error('Event handler error:', error);
    // Don't throw - let other handlers continue
  }
});
```

### Cleanup

Unsubscribe when done to prevent memory leaks:

```typescript
const handler = (event) => { /* ... */ };
eventLogger.on('tool:call', handler);

// Later, when cleaning up:
eventLogger.off('tool:call', handler);
```

### Wildcard Usage

Use wildcards judiciously:
- Great for logging, debugging, web UIs
- Careful with heavy processing on every event
- Consider filtering events client-side when possible

## Future Enhancements

Potential future additions:
- Event filtering at subscription time
- Event batching for high-throughput scenarios
- Event replay from storage
- Time-travel debugging
- Event aggregation/rollups

## See Also

- [Web UI Integration Guide](./web-ui-integration.md)
- [Session Persistence](./session-persistence.md)
- [Architecture Overview](./ARCHITECTURE.md)
