# Logging System Refactoring Plan

## Overview
Simplify the logging system by removing redundant JSONL logging and making logger configuration explicit.

## Current Problems
1. **Redundant JSONL logging**: Both JsonlLogger and EventLogger write JSONL files
   - EventLogger → `.agent-sessions/{sessionId}/events.jsonl` (session persistence)
   - JsonlLogger → `logs/{timestamp}-{sessionId}.jsonl` (debug logging)
   
2. **NoOpStorage waste**: Creates events that go nowhere when disabled
   - Should use InMemoryStorage when persistence not needed
   - System still needs storage for SessionManager to function
3. **Complex configuration**: Too many nested options for simple needs
4. **Unclear separation**: EventLogger (session persistence) mixed with logging concerns

## New Architecture

### Logger Types
```typescript
AgentLogger (interface)
├── EventLogger      // Session persistence (writes to storage)
├── ConsoleLogger    // Human feedback (writes to stdout)
├── CompositeLogger  // Combines multiple loggers
└── NoOpLogger       // Silent mode (no output)
```

### Files to Remove
- `src/logging/jsonl.logger.ts` - Redundant, replaced by EventLogger
- `src/session/noop.storage.ts` - Replaced by InMemoryStorage for non-persistent cases
- All imports and references to these files

### Storage Strategy
- **When event logging enabled**: Use configured storage (filesystem/memory)
- **When event logging disabled**: Use InMemoryStorage (system works without persistence)
- **Storage is always needed**: SessionManager and tools require it

### New Configuration Structure

#### Before (complex):
```typescript
export interface LoggingConfig {
  display: 'console' | 'jsonl' | 'both' | 'none';
  jsonl: {
    enabled: boolean;
    path: string;
    filename?: string;
  };
  console: {
    timestamps: boolean;
    colors: boolean;
    verbosity: ConsoleVerbosity;
  };
}
```

#### After (simple):
```typescript
// No more LoggingConfig! Console is top-level:
export interface SystemConfig {
  // ... other config ...
  storage?: StorageConfig;
  console?: boolean | ConsoleConfig;  // Top-level, no wrapper
}

export interface ConsoleConfig {
  verbosity?: 'minimal' | 'normal' | 'verbose';  // Default: 'normal'
  // enabled is implicit - if ConsoleConfig exists, it's enabled
}

// EventLogger is implicit from storage config:
export interface StorageConfig {
  type: 'memory' | 'filesystem';
  path?: string;  // For filesystem
}
```

### Configuration Examples
```json
// Development - filesystem storage + verbose console
{
  "storage": { "type": "filesystem" },
  "console": { "verbosity": "verbose" }
}

// Production - filesystem storage, no console
{
  "storage": { "type": "filesystem" }
  // console defaults to false
}

// Testing - normal console output (memory storage is default)
{
  "console": true
  // storage defaults to memory, verbosity defaults to normal
}

// Debugging - minimal console to reduce noise
{
  "console": { "verbosity": "minimal" }
}

// Silent - empty config (all defaults)
{}
// storage defaults to memory, console defaults to false
```

### Defaults
- `storage.type`: "memory" (no persistence, no config needed)
- `console`: false (silent by default)
- `console.verbosity`: "normal" (when console is enabled)

### Key Insight
**EventLogger is implicit**: If you configure filesystem storage, you want event persistence. No need to specify it twice!

## Implementation Steps

### 1. Update Type Definitions
File: `src/logging/types.ts`
```typescript
// Remove LoggingDisplay type
// Remove entire LoggingConfig interface (no longer needed!)

// Add simple console config:
export interface ConsoleConfig {
  verbosity?: 'minimal' | 'normal' | 'verbose';
}

// Keep existing:
export type ConsoleVerbosity = 'minimal' | 'normal' | 'verbose';
```

File: `src/config/types.ts`
```typescript
export interface SystemConfig {
  // ... existing fields ...
  console?: boolean | ConsoleConfig;  // Add top-level console
  // Remove logging field entirely
}
```

### 2. Update Builder API
File: `src/config/system-builder.ts`

#### Update/Add methods:
```typescript
// Remove withLogging() method entirely

// Add simple console method
withConsole(config: boolean | ConsoleConfig = true): AgentSystemBuilder {
  return this.with({ console: config });
}

// Storage configuration (implies event logging when filesystem)
withStorage(type: 'memory' | 'filesystem', path?: string): AgentSystemBuilder {
  return this.with({
    storage: { type, path }
  });
}
```

#### Update defaults:
```typescript
// default() - Development
storage: { type: 'filesystem' },  // Implies event logging
console: true  // Enable console with normal verbosity

// minimal() - Silent  
// No config needed - uses all defaults (memory + no console)

// forTest() - Testing
console: true  // Just enable console, memory is default
```

