import { Message, Tool } from '../types';
import OpenAI from 'openai';
import { ToolRegistry } from '../core/tool-registry';

export interface LLMProvider {
  complete(messages: Message[], tools?: Tool[]): Promise<Message>;
}

export class OpenAIProvider implements LLMProvider {
  private readonly client: OpenAI;
  private readonly toolRegistry: ToolRegistry;

  constructor(apiKey: string, toolRegistry: ToolRegistry) {
    // Configure for OpenRouter if using it
    const isOpenRouter = process.env.OPENAI_BASE_URL?.includes('openrouter');
    
    this.client = new OpenAI({ 
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL,
      defaultHeaders: isOpenRouter ? {
        'HTTP-Referer': 'https://localhost:3000', // Required for OpenRouter
        'X-Title': 'Agent Orchestration PoC' // Optional app name
      } : undefined
    });
    this.toolRegistry = toolRegistry;
  }

  async complete(messages: Message[], tools?: Tool[]): Promise<Message> {
    const formattedMessages = messages.map(msg => {
      if (msg.role === 'tool') {
        return {
          role: 'tool' as const,
          content: msg.content!,
          tool_call_id: msg.tool_call_id!
        };
      }
      return {
        role: msg.role,
        content: msg.content,
        tool_calls: msg.tool_calls
      };
    });

    const response = await this.client.chat.completions.create({
      model: process.env.MODEL || 'gpt-4',
      messages: formattedMessages as any,
      tools: tools ? this.toolRegistry.getToolDefinitions(tools) : undefined,
      temperature: 0.7
    });

    const choice = response.choices[0];
    
    if (choice.message.tool_calls) {
      return {
        role: 'assistant',
        content: choice.message.content || undefined,
        tool_calls: choice.message.tool_calls.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments
          }
        }))
      };
    }

    return {
      role: 'assistant',
      content: choice.message.content || ''
    };
  }
}