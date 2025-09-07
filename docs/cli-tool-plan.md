# Agent CLI Tool Plan (DRAFT - Not Yet Implemented)

> **Note**: This document describes a planned feature that has not been implemented yet. The CLI tool described here is a proposal for future development.

## Goal
Create a CLI tool that allows running agents from any directory without writing TypeScript setup code.

## Usage Examples
```bash
# From examples/script-tools/ folder:
agent -p "multiply 7 and 6"                    # Uses default agent
agent -a text-analyzer -p "analyze this text"  # Uses specific agent
agent --list-agents                            # Shows available agents
agent --list-tools                             # Shows available tools
```

## Architecture

### 1. CLI Entry Point (`src/cli/agent.ts`)
- Parse command-line arguments
- Auto-discover agents/ and tools/ from current directory
- Build system configuration
- Execute agent with prompt
- Display results

### 2. Binary Configuration
- Add `bin` field to package.json
- Make it executable with `npx agent` or `npm link` for global use
- Support shebang for direct execution

### 3. Auto-Discovery Logic
```typescript
// Automatically find in current working directory:
const cwd = process.cwd();
const agentsDir = path.join(cwd, 'agents');
const toolsDir = path.join(cwd, 'tools');

// Build system with discovered paths
const builder = AgentSystemBuilder.minimal()
  .withAgentsFrom(agentsDir)  // if exists
  .withToolsFrom(toolsDir)    // if exists
  .withBuiltinTools('shell', 'read', 'write');
```

### 4. Command-Line Arguments
```
Options:
  -p, --prompt <text>     The prompt to send to the agent
  -a, --agent <name>      Agent to use (default: "default")
  -m, --model <model>     Model to use (default: from config)
  -v, --verbose           Show detailed execution logs
  --list-agents           List available agents
  --list-tools            List available tools
  --help                  Show help
```

## Implementation Steps

### 1. Create CLI script (`src/cli/agent.ts`)
- Use commander.js or minimist for arg parsing
- Auto-discover local agents/tools folders
- Build and execute agent system

### 2. Update package.json
```json
"bin": {
  "agent": "./dist/cli/agent.js"
}
```

### 3. Make it work with tsx for development
```json
"bin": {
  "agent-dev": "tsx src/cli/agent.ts"
}
```

### 4. Add convenience scripts
```json
"scripts": {
  "cli:build": "tsc src/cli/agent.ts",
  "cli:link": "npm link",
  "cli:test": "tsx src/cli/agent.ts -p 'test'"
}
```

## Benefits
- **Zero setup**: Just create agents/ and tools/ folders
- **Familiar CLI**: Intuitive command-line interface
- **Portable**: Can run from any directory
- **Discoverable**: --list-agents and --list-tools help explore
- **Simple**: No TypeScript knowledge needed to use

## Testing
From `examples/script-tools/`:
```bash
# These should all work:
npx agent -p "count words in 'hello world'"
npx agent -a text-analyzer -p "analyze this"
npx agent --list-tools  # Shows word_counter, math_calculator, system_info
```

## Implementation Details

### Directory Structure Discovery
The CLI will search for the following in order:
1. Current working directory for `agents/` and `tools/`
2. Parent directory (useful when in subdirectories)
3. Look for `.agentrc` or `agent.config.json` for explicit paths

### Configuration File (Optional)
`.agentrc` or `agent.config.json` in the directory:
```json
{
  "model": "claude-3-5-haiku-latest",
  "agents": ["./agents", "../shared-agents"],
  "tools": ["./tools", "../shared-tools"],
  "builtinTools": ["read", "write", "shell", "task"],
  "safety": {
    "maxIterations": 20,
    "maxDepth": 5
  }
}
```

### Error Handling
- Clear error messages when no agents/tools found
- Suggest creating folders or using --help
- Handle API key missing with helpful message

### Output Formatting
- Default: Clean output of agent result only
- Verbose: Show execution steps, tool calls, etc.
- JSON: Option to output as JSON for piping

### Global Installation
```bash
# Install globally
npm install -g agent-orchestration-system

# Now usable anywhere
agent -p "hello world"
```

### Local Development Mode
```bash
# From agent-orchestration-system root
npm link

# Now in any directory
agent -p "test"
```

## Future Enhancements
1. **Interactive mode**: `agent -i` for REPL-like interaction
2. **Pipe support**: `echo "text" | agent -a analyzer`
3. **Config templates**: `agent init` to create starter folders
4. **Tool scaffolding**: `agent create-tool my-tool --lang python`
5. **Agent templates**: `agent create-agent my-agent`