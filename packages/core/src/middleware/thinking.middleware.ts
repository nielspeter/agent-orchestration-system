import { readFileSync } from 'fs';
import { join } from 'path';
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

// Constants for thinking configuration
const THINKING_DEFAULTS = {
  // Default limits if not configured
  GLOBAL_BUDGET_LIMIT: 50000, // Max thinking tokens across all agents
  GLOBAL_COST_LIMIT: 5.0, // Max $5 per session for thinking
  DEFAULT_BUDGET: 10000, // Default thinking budget per request
  DEFAULT_CONTEXT_LENGTH: 128000, // Fallback context window size
  DEFAULT_MIN_BUDGET: 512, // Minimum budget tokens
  DEFAULT_MAX_BUDGET: 100000, // Maximum budget tokens
  // Safety thresholds
  CONTEXT_WINDOW_THRESHOLD: 0.9, // Use max 90% of context for messages + thinking
} as const;

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

/**
 * Load providers configuration from file system
 * @param configPath Optional path to providers-config.json (defaults to process.cwd())
 * @returns Parsed providers configuration
 * @throws Error if file cannot be read or parsed
 */
function loadProvidersConfig(configPath?: string): ProvidersConfigFile {
  const path = configPath || join(process.cwd(), 'providers-config.json');
  try {
    const content = readFileSync(path, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to load providers configuration from ${path}: ${errorMessage}`
    );
  }
}

export class ThinkingMiddleware {
  private globalBudgetLimit: number;
  private globalCostLimit: number;

  constructor(
    private readonly providersConfig: ProvidersConfigFile,
    private readonly safetyConfig?: {
      thinking?: { globalBudgetLimit?: number; globalCostLimit?: number };
    }
  ) {
    // Use configured limits or defaults
    this.globalBudgetLimit =
      safetyConfig?.thinking?.globalBudgetLimit || THINKING_DEFAULTS.GLOBAL_BUDGET_LIMIT;
    this.globalCostLimit =
      safetyConfig?.thinking?.globalCostLimit || THINKING_DEFAULTS.GLOBAL_COST_LIMIT;
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
        // Check if user explicitly enabled thinking - that's a configuration error
        const explicitlyEnabled =
          ctx.agent.thinking === true ||
          (typeof ctx.agent.thinking === 'object' && ctx.agent.thinking.enabled !== false);

        if (explicitlyEnabled) {
          ctx.logger.logSystemMessage(
            `⚠️  WARNING: Agent "${ctx.agent.name}" has thinking enabled, but model ${ctx.modelName} does not support extended thinking. ` +
              `Thinking will be disabled. To use thinking, switch to a compatible model (Claude 3.7 Sonnet, o1, o3, etc.).`
          );
        } else {
          ctx.logger.logSystemMessage(
            `Model ${ctx.modelName} does not support thinking, continuing without it`
          );
        }
        return next();
      }

      // Step 3: Validate configuration (no temperature/top_p conflicts)
      this.validateConfiguration(ctx.agent);

      // Step 4: Normalize configuration with model-specific defaults
      ctx.thinkingConfig = this.normalizeConfig(ctx.agent.thinking, modelConfig);

      // Warn if budget is unreasonably large for context window
      const halfContext = modelConfig?.contextLength ? modelConfig.contextLength * 0.5 : Infinity;
      if (modelConfig?.contextLength && ctx.thinkingConfig.budgetTokens > halfContext) {
        ctx.logger.logSystemMessage(
          `⚠️  WARNING: Thinking budget (${ctx.thinkingConfig.budgetTokens} tokens) exceeds 50% of model's context window (${modelConfig.contextLength} tokens). ` +
          `This leaves little room for messages and may cause context window issues.`
        );
      }

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

  /**
   * Load model configuration from providers config
   *
   * @param ctx Middleware context containing model name
   * @returns Model configuration if found, null otherwise
   */
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
        contextLength: THINKING_DEFAULTS.DEFAULT_CONTEXT_LENGTH,
        capabilities: {
          thinking: 'discovery' as const,
        },
      };
    }

    // Find exact model in configuration
    return provider.models.find((m) => m.id === modelId) || null;
  }

  /**
   * Check if model supports thinking/reasoning
   *
   * @param modelConfig Model configuration to check
   * @returns True if model supports thinking
   */
  private modelSupportsThinking(modelConfig: ModelConfig | null): boolean {
    if (!modelConfig?.capabilities) return false;

    const capability = modelConfig.capabilities.thinking;
    return capability === true || capability === 'automatic' || capability === 'discovery';
  }

  /**
   * Validate agent configuration for thinking compatibility
   *
   * Throws error if agent has thinking enabled with incompatible settings
   * like temperature or top_p (model controls these during reasoning)
   *
   * @param agent Agent configuration to validate
   * @throws Error if configuration is invalid
   */
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

  /**
   * Normalize thinking configuration
   *
   * Converts simple boolean or detailed config to normalized format with
   * model-specific defaults and validates against model limits
   *
   * @param config User-provided thinking configuration
   * @param modelConfig Model configuration for defaults and limits
   * @returns Normalized thinking configuration
   * @throws Error if budget exceeds model min/max limits
   */
  private normalizeConfig(
    config: boolean | ThinkingConfig,
    modelConfig: ModelConfig | null
  ): NormalizedThinkingConfig {
    // Handle simple boolean format
    if (config === true) {
      return {
        enabled: true,
        budgetTokens:
          modelConfig?.capabilities?.thinkingDefaultBudget || THINKING_DEFAULTS.DEFAULT_BUDGET,
      };
    }

    // Handle detailed config format
    const detailedConfig = config as ThinkingConfig;

    // Default enabled to true if not explicitly specified (config object exists)
    const enabled = detailedConfig.enabled !== false;

    const budget =
      detailedConfig.budget_tokens ||
      modelConfig?.capabilities?.thinkingDefaultBudget ||
      THINKING_DEFAULTS.DEFAULT_BUDGET;

    // Validate against model-specific limits
    if (modelConfig?.capabilities) {
      const minBudget =
        modelConfig.capabilities.thinkingMinBudget || THINKING_DEFAULTS.DEFAULT_MIN_BUDGET;
      const maxBudget =
        modelConfig.capabilities.thinkingMaxBudget || THINKING_DEFAULTS.DEFAULT_MAX_BUDGET;

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
    };
  }

  /**
   * Check if thinking budget fits within context window
   *
   * @param ctx Middleware context with messages and thinking config
   * @param modelConfig Model configuration for context length
   * @returns True if total tokens (messages + thinking) < 90% of context
   */
  private checkContextWindow(ctx: MiddlewareContext, modelConfig: ModelConfig | null): boolean {
    const messageTokens = this.estimateMessageTokens(ctx.messages);
    const thinkingBudget = ctx.thinkingConfig?.budgetTokens || 0;
    const totalTokens = messageTokens + thinkingBudget;

    // Use context window from configuration, not hardcoded
    const contextLimit = modelConfig?.contextLength || THINKING_DEFAULTS.DEFAULT_CONTEXT_LENGTH;

    return totalTokens < contextLimit * THINKING_DEFAULTS.CONTEXT_WINDOW_THRESHOLD;
  }

  /**
   * Adjust thinking budget to fit within available context space
   *
   * Reduces budget or disables thinking if messages take too much space
   *
   * @param ctx Middleware context to update
   * @param modelConfig Model configuration for context length
   */
  private adjustBudget(ctx: MiddlewareContext, modelConfig: ModelConfig | null): void {
    if (!ctx.thinkingConfig) return;

    const messageTokens = this.estimateMessageTokens(ctx.messages);
    const contextLimit = modelConfig?.contextLength || THINKING_DEFAULTS.DEFAULT_CONTEXT_LENGTH;
    // CRITICAL: Use Math.max to prevent negative budget when messages exceed context limit
    const maxThinkingSpace = Math.floor(
      contextLimit * THINKING_DEFAULTS.CONTEXT_WINDOW_THRESHOLD - messageTokens
    );
    const availableTokens = Math.max(0, maxThinkingSpace);

    ctx.thinkingConfig.budgetTokens = Math.min(ctx.thinkingConfig.budgetTokens, availableTokens);

    // If no tokens available, disable thinking
    if (availableTokens === 0) {
      ctx.logger.logSystemMessage(
        'No context space available for thinking, messages exceed 90% of context window'
      );
      ctx.thinkingConfig = undefined;
    }
  }

  /**
   * Check if global thinking limits have been exceeded
   *
   * Global limits apply across all agents in a session to prevent runaway costs
   *
   * @param ctx Middleware context with thinking metrics
   * @returns True if under both global budget and cost limits
   */
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

  /**
   * Estimate token count for messages
   *
   * Uses improved character-based estimation with:
   * - Message formatting overhead (~4 tokens per message)
   * - Different ratios for text vs JSON content
   * - Tool call token counting
   * - 10% safety margin for encoding variations
   *
   * @param messages Messages to estimate tokens for
   * @returns Estimated token count
   */
  private estimateMessageTokens(messages: Message[]): number {
    let totalTokens = 0;

    for (const msg of messages) {
      // Message formatting overhead (role markers, JSON structure)
      // Anthropic/OpenAI: ~4 tokens per message
      totalTokens += 4;

      // Content tokens
      if (msg.content) {
        const content =
          typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        // More accurate: length / 3.5 for mixed content
        // English text: ~4 chars/token, JSON: ~3 chars/token
        totalTokens += Math.ceil(content.length / 3.5);
      }

      // Tool call tokens (name + JSON arguments)
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          // Tool name: usually short, ~4 chars/token
          totalTokens += Math.ceil(tc.function.name.length / 4);
          // Arguments: JSON, denser encoding ~3 chars/token
          totalTokens += Math.ceil(tc.function.arguments.length / 3);
          // Tool call structure overhead
          totalTokens += 10;
        }
      }

      // Tool result ID tokens
      if (msg.role === 'tool' && msg.tool_call_id) {
        totalTokens += Math.ceil(msg.tool_call_id.length / 4);
      }
    }

    // Add 10% safety margin for encoding variations
    return Math.ceil(totalTokens * 1.1);
  }
}

