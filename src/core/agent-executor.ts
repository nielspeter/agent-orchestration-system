import { AgentLoader } from './agent-loader';
import { ToolRegistry } from './tool-registry';
import { AnthropicProvider } from '../llm/anthropic-provider';
import { ExecutionContext, Message, ToolCall, ToolResult, BaseTool } from '../types';
import { ConversationLogger, LoggerFactory } from './conversation-logger';
import { MessageValidator } from './message-validator';
import { ConfigManager } from '../config/config-manager';

export class AgentExecutor {
  private readonly logger: ConversationLogger;
  private readonly provider: AnthropicProvider;
  private readonly messageValidator: MessageValidator;
  private readonly config = ConfigManager.getInstance();

  constructor(
    private readonly agentLoader: AgentLoader,
    private readonly toolRegistry: ToolRegistry,
    modelName?: string,
    logger?: ConversationLogger
  ) {
    this.logger = logger || LoggerFactory.createCombinedLogger();
    const finalModelName = modelName || this.config.getModels().defaultModel;
    this.provider = new AnthropicProvider(finalModelName, this.logger);
    this.messageValidator = new MessageValidator(this.logger);
  }

  async execute(agentName: string, prompt: string, context?: ExecutionContext): Promise<string> {
    const startTime = Date.now();

    // Initialize context if not provided
    const execContext = context || {
      depth: 0,
      parentAgent: undefined,
      startTime: Date.now(),
      maxDepth: 10,
      isSidechain: false,
      parentMessages: undefined,
    };

    // Log the execution start
    this.logger.log({
      timestamp: new Date().toISOString(),
      agentName,
      depth: execContext.depth,
      type: 'system',
      content: `Starting execution with ${this.provider.getModelName()}${execContext.parentAgent ? ` (delegated from ${execContext.parentAgent})` : ''}`,
      metadata: {
        parentAgent: execContext.parentAgent,
        isSidechain: execContext.isSidechain,
        model: this.provider.getModelName(),
        hasParentContext: !!execContext.parentMessages,
        parentMessageCount: execContext.parentMessages?.length || 0,
      },
    });

    // Check recursion depth with helpful message
    const safetyLimits = this.config.getSafety();
    const effectiveMaxDepth = Math.min(execContext.maxDepth, safetyLimits.maxDepth);
    if (execContext.depth >= effectiveMaxDepth) {
      const msg =
        `Max delegation depth (${effectiveMaxDepth}) reached. ` +
        'Consider breaking task into smaller parts.';
      this.logger.log({
        timestamp: new Date().toISOString(),
        agentName,
        depth: execContext.depth,
        type: 'system',
        content: `🛑 ${msg}`,
      });
      return msg; // Return helpful message instead of throwing
    }

    // Add depth visualization
    const depthIndicator = '│ '.repeat(execContext.depth);
    this.logger.log({
      timestamp: new Date().toISOString(),
      agentName,
      depth: execContext.depth,
      type: 'system',
      content: `${depthIndicator}→ Starting ${agentName}`,
    });

    // Load agent definition
    const agent = await this.agentLoader.loadAgent(agentName);
    this.logger.log({
      timestamp: new Date().toISOString(),
      agentName,
      depth: execContext.depth,
      type: 'system',
      content: `Agent loaded: ${agent.name}`,
      metadata: {
        toolCount: Array.isArray(agent.tools) ? agent.tools.length : 'all',
      },
    });

    // Get tools available to this agent
    const tools = this.toolRegistry.filterForAgent(agent);

    // Initialize conversation with parent context if available
    const messages: Message[] = [];

    // CRITICAL: Include parent messages for context inheritance
    if (execContext.parentMessages) {
      // Add all parent messages (they will be cached)
      messages.push(...execContext.parentMessages);

      this.logger.log({
        timestamp: new Date().toISOString(),
        agentName,
        depth: execContext.depth,
        type: 'system',
        content: `Inheriting ${execContext.parentMessages.length} messages from parent context`,
        metadata: {
          parentMessageTypes: execContext.parentMessages.map((m) => m.role).join(', '),
        },
      });
    }

    // Add this agent's system prompt and the new user prompt
    messages.push(
      { role: 'system', content: agent.description },
      { role: 'user', content: prompt }
    );

    // Log user prompt
    this.logger.log({
      timestamp: new Date().toISOString(),
      agentName,
      depth: execContext.depth,
      type: 'user',
      content: prompt,
    });

    // Execution loop with safety limits
    let iterationCount = 0;
    while (iterationCount < safetyLimits.maxIterations) {
      iterationCount++;

      // Warn at high iteration count
      if (iterationCount === safetyLimits.warnAtIteration) {
        console.warn(`⚠️ High iteration count: ${iterationCount} - possible complex task`);
      }

      // Estimate tokens and check limit
      const estimatedTokens = JSON.stringify(messages).length / 4;
      if (estimatedTokens > safetyLimits.maxTokensEstimate) {
        const msg = `Token limit estimate exceeded: ~${Math.round(estimatedTokens)} tokens`;
        console.warn(`⚠️ ${msg}`);
        this.logger.log({
          timestamp: new Date().toISOString(),
          agentName,
          depth: execContext.depth,
          type: 'system',
          content: `🛑 Stopping: ${msg}`,
        });
        return `Task stopped: ${msg} (safety limit)`;
      }

      // Call LLM with current conversation and available tools
      this.logger.log({
        timestamp: new Date().toISOString(),
        agentName,
        depth: execContext.depth,
        type: 'system',
        content: `Calling ${this.provider.getModelName()} (iteration ${iterationCount})`,
        metadata: {
          messageCount: messages.length,
          toolCount: tools.length,
          willCacheCount: messages.length - 1, // All but last message
          parentContext: !!execContext.parentMessages,
        },
      });

      // Validate and fix message history before calling provider
      const validatedMessages = this.messageValidator.validateAndFixMessages(messages, agentName);

      // Call provider with validated message history
      const response = await this.provider.complete(validatedMessages, tools);

      // Log assistant response
      this.logger.log({
        timestamp: new Date().toISOString(),
        agentName,
        depth: execContext.depth,
        type: 'assistant',
        content: response.content || '[No content, tool calls only]',
        metadata: {
          toolCallCount: response.tool_calls?.length || 0,
        },
      });

      // Check for tool calls
      if (response.tool_calls && response.tool_calls.length > 0) {
        // Validate tool call IDs are unique
        this.messageValidator.validateToolCallIds(response.tool_calls, agentName);

        // Add assistant's response with tool calls
        messages.push(response);

        // Group tool calls by concurrency safety
        const toolGroups = this.groupToolsByConcurrency(response.tool_calls);

        // Log execution strategy
        this.logger.log({
          timestamp: new Date().toISOString(),
          agentName,
          depth: execContext.depth,
          type: 'system',
          content: `Executing ${response.tool_calls.length} tools in ${toolGroups.length} group(s)`,
          metadata: {
            groups: toolGroups.map((g) => ({
              isConcurrent: g.isConcurrencySafe,
              tools: g.tools.map((t) => t.function.name),
            })),
          },
        });

        // Execute tool groups
        for (const group of toolGroups) {
          const toolResults = group.isConcurrencySafe
            ? await this.executeToolsConcurrently(group.tools, agentName, execContext, messages)
            : await this.executeToolsSequentially(group.tools, agentName, execContext, messages);

          // Add all results to messages
          for (const result of toolResults) {
            messages.push(result);
          }
        }

        // Continue loop to let agent process tool results
        continue;
      }

      // No tool calls - agent is done
      const totalTime = Date.now() - startTime;
      this.logger.log({
        timestamp: new Date().toISOString(),
        agentName,
        depth: execContext.depth,
        type: 'result',
        content: `Execution completed in ${totalTime}ms`,
        metadata: {
          executionTime: totalTime,
          iterations: iterationCount,
          model: this.provider.getModelName(),
          totalMessages: messages.length,
          cachedMessages: execContext.parentMessages?.length || 0,
        },
      });

      // Flush logger to ensure everything is saved
      await this.logger.flush();

      return response.content || 'No response generated';
    }

    // Handle max iterations reached
    const msg = `Stopped at ${safetyLimits.maxIterations} iterations (safety limit). Task may be too complex.`;
    console.error(`🛑 ${msg}`);
    this.logger.log({
      timestamp: new Date().toISOString(),
      agentName,
      depth: execContext.depth,
      type: 'system',
      content: `🛑 ${msg}`,
    });
    return msg;
  }

