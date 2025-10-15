import { Middleware } from './middleware-types';
import { LLMMetadata } from '@/session/types';

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

    // Pass structured output config and thinking config if agent has them configured
    const structuredConfig =
      ctx.agent?.response_format || ctx.thinkingConfig
        ? {
            response_format: ctx.agent?.response_format,
            json_schema: ctx.agent?.json_schema,
            thinking: ctx.thinkingConfig,
          }
        : undefined;

    const startTime = Date.now();
    ctx.response = await ctx.provider.complete(ctx.messages, ctx.tools, structuredConfig);
    const latencyMs = Date.now() - startTime;

    // Build metadata from provider metrics if available
    let metadata: LLMMetadata | undefined;
    const usageMetrics = ctx.provider.getLastUsageMetrics?.();

    if (usageMetrics) {
      // Get provider name directly from the provider instance if available
      const providerName = ctx.provider.getProviderName?.() || 'unknown';
      const modelName = ctx.provider.getModelName?.() || ctx.agent?.model || 'unknown';
      const stopReason = ctx.provider.getLastStopReason?.() || undefined;

      metadata = {
        model: modelName,
        provider: providerName,
        ...(stopReason && { stopReason }),
        usage: {
          promptTokens: usageMetrics.promptTokens,
          completionTokens: usageMetrics.completionTokens,
          totalTokens: usageMetrics.totalTokens,
          ...(usageMetrics.promptCacheHitTokens !== undefined && {
            promptCacheHitTokens: usageMetrics.promptCacheHitTokens,
          }),
          ...(usageMetrics.promptCacheMissTokens !== undefined && {
            promptCacheMissTokens: usageMetrics.promptCacheMissTokens,
          }),
          ...(usageMetrics.cached_tokens !== undefined && {
            cachedTokens: usageMetrics.cached_tokens,
          }),
        },
        performance: {
          latencyMs,
        },
        config: {
          ...(ctx.agent?.temperature !== undefined && { temperature: ctx.agent.temperature }),
          ...(ctx.agent?.top_p !== undefined && { topP: ctx.agent.top_p }),
          ...(ctx.agent?.response_format && { responseFormat: ctx.agent.response_format }),
        },
      };
    }

    // Store metadata in context for tool calls to reference
    ctx.lastLLMMetadata = metadata;

    // Update thinking metrics if thinking was used
    if (usageMetrics?.thinkingTokens) {
      // Initialize metrics if not exists
      if (!ctx.thinkingMetrics) {
        ctx.thinkingMetrics = {
          totalTokensUsed: 0,
          totalCost: 0,
          contextUsagePercent: 0,
        };
      }

      // Increment total thinking tokens used
      ctx.thinkingMetrics.totalTokensUsed += usageMetrics.thinkingTokens;

      // Calculate thinking cost if pricing is available
      // Use model-specific thinking pricing if available (e.g., o1/o3 use 4x input price)
      // Otherwise fall back to regular input token pricing
      if (ctx.providerModelConfig?.pricing) {
        const thinkingPrice =
          ctx.providerModelConfig.capabilities?.thinkingPricing?.input ||
          ctx.providerModelConfig.pricing.input;
        const thinkingCost = (usageMetrics.thinkingTokens / 1000) * thinkingPrice;
        ctx.thinkingMetrics.totalCost += thinkingCost;
      }

      // Calculate context window usage percentage
      if (ctx.providerModelConfig?.contextLength) {
        const totalTokens = usageMetrics.totalTokens + usageMetrics.thinkingTokens;
        ctx.thinkingMetrics.contextUsagePercent =
          (totalTokens / ctx.providerModelConfig.contextLength) * 100;
      }

      // CRITICAL: Update ExecutionContext so metrics flow to child agents via delegation
      if (ctx.executionContext) {
        ctx.executionContext.thinkingMetrics = ctx.thinkingMetrics;
      }
    }

    // Log response with metadata passed directly
    if (ctx.response.content) {
      ctx.logger.logAssistantMessage(ctx.agentName, ctx.response.content, metadata);
    }

    // Tool calls will be logged by the executor when they're actually executed

    await next();
  };
}
