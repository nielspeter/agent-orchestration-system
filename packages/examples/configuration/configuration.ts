#!/usr/bin/env tsx
import * as dotenv from 'dotenv';
import { AgentSystemBuilder } from '@agent-system/core';

// Load environment variables
dotenv.config({ path: '../../.env' });

/**
 * Demonstration of configuration-based setup with AgentSystemBuilder
 */

async function fullConfigExample() {
  console.log('📋 Full Configuration Example');
  console.log('='.repeat(60));

  // Load from agent-config.json
  const { executor, cleanup } = await AgentSystemBuilder.fromConfigFile('./agent-config.json').then(
    (builder) => builder.build()
  );

  // Execute a simple task
  const result = await executor.execute(
    'orchestrator',
    'List the files in the src directory and summarize what you find'
  );

  console.log('\nResult:', result);

  // Cleanup connections
  await cleanup();
}

async function minimalSetupExample() {
  console.log('\n🚀 Minimal Setup Example');
  console.log('='.repeat(60));

  // Minimal setup with no tools but with example-specific agents
  const { executor, cleanup } = await AgentSystemBuilder.minimal()
    .withAgentsFrom('configuration/agents')
    .build();

  const result = await executor.execute(
    'orchestrator',
    'Explain what you can do without any tools'
  );

  console.log('\nResult:', result);

  await cleanup();
}

async function defaultSetupExample() {
  console.log('\n📦 Default Setup Example');
  console.log('='.repeat(60));

  // Default setup with file tools and example-specific agents
  const { executor, cleanup } = await AgentSystemBuilder.default()
    .withAgentsFrom('configuration/agents')
    .withSessionId(`config-default-${Date.now()}`) // Unique session for each run
    .build();

  const result = await executor.execute('orchestrator', 'List the files in the src directory');

  console.log('\nResult:', result);

  await cleanup();
}

async function fullSetupExample() {
  console.log('\n⚙️ Full Setup Example');
  console.log('='.repeat(60));

  // Full setup with all tools including TodoWrite and example-specific agents
  const { executor, cleanup } = await AgentSystemBuilder.default()
    .withAgentsFrom('configuration/agents')
    .withSessionId(`config-full-${Date.now()}`) // Unique session for each run
    .build();

  const result = await executor.execute(
    'orchestrator',
    'Create a todo list for implementing a new feature'
  );

  console.log('\nResult:', result);

  await cleanup();
}

async function customConfigExample() {
  console.log('\n🔧 Custom Configuration Example');
  console.log('='.repeat(60));

  // Custom configuration with specific settings and example-specific agents
  const { executor, cleanup } = await AgentSystemBuilder.default()
    .withModel('anthropic/claude-haiku-4-5')
    .withAgentsFrom('configuration/agents')
    .withSafetyLimits({ maxIterations: 50 })
    .withConsole({ verbosity: 'verbose' })
    .withStorage('filesystem')
    .withSessionId(`config-custom-${Date.now()}`) // Unique session for each run
    .build();

  // Use the custom setup
  const result = await executor.execute('orchestrator', 'Analyze the project structure');

  console.log('\nResult:', result);

  await cleanup();
}

async function main() {
  console.log('🔧 AgentSystemBuilder Configuration Demonstrations\n');

  try {
    // Show different setup patterns
    await minimalSetupExample();
    await defaultSetupExample();
    await fullSetupExample();
    await customConfigExample();

    // Try loading from config file if it exists
    try {
      await fullConfigExample();
    } catch {
      console.log('\n⚠️ Config file example skipped (no agent-config.json found)');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
