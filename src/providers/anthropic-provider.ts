import Anthropic from '@anthropic-ai/sdk';
import { BaseTool, Message, ToolCall } from '@/base-types';
import { AgentLogger } from '@/logging';
import { CacheMetricsCollector, ModelPricing } from '@/metrics/cache-collector';
import { ILLMProvider, UsageMetrics } from './llm-provider.interface';

export interface CacheMetrics {
  inputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  outputTokens: number;
  totalCost?: number;
}

export class AnthropicProvider implements ILLMProvider {
  private readonly client: Anthropic;
  private readonly modelName: string;
  private readonly logger?: AgentLogger;
  private readonly metricsCollector: CacheMetricsCollector;
  private readonly pricing?: ModelPricing;
  private readonly maxOutputTokens: number;
  private readonly temperature: number;
  private readonly topP: number;
  private lastUsageMetrics: UsageMetrics | null = null;

  constructor(
    modelName: string,
    logger?: AgentLogger,
    pricing?: ModelPricing,
    maxOutputTokens?: number,
    temperature?: number,
    topP?: number
  ) {
    if (!modelName.startsWith('claude')) {
      throw new Error(`AnthropicProvider only supports Claude models, got: ${modelName}`);
    }

    this.modelName = modelName;
    this.logger = logger;
    this.pricing = pricing;
    this.maxOutputTokens = maxOutputTokens || 4096;
    this.temperature = temperature || 0.5; // Default 0.5 for better agent behavior
    this.topP = topP || 0.9; // Default 0.9 for balanced behavior
    this.metricsCollector = new CacheMetricsCollector(logger);

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is required for AnthropicProvider');
    }

    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async complete(messages: Message[], tools?: BaseTool[]): Promise<Message> {
    const startTime = Date.now();

    // Separate system messages from conversation messages
    const systemMessages = messages.filter((m) => m.role === 'system');
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    // Format system messages with caching (Claude Code strategy)
    const formattedSystem = this.formatSystemMessages(systemMessages);

    // Format conversation messages with Claude Code's caching strategy
    const formattedMessages = this.formatMessagesWithCaching(conversationMessages);

    // Convert tools to Anthropic format
    const formattedTools = tools ? this.formatTools(tools) : undefined;

    // Count cache blocks for metrics
    const totalCachedBlocks = this.countCacheBlocks(formattedSystem, formattedMessages);

    try {
      // Create the request params with proper typing
      const params: Anthropic.MessageCreateParams = {
        model: this.modelName,
        max_tokens: this.maxOutputTokens,
        temperature: this.temperature,
        top_p: this.topP,
        system: formattedSystem,
        messages: formattedMessages,
        tools: formattedTools,
      };

      // Add headers separately to enable caching
      const response = await this.client.messages.create(params, {
        headers: {
          'anthropic-beta': 'prompt-caching-2024-07-31',
        },
      });

      // Record detailed cache metrics
      if (response.usage) {
        const responseTime = Date.now() - startTime;
        this.recordDetailedMetrics(response.usage, totalCachedBlocks, responseTime);

        // Store for interface compliance
        this.lastUsageMetrics = {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
          promptCacheHitTokens: response.usage.cache_read_input_tokens || undefined,
          promptCacheMissTokens: response.usage.cache_creation_input_tokens || undefined,
        };

        // Also log traditional metrics for backward compatibility
        if (this.logger) {
          this.logCacheMetrics(response.usage);
        }
      }

      // Convert response back to our Message format
      return this.formatResponse(response);
    } catch (error) {
      if (this.logger) {
        this.logger.logAgentError(
          'AnthropicProvider',
          error instanceof Error ? error : new Error(String(error))
        );
      }
      throw error;
    }
  }

  private isCachingEnabled(): boolean {
    // Following Claude Code's Td() function logic
    return !process.env.DISABLE_PROMPT_CACHING;
  }

  private formatSystemMessages(
    systemMessages: Message[]
  ): string | Array<Anthropic.TextBlockParam> {
    if (systemMessages.length === 0) {
      return '';
    }

    const cachingEnabled = this.isCachingEnabled();

    // Combine all system messages into one
    const combinedSystemText = systemMessages.map((m) => m.content || '').join('\n\n');

    if (!cachingEnabled) {
      return combinedSystemText;
    }

    // Claude Code strategy: Cache the system prompt as a single block
    return [
      {
        type: 'text' as const,
        text: combinedSystemText,
        cache_control: { type: 'ephemeral' as const },
      },
    ];
  }

  private formatMessagesWithCaching(messages: Message[]): Anthropic.MessageParam[] {
    const formatted: Anthropic.MessageParam[] = [];
    const cachingEnabled = this.isCachingEnabled();

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      // Claude Code strategy: Only cache the LAST 2 messages to stay within 4 block limit
      // (system prompt = 1 block, last 2 messages = 2 blocks, total = 3 blocks)
      const shouldCacheThisMessage = cachingEnabled && i >= messages.length - 2;

      // Handle tool result messages
      if (msg.role === 'tool') {
        // Tool results become user messages with tool_result content
        const toolResult: Anthropic.ToolResultBlockParam = {
          type: 'tool_result',
          tool_use_id: msg.tool_call_id || '',
          content: msg.content || '',
        };

        // Only cache if this is one of the last 2 messages
        if (shouldCacheThisMessage) {
          (
            toolResult as Anthropic.ToolResultBlockParam & { cache_control?: { type: 'ephemeral' } }
          ).cache_control = { type: 'ephemeral' };
        }

        formatted.push({
          role: 'user',
          content: [toolResult],
        });
        continue;
      }

      // Handle assistant messages with tool calls
      if (msg.role === 'assistant' && msg.tool_calls) {
        const content: Array<Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam> = [];

        // Add text content if present
        if (msg.content) {
          content.push({
            type: 'text',
            text: msg.content,
          });
        }

        // Add tool calls
        for (const tc of msg.tool_calls) {
          const toolUse: Anthropic.ToolUseBlockParam = {
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments),
          };
          content.push(toolUse);
        }

        // Only cache the last content block if this is one of the last 2 messages
        if (shouldCacheThisMessage && content.length > 0) {
          const lastBlock = content[content.length - 1];
          // Only cache if it's a text block (not tool_use)
          if (lastBlock.type === 'text') {
            (
              lastBlock as Anthropic.TextBlockParam & { cache_control?: { type: 'ephemeral' } }
            ).cache_control = { type: 'ephemeral' };
          }
        }

        formatted.push({
          role: 'assistant',
          content,
        });
        continue;
      }

