import { Middleware } from './middleware-types';
import { AgentLoader } from '../core/agent-loader';
import { ToolRegistry } from '../core/tool-registry';

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

    // Filter tools for this agent
    ctx.tools = toolRegistry.filterForAgent(ctx.agent);

    // Log
    ctx.logger.log({
      timestamp: new Date().toISOString(),
      agentName: ctx.agentName,
      depth: ctx.executionContext.depth,
      type: 'system',
      content: `Agent loaded: ${ctx.agent.name}`,
      metadata: {
        toolCount: Array.isArray(ctx.agent.tools) ? ctx.agent.tools.length : 'all',
      },
    });

    await next();
  };
}
