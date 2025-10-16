# Orchestration Example

Demonstrates **true autonomous agent orchestration** where agents decide when and how to delegate tasks to specialized sub-agents.

## What This Demonstrates

- **Autonomous Delegation**: Agents decide whether to handle tasks themselves or delegate
- **Agent Collaboration**: Multiple specialized agents working together
- **Delegate Tool**: Using the `Delegate` tool for agent-to-agent communication
- **Pull Architecture**: Child agents pull information they need via tools

## Key Concepts

This example shows the **difference between scripted workflows and true agent autonomy**:

- ❌ **Not This**: Hardcoded sequences like `research() → analyze() → write()`
- ✅ **This**: Orchestrator agent analyzes task and autonomously decides to delegate

The system demonstrates three delegation patterns:

1. **Direct Handling**: Simple tasks the orchestrator can do itself
2. **Single Delegation**: Complex tasks delegated to one specialist
3. **Multi-Agent Coordination**: Tasks requiring multiple specialists

## Running the Example

```bash
npx tsx packages/examples/orchestration/orchestration.ts
```

## Architecture

```
Orchestrator Agent
    ↓ (analyzes task)
    ├─→ Handles directly (simple)
    ├─→ Delegates to Researcher (needs data)
    ├─→ Delegates to Analyzer (needs analysis)
    └─→ Coordinates multiple agents (complex)
```

## Agents Included

- **orchestrator**: Main coordinator, decides delegation strategy
- **researcher**: Gathers and synthesizes information
- **analyzer**: Performs deep analysis
- **writer**: Creates structured outputs

## Code Highlights

```typescript
// Orchestrator autonomously decides to delegate
const result = await executor.execute(
  'orchestrator',
  'Analyze the error patterns in our logs and suggest improvements'
);
// Orchestrator may:
// 1. Use Read/Grep to gather logs
// 2. Delegate to analyzer for pattern analysis
// 3. Delegate to writer for recommendations
```

## Expected Behavior

You'll see the orchestrator:
1. Analyze the incoming task
2. Determine complexity and requirements
3. Autonomously decide delegation strategy
4. Coordinate specialist agents as needed
5. Synthesize results into final output

## Why This Matters

This demonstrates the **pull architecture** in action:
- No massive context dumps passed to child agents
- Each agent pulls only what it needs via tools
- Anthropic's caching makes this efficient (90% cost savings)
- Clean separation of concerns

## Next Steps

After this example, explore:
- `werewolf-game/` - Fully autonomous multi-agent game
- `coding-team/` - Collaborative software development
- `thinking/` - Extended reasoning for complex orchestration
