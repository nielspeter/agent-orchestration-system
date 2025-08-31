#!/usr/bin/env npx tsx
/**
 * Werewolf Game - Multi-Agent Coordination Example
 * 
 * This example demonstrates how multiple agents can play different roles
 * in a werewolf game, with a game master coordinating everything.
 * 
 * No external tools needed - pure agent decision making and coordination.
 */

import { AgentSystemBuilder } from '../src/config/system-builder';
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
      maxIterations: 50,  // Allow many iterations for complex game
      maxDepth: 10,       // Allow deeper delegation chains
      warnAtIteration: 30,
      maxTokensEstimate: 100000  // Higher token limit for long games
    });

  const system = await builder.build();

  // Start the game by calling the game master
  const gameContext = `
    === WEREWOLF GAME SETUP ===
    
    PLAYERS AND ROLES:
    - Alice (werewolf)
    - Bob (villager)  
    - Carol (seer)
    - Dave (villager)
    - Frank (villager)
    
    AVAILABLE ROLES IN THIS GAME:
    - 1 Werewolf (Alice)
    - 1 Seer (Carol)
    - 3 Villagers (Bob, Dave, Frank)
    - NO Defender, Nurse, Witch, or Cupid in this game
    
    CRITICAL RULES:
    - These are the ONLY valid player names: Alice, Bob, Carol, Dave, Frank
    - Do NOT accept any other names (no Alex, Emily, Sarah, etc.)
    - Only call roles that exist (werewolf and seer)
    
    OBJECTIVE:
    - Play to completion (multiple rounds until one side wins)
    - Werewolves win when they equal/outnumber villagers
    - Villagers win when all werewolves are eliminated
    
    Start the game now with Round 1, Night Phase!
  `;

  try {
    console.log('🎮 Starting the game...\n');
    const result = await system.executor.execute('game-master', gameContext);
    console.log('\n🏁 Game Round Complete!');
    console.log('========================');
    console.log(result);
  } catch (error) {
    console.error('❌ Game error:', error);
  }
}

// Run the example
main().catch(console.error);