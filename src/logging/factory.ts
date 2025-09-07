import { AgentLogger, LoggingConfig } from './types';
import { CompositeLogger } from './composite.logger';
import { ConsoleLogger } from './console.logger';
import { JsonlLogger } from './jsonl.logger';
import { v4 as uuidv4 } from 'uuid';

export class LoggerFactory {
  // Instance field for default config
  private readonly defaultConfig: LoggingConfig;

  // Static fields for backward compatibility
  private static readonly defaultConfig: LoggingConfig = {
    display: 'console',
    jsonl: {
      enabled: true,
      path: './logs',
    },
    console: {
      timestamps: true,
      colors: true,
      verbosity: 'normal',
    },
  };
  private static defaultInstance: LoggerFactory | null = null;

  constructor(defaultConfig?: LoggingConfig) {
    this.defaultConfig = defaultConfig || LoggerFactory.defaultConfig;
  }

  // Get or create default instance
  private static getDefaultInstance(): LoggerFactory {
    if (!this.defaultInstance) {
      this.defaultInstance = new LoggerFactory();
    }
    return this.defaultInstance;
  }

  // Instance method
  createFromConfig(config?: Partial<LoggingConfig>, sessionId?: string): AgentLogger {
    const finalConfig = this.mergeConfig(config);
    const sid = sessionId || uuidv4();
    const loggers: AgentLogger[] = [];

    // Handle display mode
    const displayMode = finalConfig.display;
    const includeJsonl = displayMode === 'jsonl' || displayMode === 'both';
    const includeConsole = displayMode === 'console' || displayMode === 'both';

    // Always add JSONL logger if enabled (independent of display mode for backward compat)
    if (finalConfig.jsonl.enabled || includeJsonl) {
      loggers.push(new JsonlLogger(finalConfig.jsonl.path, sid));
    }

    // Add console logger if needed
    if (includeConsole) {
      loggers.push(
        new ConsoleLogger({
          timestamps: finalConfig.console.timestamps,
          colors: finalConfig.console.colors,
          verbosity: finalConfig.console.verbosity,
        })
      );
    }

    // Return single logger or composite
    if (loggers.length === 0) {
      // Create a no-op logger
      return new NoOpLogger();
    } else if (loggers.length === 1) {
      return loggers[0];
    } else {
      return new CompositeLogger(loggers);
    }
  }

  /**
   * Create a combined logger with both JSONL and Console output
   * This is the default for backward compatibility
   */
  createCombinedLogger(sessionId?: string): AgentLogger {
    return this.createFromConfig(
      {
        display: 'both',
        jsonl: {
          enabled: true,
          path: './logs',
        },
      },
      sessionId
    );
  }

  private mergeConfig(partial?: Partial<LoggingConfig>): LoggingConfig {
    if (!partial) return this.defaultConfig;

    return {
      display: partial.display ?? this.defaultConfig.display,
      jsonl: {
        ...this.defaultConfig.jsonl,
        ...partial.jsonl,
      },
      console: {
        ...this.defaultConfig.console,
        ...partial.console,
      },
    };
  }

  // Static methods delegate to default instance (backward compatibility)
  static createFromConfig(config?: Partial<LoggingConfig>, sessionId?: string): AgentLogger {
    return this.getDefaultInstance().createFromConfig(config, sessionId);
  }

  static createCombinedLogger(sessionId?: string): AgentLogger {
    return this.getDefaultInstance().createCombinedLogger(sessionId);
  }
}

/**
 * No-op logger for when all logging is disabled
 */
class NoOpLogger implements AgentLogger {
  logUserMessage(_content: string): void {}
  logAssistantMessage(_agent: string, _text: string): void {}
  logSystemMessage(_message: string): void {}
  logToolCall(_agent: string, _tool: string, _params: Record<string, unknown>): void {}
  logToolExecution(_agent: string, _tool: string, _toolId: string): void {}
  logToolResult(_agent: string, _tool: string, _toolId: string, _result: unknown): void {}
  logToolError(_agent: string, _tool: string, _toolId: string, _error: Error): void {}
  logDelegation(_parent: string, _child: string, _task: string): void {}
  logDelegationComplete(_parent: string, _child: string, _result: string): void {}
  logAgentStart(_agent: string, _depth: number, _task?: string): void {}
  logAgentIteration(_agent: string, _iteration: number): void {}
  logAgentComplete(_agent: string, _duration: number): void {}
  logAgentError(_agent: string, _error: Error): void {}
  logTodoUpdate(_todos: Array<{ content: string; status: string; activeForm?: string }>): void {}
  flush(): void {}
  close(): void {}
}
