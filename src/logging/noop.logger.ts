import { AgentLogger } from './types';

/**
 * No-op logger for when all logging is disabled
 */
export class NoOpLogger implements AgentLogger {
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
  async getSessionEvents(): Promise<import('@/session/types').AnySessionEvent[]> {
    return []; // NoOp logger doesn't store events
  }
  flush(): void {}
  close(): void {}
}
