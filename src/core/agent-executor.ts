import { AgentLoader } from './agent-loader';
import { ToolRegistry } from './tool-registry';
import { AnthropicProvider } from '../llm/anthropic-provider';
import { ExecutionContext } from '../types';
import { ConversationLogger, LoggerFactory } from './conversation-logger';
import { ResolvedSystemConfig } from '../config/types';
import { MiddlewarePipeline } from '../middleware/pipeline';
import { MiddlewareContext } from '../middleware/middleware-types';
import { createAgentLoaderMiddleware } from '../middleware/agent-loader.middleware';
import { createContextSetupMiddleware } from '../middleware/context-setup.middleware';
import { createSafetyChecksMiddleware } from '../middleware/safety-checks.middleware';
import { createLLMCallMiddleware } from '../middleware/llm-call.middleware';
import { createToolExecutionMiddleware } from '../middleware/tool-execution.middleware';
import { createErrorHandlerMiddleware } from '../middleware/error-handler.middleware';

/**
 * AgentExecutor - Core orchestration engine for agent-based task execution
 *
 * Implements a middleware pipeline architecture where agents can autonomously
 * execute tools and delegate to other agents. Uses pull architecture where
 * child agents receive minimal context and gather information via tools.
 *
 * @example
 * ```typescript
 * const executor = new AgentExecutor(agentLoader, toolRegistry);
 * const result = await executor.execute('orchestrator', 'Analyze the codebase');
 * ```
 */
export class AgentExecutor {
  private readonly logger: ConversationLogger;
  private readonly provider: AnthropicProvider;
  private readonly pipeline: MiddlewarePipeline;
  private readonly sessionId?: string;

  /**
   * Creates a new AgentExecutor instance
   *
   * @param agentLoader - Loads agent definitions from markdown files
   * @param toolRegistry - Registry of available tools agents can use
   * @param config - System configuration
   * @param modelName - Optional LLM model name (defaults to config)
   * @param logger - Optional custom logger (creates default if not provided)
   * @param sessionId - Optional session ID for conversation tracking
   */
  constructor(
    private readonly agentLoader: AgentLoader,
    private readonly toolRegistry: ToolRegistry,
    private readonly config: ResolvedSystemConfig,
    modelName?: string,
    logger?: ConversationLogger,
    sessionId?: string
  ) {
    this.sessionId = sessionId;
    this.logger = logger || LoggerFactory.createCombinedLogger(sessionId);
    const finalModelName = modelName || this.config.model;
    this.provider = new AnthropicProvider(finalModelName, this.logger);

    // Build the middleware pipeline
    this.pipeline = new MiddlewarePipeline();
    this.setupPipeline();
  }

  /**
   * Sets up the middleware pipeline in execution order
   *
   * Pipeline order:
   * 1. ErrorHandler - Catches and handles all errors
   * 2. AgentLoader - Loads agent definition and filters tools
   * 3. ContextSetup - Initializes conversation context
   * 4. SafetyChecks - Enforces execution limits
   * 5. LLMCall - Communicates with the language model
   * 6. ToolExecution - Executes tools and handles delegation
   */
  private setupPipeline(): void {
    this.pipeline
      .use(createErrorHandlerMiddleware())
      .use(createAgentLoaderMiddleware(this.agentLoader, this.toolRegistry))
      .use(createContextSetupMiddleware())
      .use(createSafetyChecksMiddleware(this.config.safety))
      .use(createLLMCallMiddleware(this.provider))
      .use(createToolExecutionMiddleware(this.toolRegistry, this.execute.bind(this)));
  }

  /**
   * Executes an agent with a given prompt
   *
   * @param agentName - Name of the agent to execute
   * @param prompt - The task or question for the agent
   * @param context - Optional execution context (used for delegation)
   * @returns The agent's response as a string
   *
   * @throws Error if agent not found or execution fails
   */
  async execute(agentName: string, prompt: string, context?: ExecutionContext): Promise<string> {
    const startTime = Date.now();

    // Initialize JSONL logger with summary if first execution
    if (!context && this.logger.initialize) {
      await this.logger.initialize(
        `Agent Orchestration: ${agentName} - ${prompt.substring(0, 100)}`
      );
    }

    // Initialize execution context
    const execContext = context || {
      depth: 0,
      parentAgent: undefined,
      startTime: Date.now(),
      maxDepth: 10,
      isSidechain: false,
      parentMessages: undefined,
    };

    // Log execution start
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

    // Add depth visualization
    const depthIndicator = '│ '.repeat(execContext.depth);
    this.logger.log({
      timestamp: new Date().toISOString(),
      agentName,
      depth: execContext.depth,
      type: 'system',
      content: `${depthIndicator}→ Starting ${agentName}`,
    });

    // Create middleware context
    const middlewareContext: MiddlewareContext = {
      agentName,
      prompt,
      executionContext: execContext,
      messages: [],
      iteration: 0,
      logger: this.logger,
      modelName: this.provider.getModelName(),
      shouldContinue: true,
      result: undefined,
      sessionId: this.sessionId,
    };

    // Main execution loop with timeout protection
    const safetyLimits = this.config.safety;
    const maxExecutionTime = 5 * 60 * 1000; // 5 minutes max for POC
    const executionStartTime = Date.now();

    while (
      middlewareContext.shouldContinue &&
      middlewareContext.iteration < safetyLimits.maxIterations &&
      !middlewareContext.error
    ) {
      // Check timeout
      if (Date.now() - executionStartTime > maxExecutionTime) {
        middlewareContext.result = 'Execution timeout (5 minutes) - task may be too complex';
        middlewareContext.shouldContinue = false;
        break;
      }

      middlewareContext.iteration++;

      // Run the pipeline for this iteration
      await this.pipeline.execute(middlewareContext);

      // Check if we have a result or error
      if (middlewareContext.result || middlewareContext.error) {
        break;
      }

      // If no result and shouldContinue is false, we're done
      if (!middlewareContext.shouldContinue) {
        break;
      }
    }

    // Log completion
    const totalTime = Date.now() - startTime;
    this.logger.log({
      timestamp: new Date().toISOString(),
      agentName,
      depth: execContext.depth,
      type: 'result',
      content: `Execution completed in ${totalTime}ms`,
      metadata: {
        executionTime: totalTime,
        iterations: middlewareContext.iteration,
        model: this.provider.getModelName(),
        totalMessages: middlewareContext.messages.length,
        cachedMessages: execContext.parentMessages?.length || 0,
      },
    });

    // Flush logger
    await this.logger.flush();

    return middlewareContext.result || 'No response generated';
  }
}
