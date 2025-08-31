# Conversation Logger Documentation

## Overview

The `conversation-logger.ts` is a sophisticated logging system designed to capture and record detailed conversation interactions across different contexts. It provides flexible logging mechanisms for console, file, and combined logging with rich metadata support.

## Key Components

### Logging Interfaces

#### `LogEntry` Interface
Represents a comprehensive log entry with the following key properties:
- `timestamp`: Exact time of the log entry
- `agentName`: Name of the agent generating the log
- `depth`: Nesting level of the log entry
- `type`: Type of log entry (system, user, assistant, tool, delegation, result, error)
- `content`: Actual log message
- `metadata`: Extended information about the log entry

### Logger Types

1. **ConsoleLogger**
   - Outputs logs to the console with color-coded and icon-enhanced display
   - Supports colorful terminal output for different log types
   - Logs to both console and JSONL format
   - Features:
     - Color-coded output
     - Emoji icons for different log types
     - Truncates long content
     - Shows execution time

2. **FileLogger**
   - Logs exclusively to JSONL format
   - Designed for persistent storage of conversation logs
   - Converts log entries to a standardized JSONL event format

3. **CombinedLogger**
   - Integrates console and file logging
   - Uses ConsoleLogger as the primary logging mechanism

### Logger Factory

The `LoggerFactory` provides static methods to create different types of loggers:
- `createConsoleLogger()`: Creates a console-specific logger
- `createCombinedLogger()`: Creates a logger that logs to both console and file

## Usage Example

```typescript
// Create a console logger
const logger = LoggerFactory.createConsoleLogger();

// Log a user message
logger.log({
  timestamp: new Date().toISOString(),
  agentName: 'MainAgent',
  depth: 0,
  type: 'user',
  content: 'Hello, how are you?'
});

// Log a tool interaction
logger.log({
  timestamp: new Date().toISOString(),
  agentName: 'ToolAgent',
  depth: 1,
  type: 'tool',
  content: 'Executing search',
  metadata: {
    toolName: 'SearchTool'
  }
});
```

## Key Features

- Supports multiple log types
- Rich metadata tracking
- Color-coded console output
- JSONL format logging
- Flexible logging across different contexts
- Session and tool tracking
- Execution time logging

## Metadata Tracking

The logger captures extensive metadata including:
- Tool usage
- Agent delegation
- Execution times
- Token counts
- Model information
- Concurrent tool groups

## Best Practices

1. Always provide a timestamp
2. Include meaningful agent names
3. Use appropriate log types
4. Leverage metadata for comprehensive tracking
5. Use the LoggerFactory for logger creation

## Performance Considerations

- Logs are designed to be lightweight
- JSONL format allows for easy parsing and analysis
- Supports both real-time console and persistent file logging