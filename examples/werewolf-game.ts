#!/usr/bin/env npx tsx
/**
 * Werewolf Game - Multi-Agent Coordination Example
 *
 * This example demonstrates how multiple agents can play different roles
 * in a werewolf game, with a game master coordinating everything.
 *
 * Includes verification step to ensure game rules were followed correctly.
 */

import { AgentSystemBuilder } from '@/config/system-builder';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

async function main() {
  console.log('🌙 Welcome to Werewolf Village Game!');
  console.log('=====================================\n');

  // Build the agent system with custom agents directory
  // Session ID will be auto-generated as UUID
  const builder = AgentSystemBuilder.default()
    .withAgentsFrom('examples/werewolf-game/agents')
    .withSessionId() // Auto-generates UUID
    .withSafetyLimits({
      maxIterations: 50, // Allow many iterations for complex game
      maxDepth: 10, // Allow deeper delegation chains
      warnAtIteration: 30,
      maxTokensEstimate: 100000, // Higher token limit for long games
    });

  const system = await builder.build();

  // Start the game by calling the autonomous game master
  try {
    console.log('🎮 Starting the game...\n');

    // The game-master is fully autonomous and knows how to run a game
    await system.executor.execute(
      'game-master',
      'Start a werewolf game and play it to completion. Use the default 5-player setup.'
    );
    console.log('\n🏁 Game Complete!');
    console.log('==================\n');

    // Now verify the game followed all rules
    console.log('🔍 Running test validation...\n');

    // Run the validator agent - it will discover and run all tests
    const verificationResult = await system.executor.execute(
      'validator',
      'Run all tests to verify the werewolf game followed the rules correctly.'
    );

    // Parse the verification result to extract the JSON
    const jsonMatch = RegExp(/```json\n([\s\S]*?)\n```/).exec(verificationResult);
    if (jsonMatch) {
      const verification = JSON.parse(jsonMatch[1]);

      console.log('\n📊 Test Validation Results');
      console.log('==========================');
      console.log(`📋 Total Tests: ${verification.stats.totalTests}`);
      console.log(`✅ Passed: ${verification.stats.passed}`);
      console.log(`❌ Failed: ${verification.stats.failed}`);
      console.log(`⚠️  Errors: ${verification.stats.errors || 0}`);
      console.log(`🎯 Overall Status: ${verification.overallStatus}\n`);

      // Show test results
      console.log('Test Results:');
      for (const [testName, testResult] of Object.entries(
        verification.testResults as Record<string, { passed: boolean; details?: string }>
      )) {
        const icon = testResult.passed ? '✅' : '❌';
        console.log(`  ${icon} ${testName}: ${testResult.details || ''}`);
      }

      // Get the actual session ID from the system config
      const sessionId = system.config.session.sessionId;
      console.log(`\n💾 Session ID: ${sessionId}`);
      console.log(`📁 Log saved to: logs/[timestamp]-${sessionId}.jsonl`);
    } else {
      console.log('\n⚠️  Could not parse verification results');
      console.log(verificationResult);
    }
  } catch (error) {
    console.error('❌ Game error:', error);
  }
}

// Run the example
main().catch(console.error);
