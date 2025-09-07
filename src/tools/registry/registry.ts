import type { Tool } from '../types';
import type { TestAgentConfig } from '@/config';
import {
  DuplicateToolError,
  InvalidToolError,
  InvalidToolNameError,
  InvalidToolSchemaError,
} from '../errors';

/**
 * Interface for tool registry implementations
 */
export interface IToolRegistry {
  register(tool: Tool): void;
  getTool(name: string): Tool | undefined;
  getAllTools(): Tool[];
  getToolsForAgent(config: TestAgentConfig): Tool[];
  filterForAgent(agentConfig: { tools?: string[] | '*'; [key: string]: unknown }): Tool[];
}

export class ToolRegistry implements IToolRegistry {
  private readonly tools = new Map<string, Tool>();

  register(tool: Tool): void {
    // Validate tool
    const missingFields: string[] = [];
    if (!tool?.name) missingFields.push('name');
    if (!tool?.description) missingFields.push('description');
    if (!tool?.execute) missingFields.push('execute');
    if (!tool?.parameters) missingFields.push('parameters');

    if (missingFields.length > 0) {
      throw new InvalidToolError(tool, missingFields);
    }

    if (typeof tool.execute !== 'function') {
      throw new InvalidToolError(tool, ['execute (must be a function)']);
    }

    if (!/^[a-zA-Z0-9-_]+$/.test(tool.name)) {
      throw new InvalidToolNameError(tool.name);
    }

    if (!tool.parameters.type) {
      throw new InvalidToolSchemaError(tool.name, 'Missing type property');
    }

    if (this.tools.has(tool.name)) {
      throw new DuplicateToolError(tool.name);
    }

    this.tools.set(tool.name, tool);
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  getToolsForAgent(agentConfig: TestAgentConfig): Tool[] {
    const result: Tool[] = [];

    for (const permission of agentConfig.tools) {
      if (permission === '*') {
        // Add all tools
        return Array.from(this.tools.values());
      } else if (permission.endsWith('-*')) {
        // Pattern matching (e.g., 'file-*')
        const prefix = permission.slice(0, -1);
        for (const [name, tool] of this.tools) {
          if (name.startsWith(prefix)) {
            result.push(tool);
          }
        }
      } else {
        // Specific tool
        const tool = this.getTool(permission);
        if (tool) {
          result.push(tool);
        }
      }
    }

    return result;
  }

  filterForAgent(agentConfig: { tools?: string[] | '*'; [key: string]: unknown }): Tool[] {
    // If no tools configured, return empty array
    if (!agentConfig.tools) {
      return [];
    }

    // Create a minimal valid config with safe defaults
    const validConfig: TestAgentConfig = {
      name: typeof agentConfig.name === 'string' ? agentConfig.name : 'unknown',
      prompt: typeof agentConfig.prompt === 'string' ? agentConfig.prompt : '',
      tools:
        agentConfig.tools === '*'
          ? ['*']
          : Array.isArray(agentConfig.tools)
            ? agentConfig.tools
            : [],
    };

    return this.getToolsForAgent(validConfig);
  }
}
