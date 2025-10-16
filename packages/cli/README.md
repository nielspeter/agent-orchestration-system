# @agent-system/cli

Command-line interface for the Agent Orchestration System.

A production-ready CLI tool that provides Unix-friendly access to autonomous agents with stdin/stdout support, proper signal handling, and security features.

## Installation

```bash
# Install globally
npm install -g @agent-system/cli

# Or use from workspace
npm run cli
```

## Quick Start

```bash
# Run agents from command line
agent -p "Hello, world!"
echo "Analyze this text" | agent

# Start web UI server
agent serve --open

# List available resources
agent --list-agents
agent --list-tools
```

## Features

### 🌐 Dual Interface

- **CLI Mode**: Run agents from command line with stdin/stdout
- **Web UI Mode**: Start server with browser interface for interactive use
- **Unified Access**: Both modes use the same agent system

### 🔄 Unix-Friendly (CLI Mode)

- **stdin Support**: Accepts input via pipe or redirect
- **stdout/stderr Separation**: Clean output to stdout, errors to stderr
- **EPIPE Handling**: Gracefully handles broken pipes
- **Exit Codes**: Proper exit codes (0=success, 1=error, 130=SIGINT, 143=SIGTERM)
- **Color Detection**: Auto-disables colors when piped

### 🔒 Security & Reliability

- **Input Size Limit**: 10MB maximum stdin input
- **Timeout Protection**: 30-second timeout on stdin reads
- **Signal Handling**: Graceful cleanup on Ctrl+C (SIGINT) and SIGTERM
- **Resource Cleanup**: Always calls cleanup, even on errors or signals
- **Format Validation**: Runtime validation of output formats

### 📊 Output Modes (CLI Mode)

- **clean** (default): Just the result text - perfect for piping
- **verbose**: Detailed output with metrics, tool calls, and timing
- **json**: Structured JSON for programmatic consumption

## Usage

The CLI has two main commands: `run` (default) and `serve`.

### Run Command (Default)

Execute an agent task from the command line:

```
agent run [options]
agent [options]  # 'run' is the default command

Options:
  -p, --prompt <text>    The prompt to send to the agent (or pipe via stdin)
  -a, --agent <name>     Agent to use (default: "default")
  -m, --model <model>    Model to use
  --agents-dir <path>    Path to agents directory
  -o, --output <format>  Output format: clean, verbose, json (default: "clean")
  --list-agents          List available agents
  --list-tools           List available tools
  --json                 Output as JSON (shorthand for --output json)
  -h, --help             display help for command
```

### Serve Command

Start the web UI server:

```
agent serve [options]

Options:
  -p, --port <port>       Port number (default: 3000)
  --host <host>           Hostname (default: "localhost")
  -o, --open              Open browser automatically
  --agents-dir <path>     Path to agents directory
  -h, --help              display help for command
```

### Global Options

```
  -V, --version          output the version number
  -h, --help             display help for command
```

## Examples

### Web UI Server

```bash
# Start server with defaults (localhost:3000)
agent serve

# Custom port and host
agent serve --port 8080 --host 0.0.0.0

# Auto-open browser
agent serve --open

# Specify custom agents directory
agent serve --agents-dir ./my-agents

# Run from anywhere with custom agents
agent serve --agents-dir /path/to/agents --open

# Or use from workspace
npm run cli:serve
```

### Basic Execution

```bash
# Direct prompt
agent -p "What is 2+2?"

# Output: 4
```

### stdin Input

```bash
# From echo
echo "Explain recursion" | agent

# From file
agent < input.txt

# From command output
git diff | agent -p "Review these changes"

# Pipeline chains
cat *.md | agent -p "Summarize" | agent -p "Create a tweet"
```

### Output Formats

```bash
# Clean output (default) - just the answer
agent -p "Say hello"
# Output: Hello!

# Verbose output - with metrics
agent -p "Say hello" --output verbose
# Output:
# ═══════════════════════════════════════════
# Agent Execution Result
# ═══════════════════════════════════════════
#
# Agent: default
# Duration: 1.23s
#
# Execution Metrics
#   Iterations: 1
#   Tool Calls: 0
#   Total Tokens: 156
#   Total Cost: $0.0012
#
# Result
#
# Hello!
# ═══════════════════════════════════════════

# JSON output - for scripts
agent -p "List 3 colors" --json
# Output:
# {
#   "result": "Red\nGreen\nBlue",
#   "agent": "default",
#   "duration": 1230,
#   "metrics": {
#     "iterations": 1,
#     "toolCalls": 0,
#     "totalTokens": 156,
#     "totalCost": 0.0012
#   }
# }
```

### Custom Agents

```bash
# Use specific agent
agent -p "Review this code" -a code-reviewer

# Load agents from custom directory
agent -p "Hello" --agents-dir ./my-agents
```

### Model Selection

```bash
# Use specific model
agent -p "Test" -m "anthropic/claude-3-5-haiku-latest"

# Use different provider
agent -p "Test" -m "openrouter/gpt-4-turbo"
```

### Listing

```bash
# List available agents
agent --list-agents
# Output:
# Available agents:
#   - default
#   - code-reviewer
#   - summarizer

# List with JSON
agent --list-agents --json
# Output: {"agents":["default","code-reviewer","summarizer"]}

# List available tools
agent --list-tools
# Output:
# Available tools:
#   - read
#   - write
#   - list
#   - grep
#   - delegate
```

