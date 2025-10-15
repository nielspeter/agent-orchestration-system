# Extended Thinking & Reasoning Guide

## What is Extended Thinking?

Extended thinking is a capability that enables deeper, step-by-step reasoning before generating responses. When enabled, agents take time to "think through" complex problems internally, showing you their reasoning process.

> **Multi-Provider Support**: This feature works across multiple providers with a universal configuration interface. The system automatically maps your configuration to provider-specific APIs.

Think of it like this:
- **Without thinking**: Agent responds immediately based on training
- **With thinking**: Agent pauses to reason, plan, and consider alternatives before responding

## Provider Support

| Provider | Feature Name | Support Level | Visibility | Models |
|----------|-------------|---------------|------------|--------|
| **Anthropic** | Extended Thinking | Full | Visible thinking blocks | Claude Opus 4.x, Sonnet 3.7+, Sonnet 4.x |
| **OpenRouter** | Reasoning Tokens | Full | Visible reasoning (varies) | Claude, OpenAI, Grok, Gemini, Qwen |
| **OpenAI** | Reasoning Models | Automatic | Hidden (built-in) | o1, o3 series |
| **Others** | N/A | Not supported | - | - |

## Why Use Extended Thinking?

Extended thinking significantly improves agent performance on:

✅ **Complex Planning**
- Multi-step workflows
- Orchestration decisions
- Strategy formulation

✅ **Code Tasks**
- Designing implementations before writing code
- Analyzing code structure and patterns
- Thorough code reviews

✅ **Problem Solving**
- Mathematical reasoning
- Logic puzzles
- Multi-constraint optimization

✅ **Analysis**
- Deep document analysis
- Comparative evaluations
- Risk assessment

## How It Works

### 1. Universal Configuration

Extended thinking uses a **single, provider-agnostic configuration** that works everywhere:

```yaml
---
name: my-agent
tools: ["read", "write", "delegate"]
thinking:
  type: enabled
  budget_tokens: 10000
---

You are an agent that solves complex problems...
```

**What happens:**
- **Anthropic (direct)**: Uses extended thinking API with `thinking` parameter
- **OpenRouter**: Uses reasoning tokens API with `reasoning` parameter
- **OpenAI**: Auto-selects reasoning model (o1/o3 series)
- **Other providers**: Logs warning, continues without thinking

The system automatically translates your configuration to the provider's format. You don't need to change anything when switching providers.

### 2. Agent Thinks Before Acting

When your agent receives a task:

```
User Request → Agent Thinks (internal) → Agent Acts (visible)
```

The thinking process:
1. **Analyzes** the request
2. **Considers** different approaches
3. **Plans** the solution
4. **Reasons** through edge cases
5. **Generates** the final response

### 3. See The Thinking Process

Thinking/reasoning is logged separately so you can see what the agent considered:

```
🧠 Agent Thinking:
Let me analyze this request step by step:

1. The user wants to implement a factorial function
2. I need to consider edge cases: 0!, negative numbers
3. I should delegate to the implementer agent
4. The implementer will need the project path
5. After implementation, I'll need to verify with tests

Plan: First explore the project structure, then delegate to implementer
      with clear requirements including edge case handling.

[Agent then executes the plan using tools]
```

> **Note**: With OpenRouter and some models, you may see "🧠 Agent Reasoning" instead of "Agent Thinking".

## Configuration Options

### Basic Configuration

```yaml
thinking:
  type: enabled
  budget_tokens: 10000
```

### Token Budget Guide

**Minimum**: 1,024 tokens
**Default**: 10,000 tokens (good balance)
**Complex Tasks**: 16,000+ tokens

| Task Complexity | Recommended Budget | Example Use Case |
|----------------|-------------------|------------------|
| Simple | 2,000-5,000 | Basic analysis, simple decisions |
| Moderate | 5,000-10,000 | Code implementation, planning |
| Complex | 10,000-16,000 | Multi-agent orchestration, code review |
| Very Complex | 16,000-24,000 | Deep analysis, complex problem solving |

### Budget Recommendations by Agent Type

```yaml
# Orchestrator - Complex coordination
thinking:
  budget_tokens: 16000

# Implementer - Code design
thinking:
  budget_tokens: 10000

# Code Reviewer - Thorough analysis
thinking:
  budget_tokens: 12000

# Analyst - Deep analysis
thinking:
  budget_tokens: 16000

# Simple Helper - Basic tasks
thinking:
  budget_tokens: 5000
```

