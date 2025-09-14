import { BaseTool, Message } from '@/base-types';

/**
 * Simple usage metrics interface for POC
 */
export interface UsageMetrics {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  promptCacheHitTokens?: number; // Anthropic style
  promptCacheMissTokens?: number; // Anthropic style
  cached_tokens?: number; // xAI/OpenRouter style
}

/**
 * Configuration for structured output
 */
export interface StructuredOutputConfig {
  response_format?: 'text' | 'json' | 'json_schema';
  json_schema?: object;
}

/**
 * Common interface for all LLM providers
 * POC: Keep it simple, just the essentials
 */
export interface ILLMProvider {
  complete(
    messages: Message[],
    tools?: BaseTool[],
    config?: StructuredOutputConfig
  ): Promise<Message>;
  getModelName(): string;
  getProviderName(): string;
  supportsStreaming(): boolean;
  getLastUsageMetrics(): UsageMetrics | null;
}
