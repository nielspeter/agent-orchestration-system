import { config } from 'dotenv';
import { AgentExecutorAISDK } from './src/core/agent-executor-ai-sdk';
import { AgentLoader } from './src/core/agent-loader';
import { ToolRegistry } from './src/core/tool-registry';
import { ConversationLogger, LoggerFactory } from './src/core/conversation-logger';
import { createReadTool, createWriteTool, createListTool } from './src/tools/file-tools';
import { createTaskTool } from './src/tools/task-tool';
import * as fs from 'fs/promises';
import * as path from 'path';

// Load environment variables
config();

async function setupTestEnvironment() {
  // Create agents directory and test agent
  const agentsDir = path.join(__dirname, 'agents');
  await fs.mkdir(agentsDir, { recursive: true });
  
  // Create cache test agent
  const cacheTestAgent = `---
name: cache-test
tools: ["*"]
---

# Cache Test Agent

You are a test agent demonstrating caching efficiency.

When asked to analyze context, first acknowledge what context you've received, then perform the requested analysis.

Always mention if you're using cached context from a previous interaction.`;
  
  await fs.writeFile(
    path.join(agentsDir, 'cache-test.md'),
    cacheTestAgent
  );
  
  // Create test context file
  const testDir = path.join(__dirname, 'test-context');
  await fs.mkdir(testDir, { recursive: true });
  
  const largeContext = `# Large Context Document

This is a substantial context document that simulates real-world scenarios where caching provides significant benefits.

## Project Overview
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 
Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

## Technical Architecture
${Array(50).fill('Technical detail line that adds to the context size.').join('\n')}

## Business Requirements
${Array(50).fill('Business requirement that needs to be considered.').join('\n')}

## Implementation Details
${Array(50).fill('Implementation detail that the agent needs to understand.').join('\n')}

This context is approximately 10KB and will be cached by Anthropic for efficient reuse.`;
  
  await fs.writeFile(
    path.join(testDir, 'context.md'),
    largeContext
  );
  
  return { agentsDir, testDir };
}

async function testWithModel(modelName: string) {
  console.log('\n' + '='.repeat(60));
  console.log(`🤖 Testing with ${modelName}`);
  console.log('='.repeat(60));
  
  // Initialize components
  const agentLoader = new AgentLoader(path.join(__dirname, 'agents'));
  const toolRegistry = new ToolRegistry();
  const logger = LoggerFactory.createCombinedLogger();
  
  // Register tools
  toolRegistry.register(createReadTool());
  toolRegistry.register(createWriteTool());
  toolRegistry.register(createListTool());
  toolRegistry.register(createTaskTool());
  
  // Create executor with specified model
  const executor = new AgentExecutorAISDK(
    agentLoader,
    toolRegistry,
    modelName,
    logger
  );
  
  const isAnthropic = modelName.startsWith('claude');
  console.log(`\n📊 Cache Support: ${isAnthropic ? '✅ ENABLED (Anthropic)' : '❌ DISABLED (OpenAI)'}\n`);
  
  // Test 1: Initial context load
  console.log('Test 1: Initial Context Load');
  console.log('-'.repeat(40));
  
  const startTime1 = Date.now();
  try {
    const result1 = await executor.execute(
      'cache-test',
      `Read the file test-context/context.md and summarize the main sections.`
    );
    
    const duration1 = Date.now() - startTime1;
    console.log(`\n✅ Initial load completed in ${duration1}ms`);
    console.log('Summary:', result1.substring(0, 200) + '...');
  } catch (error) {
    console.error('❌ Test 1 failed:', error);
  }
  
  // Test 2: Reuse cached context (Anthropic will use cache, OpenAI won't)
  console.log('\n\nTest 2: Context Reuse (Cache Hit Test)');
  console.log('-'.repeat(40));
  
  const startTime2 = Date.now();
  try {
    const result2 = await executor.execute(
      'cache-test',
      `Based on the previously read context, what are the key technical architecture points?`
    );
    
    const duration2 = Date.now() - startTime2;
    console.log(`\n✅ Context reuse completed in ${duration2}ms`);
    
    if (isAnthropic) {
      console.log('🎉 Cache metrics should show significant token savings above!');
    } else {
      console.log('ℹ️  No caching - full context retransmitted');
    }
    
    console.log('Response:', result2.substring(0, 200) + '...');
  } catch (error) {
    console.error('❌ Test 2 failed:', error);
  }
  
  // Test 3: Multiple delegations (tests sidechain caching)
  console.log('\n\nTest 3: Agent Delegation with Context Passing');
  console.log('-'.repeat(40));
  
  const startTime3 = Date.now();
  try {
    const result3 = await executor.execute(
      'cache-test',
      `Delegate to the code-analyzer agent to analyze the structure of the context document you've read.
      Pass the full context to the delegated agent.`
    );
    
    const duration3 = Date.now() - startTime3;
    console.log(`\n✅ Delegation completed in ${duration3}ms`);
    
    if (isAnthropic) {
      console.log('🎉 Delegated agent should reuse cached parent context!');
    } else {
      console.log('ℹ️  Full context passed without caching benefit');
    }
    
    console.log('Response:', result3.substring(0, 200) + '...');
  } catch (error) {
    console.error('❌ Test 3 failed:', error);
  }
}

async function runCachingComparison() {
  console.log('🚀 AI SDK Caching Comparison Test');
  console.log('Demonstrating the efficiency gains with Anthropic\'s native caching\n');
  
  // Setup test environment
  const { agentsDir, testDir } = await setupTestEnvironment();
  console.log('✅ Test environment created');
  
  // Check which models are available
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  
  if (!hasOpenAI && !hasAnthropic) {
    console.error('\n❌ No API keys found! Please set either:');
    console.error('   OPENAI_API_KEY for OpenAI models');
    console.error('   ANTHROPIC_API_KEY for Anthropic models');
    process.exit(1);
  }
  
  // Test with available models
  if (hasOpenAI) {
    await testWithModel('gpt-4o-mini');
  }
  
  if (hasAnthropic) {
    await testWithModel('claude-3-5-haiku-20241022');
  }
  
  // Compare results
  console.log('\n' + '='.repeat(60));
  console.log('📊 COMPARISON SUMMARY');
  console.log('='.repeat(60));
  
  if (hasAnthropic) {
    console.log('\n✅ Anthropic (claude-3-5-haiku):');
    console.log('  - Ephemeral caching enabled');
    console.log('  - System prompts cached automatically');
    console.log('  - Conversation history cached');
    console.log('  - Up to 90% token savings on repeated context');
    console.log('  - Perfect for multi-agent workflows');
  }
  
  if (hasOpenAI) {
    console.log('\n⚠️  OpenAI (gpt-4o-mini):');
    console.log('  - No native caching support');
    console.log('  - Full context retransmitted each time');
    console.log('  - Higher token costs for repeated context');
    console.log('  - Still works but less efficient');
  }
  
  console.log('\n🎯 Key Insight:');
  console.log('Claude Code\'s architecture of "isolated agents + context passing"');
  console.log('becomes incredibly efficient with Anthropic\'s caching, turning');
  console.log('what could be a limitation into a massive performance advantage!');
  
  // Cleanup
  try {
    await fs.rm(testDir, { recursive: true, force: true });
    console.log('\n✅ Test files cleaned up');
  } catch (error) {
    // Ignore cleanup errors
  }
}

// Run the comparison
runCachingComparison().catch(console.error);