# Extended Thinking Implementation Plan ("ultrathink") - v2

## Overview

Add extended thinking capability to the agent system, allowing agents to engage in deep reasoning before generating responses. This implementation supports multiple providers (Anthropic, OpenRouter, OpenAI) with a unified configuration interface.

## Background

### What is Extended Thinking?

Extended thinking is a pre-response reasoning mechanism where LLMs deeply consider and plan their approach **before** starting to generate a response or make tool calls.

**Key Differences:**
- **Extended Thinking (API)**: Happens before response generation, genuine deep reasoning
- **Chain-of-Thought (Prompt)**: Happens during response, "showing work" as text output

### Provider Landscape

| Provider | API Feature | Response Format | Billing Model | Visibility |
|----------|------------|-----------------|---------------|------------|
| **Anthropic** | `thinking` parameter | `content[].thinking` | Input tokens | Full thinking visible |
| **OpenRouter** | `reasoning` parameter | `reasoning_details` | Output tokens | Varies by model |
| **OpenAI** | Automatic (o1/o3) | Hidden | Reasoning tokens | Not exposed |

### Critical Design Principles

1. **Provider Independence**: Providers self-configure, factory stays simple
2. **Fail Gracefully**: If thinking fails, still return response
3. **Validate Early**: Catch config errors at build time, not runtime
4. **Normalize Immediately**: Convert provider responses to common format
5. **Track Everything**: Costs, tokens, context usage
6. **Middleware Integration**: Use existing pipeline, don't bypass it

## Architecture

### Improved Architecture with Middleware

```
┌─────────────────────────────────────────┐
│  Agent Configuration (YAML)              │
│  thinking:                               │
│    type: enabled                         │
│    budget_tokens: 10000                  │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  Middleware Pipeline                     │
├─────────────────────────────────────────┤
│  1. ErrorHandler (existing)              │
│  2. AgentLoader (existing)               │
│  3. ThinkingMiddleware (NEW)             │
│     - Validates configuration            │
│     - Normalizes config                  │
│     - Checks budget limits               │
│  4. ContextSetup (existing)              │
│  5. ProviderSelection (existing)         │
│  6. SafetyChecks (enhanced)              │
│     - Tracks context window usage        │
│  7. LLMCall (enhanced)                   │
│     - Applies thinking config            │
│  8. ToolExecution (existing)             │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  Provider Layer (Self-Configuring)       │
├──────────┬──────────┬───────────────────┤
│Anthropic │OpenRouter│    OpenAI         │
│thinking→ │reasoning→│  auto(o1/o3)      │
└──────────┴──────────┴───────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  Response Normalization                  │
│  - Unified thinking format               │
│  - Consistent metrics                    │
│  - Cost tracking                         │
└─────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Core Type Definitions and Interfaces

**File**: `packages/core/src/config/types.ts`

```typescript
// User-facing configuration (from YAML)
export interface ThinkingConfig {
  /** Thinking mode - only 'enabled' is supported */
  type: 'enabled';
  /** Token budget for thinking (minimum: 1024) */
  budget_tokens?: number;
}

// Internal normalized configuration
export interface NormalizedThinkingConfig {
  enabled: boolean;
  budgetTokens: number;
  maxCostUSD?: number;
  contextWindowPercentage?: number; // Max % of context to use for thinking
}

// Response normalization
export interface NormalizedThinkingResponse {
  content: string;
  tokens: number;
  visibility: 'full' | 'summary' | 'hidden';
  cost: number;
  provider: string;
}

// Add to Agent interface
export interface Agent {
  // ... existing fields
  thinking?: ThinkingConfig;
}

// Add to ExecutionContext
export interface ExecutionContext {
  agent: Agent;
  messages: Message[];
  tools?: Tool[];
  thinkingConfig?: NormalizedThinkingConfig;
  thinkingBudgetRemaining?: number;
  thinkingMetrics?: {
    totalTokensUsed: number;
    totalCost: number;
    contextUsagePercent: number;
  };
  // ... other fields
}
```

---

### Phase 2: Thinking Middleware

**File**: `packages/core/src/middleware/thinking-middleware.ts`

```typescript
import { Middleware, MiddlewareNext, ExecutionContext } from '../types';
import { NormalizedThinkingConfig } from '../config/types';

export class ThinkingMiddleware implements Middleware {
  private globalBudgetLimit = 50000; // Max tokens across all thinking
  private globalCostLimit = 5.00; // Max $5 per session

