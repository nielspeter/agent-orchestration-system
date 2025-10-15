# Distributed Multi-Provider Rate Limiting

**Problem**: Rate limits are enforced by LLM providers at the API key level, not per process/session. Multiple processes using the same API key must coordinate to avoid exceeding provider limits.

**Solution**: Centralized rate limiting with per-provider tracking and distributed coordination.

---

## Architecture Overview

### The Real Problem

```
❌ WRONG (My original design):
┌─────────────┐
│ Process A   │ → In-memory RateLimiter (45 req/min)
└─────────────┘
┌─────────────┐
│ Process B   │ → In-memory RateLimiter (45 req/min)  ← No coordination!
└─────────────┘
┌─────────────┐
│ Process C   │ → In-memory RateLimiter (45 req/min)
└─────────────┘
                ↓
         Anthropic API (ANTHROPIC_API_KEY=abc123)
         Limit: 50 req/min
         Actual traffic: 135 req/min
         Result: 💥 429 Too Many Requests

✅ CORRECT:
┌─────────────┐
│ Process A   │ ─┐
└─────────────┘  │
┌─────────────┐  │
│ Process B   │ ─┼──→ Redis (Centralized Rate Limiter)
└─────────────┘  │     ├─ anthropic:abc123 → 42/50 req/min
┌─────────────┐  │     ├─ openai:xyz789 → 234/500 req/min
│ Process C   │ ─┘     └─ openrouter:def456 → 18/100 req/min
└─────────────┘                    ↓
                            Each provider tracked separately
                            Shared across ALL processes
```

---

## Design Principles

### 1. Provider-Level Rate Limiting

Rate limits are **per API key**, not per process:

```typescript
// Rate limit key format: provider:apiKeyHash
const rateLimitKey = `${providerName}:${hashApiKey(apiKey)}`;

// Examples:
// - "anthropic:a1b2c3d4" → Tracks all usage of this Anthropic API key
// - "openai:e5f6g7h8" → Tracks all usage of this OpenAI API key
// - "openrouter:i9j0k1l2" → Tracks all usage of this OpenRouter API key
```

### 2. Distributed State (Redis)

Use Redis for atomic, distributed rate limiting:

```typescript
// Redis data structure per provider:
{
  "rate_limit:anthropic:a1b2c3d4": {
    "requests": 42,              // Current requests used
    "tokens": 8234,              // Current tokens used
    "window_start": 1734301200,  // Unix timestamp (minute boundary)
    "ttl": 60                    // Expires after 60 seconds
  }
}
```

### 3. Atomic Operations

Use Redis transactions to prevent race conditions:

```typescript
// WRONG (race condition):
const current = await redis.get(key);
if (current < limit) {
  await redis.incr(key);  // ← Another process could increment between get and incr!
}

// CORRECT (atomic):
const result = await redis.eval(`
  local current = redis.call('GET', KEYS[1])
  if not current or tonumber(current) < tonumber(ARGV[1]) then
    redis.call('INCR', KEYS[1])
    redis.call('EXPIRE', KEYS[1], 60)
    return 1
  else
    return 0
  end
`, 1, key, limit);
```

---

## Implementation

### Core Rate Limiter

