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
    .withAgentsFrom('examples/06-werewolf-game/agents');

  const system = await builder.build();

  // Start the game by calling the game master
  const gameContext = `
    Start a new werewolf game with the following players:
    - Alice (werewolf)
    - Bob (villager)  
    - Carol (seer)
    - Dave (villager)
    - Frank (villager)
    
    Run one complete round of the game (one night phase and one day phase).
    Coordinate with the other agents to play out the game.
    
    For the night phase:
    1. Ask the werewolf who to eliminate
    2. Ask the seer who to investigate
    3. Announce the results
    
    For the day phase:
    1. Announce who died
    2. Facilitate village discussion
    3. Conduct voting
    4. Announce results
    
    Keep the game moving and dramatic!
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