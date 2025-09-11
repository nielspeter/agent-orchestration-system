import { AgentLogger, ConsoleConfig } from './types';
import { ConsoleLogger } from './console.logger';
import { NoOpLogger } from './noop.logger';

/**
 * Simple logger factory for backward compatibility
 * Most of the configuration has been simplified in the refactor
 */
export class LoggerFactory {
  /**
   * Create a combined logger with console output
   * This is for backward compatibility - new code should use builder pattern
   */
  static createCombinedLogger(_sessionId?: string): AgentLogger {
    // For backward compatibility, just return a console logger
    return new ConsoleLogger({
      timestamps: true,
      colors: true,
      verbosity: 'normal',
    });
  }

  /**
   * Create logger from config
   * Simplified version for backward compatibility
   */
  static createFromConfig(
    config?: { console?: boolean | ConsoleConfig },
    _sessionId?: string
  ): AgentLogger {
    if (!config?.console) {
      return new NoOpLogger();
    }

    if (typeof config.console === 'boolean') {
      if (config.console) {
        return new ConsoleLogger({
          timestamps: true,
          colors: true,
          verbosity: 'normal',
        });
      }
      return new NoOpLogger();
    }

    return new ConsoleLogger({
      timestamps: true,
      colors: true,
      verbosity: config.console.verbosity || 'normal',
    });
  }
}
