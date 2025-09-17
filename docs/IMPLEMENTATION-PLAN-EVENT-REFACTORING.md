# Implementation Plan: Event System Enhancement for Web UI

## Executive Summary

**Objective**: Add event emission to EventLogger to enable Web UI and other integrations while preserving all existing functionality.

**Duration**: 2 days
**Risk Level**: Low
**Business Value**: Enables Web UI → 100x user base expansion

## Why This Change

### Current Limitation
- EventLogger stores events for audit/recovery but doesn't emit them
- No way to observe execution in real-time
- Blocks Web UI development entirely

### Solution
- Add EventEmitter to EventLogger
- Keep all existing functionality
- Enable real-time event observation

## Architecture Overview

### Current
```
Executor → EventLogger → Storage (one-way, fire-and-forget)
         → ConsoleLogger → Console
```

### New
```
Executor → EventLogger → Storage (unchanged)
                      ↘
                        EventEmitter → Subscribers (Console, WebSocket, Metrics, etc.)
```

## Implementation Steps

### Phase 1: Enhance EventLogger (Day 1 Morning - 3 hours)

#### 1.1 Add EventEmitter to EventLogger
```typescript
// File: src/logging/event.logger.ts
import { EventEmitter } from 'events';

export class EventLogger implements AgentLogger {
  private readonly toolCallMap = new Map<string, { tool: string; agent: string }>();
  private traceId?: string;
  private parentCallId?: string;

  // ADD: Event emitter for real-time subscriptions
  private readonly emitter = new EventEmitter();

  constructor(
    private readonly storage: SessionStorage,
    private readonly sessionId: string
  ) {
    // Set max listeners to avoid warnings
    this.emitter.setMaxListeners(20);
  }

  // ADD: Subscription methods
  on(event: string, handler: (event: AnySessionEvent) => void): void {
    this.emitter.on(event, handler);
  }

  off(event: string, handler: (event: AnySessionEvent) => void): void {
    this.emitter.off(event, handler);
  }

  once(event: string, handler: (event: AnySessionEvent) => void): void {
    this.emitter.once(event, handler);
  }

  // MODIFY: Existing methods to emit events
  logUserMessage(content: string): void {
    const event: UserMessageEvent = {
      type: 'user',
      timestamp: Date.now(),
      data: { role: 'user', content }
    };

    // KEEP: Store for audit/recovery
    this.storage.appendEvent(this.sessionId, event).catch((error) => {
      console.error('Failed to log user message:', error);
    });

    // ADD: Emit for real-time subscribers
    this.emit('message:user', event);
  }

  logAssistantMessage(agent: string, content: string, metadata?: LLMMetadata): void {
    const event: AssistantMessageEvent = {
      type: 'assistant',
      timestamp: Date.now(),
      data: { role: 'assistant', content, agent },
      metadata
    };

    this.storage.appendEvent(this.sessionId, event).catch((error) => {
      console.error('Failed to log assistant message:', error);
    });

    // ADD: Emit event
    this.emit('message:assistant', event);
  }

  logToolCall(
    agent: string,
    tool: string,
    toolId: string,
    params: Record<string, unknown>,
    metadata?: LLMMetadata
  ): void {
    // KEEP: Tool mapping for tests
    this.toolCallMap.set(toolId, { tool, agent });

    const event: ToolCallEvent = {
      type: 'tool_call',
      timestamp: Date.now(),
      data: {
        id: toolId,
        tool,
        params,
        agent,
        traceId: this.traceId,
        parentCallId: this.parentCallId,
      },
      metadata,
    };

    this.storage.appendEvent(this.sessionId, event).catch((error) => {
      console.error('Failed to log tool call:', error);
    });

    // ADD: Emit event
    this.emit('tool:call', event);
  }

  // ADD: Private emit helper
  private emit(eventName: string, event: AnySessionEvent): void {
    this.emitter.emit(eventName, event);
    this.emitter.emit('*', event);  // Wildcard for catch-all subscribers
  }

  // KEEP: All other existing methods unchanged
  setTraceContext(traceId?: string, parentCallId?: string): void {
    this.traceId = traceId;
    this.parentCallId = parentCallId;
  }

  async getSessionEvents(): Promise<AnySessionEvent[]> {
    return this.storage.getEvents(this.sessionId);
  }

  // ... rest of existing methods
}
```

#### 1.2 Create Event Type Map
```typescript
// File: src/logging/event-types.ts
export const EventTypes = {
  // Messages
  'message:user': 'message:user',
  'message:assistant': 'message:assistant',
  'message:system': 'message:system',

  // Tools
  'tool:call': 'tool:call',
  'tool:execution': 'tool:execution',
  'tool:result': 'tool:result',
  'tool:error': 'tool:error',

  // Agents
  'agent:start': 'agent:start',
  'agent:iteration': 'agent:iteration',
  'agent:complete': 'agent:complete',
  'agent:error': 'agent:error',

  // Delegation
  'delegation:start': 'delegation:start',
  'delegation:complete': 'delegation:complete',

  // Todos
  'todo:update': 'todo:update',

  // Wildcard
  '*': '*'
} as const;

export type EventType = keyof typeof EventTypes;
```

