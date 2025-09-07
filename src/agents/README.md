# Agents Module

## Overview
The agents module handles loading and executing agent definitions from markdown files. Agents are the core entities that process tasks using LLM providers and tools.

## Structure
- `executor.ts` - Main agent execution logic with middleware pipeline
- `loader.ts` - Loads agent definitions from markdown files with YAML frontmatter
- `types.ts` - Agent-specific types and interfaces

## Key Concepts
- **Agent Definition**: Configuration loaded from markdown files
- **Behavior Presets**: Pre-configured temperature/top_p settings
- **Execution Context**: Runtime state for agent execution

## Usage
```typescript
import { AgentExecutor, AgentLoader } from '@/agents';

const loader = new AgentLoader('./agents'); // Or any directory with your agent definitions
const executor = new AgentExecutor(/* ... */);
```