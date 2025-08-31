import * as fs from 'fs/promises';
import * as path from 'path';
import matter from 'gray-matter';
import { AgentDefinition } from '../types';
import { ConversationLogger } from './conversation-logger';

export class AgentLoader {
  constructor(
    private readonly agentsDir: string,
    private readonly logger?: ConversationLogger
  ) {}

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
        model: data.model,
      };
    } catch (error: any) {
      // Provide more helpful error messages
      if (error.code === 'ENOENT') {
        throw new Error(
          `Agent '${name}' not found at ${agentPath}. Please ensure the agent file exists.`
        );
      }
      throw new Error(`Failed to load agent ${name}: ${error}`);
    }
  }

  async listAgents(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.agentsDir);
      return files.filter((f) => f.endsWith('.md')).map((f) => f.replace('.md', ''));
    } catch (error: any) {
      // Only log as error if the directory exists but can't be read
      // If directory doesn't exist (ENOENT), just return empty array silently
      if (error.code === 'ENOENT') {
        // Directory doesn't exist - this is fine if no agents were explicitly configured
        return [];
      }

      // Other errors should be logged
      const errorMsg = `Failed to list agents: ${error}`;
      if (this.logger) {
        this.logger.log({
          timestamp: new Date().toISOString(),
          agentName: 'AgentLoader',
          depth: 0,
          type: 'error',
          content: errorMsg,
        });
      } else {
        console.error(`❌ [AgentLoader] ERROR: ${errorMsg}`);
      }
      return [];
    }
  }
}