### Phase 2: Remove AgentLogger Interface (Day 1 Afternoon - 2 hours)

#### 2.1 Delete Interface File
```bash
rm src/logging/types.ts  # Remove AgentLogger interface
```

#### 2.2 Update Imports
```typescript
// Change all files that import AgentLogger
// FROM:
import { AgentLogger } from '@/logging/types';
// TO:
import { EventLogger } from '@/logging/event.logger';
```

#### 2.3 Update Type References
```typescript
// File: src/agents/executor.ts
export class AgentExecutor {
  private logger: EventLogger;  // Was: AgentLogger

  constructor(
    private readonly agentLoader: AgentLoader,
    private readonly toolRegistry: ToolRegistry,
    private readonly config: ResolvedSystemConfig,
    modelName?: string,
    logger?: EventLogger,  // Was: AgentLogger
    sessionId?: string,
    private readonly sessionManager?: SimpleSessionManager
  ) {
    this.sessionId = sessionId;
    this.logger = logger || new EventLogger(
      new MemoryStorage(),
      sessionId || 'default'
    );
  }
}
```

#### 2.4 Update Middleware Context
```typescript
// File: src/middleware/types.ts
export interface ExecutorContext {
  logger: EventLogger;  // Was: AgentLogger
  // ... rest unchanged
}
```

### Phase 3: Convert ConsoleLogger to Subscriber (Day 2 Morning - 3 hours)

#### 3.1 Create Console Subscriber
```typescript
// File: src/subscribers/console.subscriber.ts
import { EventLogger } from '@/logging/event.logger';
import { AnySessionEvent } from '@/session/types';

export interface ConsoleOptions {
  verbosity?: 'minimal' | 'normal' | 'verbose';
  timestamps?: boolean;
}

interface ConsoleState {
  lastLoggedAgent?: string;
  depthIndentCache: Map<number, string>;
  showTimestamps: boolean;
  verbosity: 'minimal' | 'normal' | 'verbose';
}

export function createConsoleSubscriber(
  logger: EventLogger,
  options?: ConsoleOptions
): () => void {
  const state: ConsoleState = {
    lastLoggedAgent: undefined,
    depthIndentCache: new Map(),
    showTimestamps: options?.timestamps ?? false,
    verbosity: options?.verbosity ?? 'normal'
  };

  // Helper functions
  const color = (text: string, colorName: string): string => {
    const colors: Record<string, string> = {
      cyan: '\x1b[36m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      red: '\x1b[31m',
      dim: '\x1b[90m',
      reset: '\x1b[0m'
    };
    return `${colors[colorName] || ''}${text}${colors.reset}`;
  };

  const formatTimestamp = (): string => {
    if (!state.showTimestamps) return '';
    const now = new Date();
    return `[${now.getHours().toString().padStart(2, '0')}:${
      now.getMinutes().toString().padStart(2, '0')}:${
      now.getSeconds().toString().padStart(2, '0')}] `;
  };

  const addAgentSeparatorIfNeeded = (currentAgent: string): void => {
    if (state.lastLoggedAgent && state.lastLoggedAgent !== currentAgent) {
      console.log('');
    }
    state.lastLoggedAgent = currentAgent;
  };

  // Event handlers
  const handleUserMessage = (event: AnySessionEvent): void => {
    if (event.type !== 'user') return;
    addAgentSeparatorIfNeeded('user');
    const timestamp = formatTimestamp();
    console.log(`${timestamp}${color('> User', 'cyan')}: ${event.data.content}`);
  };

  const handleAssistantMessage = (event: AnySessionEvent): void => {
    if (event.type !== 'assistant') return;
    const { agent, content } = event.data;

    if (state.verbosity === 'minimal' && content.length > 100) {
      content = content.substring(0, 100) + '...';
    }

    addAgentSeparatorIfNeeded(agent);
    const timestamp = formatTimestamp();

    // Multi-line formatting
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      if (i === 0) {
        console.log(`${timestamp}${color(agent, 'green')}: ${line}`);
      } else if (line.trim()) {
        console.log(`${' '.repeat(timestamp.length)}${color('|', 'dim')} ${line}`);
      }
    });
  };

  const handleToolCall = (event: AnySessionEvent): void => {
    if (event.type !== 'tool_call') return;
    if (state.verbosity === 'minimal') return;

    const timestamp = formatTimestamp();
    console.log(`${timestamp}  ${color('calling', 'dim')} ${event.data.tool}(...)`);
  };

  const handleToolResult = (event: AnySessionEvent): void => {
    if (event.type !== 'tool_result') return;
    if (state.verbosity !== 'verbose') return;

    const timestamp = formatTimestamp();
    console.log(`${timestamp}  ${color('→', 'dim')} Tool completed`);
  };

  const handleSystemMessage = (event: AnySessionEvent): void => {
    if (event.type !== 'system') return;
    if (state.verbosity === 'minimal') return;

    const timestamp = formatTimestamp();
    console.log(`${timestamp}${color('#', 'dim')} ${event.data.message}`);
  };

  // Subscribe to events
  logger.on('message:user', handleUserMessage);
  logger.on('message:assistant', handleAssistantMessage);
  logger.on('tool:call', handleToolCall);
  logger.on('tool:result', handleToolResult);
  logger.on('message:system', handleSystemMessage);

  // Return unsubscribe function
  return () => {
    logger.off('message:user', handleUserMessage);
    logger.off('message:assistant', handleAssistantMessage);
    logger.off('tool:call', handleToolCall);
    logger.off('tool:result', handleToolResult);
    logger.off('message:system', handleSystemMessage);
  };
}
```

