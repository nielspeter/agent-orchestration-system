import { ExecutionContext, Message, ToolCall, ToolResult } from '@/base-types';
import { ToolRegistry } from '@/tools';
import { MiddlewareContext } from '@/middleware/middleware-types';

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
    const tool = toolRegistry.getTool(toolCall.function.name);
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

  ctx.logger.logSystemMessage(
    `[SEQUENTIAL] Executing ${toolCalls.length} tool(s) sequentially: ${toolCalls.map((t) => t.function.name).join(', ')}`
  );

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

  ctx.logger.logSystemMessage(
    `[PARALLEL] Executing ${toolCalls.length} tool(s) in parallel (max ${MAX_CONCURRENT}): ${toolCalls.map((t) => t.function.name).join(', ')}`
  );

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
  const tool = toolRegistry.getTool(toolCall.function.name);

  if (!tool) {
    // Log the missing tool as both a call and an error result
    ctx.logger.logToolCall(
      ctx.agentName,
      toolCall.function.name,
      toolCall.id,
      {},
      ctx.lastLLMMetadata
    );
    ctx.logger.logToolResult(ctx.agentName, toolCall.function.name, toolCall.id, {
      error: true,
      message: `Tool ${toolCall.function.name} not found`,
    });
    return createErrorResult(toolCall.id, `Tool ${toolCall.function.name} not found`, ctx);
  }

  // Parse arguments once and handle errors properly
  let parsedArgs: Record<string, unknown> = {};
  let parseError: Error | null = null;

  try {
    parsedArgs = JSON.parse(toolCall.function.arguments);
  } catch (error) {
    parseError = error as Error;
    // Use empty object for logging when parsing fails
  }

  // Always log the tool call first (even if arguments are malformed)
  // Include LLM metadata to track which model triggered this tool call
  ctx.logger.logToolCall(ctx.agentName, tool.name, toolCall.id, parsedArgs, ctx.lastLLMMetadata);

  // If parsing failed, return error result immediately
  if (parseError) {
    const errorResult = {
      content: null,
      error: `Invalid arguments: ${parseError.message}`,
    };
    ctx.logger.logToolResult(ctx.agentName, tool.name, toolCall.id, errorResult);
    return {
      role: 'tool',
      tool_call_id: toolCall.id,
      content: JSON.stringify(errorResult),
    };
  }

  // Execute the tool with parsed arguments
  let result: ToolResult;
  try {
    if (tool.name === 'Task') {
      // Handle delegation to sub-agents
      result = await handleDelegation(parsedArgs as TaskArgs, ctx, executeDelegate, toolCall.id);
    } else {
      // Regular tool execution
      result = await tool.execute(parsedArgs);
    }
  } catch (executionError) {
    // Tool execution failed - create error result
    result = {
      content: null,
      error: String(executionError),
    };
  }

  // Always log the result, whether success or failure
  ctx.logger.logToolResult(ctx.agentName, tool.name, toolCall.id, result);

  return {
    role: 'tool',
    tool_call_id: toolCall.id,
    content: JSON.stringify(result),
  };
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
  executeDelegate: ExecuteDelegate,
  parentCallId: string
): Promise<ToolResult> {
  // PULL ARCHITECTURE: Don't pass parent messages to child agents
  // will use tools to gather the information they need

  ctx.logger.logDelegation(ctx.agentName, args.subagent_type, args.prompt);

  const subAgentResult = await executeDelegate(args.subagent_type, args.prompt, {
    ...ctx.executionContext,
    depth: ctx.executionContext.depth + 1,
    parentAgent: ctx.agentName,
    isSidechain: true,
    parentMessages: [], // Empty array - child starts fresh (pull architecture)
    traceId: ctx.traceId || crypto.randomUUID(),
    parentCallId: parentCallId,
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
  if (toolName && ctx.agentName) {
    ctx.logger.logToolError(ctx.agentName, toolName, 'unknown', new Error(error));
  } else {
    ctx.logger.logSystemMessage(`Error: ${error}`);
  }

  return {
    role: 'tool',
    tool_call_id: toolCallId,
    content: JSON.stringify({ error }),
  };
}
