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

import { BaseTool } from '../types';

/**
 * Agent configuration
 */
export interface AgentConfig {
  /** Directories to load agents from */
  directories: string[];
  /** Additional agent directories to scan */
  additionalDirectories?: string[];
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
  maxTokensEstimate: number;
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
 * Logging configuration
 */
export interface LoggingConfig {
  /** Log directory path */
  logDir: string;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Maximum log file size in MB */
  maxLogFileSizeMB?: number;
  /** Number of log files to keep */
  maxLogFiles?: number;
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
  model: 'claude-3-5-haiku-latest',

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
    logDir: 'logs',
    verbose: false,
    maxLogFileSizeMB: 10,
    maxLogFiles: 5,
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
  logging: { logDir: 'test-logs', verbose: false },
};

/**
 * Test configuration preset - with basic tools
 */
export const TEST_CONFIG_WITH_TOOLS: SystemConfig = {
  ...TEST_CONFIG_MINIMAL,
  tools: { builtin: ['read', 'write'], custom: [] },
};

/**
 * Utility to deep merge configurations
 */
export function mergeConfigs(...configs: Partial<SystemConfig>[]): SystemConfig {
  const result: any = {};

  for (const config of configs) {
    for (const key in config) {
      const value = (config as any)[key];
      if (value === undefined) continue;

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result[key] = mergeConfigs(result[key] || {}, value);
      } else {
        result[key] = value;
      }
    }
  }

  return result;
}

/**
 * Validate and resolve a partial config against defaults
 */
export function resolveConfig(partial: Partial<SystemConfig>): ResolvedSystemConfig {
  const merged = mergeConfigs(DEFAULT_SYSTEM_CONFIG, partial);

  // Ensure all required fields are present
  if (!merged.model) merged.model = DEFAULT_SYSTEM_CONFIG.model;
  if (!merged.agents) merged.agents = DEFAULT_SYSTEM_CONFIG.agents;
  if (!merged.tools) merged.tools = DEFAULT_SYSTEM_CONFIG.tools;
  if (!merged.safety) merged.safety = DEFAULT_SYSTEM_CONFIG.safety;
  if (!merged.caching) merged.caching = DEFAULT_SYSTEM_CONFIG.caching;
  if (!merged.logging) merged.logging = DEFAULT_SYSTEM_CONFIG.logging;
  if (!merged.session) merged.session = DEFAULT_SYSTEM_CONFIG.session;
  if (!merged.todos) merged.todos = DEFAULT_SYSTEM_CONFIG.todos;

  return merged as ResolvedSystemConfig;
}