/**
 * Factory function to create thinking middleware
 *
 * Supports two call patterns:
 * - createThinkingMiddleware(safetyConfig) - Use default config path
 * - createThinkingMiddleware(configPath, safetyConfig) - Use custom config path
 *
 * @param configPathOrSafetyConfig Path to providers-config.json OR safety config object
 * @param safetyConfig Optional safety configuration for global limits (when first param is string)
 * @returns Middleware function
 * @throws Error if providers-config.json cannot be loaded
 */
export function createThinkingMiddleware(
  configPathOrSafetyConfig?:
    | string
    | { thinking?: { globalBudgetLimit?: number; globalCostLimit?: number } },
  safetyConfig?: {
    thinking?: { globalBudgetLimit?: number; globalCostLimit?: number };
  }
): Middleware {
  // Detect call pattern: if first arg is string, it's config path
  let configPath: string | undefined;
  let finalSafetyConfig: typeof safetyConfig;

  if (typeof configPathOrSafetyConfig === 'string') {
    configPath = configPathOrSafetyConfig;
    finalSafetyConfig = safetyConfig;
  } else {
    configPath = undefined; // Use default
    finalSafetyConfig = configPathOrSafetyConfig;
  }

  const providersConfig = loadProvidersConfig(configPath);
  const middleware = new ThinkingMiddleware(providersConfig, finalSafetyConfig);
  return (ctx, next) => middleware.process(ctx, next);
}
