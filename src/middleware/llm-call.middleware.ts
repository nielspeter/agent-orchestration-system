import { Middleware } from './middleware-types';
import { AnthropicProvider } from '../llm/anthropic-provider';

/**
 * Calls the LLM and gets a response
 */
export function createLLMCallMiddleware(provider: AnthropicProvider): Middleware {
  return async (ctx, next) => {
    if (!ctx.shouldContinue || !ctx.tools) {
      await next();
      return;
    }

    // Log the call
    ctx.logger.logSystemMessage(`Calling ${provider.getModelName()} (iteration ${ctx.iteration})`);

    // Call LLM directly - no validation needed
    // Our code ensures tool results are always added immediately after tool calls
    ctx.response = await provider.complete(ctx.messages, ctx.tools);

    // Log response
    ctx.logger.logAssistantMessage(
      ctx.agentName,
      ctx.response.content || '[No content, tool calls only]'
    );

    await next();
  };
}
