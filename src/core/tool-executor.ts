import type { ToolRegistry } from '../tools/tool-registry';
import type { ToolUse } from '../llm/types';
import type { ToolOutput } from '../tools/types';

export interface ToolExecutorConfig {
  maxConcurrentTools?: number;
  defaultTimeout?: number;
  retryCount?: number;
}

export class ToolExecutor {
  constructor(
    private registry: ToolRegistry,
    private config: ToolExecutorConfig = {}
  ) {}

  async executeTools(toolUses: ToolUse[]): Promise<ToolOutput[]> {
    const results: ToolOutput[] = [];
    
    for (const toolUse of toolUses) {
      const tool = this.registry.getTool(toolUse.name);
      
      if (!tool) {
        results.push({
          content: [{ type: 'text', text: `Tool not found: ${toolUse.name}` }],
          isError: true
        });
        continue;
      }

      try {
        const result = await this.executeWithTimeout(
          () => tool.execute(toolUse.input),
          toolUse.input.timeout as number || this.config.defaultTimeout || 5000
        );
        
        if (!result || !result.content) {
          results.push({
            content: [{ type: 'text', text: 'Invalid tool output' }],
            isError: true
          });
        } else {
          results.push(result);
        }
      } catch (error) {
        results.push({
          content: [{ type: 'text', text: (error as Error).message }],
          isError: true
        });
      }
    }
    
    return results;
  }

  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Tool execution timed out')), timeout)
      )
    ]);
  }
}