import { ExecutionContext, Message, ToolCall, ToolResult } from '../types';
import { ToolRegistry } from '../core/tool-registry';
import { MiddlewareContext } from '../middleware/middleware-types';

/**
 * Represents a group of tools that can be executed together
 *
 * @property isConcurrencySafe - Whether these tools can run in parallel
 * @property tools - Array of tool calls in this group
 */
export interface ToolGroup {
  isConcurrencySafe: boolean;
  tools: ToolCall[];
}

/**
 * Function signature for delegating execution to another agent
 * Used by the Task tool to recursively execute child agents
 */
export type ExecuteDelegate = (
  agentName: string,
  prompt: string,
  context: ExecutionContext
) => Promise<string>;

/**
 * Groups tool calls by their concurrency safety for optimal execution
 *
 * Safe tools (Read, List, Grep) can run in parallel.
 * Unsafe tools (Write, Task) must run sequentially.
 *
 * @param toolCalls - Array of tool calls from the LLM
 * @param toolRegistry - Registry to check tool safety
 * @returns Array of tool groups ordered for execution
 *
 * @example
 * Input: [Read1, Read2, Write1, Read3]
 * Output: [{safe: true, tools: [Read1, Read2]}, {safe: false, tools: [Write1]}, {safe: true, tools: [Read3]}]
 */
export function groupToolsByConcurrency(
  toolCalls: ToolCall[],
  toolRegistry: ToolRegistry
): ToolGroup[] {
  const groups: ToolGroup[] = [];

  for (const toolCall of toolCalls) {
    const tool = toolRegistry.get(toolCall.function.name);
    const isSafe = tool ? tool.isConcurrencySafe() : false;

    const currentGroup = groups[groups.length - 1];
    if (currentGroup && currentGroup.isConcurrencySafe === isSafe) {
      currentGroup.tools.push(toolCall);
    } else {
      groups.push({
        isConcurrencySafe: isSafe,
        tools: [toolCall],
      });
    }
  }

  return groups;
}

/**
 * Executes tools sequentially (one at a time)
 *
 * Used for tools that modify state or delegate to other agents.
 * Ensures operations complete in order without race conditions.
 *
 * @param toolCalls - Tools to execute in sequence
 * @param ctx - Middleware context with agent state
 * @param toolRegistry - Registry to lookup tool implementations
 * @param executeDelegate - Function for recursive agent delegation
 * @returns Array of tool result messages
 */
export async function executeToolsSequentially(
  toolCalls: ToolCall[],
  ctx: MiddlewareContext,
  toolRegistry: ToolRegistry,
  executeDelegate: ExecuteDelegate
): Promise<Message[]> {
  const results: Message[] = [];

  ctx.logger.log({
    timestamp: new Date().toISOString(),
    agentName: ctx.agentName,
    depth: ctx.executionContext.depth,
    type: 'system',
    content: `[SEQUENTIAL] Executing ${toolCalls.length} tool(s) sequentially`,
    metadata: { tools: toolCalls.map((t) => t.function.name) },
  });

  for (const toolCall of toolCalls) {
    const result = await executeSingleTool(toolCall, ctx, toolRegistry, executeDelegate);
    results.push(result);
  }

  return results;
}

/**
 * Executes tools concurrently with batching
 */