#### 3.2 Update SystemBuilder
```typescript
// File: src/config/system-builder.ts
import { createConsoleSubscriber } from '@/subscribers/console.subscriber';

export class AgentSystemBuilder {
  private consoleOptions?: ConsoleOptions;
  private subscribers: Array<(logger: EventLogger) => void> = [];

  withConsoleOutput(options?: ConsoleOptions): this {
    this.consoleOptions = options;
    return this;
  }

  withSubscriber(subscriber: (logger: EventLogger) => void): this {
    this.subscribers.push(subscriber);
    return this;
  }

  build(): AgentSystem {
    // Create event logger
    const eventLogger = new EventLogger(this.storage, this.sessionId);

    // Add console subscriber if configured
    if (this.consoleOptions !== false) {
      createConsoleSubscriber(eventLogger, this.consoleOptions);
    }

    // Add custom subscribers
    this.subscribers.forEach(sub => sub(eventLogger));

    // Create executor with event logger
    const executor = new AgentExecutor(
      this.agentLoader,
      this.toolRegistry,
      this.config,
      this.modelName,
      eventLogger,
      this.sessionId,
      this.sessionManager
    );

    return { executor, eventLogger };
  }
}
```

#### 3.3 Delete Old Console Logger
```bash
rm src/logging/console.logger.ts
rm src/logging/composite.logger.ts
rm src/logging/factory.ts
```

### Phase 4: Testing & Validation (Day 2 Afternoon - 3 hours)

#### 4.1 Test Event Emission
```typescript
// File: tests/unit/logging/event-emission.test.ts
import { EventLogger } from '@/logging/event.logger';
import { MemoryStorage } from '@/session/memory.storage';

describe('EventLogger Event Emission', () => {
  it('should emit events when logging', async () => {
    const storage = new MemoryStorage();
    const logger = new EventLogger(storage, 'test-session');

    const events: any[] = [];
    logger.on('*', (event) => events.push(event));

    logger.logUserMessage('Test message');
    logger.logToolCall('agent', 'tool', 'id-123', { param: 'value' });

    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('user');
    expect(events[1].type).toBe('tool_call');
  });

  it('should allow specific event subscriptions', async () => {
    const logger = new EventLogger(new MemoryStorage(), 'test');

    let toolCallReceived = false;
    logger.on('tool:call', () => { toolCallReceived = true; });

    logger.logUserMessage('Test');  // Should not trigger
    expect(toolCallReceived).toBe(false);

    logger.logToolCall('agent', 'tool', 'id', {});
    expect(toolCallReceived).toBe(true);
  });
});
```

#### 4.2 Test Console Output Parity
```typescript
// File: tests/integration/console-parity.test.ts
import { createConsoleSubscriber } from '@/subscribers/console.subscriber';

describe('Console Output Parity', () => {
  it('should produce identical output to old ConsoleLogger', () => {
    const oldOutput = captureOldConsoleLogger();
    const newOutput = captureNewConsoleSubscriber();

    expect(newOutput).toEqual(oldOutput);
  });
});
```

#### 4.3 Test WebSocket Integration
```typescript
// File: tests/integration/websocket.test.ts
import { Server } from 'socket.io';
import { EventLogger } from '@/logging/event.logger';

describe('WebSocket Event Streaming', () => {
  it('should stream events to connected clients', (done) => {
    const io = new Server(3001);
    const logger = new EventLogger(new MemoryStorage(), 'test');

    logger.on('*', (event) => {
      io.emit('agent-event', event);
    });

    const client = require('socket.io-client')('http://localhost:3001');

    client.on('agent-event', (event: any) => {
      expect(event.type).toBe('user');
      expect(event.data.content).toBe('Test message');
      done();
    });

    logger.logUserMessage('Test message');
  });
});
```

