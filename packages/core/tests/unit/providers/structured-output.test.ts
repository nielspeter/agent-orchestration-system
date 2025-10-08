import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Message } from '@/base-types';
import { StructuredOutputConfig } from '@/providers/llm-provider.interface';

// Mock OpenAI at the top level for hoisting
vi.mock('openai');

// Import after mock declaration
import { OpenAICompatibleProvider } from '@/providers/openai-compatible-provider';
import OpenAI from 'openai';

// Create the mock implementation
const mockCreate = vi.fn();

describe('Structured Output Support', () => {
  let provider: OpenAICompatibleProvider;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup the mock implementation
    vi.mocked(OpenAI).mockImplementation(
      () =>
        ({
          chat: {
            completions: {
              create: mockCreate,
            },
          },
        }) as any
    );

    const config = {
      baseURL: 'https://api.openai.com/v1',
      apiKey: 'test-key',
    };

    provider = new OpenAICompatibleProvider('gpt-4o', config);

    // Set up default mock response
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: '{"result": "test"}',
            role: 'assistant',
          },
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
    });
  });

  describe('JSON output mode', () => {
    test('passes response_format for json mode', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Return a JSON object' }];

      const config: StructuredOutputConfig = {
        response_format: 'json',
      };

      await provider.complete(messages, undefined, config);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          messages: expect.any(Array),
          response_format: { type: 'json_object' },
        })
      );
    });

    test('does not pass response_format for text mode', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Return text' }];

      const config: StructuredOutputConfig = {
        response_format: 'text',
      };

      await provider.complete(messages, undefined, config);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          messages: expect.any(Array),
        })
      );

      // Verify response_format is NOT in the call
      const callArg = mockCreate.mock.calls[0][0];
      expect(callArg).not.toHaveProperty('response_format');
    });

    test('handles missing config gracefully', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Regular message' }];

      await provider.complete(messages);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          messages: expect.any(Array),
        })
      );

      // Verify response_format is NOT in the call
      const callArg = mockCreate.mock.calls[0][0];
      expect(callArg).not.toHaveProperty('response_format');
    });
  });

  describe('JSON Schema mode', () => {
    test('passes json_schema configuration', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Return structured data' }];

      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name', 'age'],
      };

      const config: StructuredOutputConfig = {
        response_format: 'json_schema',
        json_schema: schema,
      };

      await provider.complete(messages, undefined, config);

      // Since we use Object.assign, we need to check the actual call
      const callArg = mockCreate.mock.calls[0][0];

      expect(callArg).toHaveProperty('response_format');
      expect(callArg.response_format).toEqual({
        type: 'json_schema',
        json_schema: {
          name: 'response',
          strict: true,
          schema: schema,
        },
      });
    });

    test('ignores json_schema without json_schema response_format', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Return JSON' }];

      const schema = {
        type: 'object',
        properties: {
          result: { type: 'string' },
        },
      };

      const config: StructuredOutputConfig = {
        response_format: 'json',
        json_schema: schema, // This should be ignored
      };

      await provider.complete(messages, undefined, config);

      const callArg = mockCreate.mock.calls[0][0];

      // Should only have simple JSON mode
      expect(callArg.response_format).toEqual({ type: 'json_object' });
      expect(callArg.response_format).not.toHaveProperty('json_schema');
    });

    test('requires json_schema when using json_schema format', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Return structured data' }];

      const config: StructuredOutputConfig = {
        response_format: 'json_schema',
        // Missing json_schema
      };

      await provider.complete(messages, undefined, config);

      const callArg = mockCreate.mock.calls[0][0];

      // Should not add json_schema response format without schema
      expect(callArg).not.toHaveProperty('response_format');
    });
  });

  describe('Backward compatibility', () => {
    test('maintains compatibility with tools parameter', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Use a tool' }];

      const tools = [
        {
          name: 'test_tool',
          description: 'A test tool',
          parameters: {
            type: 'object' as const,
            properties: {
              param: {
                type: 'string',
                description: 'Test parameter',
              },
            },
            required: ['param'],
          },
          execute: vi.fn(),
          isConcurrencySafe: () => true,
        },
      ];

      const config: StructuredOutputConfig = {
        response_format: 'json',
      };

      await provider.complete(messages, tools, config);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          messages: expect.any(Array),
          tools: expect.arrayContaining([
            expect.objectContaining({
              type: 'function',
              function: expect.objectContaining({
                name: 'test_tool',
              }),
            }),
          ]),
          response_format: { type: 'json_object' },
        })
      );
    });

    test('works with temperature and top_p settings', async () => {
      // Need to re-setup the mock for this test since we're creating a new provider
      vi.mocked(OpenAI).mockImplementation(
        () =>
          ({
            chat: {
              completions: {
                create: mockCreate,
              },
            },
          }) as any
      );

      const config = {
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        temperature: 0.3,
        topP: 0.8,
      };

      const customProvider = new OpenAICompatibleProvider('gpt-4o', config);

      const messages: Message[] = [{ role: 'user', content: 'Test message' }];

      const structuredConfig: StructuredOutputConfig = {
        response_format: 'json',
      };

      await customProvider.complete(messages, undefined, structuredConfig);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.3,
          top_p: 0.8,
          response_format: { type: 'json_object' },
        })
      );
    });
  });

  describe('Usage metrics', () => {
    test('tracks usage metrics with structured output', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Return JSON' }];

      const config: StructuredOutputConfig = {
        response_format: 'json',
      };

      await provider.complete(messages, undefined, config);

      const metrics = provider.getLastUsageMetrics();

      expect(metrics).toEqual({
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
        promptCacheHitTokens: undefined,
        promptCacheMissTokens: undefined,
      });
    });
  });
});