### Unix Patterns

```bash
# Redirect output
agent -p "Generate UUID" > output.txt

# Redirect errors
agent -p "Test" 2> errors.log

# Both
agent -p "Test" > output.txt 2> errors.log

# Pipe to other commands
agent -p "List files in src/" | grep ".ts$"

# Use in conditions
if agent -p "Is 5 > 3?" | grep -q "yes"; then
  echo "Correct!"
fi

# Use in scripts
result=$(agent -p "Calculate 10 * 5")
echo "Result: $result"

# Disable colors for logging
NO_COLOR=1 agent -p "Test" >> log.txt
```

## Security Features

### Input Validation

- **Maximum stdin size**: 10MB (prevents memory exhaustion attacks)
- **Read timeout**: 30 seconds (prevents infinite hangs)
- **Format validation**: Invalid output formats fall back to 'clean'

```bash
# This will timeout after 30s
cat /dev/random | agent

# This will reject input > 10MB
cat huge-file.bin | agent
# Error: stdin input exceeds maximum size of 10MB
```

### Signal Handling

The CLI handles termination signals gracefully:

```bash
# Press Ctrl+C during execution
agent -p "Long running task"
^C
# Output: Received SIGINT, cleaning up...
# Exit code: 130
```

Signals:
- **SIGINT (Ctrl+C)**: Calls cleanup(), exits with code 130
- **SIGTERM**: Calls cleanup(), exits with code 143
- **Second signal**: Force exits immediately

### Resource Cleanup

Resources are always cleaned up:
- ✅ On successful completion
- ✅ On errors/exceptions
- ✅ On signals (SIGINT, SIGTERM)
- ✅ On broken pipes (EPIPE)

## Environment Variables

```bash
# API Keys (at least one required)
ANTHROPIC_API_KEY=your-key-here
OPENROUTER_API_KEY=your-key-here

# Optional configuration
NO_COLOR=1                    # Disable colors
FORCE_COLOR=1                 # Force colors even when piped
TERM=dumb                     # Disable colors
DISABLE_PROMPT_CACHING=true   # Disable Anthropic caching
```

## Exit Codes

The CLI uses standard Unix exit codes:

| Code | Meaning | Example |
|------|---------|---------|
| 0 | Success | Command completed successfully |
| 1 | Error | Invalid arguments, execution failure |
| 130 | SIGINT | User pressed Ctrl+C |
| 143 | SIGTERM | Process terminated (e.g., `kill`) |

## Error Handling

Errors are formatted according to the output mode:

```bash
# Clean mode (default)
agent -p "test" -m "invalid-model"
# Error: Unknown model: invalid-model

# Verbose mode
agent -p "test" -m "invalid-model" --output verbose
# ═══════════════════════════════════════════
# ERROR
# ═══════════════════════════════════════════
#
# Unknown model: invalid-model
#
# Stack trace:
# ...

# JSON mode
agent -p "test" -m "invalid-model" --json
# {"error":"Unknown model: invalid-model","stack":"..."}
```

## Programmatic Usage

### Output Formatting API

The CLI also exports output formatting utilities for use in other TypeScript projects:

```typescript
import { formatOutput, formatError, type OutputFormat } from '@agent-system/cli';

const result: ExecutionResult = {
  result: 'Task completed',
  agentName: 'default',
  duration: 1500,
};

// Format output
console.log(formatOutput(result, 'verbose'));

// Format errors
try {
  // ... operation
} catch (error) {
  console.error(formatError(error, 'json'));
}
```

See [output.ts](./src/output.ts) for full API documentation.

## Development

### Building

```bash
# Build CLI package
npm run build -w @agent-system/cli

# Build from root
npm run build:cli
```

### Testing

```bash
# Run tests
npm test -w @agent-system/cli

# With coverage
npm run test:coverage -w @agent-system/cli
```

### Linting

```bash
# Lint CLI code
npx eslint packages/cli/src/*.ts

# Auto-fix issues
npx eslint --fix packages/cli/src/*.ts
```

## Troubleshooting

### Command not found

```bash
# Ensure it's built
npm run build:cli

# Use via npx
npx tsx packages/cli/src/index.ts -p "test"

# Or use npm script
npm run cli -- -p "test"
```

### EPIPE errors

If you see EPIPE errors, it means the receiving process closed its stdin. This is normal Unix behavior:

```bash
# head closes stdin after 1 line
agent -p "List 10 items" | head -1
# No error - gracefully handles EPIPE
```

### Timeout errors

If stdin reading times out:

```bash
# This will timeout after 30s
cat /dev/zero | agent
# Error: stdin read timeout after 30s
```

Solution: Provide a finite input stream or use `-p` flag instead.

### Memory errors

If input exceeds 10MB:

```bash
# This will be rejected
cat huge-file.bin | agent
# Error: stdin input exceeds maximum size of 10MB
```

Solution: Process the file in chunks or use the file path with the `read` tool.

## Contributing

This is an MVP/POC project. Contributions welcome!

1. Follow existing code style
2. Add tests for new features
3. Update documentation
4. Ensure all tests and linting pass

## License

MIT
