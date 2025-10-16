# Extended Thinking Example

Demonstrates **extended thinking** for complex reasoning, planning, and problem-solving.

## What This Demonstrates

- **Extended Thinking**: Deep reasoning before responding
- **Multi-Provider Support**: Works with Claude, OpenAI o1/o3, OpenRouter
- **Token Budgets**: Control reasoning depth
- **Performance Improvement**: Better results on complex tasks

## Key Concepts

Extended thinking allows agents to:
- Reason through problems step-by-step
- Consider multiple approaches
- Plan before acting
- Catch and correct mistakes

### Thinking Types

1. **Enabled**: Extended thinking with token budget
2. **Budget-Only**: Set token limit
3. **Disabled**: No extended thinking (default)

## Running the Example

```bash
npx tsx packages/examples/thinking/thinking.ts
```

## Configuration

In agent markdown frontmatter:

```yaml
---
name: planner
tools: ["delegate", "todowrite"]
thinking:
  type: enabled
  budget_tokens: 16000
---

You are a project planner. Think through:
- What is the end goal?
- What order makes sense?
- What could go wrong?
```

## Token Budget Guide

| Complexity | Budget | Use Case |
|-----------|--------|----------|
| Simple | 2K-5K | Basic analysis, routing |
| Moderate | 5K-10K | Code implementation, planning |
| Complex | 10K-16K | Multi-agent orchestration |
| Very Complex | 16K-24K | Deep analysis, problem solving |

## Provider Support

- **Anthropic**: Extended thinking (Claude 3.7) & Interleaved (Claude 4+)
- **OpenAI**: Automatic reasoning (o1, o3)
- **OpenRouter**: Reasoning tokens (200+ models)

## Example Output

```
🧠 Agent Thinking:
Let me analyze this request step by step:

1. The user wants a factorial function
2. Edge cases: 0!, negative numbers
3. Should delegate to implementer
4. Implementer needs requirements
5. Tests should verify correctness

Plan: Explore project structure, then delegate
      with clear requirements.

[Agent then executes the planned approach]
```

## Code Highlights

```typescript
// Agent with thinking enabled
const agent = {
  name: 'orchestrator',
  thinking: {
    type: 'enabled',
    budget_tokens: 16000
  }
};

// System shows thinking process
const result = await executor.execute(
  'orchestrator',
  'Design a caching system'
);
```

## Performance Impact

**Without Thinking**:
- Faster responses
- Lower token usage
- May miss edge cases

**With Thinking**:
- Better quality
- More thorough analysis
- Higher token cost (but worth it for complex tasks)

## When to Use

✅ **Use Extended Thinking For:**
- Complex orchestration
- Code design and architecture
- Multi-step planning
- Problem decomposition
- Edge case analysis

❌ **Skip Extended Thinking For:**
- Simple queries
- Data retrieval
- Straightforward tasks
- Cost-sensitive operations

## Next Steps

Explore:
- `orchestration/` - Add thinking to orchestrator
- `coding-team/` - Thinking for code design
- `werewolf-game/` - Strategic thinking in games
