# Extended Thinking Implementation Plan ("ultrathink")

## Overview

Add extended thinking capability to the agent system, allowing agents to engage in deep reasoning before generating
responses. This will improve decision-making, planning, and problem-solving quality.

## Background

### What is Extended Thinking?

Extended thinking is a pre-response planning mechanism where Claude deeply considers and plans its approach **before**
starting to generate a response or make tool calls.

**Key Differences:**

- **Extended Thinking (API)**: Happens before response generation, genuine deep reasoning
- **Chain-of-Thought (Prompt)**: Happens during response, "showing work" as text output

### Important Constraints

⚠️ **Critical Requirements:**

- **Models**: Works with Claude Opus 4.x and Sonnet 4.x (including Sonnet 3.7)
    - **Claude 4**: Returns summarized thinking output
    - **Claude Sonnet 3.7**: Returns full thinking output
- **Temperature/Top_P**: Cannot use with temperature or top_p modifications
- **Tool Use**: Cannot use with forced tool use
- **Pre-filled Responses**: Cannot use with pre-filled assistant messages
- **Budget**:
    - Minimum: 1,024 tokens
    - Recommended starting: 16,000+ tokens for complex tasks
    - Must be less than `max_tokens`
- **Context Management**: Thinking blocks are automatically removed from conversation history
- **Context Window**: Thinking tokens count towards context limit
- **Billing**: Thinking tokens are billed at standard input rates
    - Claude Opus: $15 per million input tokens
    - Claude Sonnet: $3 per million input tokens

### Why Both?

We'll implement **both approaches**:

1. **API-level thinking** - Better reasoning quality
2. **Prompt-level structure** - Better output structure and transparency

## Architecture

### Three-Layer Implementation

```
┌─────────────────────────────────────────┐
│  Agent Frontmatter (Configuration)      │
│  thinking:                               │
│    type: extended                        │
│    budget_tokens: 10000                  │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  Agent Loader (Parse & Pass)            │
│  Reads frontmatter → Agent object       │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  Anthropic Provider (API Call)          │
│  Passes thinking to Anthropic API       │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  Logs, Metrics & Events                 │
│  Track thinking usage separately        │
└─────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Type Definitions

**File**: `packages/core/src/config/types.ts`

**Changes**:

```typescript
// Add new interface
export interface ThinkingConfig {
  /** Thinking mode - only 'enabled' is supported */
  type: 'enabled';
  /** Token budget for thinking (minimum: 1024) */
  budget_tokens?: number;
}

