import { Middleware } from './middleware-types';
import { SafetyConfig } from '../config/types';

/**
 * Performs safety checks (depth, iterations, tokens)
 */
export function createSafetyChecksMiddleware(safetyLimits: SafetyConfig): Middleware {
  return async (ctx, next) => {
    // Check recursion depth
    const effectiveMaxDepth = Math.min(ctx.executionContext.maxDepth, safetyLimits.maxDepth);
    if (ctx.executionContext.depth >= effectiveMaxDepth) {
      const msg = `Max delegation depth (${effectiveMaxDepth}) reached. Consider breaking task into smaller parts.`;
      ctx.logger.logSystemMessage(`🛑 ${msg}`);
      ctx.result = msg;
      ctx.shouldContinue = false;
      return; // Don't call next
    }

    // Check iteration count
    if (ctx.iteration >= safetyLimits.maxIterations) {
      const msg = `Stopped at ${safetyLimits.maxIterations} iterations (safety limit). Task may be too complex.`;
      ctx.logger.logSystemMessage(`🛑 ${msg}`);
      ctx.result = msg;
      ctx.shouldContinue = false;
      return; // Don't call next
    }

    // Warn at high iteration count
    if (ctx.iteration === safetyLimits.warnAtIteration) {
      console.warn(`⚠️ High iteration count: ${ctx.iteration} - possible complex task`);
    }

    // Check token estimate
    const estimatedTokens = JSON.stringify(ctx.messages).length / 4;
    const maxTokens = safetyLimits.maxTokensEstimate || safetyLimits.maxTokens || 100000;
    if (estimatedTokens > maxTokens) {
      const msg = `Token limit estimate exceeded: ~${Math.round(estimatedTokens)} tokens`;
      console.warn(`⚠️ ${msg}`);
      ctx.logger.logSystemMessage(`🛑 Stopping: ${msg}`);
      ctx.result = `Task stopped: ${msg} (safety limit)`;
      ctx.shouldContinue = false;
      return; // Don't call next
    }

    await next();
  };
}
