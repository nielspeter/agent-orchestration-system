import type { ConversationMessage, LLMProvider } from '@/providers';

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
