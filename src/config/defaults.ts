/**
 * Default configuration values for the agent orchestration system
 */

export interface SystemConfig {
  /** Safety limits for execution */
  safety: {
    /** Maximum iterations to prevent infinite loops */
    maxIterations: number;
    /** Warning threshold for iterations */
    warnAtIteration: number;
    /** Maximum estimated tokens per run (~$0.05 max) */
    maxTokensEstimate: number;
    /** Maximum delegation depth */
    maxDepth: number;
  };

  /** Model configuration */
  models: {
    /** Default model name */
    defaultModel: string;
    /** Supported model families */
    supportedFamilies: string[];
  };

  /** Caching configuration */
  caching: {
    /** Whether caching is enabled by default */
    enabledByDefault: boolean;
    /** Environment variable to disable caching */
    disableEnvVar: string;
    /** Maximum cache blocks per request */
    maxCacheBlocks: number;
    /** Cache TTL in minutes */
    cacheTTLMinutes: number;
  };

  /** Logging configuration */
  logging: {
    /** Default log directory */
    defaultLogDir: string;
    /** Maximum log file size in MB */
    maxLogFileSizeMB: number;
    /** Number of log files to keep */
    maxLogFiles: number;
  };

  /** Tool execution configuration */
  tools: {
    /** Default timeout for tool execution in ms */
    defaultTimeoutMs: number;
    /** Maximum concurrent tool executions */
    maxConcurrentTools: number;
  };

  /** Todo management configuration */
  todos: {
    /** Default todos directory */
    defaultTodosDir: string;
    /** Maximum todos per session */
    maxTodosPerSession: number;
    /** Auto-cleanup after days */
    autoCleanupAfterDays: number;
  };
}

export const DEFAULT_CONFIG: SystemConfig = {
  safety: {
    maxIterations: 20,
    warnAtIteration: 10,
    maxTokensEstimate: 50000,
    maxDepth: 5,
  },

  models: {
    defaultModel: 'claude-3-5-haiku-20241022',
    supportedFamilies: ['claude'],
  },

  caching: {
    enabledByDefault: true,
    disableEnvVar: 'DISABLE_PROMPT_CACHING',
    maxCacheBlocks: 4,
    cacheTTLMinutes: 5,
  },

  logging: {
    defaultLogDir: 'logs',
    maxLogFileSizeMB: 10,
    maxLogFiles: 5,
  },

  tools: {
    defaultTimeoutMs: 30000,
    maxConcurrentTools: 5,
  },

  todos: {
    defaultTodosDir: 'todos',
    maxTodosPerSession: 50,
    autoCleanupAfterDays: 7,
  },
};
