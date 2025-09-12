import { beforeEach, describe, expect, it } from 'vitest';
import { createSafetyChecksMiddleware } from '@/middleware/safety-checks.middleware';
import { MiddlewareContext } from '@/middleware/middleware-types';
import { ConsoleLogger } from '@/logging/console.logger';
import type { SafetyConfig } from '@/config/types';

describe('SafetyChecksMiddleware - Execution Limits', () => {
  let context: MiddlewareContext;
  let logger: ConsoleLogger;

  beforeEach(() => {
    logger = new ConsoleLogger({ verbosity: 'minimal' });

    context = {
      agentName: 'test-agent',
      prompt: 'test prompt',
      executionContext: {
        depth: 0,
        startTime: Date.now(),
        maxDepth: 5,
        isSidechain: false,
        traceId: 'test-trace',
      },
      messages: [],
      iteration: 1,
      logger,
      modelName: 'test-model',
      shouldContinue: true,
    };
  });

  describe('Iteration Limits', () => {
    it('should stop execution at maxIterations', async () => {
      const safetyConfig: SafetyConfig = {
        maxIterations: 3,
        warnAtIteration: 2,
        maxDepth: 5,
        maxTokensEstimate: 100000,
      };

      const middleware = createSafetyChecksMiddleware(safetyConfig);

      // Test iteration 1 - should continue
      context.iteration = 1;
      await middleware(context, async () => {
        expect(context.shouldContinue).toBe(true);
      });

      // Test iteration 3 - should continue (at limit)
      context.iteration = 3;
      await middleware(context, async () => {
        expect(context.shouldContinue).toBe(true);
      });

      // Test iteration 4 - should stop
      context.iteration = 4;
      await middleware(context, async () => {
        // Should not reach here
        expect(true).toBe(false);
      });

      expect(context.shouldContinue).toBe(false);
      expect(context.result).toContain('Stopped at 3 iterations');
    });

    it('should warn at warnAtIteration threshold', async () => {
      const safetyConfig: SafetyConfig = {
        maxIterations: 10,
        warnAtIteration: 3,
        maxDepth: 5,
        maxTokensEstimate: 100000,
      };

      const middleware = createSafetyChecksMiddleware(safetyConfig);
      const warnings: string[] = [];

      // Capture log messages
      const originalLog = logger.logSystemMessage;
      logger.logSystemMessage = (msg: string) => {
        if (msg.includes('High iteration count')) {
          warnings.push(msg);
        }
        originalLog.call(logger, msg);
      };

      // Test below warning threshold - no warning
      context.iteration = 2;
      await middleware(context, async () => {});
      expect(warnings.length).toBe(0);

      // Test at warning threshold - should warn
      context.iteration = 3;
      await middleware(context, async () => {});
      expect(warnings.length).toBe(1);
      expect(warnings[0]).toContain('High iteration count: 3');
    });
  });

  describe('Depth Limits', () => {
    it('should stop execution when depth exceeds maxDepth', async () => {
      const safetyConfig: SafetyConfig = {
        maxIterations: 10,
        warnAtIteration: 5,
        maxDepth: 3,
        maxTokensEstimate: 100000,
      };

      const middleware = createSafetyChecksMiddleware(safetyConfig);

      // Test depth 3 - should continue
      context.executionContext.depth = 3;
      await middleware(context, async () => {
        expect(context.shouldContinue).toBe(true);
      });

      // Test depth 4 - should stop
      context.executionContext.depth = 4;
      await middleware(context, async () => {
        // Should not reach here
        expect(true).toBe(false);
      });

      expect(context.shouldContinue).toBe(false);
      expect(context.result).toContain('Maximum delegation depth');
    });
  });

  describe('Token Limits', () => {
    it('should estimate tokens and stop if over limit', async () => {
      const safetyConfig: SafetyConfig = {
        maxIterations: 10,
        warnAtIteration: 5,
        maxDepth: 5,
        maxTokensEstimate: 1000, // Very low limit
      };

      const middleware = createSafetyChecksMiddleware(safetyConfig);

      // Add many messages to exceed token limit
      context.messages = [];
      for (let i = 0; i < 100; i++) {
        context.messages.push({
          role: 'user',
          content: 'This is a very long message that contains a lot of tokens. '.repeat(10),
        });
      }

      await middleware(context, async () => {
        // Should not reach here if token limit is exceeded
        expect(context.messages.length).toBeLessThan(100);
      });

      // If it stopped due to token limit
      if (!context.shouldContinue) {
        expect(context.result).toContain('token limit');
      }
    });
  });

  describe('Multiple Limits Interaction', () => {
    it('should respect whichever limit is hit first', async () => {
      const safetyConfig: SafetyConfig = {
        maxIterations: 2, // Very low
        warnAtIteration: 1,
        maxDepth: 10, // High
        maxTokensEstimate: 100000, // High
      };

      const middleware = createSafetyChecksMiddleware(safetyConfig);

      // High depth but should stop at iteration limit
      context.executionContext.depth = 5;
      context.iteration = 3; // Over iteration limit

      await middleware(context, async () => {
        expect(true).toBe(false); // Should not reach
      });

      expect(context.shouldContinue).toBe(false);
      expect(context.result).toContain('iterations'); // Should mention iterations, not depth
    });
  });
});