// Add to Agent interface
export interface Agent {
  // ... existing fields
  thinking?: ThinkingConfig;
}
```

**Important Notes:**

- Only `type: 'enabled'` is supported (not 'extended')
- Minimum budget_tokens is 1024
- Default budget_tokens should be 10000 (balance between minimum and recommended 16k+)
- For complex tasks (orchestration, code review), consider 16000+

---

### Phase 2: Agent Loader Updates

**File**: `packages/core/src/agents/loader.ts`

**Changes**:

```typescript
// In loadAgent() method, when parsing frontmatter:
return {
  id: data.name,
  name: data.name,
  description: description.trim(),
  prompt: description.trim(),
  tools: data.tools || [],
  model: data.model,
  behavior: data.behavior,
  temperature: data.temperature,
  top_p: data.top_p,
  response_format: data.response_format,
  json_schema: data.json_schema,
  thinking: data.thinking,  // ← Add this
};
```

---

### Phase 3: Anthropic Provider Updates

**File**: `packages/core/src/providers/anthropic-provider.ts`

#### Step 3.1: Update Constructor

Add thinking parameter to constructor:

```typescript
constructor(
  modelName
:
string,
  logger ? : AgentLogger,
  pricing ? : ModelPricing,
  maxOutputTokens ? : number,
  temperature ? : number,
  topP ? : number,
  thinking ? : ThinkingConfig  // ← Add this
)
{
  // ... existing code
  this.thinking = thinking;
}
```

#### Step 3.2: Validate Constraints

Add validation before creating request:

```typescript
// Validate thinking constraints
if (this.thinking) {
  // Thinking requires compatible model
  if (!this.modelName.includes('claude-3-7') && !this.modelName.includes('claude-4')) {
    throw new Error(
      `Extended thinking requires claude-3-7-sonnet-20250219 or newer. Got: ${this.modelName}`
    );
  }

  // Cannot use temperature/top_p with thinking
  if (this.temperature !== undefined || this.topP !== undefined) {
    this.logger?.logSystemMessage(
      '⚠️  Extended thinking: Ignoring temperature/top_p (not compatible with thinking)'
    );
  }

  // Validate minimum budget
  const budget = this.thinking.budget_tokens || 10000;
  if (budget < 1024) {
    throw new Error(`Thinking budget must be at least 1024 tokens. Got: ${budget}`);
  }

  // Warn if budget exceeds max_tokens
  if (budget >= this.maxOutputTokens) {
    throw new Error(
      `Thinking budget (${budget}) must be less than max_tokens (${this.maxOutputTokens})`
    );
  }
}
```

#### Step 3.3: Pass to API

In `complete()` method around line 81-89:

```typescript
const params: Anthropic.MessageCreateParams = {
  model: this.modelName,
  max_tokens: this.maxOutputTokens,
  // IMPORTANT: Do not include temperature/top_p if thinking is enabled
  ...(this.thinking
      ? {}
      : {
        temperature: this.temperature,
        top_p: this.topP,
      }
  ),
  system: formattedSystem,
  messages: formattedMessages,
  tools: formattedTools,
  // Add thinking if configured
  ...(this.thinking && {
    thinking: {
      type: 'enabled',
      budget_tokens: this.thinking.budget_tokens || 10000,
    },
  }),
};
```

#### Step 3.3: Update Beta Header

Around line 92-96, update header to include thinking:

```typescript
const response = await this.client.messages.create(params, {
  headers: {
    'anthropic-beta': 'prompt-caching-2024-07-31,extended-thinking-2024-12-12',
  },
});
```

---

### Phase 4: Response Parsing

**File**: `packages/core/src/providers/anthropic-provider.ts`

Update `formatResponse()` method (line 281-319) to extract thinking blocks:

```typescript
private
formatResponse(response
:
Anthropic.Message
):
Message
{
  // Extract thinking content (handle both 'thinking' and 'redacted_thinking')
  const thinkingBlocks = response.content.filter(
    (c) => c.type === 'thinking' || c.type === 'redacted_thinking'
  );

  let thinkingContent = '';
  let hasRedactedThinking = false;

  for (const block of thinkingBlocks) {
    if (block.type === 'thinking') {
      thinkingContent += block.thinking + '\n\n';
    } else if (block.type === 'redacted_thinking') {
      hasRedactedThinking = true;
      thinkingContent += '[REDACTED THINKING - Content encrypted for safety]\n\n';
    }
  }

  // Log thinking separately if present
  if (thinkingContent && this.logger) {
    this.logger.logSystemMessage('🧠 Agent Thinking:\n' + thinkingContent.trim());
    if (hasRedactedThinking) {
      this.logger.logSystemMessage(
        '⚠️  Some thinking was redacted for safety reasons'
      );
    }
  }

  // Extract text content (excluding thinking)
  const textContent = response.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .filter(Boolean)
    .join('');

  // Extract tool calls (unchanged)
  const toolCalls: ToolCall[] = response.content
    .filter((c) => c.type === 'tool_use')
    .map((c) => {
      const toolUse = c;
      return {
        id: toolUse.id,
        type: 'function' as const,
        function: {
          name: toolUse.name,
          arguments: JSON.stringify(toolUse.input),
        },
      };
    });

  // Store thinking for potential later use
  this.lastThinking = thinkingContent || undefined;

  // Rest of method unchanged
  // ...
}
```

---

### Phase 5: Metrics & Tracking

#### Step 5.1: Update Usage Metrics

**File**: `packages/core/src/providers/llm-provider.interface.ts`

```typescript
export interface UsageMetrics {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  promptCacheHitTokens?: number;
  promptCacheMissTokens?: number;
  thinkingTokens?: number;  // ← Add this
}
```

#### Step 5.2: Track Thinking Tokens

**File**: `packages/core/src/providers/anthropic-provider.ts`

In `complete()` method where usage is recorded (around line 104-115):

```typescript
this.lastUsageMetrics = {
  promptTokens: response.usage.input_tokens,
  completionTokens: response.usage.output_tokens,
  totalTokens: response.usage.input_tokens + response.usage.output_tokens,
  promptCacheHitTokens: response.usage.cache_read_input_tokens || undefined,
  promptCacheMissTokens: response.usage.cache_creation_input_tokens || undefined,
  thinkingTokens: response.usage.thinking_tokens || undefined,  // ← Add this
};
```

#### Step 5.3: Log Thinking Metrics

Update `logCacheMetrics()` to include thinking:

```typescript
private
logCacheMetrics(usage
:
Anthropic.Message['usage']
)
{
  const metrics: CacheMetrics = {
    inputTokens: usage.input_tokens,
    cacheCreationTokens: usage.cache_creation_input_tokens || undefined,
    cacheReadTokens: usage.cache_read_input_tokens || undefined,
    outputTokens: usage.output_tokens,
    thinkingTokens: usage.thinking_tokens || undefined,  // ← Add this
  };

  // ... existing code ...

  const metricsContent = [
    '📊 Token Metrics:',
    `  Input tokens: ${metrics.inputTokens}`,
    metrics.cacheCreationTokens ? `  Cache creation: ${metrics.cacheCreationTokens}` : '',
    metrics.cacheReadTokens ? `  Cache read: ${metrics.cacheReadTokens}` : '',
    metrics.thinkingTokens ? `  🧠 Thinking: ${metrics.thinkingTokens}` : '',  // ← Add this
    `  Output tokens: ${metrics.outputTokens}`,
  ]
    .filter(Boolean)
    .join('\n');

  // ... rest of method
}
```

---

### Phase 6: Provider Factory Updates

**File**: `packages/core/src/providers/provider-factory.ts`

Update the factory to pass thinking config to provider:

```typescript
// In createProvider() or wherever AnthropicProvider is instantiated:
return new AnthropicProvider(
  modelName,
  logger,
  pricing,
  maxOutputTokens,
  temperature,
  topP,
  agent.thinking  // ← Add this
);
```

---

### Phase 7: Agent Prompt Updates

#### Orchestrator Agent

**File**: `packages/examples/coding-team/agents/orchestrator.md`

```yaml
---
name: orchestrator
tools: [ "list", "todowrite", "delegate" ]
behavior: balanced
# Note: temperature/top_p removed - not compatible with thinking
thinking:
  type: enabled
  budget_tokens: 16000  # Higher budget for complex orchestration
