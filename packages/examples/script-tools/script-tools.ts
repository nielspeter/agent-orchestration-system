#!/usr/bin/env tsx
/**
 * Script Tools Example - Using Python/JS/Shell scripts as tools
 *
 * This example demonstrates:
 * - Loading tools from script files (Python, JavaScript, Shell)
 * - Scripts automatically become tools agents can use
 * - Complete abstraction - agents don't know if tools are TypeScript or scripts
 */

import * as dotenv from 'dotenv';
import { AgentSystemBuilder } from '@agent-system/core';

// Load environment variables
dotenv.config({ path: '../../.env' });

async function main() {
  console.log('🛠️  Script Tools Example');
  console.log('========================\n');

  // Build system with script tools
  const builder = AgentSystemBuilder.minimal()
    .withToolsFrom('script-tools/tools')
    .withBuiltinTools('shell'); // Include shell for comparison

  const { toolRegistry, cleanup } = await builder.build();

  // List all available tools
  console.log('📋 Available Tools:');
  const tools = toolRegistry.getAllTools();
  tools.forEach((tool) => {
    console.log(`  • ${tool.name}: ${tool.description}`);
  });
  console.log();

  // Test 1: Direct tool usage
  console.log('--- Test 1: Direct Tool Usage ---\n');

  // Test Python tool
  const wordCounter = toolRegistry.getTool('word_counter');
  if (wordCounter) {
    const result = await wordCounter.execute({
      text: 'The quick brown fox jumps over the lazy dog',
    });
    console.log('Word Counter Result:', JSON.stringify(result.content, null, 2));
  }

  // Test JavaScript tool
  const calculator = toolRegistry.getTool('math_calculator');
  if (calculator) {
    const result = await calculator.execute({
      operation: 'multiply',
      a: 7,
      b: 6,
    });
    console.log('Calculator Result:', JSON.stringify(result.content, null, 2));
  }

  // Test Shell tool
  const systemInfo = toolRegistry.getTool('system_info');
  if (systemInfo) {
    const result = await systemInfo.execute({});
    console.log('System Info Result:', JSON.stringify(result.content, null, 2));
  }

  // Test 2: Agent using script tools
  console.log('\n--- Test 2: Agent Using Script Tools ---\n');

  // Rebuild with agents
  const builderWithAgents = AgentSystemBuilder.minimal()
    .withToolsFrom('script-tools/tools')
    .withAgentsFrom('script-tools/agents');

  const systemWithAgents = await builderWithAgents.build();

  // Use the agent
  const agentResult = await systemWithAgents.executor.execute(
    'text-analyzer',
    'Analyze this text: "TypeScript is a strongly typed programming language that builds on JavaScript"'
  );

  console.log('Agent Analysis Result:');
  console.log(agentResult);

  // Cleanup
  await systemWithAgents.cleanup();
  await cleanup();

  console.log('\n✅ Example complete!');
  console.log('\nKey takeaways:');
  console.log('• Scripts in any language can be tools');
  console.log('• Tools are loaded dynamically from directories');
  console.log('• Agents see no difference between script and native tools');
  console.log('• Perfect for integrating existing scripts and utilities');
}

main().catch(console.error);
