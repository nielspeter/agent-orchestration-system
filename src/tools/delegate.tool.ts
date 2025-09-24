import { Tool, ToolResult } from '@/base-types';
import { AgentLoader } from '@/agents/loader';

/**
 * The Delegate tool - enables delegation to other agents
 * Note: This tool doesn't execute anything itself, the AgentExecutor
 * handles it specially to make the recursive call
 */
export const createDelegateTool = async (agentLoader: AgentLoader): Promise<Tool> => {
  const availableAgents = await agentLoader.listAgents();
  const agentList =
    availableAgents.length > 0
      ? `\n\nAvailable agents: ${availableAgents.join(', ')}`
      : '\n\nNo agents available in the agents directory. You can always use "default" for general-purpose tasks.';

  return {
    name: 'delegate',
    description: `Delegate work to a specialized agent for autonomous completion.

Use this tool proactively when:
- The task requires specialized domain expertise beyond general assistance
- You need deep analysis or investigation that would benefit from focused attention
- The user's request involves code review, architecture analysis, or technical writing
- You've completed significant work that should be reviewed or documented
- The task involves complex multi-step coordination${agentList}

The agent will work autonomously to complete the delegated work and return comprehensive results.`,
    parameters: {
      type: 'object',
      properties: {
        agent: {
          type: 'string',
          description:
            availableAgents.length > 0
              ? `The specialized agent to delegate to. Options: ${availableAgents.join(', ')}. ` +
                "Use 'default' for general-purpose tasks when no specific agent fits."
              : 'The specialized agent to delegate to. Use "default" for general-purpose agent.',
        },
        prompt: {
          type: 'string',
          description:
            'The task for the agent to perform. Should be clear and specific about what you want accomplished',
        },
        description: {
          type: 'string',
          description:
            'A short (3-5 word) description of the task for logging and tracking purposes',
        },
      },
      required: ['agent', 'prompt'],
    },
    // This is a placeholder - the actual execution is handled by AgentExecutor
    execute: async (_args: Record<string, unknown>): Promise<ToolResult> => {
      throw new Error('Delegate tool should be handled by AgentExecutor');
    },
    isConcurrencySafe: () => false, // Delegation must be sequential for proper orchestration
  };
};
