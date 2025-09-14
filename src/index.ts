import * as path from 'path';
import * as dotenv from 'dotenv';
import { getDirname } from '@/lib';
import { AgentExecutor, AgentLoader } from '@/agents';
import {
  createListTool,
  createReadTool,
  createTaskTool,
  createTodoWriteTool,
  createWriteTool,
  ToolRegistry,
} from '@/tools';
import { LoggerFactory } from './logging';
import { TodoManager } from '@/todos';
import { DEFAULT_SYSTEM_CONFIG, DEFAULTS, ResolvedSystemConfig } from '@/config';

// Load environment variables
dotenv.config();

/**
 * Main orchestration system that coordinates agents, tools, and execution
 *
 * This class serves as the primary entry point for the agent orchestration system,
 * managing the lifecycle of agents, tools, and task execution with advanced
 * caching strategy and sophisticated prompting.
 */
export class AgentOrchestrationSystem {
  private readonly agentLoader: AgentLoader;
  private readonly toolRegistry: ToolRegistry;
  private readonly executor: AgentExecutor;
  private readonly todoManager: TodoManager;
  private readonly config: ResolvedSystemConfig;

  /**
   * Creates a new agent orchestration system
   *
   * @param config Configuration object
   * @param config.agentsDir Directory containing agent definition files (*.md)
   * @param config.modelName Optional model name (defaults to system config)
   */
  constructor(config: { agentsDir: string; modelName?: string }) {
    // Initialize logger first
    const logger = LoggerFactory.createCombinedLogger();

    // Initialize configuration
    this.config = {
      ...DEFAULT_SYSTEM_CONFIG,
      model: config.modelName || DEFAULT_SYSTEM_CONFIG.model,
    };

    // Initialize components
    this.agentLoader = new AgentLoader(config.agentsDir, logger);
    this.toolRegistry = new ToolRegistry();
    this.todoManager = new TodoManager();

    this.executor = new AgentExecutor(
      this.agentLoader,
      this.toolRegistry,
      this.config,
      config.modelName || this.config.defaultModel || DEFAULTS.DEFAULT_MODEL,
      logger
    );
  }

  /**
   * Initialize async components (must be called after construction)
   *
   * This method initializes the TodoManager and registers default tools.
   * It must be called before using the execute() method.
   *
   * @throws {Error} If initialization fails
   */
  async initialize(): Promise<void> {
    await this.todoManager.initialize();
    await this.registerDefaultTools();
  }

  private async registerDefaultTools(): Promise<void> {
    // File tools
    this.toolRegistry.register(createReadTool());
    this.toolRegistry.register(createWriteTool());
    this.toolRegistry.register(createListTool());

    // Task management tools
    this.toolRegistry.register(createTodoWriteTool(this.todoManager));
    this.toolRegistry.register(await createTaskTool(this.agentLoader));
  }

  /**
   * Execute a task using the specified agent
   *
   * This is the main execution method that delegates a task to a specialized agent.
   * The agent will have access to tools based on its configuration and can delegate
   * to other agents using the Task tool.
   *
   * @param agentName Name of the agent to execute (must exist in agentsDir)
   * @param prompt The task description or prompt for the agent
   * @returns Promise<string> The agent's response or result
   * @throws {Error} If agent not found or execution fails
   *
   * @example
   * ```typescript
   * const system = new AgentOrchestrationSystem({ agentsDir: './agents' });
   * await system.initialize();
   *
   * const result = await system.execute(
   *   'orchestrator',
   *   'Analyze the codebase and suggest improvements'
   * );
   * console.log(result);
   * ```
   */
  async execute(agentName: string, prompt: string): Promise<string> {
    return this.executor.execute(agentName, prompt);
  }
}

// Example usage
async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error('Please set ANTHROPIC_API_KEY environment variable');
    console.error('This system requires Anthropic Claude models for caching support');
    process.exit(1);
  }

  const system = new AgentOrchestrationSystem({
    agentsDir: path.join(getDirname(import.meta.url), '../agents'),
    modelName: process.env.MODEL || 'claude-3-5-haiku-latest',
  });

  // Initialize async components
  await system.initialize();

  // Example: Ask orchestrator to analyze and document code
  const result = await system.execute(
    'orchestrator',
    'Analyze the file src/core/agent-executor.ts and create a summary of how it works'
  );

  console.info(result);
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

// Core exports
export { AgentLoader, ToolRegistry, AgentExecutor };

// Configuration exports
export { AgentSystemBuilder, TestConfigBuilder } from './config/system-builder';
export type { BuildResult } from './config/system-builder';
export * from './config/types';
