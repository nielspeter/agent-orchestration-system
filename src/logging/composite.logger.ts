import { AgentLogger } from './types';

export class CompositeLogger implements AgentLogger {
  private readonly loggers: AgentLogger[];

  constructor(loggers: AgentLogger[]) {
    this.loggers = loggers;
  }

  logUserMessage(content: string): void {
    this.loggers.forEach((logger) => logger.logUserMessage(content));
  }

  logAssistantMessage(agent: string, text: string): void {
    this.loggers.forEach((logger) => logger.logAssistantMessage(agent, text));
  }

  logSystemMessage(message: string): void {
    this.loggers.forEach((logger) => logger.logSystemMessage(message));
  }

  logToolCall(agent: string, tool: string, params: Record<string, unknown>): void {
    this.loggers.forEach((logger) => logger.logToolCall(agent, tool, params));
  }

  logToolExecution(agent: string, tool: string, toolId: string): void {
    this.loggers.forEach((logger) => logger.logToolExecution(agent, tool, toolId));
  }

  logToolResult(agent: string, tool: string, toolId: string, result: unknown): void {
    this.loggers.forEach((logger) => logger.logToolResult(agent, tool, toolId, result));
  }

  logToolError(agent: string, tool: string, toolId: string, error: Error): void {
    this.loggers.forEach((logger) => logger.logToolError(agent, tool, toolId, error));
  }

  logDelegation(parent: string, child: string, task: string): void {
    this.loggers.forEach((logger) => logger.logDelegation(parent, child, task));
  }

  logDelegationComplete(parent: string, child: string, result: string): void {
    this.loggers.forEach((logger) => logger.logDelegationComplete(parent, child, result));
  }

  logAgentStart(agent: string, depth: number, task?: string): void {
    this.loggers.forEach((logger) => logger.logAgentStart(agent, depth, task));
  }

  logAgentIteration(agent: string, iteration: number): void {
    this.loggers.forEach((logger) => logger.logAgentIteration(agent, iteration));
  }

  logAgentComplete(agent: string, duration: number): void {
    this.loggers.forEach((logger) => logger.logAgentComplete(agent, duration));
  }

  logAgentError(agent: string, error: Error): void {
    this.loggers.forEach((logger) => logger.logAgentError(agent, error));
  }

  logTodoUpdate(todos: Array<{ content: string; status: string; activeForm?: string }>): void {
    this.loggers.forEach((logger) => {
      if (logger.logTodoUpdate) {
        logger.logTodoUpdate(todos);
      }
    });
  }

  async getSessionEvents(): Promise<import('@/session/types').AnySessionEvent[]> {
    // Return events from the first logger that has them (typically EventLogger)
    for (const logger of this.loggers) {
      if (logger.getSessionEvents) {
        const events = await logger.getSessionEvents();
        if (events.length > 0) {
          return events;
        }
      }
    }
    return [];
  }

  flush(): void {
    this.loggers.forEach((logger) => logger.flush());
  }

  close(): void {
    this.loggers.forEach((logger) => logger.close());
  }
}
