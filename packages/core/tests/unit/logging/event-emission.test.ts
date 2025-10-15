import { describe, expect, it } from 'vitest';
import { EventLogger } from '@/logging/event.logger';
import { InMemoryStorage } from '@/session/memory.storage';
import { AnySessionEvent } from '@/session/types';

describe('EventLogger Event Emission', () => {
  it('should emit events when logging user messages', () => {
    const storage = new InMemoryStorage();
    const logger = new EventLogger(storage, 'test-session');

    const events: AnySessionEvent[] = [];
    logger.on('message:user', (event) => events.push(event as AnySessionEvent));

    logger.logUserMessage('Hello world');

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('user');
    if (events[0].type === 'user') {
      expect(events[0].data.content).toBe('Hello world');
    }
  });

  it('should emit events when logging assistant messages', () => {
    const storage = new InMemoryStorage();
    const logger = new EventLogger(storage, 'test-session');

    const events: AnySessionEvent[] = [];
    logger.on('message:assistant', (event) => events.push(event as AnySessionEvent));

    logger.logAssistantMessage('test-agent', 'Response text');

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('assistant');
    if (events[0].type === 'assistant') {
      expect(events[0].data.agent).toBe('test-agent');
      expect(events[0].data.content).toBe('Response text');
    }
  });

  it('should emit events when logging tool calls', () => {
    const storage = new InMemoryStorage();
    const logger = new EventLogger(storage, 'test-session');

    const events: AnySessionEvent[] = [];
    logger.on('tool:call', (event) => events.push(event as AnySessionEvent));

    logger.logToolCall('agent', 'Read', 'tool-123', { path: '/test' });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('tool_call');
    if (events[0].type === 'tool_call') {
      expect(events[0].data.tool).toBe('Read');
      expect(events[0].data.params).toEqual({ path: '/test' });
    }
  });

  it('should emit events when logging tool results', () => {
    const storage = new InMemoryStorage();
    const logger = new EventLogger(storage, 'test-session');

    const events: AnySessionEvent[] = [];
    logger.on('tool:result', (event) => events.push(event as AnySessionEvent));

    logger.logToolResult('agent', 'Read', 'tool-123', { content: 'file content' });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('tool_result');
    if (events[0].type === 'tool_result') {
      expect(events[0].data.toolCallId).toBe('tool-123');
    }
  });

  it('should emit all events to wildcard subscribers', () => {
    const storage = new InMemoryStorage();
    const logger = new EventLogger(storage, 'test-session');

    const allEvents: unknown[] = [];
    logger.on('*', (event) => allEvents.push(event));

    logger.logUserMessage('User message');
    logger.logAssistantMessage('agent', 'Agent response');
    logger.logToolCall('agent', 'Read', 'tool-1', {});
    logger.logToolResult('agent', 'Read', 'tool-1', 'result');

    expect(allEvents).toHaveLength(4);
  });

  it('should support multiple subscribers to the same event', () => {
    const storage = new InMemoryStorage();
    const logger = new EventLogger(storage, 'test-session');

    const subscriber1Events: AnySessionEvent[] = [];
    const subscriber2Events: AnySessionEvent[] = [];

    logger.on('message:user', (event) => subscriber1Events.push(event as AnySessionEvent));
    logger.on('message:user', (event) => subscriber2Events.push(event as AnySessionEvent));

    logger.logUserMessage('Test');

    expect(subscriber1Events).toHaveLength(1);
    expect(subscriber2Events).toHaveLength(1);
    expect(subscriber1Events[0]).toEqual(subscriber2Events[0]);
  });

  it('should support unsubscribing from events', () => {
    const storage = new InMemoryStorage();
    const logger = new EventLogger(storage, 'test-session');

    const events: AnySessionEvent[] = [];
    const handler = (event: unknown) => events.push(event as AnySessionEvent);

    logger.on('message:user', handler);
    logger.logUserMessage('Message 1');

    logger.off('message:user', handler);
    logger.logUserMessage('Message 2');

    // Only the first message should be captured
    expect(events).toHaveLength(1);
    if (events[0].type === 'user') {
      expect(events[0].data.content).toBe('Message 1');
    }
  });

  it('should support once() for single event subscription', () => {
    const storage = new InMemoryStorage();
    const logger = new EventLogger(storage, 'test-session');

    const events: AnySessionEvent[] = [];
    logger.once('message:user', (event) => events.push(event as AnySessionEvent));

    logger.logUserMessage('Message 1');
    logger.logUserMessage('Message 2');

    // Only the first message should be captured
    expect(events).toHaveLength(1);
    if (events[0].type === 'user') {
      expect(events[0].data.content).toBe('Message 1');
    }
  });

  it('should emit delegation events', () => {
    const storage = new InMemoryStorage();
    const logger = new EventLogger(storage, 'test-session');

    const startEvents: unknown[] = [];
    const completeEvents: unknown[] = [];

    logger.on('delegation:start', (event) => startEvents.push(event));
    logger.on('delegation:complete', (event) => completeEvents.push(event));

    logger.logDelegation('parent-agent', 'child-agent', 'Do something');
    logger.logDelegationComplete('parent-agent', 'child-agent', 'Task completed');

    expect(startEvents).toHaveLength(1);
    expect(completeEvents).toHaveLength(1);
  });

  it('should emit agent lifecycle events', () => {
    const storage = new InMemoryStorage();
    const logger = new EventLogger(storage, 'test-session');

    const events: unknown[] = [];
    logger.on('agent:start', (event) => events.push(event));
    logger.on('agent:iteration', (event) => events.push(event));
    logger.on('agent:complete', (event) => events.push(event));

    logger.logAgentStart('test-agent', 0, 'Test task');
    logger.logAgentIteration('test-agent', 1);
    logger.logAgentComplete('test-agent', 1000);

    expect(events).toHaveLength(3);
  });

  it('should emit todo update events', () => {
    const storage = new InMemoryStorage();
    const logger = new EventLogger(storage, 'test-session');

    const events: unknown[] = [];
    logger.on('todo:update', (event) => events.push(event));

    logger.logTodoUpdate([
      { content: 'Task 1', status: 'pending', activeForm: 'Doing task 1' },
      { content: 'Task 2', status: 'completed', activeForm: 'Doing task 2' },
    ]);

    expect(events).toHaveLength(1);
  });

  it('should still persist events to storage', async () => {
    const storage = new InMemoryStorage();
    const logger = new EventLogger(storage, 'test-session');

    logger.logUserMessage('Test message');
    logger.logAssistantMessage('agent', 'Response');

    const storedEvents = await logger.getSessionEvents();

    expect(storedEvents).toHaveLength(2);
    expect(storedEvents[0].type).toBe('user');
    expect(storedEvents[1].type).toBe('assistant');
  });

  it('should emit and persist simultaneously', async () => {
    const storage = new InMemoryStorage();
    const logger = new EventLogger(storage, 'test-session');

    const emittedEvents: AnySessionEvent[] = [];
    logger.on('*', (event) => emittedEvents.push(event as AnySessionEvent));

    logger.logUserMessage('Message 1');
    logger.logAssistantMessage('agent', 'Message 2');

    const storedEvents = await logger.getSessionEvents();

    // Both emitted and stored
    expect(emittedEvents).toHaveLength(2);
    expect(storedEvents).toHaveLength(2);
    expect(emittedEvents[0].type).toBe(storedEvents[0].type);
  });
});
