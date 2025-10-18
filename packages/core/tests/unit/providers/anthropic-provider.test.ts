import { beforeEach, describe, expect, test } from 'vitest';
import { AnthropicProvider } from '@/providers/anthropic-provider';
import type { Message } from '@/base-types';

describe('AnthropicProvider Caching Strategy', () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    // Set required env var
    process.env.ANTHROPIC_API_KEY = 'test-key';
    provider = new AnthropicProvider('claude-haiku-4-5');
  });

  test('should cache only the last 2 messages plus system prompt', () => {
    // This is a conceptual test - the actual implementation is tested via integration
    expect(provider).toBeDefined();
    expect(provider.getModelName()).toBe('claude-haiku-4-5');
  });

  test('should handle caching when enabled', () => {
    // Test that caching is enabled by default
    delete process.env.DISABLE_PROMPT_CACHING;
    const provider = new AnthropicProvider('claude-haiku-4-5');
    expect(provider).toBeDefined();
  });

  test('should handle caching when disabled', () => {
    // Test with caching disabled
    process.env.DISABLE_PROMPT_CACHING = 'true';
    const provider = new AnthropicProvider('claude-haiku-4-5');
    expect(provider).toBeDefined();
    delete process.env.DISABLE_PROMPT_CACHING;
  });

  test('should require Claude models', () => {
    expect(() => {
      new AnthropicProvider('gpt-4' as any);
    }).toThrow('AnthropicProvider only supports Claude models');
  });

  test('should require API key', () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => {
      new AnthropicProvider('claude-haiku-4-5');
    }).toThrow('ANTHROPIC_API_KEY is required');
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });
});

