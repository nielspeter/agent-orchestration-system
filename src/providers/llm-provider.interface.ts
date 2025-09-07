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
 * Common interface for all LLM providers
 * POC: Keep it simple, just the essentials
 */
export interface ILLMProvider {
  complete(messages: Message[], tools?: BaseTool[]): Promise<Message>;
  getModelName(): string;
  supportsStreaming(): boolean;
  getLastUsageMetrics(): UsageMetrics | null;
}
