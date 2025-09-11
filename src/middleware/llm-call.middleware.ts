import { Middleware } from './middleware-types';

/**
 * Calls the LLM and gets a response
 */
export function createLLMCallMiddleware(): Middleware {
  return async (ctx, next) => {
    if (!ctx.shouldContinue || !ctx.tools) {
      await next();
      return;
    }

    // Log the call
    ctx.logger.logAgentIteration(ctx.agentName, ctx.iteration);

    // Call LLM directly - no validation needed
    // Our code ensures tool results are always added immediately after tool calls
    if (!ctx.provider) {
      throw new Error('No provider available in context');
    }
    ctx.response = await ctx.provider.complete(ctx.messages, ctx.tools);

    // Log response
    if (ctx.response.content) {
      ctx.logger.logAssistantMessage(ctx.agentName, ctx.response.content);
    }

    // Tool calls will be logged by the executor when they're actually executed

    await next();
  };
}