## Provider-Specific Details

While the configuration is universal, each provider implements thinking/reasoning differently. Understanding these differences helps you choose the right provider and debug issues.

### Anthropic (Direct API)

**Best for**: Visible, detailed thinking process

- **API Parameter**: `thinking: {type: 'enabled', budget_tokens: number}`
- **Response Field**: `content[].thinking` or `content[].redacted_thinking`
- **Models Supported**: Claude Opus 4.x, Sonnet 3.7+, Sonnet 4.x
- **Thinking Visibility**: Full thinking blocks visible in response
- **Billing**: Input tokens ($3/M for Sonnet, $15/M for Opus)
- **Token Budget**: 1,024 - 100,000 tokens
- **Incompatible With**: temperature, top_p, forced tool use, pre-filled messages
- **History Handling**: Anthropic auto-removes thinking from conversation context

**Example Model Strings**:
```yaml
model: "anthropic/claude-3-7-sonnet-20250219"
model: "anthropic/claude-opus-4-20250514"
```

### OpenRouter

**Best for**: Multi-model reasoning, flexibility

- **API Parameter**: `reasoning: {effort: 'low'|'medium'|'high', max_tokens: number}`
- **Response Field**: `reasoning_details` (format varies by model)
- **Models Supported**: Claude, OpenAI, Grok, Gemini, Qwen (and more)
- **Reasoning Visibility**: Varies by model (some visible, some summarized)
- **Billing**: Output tokens (varies by model)
- **Token Budget**: 1,024 - 32,000 tokens
- **Effort Mapping**:
  - Low: < 5,000 tokens (~20% of max)
  - Medium: 5,000-12,000 tokens (~50% of max)
  - High: 12,000+ tokens (~80% of max)
- **Compatible With**: Most features (varies by underlying model)

**Example Model Strings**:
```yaml
model: "openrouter/anthropic/claude-3.7-sonnet"
model: "openrouter/openai/gpt-4-turbo"
model: "openrouter/meta-llama/llama-3.1-70b"
```

### OpenAI (Direct API)

**Best for**: Automatic reasoning, no configuration needed

