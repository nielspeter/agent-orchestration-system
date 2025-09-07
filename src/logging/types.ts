export interface AgentLogger {
  logUserMessage(content: string): void;
  logAssistantMessage(agent: string, text: string): void;
  logSystemMessage(message: string): void;

  logToolCall(agent: string, tool: string, params: Record<string, unknown>): void;
  logToolExecution(agent: string, tool: string, toolId: string): void;
  logToolResult(agent: string, tool: string, toolId: string, result: unknown): void;
  logToolError(agent: string, tool: string, toolId: string, error: Error): void;

  logDelegation(parent: string, child: string, task: string): void;
  logDelegationComplete(parent: string, child: string, result: string): void;

  logAgentStart(agent: string, depth: number, task?: string): void;
  logAgentIteration(agent: string, iteration: number): void;
  logAgentComplete(agent: string, duration: number): void;
  logAgentError(agent: string, error: Error): void;

  logTodoUpdate?(todos: Array<{ content: string; status: string; activeForm?: string }>): void;

  flush(): void;
  close(): void;
}

export type LoggingDisplay = 'console' | 'jsonl' | 'both' | 'none';

export type ConsoleVerbosity = 'minimal' | 'normal' | 'verbose';

export interface LoggingConfig {
  display: LoggingDisplay;

  jsonl: {
    enabled: boolean;
    path: string;
    filename?: string;
  };

  console: {
    timestamps: boolean;
    colors: boolean;
    verbosity: ConsoleVerbosity;
  };
}
