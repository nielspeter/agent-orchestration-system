# Configuration Example

Demonstrates loading and using agent system configuration from JSON files.

## What This Demonstrates

- **File-Based Configuration**: Loading from `agent-config.json`
- **Provider Configuration**: Setting up LLM providers via config files
- **Model Selection**: Configuring default models
- **Behavior Presets**: Using temperature/top_p presets

## Key Concepts

This example shows the traditional **file-based configuration** approach:

- Configuration files in the project directory
- Provider setup (Anthropic, OpenRouter, etc.)
- Behavior presets (deterministic, precise, balanced, creative)
- Model defaults

## Running the Example

```bash
# Make sure you have config files set up first
cp agent-config.example.json agent-config.json
cp providers-config.example.json providers-config.json

npx tsx packages/examples/configuration/configuration.ts
```

## Configuration Files

### `agent-config.json`
```json
{
  "defaultModel": "anthropic/claude-haiku-4-5",
  "defaultBehavior": "balanced"
}
```

### `providers-config.json`
```json
{
  "behaviorPresets": {
    "balanced": { "temperature": 0.5, "top_p": 0.85 }
  },
  "providers": {
    "anthropic": {
      "type": "native",
      "apiKeyEnv": "ANTHROPIC_API_KEY"
    }
  }
}
```

## Code Highlights

```typescript
// Load from config file
const system = await AgentSystemBuilder
  .fromConfigFile('./agent-config.json')
  .build();
```

## Comparison

**File-Based Config** (this example):
- Good for: Simple projects, quick prototyping
- Config: `agent-config.json` + `providers-config.json`
- API Keys: Environment variables

**Code-First Config** (see `code-first-config` example):
- Good for: Production, testing, CI/CD
- Config: Programmatic TypeScript objects
- API Keys: Secret managers, programmatic injection

## Next Steps

For programmatic configuration, see:
- `code-first-config.ts` - No file dependencies
