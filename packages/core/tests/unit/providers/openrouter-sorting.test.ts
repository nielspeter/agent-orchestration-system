import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OpenAICompatibleProvider,
  OpenRouterProviderConfig,
} from '@/providers/openai-compatible-provider';
import OpenAI from 'openai';

vi.mock('openai');

describe('OpenRouter Provider Sorting', () => {
  let mockClient: any;
  let mockCreate: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCreate = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'Test response',
          },
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
    });

    mockClient = {
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    };

    (OpenAI as any).mockImplementation(() => mockClient);
  });

  describe('Provider routing configuration', () => {
    it('should include sort parameter when configured with price', async () => {
      const config = {
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: 'test-key',
        providerRouting: {
          sort: 'price' as const,
        },
      };

      const provider = new OpenAICompatibleProvider('gpt-4', config);
      await provider.complete([{ role: 'user', content: 'test' }]);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: expect.objectContaining({
            sort: 'price',
          }),
        })
      );
    });

    it('should include sort parameter when configured with latency', async () => {
      const config = {
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: 'test-key',
        providerRouting: {
          sort: 'latency' as const,
        },
      };

      const provider = new OpenAICompatibleProvider('gpt-4', config);
      await provider.complete([{ role: 'user', content: 'test' }]);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: expect.objectContaining({
            sort: 'latency',
          }),
        })
      );
    });

    it('should include sort parameter when configured with throughput', async () => {
      const config = {
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: 'test-key',
        providerRouting: {
          sort: 'throughput' as const,
        },
      };

      const provider = new OpenAICompatibleProvider('gpt-4', config);
      await provider.complete([{ role: 'user', content: 'test' }]);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: expect.objectContaining({
            sort: 'throughput',
          }),
        })
      );
    });

    it('should include only parameter when configured', async () => {
      const config = {
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: 'test-key',
        providerRouting: {
          only: ['OpenAI', 'Anthropic'],
        },
      };

      const provider = new OpenAICompatibleProvider('gpt-4', config);
      await provider.complete([{ role: 'user', content: 'test' }]);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: expect.objectContaining({
            only: ['OpenAI', 'Anthropic'],
          }),
        })
      );
    });

    it('should include order parameter when configured', async () => {
      const config = {
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: 'test-key',
        providerRouting: {
          order: ['DeepInfra', 'Together', 'OpenAI'],
        },
      };

      const provider = new OpenAICompatibleProvider('gpt-4', config);
      await provider.complete([{ role: 'user', content: 'test' }]);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: expect.objectContaining({
            order: ['DeepInfra', 'Together', 'OpenAI'],
          }),
        })
      );
    });

    it('should include allow_fallbacks parameter when configured', async () => {
      const config = {
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: 'test-key',
        providerRouting: {
          only: ['OpenAI'],
          allowFallbacks: false,
        },
      };

      const provider = new OpenAICompatibleProvider('gpt-4', config);
      await provider.complete([{ role: 'user', content: 'test' }]);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: expect.objectContaining({
            only: ['OpenAI'],
            allow_fallbacks: false,
          }),
        })
      );
    });

    it('should include multiple routing parameters when configured', async () => {
      const config = {
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: 'test-key',
        providerRouting: {
          sort: 'price' as const,
          only: ['OpenAI', 'Anthropic'],
          allowFallbacks: true,
        },
      };

      const provider = new OpenAICompatibleProvider('gpt-4', config);
      await provider.complete([{ role: 'user', content: 'test' }]);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: expect.objectContaining({
            sort: 'price',
            only: ['OpenAI', 'Anthropic'],
            allow_fallbacks: true,
          }),
        })
      );
    });

    it('should not include provider parameter for non-OpenRouter URLs', async () => {
      const config = {
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        providerRouting: {
          sort: 'price' as const,
        },
      };

      const provider = new OpenAICompatibleProvider('gpt-4', config);
      await provider.complete([{ role: 'user', content: 'test' }]);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.not.objectContaining({
          provider: expect.anything(),
        })
      );
    });

    it('should not include provider parameter when routing is not configured', async () => {
      const config = {
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: 'test-key',
      };

      const provider = new OpenAICompatibleProvider('gpt-4', config);
      await provider.complete([{ role: 'user', content: 'test' }]);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.not.objectContaining({
          provider: expect.anything(),
        })
      );
    });
  });

  describe('TypeScript type validation', () => {
    it('should accept price as a valid sort option', () => {
      const routing: OpenRouterProviderConfig = {
        sort: 'price',
      };
      expect(routing.sort).toBe('price');
    });

    it('should accept latency as a valid sort option', () => {
      const routing: OpenRouterProviderConfig = {
        sort: 'latency',
      };
      expect(routing.sort).toBe('latency');
    });

    it('should accept throughput as a valid sort option', () => {
      const routing: OpenRouterProviderConfig = {
        sort: 'throughput',
      };
      expect(routing.sort).toBe('throughput');
    });
  });

  describe('Runtime validation', () => {
    it('should throw error for invalid sort option at construction time', () => {
      const config = {
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: 'test-key',
        providerRouting: {
          sort: 'invalid' as any,
        },
      };

      expect(() => new OpenAICompatibleProvider('gpt-4', config)).toThrow(
        "Invalid OpenRouter sort option: \"invalid\". Valid options are: 'price' (cheapest first), 'latency' (fastest first), 'throughput' (highest capacity first)"
      );
    });

    it('should accept missing sort option', () => {
      const config = {
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: 'test-key',
        providerRouting: {
          only: ['OpenAI'],
        },
      };

      expect(() => new OpenAICompatibleProvider('gpt-4', config)).not.toThrow();
    });

    it('should accept explicit undefined sort option', () => {
      const config = {
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: 'test-key',
        providerRouting: {
          sort: undefined,
        },
      };

      expect(() => new OpenAICompatibleProvider('gpt-4', config)).not.toThrow();
    });

    it('should accept missing providerRouting', () => {
      const config = {
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: 'test-key',
      };

      expect(() => new OpenAICompatibleProvider('gpt-4', config)).not.toThrow();
    });

    it('should accept empty providerRouting object', () => {
      const config = {
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: 'test-key',
        providerRouting: {},
      };

      expect(() => new OpenAICompatibleProvider('gpt-4', config)).not.toThrow();
    });

    it('should handle null sort option', () => {
      const config = {
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: 'test-key',
        providerRouting: {
          sort: null as any,
        },
      };

      expect(() => new OpenAICompatibleProvider('gpt-4', config)).toThrow(
        'Invalid OpenRouter sort option: "null"'
      );
    });

    it('should handle empty string sort option', () => {
      const config = {
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: 'test-key',
        providerRouting: {
          sort: '' as any,
        },
      };

      expect(() => new OpenAICompatibleProvider('gpt-4', config)).toThrow(
        'Invalid OpenRouter sort option: ""'
      );
    });

    it('should handle uppercase sort option', () => {
      const config = {
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: 'test-key',
        providerRouting: {
          sort: 'PRICE' as any,
        },
      };

      expect(() => new OpenAICompatibleProvider('gpt-4', config)).toThrow(
        'Invalid OpenRouter sort option: "PRICE"'
      );
    });

    it('should not validate sort for non-OpenRouter providers', () => {
      const config = {
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        providerRouting: {
          sort: 'invalid' as any,
        },
      };

      // Should NOT throw even with invalid sort because it's not OpenRouter
      expect(() => new OpenAICompatibleProvider('gpt-4', config)).not.toThrow();
    });
  });

  describe('Cache control for Anthropic models via OpenRouter', () => {
    it('should add cache_control for Anthropic models via OpenRouter', async () => {
      const config = {
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: 'test-key',
      };

      const provider = new OpenAICompatibleProvider('anthropic/claude-3-opus', config);
      await provider.complete([{ role: 'user', content: 'test message that should be cached' }]);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.arrayContaining([
                expect.objectContaining({
                  type: 'text',
                  text: 'test message that should be cached',
                  cache_control: { type: 'ephemeral' },
                }),
              ]),
            }),
          ]),
        })
      );
    });

    it('should NOT add cache_control for non-Anthropic models', async () => {
      const config = {
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: 'test-key',
      };

      const provider = new OpenAICompatibleProvider('gpt-4', config);
      await provider.complete([{ role: 'user', content: 'test message' }]);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: 'test message',
            }),
          ]),
        })
      );

      // Ensure no cache_control was added
      const callArg = mockCreate.mock.calls[0][0];
      expect(callArg.messages[0].content).toBe('test message');
      expect(callArg.messages[0].content).not.toEqual(expect.arrayContaining([expect.anything()]));
    });

    it('should NOT add cache_control for assistant messages', async () => {
      const config = {
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: 'test-key',
      };

      const provider = new OpenAICompatibleProvider('anthropic/claude-3-opus', config);
      await provider.complete([{ role: 'assistant', content: 'assistant response' }]);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'assistant',
              content: 'assistant response',
            }),
          ]),
        })
      );
    });

    it('should NOT add cache_control for non-OpenRouter providers', async () => {
      const config = {
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'test-key',
      };

      const provider = new OpenAICompatibleProvider('anthropic/claude-3-opus', config);
      await provider.complete([{ role: 'user', content: 'test message' }]);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: 'test message',
            }),
          ]),
        })
      );
    });

    it('should handle multi-turn conversations with cache control', async () => {
      const config = {
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: 'test-key',
      };

      const provider = new OpenAICompatibleProvider('anthropic/claude-3-opus', config);
      await provider.complete([
        { role: 'user', content: 'first message' },
        { role: 'assistant', content: 'first response' },
        { role: 'user', content: 'second message' },
      ]);

      const callArg = mockCreate.mock.calls[0][0];

      // First user message should have cache_control
      expect(callArg.messages[0]).toMatchObject({
        role: 'user',
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: 'first message',
            cache_control: { type: 'ephemeral' },
          }),
        ]),
      });

      // Assistant message should NOT have cache_control
      expect(callArg.messages[1]).toMatchObject({
        role: 'assistant',
        content: 'first response',
      });

      // Second user message should have cache_control
      expect(callArg.messages[2]).toMatchObject({
        role: 'user',
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: 'second message',
            cache_control: { type: 'ephemeral' },
          }),
        ]),
      });
    });

    it('should handle empty content gracefully', async () => {
      const config = {
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: 'test-key',
      };

      const provider = new OpenAICompatibleProvider('anthropic/claude-3-opus', config);
      await provider.complete([{ role: 'user', content: '' }]);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.arrayContaining([
                expect.objectContaining({
                  type: 'text',
                  text: '',
                  cache_control: { type: 'ephemeral' },
                }),
              ]),
            }),
          ]),
        })
      );
    });
  });

  describe('Cache token tracking', () => {
    it('should track cache hit/miss tokens from OpenRouter format', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Test response',
            },
          },
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
          prompt_tokens_details: {
            cached_tokens: 80,
          },
        },
      });

      const config = {
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: 'test-key',
      };

      const provider = new OpenAICompatibleProvider('gpt-4', config);
      await provider.complete([{ role: 'user', content: 'test' }]);

      const metrics = provider.getLastUsageMetrics();
      expect(metrics).toEqual({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        promptCacheHitTokens: 80,
        promptCacheMissTokens: 20, // 100 - 80
      });
    });

    it('should track cache tokens from Anthropic native format', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Test response',
            },
          },
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
          prompt_cache_hit_tokens: 75,
          prompt_cache_miss_tokens: 25,
        },
      });

      const config = {
        baseURL: 'https://api.anthropic.com/v1',
        apiKey: 'test-key',
      };

      const provider = new OpenAICompatibleProvider('claude-3-opus', config);
      await provider.complete([{ role: 'user', content: 'test' }]);

      const metrics = provider.getLastUsageMetrics();
      expect(metrics).toEqual({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        promptCacheHitTokens: 75,
        promptCacheMissTokens: 25,
      });
    });

    it('should handle missing cache metrics gracefully', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Test response',
            },
          },
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      });

      const config = {
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: 'test-key',
      };

      const provider = new OpenAICompatibleProvider('gpt-4', config);
      await provider.complete([{ role: 'user', content: 'test' }]);

      const metrics = provider.getLastUsageMetrics();
      expect(metrics).toEqual({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        promptCacheHitTokens: undefined,
        promptCacheMissTokens: undefined,
      });
    });
  });
});
