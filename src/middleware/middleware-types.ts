import { AgentDefinition, BaseTool, ExecutionContext, Message } from '../types';
import { AgentLogger } from '../core/logging';

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

/**
 * Middleware that can be named for debugging
 */
export interface NamedMiddleware {
  name: string;
  execute: Middleware;
}
