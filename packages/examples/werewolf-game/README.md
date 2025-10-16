# Werewolf Game Example

A complex **fully autonomous multi-agent game** demonstrating true agent autonomy without hardcoded logic.

## What This Demonstrates

- **Full Autonomy**: Game-master runs entire game independently
- **Multi-Agent Coordination**: Multiple agents with different roles
- **Strategic Reasoning**: Agents make independent decisions
- **Evidence-Based Gameplay**: Alibis, deductions, voting
- **No Hardcoded Logic**: All rules exist in agent prompts

## Key Concepts

This is a **showcase of agent autonomy**:

❌ **Not This**: Hardcoded game logic with agents as I/O
✅ **This**: Autonomous game-master orchestrates everything

The game-master agent:
- Sets up the game
- Manages rounds (day/night)
- Facilitates voting
- Determines winners
- All without hardcoded rules!

## Running the Example

```bash
npx tsx packages/examples/werewolf-game/werewolf-game.ts
```

## Game Flow

```
1. Setup Phase
   Game-master assigns roles (werewolf, seer, villagers)

2. Night Phase
   - Werewolves choose victim
   - Seer investigates player

3. Day Phase
   - Players discuss and present alibis
   - Players vote to eliminate

4. Repeat until game end
   - Werewolves eliminated = Villagers win
   - Werewolves equal villagers = Werewolves win
```

## Agents

### Game-Master
- Orchestrates the entire game
- Manages game state
- Enforces rules
- Determines outcomes

### Role Agents
- **Werewolf**: Strategic deception
- **Seer**: Investigation and deduction
- **Villager**: Analysis and voting

## Why This Matters

This demonstrates that agents can:

1. **Receive High-Level Requests**: "Run a werewolf game"
2. **Handle All Details**: Setup, rules, coordination
3. **Make Complex Decisions**: Strategic gameplay
4. **Collaborate**: Multiple agents working together

No hardcoded workflows - pure agent autonomy!

## Code Highlights

```typescript
// Just tell the game-master to run a game
const result = await executor.execute(
  'game-master',
  'Run a werewolf game with 5 players'
);

// Game-master handles:
// - Player setup
// - Role assignment
// - Round management
// - Victory conditions
// All autonomously!
```

## Expected Output

You'll see:
- Game setup and role assignments
- Night phase actions
- Day phase discussions
- Voting and eliminations
- Strategic reasoning from each agent
- Game conclusion

## Technical Highlights

- **Stateful Gameplay**: Session management for game state
- **Strategic AI**: Agents reason about deception/trust
- **Dynamic Coordination**: Game-master adapts to game state
- **Evidence Tracking**: Alibis, investigations, patterns

## Next Steps

This level of autonomy enables:
- Complex simulations
- Strategic games
- Multi-agent negotiations
- Autonomous workflows

See also:
- `coding-team/` - Collaborative development
- `orchestration/` - Delegation patterns
- `thinking/` - Extended reasoning for strategy