  async process(context: ExecutionContext, next: MiddlewareNext): Promise<any> {
    // Skip if no thinking config
    if (!context.agent.thinking) {
      return next(context);
    }

    try {
      // Step 1: Validate configuration at build time
      this.validateConfiguration(context.agent);

      // Step 2: Normalize configuration
      context.thinkingConfig = this.normalizeConfig(context.agent.thinking);

      // Step 3: Check global limits
      if (!this.checkGlobalLimits(context)) {
        context.logger?.warn('Global thinking limits exceeded, disabling thinking');
        context.thinkingConfig = undefined;
        return next(context);
      }

      // Step 4: Check context window usage
      if (!this.checkContextWindow(context)) {
        context.logger?.warn('Thinking would exceed context window, reducing budget');
        this.adjustBudget(context);
      }

      // Continue with thinking enabled
      return next(context);

    } catch (error) {
      // Log validation errors but continue without thinking
      context.logger?.error('Thinking configuration error:', error);
      context.thinkingConfig = undefined;
      return next(context);
    }
  }

  private validateConfiguration(agent: Agent): void {
    if (!agent.thinking) return;

    // Check incompatible features
    if (agent.thinking && agent.temperature !== undefined) {
      throw new Error(
        `Agent "${agent.name}": thinking is incompatible with temperature setting`
      );
    }

    if (agent.thinking && agent.top_p !== undefined) {
      throw new Error(
        `Agent "${agent.name}": thinking is incompatible with top_p setting`
      );
    }

    // Validate budget
    const budget = agent.thinking.budget_tokens || 10000;
    if (budget < 1024) {
      throw new Error(
        `Agent "${agent.name}": thinking budget must be at least 1024 tokens`
      );
    }

    if (budget > 100000) {
      throw new Error(
        `Agent "${agent.name}": thinking budget exceeds maximum of 100000 tokens`
      );
    }
  }

  private normalizeConfig(config: ThinkingConfig): NormalizedThinkingConfig {
    return {
      enabled: config.type === 'enabled',
      budgetTokens: config.budget_tokens || 10000,
      maxCostUSD: 0.50, // Default max cost per thinking operation
      contextWindowPercentage: 0.25, // Use max 25% of context for thinking
    };
  }

  private checkGlobalLimits(context: ExecutionContext): boolean {
    const metrics = context.thinkingMetrics || {
      totalTokensUsed: 0,
      totalCost: 0,
      contextUsagePercent: 0,
    };

    // Check token limit
    if (metrics.totalTokensUsed >= this.globalBudgetLimit) {
      return false;
    }

    // Check cost limit
    if (metrics.totalCost >= this.globalCostLimit) {
      return false;
    }

    return true;
  }

  private checkContextWindow(context: ExecutionContext): boolean {
    // Estimate current context usage
    const messageTokens = this.estimateMessageTokens(context.messages);
    const thinkingBudget = context.thinkingConfig?.budgetTokens || 0;
    const totalTokens = messageTokens + thinkingBudget;

    // Assume 128k context window (configurable)
    const contextLimit = 128000;

    return totalTokens < contextLimit * 0.9; // Leave 10% buffer
  }

  private adjustBudget(context: ExecutionContext): void {
    if (!context.thinkingConfig) return;

    // Reduce budget to fit within context window
    const messageTokens = this.estimateMessageTokens(context.messages);
    const contextLimit = 128000;
    const availableTokens = Math.floor((contextLimit * 0.9) - messageTokens);

    context.thinkingConfig.budgetTokens = Math.min(
      context.thinkingConfig.budgetTokens,
      availableTokens
    );
  }

  private estimateMessageTokens(messages: Message[]): number {
    // Simple estimation: 4 chars = 1 token
    return messages.reduce((sum, msg) => {
      return sum + Math.ceil(msg.content.length / 4);
    }, 0);
  }
}
```

---

### Phase 3: Agent Loader Updates

**File**: `packages/core/src/agents/loader.ts`

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

### Phase 4: Base Provider Class

**File**: `packages/core/src/providers/base-provider.ts`

Create an abstract base class that all providers extend:

```typescript
import { ILLMProvider, Message, ToolCall } from './llm-provider.interface';
import { NormalizedThinkingConfig, NormalizedThinkingResponse } from '../config/types';
import { ExecutionContext } from '../types';

export abstract class BaseProvider implements ILLMProvider {
  protected thinkingConfig?: NormalizedThinkingConfig;

