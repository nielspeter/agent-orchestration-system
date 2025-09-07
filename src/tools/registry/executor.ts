import type { ToolRegistry } from '@/tools';
import type { ToolUse } from '@/providers';
import type { ToolOutput } from '../../types';

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
        const result = await this.executeWithTimeout(
          () => tool.execute(toolUse.input),
          (toolUse.input.timeout as number) || this.config.defaultTimeout || 5000
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
