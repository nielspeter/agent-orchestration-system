#!/usr/bin/env npx tsx
/**
 * Werewolf Game - Multi-Agent Coordination Example
 *
 * This example demonstrates how multiple agents can play different roles
 * in a werewolf game, with a game master coordinating everything.
 *
 * No external tools needed - pure agent decision making and coordination.
 */

import { AgentSystemBuilder } from '@/config/system-builder';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

async function main() {
  console.log('🌙 Welcome to Werewolf Village Game!');
  console.log('=====================================\n');

  // Build the agent system with custom agents directory
  const builder = AgentSystemBuilder.default()
    .withAgentsFrom('examples/06-werewolf-game/agents')
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
    const result = await system.executor.execute(
      'game-master',
      'Start a werewolf game and play it to completion. Use the default 5-player setup.'
    );
    console.log('\n🏁 Game Round Complete!');
    console.log('========================');
    console.log(result);
  } catch (error) {
    console.error('❌ Game error:', error);
  }
}

// Run the example
main().catch(console.error);