  // Abstract methods each provider must implement
  protected abstract supportsThinking(): boolean;
  protected abstract getModelCapabilities(): ModelCapabilities;
  protected abstract transformThinking(config: NormalizedThinkingConfig): any;
  protected abstract extractThinking(response: any): NormalizedThinkingResponse | undefined;
  protected abstract makeApiCall(params: any): Promise<any>;

  async complete(context: ExecutionContext): Promise<Message> {
    try {
      // Build base parameters
      const params = this.buildBaseParams(context);

      // Add thinking if supported
      if (context.thinkingConfig && this.supportsThinking()) {
        const thinkingParams = this.transformThinking(context.thinkingConfig);
        Object.assign(params, thinkingParams);
      } else if (context.thinkingConfig && !this.supportsThinking()) {
        context.logger?.warn(
          `Model ${this.modelName} does not support thinking, continuing without it`
        );
      }

      // Make API call
      const response = await this.makeApiCall(params);

      // Extract and normalize thinking
      const thinking = this.extractThinking(response);
      if (thinking) {
        this.logThinking(thinking, context);
        this.updateMetrics(thinking, context);
      }

      // Parse regular response
      return this.parseResponse(response);

    } catch (error) {
      // Graceful degradation: retry without thinking if it was a thinking error
      if (this.isThinkingError(error) && context.thinkingConfig) {
        context.logger?.warn('Thinking failed, retrying without thinking');
        const originalConfig = context.thinkingConfig;
        context.thinkingConfig = undefined;

        try {
          const result = await this.complete(context);
          context.thinkingConfig = originalConfig; // Restore for next call
          return result;
        } catch (retryError) {
          context.thinkingConfig = originalConfig;
          throw retryError;
        }
      }

      throw error;
    }
  }

  protected logThinking(thinking: NormalizedThinkingResponse, context: ExecutionContext): void {
    const icon = thinking.visibility === 'hidden' ? '🔒' : '🧠';
    const label = thinking.visibility === 'hidden' ? 'Hidden Reasoning' : 'Agent Thinking';

    if (thinking.content && thinking.visibility !== 'hidden') {
      context.logger?.logSystemMessage(`${icon} ${label}:\n${thinking.content}`);
    }

    context.logger?.logSystemMessage(
      `📊 Thinking Metrics: ${thinking.tokens} tokens, $${thinking.cost.toFixed(4)}`
    );
  }

  protected updateMetrics(thinking: NormalizedThinkingResponse, context: ExecutionContext): void {
    if (!context.thinkingMetrics) {
      context.thinkingMetrics = {
        totalTokensUsed: 0,
        totalCost: 0,
        contextUsagePercent: 0,
      };
    }

    context.thinkingMetrics.totalTokensUsed += thinking.tokens;
    context.thinkingMetrics.totalCost += thinking.cost;

    // Update context usage
    const contextLimit = this.getModelCapabilities().contextWindow;
    const usedTokens = this.estimateContextUsage(context) + thinking.tokens;
    context.thinkingMetrics.contextUsagePercent = (usedTokens / contextLimit) * 100;
  }

  protected isThinkingError(error: any): boolean {
    // Check for thinking-specific error patterns
    const errorMessage = error.message?.toLowerCase() || '';
    return errorMessage.includes('thinking') ||
           errorMessage.includes('reasoning') ||
           errorMessage.includes('budget');
  }

  protected abstract buildBaseParams(context: ExecutionContext): any;
  protected abstract parseResponse(response: any): Message;
  protected abstract estimateContextUsage(context: ExecutionContext): number;
}
```

---

### Phase 5: Anthropic Provider Implementation

**File**: `packages/core/src/providers/anthropic-provider.ts`

Extend the base provider with Anthropic-specific implementation:

```typescript
import { BaseProvider } from './base-provider';
import { NormalizedThinkingConfig, NormalizedThinkingResponse } from '../config/types';
import Anthropic from '@anthropic-ai/sdk';

export class AnthropicProvider extends BaseProvider {
  private client: Anthropic;

