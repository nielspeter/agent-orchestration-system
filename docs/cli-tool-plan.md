# Agent CLI Tool (IMPLEMENTED)

> **Status**: ✅ Implemented on `feature/cli-package` branch
>
> The CLI tool is a thin wrapper around `@agent-system/core` that provides command-line access to agents.
> Key insight: We don't duplicate core functionality - the CLI just parses args and delegates to the builder.

## Goal

Create a CLI tool that allows running agents from any directory without writing TypeScript setup code.

## Usage Examples

```bash
# From any directory with agents/ folder:
agent -p "multiply 7 and 6"                    # Uses default agent
agent -a text-analyzer -p "analyze this text"  # Uses specific agent
agent --list-agents                            # Shows available agents
agent --list-tools                             # Shows available tools

# Global installation
npm install -g @agent-system/cli
agent -p "hello world"

# Local development
npx @agent-system/cli -p "test"
```

## Workspace Architecture

### New Package: `packages/cli/`

```
packages/
├── core/              # @agent-system/core (existing)
├── web/               # @agent-system/web (existing)
└── cli/               # @agent-system/cli (NEW)
    ├── src/
    │   ├── index.ts         # CLI entry point
    │   ├── commands/        # Command implementations
    │   ├── discovery.ts     # Agent/tool auto-discovery
    │   └── output.ts        # Output formatting
    ├── package.json         # With bin field
    └── tsconfig.json
```

## Implementation Steps

### 1. Create CLI Package

```bash
# Create package structure
mkdir -p packages/cli/src/{commands}
cd packages/cli
```

**packages/cli/package.json:**
```json
{
  "name": "@agent-system/cli",
  "version": "1.0.0",
  "type": "module",
  "description": "CLI tool for agent orchestration system",
  "bin": {
    "agent": "./dist/index.js"
  },
  "main": "./dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@agent-system/core": "*",
    "commander": "^12.0.0",
    "chalk": "^5.3.0",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "@types/node": "^20.11.30",
    "tsx": "^4.7.1",
    "typescript": "^5.9.2",
    "vitest": "^2.1.8"
  }
}
```

**packages/cli/tsconfig.json:**
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../core" }
  ]
}
```

### 2. Create CLI Entry Point

**packages/cli/src/index.ts:**
```typescript
#!/usr/bin/env node
import * as dotenv from 'dotenv';
import { Command } from 'commander';
import { AgentSystemBuilder } from '@agent-system/core';
import { formatOutput, formatError, type OutputFormat } from './output.js';

// Load environment variables (like examples do)
dotenv.config();

const program = new Command();

program
  .name('agent')
  .description('CLI tool for running agents')
  .version('1.0.0');

program
  .option('-p, --prompt <text>', 'The prompt to send to the agent')
  .option('-a, --agent <name>', 'Agent to use', 'default')
  .option('-m, --model <model>', 'Model to use')
  .option('--agents-dir <path>', 'Path to agents directory')
  .option('-o, --output <format>', 'Output format: clean, verbose, json', 'clean')
  .option('--list-agents', 'List available agents')
  .option('--list-tools', 'List available tools')
  .option('--json', 'Output as JSON (shorthand for --output json)');

program.parse();

const options = program.opts();

async function main() {
  try {
    // Build system using core's defaults - leverages built-in agent discovery
    let builder = AgentSystemBuilder.default();

    // Apply optional overrides
    if (options.model) {
      builder = builder.withModel(options.model);
    }

    // If agents directory specified, use it; otherwise uses default agent
    if (options.agentsDir) {
      builder = builder.withAgentsFrom(options.agentsDir);
    }

    const { executor, toolRegistry, agentLoader, cleanup } = await builder.build();

    // Handle --list-agents
    if (options.listAgents) {
      const agents = await agentLoader.listAgents();
      if (options.json) {
        console.log(JSON.stringify({ agents }, null, 2));
      } else {
        console.log('Available agents:');
        agents.forEach((agent: string) => console.log(`  - ${agent}`));
      }
      await cleanup();
      return;
    }

    // Handle --list-tools
    if (options.listTools) {
      const tools = toolRegistry.getAllTools().map((t: { name: string }) => t.name);
      if (options.json) {
        console.log(JSON.stringify({ tools }, null, 2));
      } else {
        console.log('Available tools:');
        tools.forEach((tool: string) => console.log(`  - ${tool}`));
      }
      await cleanup();
      return;
    }

    // Execute agent
    if (!options.prompt) {
      console.error('Error: --prompt is required');
      process.exit(1);
    }

    const startTime = Date.now();
    const result = await executor.execute(options.agent, options.prompt);
    const duration = Date.now() - startTime;

    // Determine output format (--json flag overrides --output)
    const outputFormat: OutputFormat = options.json ? 'json' : options.output;

    // Format and display output
    const formatted = formatOutput(
      { result, agentName: options.agent, duration },
      outputFormat
    );
    console.log(formatted);

    // Cleanup (like examples do)
    await cleanup();
  } catch (error) {
    const outputFormat: OutputFormat = options.json ? 'json' : options.output;
    console.error(formatError(error as Error, outputFormat));
    process.exit(1);
  }
}

