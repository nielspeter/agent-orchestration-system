import { AgentDefinition, Tool } from '../types';

export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  filterForAgent(agent: AgentDefinition): Tool[] {
    // Check if tools is "*" or contains "*"
    if (agent.tools === '*' || (Array.isArray(agent.tools) && agent.tools.includes('*'))) {
      return this.list();
    }

    if (Array.isArray(agent.tools)) {
      return agent.tools
        .map((name) => this.tools.get(name))
        .filter((tool): tool is Tool => tool !== undefined);
    }

    return [];
  }
}