  /**
   * Group tool calls by concurrency safety
   */
  private groupToolsByConcurrency(
    toolCalls: ToolCall[]
  ): Array<{ isConcurrencySafe: boolean; tools: ToolCall[] }> {
    const groups: Array<{ isConcurrencySafe: boolean; tools: ToolCall[] }> = [];

    for (const toolCall of toolCalls) {
      const tool = this.toolRegistry.get(toolCall.function.name);
      const isSafe = tool ? tool.isConcurrencySafe() : false;

      // Check if we can add to the current group
      const currentGroup = groups[groups.length - 1];
      if (currentGroup && currentGroup.isConcurrencySafe === isSafe) {
        currentGroup.tools.push(toolCall);
      } else {
        // Start a new group
        groups.push({
          isConcurrencySafe: isSafe,
          tools: [toolCall],
        });
      }
    }

    return groups;
  }

  /**
   * Execute tools sequentially
   */
  private async executeToolsSequentially(
    toolCalls: ToolCall[],
    agentName: string,
    execContext: ExecutionContext,
    currentMessages: Message[]
  ): Promise<Message[]> {
    const results: Message[] = [];

    this.logger.log({
      timestamp: new Date().toISOString(),
      agentName,
      depth: execContext.depth,
      type: 'system',
      content: `[SEQUENTIAL] Executing ${toolCalls.length} tool(s) sequentially`,
      metadata: { tools: toolCalls.map((t) => t.function.name) },
    });

    for (const toolCall of toolCalls) {
      const result = await this.executeSingleTool(
        toolCall,
        agentName,
        execContext,
        currentMessages
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Execute tools concurrently (with max concurrency limit)
   */
  private async executeToolsConcurrently(
    toolCalls: ToolCall[],
    agentName: string,
    execContext: ExecutionContext,
    currentMessages: Message[]
  ): Promise<Message[]> {
    const MAX_CONCURRENT = 10;

    this.logger.log({
      timestamp: new Date().toISOString(),
      agentName,
      depth: execContext.depth,
      type: 'system',
      content: `[PARALLEL] Executing ${toolCalls.length} tool(s) in parallel (max ${MAX_CONCURRENT})`,
      metadata: { tools: toolCalls.map((t) => t.function.name) },
    });

    const results: Message[] = [];

    // Execute in batches if needed
    for (let i = 0; i < toolCalls.length; i += MAX_CONCURRENT) {
      const batch = toolCalls.slice(i, i + MAX_CONCURRENT);
      const batchPromises = batch.map((toolCall) =>
        this.executeSingleTool(toolCall, agentName, execContext, currentMessages)
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Execute a single tool call
   */
  private async executeSingleTool(
    toolCall: ToolCall,
    agentName: string,
    execContext: ExecutionContext,
    currentMessages: Message[]
  ): Promise<Message> {
    const tool = this.toolRegistry.get(toolCall.function.name);

    if (!tool) {
      const error = `Tool ${toolCall.function.name} not found`;
      this.logger.log({
        timestamp: new Date().toISOString(),
        agentName,
        depth: execContext.depth,
        type: 'error',
        content: error,
        metadata: { toolName: toolCall.function.name },
      });

      return {
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify({ error }),
      };
    }

    try {
      const args = JSON.parse(toolCall.function.arguments);
      const toolStartTime = Date.now();

      // Special handling for Task tool (delegation)
      let result: ToolResult;
      if (tool.name === 'Task') {
        // CRITICAL: Pass the full conversation context to the subagent
        const parentMessages = currentMessages.slice(); // All current messages

        this.logger.log({
          timestamp: new Date().toISOString(),
          agentName,
          depth: execContext.depth,
          type: 'delegation',
          content: `[SIDECHAIN] Delegating to ${args.subagent_type} with full context`,
          metadata: {
            subAgent: args.subagent_type,
            toolName: 'Task',
            prompt: args.prompt,
            parentContextSize: parentMessages.length,
            contextWillBeCached: true,
          },
        });

        // Recursive call with increased depth and FULL PARENT CONTEXT
        const subAgentResult = await this.execute(args.subagent_type, args.prompt, {
          ...execContext,
          depth: execContext.depth + 1,
          parentAgent: agentName,
          isSidechain: true,
          parentMessages, // Pass full conversation history!
        });
        result = { content: subAgentResult };
      } else {
        // Regular tool execution
        this.logger.log({
          timestamp: new Date().toISOString(),
          agentName,
          depth: execContext.depth,
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

      // Log tool result
      this.logger.log({
        timestamp: new Date().toISOString(),
        agentName,
        depth: execContext.depth,
        type: 'result',
        content: `${tool.name} completed in ${toolExecutionTime}ms`,
        metadata: {
          toolName: tool.name,
          executionTime: toolExecutionTime,
          result: result.error ? { error: result.error } : { success: true },
        },
      });

      // Return tool result message
      return {
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      };
    } catch (error) {
      // Handle tool execution errors
      const errorMsg = `Tool execution failed: ${error}`;
      this.logger.log({
        timestamp: new Date().toISOString(),
        agentName,
        depth: execContext.depth,
        type: 'error',
        content: errorMsg,
        metadata: { toolName: tool.name },
      });

      return {
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify({ error: errorMsg }),
      };
    }
  }
}
