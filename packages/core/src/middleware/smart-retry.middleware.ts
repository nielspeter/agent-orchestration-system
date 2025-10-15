import { Middleware } from './middleware-types';

/**
 * Configuration for smart retry behavior
 */
export interface SmartRetryConfig {
  /** Maximum number of retry attempts (default: 5) */
  maxRetries: number;
  /** Base backoff duration in milliseconds (default: 1000ms = 1s) */
  baseBackoffMs: number;
  /** Maximum backoff duration in milliseconds (default: 60000ms = 60s) */
  maxBackoffMs: number;
  /** Jitter factor for randomization, 0-1 range (default: 0.3 = ±30%) */
  jitterFactor: number;
  /** Whether to respect retry-after headers from providers (default: true) */
  respectRetryAfter: boolean;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: SmartRetryConfig = {
  maxRetries: 5,
  baseBackoffMs: 1000, // 1 second
  maxBackoffMs: 60000, // 60 seconds
  jitterFactor: 0.3, // ±30%
  respectRetryAfter: true,
};

/**
 * Detects if an error is a rate limit error (429) from any provider
 *
 * Works with:
 * - Anthropic SDK errors
 * - OpenAI SDK errors
 * - OpenRouter errors (OpenAI-compatible)
 *
 * Detection strategies:
 * 1. Check error.status === 429
 * 2. Check error.type === 'rate_limit_error' (Anthropic)
 * 3. Check error.message contains 'rate limit'
 */
export function isRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  // Strategy 1: Check status code (works for all providers)
  const errorWithStatus = error as Error & { status?: number };
  if (errorWithStatus.status === 429) {
    return true;
  }

  // Strategy 2: Check error type (Anthropic-specific)
  const errorWithType = error as Error & { type?: string };
  if (errorWithType.type === 'rate_limit_error') {
    return true;
  }

  // Strategy 3: Check error message (fallback)
  if (error.message.toLowerCase().includes('rate limit')) {
    return true;
  }

  return false;
}

/**
 * Extracts retry-after duration from error headers
 *
 * Providers may include a 'retry-after' header with:
 * - Number of seconds to wait (HTTP standard)
 * - HTTP date (not commonly used for rate limits)
 *
 * @returns Duration in milliseconds, or null if not present
 */
export function extractRetryAfter(error: unknown): number | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const err = error as any;

  // Try both common header locations
  const retryAfter =
    err.headers?.['retry-after'] ||
    err.response?.headers?.['retry-after'] ||
    err.response?.headers?.['Retry-After'];

  if (!retryAfter) {
    return null;
  }

  // Parse as seconds (HTTP standard)
  if (typeof retryAfter === 'string' || typeof retryAfter === 'number') {
    const seconds = parseInt(String(retryAfter), 10);
    if (!isNaN(seconds) && seconds > 0) {
      return seconds * 1000; // Convert to milliseconds
    }
  }

  return null;
}

/**
 * Calculates backoff duration with exponential growth and jitter
 *
 * Formula:
 * 1. Base backoff: baseBackoffMs * 2^(attempt-1)
 *    - Attempt 1: baseBackoffMs * 1 = 1s
 *    - Attempt 2: baseBackoffMs * 2 = 2s
 *    - Attempt 3: baseBackoffMs * 4 = 4s
 *    - Attempt 4: baseBackoffMs * 8 = 8s
 *    - Attempt 5: baseBackoffMs * 16 = 16s
 *
 * 2. Apply jitter: backoff + (backoff * jitterFactor * random(-1, 1))
 *    - With 30% jitter, a 4s backoff becomes 2.8s - 5.2s
 *    - This prevents thundering herd (all processes retrying at same time)
 *
 * 3. Cap at maxBackoffMs
 *
 * @param attempt Current attempt number (1-indexed)
 * @param config Retry configuration
 * @returns Backoff duration in milliseconds
 */
export function calculateBackoff(attempt: number, config: SmartRetryConfig): number {
  // Exponential backoff: base * 2^(attempt-1)
  const exponentialBackoff = config.baseBackoffMs * Math.pow(2, attempt - 1);

  // Cap at max backoff
  const cappedBackoff = Math.min(exponentialBackoff, config.maxBackoffMs);

  // Add jitter: ±(jitterFactor * backoff)
  // Random value between -1 and 1
  const jitterRange = Math.random() * 2 - 1;
  const jitter = cappedBackoff * config.jitterFactor * jitterRange;

  const finalBackoff = cappedBackoff + jitter;

  // Ensure non-negative
  return Math.max(0, finalBackoff);
}

/**
 * Sleeps for the specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates smart retry middleware that handles rate limiting with exponential backoff
 *
 * This middleware:
 * 1. Wraps the downstream pipeline (next())
 * 2. Catches rate limit errors (429) from any provider
 * 3. Waits using exponential backoff with jitter
 * 4. Respects retry-after headers when present
 * 5. Retries up to maxRetries times
 * 6. Logs retry attempts for debugging
 *
 * Design philosophy:
 * - STATELESS: No coordination between processes needed
 * - REACTIVE: Responds to actual rate limit errors, doesn't predict
 * - UNIVERSAL: Works with Anthropic, OpenAI, OpenRouter, and any OpenAI-compatible provider
 * - SELF-ORGANIZING: Exponential backoff + jitter naturally spaces out requests across processes
 *
 * Why this works without shared state:
 * - Each process independently backs off when it hits rate limits
 * - Exponential growth (1s → 2s → 4s → 8s) quickly reduces request rate
 * - Jitter (±30%) prevents processes from synchronizing their retries
 * - Natural equilibrium emerges: aggressive processes back off more, cautious processes continue
 *
 * @param config Optional configuration (uses defaults for omitted values)
 */
export function createSmartRetryMiddleware(config?: Partial<SmartRetryConfig>): Middleware {
  const fullConfig: SmartRetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  return async (ctx, next) => {
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= fullConfig.maxRetries) {
      try {
        // First attempt or retry
        await next();
        // Success - exit retry loop
        return;
      } catch (error) {
        // Check if this is a rate limit error
        if (!isRateLimitError(error)) {
          // Not a rate limit error - rethrow immediately
          throw error;
        }

        // Store the error
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if we've exhausted retries
        if (attempt >= fullConfig.maxRetries) {
          ctx.logger.logSystemMessage(
            `⚠️ Rate limit retry exhausted after ${fullConfig.maxRetries} attempts. Giving up.`
          );
          throw lastError;
        }

        // Calculate backoff
        attempt++;
        let backoffMs = calculateBackoff(attempt, fullConfig);

        // Check for retry-after header
        if (fullConfig.respectRetryAfter) {
          const retryAfterMs = extractRetryAfter(error);
          if (retryAfterMs !== null) {
            ctx.logger.logSystemMessage(
              `⏱️ Provider requested ${retryAfterMs}ms wait (retry-after header)`
            );
            // Use the longer of: calculated backoff or provider suggestion
            backoffMs = Math.max(backoffMs, retryAfterMs);
          }
        }

        // Log retry attempt
        const backoffSeconds = (backoffMs / 1000).toFixed(1);
        ctx.logger.logSystemMessage(
          `🔄 Rate limit hit. Retry ${attempt}/${fullConfig.maxRetries} after ${backoffSeconds}s...`
        );

        // Wait before retrying
        await sleep(backoffMs);
      }
    }

    // Should never reach here, but TypeScript needs this for type safety
    if (lastError) {
      throw lastError;
    }
  };
}
