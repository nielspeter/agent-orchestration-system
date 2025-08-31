#!/usr/bin/env tsx
/**
 * Test the quickSetup helper function
 */

import { quickSetup } from '../src/config/mcp-config-loader';

async function testQuickSetup() {
  console.log('🧪 Testing quickSetup() function\n');
  
  try {
    // Test 1: Basic setup with no options
    console.log('Test 1: Basic setup (no options)');
    console.log('-'.repeat(40));
    const setup1 = await quickSetup();
    console.log('✅ Basic setup successful');
    console.log(`  Tools: ${setup1.toolRegistry.list().map(t => t.name).join(', ')}`);
    await setup1.cleanup();
    
    // Test 2: Setup with additional tools
    console.log('\nTest 2: Setup with additional tools');
    console.log('-'.repeat(40));
    const setup2 = await quickSetup({
      additionalTools: ['todowrite']
    });
    console.log('✅ Setup with additional tools successful');
    console.log(`  Tools: ${setup2.toolRegistry.list().map(t => t.name).join(', ')}`);
    await setup2.cleanup();
    
    // Test 3: Setup with MCP servers (will fail if servers not available)
    console.log('\nTest 3: Setup with MCP servers');
    console.log('-'.repeat(40));
    try {
      const setup3 = await quickSetup({
        mcpServers: ['filesystem'],
        additionalTools: ['todowrite']
      });
      console.log('✅ Setup with MCP servers successful');
      console.log(`  Tools: ${setup3.toolRegistry.list().map(t => t.name).join(', ')}`);
      await setup3.cleanup();
    } catch (error) {
      console.log(`⚠️ MCP server setup failed (expected if server not installed): ${error instanceof Error ? error.message : String(error)}`);
    }
    
    console.log('\n✅ All quickSetup tests completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testQuickSetup();