export async function executeToolsConcurrently(
  toolCalls: ToolCall[],
  ctx: MiddlewareContext,
  toolRegistry: ToolRegistry,
  executeDelegate: ExecuteDelegate
): Promise<Message[]> {
  const MAX_CONCURRENT = 10;

  ctx.logger.log({
    timestamp: new Date().toISOString(),
    agentName: ctx.agentName,
    depth: ctx.executionContext.depth,
    type: 'system',
    content: `[PARALLEL] Executing ${toolCalls.length} tool(s) in parallel (max ${MAX_CONCURRENT})`,
    metadata: { tools: toolCalls.map((t) => t.function.name) },
  });

  const results: Message[] = [];

  // Execute in batches to avoid overwhelming the system
  for (let i = 0; i < toolCalls.length; i += MAX_CONCURRENT) {
    const batch = toolCalls.slice(i, i + MAX_CONCURRENT);
    const batchPromises = batch.map((toolCall) =>
      executeSingleTool(toolCall, ctx, toolRegistry, executeDelegate)
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Executes a single tool call
 *
 * Handles special cases like Task delegation and provides
 * detailed logging and error handling for each tool execution.
 *
 * @param toolCall - The tool to execute
 * @param ctx - Middleware context
 * @param toolRegistry - Registry to lookup tool implementation
 * @param executeDelegate - Function for recursive agent delegation
 * @returns Tool result message
 */
export async function executeSingleTool(
  toolCall: ToolCall,
  ctx: MiddlewareContext,
  toolRegistry: ToolRegistry,
  executeDelegate: ExecuteDelegate
): Promise<Message> {
  const tool = toolRegistry.get(toolCall.function.name);

  if (!tool) {
    return createErrorResult(toolCall.id, `Tool ${toolCall.function.name} not found`, ctx);
  }

  try {
    const args = JSON.parse(toolCall.function.arguments);
    const toolStartTime = Date.now();

    let result: ToolResult;

    if (tool.name === 'Task') {
      // Handle delegation to sub-agents
      result = await handleDelegation(args, ctx, executeDelegate);
    } else {
      // Regular tool execution
      ctx.logger.log({
        timestamp: new Date().toISOString(),
        agentName: ctx.agentName,
        depth: ctx.executionContext.depth,
        type: 'tool',
        content: `Executing ${tool.name}`,
        metadata: {
          toolName: tool.name,
          args,
        },
      });

      result = await tool.execute(args);
    }

    const toolExecutionTime = Date.now() - toolStartTime;

    ctx.logger.log({
      timestamp: new Date().toISOString(),
      agentName: ctx.agentName,
      depth: ctx.executionContext.depth,
      type: 'result',
      content: `${tool.name} completed in ${toolExecutionTime}ms`,
      metadata: {
        toolName: tool.name,
        executionTime: toolExecutionTime,
        result: result.error ? { error: result.error } : { success: true },
      },
    });

    return {
      role: 'tool',
      tool_call_id: toolCall.id,
      content: JSON.stringify(result),
    };
  } catch (error) {
    return createErrorResult(toolCall.id, `Tool execution failed: ${error}`, ctx, tool?.name);
  }
}

/**
 * Task tool arguments interface
 */
interface TaskArgs {
  subagent_type: string;
  prompt: string;
  [key: string]: unknown; // Allow additional properties
}

/**
 * Handles delegation to sub-agents
 */
async function handleDelegation(
  args: TaskArgs,
  ctx: MiddlewareContext,
  executeDelegate: ExecuteDelegate
): Promise<ToolResult> {
  // PULL ARCHITECTURE: Don't pass parent messages to child agents
  // Child agents will use tools to gather the information they need

  ctx.logger.log({
    timestamp: new Date().toISOString(),
    agentName: ctx.agentName,
    depth: ctx.executionContext.depth,
    type: 'delegation',
    content: `[SIDECHAIN] Delegating to ${args.subagent_type}`,
    metadata: {
      subAgent: args.subagent_type,
      toolName: 'Task',
      prompt: args.prompt,
      parentContextSize: 0,
    },
  });

  const subAgentResult = await executeDelegate(args.subagent_type, args.prompt, {
    ...ctx.executionContext,
    depth: ctx.executionContext.depth + 1,
    parentAgent: ctx.agentName,
    isSidechain: true,
    parentMessages: [], // Empty array - child starts fresh (Claude Code style)
  });

  return { content: subAgentResult };
}

/**
 * Creates an error result message
 */
function createErrorResult(
  toolCallId: string,
  error: string,
  ctx: MiddlewareContext,
  toolName?: string
): Message {
  ctx.logger.log({
    timestamp: new Date().toISOString(),
    agentName: ctx.agentName,
    depth: ctx.executionContext.depth,
    type: 'error',
    content: error,
    metadata: toolName ? { toolName } : undefined,
  });

  return {
    role: 'tool',
    tool_call_id: toolCallId,
    content: JSON.stringify({ error }),
  };
}
