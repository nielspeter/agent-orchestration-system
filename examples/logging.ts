import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { AgentSystemBuilder } from '../src/config/system-builder';

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Test with beautiful logging to see the orchestration flow
 */
async function testWithLogging() {
  // Minimal config with verbose logging enabled and example-specific agents
  const { executor, cleanup } = await new AgentSystemBuilder()
    .withModel(process.env.MODEL || 'anthropic/claude-3-5-haiku-latest')
    .withAgentsFrom(path.join(__dirname, 'logging', 'agents'))
    .withDefaultTools() // read, write, list, task for delegation demos
    .withTodoTool() // Include todo for Test 3
    .withConsole({ verbosity: 'verbose' }) // Enable verbose console output
    .withStorage('filesystem') // Enable event persistence
    .withSessionId('logging-demo')
    .build();

  console.log('🚀 Agent Orchestration System - With Full Audit Logging\n');
  console.log('='.repeat(60));
  console.log('Watch the orchestration unfold with complete visibility!');
  console.log('='.repeat(60));
  console.log();

  // Test 1: Simple task (no delegation)
  console.log('📝 Test 1: Direct Task (No Delegation)');
  console.log('-'.repeat(60));
  console.log('Request: "List the files in the src directory"\n');

  try {
    const result1 = await executor.execute('orchestrator', 'List the files in the src directory');
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
    const result2 = await executor.execute(
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
  console.log(
    'Request: "Analyze the conversation-logger.ts file and write a brief documentation for it"\n'
  );

  try {
    const result3 = await executor.execute(
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
  console.log('\n📁 Check the "logs" directory for the full audit log in JSON format.');

  // Clean up
  await cleanup();
}

// Run the test
testWithLogging().catch(console.error);
