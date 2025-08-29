import * as path from 'path';
import * as dotenv from 'dotenv';
import { AgentLoader } from './core/agent-loader';
import { ToolRegistry } from './core/tool-registry';
import { AgentExecutorAnthropic } from './core/agent-executor-anthropic';
import { createTaskTool } from './tools/task-tool';
import { createReadTool, createWriteTool, createListTool } from './tools/file-tools';
import { LoggerFactory } from './core/conversation-logger';

// Load environment variables
dotenv.config();

export class AgentOrchestrationSystem {
  private readonly agentLoader: AgentLoader;
  private readonly toolRegistry: ToolRegistry;
  private readonly executor: AgentExecutorAnthropic;

  constructor(config: {
    agentsDir: string;
    modelName?: string;
  }) {
    // Initialize components
    this.agentLoader = new AgentLoader(config.agentsDir);
    this.toolRegistry = new ToolRegistry();
    const logger = LoggerFactory.createCombinedLogger();
    
    this.executor = new AgentExecutorAnthropic(
      this.agentLoader,
      this.toolRegistry,
      config.modelName || 'claude-3-5-haiku-20241022',
      logger
    );

    // Register default tools
    this.registerDefaultTools();
  }

  private registerDefaultTools() {
    // File tools
    this.toolRegistry.register(createReadTool());
    this.toolRegistry.register(createWriteTool());
    this.toolRegistry.register(createListTool());
    
    // The special Task tool for delegation
    this.toolRegistry.register(createTaskTool());
  }

  async execute(agentName: string, prompt: string): Promise<string> {
    return this.executor.execute(agentName, prompt);
  }

  registerTool(tool: any) {
    this.toolRegistry.register(tool);
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
    agentsDir: path.join(__dirname, '../agents'),
    modelName: process.env.MODEL || 'claude-3-5-haiku-20241022'
  });

  // Example: Ask orchestrator to analyze and document code
  const result = await system.execute(
    'orchestrator',
    'Analyze the file src/core/agent-executor-anthropic.ts and create a summary of how it works'
  );

  console.log(result);
}

// Run if this is the main module
if (require.main === module) {
  main().catch(console.error);
}

export { AgentLoader, ToolRegistry, AgentExecutorAnthropic };