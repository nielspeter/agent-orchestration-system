import { Middleware } from '@/middleware/middleware-types';
import { ILLMProvider } from '@/providers/llm-provider.interface';

/**
 * Middleware that injects a mock provider for testing
 * Replaces the provider selection middleware in test scenarios
 */
export function createMockProviderMiddleware(provider: ILLMProvider): Middleware {
  return async (ctx, next) => {
    // Inject the mock provider
    ctx.provider = provider;
    ctx.modelName = provider.getModelName();

    // Set default behavior settings
    ctx.behaviorSettings = {
      temperature: 0.5,
      top_p: 0.85,
    };

    // Log for debugging
    ctx.logger.logSystemMessage(`Using mock provider: ${provider.getModelName()}`);

    await next();
  };
}
