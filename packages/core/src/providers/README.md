# Providers Module

## Overview

The providers module contains LLM provider implementations and the factory for
creating them based on model names.

## Providers

### AnthropicProvider

- Supports Claude models
- Implements prompt caching for cost optimization
- Tracks cache metrics and usage

### OpenAICompatibleProvider

- Supports OpenAI API compatible providers (OpenRouter, etc.)
- Handles behavior presets
- Compatible with various model providers

## Key Components

- `provider-factory.ts` - Creates providers based on model name
- `llm-provider.interface.ts` - Common interface for all providers
- Provider configuration loaded from `providers-config.json`

## Configuration

```json
{
  "providers": {
    "anthropic": {
      "models": ["claude-3-5-sonnet", "claude-3-5-haiku"],
      "apiKeyEnv": "ANTHROPIC_API_KEY"
    },
    "openrouter": {
      "baseURL": "https://openrouter.ai/api/v1",
      "apiKeyEnv": "OPENROUTER_API_KEY"
    }
  }
}
```

## Usage

```typescript
import { ProviderFactory } from '@/providers';

const factory = new ProviderFactory();
const provider = factory.getProvider('claude-3-5-haiku', logger);
```
