import { Tool, ToolResult } from '@/base-types';
import { AgentLoader } from '@/agents/loader';

/**
 * The Task tool - enables delegation to other agents
 * Note: This tool doesn't execute anything itself, the AgentExecutor
 * handles it specially to make the recursive call
 */
export const createTaskTool = async (agentLoader: AgentLoader): Promise<Tool> => {
  const availableAgents = await agentLoader.listAgents();
  const agentList =
    availableAgents.length > 0
      ? `\n\nAvailable agents: ${availableAgents.join(', ')}`
      : '\n\nNo agents available in the agents directory. You can always use "default" for general-purpose tasks.';

  return {
    name: 'Task',
    description: `Launch a specialized agent to handle complex, multi-step tasks autonomously. 

Use this tool proactively when:
- The task requires specialized domain expertise beyond general assistance
- You need deep analysis or investigation that would benefit from focused attention  
- The user's request involves code review, architecture analysis, or technical writing
- You've completed significant work that should be reviewed or documented
- The task involves complex multi-step coordination${agentList}

The subagent will work autonomously to complete the delegated task and return comprehensive results.`,
    parameters: {
      type: 'object',
      properties: {
        subagent_type: {
          type: 'string',
          description:
            availableAgents.length > 0
              ? `The type of specialized agent to use for this task. Options: ${availableAgents.join(', ')}. ` +
                "Use 'default' for general-purpose tasks when no specific agent fits."
              : 'The type of specialized agent to use for this task. Use "default" for general-purpose agent.',
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
      required: ['subagent_type', 'prompt'],
    },
    // This is a placeholder - the actual execution is handled by AgentExecutor
    execute: async (_args: Record<string, unknown>): Promise<ToolResult> => {
      throw new Error('Task tool should be handled by AgentExecutor');
    },
    isConcurrencySafe: () => false, // Task delegation must be sequential for proper orchestration
  };
};
