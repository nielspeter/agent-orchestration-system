import { Middleware, MiddlewareContext } from './middleware-types';
import { ToolRegistry } from '../tools/registry/registry';
import { ToolCall } from '../types';
import {
  ExecuteDelegate,
  executeToolsConcurrently,
  executeToolsSequentially,
  groupToolsByConcurrency,
} from '../tools/registry/executor-service';

/**
 * Middleware that executes tool calls from LLM responses
 *
 * This is a thin orchestrator that:
 * 1. Validates tool calls
 * 2. Groups them by concurrency safety
 * 3. Executes them using the appropriate strategy
 * 4. Adds results back to the conversation
 */
export function createToolExecutionMiddleware(
  toolRegistry: ToolRegistry,
  executeDelegate: ExecuteDelegate
): Middleware {
  return async (ctx, next) => {
    // No tools to execute - either no response or no tool calls
    if (!ctx.response?.tool_calls?.length) {
      if (ctx.response?.content) {
        ctx.result = ctx.response.content;
        ctx.shouldContinue = false;
      }
      await next();
      return;
    }

    const toolCalls = ctx.response.tool_calls;

    // Validate tool call IDs are unique
    validateToolCallIds(toolCalls, ctx);

    // Add assistant's response to messages
    ctx.messages.push(ctx.response);

    // Group tools by concurrency safety
    const toolGroups = groupToolsByConcurrency(toolCalls, toolRegistry);

    // Log execution strategy
    ctx.logger.logSystemMessage(
      `Executing ${toolCalls.length} tools in ${toolGroups.length} group(s)`
    );

    // Execute tool groups with appropriate strategy
    for (const group of toolGroups) {
      const toolResults = group.isConcurrencySafe
        ? await executeToolsConcurrently(group.tools, ctx, toolRegistry, executeDelegate)
        : await executeToolsSequentially(group.tools, ctx, toolRegistry, executeDelegate);

      // Add results to conversation
      for (const result of toolResults) {
        ctx.messages.push(result);
      }
    }

    // Key insight: We should only continue if the agent needs to process tool results
    // and provide a response. Otherwise default to false.
    ctx.shouldContinue = true; // Allow agent to see tool results and respond

    await next();
  };
}

/**
 * Validates that tool calls have unique IDs
 */
function validateToolCallIds(toolCalls: ToolCall[], ctx: MiddlewareContext): void {
  const seenIds = new Set<string>();

  for (const toolCall of toolCalls) {
    if (seenIds.has(toolCall.id)) {
      ctx.logger.logSystemMessage(`⚠️ Duplicate tool call ID detected: ${toolCall.id}`);
    }
    seenIds.add(toolCall.id);
  }
}
