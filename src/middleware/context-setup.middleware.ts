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

    // PULL ARCHITECTURE: Don't inherit parent messages
    // Child agents will use tools to gather what they need
    if (ctx.executionContext.parentMessages && ctx.executionContext.parentMessages.length > 0) {
      ctx.logger.log({
        timestamp: new Date().toISOString(),
        agentName: ctx.agentName,
        depth: ctx.executionContext.depth,
        type: 'system',
        content: `Pull architecture: NOT inheriting parent messages. Agent will gather context via tools.`,
        metadata: {
          parentMessagesAvailable: ctx.executionContext.parentMessages.length,
          pullArchitecture: true,
          toolsAvailable: ctx.tools?.map(t => t.name).join(', ') || 'none',
        },
      });
      // Don't push parent messages - child starts fresh!
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
        systemPrompt += `\n\n### CRITICAL: YOU ARE A DELEGATED SPECIALIST (PULL ARCHITECTURE)
You were called by ${ctx.executionContext.parentAgent} to complete a specific task.

IMPORTANT: You start with a clean slate - no inherited context from parent.
You must use your tools to discover and gather any information you need.

YOUR APPROACH:
1. Understand the task from the delegation prompt
2. Use tools (Read, Grep, List, etc.) to discover relevant files and information
3. Build your understanding progressively through tool usage
4. Complete the requested work
5. Return a clear summary of what you accomplished

PULL-BASED DISCOVERY PATTERN:
- If asked to "analyze auth.ts" → Use Read tool to get the file
- If asked to "debug login issue" → Use Grep to find login-related files, then Read them
- If asked to "understand architecture" → Use List to explore structure, Read key files
- Don't expect context from parent - gather what you need autonomously!

COMPLETION PROTOCOL:
After completing your investigation and work:
- Provide a clear text summary of what you discovered and accomplished
- This summary is your RETURN VALUE to ${ctx.executionContext.parentAgent}
- Focus on results, not process

Remember: You have full autonomy to investigate and discover. Use your tools!`;
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