- **API Parameter**: None (automatic in o1/o3 models)
- **Response Field**: Hidden (reasoning not exposed)
- **Models Supported**: o1, o3 series
- **Reasoning Visibility**: Hidden (not accessible)
- **Billing**: Separate reasoning tokens (pricing varies)
- **Token Budget**: Automatic (not controllable)
- **Model Selection**: System auto-upgrades to o1 when thinking is enabled
- **Incompatible With**: temperature, top_p (o1/o3 don't support these)

**Example Model Strings**:
```yaml
model: "openai/o3"
```

> **Note**: When you enable thinking with OpenAI, the system may automatically upgrade your model (e.g., gpt-4 → o1) to use a reasoning-capable model.

## Important Constraints

### ⚠️ Model Requirements

Extended thinking requires compatible models:

**Anthropic:**
- ✅ Claude Opus 4.x (summarized thinking output)
- ✅ Claude Sonnet 3.7+ (full thinking output)
- ✅ Claude Sonnet 4.x (full thinking output)
- ❌ Claude 3.5 Haiku and older models

**OpenRouter:**
- ✅ Most models support reasoning (Claude, OpenAI, Grok, Gemini, Qwen)
- Check OpenRouter docs for specific model compatibility

**OpenAI:**
- ✅ o1, o3 series only
- ❌ GPT-4, GPT-3.5, and other non-reasoning models

### ⚠️ Incompatible Features

Compatibility varies by provider:

**Anthropic:**
- ❌ Temperature/Top_P modifications
- ❌ Forced tool use
- ❌ Pre-filled assistant messages

```yaml
# This won't work with Anthropic:
thinking:
  type: enabled
temperature: 0.7  # ← Incompatible!
```

**OpenAI (o1/o3):**
- ❌ Temperature/Top_P (o1/o3 models don't support these)
- ❌ System messages (limited support)

**OpenRouter:**
- Varies by underlying model
- Generally more permissive than direct APIs

### ✅ Compatible Features

Extended thinking **works great** with:

✅ Tool use (Read, Write, Delegate, etc.)
✅ Multi-turn conversations
✅ Agent delegation
✅ Structured prompts
✅ Behavior presets (Anthropic and OpenRouter)

## Practical Examples

### Example 1: Orchestrator Agent

```yaml
---
name: orchestrator
tools: ["list", "todowrite", "delegate"]
thinking:
  type: enabled
  budget_tokens: 16000
---

You are a project orchestrator that coordinates multiple agents.

## Your Process

Before delegating tasks, think through:
1. What is the end goal?
2. What agents do I need?
3. In what order should work happen?
4. What could go wrong?
5. How will I validate success?

Then use your tools to execute the plan.
```

**Result**: The orchestrator makes better delegation decisions and anticipates issues.

### Example 2: Code Implementer

```yaml
---
name: implementer
tools: ["read", "write", "list", "shell"]
thinking:
  type: enabled
  budget_tokens: 10000
---

You are a senior software engineer.

## Your Process

Before writing code:
1. Understand the requirements
2. Review existing code patterns
3. Design the solution
4. Consider edge cases
5. Plan the implementation

Then write the code using your tools.
```

**Result**: Better code design, fewer bugs, cleaner implementations.

### Example 3: Code Reviewer

```yaml
---
name: code-reviewer
tools: ["read", "list"]
thinking:
  type: enabled
  budget_tokens: 12000
---

You are a thorough code reviewer.

## Your Process

When reviewing code:
1. Understand the intent
2. Check for edge cases
3. Evaluate error handling
4. Assess code quality
5. Identify improvements

Then provide structured feedback.
```

**Result**: More thorough reviews with actionable feedback.

## Best Practices

### ✅ DO:

1. **Use for Complex Tasks**
   - Planning and orchestration
   - Code design and review
   - Multi-step reasoning

2. **Set Appropriate Budgets**
   - Start with 10,000 tokens
   - Increase for complex tasks
   - Monitor and adjust

3. **Structure Your Prompts**
   - Give agents clear thinking frameworks
   - Encourage step-by-step reasoning
   - Ask for planning before action

4. **Monitor Performance**
   - Check thinking logs
   - Verify improved outcomes
   - Adjust budgets as needed

### ❌ DON'T:

1. **Don't Use for Simple Tasks**
   - Quick file reads
   - Simple text responses
   - Basic information retrieval

2. **Don't Set Tiny Budgets**
   - Minimum is 1,024 tokens
   - Too small = incomplete thinking
   - Start with at least 5,000

3. **Don't Combine with Incompatible Features**
   - No temperature adjustments
   - No forced tool use
   - No pre-filled responses

4. **Don't Ignore the Thinking Output**
   - Review thinking logs to understand decisions
   - Use insights to improve prompts
   - Learn from the reasoning process

## Cost Considerations

### Token Usage by Provider

**Anthropic (Direct):**
- Thinking tokens billed as **input tokens**

| Model | Input Token Cost | 10k Thinking Tokens |
|-------|-----------------|---------------------|
| Claude Opus 4 | $15 per 1M | $0.15 |
| Claude Sonnet 3.7+ | $3 per 1M | $0.03 |

**OpenRouter:**
- Reasoning tokens billed as **output tokens**
- Costs vary by model (check OpenRouter pricing)
- Example: Claude via OpenRouter ~$0.04-0.06 per 10k tokens

**OpenAI (Direct):**
- Reasoning tokens billed separately
- o1: ~$15 per 1M reasoning tokens
- o3: Pricing varies by tier

### Budget Management

**Example**: Agent with 10,000 token thinking/reasoning budget

| Provider | Model | Approximate Cost |
|----------|-------|-----------------|
| Anthropic | Sonnet 3.7 | $0.03 per run |
| Anthropic | Opus 4 | $0.15 per run |
| OpenRouter | Claude 3.7 | $0.05 per run |
| OpenRouter | OpenAI o1 | $0.20 per run |
| OpenAI | o1 | $0.15 per run |

**Trade-off**: Small cost increase for significantly better results

**Tips**:
- Start with Anthropic Sonnet 3.7 for development (cheapest)
- Use OpenRouter for multi-model experiments
- Reserve Opus 4 and OpenAI o1 for critical production tasks

## Debugging & Monitoring

### View Thinking Logs

Thinking is automatically logged:

```
🧠 Agent Thinking:
[Agent's internal reasoning appears here]

📊 Token Metrics:
  Input tokens: 5,234
  🧠 Thinking: 8,521  ← Thinking token usage
  Output tokens: 1,432
```

### Common Issues

**Issue**: "Extended thinking requires claude-3-7-sonnet or newer"
- **Provider**: Anthropic
- **Fix**: Update your model to Claude Sonnet 3.7+ or Claude Opus 4.x

**Issue**: "Cannot use temperature with thinking"
- **Provider**: Anthropic, OpenAI
- **Fix**: Remove `temperature` and `top_p` from agent config (incompatible with thinking)

**Issue**: "Thinking budget must be at least 1024 tokens"
- **Provider**: Anthropic
- **Fix**: Increase your `budget_tokens` value to at least 1024

**Issue**: Thinking/reasoning seems truncated
- **All Providers**
- **Fix**: Increase `budget_tokens` - you may have hit the token limit

**Issue**: No thinking visible in logs
- **Possible Causes**:
  - Model doesn't support thinking (check provider-specific requirements)
  - Provider doesn't expose reasoning (OpenAI o1/o3 hides reasoning)
  - Configuration not properly passed to API (check logs for warnings)

### Performance Tips

1. **Adjust Budgets Based on Task**
   - Simple: 2,000-5,000 tokens
   - Moderate: 5,000-10,000 tokens
   - Complex: 10,000-20,000 tokens

2. **Monitor Thinking Quality**
   - Are decisions improving?
   - Is planning more thorough?
   - Are fewer errors occurring?

3. **Iterate on Prompts**
   - Encourage structured thinking in prompts
   - Ask agents to plan before acting
   - Request step-by-step reasoning

## Real-World Example

### Before Extended Thinking

```yaml
---
name: orchestrator
tools: ["delegate"]
---

You coordinate agents to complete tasks.
```

**Agent behavior**: Immediately delegates without planning
**Result**: Misses edge cases, inefficient delegation order

### After Extended Thinking

```yaml
---
name: orchestrator
tools: ["delegate"]
thinking:
  type: enabled
  budget_tokens: 16000
---

You coordinate agents to complete tasks.

Before delegating, think through:
- What is needed?
- What order makes sense?
- What could go wrong?
- How to validate?

Then execute your plan.
```

**Agent behavior**: Plans approach, considers alternatives, anticipates issues
**Result**: Better coordination, fewer errors, more efficient execution

## FAQ

### Q: When should I use extended thinking?

**A**: Use it for tasks requiring:
- Planning and strategy
- Complex problem-solving
- Code design and review
- Multi-step reasoning
- Risk analysis

Skip it for:
- Simple information retrieval
- Basic file operations
- Quick responses

### Q: Which provider should I use?

**A**: Choose based on your needs:
- **Anthropic (direct)**: Best for visible, detailed thinking; cheapest for development (Sonnet 3.7)
- **OpenRouter**: Best for multi-model experiments and flexibility
- **OpenAI**: Best for automatic reasoning with o1/o3 models (no configuration needed)

### Q: How much does it cost?

**A**: Costs vary by provider:
- **Anthropic Sonnet 3.7**: ~$0.03 per 10k thinking tokens (cheapest)
- **Anthropic Opus 4**: ~$0.15 per 10k thinking tokens
- **OpenRouter**: $0.04-0.20 per 10k tokens (varies by model)
- **OpenAI o1**: ~$0.15 per 10k reasoning tokens

A typical 10k token budget costs $0.03-0.20 per agent run.

### Q: Can I see what the agent is thinking?

**A**: Depends on the provider:
- **Anthropic**: Yes, full thinking blocks logged with 🧠 emoji
- **OpenRouter**: Varies by model (most show reasoning)
- **OpenAI o1/o3**: No, reasoning is hidden (built into model)

### Q: Does thinking slow down responses?

**A**: Slightly - agents take extra time to think. However, the improved quality usually saves time overall by reducing errors and iterations.

### Q: Can I use thinking with tool use?

**A**: Yes! Thinking works great with tools across all providers. The agent can reason about which tools to use and how to use them effectively.

### Q: What if I set the budget too low?

**A**: The agent's thinking/reasoning may be cut off mid-process. Start with at least 5,000 tokens and increase if needed.

### Q: Can I use thinking with temperature?

**A**: Depends on provider:
- **Anthropic**: No, incompatible with temperature/top_p
- **OpenAI o1/o3**: No, these models don't support temperature
- **OpenRouter**: Varies by underlying model (usually yes)

### Q: Is thinking preserved in conversation history?

**A**: No - Anthropic automatically removes thinking blocks from conversation history. OpenRouter and OpenAI handle this differently but generally don't include reasoning in context.

### Q: Can I switch providers without changing my agent configuration?

**A**: Yes! The same `thinking: {type: enabled, budget_tokens}` configuration works across all providers. The system automatically translates to provider-specific formats.

## Summary

Extended thinking and reasoning give your agents the ability to think deeply before acting, leading to:

✅ Better planning and strategy
✅ Improved code quality
✅ Fewer errors and iterations
✅ More thorough analysis
✅ Smarter decision-making

**Key Benefits**:
- **Universal Configuration**: Same config works across all providers
- **Provider Flexibility**: Choose the best provider for each task
- **Cost-Effective**: $0.03-0.20 per run depending on provider/model
- **Significant Quality Gains**: Better results justify the small cost increase

**Bottom Line**: Enable thinking for agents doing complex work. It's worth it.

---

## Implementation Details

### Thinking Block Preservation

**Background**: Claude's interleaved thinking API requires thinking blocks to be preserved across multi-turn conversations. If thinking blocks are lost during format conversion, the API will reject subsequent requests.

**The Challenge**: When the system receives a response from Claude containing thinking blocks, it must:
1. Extract text content for the user
2. Extract tool calls for execution
3. **Preserve thinking blocks** for the next API call

**The Solution**: We use a `raw_content` field in our Message type to preserve the original API response structure:

```typescript
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;           // User-visible text
  tool_calls?: ToolCall[];   // Tool executions
  raw_content?: unknown;     // Original API blocks (includes thinking)
}
```

**How It Works**:

1. **Response Formatting** (packages/core/src/providers/anthropic-provider.ts:329):
   ```typescript
   private formatResponse(response: Anthropic.Message): Message {
     // Extract text content (excluding thinking)
     const textContent = response.content
       .filter((c) => c.type === 'text')
       .map((c) => c.text)
       .join('');

     // Check if response contains thinking blocks
     const hasThinkingBlocks = response.content.some(
       (c) => c.type === 'thinking' || c.type === 'redacted_thinking'
     );

     const message: Message = {
       role: 'assistant',
       content: textContent,
     };

     // Preserve raw content blocks if thinking is present
     if (hasThinkingBlocks) {
       message.raw_content = response.content;  // KEY: Store original blocks
     }

     return message;
   }
   ```

2. **Message Re-use** (packages/core/src/providers/anthropic-provider.ts:231):
   ```typescript
   if (msg.role === 'assistant') {
     // If raw content blocks are present, use them directly
     if (msg.raw_content && Array.isArray(msg.raw_content)) {
       formatted.push({
         role: 'assistant',
         content: msg.raw_content,  // KEY: Use preserved blocks
       });
       continue;
     }
   }
   ```

**Why This Matters**:
- **Interleaved thinking** (`interleaved-thinking-2025-05-14`) requires all assistant messages to start with thinking blocks
- **Extended thinking** (`extended-thinking-2024-12-12`) also benefits from block preservation
- Without this, multi-turn conversations fail with: "Expected `thinking` or `redacted_thinking`, but found `text`"

**Token Reporting Differences**:
- **Extended thinking** (Claude 3.7): Reports `thinking_tokens` in usage metrics
- **Interleaved thinking** (Claude 4): Does NOT report `thinking_tokens` in usage metrics
- Our implementation handles both by checking for thinking blocks directly, not relying on token counts

For the complete technical breakdown, see: `packages/core/docs/thinking-block-preservation-fix.md`

## Additional Resources

### Official Provider Documentation
- [Anthropic Extended Thinking](https://docs.claude.com/en/docs/build-with-claude/extended-thinking)
- [OpenRouter Reasoning Tokens](https://openrouter.ai/docs/use-cases/reasoning-tokens)
- [OpenAI o1 Models](https://platform.openai.com/docs/guides/reasoning)

### Examples and Cookbooks
- [Anthropic Extended Thinking Examples](https://github.com/anthropics/claude-cookbooks/tree/main/extended_thinking)
- [Extended Thinking with Tool Use](https://github.com/anthropics/claude-cookbooks/blob/main/extended_thinking/extended_thinking_with_tool_use.ipynb)

### Implementation Guides (for developers)
- [Extended Thinking Implementation Plan](./extended-thinking-implementation-plan.md)
- [Multi-Provider Architecture](./extended-thinking-implementation-plan.md#phase-11-provider-agnostic-mapping-layer)
- [Thinking Block Preservation Fix](../packages/core/docs/thinking-block-preservation-fix.md) - Technical deep dive

---

**Last Updated**: 2025-10-15
