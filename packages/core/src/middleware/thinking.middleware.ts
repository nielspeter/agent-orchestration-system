import * as fs from 'fs';
import * as path from 'path';
import { ThinkingConfig, NormalizedThinkingConfig, ModelConfig } from '@/config/types';
import { Agent } from '@/config/types';
import { Middleware, MiddlewareContext } from './middleware-types';
import { Message } from '@/base-types';

/**
 * ThinkingMiddleware - Configuration-driven thinking/reasoning support
 *
 * Responsibilities:
 * 1. Load model configuration from providers-config.json
 * 2. Check if model supports thinking
 * 3. Validate configuration (no temperature/top_p conflicts)
 * 4. Normalize thinking config with model-specific defaults
 * 5. Check global limits
 * 6. Check context window usage
 */
interface ProvidersConfigFile {
  providers: Record<
    string,
    {
      type: string;
      models: ModelConfig[];
      dynamicModels?: boolean;
    }
  >;
}

export class ThinkingMiddleware {
  private providersConfig: ProvidersConfigFile;
  private globalBudgetLimit: number;
  private globalCostLimit: number;

  constructor(
    private readonly safetyConfig?: {
      thinking?: { globalBudgetLimit?: number; globalCostLimit?: number };
    }
  ) {
    // Load providers-config.json once
    const configPath = path.join(process.cwd(), 'providers-config.json');
    try {
      this.providersConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
      console.warn('Failed to load providers-config.json, thinking features disabled:', error);
      this.providersConfig = { providers: {} };
    }

    // Use configured limits or defaults
    this.globalBudgetLimit = safetyConfig?.thinking?.globalBudgetLimit || 50000;
    this.globalCostLimit = safetyConfig?.thinking?.globalCostLimit || 5.0;
  }

  async process(ctx: MiddlewareContext, next: () => Promise<void>): Promise<void> {
    // Skip if no agent loaded yet or no thinking config
    if (!ctx.agent?.thinking) {
      return next();
    }

    // Handle explicit disable: thinking: { enabled: false }
    if (typeof ctx.agent.thinking === 'object' && ctx.agent.thinking.enabled === false) {
      return next();
    }

    try {
      // Step 1: Load model configuration from providers-config.json
      const modelConfig = this.loadModelConfig(ctx);
      ctx.providerModelConfig = modelConfig || undefined;

      // Step 2: Check if model supports thinking
      if (!this.modelSupportsThinking(modelConfig)) {
        ctx.logger.logSystemMessage(
          `Model ${ctx.modelName} does not support thinking, continuing without it`
        );
        return next();
      }

      // Step 3: Validate configuration (no temperature/top_p conflicts)
      this.validateConfiguration(ctx.agent);

      // Step 4: Normalize configuration with model-specific defaults
      ctx.thinkingConfig = this.normalizeConfig(ctx.agent.thinking, modelConfig);

      // Step 5: Check global limits
      if (!this.checkGlobalLimits(ctx)) {
        ctx.logger.logSystemMessage('Global thinking limits exceeded, disabling thinking');
        ctx.thinkingConfig = undefined;
        return next();
      }

      // Step 6: Check context window usage (using config values)
      if (!this.checkContextWindow(ctx, modelConfig)) {
        ctx.logger.logSystemMessage('Thinking would exceed context window, reducing budget');
        this.adjustBudget(ctx, modelConfig);
      }

      // Continue with thinking enabled
      return next();
    } catch (error) {
      ctx.logger.logSystemMessage(`Thinking configuration error: ${error}`);
      ctx.thinkingConfig = undefined;
      return next();
    }
  }

  private loadModelConfig(ctx: MiddlewareContext): ModelConfig | null {
    const modelName = ctx.modelName;
    const [providerPrefix, ...modelParts] = modelName.split('/');
    const modelId = modelParts.join('/');

    const provider = this.providersConfig.providers[providerPrefix];
    if (!provider) return null;

    // For dynamic providers like OpenRouter
    if (provider.dynamicModels) {
      return {
        id: modelId,
        contextLength: 128000, // Default, will be discovered
        capabilities: {
          thinking: 'discovery' as const,
        },
      };
    }

    // Find exact model in configuration
    return provider.models.find((m) => m.id === modelId) || null;
  }

