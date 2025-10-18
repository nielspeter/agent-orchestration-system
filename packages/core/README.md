# @agent-system/core

> Core agent orchestration system - autonomous agents with LLM providers

A TypeScript library for building autonomous agent systems with support for
multiple LLM providers (Anthropic Claude, OpenAI, OpenRouter), tool execution,
agent delegation, and session management.

## Features

- **🤖 Multi-Provider Support**: Anthropic Claude, OpenAI, OpenRouter with
  automatic routing
- **🔧 Built-in Tools**: File operations, grep, shell execution, agent
  delegation
- **💾 Session Management**: Persistent sessions with automatic recovery
- **📊 Event Logging**: Real-time event streaming for monitoring and debugging
- **🎯 Pull Architecture**: Agents gather their own context via tools (efficient
  with Anthropic's prompt caching)
- **🛡️ Security**: Built-in protections for sensitive files and dangerous
  commands
- **⚡ Smart Caching**: Anthropic prompt caching for 90% cost savings on
  repeated context
- **🔄 MCP Integration**: Model Context Protocol support for external tool
  servers

## Installation

```bash
npm install @agent-system/core
```

## Quick Start

```typescript
import { AgentSystemBuilder } from '@agent-system/core';

// Build an agent system with default tools
const system = await AgentSystemBuilder.default()
  .withAgents(['./agents'])
  .build();

// Execute an agent
const result = await system.executor.execute(
  'orchestrator',
  'Analyze the codebase'
);
console.log(result);

// Clean up when done
await system.cleanup();
```

## Configuration

### Basic Setup

```typescript
const system = await AgentSystemBuilder.default()
  .withAgents(['./my-agents'])
  .withSessionId('my-session')
  .withConsole({ enabled: true, color: true })
  .build();
```

### Custom Tools

```typescript
const myTool = {
  name: 'my_tool',
  description: 'Does something useful',
  parameters: {
    type: 'object',
    properties: {
      input: { type: 'string', description: 'Input text' },
    },
    required: ['input'],
  },
  execute: async (params) => {
    return { content: `Processed: ${params.input}` };
  },
  isConcurrencySafe: () => true,
};

const system = await AgentSystemBuilder.default().withTools([myTool]).build();
```

### MCP Server Integration

```typescript
const system = await AgentSystemBuilder.default()
  .withMCPServers({
    filesystem: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
    },
  })
  .build();
```

## Agent Definition

Create agents as markdown files with YAML frontmatter:

```markdown
---
name: code-reviewer
description: Reviews code for quality and security
tools:
  - Read
  - Write
  - Grep
model: anthropic/claude-3-5-sonnet-latest
behavior: precise
---

You are an expert code reviewer. Review code for:

- Code quality and best practices
- Security vulnerabilities
- Performance issues
- Documentation completeness
```

## Built-in Tools

- **Read**: Read files from the filesystem
- **Write**: Write files (with size limits)
- **List**: List directory contents
- **Grep**: Search file contents with ripgrep
- **Delegate**: Delegate subtasks to other agents
- **TodoWrite**: Task tracking for complex workflows
- **Shell**: Execute shell commands (with security restrictions)
- **GetSessionLog**: Retrieve conversation history

## Event Logging

Subscribe to real-time events for monitoring and debugging:

```typescript
system.eventLogger.on('agent:start', (event) => {
  console.log(`Agent ${event.data.agent} started`);
});

system.eventLogger.on('tool:execute', (event) => {
  console.log(`Tool ${event.data.name} executed`);
});

system.eventLogger.on('agent:complete', (event) => {
  console.log(`Agent completed in ${event.data.duration}ms`);
});
```

## Session Management

```typescript
// Sessions persist automatically
const system = await AgentSystemBuilder.default()
  .withSessionId('my-session')
  .withStorage({
    type: 'filesystem',
    path: './sessions',
  })
  .build();

// Continue from previous session
const result = await system.executor.execute(
  'agent',
  'Continue our conversation'
);
```

## Security

Built-in security features:

- **File Protection**: Blocks access to sensitive files (.ssh, .aws, .env)
- **Shell Security**: Prevents dangerous commands (rm -rf /, fork bombs)
- **Size Limits**: 50MB read limit, 10MB write limit
- **Timeouts**: Configurable timeouts on all operations
- **Path Validation**: Prevents path traversal attacks

## Configuration

### Code-First Configuration (Recommended)

Configuration files are optional. You can provide configuration
programmatically:

```typescript
import { AgentSystemBuilder, type ProvidersConfig } from '@agent-system/core';

// Define providers config in code
const providersConfig: ProvidersConfig = {
  providers: {
    anthropic: {
      type: 'native',
      apiKeyEnv: 'ANTHROPIC_API_KEY',
      models: [
        {
          id: 'claude-haiku-4-5',
          contextLength: 200000,
          maxOutputTokens: 8192,
        },
      ],
    },
    openrouter: {
      type: 'openai-compatible',
      baseURL: 'https://openrouter.ai/api/v1',
      apiKeyEnv: 'OPENROUTER_API_KEY',
    },
  },
  behaviorPresets: {
    balanced: { temperature: 0.5, top_p: 0.85 },
    precise: { temperature: 0.2, top_p: 0.6 },
  },
};

// Provide API keys programmatically (e.g., from secret manager)
const apiKeys = {
  ANTHROPIC_API_KEY: await secretManager.get('anthropic-key'),
  OPENROUTER_API_KEY: await secretManager.get('openrouter-key'),
};

// Build with code-first configuration
const system = await AgentSystemBuilder.default()
  .withModel('anthropic/claude-haiku-4-5')
  .withProvidersConfig(providersConfig)
  .withAPIKeys(apiKeys)
  .build();
```

**Benefits:**

- No file dependencies - ideal for testing and CI/CD
- Secret manager integration (AWS Secrets Manager, Vault, etc.)
- Type-safe configuration with full TypeScript support
- Dynamic configuration at runtime

**API Key Precedence:**

1. `.withAPIKeys()` - highest priority
2. `process.env` - fallback

### Configuration Files (Optional)

Alternatively, use configuration files for simpler setups.

#### providers-config.json

Configure LLM providers and behavior presets:

```json
{
  "behaviorPresets": {
    "deterministic": { "temperature": 0.1, "top_p": 0.5 },
    "precise": { "temperature": 0.2, "top_p": 0.6 },
    "balanced": { "temperature": 0.5, "top_p": 0.85 },
    "creative": { "temperature": 0.7, "top_p": 0.95 }
  },
  "providers": {
    "anthropic": {
      "type": "native",
      "apiKeyEnv": "ANTHROPIC_API_KEY"
    },
    "openrouter": {
      "type": "openai-compatible",
      "baseURL": "https://openrouter.ai/api/v1",
      "apiKeyEnv": "OPENROUTER_API_KEY"
    }
  }
}
```

#### agent-config.json

Set system-wide defaults:

```json
{
  "defaultModel": "anthropic/claude-haiku-4-5",
  "defaultBehavior": "balanced"
}
```

## Environment Variables

```bash
# At least one API key required:
ANTHROPIC_API_KEY=your-anthropic-key
OPENROUTER_API_KEY=your-openrouter-key

# Optional:
DISABLE_PROMPT_CACHING=true  # Disable Anthropic prompt caching
```

## Testing

```bash
# Unit tests (no API calls)
npm test

# Integration tests (requires API key)
npm run test:integration

# All tests
npm run test:all
```

## Examples

See the [examples directory](../../examples/) for complete working examples:

- **quickstart.ts**: Basic agent execution
- **orchestration.ts**: Agent delegation demo
- **configuration.ts**: Configuration options
- **logging.ts**: Event logging
- **mcp-integration.ts**: MCP server integration
- **werewolf-game.ts**: Autonomous multi-agent game

## API Reference

### AgentSystemBuilder

```typescript
class AgentSystemBuilder {
  static default(): AgentSystemBuilder;
  static minimal(): AgentSystemBuilder;
  static forTest(): AgentSystemBuilder;
  static fromConfigFile(path: string): Promise<AgentSystemBuilder>;

  withAgents(dirs: string[]): this;
  withTools(tools: BaseTool[]): this;
  withModel(model: string): this;
  withSessionId(id: string): this;
  withConsole(config: ConsoleConfig): this;
  withMCPServers(servers: MCPConfig): this;
  withProvidersConfig(config: ProvidersConfig): this; // NEW
  withAPIKeys(keys: Record<string, string>): this; // NEW

  async build(): Promise<BuildResult>;
}
```

### BuildResult

```typescript
interface BuildResult {
  executor: AgentExecutor;
  toolRegistry: ToolRegistry;
  sessionManager: SessionManager;
  storage: SessionStorage;
  logger: AgentLogger;
  eventLogger: EventLogger;
  config: ResolvedSystemConfig;
  cleanup: () => Promise<void>;
}
```

## License

MIT

## Contributing

Contributions welcome! Please read the contributing guidelines before submitting
PRs.

## Links

- [Documentation](../../docs/)
- [Examples](../../examples/)
- [GitHub Issues](https://github.com/anthropics/agent-orchestration-system/issues)