```typescript
// packages/core/src/lib/distributed-rate-limiter.ts

import { Redis } from 'ioredis';
import { createHash } from 'crypto';

export interface ProviderRateLimits {
  requestsPerMinute: number;
  tokensPerMinute: number;
}

export interface RateLimiterConfig {
  redis: Redis;
  providerLimits: Map<string, ProviderRateLimits>;
  safetyMargin: number;  // e.g., 0.9 = use 90% of limit
}

export class DistributedRateLimiter {
  private readonly redis: Redis;
  private readonly providerLimits: Map<string, ProviderRateLimits>;
  private readonly safetyMargin: number;

  constructor(config: RateLimiterConfig) {
    this.redis = config.redis;
    this.providerLimits = config.providerLimits;
    this.safetyMargin = config.safetyMargin || 0.9;
  }

  /**
   * Acquire permission to make a request
   * Waits if rate limit would be exceeded
   */
  async acquireRequest(
    providerName: string,
    apiKey: string,
    estimatedTokens: number
  ): Promise<void> {
    const rateLimitKey = this.getRateLimitKey(providerName, apiKey);
    const limits = this.getProviderLimits(providerName);

    if (!limits) {
      // No limits configured for this provider - allow request
      return;
    }

    // Apply safety margin
    const requestLimit = Math.floor(limits.requestsPerMinute * this.safetyMargin);
    const tokenLimit = Math.floor(limits.tokensPerMinute * this.safetyMargin);

    let attempts = 0;
    const maxAttempts = 60; // Max 60 seconds of waiting

    while (attempts < maxAttempts) {
      const acquired = await this.tryAcquire(
        rateLimitKey,
        requestLimit,
        tokenLimit,
        estimatedTokens
      );

      if (acquired) {
        return; // Success!
      }

      // Wait and retry
      await this.sleep(1000); // Wait 1 second
      attempts++;
    }

    throw new Error(
      `Rate limit acquisition timeout for ${providerName} after ${maxAttempts}s`
    );
  }

  /**
   * Try to acquire tokens atomically
   * Returns true if acquired, false if limit would be exceeded
   */
  private async tryAcquire(
    key: string,
    requestLimit: number,
    tokenLimit: number,
    estimatedTokens: number
  ): Promise<boolean> {
    // Lua script for atomic check-and-increment
    const luaScript = `
      local requests_key = KEYS[1] .. ':requests'
      local tokens_key = KEYS[1] .. ':tokens'
      local request_limit = tonumber(ARGV[1])
      local token_limit = tonumber(ARGV[2])
      local tokens_needed = tonumber(ARGV[3])
      local ttl = tonumber(ARGV[4])

      -- Get current values
      local current_requests = tonumber(redis.call('GET', requests_key) or '0')
      local current_tokens = tonumber(redis.call('GET', tokens_key) or '0')

      -- Check if we can acquire
      if current_requests < request_limit and (current_tokens + tokens_needed) <= token_limit then
        -- Increment counters
        redis.call('INCR', requests_key)
        redis.call('INCRBY', tokens_key, tokens_needed)

        -- Set TTL on first write
        if current_requests == 0 then
          redis.call('EXPIRE', requests_key, ttl)
          redis.call('EXPIRE', tokens_key, ttl)
        end

        return 1  -- Success
      else
        return 0  -- Limit exceeded
      end
    `;

    const result = await this.redis.eval(
      luaScript,
      1,
      key,
      requestLimit.toString(),
      tokenLimit.toString(),
      estimatedTokens.toString(),
      '60' // 60 second window
    );

    return result === 1;
  }

  /**
   * Get current usage for a provider
   */
  async getUsage(
    providerName: string,
    apiKey: string
  ): Promise<{ requests: number; tokens: number }> {
    const key = this.getRateLimitKey(providerName, apiKey);

    const [requests, tokens] = await Promise.all([
      this.redis.get(`${key}:requests`),
      this.redis.get(`${key}:tokens`)
    ]);

    return {
      requests: parseInt(requests || '0', 10),
      tokens: parseInt(tokens || '0', 10)
    };
  }

  /**
   * Get current status including utilization
   */
  async getStatus(
    providerName: string,
    apiKey: string
  ): Promise<RateLimitStatus> {
    const usage = await this.getUsage(providerName, apiKey);
    const limits = this.getProviderLimits(providerName);

    if (!limits) {
      return {
        requests: usage.requests,
        tokens: usage.tokens,
        requestLimit: Infinity,
        tokenLimit: Infinity,
        requestUtilization: 0,
        tokenUtilization: 0
      };
    }

    return {
      requests: usage.requests,
      tokens: usage.tokens,
      requestLimit: limits.requestsPerMinute,
      tokenLimit: limits.tokensPerMinute,
      requestUtilization: (usage.requests / limits.requestsPerMinute) * 100,
      tokenUtilization: (usage.tokens / limits.tokensPerMinute) * 100
    };
  }

  private getRateLimitKey(providerName: string, apiKey: string): string {
    // Hash API key for privacy (don't store raw keys in Redis)
    const hashedKey = createHash('sha256')
      .update(apiKey)
      .digest('hex')
      .substring(0, 16);

    return `rate_limit:${providerName}:${hashedKey}`;
  }

  private getProviderLimits(providerName: string): ProviderRateLimits | null {
    return this.providerLimits.get(providerName) || null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export interface RateLimitStatus {
  requests: number;
  tokens: number;
  requestLimit: number;
  tokenLimit: number;
  requestUtilization: number;
  tokenUtilization: number;
}
```

---

## Provider-Specific Configuration

### Default Provider Limits

