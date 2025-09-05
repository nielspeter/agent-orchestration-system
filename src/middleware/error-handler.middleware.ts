import { Middleware } from './middleware-types';

/**
 * Error handling middleware that provides an error boundary
 *
 * This middleware:
 * 1. Catches any errors thrown by downstream middleware
 * 2. Logs the error with context
 * 3. Sets an appropriate error response
 * 4. Prevents the error from crashing the entire system
 */
export function createErrorHandlerMiddleware(): Middleware {
  return async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      // Log the error with full context
      ctx.logger.logAgentError(ctx.agentName, new Error(errorMessage));

      // Set error state
      ctx.error = error instanceof Error ? error : new Error(errorMessage);
      ctx.shouldContinue = false;

      // Provide a user-friendly error message
      if (!ctx.result) {
        ctx.result = `An error occurred during execution: ${errorMessage}. Please check the logs for details.`;
      }

      // Don't rethrow - we've handled it
    }
  };
}