### Phase 5: Web UI Integration Example (Bonus - 1 hour)

#### 5.1 Backend WebSocket Server
```typescript
// File: examples/web-ui/server.ts
import express from 'express';
import { Server } from 'socket.io';
import { AgentSystemBuilder } from '@/config/system-builder';

const app = express();
const server = app.listen(3000);
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  socket.on('execute-agent', async (data) => {
    const { agent, prompt, sessionId } = data;

    // Build system with event streaming
    const system = await AgentSystemBuilder.default()
      .withSessionId(sessionId)
      .withSubscriber((logger) => {
        // Stream all events to this specific client
        logger.on('*', (event) => {
          socket.emit('agent-event', {
            sessionId,
            event,
            timestamp: Date.now()
          });
        });
      })
      .build();

    // Execute and stream results
    try {
      const result = await system.executor.execute(agent, prompt);
      socket.emit('execution-complete', { sessionId, result });
    } catch (error) {
      socket.emit('execution-error', { sessionId, error: error.message });
    }
  });
});
```

#### 5.2 Frontend React Component
```tsx
// File: examples/web-ui/components/AgentExecution.tsx
import { useState, useEffect } from 'react';
import io from 'socket.io-client';

export function AgentExecution() {
  const [events, setEvents] = useState<any[]>([]);
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    const socket = io('http://localhost:3000');

    socket.on('agent-event', (data) => {
      setEvents(prev => [...prev, data.event]);

      // Update UI based on event
      if (data.event.type === 'agent:start') {
        setStatus('running');
      } else if (data.event.type === 'agent:complete') {
        setStatus('complete');
      }
    });

    return () => socket.close();
  }, []);

  const executeAgent = () => {
    socket.emit('execute-agent', {
      agent: 'research-assistant',
      prompt: 'Analyze the latest React docs',
      sessionId: Date.now().toString()
    });
  };

  return (
    <div>
      <button onClick={executeAgent}>Run Agent</button>
      <div>Status: {status}</div>
      <div>
        {events.map((event, i) => (
          <div key={i}>
            {event.type}: {JSON.stringify(event.data)}
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Testing Checklist

- [ ] All existing unit tests pass
- [ ] All existing integration tests pass
- [ ] Console output is byte-for-byte identical
- [ ] Session recovery still works
- [ ] Tool mappings preserved
- [ ] Events emit correctly
- [ ] WebSocket streaming works
- [ ] No memory leaks
- [ ] No performance regression

## Rollback Plan

If issues are discovered:

1. **Immediate**: Git revert the commit
2. **Alternative**: Add compatibility layer:
```typescript
class LegacyLoggerAdapter {
  constructor(private eventLogger: EventLogger) {}

  // Implement old AgentLogger interface
  logToolCall(...args) {
    this.eventLogger.logToolCall(...args);
  }
}
```

## Success Criteria

1. ✅ All tests pass
2. ✅ Console output unchanged
3. ✅ Events stream to WebSocket
4. ✅ Less than 200 lines changed
5. ✅ Web UI prototype working

## Timeline

| Day | Time | Task | Status |
|-----|------|------|--------|
| Day 1 | 9:00-12:00 | Add EventEmitter to EventLogger | ⬜ |
| Day 1 | 13:00-15:00 | Remove AgentLogger interface | ⬜ |
| Day 1 | 15:00-17:00 | Test & Fix | ⬜ |
| Day 2 | 9:00-12:00 | Create Console Subscriber | ⬜ |
| Day 2 | 13:00-15:00 | Integration Testing | ⬜ |
| Day 2 | 15:00-17:00 | Web UI Proof of Concept | ⬜ |

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Tests break | Low | Medium | Fix incrementally |
| Console output changes | Low | High | Test side-by-side |
| Performance regression | Very Low | Medium | Benchmark before/after |
| Memory leak | Very Low | High | Use profiler |

## Deployment Steps

1. Merge to feature branch
2. Run full test suite
3. Deploy to staging
4. Test Web UI integration
5. Monitor for 24 hours
6. Merge to main
7. Document changes

## Long-Term Benefits

1. **Web UI Enabled** - Unlocks 100x more users
2. **Real-time Monitoring** - See what agents are doing
3. **Integration Ready** - Any system can subscribe
4. **Clean Architecture** - Single source of truth
5. **Future-Proof** - Easy to add new subscribers

## Conclusion

This plan provides a low-risk, high-value enhancement that:
- Preserves all existing functionality
- Enables Web UI and real-time integrations
- Takes only 2 days to implement
- Opens up significant business opportunities

The changes are minimal, focused, and backward-compatible while enabling transformative new capabilities.