```typescript
// packages/core/src/config/provider-rate-limits.ts

export const DEFAULT_PROVIDER_LIMITS = new Map<string, ProviderRateLimits>([
  // Anthropic Claude (Tier 1)
  ['anthropic', {
    requestsPerMinute: 50,
    tokensPerMinute: 10000
  }],

  // Anthropic Claude (Tier 2)
  ['anthropic-tier2', {
    requestsPerMinute: 1000,
    tokensPerMinute: 40000
  }],

  // Anthropic Claude (Tier 3)
  ['anthropic-tier3', {
    requestsPerMinute: 2000,
    tokensPerMinute: 80000
  }],

  // OpenAI GPT (Tier 1)
  ['openai', {
    requestsPerMinute: 500,
    tokensPerMinute: 200000
  }],

  // OpenAI GPT (Tier 2)
  ['openai-tier2', {
    requestsPerMinute: 5000,
    tokensPerMinute: 2000000
  }],

  // OpenRouter (conservative default - varies by model)
  ['openrouter', {
    requestsPerMinute: 100,
    tokensPerMinute: 20000
  }]
]);

/**
 * Get rate limits for a specific provider and tier
 */
export function getProviderRateLimits(
  providerName: string,
  tier?: number
): ProviderRateLimits | null {
  // Try provider with tier
  if (tier) {
    const key = `${providerName}-tier${tier}`;
    const limits = DEFAULT_PROVIDER_LIMITS.get(key);
    if (limits) return limits;
  }

  // Fall back to default tier
  return DEFAULT_PROVIDER_LIMITS.get(providerName) || null;
}
```

---

## Middleware Integration

```typescript
// packages/core/src/middleware/rate-limit.middleware.ts

export function createDistributedRateLimitMiddleware(
  rateLimiter: DistributedRateLimiter
): Middleware {
  return async (ctx: MiddlewareContext, next: () => Promise<void>) => {
    // Get provider info from context
    const provider = ctx.llmProvider;
    if (!provider) {
      await next();
      return;
    }

    const providerName = provider.getProviderName();
    const apiKey = getApiKeyForProvider(providerName);

    // Estimate tokens for this request
    const estimatedTokens = estimateTokens(ctx.messages);

    // Acquire permission (waits if needed)
    const startWait = Date.now();
    try {
      await rateLimiter.acquireRequest(providerName, apiKey, estimatedTokens);
    } catch (error) {
      // Log rate limit failure
      if (ctx.logger) {
        ctx.logger.logAgentError(
          'RateLimitMiddleware',
          error instanceof Error ? error : new Error(String(error))
        );
      }
      throw error;
    }

    const waitTime = Date.now() - startWait;

    // Log if we had to wait
    if (waitTime > 100 && ctx.logger) {
      ctx.logger.logSystemMessage(
        `⏱️ Rate limit throttle (${providerName}): waited ${waitTime}ms`
      );
    }

    // Get and log current status
    if (ctx.logger) {
      const status = await rateLimiter.getStatus(providerName, apiKey);

      if (status.requestUtilization > 80 || status.tokenUtilization > 80) {
        const maxUtil = Math.max(status.requestUtilization, status.tokenUtilization);
        ctx.logger.logSystemMessage(
          `⚠️ Rate limit high utilization (${providerName}): ${maxUtil.toFixed(1)}%`
        );
      }
    }

    // Proceed with request
    await next();
  };
}

function getApiKeyForProvider(providerName: string): string {
  // Get API key from environment based on provider
  switch (providerName) {
    case 'anthropic':
      return process.env.ANTHROPIC_API_KEY || '';
    case 'openai':
      return process.env.OPENAI_API_KEY || '';
    case 'openrouter':
      return process.env.OPENROUTER_API_KEY || '';
    default:
      return '';
  }
}

function estimateTokens(messages: Message[]): number {
  // Estimate based on character count (~4 chars per token)
  const totalChars = messages
    .map(m => {
      if (typeof m.content === 'string') return m.content.length;
      if (typeof m.content === 'object') return JSON.stringify(m.content).length;
      return 0;
    })
    .reduce((a, b) => a + b, 0);

  return Math.ceil(totalChars / 4);
}
```

---

## System Builder Integration

