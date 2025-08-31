#!/usr/bin/env npx tsx
/**
 * Werewolf Game - Multi-Agent Coordination Example
 * 
 * This example demonstrates how multiple agents can play different roles
 * in a werewolf game, with a game master coordinating the action.
 * 
 * No external tools needed - pure agent decision making and coordination.
 */

import { AgentSystemBuilder } from '../src/config/system-builder';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Game state to track players and their status
interface GameState {
  players: Array<{
    name: string;
    role: string;
    agent: string;
    alive: boolean;
    lover?: string;
  }>;
  phase: 'day' | 'night';
  round: number;
  defended?: string;
  witchHealUsed: boolean;
  witchPoisonUsed: boolean;
  nurseHealUsed: boolean;
}

async function main() {
  console.log('🌙 Welcome to Werewolf Village Game!');
  console.log('=====================================\n');

  // Initialize the game state
  const gameState: GameState = {
    players: [
      { name: 'Alice', role: 'werewolf', agent: 'werewolf', alive: true },
      { name: 'Bob', role: 'villager', agent: 'villager', alive: true },
      { name: 'Carol', role: 'seer', agent: 'seer', alive: true },
      { name: 'Dave', role: 'villager', agent: 'villager', alive: true },
      { name: 'Eve', role: 'werewolf', agent: 'werewolf', alive: true },
      { name: 'Frank', role: 'villager', agent: 'villager', alive: true },
    ],
    phase: 'night',
    round: 1,
    witchHealUsed: false,
    witchPoisonUsed: false,
    nurseHealUsed: false,
  };

  // Build the agent system with custom agents directory
  const builder = AgentSystemBuilder.default()
    .withAgentsFrom('examples/06-werewolf-game/agents')
    .withBuiltinTools([]); // No tools needed for this game

  const system = await builder.build();

  console.log('🎮 Game Setup:');
  console.log('- 2 Werewolves (Alice, Eve)');
  console.log('- 1 Seer (Carol)');
  console.log('- 3 Villagers (Bob, Dave, Frank)');
  console.log('\nThe game begins at nightfall...\n');

  // Simulate a simplified game round
  try {
    // Night Phase - Werewolves choose victim
    console.log('🌙 NIGHT PHASE - Round 1');
    console.log('========================\n');
    
    // Create context for werewolf decision
    const werewolfContext = `
    You are playing as the werewolves (Alice and Eve).
    
    Current alive players:
    - Alice (you - werewolf)
    - Bob (appears to be villager)
    - Carol (appears to be villager) 
    - Dave (appears to be villager)
    - Eve (you - werewolf)
    - Frank (appears to be villager)
    
    This is the first night. Choose your victim wisely.
    Who should the werewolves eliminate? Respond with just the name.
    `;

    console.log('🐺 Werewolves are choosing their victim...');
    const werewolfChoice = await system.executor.execute('werewolf', werewolfContext);
    console.log(`   Werewolves chose: ${werewolfChoice}\n`);

    // Seer investigates
    const seerContext = `
    You are playing as Carol, the Seer.
    
    Current alive players:
    - Alice
    - Bob  
    - Carol (you - seer)
    - Dave
    - Eve
    - Frank
    
    This is the first night. You can investigate one player.
    Who would you like to investigate? Respond with just the name.
    `;

    console.log('🔮 Seer is investigating someone...');
    const seerChoice = await system.executor.execute('seer', seerContext);
    console.log(`   Seer investigated: ${seerChoice}`);
    
    // Reveal result to seer (in real game, this would be private)
    const investigated = gameState.players.find(p => p.name === seerChoice.trim());
    if (investigated) {
      const result = investigated.role === 'werewolf' ? 'WEREWOLF! 🐺' : 'innocent villager 👤';
      console.log(`   Result: ${investigated.name} is a ${result}\n`);
    }

    // Day Phase - Village discussion and voting
    console.log('☀️ DAY PHASE - Morning Arrives');
    console.log('================================\n');

    // Game Master announces the death
    const gmContext = `
    You are the Game Master. ${werewolfChoice} was killed by werewolves last night.
    
    Announce the death dramatically and call for village discussion.
    Keep it brief but atmospheric (2-3 sentences).
    `;

    const gmAnnouncement = await system.executor.execute('game-master', gmContext);
    console.log(`📢 Game Master: ${gmAnnouncement}\n`);

    // Simulate village discussion (simplified)
    console.log('💬 Village Discussion:');
    
    // Get villager perspective
    const villagerContext = `
    You are playing as Bob, a villager.
    
    ${werewolfChoice} was killed last night by werewolves.
    
    Remaining players: Alice, Bob (you), Carol, Dave, Eve, Frank
    
    Based on this first night kill, who do you suspect might be a werewolf and why?
    Keep your response brief (1-2 sentences).
    `;
    
    const villagerSuspicion = await system.executor.execute('villager', villagerContext);
    console.log(`   Bob says: "${villagerSuspicion}"`);

    // Get werewolf deflection (pretending to be villager)
    const werewolfDeflectContext = `
    You are playing as Alice, secretly a werewolf but pretending to be a villager.
    
    ${werewolfChoice} was killed last night. Bob just shared their suspicions.
    
    Deflect suspicion away from yourself and Eve (also a werewolf).
    Keep your response brief (1-2 sentences).
    `;
    
    const werewolfDeflection = await system.executor.execute('werewolf', werewolfDeflectContext);
    console.log(`   Alice says: "${werewolfDeflection}"`);

    // Seer hints
    const seerHintContext = `
    You are playing as Carol, the Seer.
    
    Last night you investigated ${seerChoice} and learned they are a ${
      investigated?.role === 'werewolf' ? 'WEREWOLF' : 'innocent villager'
    }.
    
    Without revealing that you're the Seer, provide a subtle hint to guide the discussion.
    Keep your response brief (1-2 sentences).
    `;
    
    const seerHint = await system.executor.execute('seer', seerHintContext);
    console.log(`   Carol says: "${seerHint}"\n`);

    console.log('🗳️ Voting Phase');
    console.log('===============');
    console.log('The village must decide who to lynch...\n');

    // Simplified voting outcome
    console.log('📊 Example voting results:');
    console.log('   Alice: 2 votes');
    console.log('   Eve: 3 votes');
    console.log('   Dave: 1 vote\n');
    
    console.log('⚖️ Eve has been lynched by the village!');
    console.log('   Eve was a... WEREWOLF! 🐺');
    console.log('   The village celebrates this small victory!\n');

    // Check win condition
    console.log('🏁 Game Status:');
    console.log('   Werewolves remaining: 1 (Alice)');
    console.log('   Villagers remaining: 4');
    console.log('   The game continues...\n');

    console.log('🎮 This was a simplified demonstration of the werewolf game.');
    console.log('   In a full implementation, the game would continue with:');
    console.log('   - Multiple rounds of day/night cycles');
    console.log('   - Special roles using their abilities');
    console.log('   - More complex voting mechanics');
    console.log('   - Dynamic win condition checking');

  } catch (error) {
    console.error('❌ Game error:', error);
  }
}

// Run the example
main().catch(console.error);