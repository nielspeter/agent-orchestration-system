# LLM Provider Integration

## Overview

The agent system supports multiple LLM providers through a unified interface. Providers are configured via `providers-config.json` and selected using explicit prefixes in model names.

## Supported Providers

- **Anthropic** - Native Claude integration with prompt caching
- **OpenAI** - GPT models via OpenAI-compatible API
- **OpenRouter** - 200+ models from various providers
- **Custom** - Any OpenAI-compatible API endpoint

## Quick Start

### 1. Set API Keys

```bash
# Anthropic (Claude models)
export ANTHROPIC_API_KEY=sk-ant-...

# OpenAI
export OPENAI_API_KEY=sk-...

# OpenRouter (multi-provider)
export OPENROUTER_API_KEY=sk-or-...
```

### 2. Specify Model with Provider Prefix

```typescript
const system = await AgentSystemBuilder.default()
  .withModel('anthropic/claude-3-5-haiku-latest')
  .build();

// Or in agent frontmatter:
```

```yaml
---
name: my-agent
model: anthropic/claude-3-5-haiku-latest
---
```

## Model Format

Models are specified using **provider/model[:modifier]** format:

```
provider/model[:modifier]
```

Examples:
- `anthropic/claude-3-5-haiku-latest`
- `openai/gpt-4-turbo`
- `openrouter/meta-llama/llama-3.1-70b-instruct`
- `openrouter/gpt-4:nitro` (with modifier)

## Behavior Presets

Behavior presets combine `temperature` and `top_p` settings for different use cases:

### Available Presets

```json
{
  "deterministic": {
    "temperature": 0.1,
    "top_p": 0.5,
    "description": "Near-deterministic for validation, routing, business logic"
  },
  "precise": {
    "temperature": 0.2,
    "top_p": 0.6,
    "description": "Code analysis, verification, structured outputs"
  },
  "balanced": {
    "temperature": 0.5,
    "top_p": 0.85,
    "description": "Default orchestration, tool use, general reasoning"
  },
  "creative": {
    "temperature": 0.7,
    "top_p": 0.95,
    "description": "Storytelling, game mastering, creative content"
  },
  "exploratory": {
    "temperature": 0.9,
    "top_p": 0.98,
    "description": "Research, brainstorming, generating alternatives"
  }
}
```

### Usage

In agent frontmatter:

```yaml
---
name: validator
model: anthropic/claude-3-5-haiku-latest
behavior: deterministic  # Use preset
---
```

Or specify custom values:

```yaml
---
name: creative-writer
model: anthropic/claude-sonnet-4-0
temperature: 0.8
top_p: 0.95
---
```

### Preset Selection Guidelines

| Use Case | Preset | Why |
|----------|--------|-----|
| Input validation | deterministic | Consistent, rule-based decisions |
| Code review | precise | Accurate analysis, structured feedback |
| Task orchestration | balanced | Good mix of creativity and consistency |
| Content generation | creative | Varied, engaging output |
| Research | exploratory | Diverse perspectives and ideas |
| Game master | creative | Dynamic storytelling |
| Data extraction | precise | Accurate structured outputs |
| Routing/classification | deterministic | Predictable decisions |

## Provider Configuration

### providers-config.json Structure

```json
{
  "$schema": "./providers-config.schema.json",

  "behaviorPresets": {
    "deterministic": { "temperature": 0.1, "top_p": 0.5 },
    "balanced": { "temperature": 0.5, "top_p": 0.85 }
  },

  "providers": {
    "anthropic": {
      "type": "native",
      "apiKeyEnv": "ANTHROPIC_API_KEY",
      "models": [
        {
          "id": "claude-sonnet-4-0",
          "contextLength": 200000,
          "maxOutputTokens": 4096,
          "pricing": { "input": 0.003, "output": 0.015 }
        }
      ]
    },
    "openai": {
      "type": "openai-compatible",
      "baseURL": "https://api.openai.com/v1",
      "apiKeyEnv": "OPENAI_API_KEY"
    },
    "openrouter": {
      "type": "openai-compatible",
      "baseURL": "https://openrouter.ai/api/v1",
      "apiKeyEnv": "OPENROUTER_API_KEY",
      "dynamicModels": true,
      "routing": {
        "sort": "throughput"
      }
    }
  }
}
```

