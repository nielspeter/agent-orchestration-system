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
    ctx.logger.log({
      timestamp: new Date().toISOString(),
      agentName: ctx.agentName,
      depth: ctx.executionContext.depth,
      type: 'system',
      content: `Calling ${provider.getModelName()} (iteration ${ctx.iteration})`,
      metadata: {
        messageCount: ctx.messages.length,
        toolCount: ctx.tools.length,
        willCacheCount: ctx.messages.length - 1,
        parentContext: !!ctx.executionContext.parentMessages,
      },
    });

    // Call LLM directly - no validation needed
    // Our code ensures tool results are always added immediately after tool calls
    ctx.response = await provider.complete(ctx.messages, ctx.tools);

    // Log response
    ctx.logger.log({
      timestamp: new Date().toISOString(),
      agentName: ctx.agentName,
      depth: ctx.executionContext.depth,
      type: 'assistant',
      content: ctx.response.content || '[No content, tool calls only]',
      metadata: {
        toolCallCount: ctx.response.tool_calls?.length || 0,
      },
    });

    await next();
  };
}
