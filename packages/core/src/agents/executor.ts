import { AgentLoader } from './loader';
import { ToolRegistry } from '@/tools/registry/registry';
import { ExecutionContext, Message } from '@/base-types';
import { AgentLogger, LoggerFactory } from '@/logging';
import { ResolvedSystemConfig } from '@/config/types';
import { MiddlewarePipeline } from '@/middleware/pipeline';
import { MiddlewareContext } from '@/middleware/middleware-types';
import { SimpleSessionManager } from '@/session/manager';
import { createAgentLoaderMiddleware } from '@/middleware/agent-loader.middleware';
import { createContextSetupMiddleware } from '@/middleware/context-setup.middleware';
import { createSafetyChecksMiddleware } from '@/middleware/safety-checks.middleware';
import { createProviderSelectionMiddleware } from '@/middleware/provider-selection.middleware';
import { createLLMCallMiddleware } from '@/middleware/llm-call.middleware';
import { createSmartRetryMiddleware } from '@/middleware/smart-retry.middleware';
import { createThinkingMiddleware } from '@/middleware/thinking.middleware';
import { createToolExecutionMiddleware } from '@/middleware/tool-execution.middleware';
import { createErrorHandlerMiddleware } from '@/middleware/error-handler.middleware';
import { DEFAULTS } from '@/config/defaults';

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
  private readonly logger: AgentLogger;
  private readonly modelName: string;
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
   * @param sessionManager - Optional session manager for automatic recovery
   */
  constructor(
    private readonly agentLoader: AgentLoader,
    private readonly toolRegistry: ToolRegistry,
    private readonly config: ResolvedSystemConfig,
    modelName?: string,
    logger?: AgentLogger,
    sessionId?: string,
    private readonly sessionManager?: SimpleSessionManager
  ) {
    this.sessionId = sessionId;
    this.logger = logger || LoggerFactory.createCombinedLogger(sessionId);
    this.modelName = modelName || this.config.model;

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
   * 3. ThinkingMiddleware - Validates and normalizes thinking configuration
   * 4. ContextSetup - Initializes conversation context
   * 5. ProviderSelection - Selects appropriate LLM provider based on model
   * 6. SafetyChecks - Enforces execution limits
   * 7. SmartRetry - Retries on rate limit errors (429) with exponential backoff
   * 8. LLMCall - Communicates with the language model
   * 9. ToolExecution - Executes tools and handles delegation
   */
  private setupPipeline(): void {
    this.pipeline
      .use(createErrorHandlerMiddleware())
      .use(createAgentLoaderMiddleware(this.agentLoader, this.toolRegistry))
      .use(createThinkingMiddleware(this.config.safety)) // NEW: Validate and normalize thinking config
      .use(createContextSetupMiddleware())
      .use(
        createProviderSelectionMiddleware(this.modelName, this.config.defaultBehavior, this.logger)
      )
      .use(createSafetyChecksMiddleware(this.config.safety))
      .use(createSmartRetryMiddleware()) // NEW: Smart retry with exponential backoff
      .use(createLLMCallMiddleware())
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

    // Log agent execution start if first execution
    if (!context) {
      this.logger.logSystemMessage(
        `Agent Orchestration: ${agentName} - ${prompt.substring(0, 100)}`
      );
    }

    // Initialize execution context
    const execContext = context || {
      depth: 0,
      parentAgent: undefined,
      startTime: Date.now(),
      maxDepth: DEFAULTS.MAX_DEPTH,
      isSidechain: false,
      parentMessages: undefined,
      traceId: crypto.randomUUID(),
      parentCallId: undefined,
    };

    // Log execution start (model will be determined after agent is loaded)
    const delegationInfo = execContext.parentAgent
      ? ` (delegated from ${execContext.parentAgent})`
      : '';
    this.logger.logAgentStart(agentName, execContext.depth, `Starting execution${delegationInfo}`);

    // Add depth visualization
    const depthIndicator = '│ '.repeat(execContext.depth);
    this.logger.logSystemMessage(`${depthIndicator}→ Starting ${agentName}`);

    // Set trace context on logger if it supports it
    if ('setTraceContext' in this.logger && typeof this.logger.setTraceContext === 'function') {
      this.logger.setTraceContext(execContext.traceId, execContext.parentCallId);
    }

    // Automatically recover messages if this is a continuation of an existing session
    let initialMessages: Message[] = [];
    if (!context && this.sessionManager && this.sessionId) {
      // Only recover for top-level execution, not delegated calls
      try {
        const recovered = await this.sessionManager.recoverSession(this.sessionId);
        if (recovered.length > 0) {
          // Messages are now the same type - no conversion needed
          initialMessages = recovered;
          this.logger.logSystemMessage(
            `Automatically continuing session ${this.sessionId} with ${recovered.length} recovered messages`
          );
        }
      } catch {
        // Session doesn't exist yet, start fresh
        this.logger.logSystemMessage(`Starting new session ${this.sessionId}`);
      }
    }

    // Create middleware context with recovered messages if any
    const middlewareContext: MiddlewareContext = {
      agentName,
      prompt,
      executionContext: execContext,
      messages: initialMessages,
      iteration: 0,
      logger: this.logger,
      modelName: this.modelName,
      shouldContinue: true,
      result: undefined,
      sessionId: this.sessionId,
      traceId: execContext.traceId,
      parentCallId: execContext.parentCallId,
      // Initialize thinking metrics from execution context (flows through delegations)
      thinkingMetrics: execContext.thinkingMetrics,
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
    this.logger.logAgentComplete(agentName, totalTime);

    // Flush logger
    this.logger.flush();

    return middlewareContext.result || 'No response generated';
  }
}
