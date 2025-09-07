import * as fs from 'fs/promises';
import * as path from 'path';
import matter from 'gray-matter';
import { AgentDefinition } from './types';
import { AgentLogger } from '@/logging';

export class AgentLoader {
  /**
   * Built-in default agent definition
   * Used as fallback when specific agents aren't found
   */
  private readonly DEFAULT_AGENT: AgentDefinition = {
    id: 'default',
    name: 'default',
    description: `You are a versatile, general-purpose assistant capable of handling any task.

## Your Approach
1. First, understand what needs to be accomplished
2. Use tools to investigate and gather necessary information
3. Execute the solution methodically
4. Return results as TEXT in your response (don't write files unless explicitly asked)

## Key Capabilities
- You have access to ALL available tools
- You can read and analyze files when needed
- You can search through codebases
- You can delegate to other agents if they exist
- You adapt your approach based on the task at hand

## IMPORTANT: Return Results, Don't Create Files
- By default, ALWAYS return your results as text in your response
- Only write files when EXPLICITLY asked to "create", "save", or "write" a file
- When asked for information, lists, analysis, or generated content - return it as text
- Think of yourself as a function that returns a value to the caller

Remember: You're the safety net of the system. When specialized agents aren't available, 
you step in to ensure the task gets completed by returning useful results.`,
    prompt: `You are a versatile, general-purpose assistant capable of handling any task.

## Your Approach
1. First, understand what needs to be accomplished
2. Use tools to investigate and gather necessary information
3. Execute the solution methodically
4. Return results as TEXT in your response (don't write files unless explicitly asked)

## Key Capabilities
- You have access to ALL available tools
- You can read and analyze files when needed
- You can search through codebases
- You can delegate to other agents if they exist
- You adapt your approach based on the task at hand

## IMPORTANT: Return Results, Don't Create Files
- By default, ALWAYS return your results as text in your response
- Only write files when EXPLICITLY asked to "create", "save", or "write" a file
- When asked for information, lists, analysis, or generated content - return it as text
- Think of yourself as a function that returns a value to the caller

Remember: You're the safety net of the system. When specialized agents aren't available, 
you step in to ensure the task gets completed by returning useful results.`,
    tools: '*', // Access to all tools
    model: undefined, // Uses system default model
    behavior: 'balanced', // Default balanced behavior
  };

  constructor(
    private readonly agentsDir: string,
    private readonly logger?: AgentLogger
  ) {}

  async loadAgent(name: string): Promise<AgentDefinition> {
    // Special case: return built-in default agent
    if (name === 'default') {
      this.logger?.logSystemMessage('Using built-in default agent');
      return this.DEFAULT_AGENT;
    }

    const agentPath = path.join(this.agentsDir, `${name}.md`);

    try {
      const content = await fs.readFile(agentPath, 'utf-8');
      const { data, content: description } = matter(content);

      if (!data.name) {
        throw new Error(`Agent ${name} missing 'name' in frontmatter`);
      }

      return {
        id: data.name,
        name: data.name,
        description: description.trim(), // For backward compatibility
        prompt: description.trim(),
        tools: data.tools || [],
        model: data.model,
        behavior: data.behavior,
        temperature: data.temperature,
        top_p: data.top_p,
      };
    } catch (error) {
      // Provide more helpful error messages
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // FALLBACK: If agent not found, use default agent with enhanced context
        this.logger?.logSystemMessage(
          `Agent '${name}' not found at ${agentPath}, using default agent as fallback`
        );

        const enhancedPrompt =
          this.DEFAULT_AGENT.prompt +
          `\n\n## Context\nYou were invoked as '${name}' but that specific agent doesn't exist. ` +
          'Use your general capabilities to handle this task effectively.';

        return {
          ...this.DEFAULT_AGENT,
          id: 'default',
          name: 'default', // Keep the name as 'default' for consistency
          description: enhancedPrompt,
          prompt: enhancedPrompt,
        };
      }
      throw new Error(`Failed to load agent ${name}: ${error}`);
    }
  }

  async listAgents(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.agentsDir);
      const fileAgents = files.filter((f) => f.endsWith('.md')).map((f) => f.replace('.md', ''));

      // Always include 'default' in the list of available agents
      return ['default', ...fileAgents];
    } catch (error) {
      // Only log as error if the directory exists but can't be read
      // If directory doesn't exist (ENOENT), just return default agent
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Directory doesn't exist - return just the default agent
        return ['default'];
      }

      // Other errors should be logged but still return default
      const errorMsg = `Failed to list agents: ${error}`;
      if (this.logger) {
        this.logger.logSystemMessage(errorMsg);
      } else {
        console.error(`❌ [AgentLoader] ERROR: ${errorMsg}`);
      }
      // Even on error, return default agent so system can continue
      return ['default'];
    }
  }
}
