import { Middleware } from './middleware-types';
import { ProviderFactory } from '@/providers/provider-factory';
import { AgentLogger } from '@/logging';
import type { ProvidersConfig } from '@/config/types';

/**
 * Selects the appropriate provider based on model name
 * Uses ProviderFactory to dynamically create the right provider
 */
export function createProviderSelectionMiddleware(
  defaultModelName: string,
  defaultBehaviorName: string,
  logger?: AgentLogger,
  providedConfig?: ProvidersConfig,
  apiKeys?: Record<string, string>
): Middleware {
  return async (ctx, next) => {
    // Use agent's model preference if specified, otherwise use default
    const modelName = ctx.agent?.model || defaultModelName;

    try {
      // Resolve behavior settings from agent or defaults FIRST
      let temperature: number | undefined;
      let top_p: number | undefined;

      // Check if agent has explicit temperature/top_p
      if (ctx.agent?.temperature !== undefined) {
        temperature = ctx.agent.temperature;
      }
      if (ctx.agent?.top_p !== undefined) {
        top_p = ctx.agent.top_p;
      }

      // Use provided config or load from file
      const providersConfig = providedConfig || ProviderFactory.loadProvidersConfig();

      // If not explicit, check for behavior preset
      if (temperature === undefined || top_p === undefined) {
        let preset;
        if (ctx.agent?.behavior) {
          preset = ProviderFactory.getBehaviorPreset(providersConfig, ctx.agent.behavior);
          if (!preset) {
            ctx.logger.logSystemMessage(
              `Unknown behavior preset: ${ctx.agent.behavior}, using default`
            );
            preset = ProviderFactory.getDefaultBehavior(providersConfig, defaultBehaviorName);
          }
        } else {
          preset = ProviderFactory.getDefaultBehavior(providersConfig, defaultBehaviorName);
        }

        // Use preset values if not explicitly overridden
        temperature = temperature ?? preset.temperature;
        top_p = top_p ?? preset.top_p;
      }

      ctx.behaviorSettings = { temperature, top_p };

      // NOW create provider with the resolved behavior settings
      const { provider, modelConfig } = ProviderFactory.createWithConfig(
        modelName,
        providersConfig,
        logger,
        ctx.behaviorSettings,
        apiKeys
      );
      ctx.provider = provider;
      ctx.modelConfig = modelConfig;
      ctx.modelName = provider.getModelName();

      // Log model selection
      const selectedProviderName = provider.getProviderName();
      const selectedModelName = provider.getModelName();
      ctx.logger.logModelSelection(ctx.agentName, selectedModelName, selectedProviderName);

      // Log behavior settings if different from default
      const defaultBehavior = ProviderFactory.getDefaultBehavior(
        providersConfig,
        defaultBehaviorName
      );
      if (
        ctx.behaviorSettings.temperature !== defaultBehavior.temperature ||
        ctx.behaviorSettings.top_p !== defaultBehavior.top_p
      ) {
        ctx.logger.logSystemMessage(
          `Using behavior: temp=${ctx.behaviorSettings.temperature}, top_p=${ctx.behaviorSettings.top_p}`
        );
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
