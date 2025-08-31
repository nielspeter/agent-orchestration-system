# Migration Guide: From Manual Setup to Configuration-Based Setup

## Overview

We now support MCP (Model Context Protocol) servers and configuration-based setup. This allows:
- Dynamic tool discovery from MCP servers
- Standardized configuration format
- Less boilerplate in examples
- Flexibility when needed

## Configuration File Format

Create an `agent-config.json` file with your configuration:

```json
{
  "mcpServers": {
    "serverName": {
      "command": "npx",
      "args": ["-y", "package-name"],
      "env": {
        "API_KEY": "${ENV_VAR_NAME}"
      }
    }
  },
  "builtinTools": {
    "enabled": true,
    "tools": ["read", "write", "list", "task"]
  },
  "agents": {
    "directory": "./agents"
  }
}
```

## Migration Patterns

### Old Pattern (Manual Setup)
```typescript
// Before - lots of boilerplate
const agentLoader = new AgentLoader(path.join(getDirname(import.meta.url), '../agents'));
const toolRegistry = new ToolRegistry();
const logger = LoggerFactory.createCombinedLogger();

toolRegistry.register(createReadTool());
toolRegistry.register(createWriteTool());
toolRegistry.register(createListTool());
toolRegistry.register(await createTaskTool(agentLoader));

const executor = new AgentExecutor(agentLoader, toolRegistry, modelName, logger);
```

### New Pattern (Config-Based)

#### Option 1: Full Configuration
```typescript
// Load everything from agent-config.json
const setup = await setupFromConfig({
  configPath: './agent-config.json',
  sessionId: 'my-session'
});

const result = await setup.executor.execute('orchestrator', 'Do something');

// Don't forget cleanup!
await setup.cleanup();
```

#### Option 2: Quick Setup
```typescript
// Simple defaults with selected MCP servers
const setup = await quickSetup({
  mcpServers: ['filesystem', 'github'],
  additionalTools: ['todowrite']
});

const result = await setup.executor.execute('orchestrator', 'Do something');
await setup.cleanup();
```

#### Option 3: Custom Override
```typescript
// When you need specific configuration
const setup = await setupFromConfig({
  configOverrides: {
    mcpServers: {
      'custom': {
        command: 'node',
        args: ['./my-server.js']
      }
    },
    execution: {
      defaultModel: 'claude-3-5-sonnet-20241022'
    }
  }
});
```

#### Option 4: Keep Manual (Still Works!)
```typescript
// You can still do everything manually when needed
const agentLoader = new AgentLoader('./agents');
const toolRegistry = new ToolRegistry();

// Manual setup still works for full control
```

## When to Use Each Pattern

### Use Full Configuration (`setupFromConfig`)
- Production deployments
- When using multiple MCP servers
- Need consistent configuration across runs

### Use Quick Setup (`quickSetup`)
- Simple examples
- Testing specific features
- Quick prototypes

### Use Custom Override
- Testing edge cases
- Example-specific configuration
- Temporary modifications

### Keep Manual Setup
- Teaching how the system works
- Need precise control over setup order
- Testing individual components

## MCP Server Integration

### Adding an MCP Server

1. Add to `agent-config.json`:
```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "@myorg/mcp-server"],
      "env": {
        "API_KEY": "${MY_API_KEY}"
      }
    }
  }
}
```

2. Tools are automatically namespaced:
```typescript
// MCP tools become: serverName.toolName
// e.g., "filesystem.read", "github.create_issue"
```

3. Use in agents:
```yaml
---
name: github-agent
tools: ["github.*", "read", "write"]
---
```

## Benefits of Configuration-Based Setup

1. **Standardization**: Follows MCP specification
2. **Less Code**: ~10 lines → 3 lines
3. **Dynamic Tools**: MCP servers provide tools at runtime
4. **Environment Management**: Centralized env var handling
5. **Easy Testing**: Switch configurations without code changes

## Backwards Compatibility

✅ **All existing examples still work!**

The manual setup pattern is still fully supported. Migration is optional and can be done gradually.

## Example Migration

### Before
```typescript
// orchestration-demo.ts (old)
const agentLoader = new AgentLoader(path.join(getDirname(import.meta.url), '../agents'));
const toolRegistry = new ToolRegistry();
const logger = LoggerFactory.createCombinedLogger('demo');

toolRegistry.register(createReadTool());
toolRegistry.register(createWriteTool());
toolRegistry.register(createListTool());
toolRegistry.register(await createTaskTool(agentLoader));

const modelName = process.env.MODEL || 'claude-3-5-haiku-20241022';
const executor = new AgentExecutor(agentLoader, toolRegistry, modelName, logger);

// ... use executor
```

### After
```typescript
// orchestration-demo.ts (new)
const setup = await setupFromConfig({
  sessionId: 'demo'
});

// ... use setup.executor

await setup.cleanup();
```

## Testing with MCP

```bash
# Install an MCP server
npm install -g @modelcontextprotocol/server-filesystem

# Add to mcp-config.json
# Run your example
npm run example:config-based
```

## Troubleshooting

### MCP Server Not Connecting
- Check the command and args are correct
- Verify environment variables are set
- Look for error messages in console

### Tools Not Found
- MCP tools are namespaced: `serverName.toolName`
- Check `setup.toolRegistry.list()` to see available tools
- Verify MCP server is returning tools

### Configuration Not Loading
- Check file path (default: `./mcp-config.json`)
- Validate JSON syntax
- Use `configOverrides` for runtime changes