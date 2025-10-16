# Logging and Debugging

## Overview

The agent system provides comprehensive logging and debugging capabilities through multiple mechanisms:
- **ConsoleLogger** - Real-time colored output for development
- **EventLogger** - Event emission and persistence for audit/analysis
- **GetSessionLog tool** - Allows agents to read their own execution history

## ConsoleLogger

### Features

The `ConsoleLogger` provides rich terminal output with:
- **Color-coded output** - Different colors for different message types
- **Timestamps** - Optional HH:MM:SS timestamps
- **Verbosity levels** - minimal, normal, verbose
- **Indentation** - Visual hierarchy for agent delegation
- **Agent separation** - Blank lines between different agents
- **Multiline support** - Proper formatting for long responses

### Configuration

```typescript
import { ConsoleLogger } from '@agent-system/core';

const logger = new ConsoleLogger({
  timestamps: true,     // Show HH:MM:SS timestamps (default: true)
  colors: true,         // Enable ANSI colors (default: true)
  verbosity: 'normal'   // 'minimal' | 'normal' | 'verbose' (default: 'normal')
});
```

### Verbosity Levels

#### Minimal
- User messages
- Agent responses (truncated to 100 chars)
- Errors
- No tool calls, no system messages

**Best for**: Production, end-user facing applications

```typescript
verbosity: 'minimal'
```

Example output:
```
[10:30:15] > User: Analyze the React docs
[10:30:16] orchestrator: I'll analyze the React documentation for you...
```

#### Normal (Default)
- User messages
- Agent responses (full)
- Tool calls (name only, no params)
- Delegation events
- Completion messages

**Best for**: Development, debugging agent behavior

```typescript
verbosity: 'normal'
```

Example output:
```
[10:30:15] > User: Analyze the React docs

[10:30:16] === orchestrator ===
[10:30:17] orchestrator: I'll analyze the React documentation for you.
[10:30:17]   calling WebFetch(...)
[10:30:18]   calling Read(...)
[10:30:19] orchestrator: Based on my analysis, React 18 introduces...

[10:30:20] === orchestrator completed (4.2s) ===
```

#### Verbose
- Everything from 'normal'
- Tool parameters (full JSON)
- Tool results
- System messages
- Iteration counts
- Model selection
- MCP server connections
- Todo updates
- Stack traces on errors

**Best for**: Deep debugging, performance analysis

```typescript
verbosity: 'verbose'
```

Example output:
```
[10:30:15] > User: Analyze the React docs
[10:30:16] # orchestrator using claude-3-5-haiku-20241022 (anthropic)

[10:30:16] === orchestrator ===
Task: Analyze the React docs
[10:30:17] (iteration 1)
[10:30:17] orchestrator: I'll analyze the React documentation.
[10:30:17]   calling WebFetch({
      "url": "https://react.dev",
      "prompt": "Get latest docs"
    })
[10:30:18]   result: Successfully fetched...
[10:30:19] # Todos: 1 pending, 1 active, 0 done
[10:30:20] === orchestrator completed (4.2s) ===
```

### Color Scheme

```
User messages:     Cyan      > User: ...
Agent messages:    Green     agent-name: ...
System messages:   Dim       # System info
Tool calls:        Dim         calling Tool(...)
Errors:            Red       ERROR: ...
Delegation:        Magenta   [Calling child-agent]
Completion:        Dim       === agent completed ===
```

### Usage in AgentSystemBuilder

```typescript
const system = await AgentSystemBuilder.default()
  .withAgents(['agents/researcher.md'])
  .build();

// ConsoleLogger is included by default with 'normal' verbosity
```

To customize:
```typescript
// Create custom console logger
const logger = new ConsoleLogger({
  verbosity: 'verbose',
  timestamps: true,
  colors: true
});

// Use with AgentExecutor
const executor = new AgentExecutor(
  agentLoader,
  toolRegistry,
  config,
  modelName,
  logger,
  sessionId
);
```

## EventLogger with Event System

### Overview

EventLogger combines persistence with real-time event emission. See [Event System Documentation](./event-system.md) for complete details.

### Debugging with Events

#### Subscribe to Specific Events

