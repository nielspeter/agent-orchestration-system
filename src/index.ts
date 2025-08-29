import * as path from 'path';
import * as dotenv from 'dotenv';
import { AgentLoader } from './core/agent-loader';
import { ToolRegistry } from './core/tool-registry';
import { AgentExecutor } from './core/agent-executor';
import { OpenAIProvider } from './llm/provider';
import { createTaskTool } from './tools/task-tool';
import { createReadTool, createWriteTool, createListTool } from './tools/file-tools';

// Load environment variables
dotenv.config();

export class AgentOrchestrationSystem {
  private readonly agentLoader: AgentLoader;
  private readonly toolRegistry: ToolRegistry;
  private readonly llmProvider: OpenAIProvider;
  private readonly executor: AgentExecutor;

  constructor(config: {
    agentsDir: string;
    apiKey: string;
  }) {
    // Initialize components
    this.agentLoader = new AgentLoader(config.agentsDir);
    this.toolRegistry = new ToolRegistry();
    this.llmProvider = new OpenAIProvider(config.apiKey, this.toolRegistry);
    this.executor = new AgentExecutor(
      this.agentLoader,
      this.toolRegistry,
      this.llmProvider
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
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    console.error('Please set OPENAI_API_KEY or OPENROUTER_API_KEY environment variable');
    process.exit(1);
  }

  const system = new AgentOrchestrationSystem({
    agentsDir: path.join(__dirname, '../agents'),
    apiKey
  });

  // Example: Ask orchestrator to analyze and document code
  const result = await system.execute(
    'orchestrator',
    'Analyze the file src/core/agent-executor.ts and create a summary of how it works'
  );

  console.log(result);
}

// Run if this is the main module
if (require.main === module) {
  main().catch(console.error);
}

export { AgentLoader, ToolRegistry, AgentExecutor, OpenAIProvider };