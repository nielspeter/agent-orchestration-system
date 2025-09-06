import { Middleware } from './middleware-types';
import { ProviderFactory } from '@/llm/provider-factory';
import { AgentLogger } from '@/core/logging';

/**
 * Selects the appropriate provider based on model name
 * Uses ProviderFactory to dynamically create the right provider
 */
export function createProviderSelectionMiddleware(
  defaultModelName: string,
  logger?: AgentLogger
): Middleware {
  return async (ctx, next) => {
    // Use agent's model preference if specified, otherwise use default
    const modelName = ctx.agent?.model || defaultModelName;

    try {
      // Create provider using factory
      ctx.provider = ProviderFactory.create(modelName, logger);
      ctx.modelName = ctx.provider.getModelName();

      // Log if agent requested a different model
      if (ctx.agent?.model && ctx.agent.model !== defaultModelName) {
        ctx.logger.logSystemMessage(`Agent requested model: ${ctx.agent.model}`);
      }
    } catch (error) {
      // If agent specifically requested a model, and it's not available, fail immediately
      if (ctx.agent?.model) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Agent "${ctx.agentName}" requires model "${ctx.agent.model}" which is not available. ` +
            `${errorMsg}. ` +
            'Please either: 1) Set up the required model, or 2) Update the agent to use an available model.'
        );
      }
      // If using default model, and it fails, re-throw original error
      throw error;
    }

    await next();
  };
}
