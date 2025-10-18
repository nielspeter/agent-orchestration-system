import { describe, expect, it } from 'vitest';
import { ThinkingMiddleware } from '@/middleware/thinking.middleware';
import { MiddlewareContext } from '@/middleware/middleware-types';
import { Agent } from '@/config/types';
import { Message } from '@/base-types';
import { AgentLogger } from '@/logging';

// Mock providers config for tests
const mockProvidersConfig = {
  providers: {
    anthropic: {
      type: 'native',
      models: [
        {
          id: 'claude-opus-4-1',
          contextLength: 200000,
          pricing: { input: 0.015, output: 0.075 },
          capabilities: {
            thinking: true as const,
            thinkingMinBudget: 1024,
            thinkingMaxBudget: 65536,
            thinkingDefaultBudget: 12000,
          },
        },
        {
          id: 'claude-sonnet-4-0',
          contextLength: 200000,
          pricing: { input: 0.003, output: 0.015 },
          capabilities: {
            thinking: true as const,
            thinkingMinBudget: 512,
            thinkingMaxBudget: 32768,
            thinkingDefaultBudget: 8000,
          },
        },
        {
          id: 'claude-haiku-4-5',
          contextLength: 200000,
          capabilities: {
            thinking: false as const,
          },
        },
      ],
    },
    openai: {
      type: 'openai-compatible',
      models: [
        {
          id: 'o3',
          contextLength: 128000,
          pricing: { input: 0.015, output: 0.06 },
          capabilities: {
            thinking: 'automatic' as const,
            thinkingPricing: { input: 0.06 },
          },
        },
      ],
    },
    openrouter: {
      type: 'openai-compatible',
      dynamicModels: true,
      models: [],
    },
  },
};

// Mock logger that captures messages
class MockLogger implements Partial<AgentLogger> {
  public messages: string[] = [];

  logSystemMessage(message: string): void {
    this.messages.push(message);
  }

  logAgentError(source: string, error: Error): void {
    this.messages.push(`Error: ${error.message}`);
  }

  logUserMessage() {}
  logAssistantMessage() {}
  logToolCall() {}
  logToolResult() {}
  logAgentIteration() {}
  logAgentResult() {}
  flush() {}
  close() {}
}

// Helper to create test context
function createTestContext(overrides: Partial<MiddlewareContext> = {}): MiddlewareContext {
  const logger = new MockLogger();
  return {
    agentName: 'test-agent',
    prompt: 'test prompt',
    messages: [] as Message[],
    iteration: 0,
    logger: logger as unknown as AgentLogger,
    modelName: 'anthropic/claude-opus-4-1',
    shouldContinue: true,
    result: undefined,
    sessionId: 'test-session',
    agent: {
      name: 'test-agent',
      prompt: 'test prompt',
      thinking: true,
    } as Agent,
    ...overrides,
  };
}