### 3. Update createLoggerAndSessionManager
File: `src/config/system-builder.ts`

**Key Insight**: EventLogger is implicit based on storage type!

```typescript
private createLoggerAndSessionManager(
  config: ResolvedSystemConfig
): {
  logger: AgentLogger;
  sessionManager: SimpleSessionManager;
} {
  const loggers: AgentLogger[] = [];
  const sessionId = config.session.sessionId!;
  
  // Create storage based on config
  const storage = this.createStorage(config);
  
  // EventLogger is IMPLICIT based on storage type
  if (config.storage.type === 'filesystem') {
    // Filesystem storage implies we want event persistence
    const eventLogger = new EventLogger(storage, sessionId);
    loggers.push(eventLogger);
  }
  // If memory storage, no EventLogger (no point persisting to memory)
  
  // Always create session manager with the storage
  const sessionManager = new SimpleSessionManager(storage);
  
  // Console logger is EXPLICIT (now top-level)
  if (config.console) {
    // Handle both boolean and object config
    if (typeof config.console === 'boolean') {
      if (config.console) {
        const consoleLogger = new ConsoleLogger({
          verbosity: 'normal',
          timestamps: true,
          colors: true  // Auto-detect TTY
        });
        loggers.push(consoleLogger);
      }
    } else {
      // ConsoleConfig object - presence means enabled
      const consoleLogger = new ConsoleLogger({
        verbosity: config.console.verbosity || 'normal',
        timestamps: true,
        colors: true
      });
      loggers.push(consoleLogger);
    }
  }
  
  // Determine final logger
  const logger = loggers.length === 0 ? new NoOpLogger() :
                 loggers.length === 1 ? loggers[0] :
                 new CompositeLogger(loggers);
  
  return { logger, sessionManager };
}
```

### 4. Update Storage Configuration
File: `src/config/types.ts`

```typescript
export interface StorageConfig {
  type: 'memory' | 'filesystem';  // Remove 'noop'
  options?: {
    path?: string;
  };
}
```

Default storage when event logging is enabled:
- Use 'filesystem' with default path '.agent-sessions'
- Storage config only matters when 'event' is in loggers array

### 5. Update LoggerFactory
File: `src/logging/factory.ts`

Remove all JsonlLogger references and simplify to only handle ConsoleLogger creation.
Consider if we even need LoggerFactory anymore - might be simpler to create loggers directly.

### 6. Update Examples

#### Before:
```typescript
.withLogging({
  display: 'both',
  console: { timestamps: true, colors: true, verbosity: 'verbose' },
  jsonl: { enabled: true, path: './logs' }
})
```

#### After:
```typescript
.withConsole({ verbosity: 'verbose' })
.withStorage('filesystem')  // Implies event logging
```

Or simply:
```typescript
.withConsole(true)  // Normal verbosity
```

### 7. Update Tests
- Remove tests for JsonlLogger
- Remove tests for NoOpStorage  
- Update builder tests for new withLoggers() method
- Update config tests for new structure

## Migration Notes

### Breaking Changes
1. LoggingConfig structure completely changed
2. JsonlLogger removed - use EventLogger for persistence
3. NoOpStorage removed - use empty loggers array instead
4. withLogging() method signature changed

### For Users
- Old JSONL logs in `logs/` directory won't be created anymore
- Session events now only in `.agent-sessions/` directory
- Use `loggers: ['event']` to enable session persistence
- Use `loggers: ['console']` for terminal output only
- Use `loggers: []` for silent mode

## Important Considerations

### NoOpLogger Location
NoOpLogger is currently defined in LoggerFactory. Options:
1. Move to its own file `src/logging/noop.logger.ts`
2. Keep in factory but export it
3. Define inline where needed

### ConsoleLogger Defaults
ConsoleLogger currently accepts configuration. With new design:
- Use sensible defaults (timestamps: true, colors: auto-detect TTY, verbosity: normal)
- Could add optional advanced config later if needed

### Backwards Compatibility
**Decision: No backwards compatibility** - This is a breaking change
- Simpler to implement and maintain
- Cleaner codebase without legacy support
- Users must update their configs
- Provide clear migration guide in release notes

## Benefits
1. **Simpler**: One way to configure logging
2. **Clearer**: Explicit about what's being logged where
3. **Efficient**: No wasted cycles on NoOp operations
4. **Maintainable**: Less code, fewer concepts
5. **Flexible**: Easy to add new logger types in future
6. **Correct**: Storage always available for system operation

## Testing Plan
1. Build succeeds: `npm run build`
2. Lint passes: `npm run lint`
3. Unit tests pass: `npm test`
4. Examples work:
   - `npm run example:default-agent`
   - `npm run example:werewolf`
   - `npm run example:logging`
5. Verify console output appears when configured
6. Verify event files created when configured
7. Verify silent mode when loggers array is empty