import { Middleware } from './middleware-types';
import { ConfigManager } from '../config/config-manager';

/**
 * Performs safety checks (depth, iterations, tokens)
 */
export function createSafetyChecksMiddleware(): Middleware {
  const config = ConfigManager.getInstance();
  const safetyLimits = config.getSafety();

  return async (ctx, next) => {
    // Check recursion depth
    const effectiveMaxDepth = Math.min(ctx.executionContext.maxDepth, safetyLimits.maxDepth);
    if (ctx.executionContext.depth >= effectiveMaxDepth) {
      const msg = `Max delegation depth (${effectiveMaxDepth}) reached. Consider breaking task into smaller parts.`;
      ctx.logger.log({
        timestamp: new Date().toISOString(),
        agentName: ctx.agentName,
        depth: ctx.executionContext.depth,
        type: 'system',
        content: `🛑 ${msg}`,
      });
      ctx.result = msg;
      ctx.shouldContinue = false;
      return; // Don't call next
    }

    // Check iteration count
    if (ctx.iteration >= safetyLimits.maxIterations) {
      const msg = `Stopped at ${safetyLimits.maxIterations} iterations (safety limit). Task may be too complex.`;
      ctx.logger.log({
        timestamp: new Date().toISOString(),
        agentName: ctx.agentName,
        depth: ctx.executionContext.depth,
        type: 'system',
        content: `🛑 ${msg}`,
      });
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
    if (estimatedTokens > safetyLimits.maxTokensEstimate) {
      const msg = `Token limit estimate exceeded: ~${Math.round(estimatedTokens)} tokens`;
      console.warn(`⚠️ ${msg}`);
      ctx.logger.log({
        timestamp: new Date().toISOString(),
        agentName: ctx.agentName,
        depth: ctx.executionContext.depth,
        type: 'system',
        content: `🛑 Stopping: ${msg}`,
      });
      ctx.result = `Task stopped: ${msg} (safety limit)`;
      ctx.shouldContinue = false;
      return; // Don't call next
    }

    await next();
  };
}
