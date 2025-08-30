import { AgentDefinition, BaseTool } from '../types';

/** Special tool permissions for agents */
export enum ToolPermission {
  ALL = '*',
  READ = 'read',
  WRITE = 'write',
  LIST = 'list',
}

export class ToolRegistry {
  private readonly tools = new Map<string, BaseTool>();
  private readonly toolCategories = new Map<ToolPermission, Set<string>>();

  constructor() {
    // Initialize tool categories
    this.toolCategories.set(ToolPermission.READ, new Set(['Read']));
    this.toolCategories.set(ToolPermission.WRITE, new Set(['Write']));
    this.toolCategories.set(ToolPermission.LIST, new Set(['List']));
  }

  register(tool: BaseTool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  list(): BaseTool[] {
    return Array.from(this.tools.values());
  }

  filterForAgent(agent: AgentDefinition): BaseTool[] {
    const agentTools = agent.tools;

    // Handle string permissions (like "*")
    if (typeof agentTools === 'string') {
      if (agentTools === ToolPermission.ALL) {
        return this.list();
      }
      // Handle single tool name
      const tool = this.tools.get(agentTools);
      return tool ? [tool] : [];
    }

    // Handle array of permissions/tool names
    if (Array.isArray(agentTools)) {
      const allowedTools = new Set<BaseTool>();

      for (const permission of agentTools) {
        if (permission === ToolPermission.ALL) {
          return this.list(); // All tools allowed
        }

        // Check if it's a category permission
        const categoryTools = this.toolCategories.get(permission as ToolPermission);
        if (categoryTools) {
          categoryTools.forEach((toolName) => {
            const tool = this.tools.get(toolName);
            if (tool) allowedTools.add(tool);
          });
        } else {
          // Direct tool name
          const tool = this.tools.get(permission);
          if (tool) allowedTools.add(tool);
        }
      }

      return Array.from(allowedTools);
    }

    // Default: no tools allowed
    return [];
  }
}
