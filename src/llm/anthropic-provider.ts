import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { Message, Tool, ToolCall } from '../types';
import { z } from 'zod';

export interface CacheMetrics {
  inputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  outputTokens: number;
  totalCost?: number;
}

export class AnthropicProvider {
  private model: any;
  private modelName: string;
  
  constructor(modelName: string = 'claude-3-5-haiku-20241022') {
    if (!modelName.startsWith('claude')) {
      throw new Error(`AnthropicProvider only supports Claude models, got: ${modelName}`);
    }
    
    this.modelName = modelName;
    this.model = anthropic(modelName);
    
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is required for AnthropicProvider');
    }
  }

  async complete(
    messages: Message[], 
    tools?: Tool[]
  ): Promise<Message> {
    // Format messages with Claude Code's caching strategy
    const formattedMessages = this.formatMessagesWithCaching(messages);
    
    // Convert tools to AI SDK format
    const formattedTools = tools ? this.formatTools(tools) : undefined;
    
    try {
      const result = await generateText({
        model: this.model,
        messages: formattedMessages,
        tools: formattedTools,
        toolChoice: tools && tools.length > 0 ? 'auto' : undefined,
        temperature: 0.7,
        maxRetries: 2,
      });
      
      // Log cache metrics
      if (result.usage) {
        this.logCacheMetrics(result.usage as any);
      }
      
      // Convert response back to our Message format
      return this.formatResponse(result);
    } catch (error) {
      console.error('AnthropicProvider error:', error);
      throw error;
    }
  }

  private formatMessagesWithCaching(messages: Message[]): any[] {
    const isLastMessage = (msgIndex: number) => msgIndex === messages.length - 1;
    
    return messages.map((msg, msgIndex) => {
      // Handle tool result messages
      if (msg.role === 'tool') {
        return {
          role: 'tool',
          content: [{
            type: 'tool-result',
            toolCallId: msg.tool_call_id,
            result: msg.content,
            // Cache tool results unless it's the very last message
            ...(!isLastMessage(msgIndex) ? {
              providerOptions: {
                anthropic: { cacheControl: { type: 'ephemeral' } }
              }
            } : {})
          }]
        };
      }
      
      // Handle assistant messages with tool calls
      if (msg.role === 'assistant' && msg.tool_calls) {
        const formatted: any = {
          role: 'assistant',
          toolCalls: msg.tool_calls.map(tc => ({
            toolCallId: tc.id,
            toolName: tc.function.name,
            args: JSON.parse(tc.function.arguments)
          }))
        };
        
        // If there's content, format it with caching
        if (msg.content) {
          formatted.content = [{
            type: 'text',
            text: msg.content,
            // Cache assistant responses unless it's the very last message
            ...(!isLastMessage(msgIndex) ? {
              providerOptions: {
                anthropic: { cacheControl: { type: 'ephemeral' } }
              }
            } : {})
          }];
        }
        
        return formatted;
      }
      
      // Handle regular text messages (system, user, assistant without tools)
      // Special handling for the last user message (the new prompt)
      if (msg.role === 'user' && isLastMessage(msgIndex)) {
        // The final user prompt should NOT be cached
        return {
          role: msg.role,
          content: msg.content || ''
        };
      }
      
      // All other messages get their content cached
      // System messages can also be cached with providerOptions
      if (msg.role === 'system') {
        // Cache system prompts unless it's the last message
        if (!isLastMessage(msgIndex)) {
          return {
            role: msg.role,
            content: msg.content || '',
            providerOptions: {
              anthropic: { cacheControl: { type: 'ephemeral' } }
            }
          };
        }
        // Last system message (unlikely but handle it)
        return {
          role: msg.role,
          content: msg.content || ''
        };
      }
      
      // For user/assistant messages, use content blocks with caching
      return {
        role: msg.role,
        content: [{
          type: 'text',
          text: msg.content || '',
          // Claude Code strategy: Cache the content block
          // This creates a rolling cache where each message's final state is cached
          providerOptions: {
            anthropic: { cacheControl: { type: 'ephemeral' } }
          }
        }]
      };
    });
  }

  private formatTools(tools: Tool[]): Record<string, any> {
    const formattedTools: Record<string, any> = {};
    
    for (const tool of tools) {
      // Convert our tool format to AI SDK format
      const parameters = z.object(
        Object.entries(tool.parameters.properties).reduce((acc, [key, value]: [string, any]) => {
          // Convert JSON schema to Zod schema (simplified)
          if (value.type === 'string') {
            acc[key] = z.string().describe(value.description || '');
          } else if (value.type === 'number') {
            acc[key] = z.number().describe(value.description || '');
          } else if (value.type === 'boolean') {
            acc[key] = z.boolean().describe(value.description || '');
          } else if (value.type === 'array') {
            acc[key] = z.array(z.any()).describe(value.description || '');
          } else {
            acc[key] = z.any().describe(value.description || '');
          }
          
          // Make optional if not required
          if (!tool.parameters.required?.includes(key)) {
            acc[key] = acc[key].optional();
          }
          
          return acc;
        }, {} as Record<string, any>)
      );
      
      formattedTools[tool.name] = {
        description: tool.description,
        parameters,
        execute: async (args: any) => {
          // The actual execution will be handled by our executor
          // This is just a placeholder for the AI SDK
          return args;
        }
      };
    }
    
    return formattedTools;
  }

  private formatResponse(result: any): Message {
    // Check if there are tool calls
    if (result.toolCalls && result.toolCalls.length > 0) {
      const toolCalls: ToolCall[] = result.toolCalls.map((tc: any) => ({
        id: tc.toolCallId || `call_${Date.now()}_${Math.random()}`,
        type: 'function' as const,
        function: {
          name: tc.toolName,
          arguments: JSON.stringify(tc.args)
        }
      }));
      
      return {
        role: 'assistant',
        content: result.text || undefined,
        tool_calls: toolCalls
      };
    }
    
    // Regular text response
    return {
      role: 'assistant',
      content: result.text || ''
    };
  }

  private logCacheMetrics(usage: any) {
    const metrics: CacheMetrics = {
      inputTokens: usage.promptTokens || 0,
      cacheCreationTokens: usage.cacheCreationInputTokens,
      cacheReadTokens: usage.cacheReadInputTokens,
      outputTokens: usage.completionTokens || 0
    };
    
    if (metrics.cacheReadTokens || metrics.cacheCreationTokens) {
      const cacheEfficiency = metrics.cacheReadTokens 
        ? (metrics.cacheReadTokens / (metrics.inputTokens || 1)) * 100
        : 0;
      
      console.log('\n📊 Cache Metrics:');
      console.log(`  Input tokens: ${metrics.inputTokens}`);
      if (metrics.cacheCreationTokens) {
        console.log(`  Cache creation: ${metrics.cacheCreationTokens} tokens`);
      }
      if (metrics.cacheReadTokens) {
        console.log(`  Cache read: ${metrics.cacheReadTokens} tokens`);
        console.log(`  Cache efficiency: ${cacheEfficiency.toFixed(1)}%`);
      }
      console.log(`  Output tokens: ${metrics.outputTokens}`);
      
      // Calculate cost savings (using Anthropic's pricing)
      // Claude 3.5 Haiku pricing (as of late 2024)
      const INPUT_COST_PER_1M = 1.00;  // $1 per 1M input tokens
      const CACHED_COST_PER_1M = 0.10; // $0.10 per 1M cached tokens (90% discount)
      const OUTPUT_COST_PER_1M = 5.00; // $5 per 1M output tokens
      
      if (metrics.cacheReadTokens) {
        const normalInputCost = (metrics.inputTokens / 1_000_000) * INPUT_COST_PER_1M;
        const cachedInputCost = (metrics.cacheReadTokens / 1_000_000) * CACHED_COST_PER_1M;
        const uncachedInputCost = ((metrics.inputTokens - metrics.cacheReadTokens) / 1_000_000) * INPUT_COST_PER_1M;
        const actualInputCost = cachedInputCost + uncachedInputCost;
        const savings = normalInputCost - actualInputCost;
        const savingsPercent = (savings / normalInputCost) * 100;
        
        console.log(`  💰 Cost Analysis:`);
        console.log(`     Normal cost: $${normalInputCost.toFixed(6)}`);
        console.log(`     Actual cost: $${actualInputCost.toFixed(6)}`);
        console.log(`     Savings: $${savings.toFixed(6)} (${savingsPercent.toFixed(1)}%)`);
      }
    }
  }
  
  getModelName(): string {
    return this.modelName;
  }
}