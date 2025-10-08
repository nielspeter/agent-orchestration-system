# Workspace Structure

This is an npm workspace monorepo containing the agent orchestration system.

## Packages

### `@agent-system/core` (packages/core/)

The core agent orchestration system - can be used as a library or CLI tool.

**Exports**:
- `AgentSystemBuilder` - Main entry point for building agent systems
- `EventLogger` - Event emission and logging
- `AgentExecutor` - Agent execution engine
- Types: `Agent`, `Message`, `BaseTool`, etc.

**Usage**:
```typescript
import { AgentSystemBuilder } from '@agent-system/core';
import { EventLogger } from '@agent-system/core/events';
```

### `@agent-system/web` (packages/web/)

Web UI with real-time event streaming via Server-Sent Events (SSE).

**Components**:
- **Server** (port 3001): Express server with SSE endpoint
- **Client** (port 3000): React + Vite UI

**Features**:
- Start agent execution from browser
- Real-time event streaming with EventSource
- Visual timeline of all events
- Connection status monitoring

## Development

### Install Dependencies
```bash
npm install
```

### Run Core Examples
```bash
# All existing examples still work from root
npm run example:quickstart
npm run example:orchestration
npm run example:werewolf
```

### Run Web UI
```bash
# Start both server and client
npm run dev -w @agent-system/web

# Or individually
npm run dev:server -w @agent-system/web  # Port 3001
npm run dev:client -w @agent-system/web  # Port 3000
```

### Build Everything
```bash
npm run build --workspaces
```

### Run Tests
```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# All tests
npm run test:all
```

## Migration Status

✅ **Phase 1**: Workspace structure created
✅ **Phase 2**: Web UI skeleton with SSE
⏳ **Phase 3**: Move core code to packages/core/ (gradual)
⏳ **Phase 4**: Publish @agent-system/core to npm (optional)

## Current State

**Root level**:
- All existing code still works
- All scripts still work
- All examples still work
- Tests still run

**New workspace packages**:
- `packages/core/` - Re-exports from root src/ (thin wrapper for now)
- `packages/web/` - New web UI with SSE endpoint

## Why Workspace?

1. **Separation**: Core library vs. web application
2. **Reusability**: Core can be published to npm
3. **Development**: Both packages share dependencies
4. **Future**: Easy to add more packages (CLI, docs, etc.)

## Next Steps

1. **Test the web UI**: Start the dev server and verify SSE works
2. **Gradually migrate**: Move src/ to packages/core/src/ when ready
3. **Enhance web UI**: Add authentication, agent management, etc.
4. **Optional**: Publish @agent-system/core to npm registry
