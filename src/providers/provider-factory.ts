import * as fs from 'fs';
import * as path from 'path';
import { ILLMProvider } from './llm-provider.interface';
import { AnthropicProvider } from './anthropic-provider';
import { OpenAICompatibleConfig, OpenAICompatibleProvider } from './openai-compatible-provider';
import { AgentLogger } from '@/logging';

// Simple config types - no over-engineering
interface ModelConfig {
  id: string;
  contextLength?: number;
  maxOutputTokens?: number;
  pricing?: {
    input: number;
    output: number;
  };
}

export interface BehaviorPreset {
  temperature: number;
  top_p: number;
  description?: string;
}

interface ProviderConfig {
  type: 'native' | 'openai-compatible';
  baseURL?: string;
  apiKeyEnv: string;
  headers?: Record<string, string>;
  models?: ModelConfig[];
  routing?: {
    order?: string[];
    only?: string[];
    allowFallbacks?: boolean;
    sort?: 'latency' | 'throughput';
  };
}

interface ProvidersConfig {
  defaultModel?: string; // The default model to use
  defaultBehavior?: string; // Default behavior preset
  behaviorPresets?: Record<string, BehaviorPreset>;
  providers: Record<string, ProviderConfig>;
  // Removed: fallbackProvider and modelPatterns - now using explicit provider prefixes
}

export interface ProviderWithConfig {
  provider: ILLMProvider;
  modelConfig?: ModelConfig;
}

export class ProviderFactory {
  // Instance fields for testability
  private cachedConfig: ProvidersConfig | null = null;
  private readonly configPath: string;

  // Keep static cache for backward compatibility
  private static defaultInstance: ProviderFactory | null = null;

  constructor(configPath = path.join(process.cwd(), 'providers-config.json')) {
    this.configPath = configPath;
  }

  // Get or create default instance
  private static getDefaultInstance(): ProviderFactory {
    this.defaultInstance ??= new ProviderFactory();
    return this.defaultInstance;
  }

  // Instance method for loading config
  loadProvidersConfig(): ProvidersConfig {
    // Cache the config to avoid repeated file reads
    if (this.cachedConfig) return this.cachedConfig;

    try {
      const configText = fs.readFileSync(this.configPath, 'utf-8');
      const parsedConfig = JSON.parse(configText) as ProvidersConfig;
      // Remove defaultModel and defaultBehavior - these come from agent-config now
      delete parsedConfig.defaultModel;
      delete parsedConfig.defaultBehavior;
      this.cachedConfig = parsedConfig;
      return parsedConfig;
    } catch {
      // Minimal fallback for POC
      const fallback: ProvidersConfig = {
        providers: {
          anthropic: {
            type: 'native',
            apiKeyEnv: 'ANTHROPIC_API_KEY',
          },
        },
      };
      this.cachedConfig = fallback;
      return fallback;
    }
  }

  // Static method delegates to default instance (backward compatibility)
  static loadProvidersConfig(): ProvidersConfig {
    return this.getDefaultInstance().loadProvidersConfig();
  }

  // Instance methods
  getBehaviorPreset(providersConfig: ProvidersConfig, name: string): BehaviorPreset | undefined {
    return providersConfig.behaviorPresets?.[name];
  }

  getDefaultBehavior(
    providersConfig: ProvidersConfig,
    defaultBehaviorName?: string
  ): BehaviorPreset {
    const behaviorName = defaultBehaviorName || 'balanced';
    return (
      providersConfig.behaviorPresets?.[behaviorName] || {
        temperature: 0.5,
        top_p: 0.9,
        description: 'Default balanced behavior',
      }
    );
  }

