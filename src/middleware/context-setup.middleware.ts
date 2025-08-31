import { Middleware } from './middleware-types';

/**
 * Sets up initial context and conversation messages
 */
export function createContextSetupMiddleware(): Middleware {
  return async (ctx, next) => {
    // Initialize messages array if not already present
    if (!ctx.messages) {
      ctx.messages = [];
    }

    // Add parent messages if available (for context inheritance)
    if (ctx.executionContext.parentMessages) {
      // Filter out the parent's system message to avoid tool confusion
      const filteredParentMessages = ctx.executionContext.parentMessages.filter(
        (msg) => msg.role !== 'system'
      );
      ctx.messages.push(...filteredParentMessages);

      ctx.logger.log({
        timestamp: new Date().toISOString(),
        agentName: ctx.agentName,
        depth: ctx.executionContext.depth,
        type: 'system',
        content: `Inheriting ${filteredParentMessages.length} messages from parent context (filtered out system message)`,
        metadata: {
          parentMessageTypes: filteredParentMessages.map((m) => m.role).join(', '),
          originalCount: ctx.executionContext.parentMessages.length,
          toolsAvailable: ctx.tools?.map(t => t.name).join(', ') || 'none',
        },
      });
    }

    // Add agent's system prompt and user prompt (only on first iteration)
    if (ctx.agent && ctx.iteration === 1) {
      // Build enhanced system prompt with system-level instructions
      let systemPrompt = ctx.agent.description;
      
      // Always add system-level instructions
      systemPrompt += '\n\n## SYSTEM INSTRUCTIONS';
      
      // Add dynamic tool availability information
      if (ctx.tools && ctx.tools.length > 0) {
        const toolNames = ctx.tools.map(t => t.name).join(', ');
        systemPrompt += `\n\n### AVAILABLE TOOLS
You have access to ONLY the following tools: ${toolNames}
DO NOT attempt to use any other tools or delegate to other agents unless you have the Task tool.
${ctx.tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}`;
      } else {
        systemPrompt += '\n\n### AVAILABLE TOOLS\nYou have no tools available. Provide your response as text only.';
      }
      
      // Add task completion protocol based on agent role
      if (ctx.executionContext.parentAgent) {
        // Child agent - MUST return result to parent
        systemPrompt += `\n\n### CRITICAL: YOU ARE A DELEGATED AGENT
You were called by ${ctx.executionContext.parentAgent} to complete a specific task.
Your final text response will be returned as the result of this delegation.

MANDATORY COMPLETION PROTOCOL:
1. Use tools to complete the requested task
2. After tools execute, you will see their results
3. IMMEDIATELY provide a text summary of what was accomplished
4. This text summary is your RETURN VALUE to ${ctx.executionContext.parentAgent}
5. Do NOT use any more tools after seeing tool results

YOU MUST FOLLOW THIS PATTERN:
- First response: Use tools to do the work
- Second response: Text summary of what was done (NO MORE TOOLS)

EXAMPLE:
Request: "Analyze the code and save findings"
Your first response: [Use Read tool, Write tool]
Your second response: "I've completed the analysis. The code implements a middleware pipeline pattern with..." 

THIS IS A HARD REQUIREMENT. After seeing tool results, you MUST provide only text.`;
      } else {
        // Parent/orchestrator agent - manages workflow  
        systemPrompt += `\n\n### ORCHESTRATION PROTOCOL
As the orchestrator, you manage the overall workflow.
When delegating to other agents via the Task tool, you will receive their response as the result.
Use these responses to coordinate the overall task completion.`;
      }
      
      ctx.messages.push(
        { role: 'system', content: systemPrompt },
        { role: 'user', content: ctx.prompt }
      );
    }

    // Log user prompt (only on first iteration)
    if (ctx.iteration === 1) {
      ctx.logger.log({
        timestamp: new Date().toISOString(),
        agentName: ctx.agentName,
        depth: ctx.executionContext.depth,
        type: 'user',
        content: ctx.prompt,
      });
    }

    await next();
  };
}
