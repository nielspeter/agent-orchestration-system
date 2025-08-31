# Documentation Plan for Agent Orchestration System

## Overview
This plan outlines the documentation needed to explain the inner workings of the agent orchestration system. Each document will provide deep technical insights into specific components.

## Core Architecture Documentation

### 1. `middleware-architecture.md` ⭐ Priority: HIGH
**Purpose**: Explain the middleware pipeline pattern that powers the entire system
- How middleware chain of responsibility works
- Execution flow through the pipeline
- Context passing between middleware
- Error propagation and handling
- Code examples of each middleware function
- How to create custom middleware

**Key files to document**:
- `src/middleware/pipeline.ts`
- `src/middleware/middleware-types.ts`
- All individual middleware files

### 2. `tool-system.md` ⭐ Priority: HIGH
**Purpose**: Comprehensive guide to the tool system
- Tool interface and types
- Tool registry architecture
- Tool execution flow
- Built-in tools (Read, Write, List, Task, TodoWrite)
- How tools integrate with agents
- Creating custom tools
- Tool safety and sandboxing

**Key files to document**:
- `src/tools/types.ts`
- `src/tools/tool-registry.ts`
- `src/core/tool-executor.ts`
- `src/services/tool-executor.ts`

### 3. `agent-system.md` ⭐ Priority: HIGH
**Purpose**: How agents work from markdown to execution
- Agent loading from markdown files
- YAML frontmatter configuration
- Agent context and memory
- Agent delegation mechanism
- Agent lifecycle
- Agent autonomy principles

**Key files to document**:
- `src/core/agent-loader.ts`
- `src/core/agent-executor.ts`
- `src/middleware/agent-loader.middleware.ts`

### 4. `safety-mechanisms.md` ⭐ Priority: MEDIUM
**Purpose**: System safety and resource management
- Iteration limits and how they work
- Depth limits for delegation chains
- Token estimation and management
- Safety config options
- Preventing infinite loops
- Error boundaries

**Key files to document**:
- `src/middleware/safety-checks.middleware.ts`
- `src/config/types.ts` (SafetyConfig)
- Token estimation logic

### 5. `logging-debugging.md` ⭐ Priority: MEDIUM
**Purpose**: Understanding system observability
- JSONL conversation format
- Log entry types and structure
- Session management
- Debugging techniques
- Performance metrics
- Cache metrics collection

**Key files to document**:
- `src/core/jsonl-logger.ts`
- `src/core/conversation-logger.ts`
- `src/core/cache-metrics-collector.ts`

### 6. `llm-integration.md` ⭐ Priority: MEDIUM
**Purpose**: LLM provider abstraction and caching
- Anthropic provider implementation
- Ephemeral caching strategy
- Cache metrics and efficiency
- Token counting
- Error handling and retries
- Provider abstraction for future providers

**Key files to document**:
- `src/llm/anthropic-provider.ts`
- `src/llm/types.ts`
- Caching implementation details

## Developer Guides

### 7. `developer-guides.md` ⭐ Priority: HIGH
**Purpose**: Practical guides for extending the system
- How to create a new agent (step-by-step)
- How to create a new tool
- How to add custom middleware
- How to integrate MCP servers
- Testing strategies
- Performance optimization tips
- Common patterns and anti-patterns

### 8. `pull-architecture.md` ⭐ Priority: LOW
**Purpose**: Deep dive into pull vs push architecture
- Why pull architecture
- Comparison with traditional approaches
- Benefits for agent systems
- Cache efficiency analysis
- Real-world examples

## API Reference

### 9. `api-reference.md` ⭐ Priority: LOW
**Purpose**: Complete API documentation
- AgentSystemBuilder API
- Middleware interfaces
- Tool interfaces
- Type definitions
- Configuration options

## Implementation Order

1. **Phase 1 - Core Components** (Essential for understanding)
   - middleware-architecture.md
   - tool-system.md
   - agent-system.md

2. **Phase 2 - Practical Guides** (For users/developers)
   - developer-guides.md
   - safety-mechanisms.md

3. **Phase 3 - Deep Dives** (Advanced topics)
   - logging-debugging.md
   - llm-integration.md
   - pull-architecture.md
   - api-reference.md

## Documentation Style Guidelines

Each document should include:
1. **Overview** - What the component does and why it exists
2. **Architecture** - Technical design with diagrams where helpful
3. **Code Examples** - Real code from the system
4. **Usage** - How to use the component
5. **Extension** - How to extend/customize
6. **Troubleshooting** - Common issues and solutions
7. **Related Files** - Links to source code

## Notes

- Keep examples practical and from actual code
- Use sequence diagrams for complex flows
- Include type definitions inline
- Reference actual file paths
- This is MVP/POC documentation - be pragmatic, not exhaustive