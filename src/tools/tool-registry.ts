import type { Tool } from './types';
import type { TestAgentConfig } from '../config/types';

export class ToolRegistry {
  private tools = new Map<string, Tool>();
  private aliases = new Map<string, string>();
  private restricted = new Set<string>();

  register(tool: Tool): void {
    // Validate tool
    if (!tool || !tool.name || !tool.description || !tool.execute || !tool.parameters) {
      throw new Error('Invalid tool: missing required properties');
    }

    if (typeof tool.execute !== 'function') {
      throw new Error('Tool execute must be a function');
    }

    if (!/^[a-z0-9-]+$/.test(tool.name)) {
      throw new Error('Invalid tool name format');
    }

    if (!tool.parameters.type) {
      throw new Error('Invalid parameters schema');
    }

    if (this.tools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} is already registered`);
    }

    this.tools.set(tool.name, tool);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  replace(name: string, newTool: Tool): void {
    this.tools.set(name, newTool);
  }

  getTool(name: string): Tool | undefined {
    // Check aliases first
    const actualName = this.aliases.get(name) || name;
    return this.tools.get(actualName);
  }

  hasTool(name: string): boolean {
    const actualName = this.aliases.get(name) || name;
    return this.tools.has(actualName);
  }

  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  getToolDescriptions(): Record<string, string> {
    const descriptions: Record<string, string> = {};
    for (const [name, tool] of this.tools) {
      descriptions[name] = tool.description;
    }
    return descriptions;
  }

  addAlias(originalName: string, aliasName: string): void {
    this.aliases.set(aliasName, originalName);
  }

  markRestricted(toolName: string): void {
    this.restricted.add(toolName);
  }

  getToolsForAgent(agentConfig: TestAgentConfig): Tool[] {
    const result: Tool[] = [];

    for (const permission of agentConfig.tools) {
      if (permission === '*') {
        // Add all non-restricted tools
        for (const tool of this.tools.values()) {
          if (!this.restricted.has(tool.name)) {
            result.push(tool);
          }
        }
        return result;
      } else if (permission.endsWith('-*')) {
        // Pattern matching (e.g., 'file-*')
        const prefix = permission.slice(0, -1);
        for (const [name, tool] of this.tools) {
          if (name.startsWith(prefix) && !this.restricted.has(name)) {
            result.push(tool);
          }
        }
      } else {
        // Specific tool
        const tool = this.getTool(permission);
        if (tool && !this.restricted.has(tool.name)) {
          result.push(tool);
        }
      }
    }

    return result;
  }

  getConcurrentSafeTools(): Tool[] {
    return Array.from(this.tools.values()).filter(
      (tool) => tool.isConcurrencySafe && tool.isConcurrencySafe()
    );
  }

  getToolsByCategory(category: string): Tool[] {
    return Array.from(this.tools.values()).filter((tool) => tool.category === category);
  }

  getCategories(): string[] {
    const categories = new Set<string>();
    for (const tool of this.tools.values()) {
      if (tool.category) {
        categories.add(tool.category);
      }
    }
    return Array.from(categories).sort();
  }

  getToolsByTag(tag: string): Tool[] {
    return Array.from(this.tools.values()).filter(
      (tool) => tool.metadata?.tags && (tool.metadata.tags as string[]).includes(tag)
    );
  }
}
