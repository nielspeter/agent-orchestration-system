import { vi } from 'vitest';
import type { Tool, ToolInput, ToolOutput } from '@/tools/types';
import type { LLMProvider, ConversationMessage } from '@/llm/types';

export function createMockProvider(): LLMProvider {
  return {
    complete: vi.fn().mockResolvedValue({
      role: 'assistant',
      content: [{ type: 'text', text: 'Mock response' }]
    } as ConversationMessage)
  };
}

export function createMockTool(name: string, safe = true): Tool {
  return {
    name,
    description: `Mock ${name} tool`,
    parameters: { 
      type: 'object', 
      properties: {
        content: { type: 'string' }
      }, 
      required: ['content'] 
    },
    execute: vi.fn().mockResolvedValue({ 
      content: [{ type: 'text', text: 'success' }] 
    } as ToolOutput),
    isConcurrencySafe: () => safe
  };
}

export function createMockToolWithDelay(name: string, delay: number, safe = true): Tool {
  return {
    name,
    description: `Mock ${name} tool with delay`,
    parameters: { 
      type: 'object', 
      properties: {
        content: { type: 'string' }
      }, 
      required: ['content'] 
    },
    execute: vi.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, delay));
      return { content: [{ type: 'text', text: 'success' }] } as ToolOutput;
    }),
    isConcurrencySafe: () => safe
  };
}

export function createMockToolWithError(name: string, error: Error): Tool {
  return {
    name,
    description: `Mock ${name} tool that errors`,
    parameters: { 
      type: 'object', 
      properties: {
        content: { type: 'string' }
      }, 
      required: ['content'] 
    },
    execute: vi.fn().mockRejectedValue(error),
    isConcurrencySafe: () => true
  };
}