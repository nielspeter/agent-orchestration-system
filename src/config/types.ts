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

import { BaseTool } from '@/types';
import type { LoggingConfig } from '@/core/logging';

// Re-export LoggingConfig from logging module
export type { LoggingConfig };

/**
 * Agent definition
 */
export interface Agent {
  /** Agent name */
  name: string;
  /** Agent prompt/instructions */
  prompt: string;
  /** Tools available to the agent */
  tools: string[] | '*';
  /** Optional model override */
  model?: string;
  /** Optional temperature */
  temperature?: number;
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
  /** Directory for todo files */
  todosDir: string;
  /** Maximum todos per session */
  maxTodosPerSession: number;
  /** Auto-cleanup after days */
  autoCleanupAfterDays: number;
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
  /** Agent configuration */
  agents?: AgentConfig;
  /** Tool configuration */
  tools?: ToolConfig;
  /** Safety limits */
  safety?: SafetyConfig;
  /** Caching settings */
  caching?: CachingConfig;
  /** Logging settings */
  logging?: LoggingConfig;
  /** MCP server configuration */
  mcp?: MCPConfig;
  /** Session configuration */
  session?: SessionConfig;
  /** Todo management configuration */
  todos?: TodoConfig;
}

/**
 * Configuration with all required fields filled
 * Used internally after merging with defaults
 */
export interface ResolvedSystemConfig {
  model: string;
  agents: AgentConfig;
  tools: Required<ToolConfig>;
  safety: SafetyConfig;
  caching: CachingConfig;
  logging: Required<LoggingConfig>;
  mcp?: MCPConfig;
  session: SessionConfig;
  todos: TodoConfig;
}

/**
 * Default configuration values
 */
export const DEFAULT_SYSTEM_CONFIG: ResolvedSystemConfig = {
  model: 'claude-3-5-haiku-latest', // Default, should be overridden by ProviderFactory.getDefaultModel()

  agents: {
    directories: ['./agents'],
  },

  tools: {
    builtin: ['read', 'write', 'list', 'task'],
    custom: [],
    defaultTimeoutMs: 30000,
    maxConcurrentTools: 5,
  },

  safety: {
    maxIterations: 20,
    warnAtIteration: 10,
    maxTokensEstimate: 50000,
    maxDepth: 5,
  },

  caching: {
    enabled: true,
    maxCacheBlocks: 4,
    cacheTTLMinutes: 5,
  },

  logging: {
    display: 'both',
    jsonl: {
      enabled: true,
      path: './logs',
    },
    console: {
      timestamps: true,
      colors: true,
      verbosity: 'normal',
    },
  },

  session: {
    sessionId: undefined,
    timeout: 300000, // 5 minutes
  },

  todos: {
    todosDir: 'todos',
    maxTodosPerSession: 50,
    autoCleanupAfterDays: 7,
  },
};

/**
 * Test configuration preset - minimal config for unit tests
 */
export const TEST_CONFIG_MINIMAL: SystemConfig = {
  model: 'test-model',
  agents: { directories: [] },
  tools: { builtin: [], custom: [] },
  safety: {
    maxIterations: 3,
    warnAtIteration: 2,
    maxTokensEstimate: 1000,
    maxDepth: 2,
  },
  caching: { enabled: false, maxCacheBlocks: 0, cacheTTLMinutes: 0 },
  logging: {
    display: 'none',
    jsonl: {
      enabled: false,
      path: './test-logs',
    },
    console: {
      timestamps: false,
      colors: false,
      verbosity: 'minimal',
    },
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

    // Handle logging config
    if (config.logging !== undefined) {
      result.logging = deepMergeObjects<LoggingConfig>(result.logging, config.logging);
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
  merged.agents ??= DEFAULT_SYSTEM_CONFIG.agents;
  merged.tools ??= DEFAULT_SYSTEM_CONFIG.tools;
  merged.safety ??= DEFAULT_SYSTEM_CONFIG.safety;
  merged.caching ??= DEFAULT_SYSTEM_CONFIG.caching;
  merged.logging ??= DEFAULT_SYSTEM_CONFIG.logging;
  merged.session ??= DEFAULT_SYSTEM_CONFIG.session;
  merged.todos ??= DEFAULT_SYSTEM_CONFIG.todos;

  return merged as ResolvedSystemConfig;
}
