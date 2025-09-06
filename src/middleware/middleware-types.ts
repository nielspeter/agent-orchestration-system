import { AgentDefinition, BaseTool, ExecutionContext, Message } from '@/types';
import { AgentLogger } from '@/core/logging';
import { ILLMProvider } from '@/llm/llm-provider.interface';
import { ProviderWithConfig } from '@/llm/provider-factory';

/**
 * Context object that flows through the middleware pipeline
 * All state is stored here - middleware should not maintain internal state
 */
export interface MiddlewareContext {
  // Input
  agentName: string;
  prompt: string;
  executionContext: ExecutionContext;

  // Agent and tools
  agent?: AgentDefinition;
  tools?: BaseTool[];

  // LLM Provider
  provider?: ILLMProvider;
  modelConfig?: ProviderWithConfig['modelConfig'];

  // Behavior settings (resolved from agent or defaults)
  behaviorSettings?: {
    temperature: number;
    top_p: number;
  };

  // Conversation state
  messages: Message[];

  // Current iteration (for the execution loop)
  iteration: number;

  // LLM response
  response?: Message;

  // Final result
  result?: string;

  // Shared services
  logger: AgentLogger;
  modelName: string;
  sessionId?: string;

  // Control flow
  shouldContinue: boolean;
  error?: Error;

  // Iteration tracking for child agents
  hasUsedTools?: boolean;
}

/**
 * Simple middleware function signature
 * Similar to Express.js middleware
 */
export type Middleware = (ctx: MiddlewareContext, next: () => Promise<void>) => Promise<void>;
