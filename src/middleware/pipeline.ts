import { Middleware, MiddlewareContext } from './middleware-types';

/**
 * Simple middleware pipeline executor
 * Runs middleware in sequence, passing control via next()
 */
export class MiddlewarePipeline {
  private readonly middlewares: Middleware[] = [];

  /**
   * Add middleware to the pipeline
   */
  use(middleware: Middleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Execute the pipeline with the given context
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
