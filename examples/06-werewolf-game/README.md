# Werewolf Game - Multi-Agent Coordination Example

This example demonstrates how multiple agents can coordinate to play the social deduction game "Werewolf" (also known as Mafia).

## What This Demonstrates

1. **Multi-Agent Coordination**: Different agents playing different roles
2. **Role-Based Behavior**: Each agent acts according to their role's goals
3. **No Tools Required**: Pure agent decision-making and reasoning
4. **Game State Management**: Tracking players, phases, and special abilities
5. **Strategic Thinking**: Agents make decisions based on game theory

## The Agents

### Game Master (`game-master.md`)
- Coordinates game flow
- Narrates deaths dramatically  
- Manages night/day phases
- Determines win conditions

### Werewolf (`werewolf.md`)
- Secretly eliminates villagers at night
- Pretends to be innocent during the day
- Deflects suspicion onto others
- Coordinates with other werewolves

### Villager (`villager.md`)
- Analyzes behavior patterns
- Votes to eliminate suspected werewolves
- Builds alliances with trusted players
- Uses deduction and logic

### Seer (`seer.md`)
- Investigates one player each night
- Learns if they are werewolf or innocent
- Must share knowledge carefully to avoid becoming a target
- Guides village discussion with subtle hints

### Witch (`witch.md`)
- Has one-time life potion to save victims
- Has one-time death potion to eliminate suspects
- Must use powers strategically

## How It Works

The example simulates one round of the game:

1. **Night Phase**:
   - Werewolves choose a victim
   - Seer investigates a player
   - Other roles would act (simplified in demo)

2. **Day Phase**:
   - Game Master announces the death
   - Players discuss and share suspicions
   - Village votes to lynch someone
   - Check win conditions

## Running the Example

```bash
npm run example:werewolf
```

Or directly:
```bash
npx tsx examples/06-werewolf-game.ts
```

## Key Insights

1. **No External Tools**: Agents make decisions purely through reasoning
2. **Information Asymmetry**: Different agents have different information
3. **Strategic Communication**: Agents must balance sharing info vs. staying hidden
4. **Dynamic Gameplay**: Each agent's response affects the game state

## Extending the Example

To create a full game implementation, you could:

1. Add more roles (Defender, Cupid, Hunter, etc.)
2. Implement full game loops until win condition
3. Add more sophisticated voting mechanics
4. Track and use player history for decisions
5. Implement private communication channels
6. Add tournament mode with multiple games

## Architecture Benefits

This example showcases how the agent orchestration system can handle:
- Complex multi-agent scenarios
- Role-based behavior patterns
- Stateful game management
- Strategic decision-making
- Natural language interaction

The middleware pipeline ensures each agent interaction is safe and controlled, while the pull architecture allows agents to act independently within their roles.