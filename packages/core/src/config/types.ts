/**
 * Unified configuration types for the agent orchestration system
 *
 * This module defines all configuration interfaces used throughout the system.
 * The configuration is designed to be:
 * - Testable: Easy to mock and override in tests
 * - Composable: Build up from minimal to full configs
 * - Type-safe: Full TypeScript support
 * - Flexible: Support both programmatic and file-based config
 */

import { BaseTool } from '@/base-types';
import type { ConsoleConfig } from '@/logging';
import { DEFAULTS } from './defaults';

/**
 * Thinking configuration - simplified user interface
 */
export interface ThinkingConfig {
  /** Simple boolean or detailed config */
  enabled?: boolean;
  /** Optional: Override the default budget */
  budget_tokens?: number;
}

/**
 * Internal normalized thinking configuration
 */
export interface NormalizedThinkingConfig {
  enabled: boolean;
  budgetTokens: number;
  maxCostUSD?: number;
  contextWindowPercentage?: number;
}

/**
 * Model capabilities from providers-config.json
 */
export interface ModelCapabilities {
  thinking: boolean | 'automatic' | 'discovery';
  thinkingMinBudget?: number;
  thinkingMaxBudget?: number;
  thinkingDefaultBudget?: number;
  thinkingNotes?: string;
}

/**
 * Extended model config from providers-config.json
 */
export interface ModelConfig {
  id: string;
  contextLength: number;
  maxOutputTokens?: number;
  pricing?: {
    input: number;
    output: number;
  };
  capabilities?: ModelCapabilities;
}

/**
 * Provider config from providers-config.json
 */
export interface ProviderConfig {
  type: 'native' | 'openai-compatible';
  className?: string;
  baseURL?: string;
  apiKeyEnv: string;
  models: ModelConfig[];
  dynamicModels?: boolean;
}

/**
 * Response normalization for thinking
 */
export interface NormalizedThinkingResponse {
  content: string;
  tokens: number;
  visibility: 'full' | 'summary' | 'hidden';
  cost: number;
  provider: string;
}

/**
 * Agent definition
 */
export interface Agent {
  /** Agent identifier (usually same as name) */
  id?: string;
  /** Agent name */
  name: string;
  /** Agent prompt/instructions */
  prompt: string;
  /** Agent description (for backward compatibility, usually same as prompt) */
  description?: string;
  /** Tools available to the agent */
  tools?: string[] | '*';
  /** Optional model override */
  model?: string;
  /** Optional temperature */
  temperature?: number;
  /** Optional top_p */
  top_p?: number;
  /** Optional behavior preset */
  behavior?: string;
  /** Optional max delegation depth */
  maxDepth?: number;
  /** Optional response format for structured output */
  response_format?: 'text' | 'json' | 'json_schema';
  /** Optional JSON schema for validation when using json_schema format */
  json_schema?: object;
  /** Optional thinking configuration - simplified to just boolean or detailed config */
  thinking?: boolean | ThinkingConfig;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  /** Directories to load agents from */
  directories: string[];
  /** Additional agent directories to scan */
  additionalDirectories?: string[];
  /** Programmatically defined agents */
  agents?: Agent[];
}

/**
 * Agent definition for tests
 */
export interface TestAgentConfig {
  /** Agent name */
  name: string;
  /** Tools available to the agent */
  tools: string[];
  /** Agent prompt */
  prompt: string;
}

/**
 * Tool configuration
 */
export interface ToolConfig {
  /** Built-in tools to enable */
  builtin?: string[];
  /** Custom tool instances */
  custom?: BaseTool[];
  /** Default timeout for tool execution in ms */
  defaultTimeoutMs?: number;
  /** Maximum concurrent tool executions */
  maxConcurrentTools?: number;
}

/**
 * Safety limits configuration
 */
export interface SafetyConfig {
  /** Maximum iterations to prevent infinite loops */
  maxIterations: number;
  /** Warning threshold for iterations */
  warnAtIteration: number;
  /** Maximum estimated tokens per run */
  maxTokensEstimate?: number;
  /** Maximum tokens (alias for maxTokensEstimate) */
  maxTokens?: number;
  /** Maximum delegation depth */
  maxDepth: number;
  /** Thinking/reasoning safety limits */
  thinking?: {
    /** Maximum total thinking tokens across all iterations */
    globalBudgetLimit?: number;
    /** Maximum total cost in USD for thinking */
    globalCostLimit?: number;
  };
}

