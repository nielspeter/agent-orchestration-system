# @agent-system/cli

Command-line interface utilities for the Agent Orchestration System.

## Features

### Output Formatting

The `output.ts` module provides flexible formatting utilities for displaying execution results in different modes:

- **Clean Mode**: Just the result text (ideal for piping to other commands)
- **Verbose Mode**: Detailed output with agent info, metrics, tool calls, and timing
- **JSON Mode**: Structured JSON output for programmatic consumption

#### Usage

```typescript
import { formatOutput } from '@agent-system/cli/output';

const result: ExecutionResult = {
  result: 'Task completed',
  agentName: 'orchestrator',
  sessionId: 'session-123',
  duration: 1500,
  events: [...], // Optional session events
};

// Clean output (default)
console.log(formatOutput(result, 'clean'));
// Output: Task completed

// Verbose output with metadata
console.log(formatOutput(result, 'verbose'));
// Output:
// ═══════════════════════════════════════════
// Agent Execution Result
// ═══════════════════════════════════════════
//
// Agent: orchestrator
// Session: session-123
// Duration: 1.50s
// ...

// JSON output
console.log(formatOutput(result, 'json'));
// Output: {"result":"Task completed","agent":"orchestrator",...}
```

#### Error Formatting

```typescript
import { formatError } from '@agent-system/cli/output';

try {
  // ... some operation
} catch (error) {
  console.error(formatError(error, 'verbose'));
}
```

#### Utility Messages

```typescript
import { formatSuccess, formatWarning, formatInfo } from '@agent-system/cli/output';

console.log(formatSuccess('Build completed'));
console.log(formatWarning('Deprecated feature used'));
console.log(formatInfo('Loaded 5 agents'));
```

### Color Support

The output utilities automatically detect terminal capabilities:

- Colors are enabled by default in TTY environments
- Set `NO_COLOR=1` environment variable to disable colors
- Set `FORCE_COLOR=1` to force colors even in non-TTY environments
- Respects `TERM=dumb` for compatibility

## Examples

Run the example to see all formatting modes:

```bash
npx tsx packages/cli/src/output.example.ts
```

## API Reference

### Types

```typescript
type OutputFormat = 'clean' | 'verbose' | 'json';

interface ExecutionResult {
  result: string;
  agentName: string;
  sessionId?: string;
  duration?: number;
  events?: AnySessionEvent[];
  metadata?: {
    totalTokens?: number;
    totalCost?: number;
    iterations?: number;
    toolCalls?: number;
  };
}
```

### Functions

#### `formatOutput(execution: ExecutionResult, format?: OutputFormat): string`

Formats an execution result in the specified mode.

- **execution**: The execution result to format
- **format**: Output format ('clean', 'verbose', or 'json'). Defaults to 'clean'.
- **Returns**: Formatted string

#### `formatError(error: Error | string, format?: OutputFormat): string`

Formats an error for display.

- **error**: Error object or string
- **format**: Output format. Defaults to 'clean'.
- **Returns**: Formatted error message

#### `formatSuccess(message: string): string`

Formats a success message with a checkmark icon.

#### `formatWarning(message: string): string`

Formats a warning message with a warning icon.

#### `formatInfo(message: string): string`

Formats an info message with an info icon.

## Development

### Testing

```bash
npm test -w @agent-system/cli
```

### Building

```bash
npm run build -w @agent-system/cli
```

## License

MIT
