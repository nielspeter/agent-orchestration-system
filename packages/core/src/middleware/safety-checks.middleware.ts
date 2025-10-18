import { Middleware } from './middleware-types';
import { SafetyConfig } from '@/config/types';
import { DEFAULTS } from '@/config/defaults';

/**
 * Performs safety checks (depth, iterations, tokens)
 */
export function createSafetyChecksMiddleware(safetyLimits: SafetyConfig): Middleware {
  return async (ctx, next) => {
    // Check recursion depth
    const effectiveMaxDepth = Math.min(ctx.executionContext.maxDepth, safetyLimits.maxDepth);
    if (ctx.executionContext.depth >= effectiveMaxDepth) {
      const msg = `Max delegation depth (${effectiveMaxDepth}) reached. Consider breaking task into smaller parts.`;
      ctx.logger.logSafetyLimit(
        'max_depth',
        ctx.agentName,
        `depth: ${ctx.executionContext.depth}/${effectiveMaxDepth}`
      );
      ctx.result = msg;
      ctx.shouldContinue = false;
      return; // Don't call next
    }

    // Check iteration count
    if (ctx.iteration >= safetyLimits.maxIterations) {
      ctx.logger.logSafetyLimit(
        'max_iterations',
        ctx.agentName,
        `iteration: ${ctx.iteration}/${safetyLimits.maxIterations}`
      );
      // Throw error to stop execution and propagate to parent agents
      throw new Error(
        `Safety limit reached: Maximum iterations (${safetyLimits.maxIterations}) exceeded. ` +
        `Task may be too complex or requires human intervention.`
      );
    }

    // Warn at high iteration count
    if (ctx.iteration === safetyLimits.warnAtIteration) {
      console.warn(`⚠️ High iteration count: ${ctx.iteration} - possible complex task`);
    }

    // Check token estimate
    const estimatedTokens = JSON.stringify(ctx.messages).length / 4;
    // Use model's context length if available, otherwise fall back to config or default
    const maxTokens =
      ctx.modelConfig?.contextLength ||
      safetyLimits.maxTokensEstimate ||
      safetyLimits.maxTokens ||
      DEFAULTS.TOKEN_ESTIMATE_FALLBACK;
    if (estimatedTokens > maxTokens) {
      ctx.logger.logSafetyLimit(
        'max_tokens',
        ctx.agentName,
        `~${Math.round(estimatedTokens)}/${maxTokens} tokens`
      );
      // Throw error to stop execution and propagate to parent agents
      throw new Error(
        `Safety limit reached: Token estimate (~${Math.round(estimatedTokens)}) exceeds limit (${maxTokens}). ` +
        `Task requires too much context.`
      );
    }

    await next();
  };
}
