import { Tool, ToolResult } from '../types';

/**
 * The Task tool - enables delegation to other agents
 * Note: This tool doesn't execute anything itself, the AgentExecutor
 * handles it specially to make the recursive call
 */
export const createTaskTool = (): Tool => ({
  name: 'Task',
  description: 'Delegate a task to another specialized agent',
  parameters: {
    type: 'object',
    properties: {
      subagent_type: {
        type: 'string',
        description: 'Name of the agent to delegate to',
      },
      prompt: {
        type: 'string',
        description: 'The task or question for the agent to handle',
      },
      description: {
        type: 'string',
        description: 'Optional brief description of the task',
      },
    },
    required: ['subagent_type', 'prompt'],
  },
  // This is a placeholder - the actual execution is handled by AgentExecutor
  execute: async (args: any): Promise<ToolResult> => {
    throw new Error('Task tool should be handled by AgentExecutor');
  },
  isConcurrencySafe: () => false, // Task delegation must be sequential to maintain context
});
