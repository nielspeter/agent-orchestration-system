import OpenAI from 'openai';
import { ILLMProvider, UsageMetrics } from './llm-provider.interface';
import { BaseTool, Message } from '@/types';
import { AgentLogger } from '@/core/logging';

// Extended usage type for providers that support caching
interface ExtendedUsage extends OpenAI.Completions.CompletionUsage {
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
}

export interface OpenAICompatibleConfig {
  baseURL: string;
  apiKey: string;
  defaultHeaders?: Record<string, string>;
}

export class OpenAICompatibleProvider implements ILLMProvider {
  private readonly client: OpenAI;
  private readonly modelName: string;
  private readonly logger?: AgentLogger;
  private lastUsage: UsageMetrics | null = null;

  constructor(modelName: string, config: OpenAICompatibleConfig, logger?: AgentLogger) {
    this.modelName = modelName;
    this.logger = logger;

    this.client = new OpenAI({
      apiKey: config.apiKey || 'dummy', // Some providers don't need keys
      baseURL: config.baseURL,
      defaultHeaders: config.defaultHeaders,
    });
  }

  async complete(messages: Message[], tools?: BaseTool[]): Promise<Message> {
    const openAIMessages = messages.map((msg) => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
    }));

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
      const response = await this.client.chat.completions.create({
        model: this.modelName,
        messages: openAIMessages,
        tools: openAITools,
        temperature: 0.7,
      });

      const choice = response.choices[0];
      const usage = response.usage;

      // Store usage metrics
      if (usage) {
        const extendedUsage = usage as ExtendedUsage;
        this.lastUsage = {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
          // Handle cached tokens from providers that support it
          promptCacheHitTokens: extendedUsage.prompt_cache_hit_tokens,
          promptCacheMissTokens: extendedUsage.prompt_cache_miss_tokens,
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
      this.logger?.logAgentError(
        'OpenAICompatibleProvider',
        error instanceof Error ? error : new Error(`[${this.modelName}] API call failed: ${error}`)
      );
      throw error;
    }
  }

  getModelName(): string {
    return this.modelName;
  }

  supportsStreaming(): boolean {
    return false; // POC: Keep it simple
  }

  getLastUsageMetrics(): UsageMetrics | null {
    return this.lastUsage;
  }
}
