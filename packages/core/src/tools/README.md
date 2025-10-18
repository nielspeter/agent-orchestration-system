# Tools Module

## Overview

The tools module provides the tool infrastructure and implementations that
agents use to interact with the system.

## Structure

### Registry (`/registry`)

- `registry.ts` - Tool registration and management
- `loader.ts` - Dynamic tool loading from files
- `executor.ts` - Tool execution logic
- `executor-service.ts` - Advanced execution with concurrency control

### Built-in Tools

- `file.tool.ts` - File operations (Read, Write, List)
- `grep.tool.ts` - Search functionality
- `shell.tool.ts` - Shell command execution
- `task.tool.ts` - Agent delegation
- `todowrite.tool.ts` - Todo management
- `get-session-log.tool.ts` - Session log retrieval

## Key Concepts

- **Tool Registry**: Central registration for all available tools
- **Concurrency Safety**: Tools declare if they can run in parallel
- **Tool Schema**: Structured parameter definitions

## Usage

```typescript
import { ToolRegistry, createReadTool } from '@/tools';

const registry = new ToolRegistry();
const readTool = createReadTool();
registry.register(readTool);
```
