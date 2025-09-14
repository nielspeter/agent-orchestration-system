import { describe, expect, it, vi } from 'vitest';
import { CompositeLogger } from '@/logging/composite.logger';
import type { AgentLogger } from '@/logging/types';

describe('CompositeLogger', () => {
  describe('Multiple Logger Composition', () => {
    it('should forward logs to all registered loggers', () => {
      const logger1 = createMockLogger();
      const logger2 = createMockLogger();
      const composite = new CompositeLogger([logger1, logger2]);

      composite.logUserMessage('Test message');
      composite.logAssistantMessage('agent', 'Response');
      composite.logToolCall('agent', 'Read', 'call-id', { file: 'test.txt' });

      expect(logger1.logUserMessage).toHaveBeenCalledWith('Test message');
      expect(logger2.logUserMessage).toHaveBeenCalledWith('Test message');
      expect(logger1.logAssistantMessage).toHaveBeenCalledWith('agent', 'Response', undefined);
      expect(logger2.logAssistantMessage).toHaveBeenCalledWith('agent', 'Response', undefined);
      expect(logger1.logToolCall).toHaveBeenCalledWith(
        'agent',
        'Read',
        'call-id',
        {
          file: 'test.txt',
        },
        undefined
      );
      expect(logger2.logToolCall).toHaveBeenCalledWith(
        'agent',
        'Read',
        'call-id',
        {
          file: 'test.txt',
        },
        undefined
      );
    });

    it('should handle empty logger array', () => {
      const composite = new CompositeLogger([]);

      // Should not throw
      expect(() => composite.logUserMessage('Test')).not.toThrow();
      expect(() => composite.logAssistantMessage('agent', 'Test')).not.toThrow();
      expect(() => composite.logToolCall('agent', 'tool', 'call-id', {})).not.toThrow();
    });

    it('should call all loggers in order', () => {
      const callOrder: string[] = [];
      const logger1 = createMockLogger();
      logger1.logUserMessage = vi.fn(() => callOrder.push('logger1'));

      const logger2 = createMockLogger();
      logger2.logUserMessage = vi.fn(() => callOrder.push('logger2'));

      const logger3 = createMockLogger();
      logger3.logUserMessage = vi.fn(() => callOrder.push('logger3'));

      const composite = new CompositeLogger([logger1, logger2, logger3]);
      composite.logUserMessage('Test');

      expect(callOrder).toEqual(['logger1', 'logger2', 'logger3']);
    });
  });

  describe('Agent Lifecycle Methods', () => {
    it('should forward agent lifecycle events', () => {
      const logger = createMockLogger();
      const composite = new CompositeLogger([logger]);

      composite.logAgentStart('test-agent', 1, 'Test task');
      composite.logAgentIteration('test-agent', 5);
      composite.logAgentComplete('test-agent', 1000);
      composite.logAgentError('test-agent', new Error('Test error'));

      expect(logger.logAgentStart).toHaveBeenCalledWith('test-agent', 1, 'Test task');
      expect(logger.logAgentIteration).toHaveBeenCalledWith('test-agent', 5);
      expect(logger.logAgentComplete).toHaveBeenCalledWith('test-agent', 1000);
      expect(logger.logAgentError).toHaveBeenCalledWith('test-agent', expect.any(Error));
    });
  });

  describe('Delegation Methods', () => {
    it('should forward delegation events', () => {
      const logger = createMockLogger();
      const composite = new CompositeLogger([logger]);

      composite.logDelegation('parent', 'child', 'Perform task');
      composite.logDelegationComplete('parent', 'child', 'Task completed');

      expect(logger.logDelegation).toHaveBeenCalledWith('parent', 'child', 'Perform task');
      expect(logger.logDelegationComplete).toHaveBeenCalledWith(
        'parent',
        'child',
        'Task completed'
      );
    });
  });

  describe('Tool Methods', () => {
    it('should forward tool events', () => {
      const logger = createMockLogger();
      const composite = new CompositeLogger([logger]);

      composite.logToolCall('agent', 'Read', 'call-id', { file: 'test.txt' });
      composite.logToolExecution('agent', 'Read', 'tool-id-1');
      composite.logToolResult('agent', 'Read', 'tool-id-1', 'file contents');
      composite.logToolError('agent', 'Read', 'tool-id-1', new Error('File not found'));

      expect(logger.logToolCall).toHaveBeenCalledWith(
        'agent',
        'Read',
        'call-id',
        {
          file: 'test.txt',
        },
        undefined
      );
      expect(logger.logToolExecution).toHaveBeenCalledWith('agent', 'Read', 'tool-id-1');
      expect(logger.logToolResult).toHaveBeenCalledWith(
        'agent',
        'Read',
        'tool-id-1',
        'file contents'
      );
      expect(logger.logToolError).toHaveBeenCalledWith(
        'agent',
        'Read',
        'tool-id-1',
        expect.any(Error)
      );
    });
  });

  describe('Optional Methods', () => {
    it('should handle loggers without optional methods', () => {
      const basicLogger: AgentLogger = {
        logUserMessage: vi.fn(),
        logAssistantMessage: vi.fn(),
        logSystemMessage: vi.fn(),
        logToolCall: vi.fn(),
        logToolExecution: vi.fn(),
        logToolResult: vi.fn(),
        logToolError: vi.fn(),
        logDelegation: vi.fn(),
        logDelegationComplete: vi.fn(),
        logAgentStart: vi.fn(),
        logAgentIteration: vi.fn(),
        logAgentComplete: vi.fn(),
        logAgentError: vi.fn(),
        flush: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        // No logTodoUpdate or getSessionEvents
      };

      const composite = new CompositeLogger([basicLogger]);

      // Should not throw even though logger doesn't have logTodoUpdate
      expect(() => composite.logTodoUpdate([{ content: 'Test', status: 'pending' }])).not.toThrow();
    });

    it('should call logTodoUpdate only on loggers that have it', () => {
      const loggerWithTodo = createMockLogger();
      loggerWithTodo.logTodoUpdate = vi.fn();

      const loggerWithoutTodo: AgentLogger = {
        ...createMockLogger(),
        logTodoUpdate: undefined,
      };

      const composite = new CompositeLogger([loggerWithoutTodo, loggerWithTodo]);
      const todos = [{ content: 'Test todo', status: 'pending', activeForm: 'Testing' }];

      composite.logTodoUpdate(todos);

      expect(loggerWithTodo.logTodoUpdate).toHaveBeenCalledWith(todos);
    });
  });

  describe('getSessionEvents', () => {
    it('should return events from first logger that has them', async () => {
      const loggerWithoutEvents: AgentLogger = {
        ...createMockLogger(),
        getSessionEvents: undefined,
      };

      const loggerWithEmptyEvents = createMockLogger();
      loggerWithEmptyEvents.getSessionEvents = vi.fn().mockResolvedValue([]);

      const loggerWithEvents = createMockLogger();
      const mockEvents = [{ type: 'user', timestamp: 1, data: { content: 'test' } }];
      loggerWithEvents.getSessionEvents = vi.fn().mockResolvedValue(mockEvents);

      const composite = new CompositeLogger([
        loggerWithoutEvents,
        loggerWithEmptyEvents,
        loggerWithEvents,
      ]);

      const events = await composite.getSessionEvents();

      expect(events).toEqual(mockEvents);
      expect(loggerWithEmptyEvents.getSessionEvents).toHaveBeenCalled();
      expect(loggerWithEvents.getSessionEvents).toHaveBeenCalled();
    });

    it('should return empty array if no logger has events', async () => {
      const logger1 = createMockLogger();
      logger1.getSessionEvents = undefined;

      const logger2 = createMockLogger();
      logger2.getSessionEvents = vi.fn().mockResolvedValue([]);

      const composite = new CompositeLogger([logger1, logger2]);
      const events = await composite.getSessionEvents();

      expect(events).toEqual([]);
    });
  });

  function createMockLogger(): AgentLogger {
    return {
      logUserMessage: vi.fn(),
      logAssistantMessage: vi.fn(),
      logSystemMessage: vi.fn(),
      logToolCall: vi.fn(),
      logToolExecution: vi.fn(),
      logToolResult: vi.fn(),
      logToolError: vi.fn(),
      logDelegation: vi.fn(),
      logDelegationComplete: vi.fn(),
      logAgentStart: vi.fn(),
      logAgentIteration: vi.fn(),
      logAgentComplete: vi.fn(),
      logAgentError: vi.fn(),
      logTodoUpdate: vi.fn(),
      getSessionEvents: vi.fn().mockResolvedValue([]),
      flush: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
  }
});
