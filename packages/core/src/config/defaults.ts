/**
 * Centralized configuration defaults for the agent orchestration system.
 * All hardcoded values should reference this single source of truth.
 *
 * Investigation notes:
 * - maxDepth: Using 10 (from agent-config.json and executor.ts) not 5 (from types.ts)
 *   as 10 is what's actually configured and working in production
 * - maxIterations: Using 20 as a conservative default (agent-config has 100 which is very high)
 */

export const DEFAULTS = {
  // Provider defaults
  TEMPERATURE: 0.5,
  TOP_P: 0.9,

  // Safety limits
  MAX_ITERATIONS: 20, // Conservative default (config can override to 100)
  WARN_AT_ITERATION: 10,
  MAX_DEPTH: 10, // Actual working value from agent-config.json
  MAX_TOKENS_ESTIMATE: 50000,
  TOKEN_ESTIMATE_FALLBACK: 100000,

  // Session
  SESSION_TIMEOUT: 300000, // 5 minutes

  // Execution
  DEFAULT_MODEL: 'anthropic/claude-haiku-4-5',
  DEFAULT_BEHAVIOR: 'balanced',

  // Cache settings
  CACHE_TTL_MINUTES: 5,
  MAX_CACHE_BLOCKS: 4,
} as const;

// Export type for type safety
export type DefaultsType = typeof DEFAULTS;
