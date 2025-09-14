import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventLogger } from '@/logging/event.logger.js';
import { InMemoryStorage } from '@/session/memory.storage';
import {
  AssistantMessageEvent,
  ToolCallEvent,
  ToolResultEvent,
  UserMessageEvent,
} from '@/session/types';

describe('EventLogger', () => {
  let storage: InMemoryStorage;
  let logger: EventLogger;
  const sessionId = 'test-session';

  beforeEach(() => {
    storage = new InMemoryStorage();
    logger = new EventLogger(storage, sessionId);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('logUserMessage', () => {
    it('should log user messages as events', async () => {
      logger.logUserMessage('Hello, assistant!');

      // Give async operation time to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      const events = await storage.readEvents(sessionId);
      expect(events).toHaveLength(1);

      const event = events[0] as UserMessageEvent;
      expect(event.type).toBe('user');
      expect(event.data.role).toBe('user');
      expect(event.data.content).toBe('Hello, assistant!');
      expect(event.timestamp).toBeDefined();
    });

    it('should handle multiple user messages', async () => {
      logger.logUserMessage('First message');
      logger.logUserMessage('Second message');
      logger.logUserMessage('Third message');

      await new Promise((resolve) => setTimeout(resolve, 10));

      const events = await storage.readEvents(sessionId);
      expect(events).toHaveLength(3);

      const contents = events.map((e: any) => e.data.content);
      expect(contents).toEqual(['First message', 'Second message', 'Third message']);
    });
  });

  describe('logAssistantMessage', () => {
    it('should log assistant messages with agent info', async () => {
      logger.logAssistantMessage('default-agent', 'I can help with that!');

      await new Promise((resolve) => setTimeout(resolve, 10));

      const events = await storage.readEvents(sessionId);
      expect(events).toHaveLength(1);

      const event = events[0] as AssistantMessageEvent;
      expect(event.type).toBe('assistant');
      expect(event.data.role).toBe('assistant');
      expect(event.data.content).toBe('I can help with that!');
      expect(event.data.agent).toBe('default-agent');
    });

    it('should handle messages from different agents', async () => {
      logger.logAssistantMessage('agent-1', 'Response from agent 1');
      logger.logAssistantMessage('agent-2', 'Response from agent 2');

      await new Promise((resolve) => setTimeout(resolve, 10));

      const events = await storage.readEvents(sessionId);
      expect(events).toHaveLength(2);

      expect((events[0] as AssistantMessageEvent).data.agent).toBe('agent-1');
      expect((events[1] as AssistantMessageEvent).data.agent).toBe('agent-2');
    });
  });

  describe('logSystemMessage', () => {
    it('should log system messages as assistant messages from system', async () => {
      logger.logSystemMessage('System initialization complete');

      await new Promise((resolve) => setTimeout(resolve, 10));

      const events = await storage.readEvents(sessionId);
      expect(events).toHaveLength(1);

      const event = events[0] as AssistantMessageEvent;
      expect(event.type).toBe('assistant');
      expect(event.data.agent).toBe('system');
      expect(event.data.content).toBe('System initialization complete');
    });
  });

  describe('logToolCall', () => {
    it('should log tool calls with provided ID', async () => {
      const params = { path: '/test/file.txt', encoding: 'utf-8' };
      logger.logToolCall('test-agent', 'Read', 'call-123', params);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const events = await storage.readEvents(sessionId);
      expect(events).toHaveLength(1);

      const event = events[0] as ToolCallEvent;
      expect(event.type).toBe('tool_call');
      expect(event.data.id).toBeDefined();
      expect(event.data.id.length).toBeGreaterThan(0);
      expect(event.data.tool).toBe('Read');
      expect(event.data.params).toEqual(params);
      expect(event.data.agent).toBe('test-agent');
    });

    it('should use provided IDs for each tool call', async () => {
      logger.logToolCall('agent', 'Tool1', 'call-1', {});
      logger.logToolCall('agent', 'Tool2', 'call-2', {});
      logger.logToolCall('agent', 'Tool3', 'call-3', {});

      await new Promise((resolve) => setTimeout(resolve, 10));

      const events = await storage.readEvents(sessionId);
      const ids = events.map((e: any) => e.data.id);

      // All IDs should be unique
      expect(new Set(ids).size).toBe(3);
    });

    it('should handle complex parameters', async () => {
      const complexParams = {
        nested: {
          deeply: {
            value: 'test',
            array: [1, 2, 3],
          },
        },
        boolean: true,
        number: 42,
        null: null,
      };

      logger.logToolCall('agent', 'ComplexTool', 'call-complex', complexParams);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const events = await storage.readEvents(sessionId);
      const event = events[0] as ToolCallEvent;
      expect(event.data.params).toEqual(complexParams);
    });
  });

  describe('logToolExecution', () => {
    it('should store tool execution info for later use', () => {
      // This method just stores info internally, doesn't create events
      logger.logToolExecution('agent', 'TestTool', 'exec-123');

      // Should not throw and should store internally
      expect(() => logger.logToolExecution('agent', 'Tool', 'id')).not.toThrow();
    });
  });

  describe('logToolResult', () => {
    it('should log tool results with reference to tool call', async () => {
      const result = { success: true, data: 'File contents here' };
      logger.logToolResult('agent', 'Read', 'call-123', result);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const events = await storage.readEvents(sessionId);
      expect(events).toHaveLength(1);

      const event = events[0] as ToolResultEvent;
      expect(event.type).toBe('tool_result');
      expect(event.data.toolCallId).toBe('call-123');
      expect(event.data.result).toEqual(result);
    });

    it('should handle different result types', async () => {
      logger.logToolResult('agent', 'Tool', 'id-1', 'string result');
      logger.logToolResult('agent', 'Tool', 'id-2', 42);
      logger.logToolResult('agent', 'Tool', 'id-3', { object: 'result' });
      logger.logToolResult('agent', 'Tool', 'id-4', ['array', 'result']);
      logger.logToolResult('agent', 'Tool', 'id-5', null);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const events = await storage.readEvents(sessionId);
      expect(events).toHaveLength(5);

      const results = events.map((e: any) => e.data.result);
      expect(results).toEqual([
        'string result',
        42,
        { object: 'result' },
        ['array', 'result'],
        null,
      ]);
    });
  });

  describe('logToolError', () => {
    it('should log errors as tool results with error info', async () => {
      const error = new Error('Tool execution failed');
      error.stack = 'Error: Tool execution failed\n  at test.js:10';

      logger.logToolError('agent', 'FailingTool', 'call-456', error);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const events = await storage.readEvents(sessionId);
      expect(events).toHaveLength(1);

      const event = events[0] as ToolResultEvent;
      expect(event.type).toBe('tool_result');
      expect(event.data.toolCallId).toBe('call-456');

      const result = event.data.result as any;
      expect(result.error).toBe(true);
      expect(result.message).toBe('Tool execution failed');
      expect(result.stack).toContain('Tool execution failed');
    });
  });

  describe('logDelegation', () => {
    it('should log delegation events', async () => {
      logger.logDelegation('parent-agent', 'child-agent', 'Analyze this data');

      await new Promise((resolve) => setTimeout(resolve, 10));

      const events = await storage.readEvents(sessionId);
      expect(events).toHaveLength(1);

      const event = events[0] as any;
      expect(event.type).toBe('delegation');
      expect(event.data.parent).toBe('parent-agent');
      expect(event.data.child).toBe('child-agent');
      expect(event.data.task).toBe('Analyze this data');
    });
  });

  describe('logDelegationComplete', () => {
    it('should log delegation completion', async () => {
      logger.logDelegationComplete('parent-agent', 'child-agent', 'Task completed successfully');

      await new Promise((resolve) => setTimeout(resolve, 10));

      const events = await storage.readEvents(sessionId);
      expect(events).toHaveLength(1);

      const event = events[0] as any;
      expect(event.type).toBe('delegation_complete');
      expect(event.data.parent).toBe('parent-agent');
      expect(event.data.child).toBe('child-agent');
      expect(event.data.result).toBe('Task completed successfully');
    });
  });

  describe('logAgentStart', () => {
    it('should log agent start with task', async () => {
      logger.logAgentStart('test-agent', 2, 'Process user request');

      await new Promise((resolve) => setTimeout(resolve, 10));

      const events = await storage.readEvents(sessionId);
      expect(events).toHaveLength(1);

      const event = events[0] as any;
      expect(event.type).toBe('agent_start');
      expect(event.data.agent).toBe('test-agent');
      expect(event.data.depth).toBe(2);
      expect(event.data.task).toBe('Process user request');
    });

    it('should handle agent start without task', async () => {
      logger.logAgentStart('test-agent', 0);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const events = await storage.readEvents(sessionId);
      const event = events[0] as any;
      expect(event.data.task).toBeUndefined();
    });
  });

  describe('logAgentIteration', () => {
    it('should log agent iterations', async () => {
      logger.logAgentIteration('iterating-agent', 1);
      logger.logAgentIteration('iterating-agent', 2);
      logger.logAgentIteration('iterating-agent', 3);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const events = await storage.readEvents(sessionId);
      expect(events).toHaveLength(3);

      const iterations = events.map((e: any) => e.data.iteration);
      expect(iterations).toEqual([1, 2, 3]);
    });
  });

  describe('logAgentComplete', () => {
    it('should log agent completion with duration', async () => {
      logger.logAgentComplete('completed-agent', 1234);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const events = await storage.readEvents(sessionId);
      expect(events).toHaveLength(1);

      const event = events[0] as any;
      expect(event.type).toBe('agent_complete');
      expect(event.data.agent).toBe('completed-agent');
      expect(event.data.duration).toBe(1234);
    });
  });

  describe('logAgentError', () => {
    it('should log agent errors', async () => {
      const error = new Error('Agent failed');
      error.stack = 'Error: Agent failed\n  at agent.js:50';

      logger.logAgentError('failing-agent', error);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const events = await storage.readEvents(sessionId);
      expect(events).toHaveLength(1);

      const event = events[0] as any;
      expect(event.type).toBe('agent_error');
      expect(event.data.agent).toBe('failing-agent');
      expect(event.data.error.message).toBe('Agent failed');
      expect(event.data.error.stack).toContain('Agent failed');
    });
  });

  describe('logTodoUpdate', () => {
    it('should log todo updates', async () => {
      const todos = [
        { content: 'Task 1', status: 'pending', activeForm: 'Working on Task 1' },
        { content: 'Task 2', status: 'in_progress', activeForm: 'Doing Task 2' },
        { content: 'Task 3', status: 'completed' },
      ];

      logger.logTodoUpdate(todos);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const events = await storage.readEvents(sessionId);
      expect(events).toHaveLength(1);

      const event = events[0] as any;
      expect(event.type).toBe('todo_update');
      expect(event.data.todos).toEqual(todos);
    });
  });

  describe('flush and close', () => {
    it('should handle flush (no-op)', () => {
      expect(() => logger.flush()).not.toThrow();
    });

    it('should handle close (no-op)', () => {
      expect(() => logger.close()).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors gracefully', async () => {
      // Create a storage that throws errors
      const failingStorage = {
        appendEvent: vi.fn().mockRejectedValue(new Error('Storage failed')),
        readEvents: vi.fn().mockResolvedValue([]),
        sessionExists: vi.fn().mockResolvedValue(false),
      };

      const failingLogger = new EventLogger(failingStorage, sessionId);

      // Should not throw, but should log to console.error
      failingLogger.logUserMessage('This will fail to store');

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(failingStorage.appendEvent).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith('Failed to log user message:', expect.any(Error));
    });

    it('should handle all event types with storage errors', async () => {
      const failingStorage = {
        appendEvent: vi.fn().mockRejectedValue(new Error('Storage failed')),
        readEvents: vi.fn().mockResolvedValue([]),
        sessionExists: vi.fn().mockResolvedValue(false),
      };

      const failingLogger = new EventLogger(failingStorage, sessionId);

      // Try all logging methods - none should throw
      failingLogger.logUserMessage('test');
      failingLogger.logAssistantMessage('agent', 'test');
      failingLogger.logSystemMessage('test');
      failingLogger.logToolCall('agent', 'tool', 'call-id', {});
      failingLogger.logToolResult('agent', 'tool', 'id', {});
      failingLogger.logToolError('agent', 'tool', 'id', new Error('test'));
      failingLogger.logDelegation('parent', 'child', 'task');
      failingLogger.logDelegationComplete('parent', 'child', 'result');
      failingLogger.logAgentStart('agent', 0);
      failingLogger.logAgentIteration('agent', 1);
      failingLogger.logAgentComplete('agent', 100);
      failingLogger.logAgentError('agent', new Error('test'));
      failingLogger.logTodoUpdate([]);

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should have logged errors for each failed operation
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Integration with storage', () => {
    it('should preserve chronological order of events', async () => {
      logger.logUserMessage('Question?');
      logger.logAssistantMessage('agent', 'Let me help');
      logger.logToolCall('agent', 'Search', 'call-1', { query: 'test' });
      logger.logToolResult('agent', 'Search', 'call-1', { results: [] });
      logger.logAssistantMessage('agent', 'No results found');

      await new Promise((resolve) => setTimeout(resolve, 20));

      const events = await storage.readEvents(sessionId);
      expect(events).toHaveLength(5);

      const types = events.map((e: any) => e.type);
      expect(types).toEqual(['user', 'assistant', 'tool_call', 'tool_result', 'assistant']);
    });

    it('should maintain session isolation', async () => {
      const logger1 = new EventLogger(storage, 'session-1');
      const logger2 = new EventLogger(storage, 'session-2');

      logger1.logUserMessage('Session 1 message');
      logger2.logUserMessage('Session 2 message');

      await new Promise((resolve) => setTimeout(resolve, 10));

      const events1 = await storage.readEvents('session-1');
      const events2 = await storage.readEvents('session-2');

      expect(events1).toHaveLength(1);
      expect(events2).toHaveLength(1);
      expect((events1[0] as any).data.content).toBe('Session 1 message');
      expect((events2[0] as any).data.content).toBe('Session 2 message');
    });
  });
});
