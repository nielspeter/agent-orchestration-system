# Unified Configuration System

## Overview

The agent orchestration system uses a unified configuration approach built on the **Builder Pattern**. This provides
a clean, testable, and flexible way to configure the system for any use case - from simple scripts to complex
multi-agent workflows to unit tests.

## Key Benefits

1. **No Singletons** - Each configuration is isolated, perfect for testing
2. **Type-Safe** - Full TypeScript support with intelligent autocomplete
3. **Flexible** - Build programmatically or load from config files
4. **Testable** - Mock agents and tools for unit testing
5. **Composable** - Chain methods to build exactly what you need

## Quick Start

### Basic Usage

```typescript
import {AgentSystemBuilder} from 'agent-orchestration-system';

// Simple setup
const {executor, cleanup} = await new AgentSystemBuilder()
  .withModel('anthropic/claude-3-5-haiku-latest')
  .withAgentsFrom('./agents')
  .withDefaultTools()
  .withSessionId('my-session')
  .build();

// Execute tasks
const result = await executor.execute('orchestrator', 'Your task here');

// Clean up when done
await cleanup();
```

### Factory Methods

```typescript
// Minimal setup (just read/write tools)
const minimal = await AgentSystemBuilder.minimal()
  .withSessionId('minimal-demo')
  .build();

// Default setup (includes task tool for delegation)
const standard = await AgentSystemBuilder.default()
  .withSessionId('default-demo')
  .build();

// Full setup (includes todo management)
const full = await AgentSystemBuilder.default()
  .withSessionId('full-demo')
  .build();
```

### Loading from Config Files

```typescript
// Load from default agent-config.json
const fromFile = await AgentSystemBuilder.fromConfigFile()
  .withSessionId('file-config')
  .build();

// Load from custom config file
const custom = await AgentSystemBuilder.fromConfigFile('./my-config.json')
  .withSessionId('custom-config')
  .build();
```

## Configuration Options

### Model Configuration

```typescript
builder.withModel('anthropic/claude-3-5-haiku-latest')  // Choose AI model
```

### Agent Configuration

```typescript
builder
  .withAgentsFrom('./agents')                    // Primary agent directory
  .withAdditionalAgentsFrom('./extra-agents')    // Additional directories
```

### Tool Configuration

```typescript
builder
  .withBuiltinTools('read', 'write', 'list')    // Specific built-in tools
  .withDefaultTools()                            // read, write, list, task
  .withTodoTool()                                // Add todo management
  .withTool(customTool)                          // Add custom tool instance
```

### Runtime Configuration

```typescript
builder
  .withSafetyLimits({
    maxIterations: 30,
    maxDepth: 7,
    warnAtIteration: 15
  })
  .withCaching({
    enabled: true,
    cacheTTLMinutes: 10,
    maxCacheBlocks: 6
  })
  .withLogging({
    logDir: 'custom-logs',
    verbose: true
  })
  .withTodos({
    todosDir: 'my-todos',
    maxTodosPerSession: 100
  })
```

### Session Configuration

```typescript
builder
  .withSessionId('unique-session-id')
  .with({
    session: {
      timeout: 600000  // 10 minutes
    }
  })
```

## Testing Support

### Unit Testing

```typescript
import {TestConfigBuilder} from 'agent-orchestration-system';

describe('MyAgent', () => {
  it('should handle task correctly', async () => {
    const {executor} = await TestConfigBuilder.forTest()
      .withMockAgent('test-agent', new Map([
        ['input1', 'response1'],
        ['input2', 'response2']
      ]))
      .withMockTool('read', async (args) => ({
        content: 'mocked file content'
      }))
      .withDeterministicMode()
      .withRecording()
      .buildForTest();

    const result = await executor.execute('test-agent', 'input1');
    expect(result).toBe('response1');
  });
});
```

### Test Presets

```typescript
import {TEST_CONFIG_MINIMAL, TEST_CONFIG_WITH_TOOLS} from 'agent-orchestration-system/config/types';

// Minimal test config
const testExecutor = await AgentSystemBuilder
  .fromConfig(TEST_CONFIG_MINIMAL)
  .build();

// Test config with tools
const withTools = await AgentSystemBuilder
  .fromConfig(TEST_CONFIG_WITH_TOOLS)
  .build();
```

## Advanced Usage

### Generic Configuration Override

```typescript
// Use .with() for any configuration
const advanced = await new AgentSystemBuilder()
  .with({
    model: 'claude-3-5-sonnet',
    agents: {directories: ['./agents']},
    tools: {builtin: ['read', 'write']},
    safety: {maxIterations: 50}
  })
  .build();
```

### Build Result

The `build()` method returns a `BuildResult` object:

```typescript
interface BuildResult {
  config: ResolvedSystemConfig;  // Final resolved configuration
  executor: AgentExecutor;       // Agent executor instance
  cleanup: () => Promise<void>;  // Cleanup function for resources
}
```

### Complete Example

```typescript
import {AgentSystemBuilder} from 'agent-orchestration-system';

async function main() {
  // Build a fully configured system
  const {config, executor, cleanup} = await new AgentSystemBuilder()
    .withModel('anthropic/claude-3-5-haiku-latest')
    .withAgentsFrom('./agents')
    .withDefaultTools()
    .withTodoTool()
    .withSafetyLimits({maxIterations: 30})
    .withCaching({enabled: true})
    .withLogging({verbose: true})
    .withSessionId('main-app')
    .build();

  console.log('Using model:', config.model);
  console.log('Safety limits:', config.safety);

  try {
    const result = await executor.execute(
      'orchestrator',
      'Analyze the codebase and create a summary'
    );
    console.log(result);
  } finally {
    await cleanup();
  }
}
```

## Configuration Types

See `src/config/types.ts` for all configuration interfaces:

- `SystemConfig` - Complete configuration interface
- `ResolvedSystemConfig` - Configuration with all defaults applied
- `SafetyConfig` - Safety limits and constraints
- `CachingConfig` - Cache settings
- `LoggingConfig` - Logging configuration
- `ToolConfig` - Tool configuration
- `AgentConfig` - Agent loading configuration
- `MCPConfig` - MCP server configuration (future)
- `TodoConfig` - Todo management settings

## Best Practices

1. **Use factory methods** for common scenarios (minimal, default, full)
2. **Chain only what you need** - start simple, add complexity as needed
3. **Always call cleanup()** when done to release resources
4. **Use TestConfigBuilder** for unit tests, not production
5. **Store config in files** for production, use builder for development
6. **Be explicit with session IDs** for better debugging and logging

## Future Enhancements

- [ ] MCP server support in builder
- [ ] Config validation and schema support
- [ ] Config file generation from builder
- [ ] Plugin system for custom builders
- [ ] Environment-specific config loading