  private modelSupportsThinking(modelConfig: ModelConfig | null): boolean {
    if (!modelConfig?.capabilities) return false;

    const capability = modelConfig.capabilities.thinking;
    return capability === true || capability === 'automatic' || capability === 'discovery';
  }

  private validateConfiguration(agent: Agent): void {
    if (!agent.thinking) return;

    // Check incompatible features with better error messages
    if (agent.thinking && agent.temperature !== undefined) {
      throw new Error(
        `Agent "${agent.name}": Extended thinking is incompatible with temperature setting. ` +
          `Remove the temperature configuration when using thinking, as the model controls ` +
          `its own sampling parameters during reasoning.`
      );
    }

    if (agent.thinking && agent.top_p !== undefined) {
      throw new Error(
        `Agent "${agent.name}": Extended thinking is incompatible with top_p setting. ` +
          `Remove the top_p configuration when using thinking, as the model controls ` +
          `its own sampling parameters during reasoning.`
      );
    }
  }

  private normalizeConfig(
    config: boolean | ThinkingConfig,
    modelConfig: ModelConfig | null
  ): NormalizedThinkingConfig {
    // Handle simple boolean format
    if (config === true) {
      return {
        enabled: true,
        budgetTokens: modelConfig?.capabilities?.thinkingDefaultBudget || 10000,
        maxCostUSD: 0.5,
        contextWindowPercentage: 0.25,
      };
    }

    // Handle detailed config format
    const detailedConfig = config as ThinkingConfig;

    // Default enabled to true if not explicitly specified (config object exists)
    const enabled = detailedConfig.enabled !== false;

    const budget =
      detailedConfig.budget_tokens || modelConfig?.capabilities?.thinkingDefaultBudget || 10000;

    // Validate against model-specific limits
    if (modelConfig?.capabilities) {
      const minBudget = modelConfig.capabilities.thinkingMinBudget || 512;
      const maxBudget = modelConfig.capabilities.thinkingMaxBudget || 100000;

      if (budget < minBudget) {
        throw new Error(`Thinking budget must be at least ${minBudget} tokens`);
      }
      if (budget > maxBudget) {
        throw new Error(`Thinking budget exceeds maximum of ${maxBudget} tokens`);
      }
    }

    return {
      enabled,
      budgetTokens: budget,
      maxCostUSD: 0.5,
      contextWindowPercentage: 0.25,
    };
  }

  private checkContextWindow(ctx: MiddlewareContext, modelConfig: ModelConfig | null): boolean {
    const messageTokens = this.estimateMessageTokens(ctx.messages);
    const thinkingBudget = ctx.thinkingConfig?.budgetTokens || 0;
    const totalTokens = messageTokens + thinkingBudget;

    // Use context window from configuration, not hardcoded
    const contextLimit = modelConfig?.contextLength || 128000;

    return totalTokens < contextLimit * 0.9;
  }

  private adjustBudget(ctx: MiddlewareContext, modelConfig: ModelConfig | null): void {
    if (!ctx.thinkingConfig) return;

    const messageTokens = this.estimateMessageTokens(ctx.messages);
    const contextLimit = modelConfig?.contextLength || 128000;
    const availableTokens = Math.floor(contextLimit * 0.9 - messageTokens);

    ctx.thinkingConfig.budgetTokens = Math.min(ctx.thinkingConfig.budgetTokens, availableTokens);
  }

  private checkGlobalLimits(ctx: MiddlewareContext): boolean {
    const metrics = ctx.thinkingMetrics || {
      totalTokensUsed: 0,
      totalCost: 0,
      contextUsagePercent: 0,
    };

    return (
      metrics.totalTokensUsed < this.globalBudgetLimit && metrics.totalCost < this.globalCostLimit
    );
  }

  private estimateMessageTokens(messages: Message[]): number {
    return messages.reduce((sum, msg) => {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      return sum + Math.ceil(content.length / 4);
    }, 0);
  }
}

/**
 * Factory function to create thinking middleware
 */
export function createThinkingMiddleware(safetyConfig?: {
  thinking?: { globalBudgetLimit?: number; globalCostLimit?: number };
}): Middleware {
  const middleware = new ThinkingMiddleware(safetyConfig);
  return (ctx, next) => middleware.process(ctx, next);
}