main().catch(console.error);
```

**Key simplifications from original plan:**
- NO agent discovery logic needed (core handles it!)
- Uses `AgentSystemBuilder.default()` as base
- Optional `--agents-dir` flag instead of automatic discovery
- Relies entirely on core's validation and defaults

### 3. ~~Auto-Discovery Logic~~ (NOT NEEDED)

**Agent discovery is already handled by `@agent-system/core`!**

The CLI doesn't need its own discovery logic. The `AgentSystemBuilder` in core already:
- Validates agent directories exist
- Falls back to built-in default agent if no directory provided
- Handles agent loading and validation

The CLI just needs to:
1. Accept optional `--agents-dir` flag
2. Pass it to `.withAgentsFrom()` if provided
3. Let the builder use its default behavior otherwise

This keeps the CLI thin and avoids duplicating core logic.

### 4. Update Root Workspace

**Root package.json additions:**
```json
{
  "scripts": {
    "build:cli": "npm run build -w @agent-system/cli",
    "dev:cli": "npm run dev -w @agent-system/cli",
    "cli": "tsx packages/cli/src/index.ts"
  }
}
```

### 5. Command-Line Arguments

```
Usage: agent [options]

Options:
  -p, --prompt <text>     The prompt to send to the agent
  -a, --agent <name>      Agent to use (default: "default")
  -m, --model <model>     Model to use (overrides default)
  --agents-dir <path>     Path to agents directory (optional)
  -o, --output <format>   Output format: clean, verbose, json (default: "clean")
  --list-agents           List available agents
  --list-tools            List available tools
  --json                  Output as JSON (shorthand for --output json)
  -h, --help              Display help
  -V, --version           Display version
```

**Actual implementation notes:**
- Console output is controlled by core (not CLI flag)
- If `--agents-dir` not specified, uses built-in default agent
- `--json` is shorthand for `--output json`

## Development Workflow

### Local Development

```bash
# From workspace root
npm run dev:cli -- -p "hello world"

# Or directly
tsx packages/cli/src/index.ts -p "test"
```

### Testing

```bash
# Build CLI package
npm run build:cli

# Link for local testing
cd packages/cli
npm link

# Now available globally
agent -p "test"

# Unlink when done
npm unlink -g @agent-system/cli
```

### Publishing

```bash
# Build all packages
npm run build

# Publish CLI package
cd packages/cli
npm publish --access public
```

## Configuration Discovery

The CLI searches for configuration in this order:

1. **Local config**: `./agent-config.json` in current directory
2. **Parent config**: `../agent-config.json`
3. **Home config**: `~/.agent-config.json`
4. **Environment variables**: `AGENT_MODEL`, `ANTHROPIC_API_KEY`, etc.

**Example agent-config.json:**
```json
{
  "agents": {
    "directory": "./agents",
    "default": "default"
  },
  "tools": {
    "builtin": ["read", "write", "list", "grep", "delegate"],
    "custom": ["./tools"]
  },
  "llm": {
    "model": "anthropic/claude-3-5-haiku-latest",
    "behavior": "balanced"
  },
  "safety": {
    "maxIterations": 20,
    "maxDepth": 5
  },
  "storage": {
    "type": "filesystem",
    "path": ".agent-sessions"
  }
}
```

## Output Formatting

### Default Mode (Clean)
```bash
$ agent -p "what is 2+2"
The answer is 4.
```

### Verbose Mode
```bash
$ agent -v -p "what is 2+2"
🤖 Loading agent: default
📂 Agents directory: ./agents
🔧 Available tools: Read, Write, List, Grep, Delegate
💬 Prompt: what is 2+2
⚡ Executing...

Iteration 1:
  → No tool calls
  ✓ Response: The answer is 4.

✅ Complete (1 iteration, 0.8s)
Result: The answer is 4.
```

### JSON Mode
```bash
$ agent --json -p "what is 2+2"
{
  "success": true,
  "result": "The answer is 4.",
  "iterations": 1,
  "duration": 812,
  "model": "claude-3-5-haiku-latest"
}
```

## Error Handling

```bash
# Missing API key
$ agent -p "test"
❌ Error: ANTHROPIC_API_KEY not set
Set it via: export ANTHROPIC_API_KEY=your-key

# No agents found
$ agent -p "test"
⚠️  No agents directory found at ./agents
Create one with: mkdir agents
Or specify path in agent-config.json

