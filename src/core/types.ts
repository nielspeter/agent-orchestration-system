import type { ConversationMessage } from '../llm/types';
import type { LLMProvider } from '../llm/types';

export interface ExecutionContext {
  agentId: string;
  message: ConversationMessage;
  provider: LLMProvider;
  metadata?: Record<string, unknown>;
}

export type NextFunction = (context: ExecutionContext) => Promise<ConversationMessage>;

export interface Middleware {
  name: string;
  priority: number;
  execute: (context: ExecutionContext, next: NextFunction) => Promise<ConversationMessage>;
}