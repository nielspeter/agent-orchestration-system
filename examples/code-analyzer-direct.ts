#!/usr/bin/env tsx

/**
 * Direct Code Analyzer Example
 * 
 * This example calls the code-analyzer agent directly without orchestration,
 * allowing us to test and debug the child agent behavior in isolation.
 */

import * as dotenv from 'dotenv';
import { setupFromConfig } from '../src/config/mcp-config-loader';

// Load environment variables
dotenv.config();

async function main() {
  console.log('\n🔍 Direct Code Analyzer Test');
  console.log('=' .repeat(70));
  console.log('Testing code-analyzer agent directly without orchestration');
  console.log('=' .repeat(70));

  // Initialize the system
  const setup = await setupFromConfig();
  
  // Get the AgentExecutor
  const executor = setup.executor;

  // Define a simple analysis task
  const prompt = `
    Analyze the file src/core/agent-executor.ts and provide:
    1. A brief overview of what this class does
    2. Key architectural patterns used
    3. Potential improvements
    
    Save your analysis to analysis-test.md
  `;

  console.log('\n📋 Task for code-analyzer:');
  console.log('-'.repeat(70));
  console.log(prompt);
  console.log('-'.repeat(70));

  try {
    console.log('\n🚀 Executing code-analyzer directly...\n');
    
    // Execute the code-analyzer agent directly
    const result = await executor.execute('code-analyzer', prompt, {
      depth: 0,
      startTime: Date.now(),
      maxDepth: 10,
    });

    console.log('\n✅ Code Analyzer Result:');
    console.log('=' .repeat(70));
    console.log(result);
    console.log('=' .repeat(70));
    
    console.log('\n📊 Execution Summary:');
    console.log('-'.repeat(70));
    console.log('The code-analyzer should have:');
    console.log('1. Read and analyzed the agent-executor.ts file');
    console.log('2. Written the analysis to analysis-test.md');
    console.log('3. Returned a summary of what was done');
    console.log('-'.repeat(70));
    
  } catch (error) {
    console.error('\n❌ Error:', error);
  }

  // Cleanup MCP servers
  await setup.cleanup();
}

// Run the example
main().catch(console.error);