  createWithConfig(
    modelString: string,
    providersConfig: ProvidersConfig,
    logger?: AgentLogger,
    behaviorSettings?: { temperature: number; top_p: number }
  ): ProviderWithConfig {
    // Parse provider/model
    const firstSlash = modelString.indexOf('/');
    if (firstSlash === -1) {
      throw new Error(
        'Invalid model format. Use: provider/model (e.g., anthropic/claude-3-5-haiku-latest)'
      );
    }

    const providerName = modelString.substring(0, firstSlash);
    const rest = modelString.substring(firstSlash + 1);

    // Validate provider and model are not empty
    if (!providerName || !rest) {
      throw new Error(
        `Invalid model format: "${modelString}". Both provider and model must be specified.`
      );
    }

    // For OpenRouter: pass model:modifier as-is (they handle it)
    // For others: strip any modifiers
    let actualModelName = rest;
    if (!providerName.startsWith('openrouter')) {
      const colonIndex = rest.indexOf(':');
      if (colonIndex !== -1) {
        actualModelName = rest.substring(0, colonIndex);
        if (logger) {
          logger.logSystemMessage(
            `Modifier ignored for ${providerName}: ${rest.substring(colonIndex)}`
          );
        }
      }
    }
    // OpenRouter gets the full model string with :nitro or :floor

    // Get provider config - no cloning needed, no mutations!
    const providerConfig = providersConfig.providers[providerName];
    if (!providerConfig) {
      const available = Object.keys(providersConfig.providers).join(', ');
      throw new Error(`Unknown provider: ${providerName}. Available: ${available}`);
    }

    // Check API key
    const apiKey = process.env[providerConfig.apiKeyEnv];
    if (!apiKey) {
      throw new Error(
        `Missing API key for ${providerName}. Set ${providerConfig.apiKeyEnv} environment variable.`
      );
    }

    // Find model config if available
    let modelConfig: ModelConfig | undefined;
    if (providerConfig.models) {
      modelConfig = providerConfig.models.find((m) => m.id === actualModelName || m.id === '*');
    }

    // Create provider with appropriate model name
    let provider: ILLMProvider;
    if (providerConfig.type === 'native' && providerName === 'anthropic') {
      provider = new AnthropicProvider(
        actualModelName,
        logger,
        modelConfig?.pricing,
        modelConfig?.maxOutputTokens,
        behaviorSettings?.temperature,
        behaviorSettings?.top_p
      );
    } else {
      // Default to OpenAI-compatible
      if (!providerConfig.baseURL) {
        throw new Error(`Provider ${providerName} requires baseURL in config`);
      }

      const openAIConfig: OpenAICompatibleConfig = {
        baseURL: providerConfig.baseURL,
        apiKey,
        defaultHeaders: providerConfig.headers,
        providerRouting: providerConfig.routing,
        temperature: behaviorSettings?.temperature,
        topP: behaviorSettings?.top_p,
      };

      provider = new OpenAICompatibleProvider(actualModelName, openAIConfig, logger);
    }

    return { provider, modelConfig };
  }

  create(
    modelString: string,
    providersConfig: ProvidersConfig,
    logger?: AgentLogger,
    defaultBehaviorName?: string
  ): ILLMProvider {
    // Use default behavior for backwards compatibility
    const defaultBehavior = this.getDefaultBehavior(providersConfig, defaultBehaviorName);
    return this.createWithConfig(modelString, providersConfig, logger, defaultBehavior).provider;
  }

  // Static methods delegate to default instance (backward compatibility)
  static getBehaviorPreset(
    providersConfig: ProvidersConfig,
    name: string
  ): BehaviorPreset | undefined {
    return this.getDefaultInstance().getBehaviorPreset(providersConfig, name);
  }

  static getDefaultBehavior(
    providersConfig: ProvidersConfig,
    defaultBehaviorName?: string
  ): BehaviorPreset {
    return this.getDefaultInstance().getDefaultBehavior(providersConfig, defaultBehaviorName);
  }

  static createWithConfig(
    modelString: string,
    providersConfig: ProvidersConfig,
    logger?: AgentLogger,
    behaviorSettings?: { temperature: number; top_p: number }
  ): ProviderWithConfig {
    return this.getDefaultInstance().createWithConfig(
      modelString,
      providersConfig,
      logger,
      behaviorSettings
    );
  }

  static create(
    modelString: string,
    providersConfig: ProvidersConfig,
    logger?: AgentLogger,
    defaultBehaviorName?: string
  ): ILLMProvider {
    return this.getDefaultInstance().create(
      modelString,
      providersConfig,
      logger,
      defaultBehaviorName
    );
  }
}
