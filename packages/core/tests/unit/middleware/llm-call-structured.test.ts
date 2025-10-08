import { describe, expect, test, vi, beforeEach } from 'vitest';
import { createLLMCallMiddleware } from '@/middleware/llm-call.middleware';
import { MiddlewareContext } from '@/middleware/middleware-types';
import { Message } from '@/base-types';
import { ILLMProvider } from '@/providers/llm-provider.interface';

describe('LLM Call Middleware - Structured Output', () => {
  let mockProvider: ILLMProvider;
  let mockLogger: any;
  let mockNext: any;

  beforeEach(() => {
    mockProvider = {
      complete: vi.fn().mockResolvedValue({
        role: 'assistant',
        content: '{"result": "success"}',
      }),
      getModelName: vi.fn().mockReturnValue('test-model'),
      getProviderName: vi.fn().mockReturnValue('test'),
      supportsStreaming: vi.fn().mockReturnValue(false),
      getLastUsageMetrics: vi.fn().mockReturnValue(null),
      getLastStopReason: vi.fn().mockReturnValue('stop'),
    };

    mockLogger = {
      logAgentIteration: vi.fn(),
      logAssistantMessage: vi.fn(),
    };

    mockNext = vi.fn();
  });

  describe('Structured output configuration', () => {
    test('passes structured config to provider when agent has response_format', async () => {
      const middleware = createLLMCallMiddleware();

      const messages: Message[] = [{ role: 'user', content: 'Test message' }];

      const ctx: MiddlewareContext = {
        messages,
        tools: [],
        shouldContinue: true,
        iteration: 1,
        agentName: 'test-agent',
        provider: mockProvider,
        logger: mockLogger,
        agent: {
          name: 'test-agent',
          description: 'Test agent',
          tools: [],
          response_format: 'json',
          prompt: 'You are a test agent',
        } as any,
        prompt: 'Test prompt',
        executionContext: {} as any,
        modelName: 'test-model',
      } as MiddlewareContext;

      await middleware(ctx, mockNext);

      expect(mockProvider.complete).toHaveBeenCalledWith(messages, [], {
        response_format: 'json',
        json_schema: undefined,
      });

      expect(mockNext).toHaveBeenCalled();
    });

    test('passes json_schema when configured', async () => {
      const middleware = createLLMCallMiddleware();

      const messages: Message[] = [{ role: 'user', content: 'Test message' }];

      const schema = {
        type: 'object',
        properties: {
          result: { type: 'string' },
          confidence: { type: 'number' },
        },
        required: ['result'],
      };

      const ctx: MiddlewareContext = {
        messages,
        tools: [],
        shouldContinue: true,
        iteration: 1,
        agentName: 'test-agent',
        provider: mockProvider,
        logger: mockLogger,
        agent: {
          name: 'test-agent',
          description: 'Test agent',
          tools: [],
          response_format: 'json_schema',
          json_schema: schema,
          prompt: 'You are a test agent',
        } as any,
        prompt: 'Test prompt',
        executionContext: {} as any,
        modelName: 'test-model',
      } as MiddlewareContext;

      await middleware(ctx, mockNext);

      expect(mockProvider.complete).toHaveBeenCalledWith(messages, [], {
        response_format: 'json_schema',
        json_schema: schema,
      });
    });

    test('does not pass config when agent has no response_format', async () => {
      const middleware = createLLMCallMiddleware();

      const messages: Message[] = [{ role: 'user', content: 'Test message' }];

      const ctx: MiddlewareContext = {
        messages,
        tools: [],
        shouldContinue: true,
        iteration: 1,
        agentName: 'test-agent',
        provider: mockProvider,
        logger: mockLogger,
        agent: {
          name: 'test-agent',
          description: 'Test agent',
          tools: [],
          prompt: 'You are a test agent',
          // No response_format
        } as any,
        prompt: 'Test prompt',
        executionContext: {} as any,
        modelName: 'test-model',
      } as MiddlewareContext;

      await middleware(ctx, mockNext);

      expect(mockProvider.complete).toHaveBeenCalledWith(messages, [], undefined);
    });

    test('handles text response_format', async () => {
      const middleware = createLLMCallMiddleware();

      const messages: Message[] = [{ role: 'user', content: 'Test message' }];

      const ctx: MiddlewareContext = {
        messages,
        tools: [],
        shouldContinue: true,
        iteration: 1,
        agentName: 'test-agent',
        provider: mockProvider,
        logger: mockLogger,
        agent: {
          name: 'test-agent',
          description: 'Test agent',
          tools: [],
          response_format: 'text',
          prompt: 'You are a test agent',
        } as any,
        prompt: 'Test prompt',
        executionContext: {} as any,
        modelName: 'test-model',
      } as MiddlewareContext;

      await middleware(ctx, mockNext);

      expect(mockProvider.complete).toHaveBeenCalledWith(messages, [], {
        response_format: 'text',
        json_schema: undefined,
      });
    });
  });

  describe('Response handling', () => {
    test('stores response in context with structured output', async () => {
      const middleware = createLLMCallMiddleware();

      const jsonResponse = {
        role: 'assistant' as const,
        content: '{"status": "complete", "data": {"id": 123}}',
      };

      mockProvider.complete = vi.fn().mockResolvedValue(jsonResponse);

      const ctx: MiddlewareContext = {
        messages: [{ role: 'user', content: 'Test' }],
        tools: [],
        shouldContinue: true,
        iteration: 1,
        agentName: 'test-agent',
        provider: mockProvider,
        logger: mockLogger,
        agent: {
          name: 'test-agent',
          description: 'Test agent',
          tools: [],
          response_format: 'json',
          prompt: 'You are a test agent',
        } as any,
        prompt: 'Test prompt',
        executionContext: {} as any,
        modelName: 'test-model',
      } as MiddlewareContext;

      await middleware(ctx, mockNext);

      expect(ctx.response).toEqual(jsonResponse);
      expect(mockLogger.logAssistantMessage).toHaveBeenCalledWith(
        'test-agent',
        '{"status": "complete", "data": {"id": 123}}',
        undefined
      );
    });

    test('handles tool calls with structured output', async () => {
      const middleware = createLLMCallMiddleware();

      const toolResponse = {
        role: 'assistant' as const,
        content: '{"thinking": "I need to use a tool"}',
        tool_calls: [
          {
            id: 'call_123',
            type: 'function' as const,
            function: {
              name: 'test_tool',
              arguments: '{"param": "value"}',
            },
          },
        ],
      };

      mockProvider.complete = vi.fn().mockResolvedValue(toolResponse);

      const ctx: MiddlewareContext = {
        messages: [{ role: 'user', content: 'Test' }],
        tools: [
          {
            name: 'test_tool',
            description: 'Test tool',
            parameters: {
              type: 'object' as const,
              properties: {},
            },
          },
        ],
        shouldContinue: true,
        iteration: 1,
        agentName: 'test-agent',
        provider: mockProvider,
        logger: mockLogger,
        agent: {
          name: 'test-agent',
          description: 'Test agent',
          tools: ['test_tool'],
          response_format: 'json',
          prompt: 'You are a test agent',
        } as any,
      } as MiddlewareContext;

      await middleware(ctx, mockNext);

      expect(ctx.response).toEqual(toolResponse);
      expect(mockLogger.logAssistantMessage).toHaveBeenCalledWith(
        'test-agent',
        '{"thinking": "I need to use a tool"}',
        undefined
      );
    });
  });

  describe('Error handling', () => {
    test('throws error when provider is missing', async () => {
      const middleware = createLLMCallMiddleware();

      const ctx: MiddlewareContext = {
        messages: [{ role: 'user', content: 'Test' }],
        tools: [],
        shouldContinue: true,
        iteration: 1,
        agentName: 'test-agent',
        provider: undefined,
        logger: mockLogger,
        prompt: 'Test prompt',
        executionContext: {} as any,
        modelName: 'test-model',
      } as MiddlewareContext;

      await expect(middleware(ctx, mockNext)).rejects.toThrow('No provider available in context');
    });

    test('skips when shouldContinue is false', async () => {
      const middleware = createLLMCallMiddleware();

      const ctx: MiddlewareContext = {
        messages: [{ role: 'user', content: 'Test' }],
        tools: [],
        shouldContinue: false,
        iteration: 1,
        agentName: 'test-agent',
        provider: mockProvider,
        logger: mockLogger,
        prompt: 'Test prompt',
        executionContext: {} as any,
        modelName: 'test-model',
      } as MiddlewareContext;

      await middleware(ctx, mockNext);

      expect(mockProvider.complete).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    test('skips when tools are missing', async () => {
      const middleware = createLLMCallMiddleware();

      const ctx: MiddlewareContext = {
        messages: [{ role: 'user', content: 'Test' }],
        tools: undefined,
        shouldContinue: true,
        iteration: 1,
        agentName: 'test-agent',
        provider: mockProvider,
        logger: mockLogger,
      } as MiddlewareContext;

      await middleware(ctx, mockNext);

      expect(mockProvider.complete).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
