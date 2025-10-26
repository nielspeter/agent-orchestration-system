import { Middleware } from './middleware-types';

/**
 * Adds skill loading hints based on prompt patterns
 *
 * Analyzes the user prompt and suggests relevant skills to load.
 * This guides the agent to load domain knowledge before starting work.
 */
function addSkillHints(prompt: string, systemPrompt: string, hasSkillTool: boolean): string {
  // Skip hints if skill tool is not available
  if (!hasSkillTool) {
    return systemPrompt;
  }

  const hints: string[] = [];

  // Pattern matching for common tasks
  if (prompt.match(/danish|dansk|udbud|tender/i)) {
    hints.push('danish-tender-guidelines');
  }

  if (prompt.match(/complexity|estimate|effort/i)) {
    hints.push('complexity-calculator');
  }

  if (prompt.match(/architect|design|structure/i)) {
    hints.push('architecture-analyzer');
  }

  // No hints needed
  if (hints.length === 0) {
    return systemPrompt;
  }

  // Add prominent hints
  systemPrompt += '\n\n' + '═'.repeat(60) + '\n';
  systemPrompt += '⚠️  **RECOMMENDED SKILLS FOR THIS TASK**\n\n';
  systemPrompt += 'Consider loading these skills FIRST:\n\n';

  hints.forEach((skill, i) => {
    systemPrompt += `${i + 1}. skill({name: "${skill}"})\n`;
  });

  systemPrompt += '\n' + '═'.repeat(60) + '\n';

  return systemPrompt;
}

/**
 * Sets up initial context and conversation messages
 */
export function createContextSetupMiddleware(): Middleware {
  return async (ctx, next) => {
    // Initialize messages array if not already present
    if (!ctx.messages) {
      ctx.messages = [];
    }

    // Pull architecture: Child agents start fresh without parent messages
    // They use tools to gather information they need

    // Add agent's system prompt and user prompt (only on first iteration)
    if (ctx.agent && ctx.iteration === 1) {
      // Build enhanced system prompt with system-level instructions
      let systemPrompt = ctx.agent.description || '';

      // Add session context if available
      if (ctx.sessionId) {
        systemPrompt = `## SESSION CONTEXT\nSession ID: ${ctx.sessionId}\n\n${systemPrompt}`;
      }

      // Add skill hints if skill tool is available
      const hasSkillTool = ctx.tools?.some((t) => t.name === 'skill') || false;

      if (hasSkillTool) {
        const userPrompt = ctx.prompt || '';
        systemPrompt = addSkillHints(userPrompt, systemPrompt, hasSkillTool);
      }

      // Always add system-level instructions
      systemPrompt += '\n\n## SYSTEM INSTRUCTIONS';

      // Add dynamic tool availability information
      if (ctx.tools && ctx.tools.length > 0) {
        const toolNames = ctx.tools.map((t) => t.name).join(', ');
        const toolDescriptions = ctx.tools.map((t) => `- ${t.name}: ${t.description}`).join('\n');
        systemPrompt += `\n\n### AVAILABLE TOOLS
You have access to ONLY the following tools: ${toolNames}
DO NOT attempt to use any other tools or delegate to other agents unless you have the Delegate tool.
${toolDescriptions}`;
      } else {
        systemPrompt +=
          '\n\n### AVAILABLE TOOLS\nYou have no tools available. Provide your response as text only.';
      }

      // Add task completion protocol based on agent role
      if (ctx.executionContext.parentAgent) {
        // Child agent - MUST return result to parent
        systemPrompt += `\n\n### CRITICAL: YOU ARE A DELEGATED SPECIALIST
You were called by ${ctx.executionContext.parentAgent} to complete a specific task.

YOUR APPROACH:
1. Understand the task from the delegation prompt
2. Use tools (Read, Grep, List, etc.) to discover relevant files and information
3. Build your understanding progressively through tool usage
4. Complete the requested work
5. Return a clear summary of what you accomplished

DISCOVERY PATTERNS:
- If asked to "analyze auth.ts" → Use Read tool to get the file
- If asked to "debug login issue" → Use Grep to find login-related files, then Read them
- If asked to "understand architecture" → Use List to explore structure, Read key files

COMPLETION PROTOCOL:
After completing your work:
- Provide a clear text summary of what you discovered and accomplished
- This summary is your RETURN VALUE to ${ctx.executionContext.parentAgent}
- Focus on results, not process

Remember: You have full autonomy to investigate and discover. Use your tools!`;
      } else {
        // Parent/orchestrator agent - manages workflow
        systemPrompt += `\n\n### ORCHESTRATION PROTOCOL
As the orchestrator, you manage the overall workflow.
When delegating to other agents via the Delegate tool, you will receive their response as the result.
Use these responses to coordinate the overall task completion.`;
      }

      ctx.messages.push(
        { role: 'system', content: systemPrompt },
        { role: 'user', content: ctx.prompt }
      );
    }

    // Log user prompt (only on first iteration)
    if (ctx.iteration === 1) {
      ctx.logger.logUserMessage(ctx.prompt);
    }

    await next();
  };
}
