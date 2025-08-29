import { AnthropicProvider } from './anthropic-provider';
import { Message } from '../types';
import { generateText } from 'ai';

// Mock the AI SDK
jest.mock('ai');
jest.mock('@ai-sdk/anthropic', () => ({
  anthropic: jest.fn((model: string) => ({ model }))
}));

describe('AnthropicProvider Caching Strategy', () => {
  let provider: AnthropicProvider;
  let mockGenerateText: jest.MockedFunction<typeof generateText>;
  
  beforeEach(() => {
    // Set required env var
    process.env.ANTHROPIC_API_KEY = 'test-key';
    
    provider = new AnthropicProvider('claude-3-5-haiku-20241022');
    mockGenerateText = generateText as jest.MockedFunction<typeof generateText>;
    
    // Spy on console.log to capture cache metrics
    jest.spyOn(console, 'log').mockImplementation();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
  });

  describe('Claude Code Caching Pattern', () => {
    it('should cache all messages except the last one', async () => {
      const messages: Message[] = [
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'First user message' },
        { role: 'assistant', content: 'First response' },
        { role: 'user', content: 'Second user message - should NOT be cached' }
      ];

      // Mock response with cache metrics
      mockGenerateText.mockResolvedValueOnce({
        text: 'Test response',
        usage: {
          promptTokens: 1000,
          cacheCreationInputTokens: 800,  // First 3 messages cached
          cacheReadInputTokens: 0,
          completionTokens: 50
        },
        toolCalls: []
      } as any);

      await provider.complete(messages);

      // Verify the formatting of messages
      const callArgs = mockGenerateText.mock.calls[0][0];
      const formattedMessages = callArgs.messages as any[];

      // System message should be cached with providerOptions
      expect(formattedMessages[0].role).toBe('system');
      expect(formattedMessages[0].content).toBe('You are a helpful assistant');
      expect(formattedMessages[0]).toHaveProperty('providerOptions.anthropic.cacheControl');
      
      // User and assistant messages should have cache control
      expect(formattedMessages[1].content[0]).toHaveProperty('providerOptions.anthropic.cacheControl');
      expect(formattedMessages[2].content[0]).toHaveProperty('providerOptions.anthropic.cacheControl');
      
      // Last message should NOT have cache control
      expect(formattedMessages[3].content).toBe('Second user message - should NOT be cached');
    });

    it('should handle parent-child delegation with cache inheritance', async () => {
      // Simulate parent conversation
      const parentMessages: Message[] = [
        { role: 'system', content: 'Parent agent system prompt' },
        { role: 'user', content: 'Read file X' },
        { role: 'assistant', content: 'File content: Large document...' },
        { role: 'tool', tool_call_id: 'call_1', content: 'File read successfully' }
      ];

      // First call - parent agent creates cache
      mockGenerateText.mockResolvedValueOnce({
        text: 'Delegating to child',
        usage: {
          promptTokens: 5000,
          cacheCreationInputTokens: 4500,  // Creating cache
          cacheReadInputTokens: 0,
          completionTokens: 100
        },
        toolCalls: []
      } as any);

      await provider.complete(parentMessages);

      // Verify cache creation metrics logged
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Cache creation: 4500 tokens'));

      // Child inherits parent's messages plus new prompt
      const childMessages: Message[] = [
        ...parentMessages,
        { role: 'system', content: 'Child agent system prompt' },
        { role: 'user', content: 'Summarize the file' }  // New prompt
      ];

      // Second call - child reuses cache
      mockGenerateText.mockResolvedValueOnce({
        text: 'Summary of file',
        usage: {
          promptTokens: 5200,
          cacheCreationInputTokens: 100,   // Only new system prompt cached
          cacheReadInputTokens: 4500,      // Reusing parent's cache!
          completionTokens: 80
        },
        toolCalls: []
      } as any);

      await provider.complete(childMessages);

      // Verify cache hit metrics
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Cache read: 4500 tokens'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Cache efficiency: 86.5%'));
    });

    it('should apply correct cache control format for different message types', async () => {
      const messages: Message[] = [
        { role: 'system', content: 'System message' },
        { role: 'user', content: 'User message' },
        { role: 'assistant', content: 'Assistant message', tool_calls: [
          { id: 'call_1', type: 'function', function: { name: 'read', arguments: '{}' } }
        ]},
        { role: 'tool', tool_call_id: 'call_1', content: 'Tool result' },
        { role: 'user', content: 'Final prompt' }  // Should NOT be cached
      ];

      mockGenerateText.mockResolvedValueOnce({
        text: 'Response',
        usage: { promptTokens: 1000, completionTokens: 50 }
      } as any);

      await provider.complete(messages);

      const formattedMessages = mockGenerateText.mock.calls[0][0].messages as any[];

      // Check system message with caching
      expect(formattedMessages[0]).toEqual({
        role: 'system',
        content: 'System message',
        providerOptions: {
          anthropic: { cacheControl: { type: 'ephemeral' } }
        }
      });

      // Check tool result caching
      expect(formattedMessages[3]).toEqual({
        role: 'tool',
        content: [{
          type: 'tool-result',
          toolCallId: 'call_1',
          result: 'Tool result',
          providerOptions: {
            anthropic: { cacheControl: { type: 'ephemeral' } }
          }
        }]
      });

      // Check final user message is NOT cached
      expect(formattedMessages[4]).toEqual({
        role: 'user',
        content: 'Final prompt'
      });
    });

    it('should calculate cost savings correctly', async () => {
      const messages: Message[] = [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'Query' }
      ];

      // Simulate high cache hit scenario
      mockGenerateText.mockResolvedValueOnce({
        text: 'Response',
        usage: {
          promptTokens: 10000,
          cacheReadInputTokens: 9000,  // 90% cached
          completionTokens: 100
        }
      } as any);

      await provider.complete(messages);

      // Verify cost calculation
      // Normal: 10,000 tokens * $1/1M = $0.01
      // Cached: 9,000 * $0.10/1M + 1,000 * $1/1M = $0.0009 + $0.001 = $0.0019
      // Savings: $0.01 - $0.0019 = $0.0081 (81% savings)
      
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Normal cost: $0.010000'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Actual cost: $0.001900'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Savings: $0.008100 (81.0%)'));
    });

    it('should validate rolling cache build-up pattern', async () => {
      // Simulate a conversation that builds up cache over time
      const conversation: Message[] = [
        { role: 'system', content: 'System prompt' }
      ];

      // First interaction
      conversation.push({ role: 'user', content: 'Question 1' });
      
      mockGenerateText.mockResolvedValueOnce({
        text: 'Answer 1',
        usage: {
          promptTokens: 200,
          cacheCreationInputTokens: 100,  // System prompt cached
          cacheReadInputTokens: 0,
          completionTokens: 50
        }
      } as any);

      await provider.complete([...conversation]);
      conversation.push({ role: 'assistant', content: 'Answer 1' });

      // Second interaction - previous messages cached
      conversation.push({ role: 'user', content: 'Question 2' });

      mockGenerateText.mockResolvedValueOnce({
        text: 'Answer 2',
        usage: {
          promptTokens: 400,
          cacheCreationInputTokens: 150,  // Previous Q&A cached
          cacheReadInputTokens: 100,      // System prompt reused
          completionTokens: 50
        }
      } as any);

      await provider.complete([...conversation]);
      conversation.push({ role: 'assistant', content: 'Answer 2' });

      // Third interaction - even more cache reuse
      conversation.push({ role: 'user', content: 'Question 3' });

      mockGenerateText.mockResolvedValueOnce({
        text: 'Answer 3',
        usage: {
          promptTokens: 600,
          cacheCreationInputTokens: 150,  // Latest Q&A cached
          cacheReadInputTokens: 400,      // All previous content reused!
          completionTokens: 50
        }
      } as any);

      await provider.complete([...conversation]);

      // Verify increasing cache efficiency
      const logs = (console.log as jest.Mock).mock.calls.map(call => call[0]);
      const efficiencyLogs = logs.filter(log => log?.includes('Cache efficiency'));
      
      // Each interaction should show increasing cache efficiency
      expect(efficiencyLogs[0]).toContain('25.0%');  // 100/400
      expect(efficiencyLogs[1]).toContain('66.7%');  // 400/600
    });
  });

  describe('Error Handling', () => {
    it('should throw error for non-Claude models', () => {
      delete process.env.ANTHROPIC_API_KEY;
      process.env.ANTHROPIC_API_KEY = 'test-key';
      
      expect(() => new AnthropicProvider('gpt-4')).toThrow(
        'AnthropicProvider only supports Claude models'
      );
    });

    it('should throw error when API key is missing', () => {
      delete process.env.ANTHROPIC_API_KEY;
      
      expect(() => new AnthropicProvider()).toThrow(
        'ANTHROPIC_API_KEY is required'
      );
    });
  });
});