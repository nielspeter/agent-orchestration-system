#!/usr/bin/env tsx
/**
 * Demonstration of MCP server integration with time utilities
 */

import { setupFromConfig } from '../src/config/mcp-config-loader';

async function main() {
  console.log('🕐 MCP Time Server Demo\n');
  
  try {
    // Setup with MCP servers from config
    const setup = await setupFromConfig({
      sessionId: 'mcp-time-demo'
    });
    
    console.log('Available tools:');
    setup.toolRegistry.list().forEach(tool => {
      if (tool.name.startsWith('time.')) {
        console.log(`  - ${tool.name}: ${tool.description}`);
      }
    });
    
    console.log('\n📋 Testing MCP Time Tools:\n');
    
    // Test getting current time
    const timeTools = setup.toolRegistry.list().filter(t => t.name.startsWith('time.'));
    
    if (timeTools.length > 0) {
      // Get current time
      const getCurrentTime = setup.toolRegistry.get('time.get_current_time');
      if (getCurrentTime) {
        console.log('1. Getting current time in different timezones:');
        
        const timezones = ['America/New_York', 'Europe/London', 'Asia/Tokyo'];
        for (const tz of timezones) {
          const result = await getCurrentTime.execute({ timezone: tz });
          const content = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
          console.log(`   ${tz}: ${content}`);
        }
      }
      
      // Convert time between zones
      const convertTime = setup.toolRegistry.get('time.convert_time');
      if (convertTime) {
        console.log('\n2. Converting time between zones:');
        const conversion = await convertTime.execute({
          time: '15:00',
          source_timezone: 'America/New_York',
          target_timezone: 'Europe/London'
        });
        const convContent = typeof conversion.content === 'string' ? conversion.content : JSON.stringify(conversion.content);
        console.log(`   3:00 PM EST → London: ${convContent}`);
      }
    } else {
      console.log('No MCP time tools found. Make sure the time server is configured.');
    }
    
    // Cleanup
    await setup.cleanup();
    console.log('\n✅ Demo complete - MCP connections closed');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();