```typescript
// packages/core/src/config/system-builder.ts

import { Redis } from 'ioredis';

export class AgentSystemBuilder {
  private redisConfig?: {
    host: string;
    port: number;
    password?: string;
  };
  private rateLimitTier?: number;

  // ... existing code ...

  /**
   * Configure Redis for distributed features (rate limiting, caching)
   */
  withRedis(config: { host: string; port: number; password?: string }): this {
    this.redisConfig = config;
    return this;
  }

  /**
   * Configure distributed rate limiting
   * Requires Redis to be configured first
   */
  withDistributedRateLimiting(options?: { tier?: number; safetyMargin?: number }): this {
    if (!this.redisConfig) {
      throw new Error('Redis must be configured before enabling distributed rate limiting');
    }
    this.rateLimitTier = options?.tier;
    return this;
  }

  async build(): Promise<AgentSystem> {
    // ... existing pipeline setup ...

    // Set up Redis if configured
    let redis: Redis | undefined;
    if (this.redisConfig) {
      redis = new Redis({
        host: this.redisConfig.host,
        port: this.redisConfig.port,
        password: this.redisConfig.password,
        retryStrategy: (times) => {
          // Exponential backoff
          return Math.min(times * 50, 2000);
        }
      });
    }

    // Add distributed rate limiting if configured
    if (redis && this.rateLimitTier !== undefined) {
      const rateLimiter = new DistributedRateLimiter({
        redis,
        providerLimits: this.getProviderLimits(),
        safetyMargin: 0.9
      });

      pipeline.use('rate-limit', createDistributedRateLimitMiddleware(rateLimiter));
    }

    // ... rest of pipeline ...

    return {
      executor,
      cleanup: async () => {
        await redis?.quit();
        // ... other cleanup ...
      }
    };
  }

  private getProviderLimits(): Map<string, ProviderRateLimits> {
    const limits = new Map<string, ProviderRateLimits>();

    // Add limits for configured providers
    if (process.env.ANTHROPIC_API_KEY) {
      const anthropicLimits = getProviderRateLimits('anthropic', this.rateLimitTier);
      if (anthropicLimits) {
        limits.set('anthropic', anthropicLimits);
      }
    }

    if (process.env.OPENAI_API_KEY) {
      const openaiLimits = getProviderRateLimits('openai', this.rateLimitTier);
      if (openaiLimits) {
        limits.set('openai', openaiLimits);
      }
    }

    if (process.env.OPENROUTER_API_KEY) {
      const openrouterLimits = getProviderRateLimits('openrouter');
      if (openrouterLimits) {
        limits.set('openrouter', openrouterLimits);
      }
    }

    return limits;
  }
}
```

---

## Usage Examples

### Basic Setup (Single Process)

```typescript
import Redis from 'ioredis';

const system = await AgentSystemBuilder.default()
  .withRedis({
    host: 'localhost',
    port: 6379
  })
  .withDistributedRateLimiting({
    tier: 1,  // Anthropic Tier 1, OpenAI Tier 1, etc.
    safetyMargin: 0.9  // Use 90% of limits
  })
  .build();

// Use normally
const result = await system.executor.execute('my-agent', 'Hello');

// Cleanup
await system.cleanup();
```

### Multi-Process Setup

```typescript
// process-a.ts
const systemA = await AgentSystemBuilder.default()
  .withRedis({ host: 'redis.example.com', port: 6379 })
  .withDistributedRateLimiting({ tier: 2 })
  .build();

// process-b.ts (different machine/container)
const systemB = await AgentSystemBuilder.default()
  .withRedis({ host: 'redis.example.com', port: 6379 })
  .withDistributedRateLimiting({ tier: 2 })
  .build();

// Both processes coordinate through Redis
// Total usage across BOTH processes stays under limits ✅
```

### Different API Keys for Different Providers

```typescript
// Uses different rate limit buckets automatically
process.env.ANTHROPIC_API_KEY = 'sk-ant-account-1';  // Bucket: anthropic:hash(key1)
process.env.OPENAI_API_KEY = 'sk-openai-account-2';  // Bucket: openai:hash(key2)
process.env.OPENROUTER_API_KEY = 'sk-or-account-3';  // Bucket: openrouter:hash(key3)

const system = await AgentSystemBuilder.default()
  .withRedis({ host: 'localhost', port: 6379 })
  .withDistributedRateLimiting({ tier: 1 })
  .build();

// Rate limiting is per-provider, per-API-key
// Each provider bucket is tracked independently
```

### Monitoring Rate Limit Status