      // Handle regular text messages (user, assistant without tools)
      if (msg.role === 'user' || msg.role === 'assistant') {
        if (typeof msg.content === 'string' && msg.content) {
          // Create content as array with single text block
          const textBlock: Anthropic.TextBlockParam = {
            type: 'text',
            text: msg.content,
          };

          // Only cache if this is one of the last 2 messages
          if (shouldCacheThisMessage) {
            (
              textBlock as Anthropic.TextBlockParam & { cache_control?: { type: 'ephemeral' } }
            ).cache_control = { type: 'ephemeral' };
          }

          formatted.push({
            role: msg.role,
            content: [textBlock],
          });
        } else if (msg.content) {
          // If content is already structured, just wrap it
          formatted.push({
            role: msg.role,
            content: msg.content,
          });
        }
      }
    }

    return formatted;
  }

  private formatTools(tools: BaseTool[]): Anthropic.Tool[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object' as const,
        properties: tool.parameters.properties || {},
        required: tool.parameters.required || [],
      },
    }));
  }

  private formatResponse(response: Anthropic.Message): Message {
    // Extract text content
    const textContent = response.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .filter(Boolean)
      .join('');

    // Extract tool calls
    const toolCalls: ToolCall[] = response.content
      .filter((c) => c.type === 'tool_use')
      .map((c) => {
        const toolUse = c;
        return {
          id: toolUse.id,
          type: 'function' as const,
          function: {
            name: toolUse.name,
            arguments: JSON.stringify(toolUse.input),
          },
        };
      });

    if (toolCalls.length > 0) {
      return {
        role: 'assistant',
        content: textContent || undefined,
        tool_calls: toolCalls,
      };
    }

    return {
      role: 'assistant',
      content: textContent || '',
    };
  }

  private logCacheMetrics(usage: Anthropic.Message['usage']) {
    const metrics: CacheMetrics = {
      inputTokens: usage.input_tokens,
      cacheCreationTokens: usage.cache_creation_input_tokens || undefined,
      cacheReadTokens: usage.cache_read_input_tokens || undefined,
      outputTokens: usage.output_tokens,
    };

    if (metrics.cacheReadTokens || metrics.cacheCreationTokens) {
      const cacheEfficiency = metrics.cacheReadTokens
        ? (metrics.cacheReadTokens / (metrics.inputTokens || 1)) * 100
        : 0;

      const cacheMetricsContent = [
        '📊 Cache Metrics:',
        `  Input tokens: ${metrics.inputTokens}`,
        metrics.cacheCreationTokens
          ? `  Cache creation: ${metrics.cacheCreationTokens} tokens`
          : '',
        metrics.cacheReadTokens ? `  Cache read: ${metrics.cacheReadTokens} tokens` : '',
        metrics.cacheReadTokens ? `  Cache efficiency: ${cacheEfficiency.toFixed(1)}%` : '',
        `  Output tokens: ${metrics.outputTokens}`,
      ]
        .filter(Boolean)
        .join('\n');

      if (this.logger) {
        this.logger.logSystemMessage(cacheMetricsContent);
      }
    }
  }

  getModelName(): string {
    return this.modelName;
  }

  supportsStreaming(): boolean {
    return false; // POC: Keep it simple
  }

  getLastUsageMetrics(): UsageMetrics | null {
    return this.lastUsageMetrics;
  }

  /**
   * Count total cached blocks in the request
   */
  private countCacheBlocks(
    formattedSystem: string | Array<Anthropic.TextBlockParam>,
    formattedMessages: Anthropic.MessageParam[]
  ): number {
    let count = 0;

    // Count system cache blocks
    if (Array.isArray(formattedSystem)) {
      count += formattedSystem.filter(
        (block) => 'cache_control' in block && block.cache_control?.type === 'ephemeral'
      ).length;
    }

    // Count message cache blocks
    for (const msg of formattedMessages) {
      if (Array.isArray(msg.content)) {
        count += msg.content.filter(
          (block) =>
            block.type === 'text' &&
            'cache_control' in block &&
            block.cache_control?.type === 'ephemeral'
        ).length;
      }
    }

    return count;
  }

  /**
   * Record detailed cache metrics
   */
  private recordDetailedMetrics(
    usage: Anthropic.Message['usage'],
    totalCachedBlocks: number,
    responseTimeMs: number
  ): void {
    this.metricsCollector.recordMetrics(
      {
        modelName: this.modelName,
        inputTokens: usage.input_tokens || 0,
        outputTokens: usage.output_tokens || 0,
        cacheCreationTokens: usage.cache_creation_input_tokens || 0,
        cacheReadTokens: usage.cache_read_input_tokens || 0,
        totalCachedBlocks: totalCachedBlocks,
        newCacheBlocks: usage.cache_creation_input_tokens ? 1 : 0, // Simplified
        responseTimeMs: responseTimeMs,
      },
      this.pricing
    );
  }
}
