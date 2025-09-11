import type { ToolRegistry } from '@/tools';
import type { ToolUse } from '@/providers';
import type { ToolOutput } from '@/base-types';

export interface ToolExecutorConfig {
  maxConcurrentTools?: number;
  defaultTimeout?: number;
  retryCount?: number;
}

export class ToolExecutor {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly config: ToolExecutorConfig = {}
  ) {}

  /**
   * Execute function with retry logic for transient failures
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    retryCount: number = this.config.retryCount || 0
  ): Promise<T> {
    let lastError: unknown;
    const maxAttempts = retryCount + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt === maxAttempts) {
          throw error;
        }

        // Only retry on transient errors
        const errorObj = error as { code?: string; status?: number };
        const isRetryable =
          errorObj.code === 'ECONNRESET' ||
          errorObj.code === 'ETIMEDOUT' ||
          (errorObj.status && errorObj.status >= 500);

        if (!isRetryable) {
          throw error;
        }

        const delay = 1000 * attempt; // Linear backoff
        console.info(`⚠️ Retry ${attempt}/${retryCount} in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastError;
  }

  async executeTools(toolUses: ToolUse[]): Promise<ToolOutput[]> {
    const results: ToolOutput[] = [];

    for (const toolUse of toolUses) {
      const tool = this.registry.getTool(toolUse.name);

      if (!tool) {
        results.push({
          content: [{ type: 'text', text: `Tool not found: ${toolUse.name}` }],
          isError: true,
        });
        continue;
      }

      try {
        // Use retry wrapper around the timeout execution
        const result = await this.executeWithRetry(
          () =>
            this.executeWithTimeout(
              () => tool.execute(toolUse.input),
              (toolUse.input.timeout as number) || this.config.defaultTimeout || 5000
            ),
          this.config.retryCount || 0
        );

        if (!result?.content) {
          results.push({
            content: [{ type: 'text', text: 'Invalid tool output' }],
            isError: true,
          });
        } else {
          // Convert ToolResult to ToolOutput format
          const text =
            typeof result.content === 'string'
              ? result.content
              : JSON.stringify(result.content, null, 2);
          results.push({
            content: [{ type: 'text', text }],
            isError: !!result.error,
          });
        }
      } catch (error) {
        results.push({
          content: [{ type: 'text', text: (error as Error).message }],
          isError: true,
        });
      }
    }

    return results;
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Tool execution timed out')), timeout)
      ),
    ]);
  }
}