### Provider Types

#### Native Providers

Native providers have custom implementations (e.g., Anthropic with prompt caching):

```json
{
  "type": "native",
  "className": "AnthropicProvider",
  "apiKeyEnv": "ANTHROPIC_API_KEY"
}
```

#### OpenAI-Compatible Providers

Most providers use OpenAI-compatible API:

```json
{
  "type": "openai-compatible",
  "baseURL": "https://api.provider.com/v1",
  "apiKeyEnv": "PROVIDER_API_KEY",
  "headers": {
    "X-Custom-Header": "value"
  }
}
```

## Anthropic Provider (Native)

### Features

- **Prompt Caching** - Automatic caching of system prompts and context
  - 90% cost savings on cache hits
  - Enabled by default when using AnthropicProvider

- **Cost Tracking** - Automatic cost calculation per request
  - Based on model pricing in config
  - Includes cache read/write costs
  - Exposed via event metadata

- **Streaming** - Text streaming support (not used in current implementation)

- **Thinking Block Preservation** - Automatic preservation of thinking/reasoning blocks
  - Uses `raw_content` field in Message type to store original API blocks
  - Ensures multi-turn conversations work with interleaved thinking
  - See [Extended Thinking Guide](./extended-thinking.md#thinking-block-preservation) for details

### Model Configuration

```json
{
  "anthropic": {
    "type": "native",
    "apiKeyEnv": "ANTHROPIC_API_KEY",
    "models": [
      {
        "id": "claude-opus-4-1",
        "contextLength": 200000,
        "maxOutputTokens": 4096,
        "pricing": { "input": 0.015, "output": 0.075 }
      },
      {
        "id": "claude-sonnet-4-0",
        "contextLength": 200000,
        "maxOutputTokens": 4096,
        "pricing": { "input": 0.003, "output": 0.015 }
      },
      {
        "id": "claude-3-5-haiku-latest",
        "contextLength": 200000,
        "maxOutputTokens": 4096,
        "pricing": { "input": 0.0008, "output": 0.004 }
      }
    ]
  }
}
```

### Prompt Caching

Anthropic's prompt caching is automatically enabled:

```typescript
// First call - no cache
const result1 = await system.executor.execute('agent', 'task 1');
// Caches: system prompt, tool definitions, conversation history

// Second call - cache hit!
const result2 = await system.executor.execute('agent', 'task 2');
// Reuses: system prompt, tool definitions
// Only pays for new conversation turn

// Cost savings: ~90% on cached content
```

Cache hit rates are logged:
```
Cache metrics: 83075% efficiency (122344 cached / 5 uncached / 5 writes)
```

### Cost Tracking

Every Anthropic API call emits cost metadata:

```typescript
system.eventLogger.on('message:assistant', (event) => {
  console.log('Tokens:', event.metadata.tokens);
  console.log('Cost:', event.metadata.cost);
  console.log('Model:', event.metadata.model);
  console.log('Cache hits:', event.metadata.cacheReadTokens);
});
```

## OpenAI Provider

### Configuration

```json
{
  "openai": {
    "type": "openai-compatible",
    "baseURL": "https://api.openai.com/v1",
    "apiKeyEnv": "OPENAI_API_KEY",
    "models": [
      {
        "id": "gpt-4-turbo",
        "contextLength": 128000,
        "maxOutputTokens": 4096
      }
    ]
  }
}
```

### Usage

```yaml
---
name: my-agent
model: openai/gpt-4-turbo
---
```

### Notes

- No prompt caching (OpenAI doesn't support it yet)
- Tool calling uses standard OpenAI format
- Streaming supported but not used

## OpenRouter Provider

### Features

- **200+ Models** - Access to models from multiple providers
- **Dynamic Models** - No need to pre-configure every model
- **Routing Modifiers** - `:nitro` and `:floor` for routing control
- **Throughput Optimization** - Automatic routing by speed

### Configuration

```json
{
  "openrouter": {
    "type": "openai-compatible",
    "baseURL": "https://openrouter.ai/api/v1",
    "apiKeyEnv": "OPENROUTER_API_KEY",
    "dynamicModels": true,
    "routing": {
      "sort": "throughput"
    },
    "models": [
      {
        "id": "*",
        "description": "OpenRouter supports 200+ models dynamically"
      }
    ]
  }
}
```

### Usage

```yaml
# Basic usage
model: openrouter/meta-llama/llama-3.1-70b-instruct

# With :nitro modifier (fastest routing)
model: openrouter/gpt-4:nitro

# With :floor modifier (cheapest routing)
model: openrouter/meta-llama/llama-3.1-70b:floor
```

### Routing Modifiers

OpenRouter supports special modifiers:

- **`:nitro`** - Route to fastest available instance
- **`:floor`** - Route to cheapest available instance

Example:
```yaml
# Use fastest GPT-4 instance
model: openrouter/gpt-4:nitro

# Use cheapest Llama instance
model: openrouter/meta-llama/llama-3.1-70b-instruct:floor
```

### Popular Models

```yaml
# OpenAI via OpenRouter
model: openrouter/openai/gpt-4-turbo

# Anthropic via OpenRouter
model: openrouter/anthropic/claude-3-5-sonnet

# Meta Llama
model: openrouter/meta-llama/llama-3.1-405b-instruct

# DeepSeek
model: openrouter/deepseek/deepseek-chat

# X.AI Grok
model: openrouter/x-ai/grok-code-fast-1
```

## Custom Providers

### Adding a Custom OpenAI-Compatible Provider

1. **Add to providers-config.json**:

```json
{
  "providers": {
    "my-provider": {
      "type": "openai-compatible",
      "baseURL": "https://api.my-provider.com/v1",
      "apiKeyEnv": "MY_PROVIDER_API_KEY",
      "headers": {
        "X-Custom-Header": "value"
      },
      "models": [
        {
          "id": "my-model-v1",
          "contextLength": 128000,
          "maxOutputTokens": 4096
        }
      ]
    }
  }
}
```

2. **Set API key**:

```bash
export MY_PROVIDER_API_KEY=your-key-here
```

3. **Use in agent**:

```yaml
---
name: my-agent
model: my-provider/my-model-v1
---
```

### Local Providers (Ollama, LM Studio, etc.)

```json
{
  "providers": {
    "local": {
      "type": "openai-compatible",
      "baseURL": "http://localhost:11434/v1",
      "apiKeyEnv": "LOCAL_API_KEY",  // Set to any value
      "models": [
        {
          "id": "llama2",
          "contextLength": 4096
        }
      ]
    }
  }
}
```

```bash
export LOCAL_API_KEY=not-used
```

```yaml
model: local/llama2
```

## Model Selection Strategy

### Development

```yaml
# Fast and cheap for development
model: anthropic/claude-3-5-haiku-latest
behavior: balanced
```

### Production

```yaml
# High quality for production
model: anthropic/claude-sonnet-4-0
behavior: precise
```

### Cost Optimization

```yaml
# Cheapest option
model: anthropic/claude-3-5-haiku-latest
behavior: deterministic

# Or via OpenRouter floor
model: openrouter/meta-llama/llama-3.1-8b:floor
behavior: precise
```

### Performance Optimization

```yaml
# Fastest option
model: openrouter/gpt-4:nitro
behavior: balanced
```

## Cost Management

### Tracking Costs

```typescript
let totalCost = 0;

system.eventLogger.on('message:assistant', (event) => {
  if (event.metadata?.cost) {
    totalCost += event.metadata.cost;
    console.log(`Call: $${event.metadata.cost.toFixed(4)}`);
    console.log(`Total: $${totalCost.toFixed(4)}`);
  }
});
```

### Cost Limits

```typescript
const MAX_COST = 1.00; // $1.00 limit

system.eventLogger.on('message:assistant', (event) => {
  if (event.metadata?.cost) {
    totalCost += event.metadata.cost;

    if (totalCost > MAX_COST) {
      throw new Error(`Cost limit exceeded: $${totalCost.toFixed(4)}`);
    }
  }
});
```

### Cost Comparison

Based on `providers-config.json` pricing (per 1M tokens):

| Model | Input | Output | Best For |
|-------|--------|--------|----------|
| claude-3-5-haiku-latest | $0.80 | $4.00 | Development, high volume |
| claude-sonnet-4-0 | $3.00 | $15.00 | Production, quality |
| claude-opus-4-1 | $15.00 | $75.00 | Complex reasoning |

**Tip**: Use Haiku for development and testing, Sonnet for production.

## Programmatic Provider Selection

### Dynamic Model Selection

```typescript
const model = process.env.NODE_ENV === 'production'
  ? 'anthropic/claude-sonnet-4-0'
  : 'anthropic/claude-3-5-haiku-latest';

const system = await AgentSystemBuilder.default()
  .withModel(model)
  .build();
```

### Agent-Specific Models

```typescript
const system = await AgentSystemBuilder.default()
  .withAgents([
    { path: 'agents/validator.md', model: 'anthropic/claude-3-5-haiku-latest' },
    { path: 'agents/analyzer.md', model: 'anthropic/claude-sonnet-4-0' }
  ])
  .build();
```

## Testing with Multiple Providers

```typescript
const providers = [
  'anthropic/claude-3-5-haiku-latest',
  'openai/gpt-4-turbo',
  'openrouter/meta-llama/llama-3.1-70b-instruct'
];

for (const model of providers) {
  console.log(`Testing with ${model}...`);

  const system = await AgentSystemBuilder.default()
    .withModel(model)
    .build();

  const result = await system.executor.execute('agent', 'test task');
  console.log(`Result: ${result}`);
}
```

## Error Handling

### Missing API Key

```typescript
// Error: Missing API key for anthropic. Set ANTHROPIC_API_KEY environment variable.
```

**Fix**:
```bash
export ANTHROPIC_API_KEY=your-key-here
```

### Unknown Provider

```typescript
// Error: Unknown provider: unknown. Available: anthropic, openai, openrouter
```

**Fix**: Use correct provider prefix or add provider to config.

### Invalid Model Format

```typescript
// Error: Invalid model format. Use: provider/model
```

**Fix**: Use format `provider/model`, e.g., `anthropic/claude-3-5-haiku-latest`

## Best Practices

### API Key Security

```bash
# ✅ DO: Use environment variables
export ANTHROPIC_API_KEY=sk-ant-...

# ❌ DON'T: Hardcode in code
const apiKey = "sk-ant-..."; // Never do this!
```

### Model Selection

```yaml
# ✅ DO: Be explicit about provider
model: anthropic/claude-3-5-haiku-latest

# ❌ DON'T: Assume default provider
model: claude-3-5-haiku-latest  # Won't work!
```

### Cost Awareness

```yaml
# ✅ DO: Use cheap models for development
model: anthropic/claude-3-5-haiku-latest

# ✅ DO: Use quality models for production
model: anthropic/claude-sonnet-4-0

# ⚠️  CAUTION: Opus is expensive
model: anthropic/claude-opus-4-1  # 18x more than Haiku!
```

### Behavior Configuration

```yaml
# ✅ DO: Use presets for consistency
behavior: balanced

# ✅ DO: Override when needed
temperature: 0.8
top_p: 0.95

# ❌ DON'T: Use extreme values without reason
temperature: 1.0  # Too random
temperature: 0.0  # Too deterministic
```

## See Also

- [Event System](./event-system.md) - Cost tracking via events
- [Logging and Debugging](./logging-and-debugging.md) - Model selection logging
- [Configuration](./unified-configuration.md) - AgentSystemBuilder usage