/**
 * Caching configuration
 */
export interface CachingConfig {
  /** Whether caching is enabled */
  enabled: boolean;
  /** Maximum cache blocks per request */
  maxCacheBlocks: number;
  /** Cache TTL in minutes */
  cacheTTLMinutes: number;
}

/**
 * MCP server configuration
 */
export interface MCPServerConfig {
  /** Command to run the server */
  command: string;
  /** Arguments to pass to the command */
  args: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Working directory for the server process */
  cwd?: string;
  /** Server description */
  description?: string;
}

/**
 * MCP configuration
 */
export interface MCPConfig {
  /** MCP servers to connect to */
  servers: Record<string, MCPServerConfig>;
}

/**
 * Session configuration
 */
export interface SessionConfig {
  /** Session identifier for logging */
  sessionId?: string;
  /** Session timeout in ms */
  timeout?: number;
}

/**
 * Todo management configuration
 */
export interface TodoConfig {
  /** Maximum todos per session */
  maxTodosPerSession: number;
  /** Auto-cleanup after days */
  autoCleanupAfterDays: number;
}

/**
 * Storage configuration for session persistence
 */
export interface StorageConfig {
  /** Storage type: 'none' | 'memory' | 'filesystem' */
  type: 'none' | 'memory' | 'filesystem';
  /** Storage-specific options */
  options?: {
    /** Path for filesystem storage */
    path?: string;
  };
}

/**
 * Complete system configuration
 *
 * This is the main configuration interface that combines all sub-configurations.
 * All fields are optional to support partial configs and overrides.
 */
export interface SystemConfig {
  /** Model name to use */
  model?: string;
  /** Default model to use when not specified */
  defaultModel?: string;
  /** Default behavior preset to use */
  defaultBehavior?: string;
  /** Agent configuration */
  agents?: AgentConfig;
  /** Tool configuration */
  tools?: ToolConfig;
  /** Safety limits */
  safety?: SafetyConfig;
  /** Caching settings */
  caching?: CachingConfig;
  /** Console output settings */
  console?: boolean | ConsoleConfig;
  /** MCP server configuration */
  mcp?: MCPConfig;
  /** Session configuration */
  session?: SessionConfig;
  /** Todo management configuration */
  todos?: TodoConfig;
  /** Storage configuration */
  storage?: StorageConfig;
}

/**
 * Configuration with all required fields filled
 * Used internally after merging with defaults
 */
export interface ResolvedSystemConfig {
  model: string;
  defaultModel: string;
  defaultBehavior: string;
  agents: AgentConfig;
  tools: Required<ToolConfig>;
  safety: SafetyConfig;
  caching: CachingConfig;
  console: boolean | ConsoleConfig;
  mcp?: MCPConfig;
  session: SessionConfig;
  todos: TodoConfig;
  storage: StorageConfig;
}

/**
 * Default configuration values
 */
export const DEFAULT_SYSTEM_CONFIG: ResolvedSystemConfig = {
  model: '', // Will be set to defaultModel if not specified
  defaultModel: 'anthropic/claude-3-5-haiku-latest',
  defaultBehavior: 'balanced',

  agents: {
    directories: [], // Empty by default - uses built-in default agent
  },

  tools: {
    builtin: ['read', 'write', 'list', 'delegate'],
    custom: [],
    defaultTimeoutMs: 30000,
    maxConcurrentTools: 5,
  },

  safety: {
    maxIterations: DEFAULTS.MAX_ITERATIONS,
    warnAtIteration: DEFAULTS.WARN_AT_ITERATION,
    maxTokensEstimate: DEFAULTS.MAX_TOKENS_ESTIMATE,
    maxDepth: DEFAULTS.MAX_DEPTH,
  },

  caching: {
    enabled: true,
    maxCacheBlocks: DEFAULTS.MAX_CACHE_BLOCKS,
    cacheTTLMinutes: DEFAULTS.CACHE_TTL_MINUTES,
  },

  console: false, // Silent by default

  session: {
    sessionId: undefined,
    timeout: DEFAULTS.SESSION_TIMEOUT,
  },

  todos: {
    maxTodosPerSession: 50,
    autoCleanupAfterDays: 7,
  },

  storage: {
    type: 'none', // No storage by default - explicit opt-in required
    options: {
      path: '.agent-sessions', // Default path for filesystem storage
    },
  },
};