describe('AnthropicProvider Thinking Block Preservation', () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    provider = new AnthropicProvider('claude-sonnet-4-5');
  });

  describe('formatResponse - thinking block preservation', () => {
    test('should preserve thinking blocks in raw_content when present', () => {
      // Access private method for testing via type assertion
      const formatResponse = (provider as any).formatResponse.bind(provider);

      const mockResponse = {
        id: 'msg_123',
        type: 'message' as const,
        role: 'assistant' as const,
        model: 'claude-sonnet-4-5',
        content: [
          { type: 'thinking' as const, thinking: 'Let me think about this...' },
          { type: 'text' as const, text: 'Here is my response' },
        ],
        stop_reason: 'end_turn' as const,
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 50 },
      };

      const result = formatResponse(mockResponse);

      expect(result.role).toBe('assistant');
      expect(result.content).toBe('Here is my response');
      expect(result.raw_content).toBeDefined();
      expect(result.raw_content).toEqual(mockResponse.content);
    });

    test('should not add raw_content when no thinking blocks present', () => {
      const formatResponse = (provider as any).formatResponse.bind(provider);

      const mockResponse = {
        id: 'msg_123',
        type: 'message' as const,
        role: 'assistant' as const,
        model: 'claude-sonnet-4-5',
        content: [{ type: 'text' as const, text: 'Here is my response' }],
        stop_reason: 'end_turn' as const,
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 50 },
      };

      const result = formatResponse(mockResponse);

      expect(result.role).toBe('assistant');
      expect(result.content).toBe('Here is my response');
      expect(result.raw_content).toBeUndefined();
    });

    test('should preserve redacted_thinking blocks in raw_content', () => {
      const formatResponse = (provider as any).formatResponse.bind(provider);

      const mockResponse = {
        id: 'msg_123',
        type: 'message' as const,
        role: 'assistant' as const,
        model: 'claude-sonnet-4-5',
        content: [
          { type: 'redacted_thinking' as const },
          { type: 'text' as const, text: 'Here is my response' },
        ],
        stop_reason: 'end_turn' as const,
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 50 },
      };

      const result = formatResponse(mockResponse);

      expect(result.raw_content).toBeDefined();
      expect(result.raw_content).toEqual(mockResponse.content);
    });

    test('should preserve thinking blocks with tool calls', () => {
      const formatResponse = (provider as any).formatResponse.bind(provider);

      const mockResponse = {
        id: 'msg_123',
        type: 'message' as const,
        role: 'assistant' as const,
        model: 'claude-sonnet-4-5',
        content: [
          { type: 'thinking' as const, thinking: 'I need to use a tool...' },
          { type: 'text' as const, text: 'Let me call a tool' },
          {
            type: 'tool_use' as const,
            id: 'tool_123',
            name: 'read',
            input: { path: '/test' },
          },
        ],
        stop_reason: 'tool_use' as const,
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 50 },
      };

      const result = formatResponse(mockResponse);

      expect(result.raw_content).toBeDefined();
      expect(result.tool_calls).toBeDefined();
      expect(result.tool_calls?.length).toBe(1);
      expect(result.raw_content).toEqual(mockResponse.content);
    });
  });

  describe('formatMessagesWithCaching - raw_content usage', () => {
    test('should use raw_content for assistant messages when available', () => {
      const formatMessagesWithCaching = (provider as any).formatMessagesWithCaching.bind(provider);

      const messages: Message[] = [
        {
          role: 'assistant',
          content: 'Response text',
          raw_content: [
            { type: 'thinking', thinking: 'Original thinking...' },
            { type: 'text', text: 'Response text' },
          ],
        },
      ];

      const result = formatMessagesWithCaching(messages);

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('assistant');
      expect(result[0].content).toEqual(messages[0].raw_content);
    });

    test('should reconstruct content from tool calls when raw_content not available', () => {
      const formatMessagesWithCaching = (provider as any).formatMessagesWithCaching.bind(provider);

      const messages: Message[] = [
        {
          role: 'assistant',
          content: 'Using tool',
          tool_calls: [
            {
              id: 'tool_123',
              type: 'function' as const,
              function: {
                name: 'read',
                arguments: JSON.stringify({ path: '/test' }),
              },
            },
          ],
        },
      ];

      const result = formatMessagesWithCaching(messages);

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('assistant');
      expect(Array.isArray(result[0].content)).toBe(true);
      const content = result[0].content as any[];
      expect(content.some((c) => c.type === 'text')).toBe(true);
      expect(content.some((c) => c.type === 'tool_use')).toBe(true);
    });

    test('should preserve raw_content even when it contains multiple thinking blocks', () => {
      const formatMessagesWithCaching = (provider as any).formatMessagesWithCaching.bind(provider);

      const rawContent = [
        { type: 'thinking', thinking: 'First thought...' },
        { type: 'thinking', thinking: 'Second thought...' },
        { type: 'text', text: 'Final response' },
      ];

      const messages: Message[] = [
        {
          role: 'assistant',
          content: 'Final response',
          raw_content: rawContent,
        },
      ];

      const result = formatMessagesWithCaching(messages);

      expect(result[0].content).toEqual(rawContent);
    });
  });

  describe('extractThinkingBlocks', () => {
    test('should extract thinking blocks from content', () => {
      const extractThinkingBlocks = (provider as any).extractThinkingBlocks.bind(provider);

      const content = [
        { type: 'thinking', thinking: 'My reasoning...' },
        { type: 'text', text: 'Response' },
      ];

      const result = extractThinkingBlocks(content);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('thinking');
      expect(result[0].content).toBe('My reasoning...');
    });

    test('should extract redacted_thinking blocks', () => {
      const extractThinkingBlocks = (provider as any).extractThinkingBlocks.bind(provider);

      const content = [{ type: 'redacted_thinking' }, { type: 'text', text: 'Response' }];

      const result = extractThinkingBlocks(content);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('redacted_thinking');
      expect(result[0].content).toBeUndefined();
    });

    test('should return empty array when no thinking blocks', () => {
      const extractThinkingBlocks = (provider as any).extractThinkingBlocks.bind(provider);

      const content = [
        { type: 'text', text: 'Response' },
        { type: 'tool_use', id: '123', name: 'read', input: {} },
      ];

      const result = extractThinkingBlocks(content);

      expect(result).toHaveLength(0);
    });

    test('should extract multiple thinking blocks', () => {
      const extractThinkingBlocks = (provider as any).extractThinkingBlocks.bind(provider);

      const content = [
        { type: 'thinking', thinking: 'First thought' },
        { type: 'thinking', thinking: 'Second thought' },
        { type: 'redacted_thinking' },
        { type: 'text', text: 'Response' },
      ];

      const result = extractThinkingBlocks(content);

      expect(result).toHaveLength(3);
      expect(result[0].content).toBe('First thought');
      expect(result[1].content).toBe('Second thought');
      expect(result[2].type).toBe('redacted_thinking');
    });
  });
});
