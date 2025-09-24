import OpenAI from 'openai';
import { ILLMProvider, StructuredOutputConfig, UsageMetrics } from './llm-provider.interface';
import { BaseTool, Message } from '@/base-types';
import { AgentLogger } from '@/logging';
import { DEFAULTS } from '@/config/defaults';

// Extended usage type for providers that support caching
interface ExtendedUsage extends OpenAI.Completions.CompletionUsage {
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
  // OpenRouter format
  prompt_tokens_details?: {
    cached_tokens?: number;
  };
}

// OpenRouter extends OpenAI message format with cache_control
interface OpenRouterTextContent {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}

interface OpenRouterMessage {
  role: string;
  content: OpenRouterTextContent[];
}

// Type guard for OpenAI API errors
interface ApiError extends Error {
  status: number;
  error?: unknown;
}

function isApiError(error: unknown): error is ApiError {
  if (!(error instanceof Error)) {
    return false;
  }

  const errorWithStatus = error as Error & { status?: unknown };
  return 'status' in errorWithStatus && typeof errorWithStatus.status === 'number';
}

export interface OpenAICompatibleConfig {
  baseURL: string;
  apiKey: string;
  defaultHeaders?: Record<string, string>;
  providerRouting?: OpenRouterProviderConfig;
  temperature?: number;
  topP?: number;
}

export interface OpenRouterProviderConfig {
  order?: string[];
  only?: string[];
  allowFallbacks?: boolean;
  sort?: 'price' | 'latency' | 'throughput';
}

// Valid sort options for OpenRouter provider routing
const VALID_SORT_OPTIONS = ['price', 'latency', 'throughput'] as const;
type ValidSortOption = (typeof VALID_SORT_OPTIONS)[number];

// Type predicate for sort validation
function isValidSortOption(sort: unknown): sort is ValidSortOption {
  return typeof sort === 'string' && VALID_SORT_OPTIONS.includes(sort as ValidSortOption);
}

export class OpenAICompatibleProvider implements ILLMProvider {
  private readonly client: OpenAI;
  private readonly modelName: string;
  private readonly providerName: string;
  private readonly logger?: AgentLogger;
  private lastUsage: UsageMetrics | null = null;
  private readonly config: OpenAICompatibleConfig;
  private readonly temperature: number;
  private readonly topP: number;

  constructor(modelName: string, config: OpenAICompatibleConfig, logger?: AgentLogger) {
    // OpenRouter handles :nitro and :floor modifiers directly
    this.modelName = modelName;
    this.logger = logger;
    this.config = config;
    this.temperature = config.temperature ?? DEFAULTS.TEMPERATURE;
    this.topP = config.topP ?? DEFAULTS.TOP_P;

    // Derive provider name from baseURL
    if (config.baseURL.includes('openrouter.ai')) {
      this.providerName = 'openrouter';

      // Validate OpenRouter-specific configuration at construction time
      // Only validate if sort is explicitly provided (not undefined)
      if (config.providerRouting?.sort !== undefined) {
        if (!isValidSortOption(config.providerRouting.sort)) {
          throw new Error(
            `Invalid OpenRouter sort option: "${config.providerRouting.sort}". ` +
              "Valid options are: 'price' (cheapest first), 'latency' (fastest first), 'throughput' (highest capacity first)"
          );
        }
      }
    } else if (config.baseURL.includes('openai.com')) {
      this.providerName = 'openai';
    } else {
      this.providerName = 'openai-compatible';
    }

    this.client = new OpenAI({
      apiKey: config.apiKey || 'dummy', // Some providers don't need keys
      baseURL: config.baseURL,
      defaultHeaders: config.defaultHeaders,
    });
  }

  async complete(
    messages: Message[],
    tools?: BaseTool[],
    config?: StructuredOutputConfig
  ): Promise<Message> {
    // Check if we should enable caching for Anthropic models via OpenRouter
    const isAnthropicModel = this.modelName.includes('anthropic/');
    const shouldEnableCache = this.isOpenRouter() && isAnthropicModel;

    // Convert our Message type to OpenAI's expected format
    // OpenAI needs tool messages to have tool_call_id
    const openAIMessages = messages.map((msg) => {
      // Handle tool messages separately - they need tool_call_id
      if (msg.role === 'tool') {
        return {
          role: 'tool' as const,
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          tool_call_id: msg.tool_call_id || 'missing_id', // OpenAI requires this field
        };
      }

      // Handle other message types
      if (msg.tool_calls) {
        // Assistant message with tool calls
        return {
          role: msg.role,
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          tool_calls: msg.tool_calls,
        };
      }

      // Check if we should add cache_control
      const contentStr =
        typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);

      if (shouldEnableCache && msg.role !== 'assistant') {
        // For OpenRouter Anthropic models, always use multipart content with cache_control
        // OpenRouter/Anthropic will decide if content is large enough to actually cache
        const openRouterMessage: OpenRouterMessage = {
          role: msg.role,
          content: [
            {
              type: 'text',
              text: contentStr,
              cache_control: { type: 'ephemeral' },
            },
          ],
        };
        return openRouterMessage as OpenAI.Chat.ChatCompletionMessageParam;
      }

      // Simple message without cache control
      return {
        role: msg.role,
        content: contentStr,
      };
    });

