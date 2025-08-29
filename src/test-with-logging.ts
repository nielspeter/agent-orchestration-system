import * as path from 'path';
import * as dotenv from 'dotenv';
import { AgentOrchestrationSystem } from './index';
import { LoggerFactory } from './core/conversation-logger';

// Load environment variables
dotenv.config();

/**
 * Test with beautiful logging to see the orchestration flow
 */
async function testWithLogging() {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    console.error('Please set OPENAI_API_KEY or OPENROUTER_API_KEY environment variable');
    process.exit(1);
  }

  // Set OpenRouter base URL if using OpenRouter
  if (process.env.OPENROUTER_API_KEY) {
    process.env.OPENAI_BASE_URL = 'https://openrouter.ai/api/v1';
    process.env.MODEL = process.env.MODEL || 'openai/gpt-4';
  }

  const system = new AgentOrchestrationSystem({
    agentsDir: path.join(__dirname, '../agents'),
    apiKey
  });

  console.log('🚀 Agent Orchestration System - With Full Audit Logging\n');
  console.log('=' .repeat(60));
  console.log('Watch the orchestration unfold with complete visibility!');
  console.log('=' .repeat(60));
  console.log();
  
  // Test 1: Simple task (no delegation)
  console.log('📝 Test 1: Direct Task (No Delegation)');
  console.log('-'.repeat(60));
  console.log('Request: "List the files in the src directory"\n');
  
  try {
    const result1 = await system.execute(
      'orchestrator',
      'List the files in the src directory'
    );
    console.log('\n' + '='.repeat(60));
    console.log('📊 Final Result:');
    console.log(result1);
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 2: Task requiring delegation
  console.log('🔄 Test 2: Task with Delegation');
  console.log('-'.repeat(60));
  console.log('Request: "Analyze the agent-executor.ts file and summarize its purpose"\n');
  
  try {
    const result2 = await system.execute(
      'orchestrator',
      'Analyze the agent-executor.ts file in src/core and summarize its purpose in 2-3 sentences'
    );
    console.log('\n' + '='.repeat(60));
    console.log('📊 Final Result:');
    console.log(result2);
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 3: Complex multi-agent task
  console.log('🎯 Test 3: Complex Multi-Agent Workflow');
  console.log('-'.repeat(60));
  console.log('Request: "Analyze the conversation-logger.ts file and write a brief documentation for it"\n');
  
  try {
    const result3 = await system.execute(
      'orchestrator',
      'Analyze the conversation-logger.ts file in src/core, understand its architecture, and write a brief documentation file explaining its purpose and how to use it. Save it as conversation-logger-docs.md'
    );
    console.log('\n' + '='.repeat(60));
    console.log('📊 Final Result:');
    console.log(result3);
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ All tests completed!');
  console.log('\n📁 Check the "conversations" directory for the full audit log in JSON format.');
}

// Run the test
testWithLogging().catch(console.error);