# Agent not found
$ agent -a analyzer -p "test"
❌ Error: Agent 'analyzer' not found
Available agents: default, researcher, code-reviewer
```

## Benefits

- **Zero setup**: Just create `agents/` folder
- **Workspace-aware**: Imports from `@agent-system/core`
- **Familiar CLI**: Intuitive command-line interface
- **Portable**: Can run from any directory
- **Discoverable**: `--list-agents` and `--list-tools` help explore
- **Simple**: No TypeScript knowledge needed to use
- **Publishable**: Can be installed globally via npm

## Installation Options

### Global Installation
```bash
npm install -g @agent-system/cli
agent -p "hello"
```

### Local in Project
```bash
npm install --save-dev @agent-system/cli
npx agent -p "hello"
```

### Development
```bash
# From workspace root
git clone https://github.com/nielspeter/agent-orchestration-system
cd agent-orchestration-system
npm install
npm run build:cli
npm link packages/cli
```

## Future Enhancements

1. **Interactive mode**: `agent -i` for REPL-like interaction
2. **Pipe support**: `echo "text" | agent -a analyzer`
3. **Init command**: `agent init` to create starter project
4. **Tool scaffolding**: `agent create-tool my-tool`
5. **Agent templates**: `agent create-agent my-agent --template researcher`
6. **Session management**: `agent resume <session-id>`
7. **Watch mode**: `agent watch -a validator` for continuous validation
8. **Configuration wizard**: `agent config` interactive setup

## Implementation Priority

### Phase 1: MVP (1-2 days)
- Basic CLI with prompt execution
- Agent discovery
- Simple output formatting

### Phase 2: Polish (1 day)
- Verbose mode
- Error handling
- List commands

### Phase 3: Advanced (2-3 days)
- JSON output
- Configuration file support
- Tool discovery
- Session management

### Phase 4: Publishing (1 day)
- Documentation
- npm package setup
- GitHub Actions for publishing

## Testing Strategy

```typescript
// packages/cli/tests/discovery.test.ts
describe('Agent Discovery', () => {
  it('finds agents in current directory', async () => {
    const dir = await discoverAgents('/path/to/project');
    expect(dir).toBe('/path/to/project/agents');
  });

  it('falls back to parent directory', async () => {
    const dir = await discoverAgents('/path/to/project/subdir');
    expect(dir).toBe('/path/to/project/agents');
  });

  it('respects agent-config.json', async () => {
    // Test config file override
  });
});
```

## Workspace Integration

The CLI package benefits from the workspace:

- **Shared dependencies**: TypeScript, testing tools
- **Cross-package references**: Uses `@agent-system/core`
- **Unified build**: `npm run build` builds all packages
- **Consistent tooling**: Same ESLint, Prettier config

## Architecture Diagram

```mermaid
graph TD
    User[User runs agent CLI] --> CLI[CLI Package]
    CLI --> Discovery[Discovery Logic]
    Discovery --> AgentDir[Find agents directory]
    Discovery --> Config[Read agent-config.json]
    CLI --> Core[Import from core package]
    Core --> Builder[AgentSystemBuilder]
    Builder --> Executor[Execute Agent]
    Executor --> Output[Format and Display Result]
    Output --> User
```

## Testing Results (✅ Verified)

The following commands were tested and verified working:

```bash
# Default agent execution (no agents directory needed)
npm run cli -- -p "What is 2+2? Just return the number."
# Result: "4"

# List default agent
npm run cli -- --list-agents
# Result: "default"

# List tools in JSON format
npm run cli -- --list-tools --json
# Result: JSON array of all tools

# Use custom agents directory
npm run cli -- --agents-dir packages/core/examples/quickstart/agents --list-agents
# Result: "default", "orchestrator"

# Execute custom agent
npm run cli -- --agents-dir packages/core/examples/quickstart/agents -a orchestrator -p "What tools do you have?"
# Result: Lists all 7 available tools

# JSON output format
npm run cli -- -p "Calculate 5 * 7" --json
# Result: JSON with result, agent, duration, metrics
```

**All features verified:**
- ✅ Default agent execution (no setup needed)
- ✅ Custom agents directory via `--agents-dir`
- ✅ Agent listing (`--list-agents`)
- ✅ Tool listing (`--list-tools`)
- ✅ JSON output format
- ✅ Clean output format (default)
- ✅ Proper error handling
- ✅ Cleanup on completion

## Notes

- **Key insight**: No discovery logic needed! The core's `AgentSystemBuilder` already handles all agent loading and validation
- CLI is truly just a thin wrapper: parse args → configure builder → execute → format output
- This replaces the old single-package approach with workspace-aware design
- The CLI can be published independently of core library
- Users can `npm install -g @agent-system/cli` without full workspace
- Development happens within the monorepo for convenience
- Publishing workflow allows separate versioning of CLI vs core