```typescript
import { Redis } from 'ioredis';
import { DistributedRateLimiter } from '@agent-system/core';

const redis = new Redis({ host: 'localhost', port: 6379 });
const rateLimiter = new DistributedRateLimiter({
  redis,
  providerLimits: DEFAULT_PROVIDER_LIMITS,
  safetyMargin: 0.9
});

// Monitor usage
setInterval(async () => {
  const anthropicStatus = await rateLimiter.getStatus(
    'anthropic',
    process.env.ANTHROPIC_API_KEY!
  );

  console.log('Anthropic Rate Limit Status:', {
    requests: `${anthropicStatus.requests}/${anthropicStatus.requestLimit}`,
    tokens: `${anthropicStatus.tokens}/${anthropicStatus.tokenLimit}`,
    requestUtilization: `${anthropicStatus.requestUtilization.toFixed(1)}%`,
    tokenUtilization: `${anthropicStatus.tokenUtilization.toFixed(1)}%`
  });
}, 5000);
```

---

## Production Deployment

### Infrastructure Requirements

**Redis**:
- **Hosting**: AWS ElastiCache, Redis Cloud, or self-hosted
- **Size**: Small instance (1GB memory) sufficient for most workloads
- **Replication**: Enable for high availability
- **Persistence**: Not required (rate limit state can be lost)

**Network**:
- Low latency between app and Redis (<10ms)
- TLS encryption recommended
- Connection pooling enabled

### Configuration by Tier

**Anthropic Tier 1** (Free tier):
```typescript
.withDistributedRateLimiting({ tier: 1, safetyMargin: 0.85 })
// 50 req/min × 0.85 = 42 req/min limit
// 10K tokens/min × 0.85 = 8.5K tokens/min limit
```

**Anthropic Tier 2** (Build tier):
```typescript
.withDistributedRateLimiting({ tier: 2, safetyMargin: 0.9 })
// 1000 req/min × 0.9 = 900 req/min limit
// 40K tokens/min × 0.9 = 36K tokens/min limit
```

**OpenAI Tier 1**:
```typescript
.withDistributedRateLimiting({ tier: 1, safetyMargin: 0.9 })
// 500 req/min × 0.9 = 450 req/min limit
// 200K tokens/min × 0.9 = 180K tokens/min limit
```

### Monitoring & Alerting

**Metrics to Track** (via Redis monitoring):
- `rate_limit_wait_time_ms` - How long requests wait
- `rate_limit_utilization_percent` - Current usage
- `rate_limit_rejections_total` - Requests that timeout

**Alerts**:
- Utilization > 90% for 5 minutes
- Average wait time > 5 seconds
- Any timeout rejections

---

## Fallback Strategy

If Redis is unavailable, the system should gracefully degrade:

```typescript
export function createDistributedRateLimitMiddleware(
  rateLimiter: DistributedRateLimiter,
  fallbackToLocal: boolean = true
): Middleware {
  let localFallback: TokenBucketRateLimiter | null = null;
  let redisUnavailable = false;

  return async (ctx: MiddlewareContext, next: () => Promise<void>) => {
    try {
      // Try distributed rate limiting
      await rateLimiter.acquireRequest(
        providerName,
        apiKey,
        estimatedTokens
      );
    } catch (error) {
      // Check if Redis error
      if (isRedisError(error) && fallbackToLocal) {
        if (!redisUnavailable) {
          redisUnavailable = true;
          console.warn('⚠️ Redis unavailable, falling back to local rate limiting');
        }

        // Use local rate limiter as fallback
        if (!localFallback) {
          localFallback = createLocalRateLimiter();
        }

        await localFallback.acquireRequest(estimatedTokens);
      } else {
        throw error;
      }
    }

    await next();
  };
}

function isRedisError(error: unknown): boolean {
  return error instanceof Error && (
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('Redis') ||
    error.message.includes('Connection')
  );
}
```

---

## Cost Analysis

**Redis Costs**:
- AWS ElastiCache (cache.t3.micro): ~$12/month
- Redis Cloud (30MB): Free
- Upstash (serverless): ~$5/month for typical usage

**Vs. Cost of Hitting Rate Limits**:
- Failed API calls: Wasted money
- Retry attempts: More wasted money
- Downtime: Lost revenue
- Developer time debugging: $150/hour

**ROI**: Redis cost pays for itself after 1-2 rate limit incidents.

---

## Testing Strategy

### Unit Tests