describe('ThinkingMiddleware', () => {
  describe('Model Support Detection', () => {
    it('should detect Anthropic Opus 4 thinking support', async () => {
      const middleware = new ThinkingMiddleware(mockProvidersConfig);
      const ctx = createTestContext({
        modelName: 'anthropic/claude-opus-4-1',
        agent: { name: 'test', prompt: 'test', thinking: true } as Agent,
      });

      await middleware.process(ctx, async () => {});

      expect(ctx.thinkingConfig).toBeDefined();
      expect(ctx.thinkingConfig?.enabled).toBe(true);
      expect(ctx.thinkingConfig?.budgetTokens).toBe(12000); // Default budget
    });

    it('should detect Anthropic Sonnet 4 thinking support', async () => {
      const middleware = new ThinkingMiddleware(mockProvidersConfig);
      const ctx = createTestContext({
        modelName: 'anthropic/claude-sonnet-4-0',
        agent: { name: 'test', prompt: 'test', thinking: true } as Agent,
      });

      await middleware.process(ctx, async () => {});

      expect(ctx.thinkingConfig).toBeDefined();
      expect(ctx.thinkingConfig?.budgetTokens).toBe(8000); // Model-specific default
    });

    it('should detect OpenAI o3 automatic reasoning', async () => {
      const middleware = new ThinkingMiddleware(mockProvidersConfig);
      const ctx = createTestContext({
        modelName: 'openai/o3',
        agent: { name: 'test', prompt: 'test', thinking: true } as Agent,
      });

      await middleware.process(ctx, async () => {});

      expect(ctx.thinkingConfig).toBeDefined();
      expect(ctx.providerModelConfig?.capabilities?.thinking).toBe('automatic');
    });

    it('should mark Haiku as non-thinking', async () => {
      const middleware = new ThinkingMiddleware(mockProvidersConfig);
      const ctx = createTestContext({
        modelName: 'anthropic/claude-haiku-4-5',
        agent: { name: 'test', prompt: 'test', thinking: true } as Agent,
      });

      await middleware.process(ctx, async () => {});

      expect(ctx.thinkingConfig).toBeUndefined();
      const logger = ctx.logger as unknown as MockLogger;
      expect(logger.messages.some((m) => m.includes('does not support extended thinking'))).toBe(
        true
      );
    });

    it('should handle unknown models gracefully', async () => {
      const middleware = new ThinkingMiddleware(mockProvidersConfig);
      const ctx = createTestContext({
        modelName: 'unknown/model',
        agent: { name: 'test', prompt: 'test', thinking: true } as Agent,
      });

      await middleware.process(ctx, async () => {});

      expect(ctx.thinkingConfig).toBeUndefined();
    });
  });

  describe('Configuration Normalization', () => {
    it('should normalize thinking: true to default budget', async () => {
      const middleware = new ThinkingMiddleware(mockProvidersConfig);
      const ctx = createTestContext({
        modelName: 'anthropic/claude-opus-4-1',
        agent: { name: 'test', prompt: 'test', thinking: true } as Agent,
      });

      await middleware.process(ctx, async () => {});

      expect(ctx.thinkingConfig?.enabled).toBe(true);
      expect(ctx.thinkingConfig?.budgetTokens).toBe(12000);
    });

    it('should normalize thinking: { budget_tokens: 5000 }', async () => {
      const middleware = new ThinkingMiddleware(mockProvidersConfig);
      const ctx = createTestContext({
        modelName: 'anthropic/claude-opus-4-1',
        agent: {
          name: 'test',
          prompt: 'test',
          thinking: { budget_tokens: 5000 },
        } as Agent,
      });

      await middleware.process(ctx, async () => {});

      expect(ctx.thinkingConfig?.budgetTokens).toBe(5000);
    });

    it('should use model-specific default budget', async () => {
      const middleware = new ThinkingMiddleware(mockProvidersConfig);
      const ctx = createTestContext({
        modelName: 'anthropic/claude-sonnet-4-0',
        agent: { name: 'test', prompt: 'test', thinking: true } as Agent,
      });

      await middleware.process(ctx, async () => {});

      expect(ctx.thinkingConfig?.budgetTokens).toBe(8000); // Sonnet default
    });

    it('should enforce model min budget limit', async () => {
      const middleware = new ThinkingMiddleware(mockProvidersConfig);
      const ctx = createTestContext({
        modelName: 'anthropic/claude-opus-4-1',
        agent: {
          name: 'test',
          prompt: 'test',
          thinking: { budget_tokens: 500 }, // Below 1024 min
        } as Agent,
      });

      await middleware.process(ctx, async () => {});

      // Middleware catches error and disables thinking
      expect(ctx.thinkingConfig).toBeUndefined();
      const logger = ctx.logger as unknown as MockLogger;
      expect(logger.messages.some((m) => m.includes('at least 1024 tokens'))).toBe(true);
    });

    it('should enforce model max budget limit', async () => {
      const middleware = new ThinkingMiddleware(mockProvidersConfig);
      const ctx = createTestContext({
        modelName: 'anthropic/claude-opus-4-1',
        agent: {
          name: 'test',
          prompt: 'test',
          thinking: { budget_tokens: 70000 }, // Above 65536 max
        } as Agent,
      });

      await middleware.process(ctx, async () => {});

      // Middleware catches error and disables thinking
      expect(ctx.thinkingConfig).toBeUndefined();
      const logger = ctx.logger as unknown as MockLogger;
      expect(logger.messages.some((m) => m.includes('exceeds maximum of 65536 tokens'))).toBe(true);
    });

    it('should default enabled=true when config object provided', async () => {
      const middleware = new ThinkingMiddleware(mockProvidersConfig);
      const ctx = createTestContext({
        modelName: 'anthropic/claude-opus-4-1',
        agent: {
          name: 'test',
          prompt: 'test',
          thinking: { budget_tokens: 5000 }, // enabled not specified
        } as Agent,
      });

      await middleware.process(ctx, async () => {});

      expect(ctx.thinkingConfig?.enabled).toBe(true);
    });

    it('should handle thinking: { enabled: false }', async () => {
      const middleware = new ThinkingMiddleware(mockProvidersConfig);
      const ctx = createTestContext({
        modelName: 'anthropic/claude-opus-4-1',
        agent: {
          name: 'test',
          prompt: 'test',
          thinking: { enabled: false },
        } as Agent,
      });

      await middleware.process(ctx, async () => {});

      expect(ctx.thinkingConfig).toBeUndefined();
    });
  });

  describe('Configuration Validation', () => {
    it('should throw when thinking + temperature', async () => {
      const middleware = new ThinkingMiddleware(mockProvidersConfig);
      const ctx = createTestContext({
        modelName: 'anthropic/claude-opus-4-1',
        agent: {
          name: 'test',
          prompt: 'test',
          thinking: true,
          temperature: 0.5,
        } as Agent,
      });

      await middleware.process(ctx, async () => {});

      // Middleware catches error and disables thinking
      expect(ctx.thinkingConfig).toBeUndefined();
      const logger = ctx.logger as unknown as MockLogger;
      expect(logger.messages.some((m) => m.includes('incompatible with temperature'))).toBe(true);
    });

    it('should throw when thinking + top_p', async () => {
      const middleware = new ThinkingMiddleware(mockProvidersConfig);
      const ctx = createTestContext({
        modelName: 'anthropic/claude-opus-4-1',
        agent: {
          name: 'test',
          prompt: 'test',
          thinking: true,
          top_p: 0.9,
        } as Agent,
      });

      await middleware.process(ctx, async () => {});

      // Middleware catches error and disables thinking
      expect(ctx.thinkingConfig).toBeUndefined();
      const logger = ctx.logger as unknown as MockLogger;
      expect(logger.messages.some((m) => m.includes('incompatible with top_p'))).toBe(true);
    });

    it('should warn when thinking enabled on non-supporting model', async () => {
      const middleware = new ThinkingMiddleware(mockProvidersConfig);
      const ctx = createTestContext({
        modelName: 'anthropic/claude-haiku-4-5',
        agent: { name: 'test', prompt: 'test', thinking: true } as Agent,
      });

      await middleware.process(ctx, async () => {});

      const logger = ctx.logger as unknown as MockLogger;
      expect(logger.messages.some((m) => m.includes('⚠️  WARNING'))).toBe(true);
      expect(logger.messages.some((m) => m.includes('does not support extended thinking'))).toBe(
        true
      );
    });

    it('should warn when budget exceeds 50% of context', async () => {
      // Use custom config with higher maxBudget to test the warning
      const customConfig = {
        providers: {
          test: {
            type: 'test',
            models: [
              {
                id: 'test-model',
                contextLength: 100000,
                capabilities: {
                  thinking: true as const,
                  thinkingMinBudget: 512,
                  thinkingMaxBudget: 80000, // Allow budget >50% of context
                  thinkingDefaultBudget: 5000,
                },
              },
            ],
          },
        },
      };
      const middleware = new ThinkingMiddleware(customConfig);
      const ctx = createTestContext({
        modelName: 'test/test-model',
        agent: {
          name: 'test',
          prompt: 'test',
          thinking: { budget_tokens: 60000 }, // 60% of 100k context
        } as Agent,
      });

      await middleware.process(ctx, async () => {});

      const logger = ctx.logger as unknown as MockLogger;
      expect(logger.messages.some((m) => m.includes('exceeds 50%'))).toBe(true);
    });
  });

  describe('Context Window Management', () => {
    it('should allow thinking when under 90% context', async () => {
      const middleware = new ThinkingMiddleware(mockProvidersConfig);
      const messages: Message[] = [
        { role: 'user', content: 'x'.repeat(1000) }, // Small message
      ];
      const ctx = createTestContext({
        modelName: 'anthropic/claude-opus-4-1',
        messages,
        agent: { name: 'test', prompt: 'test', thinking: true } as Agent,
      });

      await middleware.process(ctx, async () => {});

      expect(ctx.thinkingConfig).toBeDefined();
      expect(ctx.thinkingConfig?.budgetTokens).toBe(12000);
    });

    it('should reduce budget when approaching context limit', async () => {
      const middleware = new ThinkingMiddleware(mockProvidersConfig);
      // Create messages approaching context limit (but not exceeding 90%)
      // With improved estimation: 550k chars ~= 173k tokens (550k/3.5 + 4 overhead + 10% margin)
      // This is 86.5% of 200k context, leaving ~7k tokens for thinking
      const messages: Message[] = [{ role: 'user', content: 'x'.repeat(550000) }];
      const ctx = createTestContext({
        modelName: 'anthropic/claude-opus-4-1',
        messages,
        agent: { name: 'test', prompt: 'test', thinking: { budget_tokens: 20000 } } as Agent,
      });

      await middleware.process(ctx, async () => {});

      expect(ctx.thinkingConfig).toBeDefined();
      // Budget should be reduced from 20000 to fit available space
      expect(ctx.thinkingConfig?.budgetTokens).toBeLessThan(20000);
      expect(ctx.thinkingConfig?.budgetTokens).toBeGreaterThan(0);
    });

    it('should prevent negative budget with Math.max', async () => {
      const middleware = new ThinkingMiddleware(mockProvidersConfig);
      // Messages that exceed 90% of context
      const messages: Message[] = [
        { role: 'user', content: 'x'.repeat(800000) }, // ~200k tokens, exceeds 90% of 200k
      ];
      const ctx = createTestContext({
        modelName: 'anthropic/claude-opus-4-1',
        messages,
        agent: { name: 'test', prompt: 'test', thinking: true } as Agent,
      });

      await middleware.process(ctx, async () => {});

      // Should disable thinking, not set negative budget
      expect(ctx.thinkingConfig).toBeUndefined();
    });

    it('should disable thinking when no space available', async () => {
      const middleware = new ThinkingMiddleware(mockProvidersConfig);
      const messages: Message[] = [
        { role: 'user', content: 'x'.repeat(800000) }, // Too large
      ];
      const ctx = createTestContext({
        modelName: 'anthropic/claude-opus-4-1',
        messages,
        agent: { name: 'test', prompt: 'test', thinking: true } as Agent,
      });

      await middleware.process(ctx, async () => {});

      expect(ctx.thinkingConfig).toBeUndefined();
      const logger = ctx.logger as unknown as MockLogger;
      expect(logger.messages.some((m) => m.includes('No context space available'))).toBe(true);
    });

    it('should use model contextLength from config', async () => {
      const middleware = new ThinkingMiddleware(mockProvidersConfig);
      const ctx = createTestContext({
        modelName: 'anthropic/claude-opus-4-1',
        agent: { name: 'test', prompt: 'test', thinking: true } as Agent,
      });

      await middleware.process(ctx, async () => {});

      expect(ctx.providerModelConfig?.contextLength).toBe(200000);
    });

    it('should fallback to DEFAULT_CONTEXT_LENGTH for unknown models', async () => {
      const middleware = new ThinkingMiddleware(mockProvidersConfig);
      const ctx = createTestContext({
        modelName: 'openrouter/unknown-model',
        agent: { name: 'test', prompt: 'test', thinking: true } as Agent,
      });

      await middleware.process(ctx, async () => {});

      // OpenRouter dynamic models get default context length
      expect(ctx.providerModelConfig?.contextLength).toBe(128000);
    });
  });

  describe('Global Limits', () => {
    it('should pass when under global budget limit', async () => {
      const middleware = new ThinkingMiddleware(mockProvidersConfig, {
        thinking: { globalBudgetLimit: 50000 },
      });
      const ctx = createTestContext({
        modelName: 'anthropic/claude-opus-4-1',
        agent: { name: 'test', prompt: 'test', thinking: true } as Agent,
        thinkingMetrics: {
          totalTokensUsed: 10000,
          totalCost: 0.5,
          contextUsagePercent: 10,
        },
      });

      await middleware.process(ctx, async () => {});

      expect(ctx.thinkingConfig).toBeDefined();
    });

    it('should disable thinking when global budget exceeded', async () => {
      const middleware = new ThinkingMiddleware(mockProvidersConfig, {
        thinking: { globalBudgetLimit: 50000 },
      });
      const ctx = createTestContext({
        modelName: 'anthropic/claude-opus-4-1',
        agent: { name: 'test', prompt: 'test', thinking: true } as Agent,
        thinkingMetrics: {
          totalTokensUsed: 55000, // Exceeds 50000
          totalCost: 1.0,
          contextUsagePercent: 20,
        },
      });

      await middleware.process(ctx, async () => {});

      expect(ctx.thinkingConfig).toBeUndefined();
      const logger = ctx.logger as unknown as MockLogger;
      expect(logger.messages.some((m) => m.includes('Global thinking limits exceeded'))).toBe(true);
    });

    it('should pass when under global cost limit', async () => {
      const middleware = new ThinkingMiddleware(mockProvidersConfig, {
        thinking: { globalCostLimit: 5.0 },
      });
      const ctx = createTestContext({
        modelName: 'anthropic/claude-opus-4-1',
        agent: { name: 'test', prompt: 'test', thinking: true } as Agent,
        thinkingMetrics: {
          totalTokensUsed: 10000,
          totalCost: 2.0,
          contextUsagePercent: 10,
        },
      });

      await middleware.process(ctx, async () => {});

      expect(ctx.thinkingConfig).toBeDefined();
    });

    it('should disable thinking when global cost exceeded', async () => {
      const middleware = new ThinkingMiddleware(mockProvidersConfig, {
        thinking: { globalCostLimit: 5.0 },
      });
      const ctx = createTestContext({
        modelName: 'anthropic/claude-opus-4-1',
        agent: { name: 'test', prompt: 'test', thinking: true } as Agent,
        thinkingMetrics: {
          totalTokensUsed: 10000,
          totalCost: 6.0, // Exceeds 5.0
          contextUsagePercent: 10,
        },
      });

      await middleware.process(ctx, async () => {});

      expect(ctx.thinkingConfig).toBeUndefined();
    });

    it('should use thinkingMetrics from context', async () => {
      const middleware = new ThinkingMiddleware(mockProvidersConfig);
      const ctx = createTestContext({
        modelName: 'anthropic/claude-opus-4-1',
        agent: { name: 'test', prompt: 'test', thinking: true } as Agent,
        thinkingMetrics: {
          totalTokensUsed: 5000,
          totalCost: 0.25,
          contextUsagePercent: 5,
        },
      });

      await middleware.process(ctx, async () => {});

      // Should use existing metrics, not create new ones
      expect(ctx.thinkingConfig).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle configuration errors gracefully', async () => {
      const middleware = new ThinkingMiddleware(mockProvidersConfig);
      const ctx = createTestContext({
        modelName: 'anthropic/claude-opus-4-1',
        agent: {
          name: 'test',
          prompt: 'test',
          thinking: true,
          temperature: 0.5, // This will cause error
        } as Agent,
      });

      // Should not crash, middleware catches error
      await middleware.process(ctx, async () => {});

      expect(ctx.thinkingConfig).toBeUndefined();
      const logger = ctx.logger as unknown as MockLogger;
      expect(logger.messages.some((m) => m.includes('Thinking configuration error'))).toBe(true);
    });

    it('should continue without thinking on config error', async () => {
      const middleware = new ThinkingMiddleware({ providers: {} }); // Empty config
      const ctx = createTestContext({
        modelName: 'unknown/model',
        agent: { name: 'test', prompt: 'test', thinking: true } as Agent,
      });

      // Should not crash
      await middleware.process(ctx, async () => {});

      expect(ctx.thinkingConfig).toBeUndefined();
    });

    it('should skip when no agent loaded', async () => {
      const middleware = new ThinkingMiddleware(mockProvidersConfig);
      const ctx = createTestContext({
        agent: undefined,
      });

      await middleware.process(ctx, async () => {});

      expect(ctx.thinkingConfig).toBeUndefined();
    });

    it('should skip when no thinking config', async () => {
      const middleware = new ThinkingMiddleware(mockProvidersConfig);
      const ctx = createTestContext({
        agent: { name: 'test', prompt: 'test' } as Agent, // No thinking field
      });

      await middleware.process(ctx, async () => {});

      expect(ctx.thinkingConfig).toBeUndefined();
    });
  });
});
