import { Middleware, MiddlewareContext } from './middleware-types';

/**
 * MiddlewarePipeline - Executes middleware functions in sequence
 *
 * Implements the Chain of Responsibility pattern where each middleware
 * can process the context and decide whether to pass control to the next
 * middleware via the next() function.
 *
 * @example
 * ```typescript
 * const pipeline = new MiddlewarePipeline();
 * pipeline
 *   .use(loggingMiddleware)
 *   .use(authMiddleware)
 *   .use(processingMiddleware);
 * await pipeline.execute(context);
 * ```
 */
export class MiddlewarePipeline {
  private readonly middlewares: Middleware[] = [];

  /**
   * Adds a middleware function to the pipeline
   *
   * @param middleware - Function that processes context and calls next()
   * @returns this - For method chaining
   */
  use(middleware: Middleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Executes the middleware pipeline with the given context
   *
   * @param context - The context object passed through all middleware
   * @throws Any error thrown by middleware functions
   */
  async execute(context: MiddlewareContext): Promise<void> {
    // Create execution-scoped iterator
    const runMiddleware = async (index: number): Promise<void> => {
      if (index >= this.middlewares.length) {
        return;
      }

      const middleware = this.middlewares[index];
      await middleware(context, () => runMiddleware(index + 1));
    };

    await runMiddleware(0);
  }
}