```typescript
const system = await AgentSystemBuilder.default().build();

// Debug tool calls
system.eventLogger.on('tool:call', (event) => {
  console.log('Tool:', event.data.tool);
  console.log('Params:', event.data.params);
});

// Debug errors
system.eventLogger.on('tool:error', (event) => {
  console.error('Tool failed:', event.data.tool);
  console.error('Error:', event.data.error);
});

// Debug token usage
system.eventLogger.on('message:assistant', (event) => {
  if (event.metadata?.tokens) {
    console.log('Tokens used:', event.metadata.tokens);
    console.log('Cost:', event.metadata.cost);
  }
});
```

#### Custom Debug Subscriber

```typescript
function createDebugSubscriber(eventLogger: EventLogger) {
  const startTime = Date.now();
  const stats = {
    toolCalls: 0,
    errors: 0,
    totalTokens: 0,
    totalCost: 0
  };

  eventLogger.on('tool:call', () => stats.toolCalls++);
  eventLogger.on('tool:error', () => stats.errors++);

  eventLogger.on('message:assistant', (event) => {
    if (event.metadata?.tokens) stats.totalTokens += event.metadata.tokens;
    if (event.metadata?.cost) stats.totalCost += event.metadata.cost;
  });

  eventLogger.on('agent:complete', () => {
    const duration = Date.now() - startTime;
    console.log('\n=== Debug Summary ===');
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`Tool calls: ${stats.toolCalls}`);
    console.log(`Errors: ${stats.errors}`);
    console.log(`Tokens: ${stats.totalTokens}`);
    console.log(`Cost: $${stats.totalCost.toFixed(4)}`);
  });
}

const system = await AgentSystemBuilder.default().build();
createDebugSubscriber(system.eventLogger);
```

## GetSessionLog Tool

### Overview

The `GetSessionLog` tool allows agents to read their own execution history, enabling self-reflection and debugging.

### Agent Usage

Agents with access to this tool can:
```markdown
Please review my previous actions using GetSessionLog to see what I tried before.
```

The tool returns the session event log in a formatted, readable way.

### Use Cases

**Self-Debugging**
- Agent reviews what tools it called
- Identifies failed operations
- Adjusts strategy based on history

**Context Recovery**
- Understand what happened earlier in session
- Avoid repeating failed approaches
- Build on previous progress

**Audit Trail**
- Generate execution summaries
- Create progress reports
- Document decision-making process

## Debugging Strategies

### Development Workflow

1. **Start with 'normal' verbosity**
   ```typescript
   new ConsoleLogger({ verbosity: 'normal' })
   ```

2. **Switch to 'verbose' when debugging issues**
   ```typescript
   new ConsoleLogger({ verbosity: 'verbose' })
   ```

3. **Add custom event subscribers for specific debugging**
   ```typescript
   system.eventLogger.on('tool:error', (event) => {
     // Log to external monitoring system
   });
   ```

### Common Debugging Scenarios

#### Why did agent fail?

```typescript
// 1. Check console output (verbose mode)
new ConsoleLogger({ verbosity: 'verbose' })

// 2. Subscribe to errors
system.eventLogger.on('agent:error', (event) => {
  console.error('Agent failed:', event.data.agent);
  console.error('Error:', event.data.error);
  console.error('Stack:', event.data.stack);
});
```

#### Why is execution slow?

```typescript
// Use verbose logging to see timing for each operation
new ConsoleLogger({ verbosity: 'verbose' })

// Or track timing with custom event subscribers
const toolStarts = new Map<string, number>();

system.eventLogger.on('tool:call', (event) => {
  toolStarts.set(event.data.id, event.timestamp);
});

system.eventLogger.on('tool:result', (event) => {
  const startTime = toolStarts.get(event.data.id);
  if (startTime) {
    const duration = event.timestamp - startTime;
    if (duration > 1000) {
      console.warn(`Slow tool: ${event.data.tool} took ${duration}ms`);
    }
  }
});
```

#### Why are costs high?

```typescript
system.eventLogger.on('message:assistant', (event) => {
  if (event.metadata?.cost && event.metadata.cost > 0.1) {
    console.warn('Expensive call:', {
      agent: event.data.agent,
      tokens: event.metadata.tokens,
      cost: event.metadata.cost,
      model: event.metadata.model
    });
  }
});
```

#### Why did agent make this decision?

