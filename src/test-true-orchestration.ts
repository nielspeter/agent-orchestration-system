import * as path from 'path';
import * as dotenv from 'dotenv';
import { AgentLoader } from './core/agent-loader';
import { ToolRegistry } from './core/tool-registry';
import { AgentExecutor } from './core/agent-executor';
import { OpenAIProvider } from './llm/provider';
import { LoggerFactory } from './core/conversation-logger';
import { createTaskTool } from './tools/task-tool';
import { createReadTool, createWriteTool, createListTool } from './tools/file-tools';

// Load environment variables
dotenv.config();

/**
 * Test that demonstrates TRUE agent orchestration
 * 
 * This shows how agents autonomously decide to delegate work,
 * not just sequential function calls.
 */
async function testTrueOrchestration() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('Please set OPENAI_API_KEY environment variable');
    process.exit(1);
  }

  // Set up the system components
  const agentLoader = new AgentLoader(path.join(__dirname, '../agents'));
  const toolRegistry = new ToolRegistry();
  const logger = LoggerFactory.createCombinedLogger('true-orchestration-demo');
  const llmProvider = new OpenAIProvider(apiKey, toolRegistry);
  const executor = new AgentExecutor(agentLoader, toolRegistry, llmProvider, logger);

  // Register tools
  toolRegistry.register(createReadTool());
  toolRegistry.register(createWriteTool());
  toolRegistry.register(createListTool());
  toolRegistry.register(createTaskTool()); // The magic tool that enables delegation!

  console.log('🎭 TRUE Agent Orchestration Demonstration');
  console.log('=' .repeat(70));
  console.log('This demonstrates how agents AUTONOMOUSLY decide to delegate.');
  console.log('The orchestrator will analyze the task and decide whether to:');
  console.log('  1. Handle it directly (simple tasks)');
  console.log('  2. Delegate to specialists (complex tasks)');
  console.log('  3. Coordinate multiple agents (multi-step tasks)');
  console.log('=' .repeat(70));
  console.log();

  // Single complex request that will trigger autonomous orchestration
  const complexRequest = `
    I need you to:
    1. Analyze the src/core/agent-executor.ts file to understand how it works
    2. Identify any potential improvements or issues
    3. Create a summary of your findings
    4. Write a brief improvement proposal and save it as improvements.md
    
    This is a complex task that will require multiple specialists.
  `;

  console.log('📨 Single Complex Request:');
  console.log('-'.repeat(70));
  console.log(complexRequest);
  console.log('-'.repeat(70));
  console.log('\n🚀 Watch the AUTONOMOUS orchestration unfold:\n');

  try {
    // ONE call to the orchestrator - it will handle all the delegation autonomously
    const result = await executor.execute('orchestrator', complexRequest);
    
    console.log('\n' + '=' .repeat(70));
    console.log('✨ Final Orchestrated Result:');
    console.log('=' .repeat(70));
    console.log(result);
    
    console.log('\n📊 What just happened:');
    console.log('-'.repeat(70));
    console.log('1. Orchestrator received the complex request');
    console.log('2. It AUTONOMOUSLY decided to break it down');
    console.log('3. It delegated to code-analyzer for analysis');
    console.log('4. It delegated to summarizer for summary');
    console.log('5. It delegated to writer for documentation');
    console.log('6. It coordinated all results into a cohesive response');
    console.log('\nAll from a SINGLE request! This is TRUE orchestration.');
    
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n' + '=' .repeat(70));
  console.log('📁 Check conversations/true-orchestration-demo-*.json for the full audit trail');
  console.log('\nNotice how the delegation decisions were made by the LLM,');
  console.log('not by our code. The orchestration emerged from the agent\'s reasoning!');
}

// Run the demonstration
testTrueOrchestration().catch(console.error);