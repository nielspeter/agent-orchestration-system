import * as fs from 'fs/promises';
import * as path from 'path';
import matter from 'gray-matter';
import { AgentDefinition } from '../types';

export class AgentLoader {
  constructor(private readonly agentsDir: string) {}

  async loadAgent(name: string): Promise<AgentDefinition> {
    const agentPath = path.join(this.agentsDir, `${name}.md`);
    
    try {
      const content = await fs.readFile(agentPath, 'utf-8');
      const { data, content: description } = matter(content);
      
      if (!data.name) {
        throw new Error(`Agent ${name} missing 'name' in frontmatter`);
      }
      
      return {
        name: data.name,
        description: description.trim(),
        tools: data.tools || [],
        model: data.model
      };
    } catch (error) {
      throw new Error(`Failed to load agent ${name}: ${error}`);
    }
  }

  async listAgents(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.agentsDir);
      return files
        .filter(f => f.endsWith('.md'))
        .map(f => f.replace('.md', ''));
    } catch (error) {
      console.error(`Failed to list agents: ${error}`);
      return [];
    }
  }

  getAgentPath(name: string): string {
    return path.join(this.agentsDir, `${name}.md`);
  }
}