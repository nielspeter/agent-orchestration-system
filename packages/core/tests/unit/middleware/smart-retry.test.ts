import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createSmartRetryMiddleware,
  isRateLimitError,
  extractRetryAfter,
  calculateBackoff,
  SmartRetryConfig,
} from '@/middleware/smart-retry.middleware';
import { MiddlewareContext } from '@/middleware/middleware-types';
import { NoOpLogger } from '@/logging';

describe('Smart Retry Middleware', () => {
  describe('isRateLimitError', () => {
    it('detects 429 status code (universal)', () => {
      const error = new Error('Rate limit exceeded');
      Object.assign(error, { status: 429 });
      expect(isRateLimitError(error)).toBe(true);
    });

    it('detects rate_limit_error type (Anthropic)', () => {
      const error = new Error('Rate limit exceeded');
      Object.assign(error, { type: 'rate_limit_error' });
      expect(isRateLimitError(error)).toBe(true);
    });

    it('detects rate limit in error message (fallback)', () => {
      const error = new Error('API rate limit exceeded');
      expect(isRateLimitError(error)).toBe(true);
    });

    it('detects rate limit with capital letters', () => {
      const error = new Error('Rate Limit Exceeded');
      expect(isRateLimitError(error)).toBe(true);
    });

    it('rejects non-rate-limit errors', () => {
      const error = new Error('Internal server error');
      expect(isRateLimitError(error)).toBe(false);
    });

    it('rejects non-Error objects', () => {
      expect(isRateLimitError('not an error')).toBe(false);
      expect(isRateLimitError(null)).toBe(false);
      expect(isRateLimitError(undefined)).toBe(false);
      expect(isRateLimitError({})).toBe(false);
    });

    it('handles error with both status and type', () => {
      const error = new Error('Rate limit');
      Object.assign(error, { status: 429, type: 'rate_limit_error' });
      expect(isRateLimitError(error)).toBe(true);
    });
  });

  describe('extractRetryAfter', () => {
    it('extracts retry-after from headers (lowercase)', () => {
      const error = {
        headers: { 'retry-after': '60' },
      };
      expect(extractRetryAfter(error)).toBe(60000); // 60 seconds = 60000ms
    });

    it('extracts Retry-After from response.headers (capitalized)', () => {
      const error = {
        response: {
          headers: { 'Retry-After': '30' },
        },
      };
      expect(extractRetryAfter(error)).toBe(30000);
    });

    it('returns null if header not present', () => {
      const error = {
        headers: {},
      };
      expect(extractRetryAfter(error)).toBe(null);
    });

    it('returns null for invalid header values', () => {
      const error = {
        headers: { 'retry-after': 'invalid' },
      };
      expect(extractRetryAfter(error)).toBe(null);
    });

    it('returns null for negative values', () => {
      const error = {
        headers: { 'retry-after': '-10' },
      };
      expect(extractRetryAfter(error)).toBe(null);
    });

    it('handles numeric header values', () => {
      const error = {
        headers: { 'retry-after': 45 },
      };
      expect(extractRetryAfter(error)).toBe(45000);
    });
  });

  describe('calculateBackoff', () => {
    const config: SmartRetryConfig = {
      maxRetries: 5,
      baseBackoffMs: 1000,
      maxBackoffMs: 60000,
      jitterFactor: 0.3,
      respectRetryAfter: true,
    };

    it('calculates exponential backoff correctly', () => {
      // First attempt: 1000ms * 2^0 = 1000ms
      const backoff1 = calculateBackoff(1, config);
      expect(backoff1).toBeGreaterThanOrEqual(700); // 1000 - 30%
      expect(backoff1).toBeLessThanOrEqual(1300); // 1000 + 30%

      // Second attempt: 1000ms * 2^1 = 2000ms
      const backoff2 = calculateBackoff(2, config);
      expect(backoff2).toBeGreaterThanOrEqual(1400); // 2000 - 30%
      expect(backoff2).toBeLessThanOrEqual(2600); // 2000 + 30%

      // Third attempt: 1000ms * 2^2 = 4000ms
      const backoff3 = calculateBackoff(3, config);
      expect(backoff3).toBeGreaterThanOrEqual(2800); // 4000 - 30%
      expect(backoff3).toBeLessThanOrEqual(5200); // 4000 + 30%
    });

    it('respects maxBackoffMs cap', () => {
      const backoff = calculateBackoff(10, config); // Would be 512000ms without cap
      expect(backoff).toBeLessThanOrEqual(config.maxBackoffMs * 1.3); // Allow for jitter
    });

    it('returns non-negative values', () => {
      const backoff = calculateBackoff(1, config);
      expect(backoff).toBeGreaterThanOrEqual(0);
    });

    it('applies jitter for randomization', () => {
      // Run multiple times and ensure we get different values (jitter working)
      const backoffs = Array.from({ length: 10 }, () => calculateBackoff(3, config));
      const uniqueBackoffs = new Set(backoffs);
      // Should have multiple unique values due to jitter (not all the same)
      expect(uniqueBackoffs.size).toBeGreaterThan(1);
    });

    it('handles zero jitter factor', () => {
      const noJitterConfig = { ...config, jitterFactor: 0 };
      const backoff1 = calculateBackoff(2, noJitterConfig);
      const backoff2 = calculateBackoff(2, noJitterConfig);
      expect(backoff1).toBe(backoff2); // No randomization
      expect(backoff1).toBe(2000); // Exactly 2^1 * 1000
    });
  });

  describe('createSmartRetryMiddleware', () => {
    let mockContext: MiddlewareContext;
    let nextCallCount: number;

    beforeEach(() => {
      nextCallCount = 0;
      mockContext = {
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
        iteration: 0,
        logger: new NoOpLogger(),
        modelName: 'test-model',
        shouldContinue: true,
      };
    });

    it('succeeds immediately on first try (no retry)', async () => {
      const middleware = createSmartRetryMiddleware();
      const next = vi.fn(async () => {
        nextCallCount++;
      });

      await middleware(mockContext, next);

      expect(nextCallCount).toBe(1);
      expect(next).toHaveBeenCalledOnce();
    });

    it('retries on rate limit error (429)', async () => {
      const middleware = createSmartRetryMiddleware({
        maxRetries: 3,
        baseBackoffMs: 10, // Fast for testing
      });

      let attemptCount = 0;
      const next = vi.fn(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          const error = new Error('Rate limit exceeded');
          Object.assign(error, { status: 429 });
          throw error;
        }
        // Succeed on 3rd attempt
      });

      await middleware(mockContext, next);

      expect(attemptCount).toBe(3);
      expect(next).toHaveBeenCalledTimes(3);
    });

    it('throws immediately on non-rate-limit errors', async () => {
      const middleware = createSmartRetryMiddleware();
      const regularError = new Error('Internal server error');

      const next = vi.fn(async () => {
        throw regularError;
      });

      await expect(middleware(mockContext, next)).rejects.toThrow('Internal server error');
      expect(next).toHaveBeenCalledOnce();
    });

    it('exhausts retries and throws last error', async () => {
      const middleware = createSmartRetryMiddleware({
        maxRetries: 2,
        baseBackoffMs: 10,
      });

      const next = vi.fn(async () => {
        const error = new Error('Rate limit exceeded');
        Object.assign(error, { status: 429 });
        throw error;
      });

      await expect(middleware(mockContext, next)).rejects.toThrow('Rate limit exceeded');
      expect(next).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('respects retry-after header when enabled', async () => {
      const middleware = createSmartRetryMiddleware({
        maxRetries: 1,
        baseBackoffMs: 10,
        respectRetryAfter: true,
      });

      let attemptCount = 0;
      const next = vi.fn(async () => {
        attemptCount++;
        if (attemptCount === 1) {
          const error = new Error('Rate limit');
          Object.assign(error, {
            status: 429,
            headers: { 'retry-after': '1' }, // 1 second
          });
          throw error;
        }
      });

      const startTime = Date.now();
      await middleware(mockContext, next);
      const elapsed = Date.now() - startTime;

      // Should wait at least 1 second (1000ms) due to retry-after
      expect(elapsed).toBeGreaterThanOrEqual(990); // Allow small timing variance
      expect(attemptCount).toBe(2);
    });

    it('ignores retry-after when disabled', async () => {
      const middleware = createSmartRetryMiddleware({
        maxRetries: 1,
        baseBackoffMs: 10,
        respectRetryAfter: false,
      });

      let attemptCount = 0;
      const next = vi.fn(async () => {
        attemptCount++;
        if (attemptCount === 1) {
          const error = new Error('Rate limit');
          Object.assign(error, {
            status: 429,
            headers: { 'retry-after': '10' }, // 10 seconds
          });
          throw error;
        }
      });

      const startTime = Date.now();
      await middleware(mockContext, next);
      const elapsed = Date.now() - startTime;

      // Should NOT wait 10 seconds, only baseBackoffMs (10ms)
      expect(elapsed).toBeLessThan(1000);
      expect(attemptCount).toBe(2);
    });

    it('uses longer of calculated backoff or retry-after', async () => {
      const middleware = createSmartRetryMiddleware({
        maxRetries: 1,
        baseBackoffMs: 2000, // 2 second base
        respectRetryAfter: true,
      });

      let attemptCount = 0;
      const next = vi.fn(async () => {
        attemptCount++;
        if (attemptCount === 1) {
          const error = new Error('Rate limit');
          Object.assign(error, {
            status: 429,
            headers: { 'retry-after': '1' }, // Only 1 second (shorter than calculated)
          });
          throw error;
        }
      });

      const startTime = Date.now();
      await middleware(mockContext, next);
      const elapsed = Date.now() - startTime;

      // Should use calculated backoff (2000ms) since it's longer
      expect(elapsed).toBeGreaterThanOrEqual(1400); // Allow for jitter (2000ms - 30%)
      expect(attemptCount).toBe(2);
    });

    it('handles Anthropic rate_limit_error type', async () => {
      const middleware = createSmartRetryMiddleware({
        maxRetries: 1,
        baseBackoffMs: 10,
      });

      let attemptCount = 0;
      const next = vi.fn(async () => {
        attemptCount++;
        if (attemptCount === 1) {
          const error = new Error('Rate limit');
          Object.assign(error, { type: 'rate_limit_error' });
          throw error;
        }
      });

      await middleware(mockContext, next);
      expect(attemptCount).toBe(2);
    });

    it('handles OpenRouter format (OpenAI-compatible)', async () => {
      const middleware = createSmartRetryMiddleware({
        maxRetries: 1,
        baseBackoffMs: 10,
      });

      let attemptCount = 0;
      const next = vi.fn(async () => {
        attemptCount++;
        if (attemptCount === 1) {
          const error = new Error('Rate limit exceeded');
          Object.assign(error, {
            status: 429,
            response: {
              headers: { 'Retry-After': '2' },
            },
          });
          throw error;
        }
      });

      await middleware(mockContext, next);
      expect(attemptCount).toBe(2);
    });

    it('applies default config when none provided', async () => {
      // Override baseBackoffMs for testing (default is 1000ms, too slow)
      const middleware = createSmartRetryMiddleware({ baseBackoffMs: 10 });

      let attemptCount = 0;
      const next = vi.fn(async () => {
        attemptCount++;
        if (attemptCount <= 5) {
          // Try all 5 default retries
          const error = new Error('Rate limit');
          Object.assign(error, { status: 429 });
          throw error;
        }
      });

      await middleware(mockContext, next);
      expect(attemptCount).toBe(6); // Initial + 5 retries
    });

    it('merges partial config with defaults', async () => {
      const middleware = createSmartRetryMiddleware({
        maxRetries: 2, // Override only maxRetries
        // baseBackoffMs, maxBackoffMs, jitterFactor should use defaults
      });

      let attemptCount = 0;
      const next = vi.fn(async () => {
        attemptCount++;
        if (attemptCount <= 2) {
          const error = new Error('Rate limit');
          Object.assign(error, { status: 429 });
          throw error;
        }
      });

      await middleware(mockContext, next);
      expect(attemptCount).toBe(3); // Initial + 2 retries
    });
  });

  describe('Integration scenarios', () => {
    let integrationContext: MiddlewareContext;

    beforeEach(() => {
      integrationContext = {
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
        iteration: 0,
        logger: new NoOpLogger(),
        modelName: 'test-model',
        shouldContinue: true,
      };
    });

    it('handles mixed error types correctly', async () => {
      const middleware = createSmartRetryMiddleware({
        maxRetries: 3,
        baseBackoffMs: 10,
      });

      let attemptCount = 0;
      const next = vi.fn(async () => {
        attemptCount++;
        if (attemptCount === 1) {
          // First: rate limit
          const error = new Error('Rate limit');
          Object.assign(error, { status: 429 });
          throw error;
        } else if (attemptCount === 2) {
          // Second: different error (should not retry)
          throw new Error('Network timeout');
        }
      });

      await expect(middleware(integrationContext, next)).rejects.toThrow('Network timeout');
      expect(attemptCount).toBe(2); // Stopped after non-rate-limit error
    });

    it('simulates realistic multi-process backoff', async () => {
      // Simulate 3 concurrent processes hitting rate limits
      const processes = Array.from({ length: 3 }, (_, i) => ({
        id: i,
        middleware: createSmartRetryMiddleware({
          maxRetries: 2,
          baseBackoffMs: 100,
        }),
        attemptTimes: [] as number[],
      }));

      const startTime = Date.now();

      await Promise.all(
        processes.map(async (proc) => {
          let attemptCount = 0;
          const next = async () => {
            attemptCount++;
            proc.attemptTimes.push(Date.now() - startTime);
            if (attemptCount <= 2) {
              const error = new Error('Rate limit');
              Object.assign(error, { status: 429 });
              throw error;
            }
          };

          await proc.middleware(integrationContext, next);
        })
      );

      // All processes should eventually succeed
      expect(processes.every((p) => p.attemptTimes.length === 3)).toBe(true);

      // Due to jitter, attempt times should be different across processes
      const allAttemptTimes = processes.flatMap((p) => p.attemptTimes);
      const uniqueTimes = new Set(allAttemptTimes);
      expect(uniqueTimes.size).toBeGreaterThan(3); // More unique times than processes
    });
  });
});
