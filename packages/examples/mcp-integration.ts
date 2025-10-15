#!/usr/bin/env tsx
/**
 * Demonstration of MCP server integration with time utilities
 *
 * This example shows how to use the builder pattern to configure MCP servers
 * without relying on configuration files.
 */

import * as dotenv from 'dotenv';
import { AgentSystemBuilder } from '@agent-system/core';

// Load environment variables
dotenv.config({ path: '../../.env' });

async function main() {
  console.log('🕐 MCP Time Server Demo\n');

  try {
    // Setup MCP servers using the builder pattern
    const builder = AgentSystemBuilder.minimal()
      .withAgents({
        name: 'time-demo',
        prompt: 'You are a demo agent for testing MCP time tools.',
        tools: ['time_get_current_time', 'time_convert_time'],
      })
      .withMCPServers({
        time: {
          command: 'uvx',
          args: ['mcp-server-time', '--local-timezone=America/New_York'],
        },
      })
      .withSessionId('mcp-time-demo');

    const { cleanup, toolRegistry } = await builder.build();

    console.log('Available tools:');
    toolRegistry.getAllTools().forEach((tool) => {
      if (tool.name.startsWith('time_')) {
        console.log(`  - ${tool.name}: ${tool.description}`);
      }
    });

    console.log('\n📋 Testing MCP Time Tools:\n');

    // Test getting current time
    const timeTools = toolRegistry.getAllTools().filter((t) => t.name.startsWith('time_'));

    if (timeTools.length > 0) {
      // Get current time
      const getCurrentTime = toolRegistry.getTool('time_get_current_time');
      if (getCurrentTime) {
        console.log('1. Getting current time in different timezones:');

        const timezones = ['America/New_York', 'Europe/London', 'Asia/Tokyo'];
        for (const tz of timezones) {
          const result = await getCurrentTime.execute({ timezone: tz });
          const content =
            typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
          console.log(`   ${tz}: ${content}`);
        }
      }

      // Convert time between zones
      const convertTime = toolRegistry.getTool('time_convert_time');
      if (convertTime) {
        console.log('\n2. Converting time between zones:');
        const conversion = await convertTime.execute({
          time: '15:00',
          source_timezone: 'America/New_York',
          target_timezone: 'Europe/London',
        });
        const convContent =
          typeof conversion.content === 'string'
            ? conversion.content
            : JSON.stringify(conversion.content);
        console.log(`   3:00 PM EST → London: ${convContent}`);
      }
    } else {
      console.log('No MCP time tools found. Make sure the time server is configured.');
    }

    // Cleanup
    await cleanup();
    console.log('\n✅ Demo complete - MCP connections closed');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the main demo
main();
