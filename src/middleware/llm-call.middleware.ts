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

    // Log tool calls if any
    if (ctx.response.tool_calls?.length) {
      for (const toolCall of ctx.response.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments);
        ctx.logger.logToolCall(ctx.agentName, toolCall.function.name, args);
      }
    }

    await next();
  };
}
