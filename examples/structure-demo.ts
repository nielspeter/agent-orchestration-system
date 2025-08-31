import * as dotenv from 'dotenv';
import { setupFromConfig } from '../src/config/mcp-config-loader';
import { createListTool } from '../src/tools/file-tools';

// Load environment variables
dotenv.config();

/**
 * Test the structure without making API calls
 */
async function testStructure() {
  console.log('🏗️  Testing Agent Orchestration System Structure\n');
  console.log('='.repeat(50));

  // Setup using configuration
  const setup = await setupFromConfig({
    sessionId: 'structure-demo'
  });
  
  const { agentLoader, toolRegistry } = setup;
  
  // Test 1: Agent Loader
  console.log('\n📁 Test 1: Agent Loader');
  
  try {
    const agents = await agentLoader.listAgents();
    console.log('✅ Found agents:', agents);

    // Load orchestrator
    const orchestrator = await agentLoader.loadAgent('orchestrator');
    console.log('✅ Loaded orchestrator:');
    console.log('  - Name:', orchestrator.name);
    console.log('  - Tools:', orchestrator.tools);
    console.log('  - Description:', orchestrator.description.substring(0, 100) + '...');
  } catch (error) {
    console.error('❌ Error:', error);
  }

  // Test 2: Tool Registry
  console.log('\n🔧 Test 2: Tool Registry');

  console.log(
    '✅ Registered tools:',
    toolRegistry.list().map((t) => t.name)
  );

  // Test filtering for orchestrator
  const orchestrator = await agentLoader.loadAgent('orchestrator');
  console.log('  Orchestrator tools value:', orchestrator.tools, typeof orchestrator.tools);
  const orchestratorTools = toolRegistry.filterForAgent(orchestrator);
  console.log(
    '✅ Orchestrator has access to:',
    orchestratorTools.map((t) => t.name)
  );

  // Test filtering for code-analyzer
  const analyzer = await agentLoader.loadAgent('code-analyzer');
  const analyzerTools = toolRegistry.filterForAgent(analyzer);
  console.log(
    '✅ Code-analyzer has access to:',
    analyzerTools.map((t) => t.name)
  );

  // Test 3: Tool Execution
  console.log('\n🎯 Test 3: Tool Execution');

  const listTool = createListTool();
  const result = await listTool.execute({ path: './src' });
  console.log('✅ List tool executed successfully');
  console.log('  Files in src/:', result.content);

  // Test 4: Agent Hierarchy
  console.log('\n🌳 Test 4: Agent Hierarchy');
  console.log('Agent capabilities:');

  const agents = await agentLoader.listAgents();
  for (const agentName of agents) {
    const agent = await agentLoader.loadAgent(agentName);
    const tools = toolRegistry.filterForAgent(agent);
    const hasTaskTool = tools.some((t) => t.name === 'Task');

    console.log(`  ${agentName}:`);
    console.log(`    - Can orchestrate: ${hasTaskTool ? '✅ Yes' : '❌ No'}`);
    console.log(`    - Available tools: ${tools.map((t) => t.name).join(', ')}`);
  }

  console.log('\n' + '='.repeat(50));
  console.log('\n✨ Structure test completed successfully!');
  console.log('\nThe system is ready. To test with real API calls:');
  console.log('1. Add your API key to .env file');
  console.log('2. Run: npm test');
  
  // Clean up MCP connections
  await setup.cleanup();
}

// Run the test
testStructure().catch(console.error);
