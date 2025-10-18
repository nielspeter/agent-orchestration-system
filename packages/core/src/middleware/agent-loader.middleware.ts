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

    // Log agent and tools
    ctx.logger.logSystemMessage(
      `Agent loaded: ${ctx.agent.name} with ${Array.isArray(ctx.agent.tools) ? ctx.agent.tools.length : 'all'} tools`
    );

    // Prepare skills metadata for logging
    const skillsMetadata = ctx.agent.loadedSkills?.map((s) => ({
      name: s.name,
      version: s.metadata?.version,
    }));

    // Log skills if any are loaded
    if (skillsMetadata && skillsMetadata.length > 0) {
      const skillsInfo = skillsMetadata
        .map((s) => `${s.name}${s.version ? ` (v${s.version})` : ''}`)
        .join(', ');
      ctx.logger.logSystemMessage(`Skills loaded: ${skillsInfo}`);
    }

    // Log agent start with full context (task, skills, depth)
    const delegationInfo = ctx.executionContext.parentAgent
      ? ` (delegated from ${ctx.executionContext.parentAgent})`
      : '';
    const task = `${ctx.prompt.substring(0, 100)}${ctx.prompt.length > 100 ? '...' : ''}${delegationInfo}`;
    ctx.logger.logAgentStart(ctx.agent.name, ctx.executionContext.depth, task, skillsMetadata);

    await next();
  };
}