    const openAITools = tools?.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        // OpenAI expects a JSON Schema object, our ToolSchema is compatible
        parameters: { ...tool.parameters },
      },
    }));

    try {
      // Build request body
      const requestBody: OpenAI.Chat.ChatCompletionCreateParams & {
        provider?: unknown;
        stream_options?: { include_usage?: boolean };
      } = {
        model: this.modelName,
        messages: openAIMessages,
        tools: openAITools,
        temperature: this.temperature,
        top_p: this.topP,
      };

      // Add stream_options for OpenRouter to include usage details
      if (this.isOpenRouter()) {
        requestBody.stream_options = { include_usage: true };
      }

      // Add structured output support if configured
      if (config?.response_format === 'json') {
        // Simple JSON mode - model will try to output valid JSON
        requestBody.response_format = { type: 'json_object' };
      } else if (config?.response_format === 'json_schema' && config.json_schema) {
        // JSON schema mode - model will output JSON matching the schema
        // Note: This requires GPT-4o-2024-08-06 or later
        // The OpenAI types don't yet include json_schema, but it's a valid option
        // We use object spread to avoid type errors while keeping type safety
        Object.assign(requestBody, {
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'response',
              strict: true,
              schema: config.json_schema,
            },
          },
        });
      }

      // Add OpenRouter-specific provider routing if configured
      if (this.config.providerRouting && this.isOpenRouter()) {
        requestBody.provider = this.buildOpenRouterProvider();
      }

      const response = (await this.client.chat.completions.create(
        requestBody
      )) as OpenAI.Chat.ChatCompletion;

      const choice = response.choices[0];
      const usage = response.usage;

      // Store usage metrics
      if (usage) {
        const extendedUsage = usage as ExtendedUsage;

        // Extract cache metrics based on provider format
        let cacheHitTokens: number | undefined;
        let cacheMissTokens: number | undefined;

        if (this.isOpenRouter()) {
          // OpenRouter format: cached_tokens in prompt_tokens_details
          const cachedTokens = extendedUsage.prompt_tokens_details?.cached_tokens;
          if (cachedTokens !== undefined) {
            cacheHitTokens = cachedTokens;
            cacheMissTokens = usage.prompt_tokens - cachedTokens;
          }
        } else {
          // Anthropic native format
          cacheHitTokens = extendedUsage.prompt_cache_hit_tokens;
          cacheMissTokens = extendedUsage.prompt_cache_miss_tokens;
        }

        this.lastUsage = {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
          promptCacheHitTokens: cacheHitTokens,
          promptCacheMissTokens: cacheMissTokens,
        };
      }

      // Handle tool calls
      if (choice.message.tool_calls) {
        // Convert to our format
        const toolCalls = choice.message.tool_calls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        }));

        return {
          role: 'assistant',
          content: choice.message.content || '',
          tool_calls: toolCalls,
        };
      }

      // Simple text response
      return {
        role: 'assistant',
        content: choice.message.content || '',
      };
    } catch (error) {
      // Build a meaningful error message
      let errorMessage: string;

      if (isApiError(error)) {
        // OpenAI API error with status code and details
        errorMessage = `${error.status} ${error.message}`;
        if (error.error && typeof error.error === 'object') {
          errorMessage += ` - ${JSON.stringify(error.error)}`;
        }
      } else if (error instanceof Error) {
        // Regular Error object
        errorMessage = error.message;
      } else {
        // Unknown error type - stringify it
        errorMessage = `[${this.modelName}] API call failed: ${JSON.stringify(error)}`;
      }

      const detailedError = new Error(errorMessage);
      this.logger?.logAgentError('OpenAICompatibleProvider', detailedError);
      throw detailedError;
    }
  }

  getModelName(): string {
    return this.modelName;
  }

  getProviderName(): string {
    return this.providerName;
  }

  supportsStreaming(): boolean {
    return false; // POC: Keep it simple
  }

  getLastUsageMetrics(): UsageMetrics | null {
    return this.lastUsage;
  }

  private isOpenRouter(): boolean {
    return this.config.baseURL.includes('openrouter.ai');
  }

  private buildOpenRouterProvider(): Record<string, unknown> | undefined {
    const routing = this.config.providerRouting;
    if (!routing) return undefined;

    const provider: Record<string, unknown> = {};

    if (routing.order && routing.order.length > 0) {
      provider.order = routing.order;
    }

    if (routing.only && routing.only.length > 0) {
      provider.only = routing.only;
    }

    if (routing.allowFallbacks !== undefined) {
      provider.allow_fallbacks = routing.allowFallbacks;
    }

    if (routing.sort) {
      provider.sort = routing.sort;
    }

    return Object.keys(provider).length > 0 ? provider : undefined;
  }
}
