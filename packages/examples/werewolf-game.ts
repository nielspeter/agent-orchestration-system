#!/usr/bin/env npx tsx
/**
 * Werewolf Game - Multi-Agent Coordination Example
 *
 * This example demonstrates how multiple agents can play different roles
 * in a werewolf game, with a game master coordinating everything.
 *
 * Includes verification step to ensure game rules were followed correctly.
 */

import { AgentSystemBuilder } from '@agent-system/core';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: '../../.env' });

async function main() {
  console.log('🌙 Welcome to Werewolf Village Game!');
  console.log('=====================================\n');

  // Build the agent system with custom agents directory
  // Session ID will be auto-generated as UUID
  const builder = AgentSystemBuilder.default()
    .withAgentsFrom('werewolf-game/agents')
    .withToolsFrom('werewolf-game/tools')
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
      'Start a werewolf game and play it to completion.'
    );
    console.log('\n🏁 Game Complete!');
    console.log('==================\n');
  } catch (error) {
    console.error('❌ Game error:', error);
  }
}

// Run the example
main().catch(console.error);
