import { Middleware } from './middleware-types';
import { AgentLoader } from '@/agents';
import { ToolRegistry } from '@/tools';

/**
 * Loads the agent and filters available tools
 */
export function createAgentLoaderMiddleware(
  agentLoader: AgentLoader,
  toolRegistry: ToolRegistry
): Middleware {
  return async (ctx, next) => {
    // Load agent
    ctx.agent = await agentLoader.loadAgent(ctx.agentName);

    if (!ctx.agent) {
      throw new Error(`Failed to load agent: ${ctx.agentName}`);
    }

    // Filter tools for this agent
    ctx.tools = toolRegistry.filterForAgent(ctx.agent);

    // Log
    ctx.logger.logSystemMessage(
      `Agent loaded: ${ctx.agent.name} with ${Array.isArray(ctx.agent.tools) ? ctx.agent.tools.length : 'all'} tools`
    );

    await next();
  };
}
