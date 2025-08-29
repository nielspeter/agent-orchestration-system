import { generateText, CoreTool } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { Message, Tool, ToolCall } from '../types';
import { z } from 'zod';

export interface AISDKProvider {
  complete(messages: Message[], tools?: Tool[], enableCache?: boolean): Promise<Message>;
}

export interface CacheMetrics {
  inputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  outputTokens: number;
  totalCost?: number;
}

export class UnifiedAIProvider implements AISDKProvider {
  private model: any;
  private modelName: string;
  private isAnthropic: boolean;
  
  constructor(modelName: string) {
    this.modelName = modelName;
    this.isAnthropic = modelName.startsWith('claude');
    
    // Select the appropriate provider based on model name
    if (this.isAnthropic) {
      this.model = anthropic(modelName);
    } else if (modelName.startsWith('gpt')) {
      this.model = openai(modelName);
    } else {
      throw new Error(`Unsupported model: ${modelName}`);
    }
  }

  async complete(messages: Message[], tools?: Tool[], enableCache: boolean = true): Promise<Message> {
    // Convert our Message format to AI SDK format
    const formattedMessages = this.formatMessages(messages, enableCache);
    
    // Convert tools to AI SDK format
    const formattedTools = tools ? this.formatTools(tools) : undefined;
    
    try {
      const result = await generateText({
        model: this.model,
        messages: formattedMessages,
        tools: formattedTools,
        toolChoice: tools && tools.length > 0 ? 'auto' : undefined,
        temperature: 0.7,
        maxTokens: 2000,
      });
      
      // Log cache metrics if available (Anthropic only)
      if (this.isAnthropic && result.usage) {
        this.logCacheMetrics(result.usage as any);
      }
      
      // Convert response back to our Message format
      return this.formatResponse(result);
    } catch (error) {
      console.error('AI SDK Provider error:', error);
      throw error;
    }
  }

  private formatMessages(messages: Message[], enableCache: boolean): any[] {
    return messages.map((msg, index) => {
      // For Anthropic, add cache control to system messages and conversation history
      if (this.isAnthropic && enableCache) {
        if (msg.role === 'system') {
          // Cache system prompts (agent definitions)
          return {
            role: msg.role,
            content: [{
              type: 'text',
              text: msg.content,
              experimental_providerMetadata: {
                anthropic: { 
                  cacheControl: { type: 'ephemeral' }
                }
              }
            }]
          };
        } else if (msg.role === 'user' && index < messages.length - 1) {
          // Cache conversation history (all but the last user message)
          return {
            role: msg.role,
            content: [{
              type: 'text',
              text: msg.content,
              experimental_providerMetadata: {
                anthropic: { 
                  cacheControl: { type: 'ephemeral' }
                }
              }
            }]
          };
        }
      }
      
      // Regular message formatting
      if (msg.role === 'tool') {
        return {
          role: 'tool',
          content: [{
            type: 'tool-result',
            toolCallId: msg.tool_call_id,
            result: msg.content
          }]
        };
      }
      
      return {
        role: msg.role,
        content: msg.content || ''
      };
    });
  }

  private formatTools(tools: Tool[]): Record<string, CoreTool> {
    const formattedTools: Record<string, CoreTool> = {};
    
    for (const tool of tools) {
      // Convert our tool format to AI SDK CoreTool format
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
        execute: async (args) => {
          // The actual execution will be handled by our executor
          // This is just a placeholder
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
      if (metrics.cacheReadTokens) {
        const normalCost = metrics.inputTokens * 0.003; // $3 per 1M tokens
        const cacheCost = metrics.cacheReadTokens * 0.0003; // 10% of normal cost
        const savings = ((normalCost - cacheCost) / normalCost) * 100;
        console.log(`  Cost savings: ${savings.toFixed(1)}%`);
      }
    }
  }
  
  getModelName(): string {
    return this.modelName;
  }
  
  isAnthropicModel(): boolean {
    return this.isAnthropic;
  }
}