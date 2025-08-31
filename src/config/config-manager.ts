import { DEFAULT_CONFIG, SystemConfig } from './defaults';

/**
 * Configuration manager that provides runtime access to system configuration
 * with environment variable overrides
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private readonly config: SystemConfig;

  private constructor() {
    this.config = this.loadConfigWithOverrides();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Load configuration with environment variable overrides
   */
  private loadConfigWithOverrides(): SystemConfig {
    const config: SystemConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

    // Environment variable overrides
    const envOverrides: Partial<SystemConfig> = {
      safety: {
        maxIterations: this.getEnvNumber('MAX_ITERATIONS', config.safety.maxIterations),
        warnAtIteration: this.getEnvNumber('WARN_AT_ITERATION', config.safety.warnAtIteration),
        maxTokensEstimate: this.getEnvNumber(
          'MAX_TOKENS_ESTIMATE',
          config.safety.maxTokensEstimate
        ),
        maxDepth: this.getEnvNumber('MAX_DEPTH', config.safety.maxDepth),
      },
      models: {
        defaultModel: process.env.MODEL || config.models.defaultModel,
        supportedFamilies: config.models.supportedFamilies,
      },
      caching: {
        enabledByDefault: !process.env[config.caching.disableEnvVar],
        disableEnvVar: config.caching.disableEnvVar,
        maxCacheBlocks: this.getEnvNumber('MAX_CACHE_BLOCKS', config.caching.maxCacheBlocks),
        cacheTTLMinutes: this.getEnvNumber('CACHE_TTL_MINUTES', config.caching.cacheTTLMinutes),
      },
      logging: {
        defaultLogDir: process.env.LOG_DIR || config.logging.defaultLogDir,
        maxLogFileSizeMB: this.getEnvNumber(
          'MAX_LOG_FILE_SIZE_MB',
          config.logging.maxLogFileSizeMB
        ),
        maxLogFiles: this.getEnvNumber('MAX_LOG_FILES', config.logging.maxLogFiles),
      },
      tools: {
        defaultTimeoutMs: this.getEnvNumber('TOOL_TIMEOUT_MS', config.tools.defaultTimeoutMs),
        maxConcurrentTools: this.getEnvNumber(
          'MAX_CONCURRENT_TOOLS',
          config.tools.maxConcurrentTools
        ),
      },
      todos: {
        defaultTodosDir: process.env.TODOS_DIR || config.todos.defaultTodosDir,
        maxTodosPerSession: this.getEnvNumber(
          'MAX_TODOS_PER_SESSION',
          config.todos.maxTodosPerSession
        ),
        autoCleanupAfterDays: this.getEnvNumber(
          'AUTO_CLEANUP_AFTER_DAYS',
          config.todos.autoCleanupAfterDays
        ),
      },
    };

    return this.deepMerge(config, envOverrides);
  }

  /**
   * Get environment variable as number with fallback
   */
  private getEnvNumber(envVar: string, defaultValue: number): number {
    const value = process.env[envVar];
    if (value === undefined) return defaultValue;

    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Deep merge two objects
   */
  private deepMerge<T>(target: T, source: Partial<T>): T {
    const result = { ...target };

    for (const key in source) {
      const sourceValue = source[key];
      if (sourceValue !== undefined) {
        if (
          typeof sourceValue === 'object' &&
          sourceValue !== null &&
          !Array.isArray(sourceValue)
        ) {
          result[key] = this.deepMerge(result[key] as any, sourceValue as any);
        } else {
          result[key] = sourceValue as any;
        }
      }
    }

    return result;
  }

  /**
   * Get safety configuration
   */
  public getSafety() {
    return this.config.safety;
  }

  /**
   * Get models configuration
   */
  public getModels() {
    return this.config.models;
  }
}
