#!/usr/bin/env tsx
/**
 * Demonstration of configuration-based setup with MCP support
 */

import { setupFromConfig, quickSetup } from '../src/config/mcp-config-loader';

async function fullConfigExample() {
  console.log('📋 Full Configuration Example');
  console.log('=' .repeat(60));
  
  // Load from agent-config.json
  const setup = await setupFromConfig({
    configPath: './agent-config.json',
    sessionId: 'config-demo'
  });
  
  // Execute a simple task
  const result = await setup.executor.execute(
    'orchestrator',
    'List the files in the src directory and summarize what you find'
  );
  
  console.log('\nResult:', result);
  
  // Cleanup MCP connections
  await setup.cleanup();
}

async function quickSetupExample() {
  console.log('\n🚀 Quick Setup Example');
  console.log('=' .repeat(60));
  
  // Minimal setup with selected MCP servers
  const setup = await quickSetup({
    mcpServers: ['filesystem'],  // Just filesystem MCP server
    additionalTools: ['todowrite']  // Add todo management
  });
  
  const result = await setup.executor.execute(
    'orchestrator',
    'Create a todo list for implementing a new feature'
  );
  
  console.log('\nResult:', result);
  
  await setup.cleanup();
}

async function customConfigExample() {
  console.log('\n⚙️ Custom Configuration Example');
  console.log('=' .repeat(60));
  
  // Override specific config values
  const setup = await setupFromConfig({
    configOverrides: {
      mcpServers: {
        // Add a custom MCP server
        'my-api': {
          command: 'node',
          args: ['./my-mcp-server.js'],
          env: {
            API_KEY: '${MY_API_KEY}'
          }
        }
      },
      execution: {
        defaultModel: 'claude-3-5-sonnet-20241022',
        maxIterations: 50
      }
    }
  });
  
  // Use the custom setup
  const result = await setup.executor.execute(
    'orchestrator',
    'Test the my-api MCP server by listing available operations'
  );
  
  console.log('\nResult:', result);
  
  await setup.cleanup();
}

async function main() {
  console.log('🔧 Configuration-Based Setup Demonstrations\n');
  
  try {
    // Show different setup patterns
    await fullConfigExample();
    await quickSetupExample();
    await customConfigExample();
    
  } catch (error) {
    console.error('Error:', error);
  }
}

main();