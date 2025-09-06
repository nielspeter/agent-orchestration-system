import * as fs from 'fs';
import * as path from 'path';
import { ILLMProvider } from './llm-provider.interface';
import { AnthropicProvider } from './anthropic-provider';
import { OpenAICompatibleConfig, OpenAICompatibleProvider } from './openai-compatible-provider';
import { AgentLogger } from '@/core/logging';

// Simple config types - no over-engineering
interface ProviderConfig {
  type: 'native' | 'openai-compatible';
  baseURL?: string;
  apiKeyEnv: string;
  headers?: Record<string, string>;
}

interface ProvidersConfig {
  defaultModel?: string; // The default model to use
  fallbackProvider: string; // Fallback when no pattern matches
  providers: Record<string, ProviderConfig>;
  modelAliases?: Record<string, string>;
  modelPatterns?: Array<{ pattern: string; provider: string }>;
}

export class ProviderFactory {
  private static config: ProvidersConfig | null = null;

  private static loadConfig(): ProvidersConfig {
    if (this.config) return this.config;

    const configPath = path.join(process.cwd(), 'providers-config.json');
    try {
      const configText = fs.readFileSync(configPath, 'utf-8');
      const parsedConfig = JSON.parse(configText) as ProvidersConfig;
      this.config = parsedConfig;
      return parsedConfig;
    } catch {
      // Minimal fallback for POC
      const fallback: ProvidersConfig = {
        defaultModel: 'claude-3-5-haiku-latest',
        fallbackProvider: 'anthropic',
        providers: {
          anthropic: {
            type: 'native',
            apiKeyEnv: 'ANTHROPIC_API_KEY',
          },
        },
      };
      this.config = fallback;
      return fallback;
    }
  }

  static create(modelName: string, logger?: AgentLogger): ILLMProvider {
    const config = this.loadConfig();

    // Check aliases
    const resolvedModel = config.modelAliases?.[modelName] || modelName;

    // Find provider - simple pattern matching
    let providerName = config.fallbackProvider;

    // Check patterns
    if (config.modelPatterns) {
      for (const pattern of config.modelPatterns) {
        if (new RegExp(pattern.pattern).test(resolvedModel)) {
          providerName = pattern.provider;
          break;
        }
      }
    }

    // Check if model has provider prefix (e.g., "groq/llama-70b")
    if (resolvedModel.includes('/')) {
      const prefix = resolvedModel.split('/')[0];
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

    // Create provider
    if (providerConfig.type === 'native' && providerName === 'anthropic') {
      return new AnthropicProvider(resolvedModel, logger);
    }

    // Default to OpenAI-compatible
    if (!providerConfig.baseURL) {
      throw new Error(`Provider ${providerName} requires baseURL in config`);
    }

    const openAIConfig: OpenAICompatibleConfig = {
      baseURL: providerConfig.baseURL,
      apiKey,
      defaultHeaders: providerConfig.headers,
    };

    return new OpenAICompatibleProvider(resolvedModel, openAIConfig, logger);
  }
}
