import { AgentLogger } from './types';
import { LLMMetadata } from '@/session/types';

export class CompositeLogger implements AgentLogger {
  private readonly loggers: AgentLogger[];

  constructor(loggers: AgentLogger[]) {
    this.loggers = loggers;
  }

  /**
   * Execute a logging operation on all loggers with error isolation.
   * If one logger fails, others will still execute.
   */
  private executeWithErrorIsolation(
    operation: (logger: AgentLogger) => void,
    operationName: string
  ): void {
    this.loggers.forEach((logger) => {
      try {
        operation(logger);
      } catch (error) {
        // Log the error but continue with other loggers
        console.error(`CompositeLogger: ${operationName} failed for logger:`, error);
      }
    });
  }

  logUserMessage(content: string): void {
    this.executeWithErrorIsolation((logger) => logger.logUserMessage(content), 'logUserMessage');
  }

  logAssistantMessage(agent: string, text: string, metadata?: LLMMetadata): void {
    this.executeWithErrorIsolation(
      (logger) => logger.logAssistantMessage(agent, text, metadata),
      'logAssistantMessage'
    );
  }

  logSystemMessage(message: string): void {
    this.executeWithErrorIsolation(
      (logger) => logger.logSystemMessage(message),
      'logSystemMessage'
    );
  }

  logToolCall(
    agent: string,
    tool: string,
    toolId: string,
    params: Record<string, unknown>,
    metadata?: LLMMetadata
  ): void {
    this.executeWithErrorIsolation(
      (logger) => logger.logToolCall(agent, tool, toolId, params, metadata),
      'logToolCall'
    );
  }

  logToolExecution(agent: string, tool: string, toolId: string): void {
    this.executeWithErrorIsolation(
      (logger) => logger.logToolExecution(agent, tool, toolId),
      'logToolExecution'
    );
  }

  logToolResult(agent: string, tool: string, toolId: string, result: unknown): void {
    this.executeWithErrorIsolation(
      (logger) => logger.logToolResult(agent, tool, toolId, result),
      'logToolResult'
    );
  }

  logToolError(agent: string, tool: string, toolId: string, error: Error): void {
    this.executeWithErrorIsolation(
      (logger) => logger.logToolError(agent, tool, toolId, error),
      'logToolError'
    );
  }

  logDelegation(parent: string, child: string, task: string): void {
    this.executeWithErrorIsolation(
      (logger) => logger.logDelegation(parent, child, task),
      'logDelegation'
    );
  }

  logDelegationComplete(parent: string, child: string, result: string): void {
    this.executeWithErrorIsolation(
      (logger) => logger.logDelegationComplete(parent, child, result),
      'logDelegationComplete'
    );
  }

  logAgentStart(agent: string, depth: number, task?: string): void {
    this.executeWithErrorIsolation(
      (logger) => logger.logAgentStart(agent, depth, task),
      'logAgentStart'
    );
  }

  logAgentIteration(agent: string, iteration: number): void {
    this.executeWithErrorIsolation(
      (logger) => logger.logAgentIteration(agent, iteration),
      'logAgentIteration'
    );
  }

  logAgentComplete(agent: string, duration: number): void {
    this.executeWithErrorIsolation(
      (logger) => logger.logAgentComplete(agent, duration),
      'logAgentComplete'
    );
  }

  logAgentError(agent: string, error: Error): void {
    this.executeWithErrorIsolation((logger) => logger.logAgentError(agent, error), 'logAgentError');
  }

  logTodoUpdate(todos: Array<{ content: string; status: string; activeForm?: string }>): void {
    this.executeWithErrorIsolation((logger) => {
      if (logger.logTodoUpdate) {
        logger.logTodoUpdate(todos);
      }
    }, 'logTodoUpdate');
  }

  async getSessionEvents(): Promise<import('@/session/types').AnySessionEvent[]> {
    // Return events from the first logger that has them (typically EventLogger)
    for (const logger of this.loggers) {
      try {
        if (logger.getSessionEvents) {
          const events = await logger.getSessionEvents();
          if (events.length > 0) {
            return events;
          }
        }
      } catch (error) {
        console.error('CompositeLogger: getSessionEvents failed for logger:', error);
        // Continue to next logger
      }
    }
    return [];
  }

  flush(): void {
    // Critical: Must attempt to flush ALL loggers even if some fail
    this.executeWithErrorIsolation((logger) => logger.flush(), 'flush');
  }

  close(): void {
    // Critical: Must attempt to close ALL loggers to prevent resource leaks
    this.executeWithErrorIsolation((logger) => logger.close(), 'close');
  }
}