```typescript
// Enable verbose to see ALL tool calls and parameters
new ConsoleLogger({ verbosity: 'verbose' })

// Or subscribe to specific tools
system.eventLogger.on('tool:call', (event) => {
  if (event.data.tool === 'Delegate') {
    console.log('Delegation decision:', {
      to: event.data.params.agent,
      task: event.data.params.task,
      reasoning: 'Check agent prompt for context'
    });
  }
});
```

### Testing and CI/CD

#### Test Logging

```typescript
// tests/unit/my-test.test.ts
test('agent behavior', async () => {
  // Use minimal verbosity for clean test output
  const logger = new ConsoleLogger({ verbosity: 'minimal' });

  const system = await AgentSystemBuilder.default()
    .withSessionId('test-session')
    .build();

  await system.executor.execute('agent', 'task');

  // Analyze events for assertions
  const events = await system.eventLogger.getSessionEvents();
  expect(events.some(e => e.type === 'agent:complete')).toBe(true);
});
```

#### CI Logging

```typescript
// Use minimal in CI to reduce log noise
const verbosity = process.env.CI ? 'minimal' : 'normal';
const logger = new ConsoleLogger({ verbosity });
```

## Session Persistence and Replay

### Saving Sessions

Sessions are automatically saved to storage when using EventLogger:

```typescript
const system = await AgentSystemBuilder.default()
  .withSessionId('debug-session-001')
  .build();

// All events are automatically persisted
await system.executor.execute('agent', 'task');

// Session file: sessions/debug-session-001.jsonl
```

### Replaying Sessions

Programmatically analyze session events:
```typescript
import { FilesystemStorage } from '@agent-system/core';

const storage = new FilesystemStorage();
const events = await storage.getEvents('debug-session-001');

// Analyze events
events.forEach(event => {
  if (event.type === 'tool:error') {
    console.log('Error at', new Date(event.timestamp));
    console.log('Tool:', event.data.tool);
    console.log('Message:', event.data.error);
  }
});
```

## Performance Monitoring

### Real-Time Performance Tracking

```typescript
class PerformanceMonitor {
  private toolTimings = new Map<string, number[]>();

  constructor(eventLogger: EventLogger) {
    const toolStarts = new Map<string, number>();

    eventLogger.on('tool:call', (event) => {
      toolStarts.set(event.data.id, event.timestamp);
    });

    eventLogger.on('tool:result', (event) => {
      const startTime = toolStarts.get(event.data.id);
      if (startTime) {
        const duration = event.timestamp - startTime;
        const tool = event.data.tool;

        if (!this.toolTimings.has(tool)) {
          this.toolTimings.set(tool, []);
        }
        this.toolTimings.get(tool)!.push(duration);
      }
    });
  }

  getStats() {
    const stats: Record<string, any> = {};

    for (const [tool, timings] of this.toolTimings) {
      const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
      const max = Math.max(...timings);
      const min = Math.min(...timings);

      stats[tool] = {
        calls: timings.length,
        avgMs: avg.toFixed(2),
        maxMs: max.toFixed(2),
        minMs: min.toFixed(2)
      };
    }

    return stats;
  }
}

// Usage
const monitor = new PerformanceMonitor(system.eventLogger);
await system.executor.execute('agent', 'task');
console.log(monitor.getStats());

// Output:
// {
//   Read: { calls: 5, avgMs: '123.45', maxMs: '234.56', minMs: '45.67' },
//   WebFetch: { calls: 2, avgMs: '1234.56', maxMs: '1500.00', minMs: '969.12' }
// }
```

## Best Practices

### Development
- Use **'normal' verbosity** for regular development
- Enable **'verbose'** when debugging specific issues
- Keep **timestamps enabled** to correlate with external logs

### Production
- Use **'minimal' verbosity** or disable ConsoleLogger entirely
- Rely on **EventLogger** for audit trails
- Send events to external monitoring systems

### Testing
- Use **'minimal' verbosity** to keep test output clean
- Verify behavior through **event assertions**, not console output
- Use **NoOpLogger** for tests that don't need logging

### Debugging
1. **Start broad** - Check 'normal' console output
2. **Zoom in** - Enable 'verbose' for specific agents
3. **Analyze timing** - Use event subscribers to track performance
4. **Track events** - Subscribe to relevant event types
5. **Replay sessions** - Use saved session logs for post-mortem

## See Also

- [Event System](./event-system.md) - Event emission and subscription
- [Session Persistence](./session-persistence.md) - Storage and recovery
- [Web UI Guide](./web-ui.md) - Real-time event visualization
