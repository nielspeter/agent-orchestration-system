import Anthropic from '@anthropic-ai/sdk';
import { BaseTool, Message, ToolCall } from '@/base-types';
import { AgentLogger } from '@/logging';
import { LLMMetricsCollector, ModelPricing } from '@/metrics/llm-metrics-collector';
import { ILLMProvider, StructuredOutputConfig, UsageMetrics } from './llm-provider.interface';
import { logThinkingMetrics, ThinkingContentBlock } from './thinking-utils';

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
  private readonly metricsCollector: LLMMetricsCollector;
  private readonly pricing?: ModelPricing;
  private readonly maxOutputTokens: number;
  private readonly temperature: number;
  private readonly topP: number;
  private lastUsageMetrics: UsageMetrics | null = null;
  private lastStopReason: string | null = null;

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
    this.metricsCollector = new LLMMetricsCollector(logger);

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is required for AnthropicProvider');
    }

    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async complete(
    messages: Message[],
    tools?: BaseTool[],
    config?: StructuredOutputConfig
  ): Promise<Message> {
    const startTime = Date.now();

    // Separate system messages from conversation messages
    const systemMessages = messages.filter((m) => m.role === 'system');
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    // Format system messages with caching strategy
    const formattedSystem = this.formatSystemMessages(systemMessages);

    // Format conversation messages with caching strategy
    const formattedMessages = this.formatMessagesWithCaching(conversationMessages);

    // Convert tools to Anthropic format
    const formattedTools = tools ? this.formatTools(tools) : undefined;

    // Count cache blocks for metrics
    const totalCachedBlocks = this.countCacheBlocks(formattedSystem, formattedMessages);

    try {
      // When thinking is enabled, Claude requires temperature=1 (or omit it)
      // See: https://docs.claude.com/en/docs/build-with-claude/extended-thinking#important-considerations-when-using-extended-thinking
      const thinkingEnabled = config?.thinking?.enabled;

      // Create the request params with proper typing
      // Claude Sonnet 4.5 doesn't allow both temperature AND top_p, use only temperature
      const params: Anthropic.MessageCreateParams = {
        model: this.modelName,
        max_tokens: this.maxOutputTokens,
        temperature: thinkingEnabled ? 1 : this.temperature,
        // top_p: thinkingEnabled ? undefined : this.topP, // Disabled - Sonnet 4.5 can't use both
        system: formattedSystem,
        messages: formattedMessages,
        tools: formattedTools,
      };

      // Add thinking configuration if enabled
      if (thinkingEnabled && config?.thinking) {
        Object.assign(params, {
          thinking: {
            type: 'enabled',
            budget_tokens: config.thinking.budgetTokens,
          },
        });
      }

      // Build beta headers
      const betaHeaders = ['prompt-caching-2024-07-31'];
      if (thinkingEnabled) {
        // Claude 4 models use interleaved-thinking (not extended-thinking)
        betaHeaders.push('interleaved-thinking-2025-05-14');
      }

      // Add headers separately to enable caching and thinking
      // Use streaming for thinking-enabled requests to avoid 10-minute timeout
      let response: Anthropic.Message;

      if (thinkingEnabled) {
        // Use streaming for thinking to avoid timeout
        const stream = await this.client.messages.stream(params, {
          headers: {
            'anthropic-beta': betaHeaders.join(','),
          },
        });

        // Wait for the stream to complete and get final message
        response = await stream.finalMessage();
      } else {
        // Use regular non-streaming for non-thinking requests
        response = await this.client.messages.create(params, {
          headers: {
            'anthropic-beta': betaHeaders.join(','),
          },
        });
      }

      // Record detailed cache metrics
      if (response.usage) {
        const responseTime = Date.now() - startTime;
        this.recordDetailedMetrics(response.usage, totalCachedBlocks, responseTime);

        // Store for interface compliance
        const usageWithThinking = response.usage as Anthropic.Usage & { thinking_tokens?: number };
        this.lastUsageMetrics = {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
          promptCacheHitTokens: response.usage.cache_read_input_tokens || undefined,
          promptCacheMissTokens: response.usage.cache_creation_input_tokens || undefined,
          thinkingTokens: usageWithThinking.thinking_tokens || undefined,
        };

        // Log traditional metrics and thinking metrics
        if (this.logger) {
          this.logCacheMetrics(response.usage);

          // Extract and log thinking blocks regardless of thinking_tokens field
          // (interleaved thinking may not report thinking_tokens in usage)
          const thinkingBlocks = this.extractThinkingBlocks(response.content);

          if (thinkingBlocks.length > 0) {
            // Use thinking_tokens if available, otherwise estimate from blocks
            const thinkingTokenCount = usageWithThinking.thinking_tokens || 0;
            logThinkingMetrics(this.logger, thinkingTokenCount, thinkingBlocks);
          }
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
    // Check if caching is enabled via environment variable
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

    // Strategy: Cache the system prompt as a single block
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
      // Strategy: Only cache the LAST 2 messages to stay within 4 block limit
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

      // Handle assistant messages
      if (msg.role === 'assistant') {
        // If raw content blocks are present (e.g., from thinking), use them directly
        if (msg.raw_content && Array.isArray(msg.raw_content)) {
          // Use raw content blocks as-is to preserve thinking blocks
          formatted.push({
            role: 'assistant',
            content: msg.raw_content as Anthropic.ContentBlock[],
          });
          continue;
        }

        // Otherwise, reconstruct content from tool calls and text
        if (msg.tool_calls) {
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
    // Extract text content (excluding thinking)
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

    // Store stop_reason for metadata
    this.lastStopReason = response.stop_reason;

    // Check if response contains thinking blocks
    const hasThinkingBlocks = response.content.some(
      (c) => c.type === 'thinking' || c.type === 'redacted_thinking'
    );

    // Preserve raw content blocks if thinking is present
    // This ensures thinking blocks are included when the message is sent back to the API
    const message: Message = {
      role: 'assistant',
      content: textContent || (toolCalls.length > 0 ? undefined : ''),
    };

    if (hasThinkingBlocks) {
      message.raw_content = response.content;
    }

    if (toolCalls.length > 0) {
      message.tool_calls = toolCalls;
    }

    return message;
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

  /**
   * Extract thinking content blocks from Anthropic response
   */
  private extractThinkingBlocks(content: Anthropic.ContentBlock[]): ThinkingContentBlock[] {
    return content
      .filter((c) => c.type === 'thinking' || c.type === 'redacted_thinking')
      .map((block) => {
        if (block.type === 'thinking' && 'thinking' in block) {
          return {
            type: 'thinking' as const,
            content: (block as { type: 'thinking'; thinking: string }).thinking,
          };
        }
        return { type: 'redacted_thinking' as const };
      });
  }

  getModelName(): string {
    return this.modelName;
  }

  getProviderName(): string {
    return 'anthropic';
  }

  supportsStreaming(): boolean {
    return false; // POC: Keep it simple
  }

  getLastStopReason(): string | null {
    return this.lastStopReason;
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