```typescript
describe('DistributedRateLimiter', () => {
  let redis: Redis;
  let rateLimiter: DistributedRateLimiter;

  beforeEach(() => {
    redis = new Redis();
    rateLimiter = new DistributedRateLimiter({
      redis,
      providerLimits: new Map([
        ['test-provider', { requestsPerMinute: 10, tokensPerMinute: 1000 }]
      ]),
      safetyMargin: 1.0
    });
  });

  afterEach(async () => {
    await redis.flushall();
    await redis.quit();
  });

  it('allows requests under limit', async () => {
    await expect(
      rateLimiter.acquireRequest('test-provider', 'key1', 100)
    ).resolves.not.toThrow();
  });

  it('blocks requests over limit', async () => {
    // Use up all requests
    for (let i = 0; i < 10; i++) {
      await rateLimiter.acquireRequest('test-provider', 'key1', 50);
    }

    // 11th request should timeout quickly (we set maxAttempts low for testing)
    await expect(
      rateLimiter.acquireRequest('test-provider', 'key1', 50)
    ).rejects.toThrow('Rate limit acquisition timeout');
  });

  it('tracks usage per provider', async () => {
    await rateLimiter.acquireRequest('provider-a', 'key1', 100);
    await rateLimiter.acquireRequest('provider-b', 'key2', 200);

    const statusA = await rateLimiter.getStatus('provider-a', 'key1');
    const statusB = await rateLimiter.getStatus('provider-b', 'key2');

    expect(statusA.tokens).toBe(100);
    expect(statusB.tokens).toBe(200);
  });

  it('resets after time window', async () => {
    await rateLimiter.acquireRequest('test-provider', 'key1', 500);

    // Fast-forward time by expiring keys manually
    await redis.del('rate_limit:test-provider:hash:requests');
    await redis.del('rate_limit:test-provider:hash:tokens');

    // Should work again
    await expect(
      rateLimiter.acquireRequest('test-provider', 'key1', 500)
    ).resolves.not.toThrow();
  });
});
```

### Integration Tests

```typescript
describe('Multi-Process Rate Limiting', () => {
  it('coordinates across multiple processes', async () => {
    // Simulate 3 processes
    const redis = new Redis();

    const limiter1 = new DistributedRateLimiter({ redis, ... });
    const limiter2 = new DistributedRateLimiter({ redis, ... });
    const limiter3 = new DistributedRateLimiter({ redis, ... });

    // All 3 processes try to use requests concurrently
    const results = await Promise.allSettled([
      limiter1.acquireRequest('anthropic', 'key1', 1000),
      limiter2.acquireRequest('anthropic', 'key1', 1000),
      limiter3.acquireRequest('anthropic', 'key1', 1000)
    ]);

    // Verify total usage doesn't exceed limit
    const status = await limiter1.getStatus('anthropic', 'key1');
    expect(status.requests).toBeLessThanOrEqual(10);
  });
});
```

---

## Migration Guide

### From In-Memory to Distributed

**Step 1**: Add Redis dependency
```bash
npm install ioredis @types/ioredis
```

**Step 2**: Update configuration
```typescript
// Before (in-memory, single process)
const system = await AgentSystemBuilder.default()
  .withRateLimiting({
    requestsPerMinute: 45,
    tokensPerMinute: 9000
  })
  .build();

// After (distributed, multi-process)
const system = await AgentSystemBuilder.default()
  .withRedis({ host: 'localhost', port: 6379 })
  .withDistributedRateLimiting({ tier: 1 })
  .build();
```

**Step 3**: Deploy Redis
```bash
# Development
docker run -d -p 6379:6379 redis:7-alpine

# Production
# Use managed service (AWS ElastiCache, Redis Cloud, etc.)
```

**Step 4**: Update monitoring
- Add Redis health checks
- Monitor rate limit utilization per provider
- Alert on high utilization

---

## Summary

**Key Changes from Original Design**:
1. ✅ **Provider-level tracking** - One bucket per (provider, API key) pair
2. ✅ **Distributed state** - Redis for coordination across processes
3. ✅ **Atomic operations** - Lua scripts prevent race conditions
4. ✅ **Multi-provider support** - Each provider tracked independently
5. ✅ **Graceful degradation** - Falls back to local limiting if Redis down

**Benefits**:
- Works correctly with multiple processes/containers
- Prevents rate limit violations across entire deployment
- Tracks each provider separately
- Production-ready and scalable

**Cost**: $5-12/month for Redis vs. unknown cost of rate limit failures

**Effort**: 4-5 days to implement and test properly
