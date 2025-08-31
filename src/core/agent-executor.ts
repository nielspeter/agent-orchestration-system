import { AgentLoader } from './agent-loader';
import { ToolRegistry } from './tool-registry';
import { AnthropicProvider } from '../llm/anthropic-provider';
import { ExecutionContext } from '../types';
import { ConversationLogger, LoggerFactory } from './conversation-logger';
import { ConfigManager } from '../config/config-manager';
import { MiddlewarePipeline } from '../middleware/pipeline';
import { MiddlewareContext } from '../middleware/middleware-types';
import { createAgentLoaderMiddleware } from '../middleware/agent-loader.middleware';
import { createContextSetupMiddleware } from '../middleware/context-setup.middleware';
import { createSafetyChecksMiddleware } from '../middleware/safety-checks.middleware';
import { createLLMCallMiddleware } from '../middleware/llm-call.middleware';
import { createToolExecutionMiddleware } from '../middleware/tool-execution.middleware';
import { createErrorHandlerMiddleware } from '../middleware/error-handler.middleware';

export class AgentExecutor {
  private readonly logger: ConversationLogger;
  private readonly provider: AnthropicProvider;
  private readonly config = ConfigManager.getInstance();
  private readonly pipeline: MiddlewarePipeline;

  constructor(
    private readonly agentLoader: AgentLoader,
    private readonly toolRegistry: ToolRegistry,
    modelName?: string,
    logger?: ConversationLogger,
    sessionId?: string
  ) {
    this.logger = logger || LoggerFactory.createCombinedLogger(sessionId);
    const finalModelName = modelName || this.config.getModels().defaultModel;
    this.provider = new AnthropicProvider(finalModelName, this.logger);

    // Build the middleware pipeline
    this.pipeline = new MiddlewarePipeline();
    this.setupPipeline();
  }

  private setupPipeline(): void {
    // Add middleware in order
    // Error handler wraps everything to catch any errors
    this.pipeline
      .use(createErrorHandlerMiddleware())
      .use(createAgentLoaderMiddleware(this.agentLoader, this.toolRegistry))
      .use(createContextSetupMiddleware())
      .use(createSafetyChecksMiddleware())
      .use(createLLMCallMiddleware(this.provider))
      .use(
        createToolExecutionMiddleware(this.toolRegistry, this.execute.bind(this)) // Pass delegate function
      );
  }

  async execute(agentName: string, prompt: string, context?: ExecutionContext): Promise<string> {
    const startTime = Date.now();

    // Initialize JSONL logger with summary if first execution
    if (!context && this.logger.initialize) {
      await this.logger.initialize(`Agent Orchestration: ${agentName} - ${prompt.substring(0, 100)}`);
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
    };

    // Main execution loop with timeout protection
    const safetyLimits = this.config.getSafety();
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