  constructor(
    private modelName: string,
    private logger?: AgentLogger,
    private pricing?: ModelPricing,
    private maxOutputTokens?: number
  ) {
    super();
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  protected supportsThinking(): boolean {
    // Check model compatibility
    return this.modelName.includes('claude-3-7-sonnet') ||
           this.modelName.includes('claude-3-opus') ||
           this.modelName.includes('claude-4');
  }

  protected getModelCapabilities(): ModelCapabilities {
    return {
      contextWindow: 200000, // 200k for Claude 3
      supportsTools: true,
      supportsThinking: this.supportsThinking(),
      thinkingFormat: 'thinking',
      minThinkingBudget: 1024,
      maxThinkingBudget: 100000,
    };
  }

  protected transformThinking(config: NormalizedThinkingConfig): any {
    // Anthropic format
    return {
      thinking: {
        type: 'enabled',
        budget_tokens: config.budgetTokens,
      },
    };
  }

  protected extractThinking(response: any): NormalizedThinkingResponse | undefined {
    // Find thinking blocks in response
    const thinkingBlocks = response.content.filter(
      (c: any) => c.type === 'thinking' || c.type === 'redacted_thinking'
    );

    if (thinkingBlocks.length === 0) return undefined;

    let content = '';
    let hasRedacted = false;

    for (const block of thinkingBlocks) {
      if (block.type === 'thinking') {
        content += block.thinking + '\n\n';
      } else if (block.type === 'redacted_thinking') {
        hasRedacted = true;
        content += '[REDACTED - Content encrypted for safety]\n\n';
      }
    }

    const tokens = response.usage?.thinking_tokens || 0;
    const cost = this.calculateCost(tokens, 'input'); // Thinking billed as input

    return {
      content: content.trim(),
      tokens,
      visibility: hasRedacted ? 'summary' : 'full',
      cost,
      provider: 'anthropic',
    };
  }

  protected async makeApiCall(params: any): Promise<any> {
    // Add beta header for thinking
    const headers: any = {
      'anthropic-beta': 'prompt-caching-2024-07-31',
    };

    if (params.thinking) {
      headers['anthropic-beta'] += ',extended-thinking-2024-12-12';
    }

    return await this.client.messages.create(params, { headers });
  }

  protected buildBaseParams(context: ExecutionContext): any {
    return {
      model: this.modelName,
      max_tokens: this.maxOutputTokens,
      system: context.systemPrompt,
      messages: this.formatMessages(context.messages),
      tools: this.formatTools(context.tools),
      // Temperature/top_p handled by middleware validation
    };
  }

  protected parseResponse(response: any): Message {
    // Extract text content (excluding thinking)
    const textContent = response.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('');

    // Extract tool calls
    const toolCalls = response.content
      .filter((c: any) => c.type === 'tool_use')
      .map((c: any) => ({
        id: c.id,
        type: 'function',
        function: {
          name: c.name,
          arguments: JSON.stringify(c.input),
        },
      }));

    return {
      role: 'assistant',
      content: textContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  private calculateCost(tokens: number, type: 'input' | 'output'): number {
    const pricing = this.pricing || {
      inputTokens: 3.00, // $3 per million for Sonnet
      outputTokens: 15.00, // $15 per million
    };

    const rate = type === 'input' ? pricing.inputTokens : pricing.outputTokens;
    return (tokens / 1_000_000) * rate;
  }
}
```

---

### Phase 6: OpenRouter Provider Implementation

**File**: `packages/core/src/providers/openrouter-provider.ts`

```typescript
import { BaseProvider } from './base-provider';
import { NormalizedThinkingConfig, NormalizedThinkingResponse } from '../config/types';

export class OpenRouterProvider extends BaseProvider {
  constructor(
    private modelName: string,
    private logger?: AgentLogger,
    private pricing?: ModelPricing,
    private maxOutputTokens?: number
  ) {
    super();
  }

  protected supportsThinking(): boolean {
    // OpenRouter supports reasoning for many models
    // Let OpenRouter determine compatibility
    return true;
  }

  protected getModelCapabilities(): ModelCapabilities {
    // Model-specific capabilities would be fetched from OpenRouter
    // This is a reasonable default
    return {
      contextWindow: 128000,
      supportsTools: true,
      supportsThinking: true,
      thinkingFormat: 'reasoning',
      minThinkingBudget: 1024,
      maxThinkingBudget: 32000,
    };
  }

  protected transformThinking(config: NormalizedThinkingConfig): any {
    // Map to OpenRouter's reasoning format with full precision
    const budget = config.budgetTokens;

    // Calculate effort level as a hint, but still pass max_tokens
    let effort: 'low' | 'medium' | 'high';
    if (budget < 5000) {
      effort = 'low';
    } else if (budget < 12000) {
      effort = 'medium';
    } else {
      effort = 'high';
    }

    return {
      reasoning: {
        effort,
        max_tokens: budget,  // Preserve exact budget
        exclude: false,      // We want to see the reasoning
      },
    };
  }

  protected extractThinking(response: any): NormalizedThinkingResponse | undefined {
    const reasoning = response.choices?.[0]?.message?.reasoning_details;

    if (!reasoning) return undefined;

    let content = '';
    let visibility: 'full' | 'summary' | 'hidden' = 'full';

    // Handle different reasoning response formats
    if (typeof reasoning === 'string') {
      content = reasoning;
    } else if (reasoning.text) {
      content = reasoning.text;
    } else if (reasoning.summary) {
      content = `[Summary] ${reasoning.summary}`;
      visibility = 'summary';
    } else if (reasoning.encrypted || reasoning.hidden) {
      content = '[Reasoning hidden by model]';
      visibility = 'hidden';
    }

    const tokens = response.usage?.reasoning_tokens || 0;
    const cost = this.calculateCost(tokens, 'output'); // Reasoning billed as output

    return {
      content: content.trim(),
      tokens,
      visibility,
      cost,
      provider: 'openrouter',
    };
  }

  protected async makeApiCall(params: any): Promise<any> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.OPENROUTER_REFERER || 'http://localhost',
        'X-Title': process.env.OPENROUTER_TITLE || 'Agent Orchestration System',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    return await response.json();
  }

  protected buildBaseParams(context: ExecutionContext): any {
    return {
      model: this.modelName,
      max_tokens: this.maxOutputTokens,
      messages: this.formatMessages(context.messages),
      tools: this.formatTools(context.tools),
      // OpenRouter handles temperature/top_p differently per model
      temperature: context.agent.temperature,
      top_p: context.agent.top_p,
    };
  }

  private calculateCost(tokens: number, type: 'input' | 'output'): number {
    // OpenRouter pricing varies by model
    // This would ideally be fetched from their API
    const defaultPricing = {
      inputTokens: 5.00,   // $5 per million (average)
      outputTokens: 15.00, // $15 per million (average)
    };

    const pricing = this.pricing || defaultPricing;
    const rate = type === 'input' ? pricing.inputTokens : pricing.outputTokens;
    return (tokens / 1_000_000) * rate;
  }
}
```

---

### Phase 7: Simplified Provider Factory

**File**: `packages/core/src/providers/provider-factory.ts`

The factory stays simple - providers self-configure:

```typescript
export class ProviderFactory {
  static createProvider(
    modelString: string,
    context: ExecutionContext
  ): ILLMProvider {
    const { provider, modelName } = this.parseModelString(modelString);

    // Factory just creates instances, providers handle their own config
    switch (provider) {
      case 'anthropic':
        return new AnthropicProvider(
          modelName,
          context.logger,
          this.getPricing(modelName),
          context.agent.maxOutputTokens
        );

      case 'openrouter':
        return new OpenRouterProvider(
          modelName,
          context.logger,
          this.getPricing(modelName),
          context.agent.maxOutputTokens
        );

      case 'openai':
        return new OpenAIProvider(
          modelName,
          context.logger,
          this.getPricing(modelName),
          context.agent.maxOutputTokens
        );

      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  private static parseModelString(modelString: string): {
    provider: string;
    modelName: string;
  } {
    const parts = modelString.split('/');
    if (parts.length < 2) {
      throw new Error(`Invalid model string: ${modelString}`);
    }

    return {
      provider: parts[0],
      modelName: parts.slice(1).join('/'),
    };
  }
}
```

---

### Phase 8: Agent Configuration Updates

Update agent configurations to use extended thinking:

#### Orchestrator Agent
**File**: `packages/examples/coding-team/agents/orchestrator.md`

```yaml
---
name: orchestrator
tools: ["list", "todowrite", "delegate"]
behavior: balanced
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
```

#### Implementer Agent
**File**: `packages/examples/coding-team/agents/implementer.md`

```yaml
---
name: implementer
tools: ['read', 'write', 'list', 'shell']
behavior: precise
thinking:
  type: enabled
  budget_tokens: 10000  # Standard budget for code design
---

You are the Implementer - a senior software engineer.

## Design Phase

Before writing code:

<design>
1. File location: [where will this code live?]
2. Function signature: [what's the interface?]
3. Implementation approach: [how will it work?]
4. Edge cases: [what needs handling?]
5. Dependencies: [what does it depend on?]
</design>

Then implement the code.
```

#### Code Reviewer Agent
**File**: `packages/examples/coding-team/agents/code-reviewer.md`

```yaml
---
name: code-reviewer
tools: ["read", "list"]
behavior: precise
thinking:
  type: enabled
  budget_tokens: 12000  # Higher budget for thorough analysis
---

You are the Code Reviewer.

## Review Protocol

Structure your review:

<analysis>
1. Code structure: [evaluate organization]
2. Edge cases: [evaluate coverage]
3. Best practices: [evaluate adherence]
4. Performance: [evaluate efficiency]
5. Security: [evaluate safety]
</analysis>

<verdict>
APPROVED | NEEDS_FIXES | MINOR_IMPROVEMENTS
</verdict>

<recommendations>
[list specific items if not approved]
</recommendations>
```

---

### Phase 9: Integration with Middleware Pipeline

**File**: `packages/core/src/middleware/system-builder.ts`

Add ThinkingMiddleware to the pipeline:

```typescript
export class AgentSystemBuilder {
  // ... existing code

  buildMiddlewarePipeline(): Middleware[] {
    const pipeline: Middleware[] = [];

    // Error handling (outermost)
    pipeline.push(new ErrorHandlerMiddleware(this.config));

    // Agent loading
    pipeline.push(new AgentLoaderMiddleware(this.agentLoader));

    // NEW: Thinking validation and configuration
    pipeline.push(new ThinkingMiddleware(this.config));

    // Context setup
    pipeline.push(new ContextSetupMiddleware());

    // Provider selection
    pipeline.push(new ProviderSelectionMiddleware(this.providerFactory));

    // Safety checks (enhanced to check context usage)
    pipeline.push(new SafetyChecksMiddleware(this.config.safety));

    // LLM call (uses thinking config from context)
    pipeline.push(new LLMCallMiddleware());

    // Tool execution
    pipeline.push(new ToolExecutionMiddleware(this.toolRegistry));

    return pipeline;
  }
}
```

---

## Testing Strategy

### Phase 10: Unit Testing

**File**: `packages/core/tests/unit/thinking-middleware.test.ts`

```typescript
describe('ThinkingMiddleware', () => {
  it('should validate thinking configuration', () => {
    const agent = {
      name: 'test',
      thinking: { type: 'enabled', budget_tokens: 1024 },
      temperature: 0.5, // Incompatible!
    };

    const middleware = new ThinkingMiddleware();
    expect(() => middleware.validateConfiguration(agent))
      .toThrow('thinking is incompatible with temperature');
  });

  it('should normalize configuration correctly', () => {
    const config = { type: 'enabled', budget_tokens: 5000 };
    const normalized = middleware.normalizeConfig(config);

    expect(normalized).toEqual({
      enabled: true,
      budgetTokens: 5000,
      maxCostUSD: 0.50,
      contextWindowPercentage: 0.25,
    });
  });

  it('should check global limits', () => {
    const context = {
      thinkingMetrics: {
        totalTokensUsed: 45000,
        totalCost: 4.50,
        contextUsagePercent: 85,
      },
    };

    expect(middleware.checkGlobalLimits(context)).toBe(true);

    context.thinkingMetrics.totalTokensUsed = 55000;
    expect(middleware.checkGlobalLimits(context)).toBe(false);
  });
});
```

### Phase 11: Provider Testing

**File**: `packages/core/tests/unit/providers/base-provider.test.ts`

```typescript
describe('BaseProvider', () => {
  class TestProvider extends BaseProvider {
    // Implement abstract methods for testing
    protected supportsThinking() { return true; }
    protected transformThinking(config) { return { test: config }; }
    protected extractThinking(response) { return undefined; }
    // ... other abstract methods
  }

  it('should handle graceful degradation', async () => {
    const provider = new TestProvider();
    const context = {
      thinkingConfig: { enabled: true, budgetTokens: 10000 },
      messages: [],
    };

    // Mock API call to fail with thinking error
    provider.makeApiCall = jest.fn()
      .mockRejectedValueOnce(new Error('Thinking budget exceeded'))
      .mockResolvedValueOnce({ content: 'Response without thinking' });

    const result = await provider.complete(context);

    expect(result.content).toBe('Response without thinking');
    expect(provider.makeApiCall).toHaveBeenCalledTimes(2);
  });

  it('should update metrics correctly', () => {
    const provider = new TestProvider();
    const thinking = {
      content: 'Test thinking',
      tokens: 1500,
      visibility: 'full',
      cost: 0.0045,
      provider: 'test',
    };

    const context = { thinkingMetrics: undefined };
    provider.updateMetrics(thinking, context);

    expect(context.thinkingMetrics).toEqual({
      totalTokensUsed: 1500,
      totalCost: 0.0045,
      contextUsagePercent: expect.any(Number),
    });
  });
});
```

---

### Phase 12: Integration Testing

**File**: `packages/core/tests/integration/thinking.test.ts`

```typescript
describe('Extended Thinking Integration', () => {
  it('should work with Anthropic provider', async () => {
    const system = AgentSystemBuilder.default()
      .withModel('anthropic/claude-3-7-sonnet')
      .build();

    const agent = {
      name: 'test-agent',
      prompt: 'You are a test agent',
      tools: [],
      thinking: { type: 'enabled', budget_tokens: 5000 },
    };

    const result = await system.execute(agent, 'Solve 15 * 17');

    // Check logs for thinking output
    expect(mockLogger.logs).toContain('🧠 Agent Thinking:');
    expect(mockLogger.metrics.thinkingTokens).toBeGreaterThan(0);
  });

  it('should work with OpenRouter provider', async () => {
    const system = AgentSystemBuilder.default()
      .withModel('openrouter/anthropic/claude-3.7-sonnet')
      .build();

    const agent = {
      name: 'test-agent',
      prompt: 'You are a test agent',
      tools: [],
      thinking: { type: 'enabled', budget_tokens: 5000 },
    };

    const result = await system.execute(agent, 'Solve 15 * 17');

    // Check logs for reasoning output
    expect(mockLogger.logs).toContain('🧠 Agent Reasoning:');
    expect(mockLogger.metrics.reasoningTokens).toBeGreaterThan(0);
  });

  it('should degrade gracefully when thinking fails', async () => {
    // Configure to fail thinking but succeed without
    const system = AgentSystemBuilder.default()
      .withModel('anthropic/claude-3-7-sonnet')
      .build();

    const agent = {
      name: 'test-agent',
      prompt: 'You are a test agent',
      tools: [],
      thinking: { type: 'enabled', budget_tokens: 200000 }, // Too large
    };

    const result = await system.execute(agent, 'Hello');

    // Should still get a response
    expect(result).toBeDefined();
    expect(mockLogger.warnings).toContain('Thinking failed, retrying without');
  });
});
```

---

### Phase 13: Multi-Provider Manual Testing

**Test 1: Anthropic Direct**
```bash
# Set model to use Anthropic
export DEFAULT_MODEL="anthropic/claude-3-7-sonnet-20250219"
cd packages/examples
npx tsx coding-team/coding-team.ts
```

**Expected**:
- `🧠 Agent Thinking:` logs with full thinking content
- Thinking tokens tracked in metrics
- Better planning and coordination

**Test 2: OpenRouter + Claude**
```bash
# Use Claude via OpenRouter
export DEFAULT_MODEL="openrouter/anthropic/claude-3.7-sonnet"
cd packages/examples
npx tsx coding-team/coding-team.ts
```

**Expected**:
- `🧠 Agent Reasoning:` logs (may vary by model)
- Reasoning tokens tracked
- Similar quality to direct Anthropic

**Test 3: Provider Without Support**
```bash
# Use model without thinking support
export DEFAULT_MODEL="anthropic/claude-3-5-haiku-latest"
cd packages/examples
npx tsx coding-team/coding-team.ts
```

**Expected**:
- Warning: `Model claude-3-5-haiku does not support thinking, continuing without it`
- Agent still works normally
- No thinking logs or metrics

---

## Documentation

The user-facing documentation has been completed:

- **User Guide**: `docs/extended-thinking.md` - Comprehensive guide covering all providers
- **Implementation Plan**: This document - Technical implementation details

### Additional Documentation Needed

**File**: `README.md`

Add section on extended thinking:

```markdown
## Extended Thinking

Agents can use extended thinking for deeper reasoning across multiple providers:

```yaml
---
name: my-agent
thinking:
  type: enabled
  budget_tokens: 10000
---
```

This works with Anthropic, OpenRouter, and OpenAI providers. See [Extended Thinking Guide](docs/extended-thinking.md) for details.
```

---

## Implementation Order

### Stage 1: Core Infrastructure (2-3 hours)
1. ✅ Type definitions and interfaces
2. ✅ ThinkingMiddleware implementation
3. ⏳ Base provider class
4. ⏳ Integration with middleware pipeline

### Stage 2: Provider Implementations (2-3 hours)
5. ⏳ Anthropic provider (extends BaseProvider)
6. ⏳ OpenRouter provider (extends BaseProvider)
7. ⏳ OpenAI provider (optional, for o1/o3)
8. ⏳ Provider factory updates

### Stage 3: Testing & Validation (1-2 hours)
9. ⏳ Unit tests for middleware
10. ⏳ Unit tests for providers
11. ⏳ Integration tests
12. ⏳ Manual testing with examples

### Stage 4: Agent Configuration (30 min)
13. ✅ Update orchestrator agent
14. ✅ Update implementer agent
15. ✅ Update code-reviewer agent

### Stage 5: Documentation (Completed)
16. ✅ Implementation plan (this document)
17. ✅ User guide (extended-thinking.md)
18. ⏳ Update main README

---

## Success Criteria

### Functional Requirements
- ✅ Universal configuration works across all providers
- ✅ Graceful degradation when thinking fails
- ✅ Early validation catches config errors
- ✅ Response normalization provides consistent interface
- ✅ Cost tracking prevents runaway expenses

### Architectural Requirements
- ✅ Providers self-configure (factory stays simple)
- ✅ Middleware integration (not bypassing pipeline)
- ✅ Base provider class eliminates duplication
- ✅ Context window management prevents overflow
- ✅ Metrics aggregation tracks usage

### Quality Metrics
- [ ] Orchestrator shows improved planning with thinking
- [ ] Code reviewer provides deeper analysis
- [ ] Implementer produces better designs
- [ ] Error rate decreases with thinking enabled
- [ ] Token usage stays within budget limits

---

## Key Architectural Improvements (v2)

This updated plan includes critical architectural improvements over the original design:

### 1. **Middleware Integration**
- Added `ThinkingMiddleware` to the existing pipeline
- Early validation at configuration time, not runtime
- Global budget and cost control mechanisms

### 2. **Base Provider Class**
- Eliminates code duplication across providers
- Implements graceful degradation pattern
- Unified logging and metrics tracking

### 3. **Response Normalization**
- `NormalizedThinkingResponse` provides consistent interface
- Downstream code doesn't need provider-specific handling
- Unified cost and token tracking

### 4. **Provider Self-Configuration**
- Factory stays simple, just creates instances
- Providers determine their own capabilities
- No hardcoded model detection logic

### 5. **Context Window Management**
- Tracks cumulative thinking token usage
- Prevents context overflow
- Automatic budget adjustment when needed

### 6. **Cost Control**
- Global session limits ($5 default)
- Per-operation limits ($0.50 default)
- Real-time cost tracking and warnings

---

## Risk Mitigation

### Technical Risks
- **Provider API Changes**: Abstract through base class
- **Model Deprecation**: Use capability detection, not hardcoded names
- **Rate Limiting**: Implement exponential backoff
- **Context Overflow**: Pre-flight checks and budget adjustment

### Cost Risks
- **Runaway Thinking**: Hard limits at multiple levels
- **Unexpected Billing**: Track actual vs estimated costs
- **Provider Pricing Changes**: Configurable pricing tables

### Quality Risks
- **Thinking Failures**: Graceful degradation to non-thinking
- **Poor Reasoning**: Monitor quality metrics
- **Inconsistent Results**: A/B testing framework

---

## Timeline Estimate

**Total: 6-8 hours for complete implementation**

- **Stage 1**: Core Infrastructure (2-3 hours)
- **Stage 2**: Provider Implementations (2-3 hours)
- **Stage 3**: Testing & Validation (1-2 hours)
- **Stage 4**: Agent Configuration (30 min)
- **Stage 5**: Documentation (✅ Complete)

---

## Summary

This implementation plan provides a robust, maintainable architecture for extended thinking across multiple providers. Key benefits:

1. **Universal Interface**: Single configuration works everywhere
2. **Graceful Degradation**: System continues working even when thinking fails
3. **Cost Control**: Multiple layers of protection against runaway costs
4. **Provider Independence**: Easy to add new providers
5. **Production Ready**: Includes monitoring, metrics, and error handling

The architecture follows SOLID principles and integrates cleanly with the existing middleware pipeline, ensuring maintainability and extensibility.

---

## References

- [Anthropic Extended Thinking Documentation](https://docs.claude.com/en/docs/build-with-claude/extended-thinking)
- [OpenRouter Reasoning Tokens](https://openrouter.ai/docs/use-cases/reasoning-tokens)
- [Extended Thinking User Guide](./extended-thinking.md)
- [Original Implementation Plan](./extended-thinking-implementation-plan-v1.md)

---

**Version**: 2.0
**Status**: Ready for Implementation
**Last Updated**: 2025-10-15