/**
 * Test configuration preset - minimal config for unit tests
 */
export const TEST_CONFIG_MINIMAL: SystemConfig = {
  model: 'test-model',
  agents: {
    directories: [],
    // Add test agent to satisfy validation
    agents: [
      {
        name: 'test-agent',
        prompt: 'Test agent for unit tests',
        tools: '*',
      },
    ],
  },
  tools: { builtin: [], custom: [] },
  safety: {
    maxIterations: 3,
    warnAtIteration: 2,
    maxTokensEstimate: 1000,
    maxDepth: 2,
  },
  caching: { enabled: false, maxCacheBlocks: 0, cacheTTLMinutes: 0 },
  console: false, // Silent for tests
  storage: {
    type: 'memory',
    options: {},
  },
};
/**
 * Deep merge helper for objects
 */
function deepMergeObjects<T>(target: T | undefined, source: T): T {
  if (!target) return source;
  const result = { ...target } as T;
  for (const key in source) {
    if (source[key] !== undefined) {
      (result as Record<string, unknown>)[key] = source[key];
    }
  }
  return result;
}

/**
 * Utility to deep merge configurations
 */
export function mergeConfigs(...configs: Partial<SystemConfig>[]): SystemConfig {
  const result: Partial<SystemConfig> = {};

  for (const config of configs) {
    // Handle model string
    if (config.model !== undefined) {
      result.model = config.model;
    }

    // Handle agents config
    if (config.agents !== undefined) {
      result.agents = deepMergeObjects<AgentConfig>(result.agents, config.agents);
    }

    // Handle tools config
    if (config.tools !== undefined) {
      result.tools = deepMergeObjects<ToolConfig>(result.tools, config.tools);
    }

    // Handle safety config
    if (config.safety !== undefined) {
      result.safety = deepMergeObjects<SafetyConfig>(result.safety, config.safety);
    }

    // Handle caching config
    if (config.caching !== undefined) {
      result.caching = deepMergeObjects<CachingConfig>(result.caching, config.caching);
    }

    // Handle console config
    if (config.console !== undefined) {
      result.console = config.console;
    }

    // Handle MCP config
    if (config.mcp !== undefined) {
      result.mcp = deepMergeObjects<MCPConfig>(result.mcp, config.mcp);
    }

    // Handle session config
    if (config.session !== undefined) {
      result.session = deepMergeObjects<SessionConfig>(result.session, config.session);
    }

    // Handle todos config
    if (config.todos !== undefined) {
      result.todos = deepMergeObjects<TodoConfig>(result.todos, config.todos);
    }

    // Handle storage config
    if (config.storage !== undefined) {
      result.storage = deepMergeObjects<StorageConfig>(result.storage, config.storage);
    }
  }

  return result as SystemConfig;
}

/**
 * Validate and resolve a partial config against defaults
 */
export function resolveConfig(partial: Partial<SystemConfig>): ResolvedSystemConfig {
  const merged = mergeConfigs(DEFAULT_SYSTEM_CONFIG, partial);

  // Ensure all required fields are present
  if (!merged.model) merged.model = DEFAULT_SYSTEM_CONFIG.model;
  if (!merged.defaultModel) merged.defaultModel = DEFAULT_SYSTEM_CONFIG.defaultModel;
  if (!merged.defaultBehavior) merged.defaultBehavior = DEFAULT_SYSTEM_CONFIG.defaultBehavior;
  merged.agents ??= DEFAULT_SYSTEM_CONFIG.agents;
  merged.tools ??= DEFAULT_SYSTEM_CONFIG.tools;
  merged.safety ??= DEFAULT_SYSTEM_CONFIG.safety;
  merged.caching ??= DEFAULT_SYSTEM_CONFIG.caching;
  merged.console ??= DEFAULT_SYSTEM_CONFIG.console;
  merged.session ??= DEFAULT_SYSTEM_CONFIG.session;
  merged.todos ??= DEFAULT_SYSTEM_CONFIG.todos;
  merged.storage ??= DEFAULT_SYSTEM_CONFIG.storage;

  return merged as ResolvedSystemConfig;
}
