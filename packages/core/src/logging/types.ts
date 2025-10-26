import { LLMMetadata } from '@/session/types';

export interface AgentLogger {
  logUserMessage(content: string): void;
  logAssistantMessage(agent: string, text: string, metadata?: LLMMetadata): void;
  logSystemMessage(message: string): void;

  logToolCall(
    agent: string,
    tool: string,
    toolId: string,
    params: Record<string, unknown>,
    metadata?: LLMMetadata
  ): void;
  logToolExecution(agent: string, tool: string, toolId: string): void;
  logToolResult(agent: string, tool: string, toolId: string, result: unknown): void;
  logToolError(agent: string, tool: string, toolId: string, error: Error): void;

  logDelegation(parent: string, child: string, task: string): void;
  logDelegationComplete(parent: string, child: string, result: string): void;

  logAgentStart(agent: string, depth: number, task?: string): void;
  logAgentIteration(agent: string, iteration: number): void;
  logAgentComplete(agent: string, duration: number): void;
  logAgentError(agent: string, error: Error): void;

  logSafetyLimit(reason: string, agent: string, details?: string): void;
  logSessionRecovery(sessionId: string, messageCount: number, todoCount?: number): void;
  logModelSelection(agent: string, model: string, provider: string): void;
  logMCPServerConnected(serverName: string, toolCount: number): void;

  logTodoUpdate?(todos: Array<{ content: string; status: string; activeForm?: string }>): void;

  /**
   * Get session events (if supported by the logger implementation)
   * Used for debugging, monitoring, and session recovery
   * Returns empty array for loggers that don't store events
   */
  getSessionEvents?(): Promise<import('@/session/types').AnySessionEvent[]>;

  flush(): void;
  close(): void;
}

export type ConsoleVerbosity = 'minimal' | 'normal' | 'verbose';

export interface ConsoleConfig {
  verbosity?: ConsoleVerbosity;
}
