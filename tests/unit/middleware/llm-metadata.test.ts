import { describe, expect, test, vi, beforeEach } from 'vitest';
import { createLLMCallMiddleware } from '@/middleware/llm-call.middleware';
import { MiddlewareContext } from '@/middleware/middleware-types';
import { Message } from '@/base-types';
import { ILLMProvider } from '@/providers/llm-provider.interface';

describe('LLM Metadata Propagation', () => {
  let mockProvider: ILLMProvider;
  let mockLogger: any;
  let mockNext: any;
  let ctx: MiddlewareContext;

  beforeEach(() => {
    mockProvider = {
      complete: vi.fn().mockResolvedValue({
        role: 'assistant',
        content: 'Test response',
      }),
      getModelName: vi.fn().mockReturnValue('claude-3-haiku'),
      getProviderName: vi.fn().mockReturnValue('anthropic'),
      supportsStreaming: vi.fn().mockReturnValue(false),
      getLastUsageMetrics: vi.fn().mockReturnValue({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        promptCacheHitTokens: 80,
        promptCacheMissTokens: 20,
      }),
      getLastStopReason: vi.fn().mockReturnValue('end_turn'),
    };

    mockLogger = {
      logAgentIteration: vi.fn(),
      logAssistantMessage: vi.fn(),
    };

    mockNext = vi.fn();

    const messages: Message[] = [{ role: 'user', content: 'Test message' }];

    ctx = {
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
        model: 'anthropic/claude-3-haiku',
        prompt: 'You are a test agent',
      } as any,
      prompt: 'Test prompt',
      executionContext: {} as any,
      modelName: 'test-model',
    } as MiddlewareContext;
  });

  test('captures and passes metadata from provider', async () => {
    const middleware = createLLMCallMiddleware();

    await middleware(ctx, mockNext);

    // Verify metadata was captured in context
    expect(ctx.lastLLMMetadata).toBeDefined();
    expect(ctx.lastLLMMetadata?.usage).toEqual({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      promptCacheHitTokens: 80,
      promptCacheMissTokens: 20,
    });
    expect(ctx.lastLLMMetadata?.provider).toBe('anthropic');
    expect(ctx.lastLLMMetadata?.model).toBe('claude-3-haiku'); // From getModelName()
  });

  test('includes latency in metadata', async () => {
    const middleware = createLLMCallMiddleware();

    // Mock slow response
    mockProvider.complete = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { role: 'assistant', content: 'Test response' };
    });

    await middleware(ctx, mockNext);

    expect(ctx.lastLLMMetadata?.performance?.latencyMs).toBeGreaterThan(90);
    expect(ctx.lastLLMMetadata?.performance?.latencyMs).toBeLessThan(200);
  });

  test('passes metadata to logger', async () => {
    const middleware = createLLMCallMiddleware();

    await middleware(ctx, mockNext);

    // Verify logger was called with metadata
    expect(mockLogger.logAssistantMessage).toHaveBeenCalledWith(
      'test-agent',
      'Test response',
      expect.objectContaining({
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          promptCacheHitTokens: 80,
          promptCacheMissTokens: 20,
        },
      })
    );
  });

  test('handles missing usage metrics gracefully', async () => {
    mockProvider.getLastUsageMetrics = vi.fn().mockReturnValue(null);

    const middleware = createLLMCallMiddleware();

    await middleware(ctx, mockNext);

    // Should still call logger but without metadata
    expect(mockLogger.logAssistantMessage).toHaveBeenCalledWith(
      'test-agent',
      'Test response',
      undefined
    );
    expect(ctx.lastLLMMetadata).toBeUndefined();
  });

  test('handles provider without getLastUsageMetrics method', async () => {
    delete (mockProvider as any).getLastUsageMetrics;

    const middleware = createLLMCallMiddleware();

    await middleware(ctx, mockNext);

    // Should not crash and should call logger without metadata
    expect(mockLogger.logAssistantMessage).toHaveBeenCalledWith(
      'test-agent',
      'Test response',
      undefined
    );
    expect(ctx.lastLLMMetadata).toBeUndefined();
  });

  test('uses provider name from getProviderName method', async () => {
    // Test that provider name always comes from getProviderName() method
    const testModels = [
      'anthropic/claude-3-opus',
      'openai/gpt-4',
      'openrouter/meta-llama/llama-3.1',
      'gpt-4',
    ];

    for (const model of testModels) {
      ctx.agent = { ...ctx.agent, model } as any;
      const middleware = createLLMCallMiddleware();

      await middleware(ctx, mockNext);

      // Provider name should always come from the mock's getProviderName()
      expect(ctx.lastLLMMetadata?.provider).toBe('anthropic');
      // Model name should come from getModelName() which returns 'claude-3-haiku'
      expect(ctx.lastLLMMetadata?.model).toBe('claude-3-haiku');
    }
  });
});
