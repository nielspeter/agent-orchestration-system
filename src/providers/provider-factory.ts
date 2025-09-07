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
}

interface ProvidersConfig {
  defaultModel?: string; // The default model to use
  defaultBehavior?: string; // Default behavior preset
  behaviorPresets?: Record<string, BehaviorPreset>;
  fallbackProvider: string; // Fallback when no pattern matches
  providers: Record<string, ProviderConfig>;
  modelPatterns?: Array<{ pattern: string; provider: string }>;
}

export interface ProviderWithConfig {
  provider: ILLMProvider;
  modelConfig?: ModelConfig;
}

export class ProviderFactory {
  private static cachedConfig: ProvidersConfig | null = null;

  static loadProvidersConfig(): ProvidersConfig {
    // Cache the config to avoid repeated file reads
    if (this.cachedConfig) return this.cachedConfig;

    const configPath = path.join(process.cwd(), 'providers-config.json');
    try {
      const configText = fs.readFileSync(configPath, 'utf-8');
      const parsedConfig = JSON.parse(configText) as ProvidersConfig;
      // Remove defaultModel and defaultBehavior - these come from agent-config now
      delete parsedConfig.defaultModel;
      delete parsedConfig.defaultBehavior;
      this.cachedConfig = parsedConfig;
      return parsedConfig;
    } catch {
      // Minimal fallback for POC
      const fallback: ProvidersConfig = {
        fallbackProvider: 'anthropic',
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

  static getBehaviorPreset(
    providersConfig: ProvidersConfig,
    name: string
  ): BehaviorPreset | undefined {
    return providersConfig.behaviorPresets?.[name];
  }

  static getDefaultBehavior(
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

  static createWithConfig(
    modelName: string,
    providersConfig: ProvidersConfig,
    logger?: AgentLogger,
    behaviorSettings?: { temperature: number; top_p: number }
  ): ProviderWithConfig {
    const config = providersConfig;

    // Find provider - simple pattern matching
    let providerName = config.fallbackProvider;

    // Check patterns
    if (config.modelPatterns) {
      for (const pattern of config.modelPatterns) {
        if (new RegExp(pattern.pattern).test(modelName)) {
          providerName = pattern.provider;
          break;
        }
      }
    }

    // Check if model has provider prefix (e.g., "groq/llama-70b")
    if (modelName.includes('/')) {
      const prefix = modelName.split('/')[0];
      if (config.providers[prefix]) {
        providerName = prefix;
      }
    }

    const providerConfig = config.providers[providerName];
    if (!providerConfig) {
      throw new Error(`Provider ${providerName} not configured`);
    }

    // Check if API key is available for this provider
    const apiKey = process.env[providerConfig.apiKeyEnv];
    if (!apiKey) {
      // Provide helpful error message with exact steps to fix
      throw new Error(
        `Cannot use model "${modelName}" - missing API key.\n` +
          `Please set the ${providerConfig.apiKeyEnv} environment variable.\n` +
          `Example: export ${providerConfig.apiKeyEnv}=your-api-key-here`
      );
    }

    // Find model config if available
    let modelConfig: ModelConfig | undefined;
    if (providerConfig.models) {
      modelConfig = providerConfig.models.find((m) => m.id === modelName);
    }

    // Create provider
    let provider: ILLMProvider;
    if (providerConfig.type === 'native' && providerName === 'anthropic') {
      provider = new AnthropicProvider(
        modelName,
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
      };

      provider = new OpenAICompatibleProvider(modelName, openAIConfig, logger);
    }

    return { provider, modelConfig };
  }

  // Backwards compatibility - keep the old method but require providersConfig
  static create(
    modelName: string,
    providersConfig: ProvidersConfig,
    logger?: AgentLogger,
    defaultBehaviorName?: string
  ): ILLMProvider {
    // Use default behavior for backwards compatibility
    const defaultBehavior = this.getDefaultBehavior(providersConfig, defaultBehaviorName);
    return this.createWithConfig(modelName, providersConfig, logger, defaultBehavior).provider;
  }
}