---

  You are the Orchestrator - a technical project manager.

## Planning Protocol

Before taking action, create a detailed plan:

  <planning>
  1. What is the goal?
  2. What agents do I need?
  3. In what order should I delegate?
  4. What could go wrong?
  5. How will I validate success?
  </planning>

  Then execute your plan using the Delegate tool.

  [ rest of existing prompt... ]
```

#### Implementer Agent

**File**: `packages/examples/coding-team/agents/implementer.md`

```yaml
---
name: implementer
tools: [ 'read', 'write', 'list', 'shell' ]
behavior: precise
# Note: temperature/top_p removed - not compatible with thinking
thinking:
  type: enabled
  budget_tokens: 10000  # Standard budget for code design
---

  You are the Implementer - a senior software engineer.

## Design Phase

Before writing code:

  <design>
1. File location: [ where will this code live? ]
2. Function signature: [ what's the interface? ]
3. Implementation approach: [ how will it work? ]
4. Edge cases: [ what needs handling? ]
5. Dependencies: [ what does it depend on? ]
  </design>

  Then implement the code.

  [ rest of existing prompt... ]
```

#### Code Reviewer Agent

**File**: `packages/examples/coding-team/agents/code-reviewer.md`

```yaml
---
name: code-reviewer
tools: [ "read", "list" ]
behavior: precise
# Note: temperature/top_p removed - not compatible with thinking
thinking:
  type: enabled
  budget_tokens: 12000  # Higher budget for thorough analysis
---

  You are the Code Reviewer.

## Review Protocol

Structure your review:

  <analysis>
1. Code structure: [ evaluate organization ]
2. Edge cases: [ evaluate coverage ]
3. Best practices: [ evaluate adherence ]
4. Performance: [ evaluate efficiency ]
5. Security: [ evaluate safety ]
  </analysis>

  <verdict>
  APPROVED | NEEDS_FIXES | MINOR_IMPROVEMENTS
  </verdict>

  <recommendations>
  [ list specific items if not approved ]
  </recommendations>

  [ rest of existing prompt... ]
```

---

### Phase 9: Conversation History Handling

**Important Note**: Anthropic automatically removes thinking blocks from conversation history.

This means:

- **We don't need to manually filter thinking blocks** from conversation context
- Thinking blocks won't accumulate in context window over multiple turns
- Only text and tool use blocks persist in conversation

**No code changes needed** - this is handled by the API automatically.

**Log it for debugging**: We should log thinking blocks when they occur, but they don't need to be sent back in
subsequent requests.

---

### Phase 10: OpenRouter Reasoning Support

**Goal**: Add support for OpenRouter's reasoning tokens feature, which works across multiple models (Anthropic Claude, OpenAI, Grok, Gemini, Qwen).

#### OpenRouter vs Anthropic Differences

| Aspect | Anthropic Direct | OpenRouter |
|--------|-----------------|------------|
| **Parameter** | `thinking: {type, budget_tokens}` | `reasoning: {effort, max_tokens, exclude}` |
| **Response Field** | `content[].thinking` | `reasoning_details` |
| **Billing** | Input tokens | Output tokens |
| **Models** | Claude only | Claude, OpenAI, Grok, Gemini, Qwen |

#### Step 10.1: Update OpenRouter Provider

**File**: `packages/core/src/providers/openrouter-provider.ts`

Add reasoning support similar to Anthropic thinking:

```typescript
constructor(
  modelName: string,
  logger?: AgentLogger,
  pricing?: ModelPricing,
  maxOutputTokens?: number,
  temperature?: number,
  topP?: number,
  thinking?: ThinkingConfig  // ← Add this (reuse same config)
) {
  // ... existing code
  this.thinking = thinking;
}
```

#### Step 10.2: Map Thinking Config to Reasoning

**File**: `packages/core/src/providers/openrouter-provider.ts`

In `complete()` method, map our universal config to OpenRouter's format:

```typescript
// Map our universal thinking config to OpenRouter's reasoning format
let reasoningConfig: any = undefined;

if (this.thinking) {
  const budget = this.thinking.budget_tokens || 10000;

  // OpenRouter uses "effort" levels, map budget to effort
  let effort: 'low' | 'medium' | 'high';
  if (budget < 5000) {
    effort = 'low';  // ~20% of max
  } else if (budget < 12000) {
    effort = 'medium';  // ~50% of max
  } else {
    effort = 'high';  // ~80% of max
  }

  reasoningConfig = {
    effort,
    max_tokens: budget,
    exclude: false,  // We want to see the reasoning
  };

  this.logger?.logSystemMessage(
    `🧠 Reasoning enabled: effort=${effort}, max_tokens=${budget}`
  );
}

// Add to request
const params = {
  model: this.modelName,
  max_tokens: this.maxOutputTokens,
  temperature: this.temperature,
  top_p: this.topP,
  messages: formattedMessages,
  tools: formattedTools,
  ...(reasoningConfig && { reasoning: reasoningConfig }),
};
```

#### Step 10.3: Extract Reasoning from Response

**File**: `packages/core/src/providers/openrouter-provider.ts`

Update response parsing to extract reasoning:

```typescript
private formatResponse(response: any): Message {
  // Extract reasoning if present
  const reasoning = response.choices?.[0]?.message?.reasoning_details;

  if (reasoning && this.logger) {
    let reasoningText = '';

    // Handle different reasoning types
    if (typeof reasoning === 'string') {
      reasoningText = reasoning;
    } else if (reasoning.text) {
      reasoningText = reasoning.text;
    } else if (reasoning.summary) {
      reasoningText = `[Summary] ${reasoning.summary}`;
    } else if (reasoning.encrypted) {
      reasoningText = '[ENCRYPTED REASONING - Content hidden for safety]';
    }

    if (reasoningText) {
      this.logger.logSystemMessage('🧠 Agent Reasoning:\n' + reasoningText);
    }
  }

  // Track reasoning tokens if available
  if (response.usage?.reasoning_tokens) {
    this.lastReasoningTokens = response.usage.reasoning_tokens;
  }

  // Extract regular content
  const content = response.choices?.[0]?.message?.content || '';

  // ... rest of response parsing
}
```

---

### Phase 11: Provider-Agnostic Mapping Layer

**Goal**: Create a universal interface that works across all providers, automatically mapping to provider-specific formats.

#### Design Pattern

```
Agent Config (Universal)          Provider-Specific API
─────────────────────           ─────────────────────────
thinking:                   →   Anthropic: thinking: {...}
  type: enabled                 OpenRouter: reasoning: {...}
  budget_tokens: 10000          OpenAI: auto-select o1 model
```

#### Step 11.1: Update Provider Factory

**File**: `packages/core/src/providers/provider-factory.ts`

Ensure all providers receive thinking config:

```typescript
export class ProviderFactory {
  static createProvider(
    modelString: string,
    agent: Agent,
    logger?: AgentLogger
  ): ILLMProvider {
    const { provider, modelName } = this.parseModelString(modelString);

    // Extract common parameters
    const thinking = agent.thinking;  // Universal config
    const temperature = agent.temperature;
    const topP = agent.top_p;

    switch (provider) {
      case 'anthropic':
        return new AnthropicProvider(
          modelName,
          logger,
          pricing,
          maxOutputTokens,
          temperature,
          topP,
          thinking  // ← Pass to Anthropic
        );

      case 'openrouter':
        return new OpenRouterProvider(
          modelName,
          logger,
          pricing,
          maxOutputTokens,
          temperature,
          topP,
          thinking  // ← Pass to OpenRouter
        );

      case 'openai':
        // For OpenAI, thinking config could trigger o1 model selection
        const finalModel = thinking ? this.selectReasoningModel(modelName) : modelName;
        return new OpenAIProvider(
          finalModel,
          logger,
          pricing,
          maxOutputTokens,
          // Note: o1 models don't support temperature/top_p
          thinking ? undefined : temperature,
          thinking ? undefined : topP
        );

      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  private static selectReasoningModel(requestedModel: string): string {
    // If thinking is enabled and user requested gpt-4, auto-upgrade to o1
    if (requestedModel.includes('gpt-4') || requestedModel.includes('gpt-5')) {
      return 'o1-preview';  // or 'o1', 'o3', etc.
    }
    return requestedModel;
  }
}
```

#### Step 11.2: Add Provider Capability Detection

**File**: `packages/core/src/providers/llm-provider.interface.ts`

Add method to check if provider supports thinking/reasoning:

```typescript
export interface ILLMProvider {
  // ... existing methods

  supportsThinking(): boolean;  // Does provider support reasoning/thinking?

  getThinkingCapabilities(): {
    supported: boolean;
    format: 'thinking' | 'reasoning' | 'automatic';
    minBudget: number;
    maxBudget: number;
  };
}
```

Implement in each provider:

```typescript
// AnthropicProvider
supportsThinking(): boolean {
  return this.modelName.includes('claude-3-7') ||
         this.modelName.includes('claude-4');
}

getThinkingCapabilities() {
  return {
    supported: this.supportsThinking(),
    format: 'thinking',
    minBudget: 1024,
    maxBudget: 100000,
  };
}

// OpenRouterProvider
supportsThinking(): boolean {
  // OpenRouter supports reasoning for many models
  return true;  // Let OpenRouter handle compatibility
}

getThinkingCapabilities() {
  return {
    supported: true,
    format: 'reasoning',
    minBudget: 1024,
    maxBudget: 32000,
  };
}

// OpenAIProvider
supportsThinking(): boolean {
  return this.modelName.includes('o1') ||
         this.modelName.includes('o3');
}

getThinkingCapabilities() {
  return {
    supported: this.supportsThinking(),
    format: 'automatic',  // Built-in, not controllable
    minBudget: 0,  // Automatic
    maxBudget: 0,  // Automatic
  };
}
```

#### Step 11.3: Unified Logging

**File**: `packages/core/src/providers/base-provider.ts` (if exists) or each provider

Ensure consistent logging across providers:

```typescript
protected logThinkingContent(content: string, format: 'thinking' | 'reasoning' | 'hidden') {
  if (!this.logger || !content) return;

  const icon = format === 'thinking' ? '🧠 Agent Thinking' :
               format === 'reasoning' ? '🧠 Agent Reasoning' :
               '🔒 Hidden Reasoning';

  this.logger.logSystemMessage(`${icon}:\n${content}`);
}

protected logThinkingTokens(tokens: number, format: string) {
  if (!this.logger || !tokens) return;

  const label = format === 'thinking' ? 'Thinking' :
                format === 'reasoning' ? 'Reasoning' :
                'Hidden Reasoning';

  this.logger.logSystemMessage(`📊 ${label} Tokens: ${tokens}`);
}
```

---

### Phase 12: Multi-Provider Documentation

**Goal**: Update documentation to clearly explain how thinking/reasoning works across different providers.

#### Step 12.1: Update User Documentation

**File**: `docs/anthropic-extended-thinking.md` → Rename to `docs/extended-thinking.md`

Update to be provider-agnostic:

```markdown
# Extended Thinking & Reasoning Guide

## What is Extended Thinking?

Extended thinking/reasoning is a capability that enables deeper, step-by-step reasoning
before generating responses. The implementation varies by provider:

### Provider Support

| Provider | Feature Name | Support Level | Visibility |
|----------|-------------|---------------|------------|
| **Anthropic** | Extended Thinking | Full | Visible thinking blocks |
| **OpenRouter** | Reasoning Tokens | Full | Visible reasoning (varies by model) |
| **OpenAI** | Reasoning Models | Automatic | Hidden (o1/o3 only) |
| **Others** | N/A | Not supported | - |

### Universal Configuration

The same configuration works across all providers:

```yaml
---
name: my-agent
thinking:
  type: enabled
  budget_tokens: 10000
---
```

**What happens:**
- **Anthropic**: Uses extended thinking API
- **OpenRouter**: Uses reasoning tokens API
- **OpenAI**: Auto-selects reasoning model (o1/o3)
- **Others**: Logs warning, continues without thinking

### Provider-Specific Details

#### Anthropic (Direct)

- **Models**: Claude Opus 4.x, Sonnet 3.7+, Sonnet 4.x
- **Thinking visible**: Yes, in response blocks
- **Billing**: Input tokens
- **Budget**: 1,024 - 100,000 tokens
- **Incompatible with**: temperature, top_p

#### OpenRouter

- **Models**: Multiple (Claude, OpenAI, Grok, Gemini, Qwen)
- **Reasoning visible**: Yes, varies by model
- **Billing**: Output tokens
- **Budget**: 1,024 - 32,000 tokens
- **Effort levels**: Mapped from budget (low/medium/high)

#### OpenAI (Direct)

- **Models**: o1, o3 series (automatic)
- **Reasoning visible**: No (hidden)
- **Billing**: Separate reasoning tokens
- **Budget**: Automatic (not controllable)
- **Incompatible with**: temperature, top_p
```

#### Step 12.2: Update Implementation Plan

Add multi-provider architecture diagram:

```
┌──────────────────────────────────────────┐
│  Agent Config (Universal)                │
│  thinking:                                │
│    type: enabled                          │
│    budget_tokens: 10000                   │
└──────────────────────────────────────────┘
                  ↓
┌──────────────────────────────────────────┐
│  Provider Factory (Maps to Specific)     │
└──────────────────────────────────────────┘
         ↓              ↓              ↓
┌────────────┐  ┌────────────┐  ┌────────────┐
│ Anthropic  │  │ OpenRouter │  │  OpenAI    │
│  thinking: │  │ reasoning: │  │ o1 model   │
│   {type,   │  │  {effort,  │  │ (auto)     │
│   budget}  │  │   max_tok} │  │            │
└────────────┘  └────────────┘  └────────────┘
```

---

## Testing Plan

### Phase 13: Multi-Provider Testing

**Test 1: Anthropic Direct**
```bash
# Set model to use Anthropic
export DEFAULT_MODEL="anthropic/claude-3-7-sonnet-20250219"
npx tsx coding-team/coding-team.ts
```

**Expected**: Thinking blocks visible in logs

**Test 2: OpenRouter + Claude**
```bash
# Use Claude via OpenRouter
export DEFAULT_MODEL="openrouter/anthropic/claude-3.7-sonnet"
npx tsx coding-team/coding-team.ts
```

**Expected**: Reasoning visible, same behavior as Anthropic direct

**Test 3: OpenRouter + OpenAI o1**
```bash
# Use OpenAI o1 via OpenRouter
export DEFAULT_MODEL="openrouter/openai/o1"
npx tsx coding-team/coding-team.ts
```

**Expected**: Reasoning tokens tracked, content may be hidden

**Test 4: Provider Without Support**
```bash
# Use provider/model without thinking support
export DEFAULT_MODEL="anthropic/claude-3-5-haiku-latest"
npx tsx coding-team/coding-team.ts
```

**Expected**: Warning logged, agent works without thinking

---

### Phase 8: Manual Testing

**Test 1: Orchestrator with Thinking**

```bash
cd packages/examples
npx tsx coding-team/coding-team.ts
```

**Expected**:

- Should see thinking logs: `🧠 Agent Thinking: ...`
- Should see thinking tokens in metrics
- Orchestrator should create better plans

**Test 2: Compare With/Without Thinking**

1. Run with thinking enabled (as above)
2. Temporarily remove thinking from orchestrator.md
3. Run again and compare quality of:
    - Task breakdown
    - Delegation strategy
    - Error handling

### Phase 9: Integration Tests

Create test file: `packages/core/tests/integration/extended-thinking.test.ts`

```typescript
describe('Extended Thinking', () => {
  it('should use extended thinking when configured', async () => {
    const agent: Agent = {
      name: 'test-thinker',
      prompt: 'You are a test agent',
      tools: [],
      thinking: {
        type: 'extended',
        budget_tokens: 5000,
      },
    };

    // Test that thinking is passed to API
    // Test that thinking tokens are tracked
    // Test that thinking content is logged
  });

  it('should work without thinking config', async () => {
    const agent: Agent = {
      name: 'test-normal',
      prompt: 'You are a test agent',
      tools: [],
      // No thinking config
    };

    // Test that everything still works
  });
});
```

---

## Documentation

### Phase 10: Feature Documentation

**File**: `docs/features/extended-thinking.md`

Create comprehensive documentation covering:

1. **What is extended thinking?**
    - Explanation of the feature
    - When to use it
    - When not to use it

2. **How to enable it**
    - Agent frontmatter examples
    - Configuration options
    - Budget recommendations

3. **Best practices**
    - Prompt patterns for thinking
    - Budget sizing guide
    - Performance considerations

4. **Examples**
    - Orchestrator example
    - Code review example
    - Planning example

5. **Troubleshooting**
    - Common issues
    - Debug tips
    - Performance tuning

### Phase 11: Update Main Docs

**File**: `README.md`

Add section on extended thinking:

```markdown
## Extended Thinking

Agents can use extended thinking for deeper reasoning:

```yaml
---
name: my-agent
thinking:
  type: extended
  budget_tokens: 10000
---
```

See [Extended Thinking Guide](docs/features/extended-thinking.md) for details.

```

---

## Rollout Strategy

### Stage 1: Core Implementation
1. ✅ Type definitions
2. ⚠️ Agent loader
3. ⏳ Provider updates
4. ⏳ Metrics tracking

### Stage 2: Testing & Validation
5. ⏳ Manual testing
6. ⏳ Integration tests
7. ⏳ Performance testing

### Stage 3: Agent Updates
8. ⏳ Update orchestrator
9. ⏳ Update implementer
10. ⏳ Update code-reviewer

### Stage 4: Documentation & Release
11. ⏳ Feature documentation
12. ⏳ Update README
13. ⏳ Create examples
14. ⏳ Announce feature

---

## Success Criteria

### Functional
- [ ] Agents can enable thinking via frontmatter
- [ ] Thinking is passed to Anthropic API correctly
- [ ] Thinking blocks are logged separately
- [ ] Thinking tokens are tracked in metrics
- [ ] Backward compatible (agents without thinking still work)

### Quality
- [ ] Orchestrator makes better plans with thinking
- [ ] Code reviewer provides more thorough analysis
- [ ] Implementer designs better before coding

### Performance
- [ ] Thinking overhead is acceptable (<2s added latency)
- [ ] Token budgets prevent runaway costs
- [ ] Metrics show thinking value (better outcomes)

---

## Future Enhancements

### V2: Advanced Features
1. **Dynamic budgets** - Adjust based on task complexity
2. **Thinking modes** - Different strategies for different agents
3. **Thinking cache** - Cache common reasoning patterns
4. **Thinking analysis** - Extract insights from thinking logs

### V3: Optimization
1. **Adaptive thinking** - Learn when thinking helps most
2. **Thinking compression** - Summarize thinking for context
3. **Parallel thinking** - Multiple reasoning paths
4. **Thinking validation** - Verify reasoning quality

---

## Risk Mitigation

### Cost Control
- **Budget limits**: Default 10k tokens, configurable
- **Monitoring**: Track thinking token usage
- **Alerts**: Warn if costs spike

### Performance
- **Timeout handling**: Thinking has same timeout as response
- **Fallback**: Disable thinking if API errors
- **Testing**: Benchmark with/without thinking

### Quality
- **Validation**: Ensure thinking improves outcomes
- **A/B testing**: Compare agent performance
- **Feedback loop**: Adjust based on results

---

## Timeline Estimate

**Total: ~4-6 hours for core implementation**

- Phase 1-2 (Types & Loader): ✅ 30 min (DONE)
- Phase 3-4 (Provider): ⏳ 1 hour
- Phase 5-6 (Metrics & Factory): ⏳ 45 min
- Phase 7 (Agent Updates): ⏳ 30 min (3 agents × 10 min)
- Phase 8-9 (Testing): ⏳ 1 hour
- Phase 10-11 (Documentation): ⏳ 1 hour
- Buffer: ⏳ 30 min

---

## References

- [Anthropic Extended Thinking Documentation](https://docs.claude.com/en/docs/build-with-claude/extended-thinking)
- [Extended Thinking with Tool Use Cookbook](https://github.com/anthropics/claude-cookbooks/blob/main/extended_thinking/extended_thinking_with_tool_use.ipynb)
- [Extended Thinking Basic Cookbook](https://github.com/anthropics/claude-cookbooks/blob/main/extended_thinking/extended_thinking.ipynb)
- [Anthropic Extended Thinking Blog](https://www.anthropic.com/engineering/claude-think-tool)
- [Chain-of-Thought Prompting Guide](https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/chain-of-thought)
- [OpenRouter Reasoning Tokens Documentation](https://openrouter.ai/docs/use-cases/reasoning-tokens)
- [Extended Thinking User Guide](./extended-thinking.md) (this repository)

---

## Key Implementation Corrections

After reviewing official Anthropic documentation and examples, the following corrections were made to the plan:

1. **✅ Thinking Type**: Changed from `'enabled' | 'extended'` to just `'enabled'`
   - Only one type is supported

2. **✅ Budget Defaults**: Updated from 2048 to 10000 tokens
   - Minimum: 1024 tokens
   - Recommended for complex tasks: 16000+ tokens

3. **✅ Temperature/Top_P Handling**: Must be excluded when thinking is enabled
   - API doesn't accept these parameters with thinking
   - Implementation validates and warns users

4. **✅ Model Requirements**: Clarified supported models
   - Claude Opus 4.x (summarized thinking)
   - Claude Sonnet 4.x including 3.7 (full thinking)

5. **✅ Redacted Thinking**: Added handling for `redacted_thinking` block type
   - Some thinking may be encrypted for safety
   - Must handle both `thinking` and `redacted_thinking` types

6. **✅ Budget Validation**: Must be less than `max_tokens`
   - Added validation to prevent invalid configurations

7. **✅ Conversation History**: Documented that Anthropic auto-removes thinking blocks
   - No manual filtering needed in our implementation
   - Simplifies context management

8. **✅ Pricing Information**: Added token cost details
   - Claude Opus: $15/M input tokens
   - Claude Sonnet: $3/M input tokens

---

## Status

**Current Phase**: Phase 2 (Agent Loader - Partial)

**Plan Status**: ✅ Fully reviewed and corrected against official docs

**Next Action**: Complete provider updates (Phase 3-6)

**Blockers**: None

**Last Updated**: 2025-10-15 (Updated with official Anthropic documentation)
