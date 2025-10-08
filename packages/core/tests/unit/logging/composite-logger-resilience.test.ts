import { describe, expect, it, vi } from 'vitest';
import { CompositeLogger } from '@/logging/composite.logger';
import type { AgentLogger } from '@/logging/types';

/**
 * Regression Tests: CompositeLogger Error Resilience
 *
 * These tests verify that error isolation is working correctly
 * and one failing logger cannot prevent others from executing.
 */
describe('CompositeLogger Error Resilience', () => {
  function createMockLogger(_name: string): AgentLogger {
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
      logSafetyLimit: vi.fn(),
      logSessionRecovery: vi.fn(),
      logModelSelection: vi.fn(),
      logMCPServerConnected: vi.fn(),
      logTodoUpdate: vi.fn(),
      getSessionEvents: vi.fn().mockResolvedValue([]),
      flush: vi.fn(),
      close: vi.fn(),
    };
  }

  describe('Error Isolation', () => {
    it('should continue executing other loggers when one throws an error', () => {
      const logger1 = createMockLogger('logger1');
      const logger2 = createMockLogger('logger2');
      const logger3 = createMockLogger('logger3');

      // Logger2 throws an error
      logger2.logUserMessage = vi.fn(() => {
        throw new Error('Logger2 failed!');
      });

      const composite = new CompositeLogger([logger1, logger2, logger3]);

      // Should not throw - errors are isolated
      expect(() => composite.logUserMessage('Test message')).not.toThrow();

      // Logger1 was called
      expect(logger1.logUserMessage).toHaveBeenCalledWith('Test message');

      // Logger2 was called (and threw, but error was caught)
      expect(logger2.logUserMessage).toHaveBeenCalledWith('Test message');

      // Logger3 should be called despite logger2's error
      expect(logger3.logUserMessage).toHaveBeenCalledWith('Test message');
    });

    it('should execute all loggers even if one fails', () => {
      // This test shows the expected behavior
      const logger1 = createMockLogger('logger1');
      const logger2 = createMockLogger('logger2');
      const logger3 = createMockLogger('logger3');

      logger2.logUserMessage = vi.fn(() => {
        throw new Error('Logger2 failed!');
      });

      const composite = new CompositeLogger([logger1, logger2, logger3]);

      // Should NOT throw - errors should be isolated
      expect(() => composite.logUserMessage('Test message')).not.toThrow();

      // All loggers should have been called
      expect(logger1.logUserMessage).toHaveBeenCalledWith('Test message');
      expect(logger2.logUserMessage).toHaveBeenCalledWith('Test message');
      expect(logger3.logUserMessage).toHaveBeenCalledWith('Test message');
    });
  });

  describe('Lifecycle Method Error Handling', () => {
    it('should flush all loggers even when one fails', () => {
      const logger1 = createMockLogger('logger1');
      const logger2 = createMockLogger('logger2');
      const logger3 = createMockLogger('logger3');

      logger2.flush = vi.fn(() => {
        throw new Error('Flush failed!');
      });

      const composite = new CompositeLogger([logger1, logger2, logger3]);

      // Should not throw
      expect(() => composite.flush()).not.toThrow();

      expect(logger1.flush).toHaveBeenCalled();
      expect(logger2.flush).toHaveBeenCalled();
      // Logger3 should still be flushed
      expect(logger3.flush).toHaveBeenCalled();
    });

    it('should close all loggers even when one fails', () => {
      const logger1 = createMockLogger('logger1');
      const logger2 = createMockLogger('logger2');
      const logger3 = createMockLogger('logger3');

      logger2.close = vi.fn(() => {
        throw new Error('Close failed!');
      });

      const composite = new CompositeLogger([logger1, logger2, logger3]);

      // Should not throw
      expect(() => composite.close()).not.toThrow();

      expect(logger1.close).toHaveBeenCalled();
      expect(logger2.close).toHaveBeenCalled();
      // Logger3 should still be closed - no resource leak
      expect(logger3.close).toHaveBeenCalled();
    });
  });

  describe('Production Scenarios', () => {
    it('should continue console logging when filesystem logger encounters disk full', () => {
      const fileLogger = createMockLogger('file');
      const consoleLogger = createMockLogger('console');

      // Simulate disk full
      fileLogger.logToolCall = vi.fn(() => {
        const error = new Error('ENOSPC: no space left on device');
        (error as any).code = 'ENOSPC';
        throw error;
      });

      const composite = new CompositeLogger([fileLogger, consoleLogger]);

      // Should not throw - error is isolated
      expect(() => composite.logToolCall('agent', 'read', 'call-id', {})).not.toThrow();

      // Console logger should execute - user sees output
      expect(consoleLogger.logToolCall).toHaveBeenCalledWith(
        'agent',
        'read',
        'call-id',
        {},
        undefined
      );
    });

    it('should continue local logging when network logger times out', () => {
      const networkLogger = createMockLogger('network');
      const localLogger = createMockLogger('local');

      // Simulate network timeout
      networkLogger.logAssistantMessage = vi.fn(() => {
        throw new Error('Network timeout');
      });

      const composite = new CompositeLogger([networkLogger, localLogger]);

      // Should not throw
      expect(() => composite.logAssistantMessage('agent', 'response')).not.toThrow();

      // Local logging should continue despite network issue
      expect(localLogger.logAssistantMessage).toHaveBeenCalledWith('agent', 'response', undefined);
    });
  });

  describe('Resource Management', () => {
    it('should close all resources even when some loggers fail to close', () => {
      const logger1 = createMockLogger('logger1');
      const logger2 = createMockLogger('logger2');
      const logger3 = createMockLogger('logger3');

      // Logger1 has a file handle
      logger1.close = vi.fn();

      // Logger2 fails to close
      logger2.close = vi.fn(() => {
        throw new Error('Permission denied');
      });

      // Logger3 has a database connection
      logger3.close = vi.fn();

      const composite = new CompositeLogger([logger1, logger2, logger3]);

      // Should not throw
      expect(() => composite.close()).not.toThrow();

      // Logger1's file handle was closed
      expect(logger1.close).toHaveBeenCalled();

      // Logger2 failed but was attempted
      expect(logger2.close).toHaveBeenCalled();

      // Logger3's database connection should be closed - no leak
      expect(logger3.close).toHaveBeenCalled();
    });
  });
});
