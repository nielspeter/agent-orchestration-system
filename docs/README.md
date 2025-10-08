# Agent Orchestration System Documentation

## Overview

Comprehensive technical documentation for the Agent Orchestration POC - a TypeScript implementation of autonomous agent
systems using middleware pipeline architecture and pull-based information gathering.

## 📚 Documentation Structure

### Core Architecture

- **[Middleware Architecture](./middleware-architecture.md)** ⭐ - The foundation: how the middleware pipeline powers
  everything
- **[Tool System](./tool-system.md)** ⭐ - How agents interact with the environment through tools
- **[Agent System](./agent-system.md)** ⭐ - Understanding agents from markdown to execution
- **[Event System](./event-system.md)** ⭐ - Real-time event emission for monitoring and integration
- **[MCP Integration](./mcp-integration.md)** ⭐ - Model Context Protocol server integration for external tools

### Configuration & Setup

- **[Unified Configuration](./unified-configuration.md)** - System configuration using the builder pattern
- **[LLM Provider Integration](./llm-provider-integration.md)** ⭐ - Multi-provider setup, behavior presets, cost tracking
- **[Safety and Resource Management](./safety-and-resource-management.md)** ⭐ - Execution limits, security validation, resource controls
- **[Execution Flow Diagram](./execution-flow-diagram.md)** - Visual representation of system flow

### Web UI & Integration

- **[Web UI Event Architecture](./web-ui-event-architecture.md)** ⭐ - Why events enable web interfaces
- **[Web UI Integration Guide](./web-ui-integration.md)** ⭐ - Building on the event system (SSE, React, API)

### Debugging & Monitoring

- **[Logging and Debugging](./logging-and-debugging.md)** ⭐ - ConsoleLogger, SimpleTracer, debugging strategies

### Developer Resources

- **[Developer Guides](./developer-guides.md)** ⭐ - Practical guides for creating agents, tools, and middleware

## 🚀 Quick Navigation

### For New Users

1. Start with [Developer Guides](./developer-guides.md) - Quick start and basic concepts
2. Review [Agent System](./agent-system.md) - Understand how agents work
3. Explore [Tool System](./tool-system.md) - Learn about agent capabilities

### For Developers

1. Study [Middleware Architecture](./middleware-architecture.md) - Core system design
2. Read [Unified Configuration](./unified-configuration.md) - System setup options
3. Follow [Developer Guides](./developer-guides.md) - Create custom components

### For Contributors

1. Understand [Execution Flow](./execution-flow-diagram.md) - System internals
2. Study all architecture docs for deep understanding
3. Review existing docs for areas that need improvement

## 🎯 Key Concepts

### Pull Architecture

Agents don't receive full context from parents. Instead, they:

- Receive minimal task description (5-500 tokens)
- Use tools (Read, Grep, List) to gather needed information
- Maintain independent conversation context
- Benefit from Anthropic's cache efficiency (90% cost savings)

### Everything is an Agent

- No special orchestrator class
- All agents use the same middleware pipeline
- Agents can delegate to other agents via Delegate tool
- Agents are defined as markdown files with YAML frontmatter

### Middleware Pipeline Pattern

```
Request → ErrorHandler → AgentLoader → ContextSetup → ProviderSelection → SafetyChecks → LLMCall → ToolExecution → Response
```

Each middleware handles one concern, making the system modular and testable.

## 📖 Documentation Standards

### Code Examples

All documentation includes real code from the system, not simplified examples.

### File References

Each document references actual source files for deeper exploration.

### Practical Focus

This is MVP/POC documentation - pragmatic and focused on understanding and extending the system.

## 🔄 Living Documentation

This documentation evolves with the codebase. When making changes:

1. Update relevant documentation
2. Add examples for new features
3. Document breaking changes
4. Keep code examples current

## 📝 Document Status

| Document                  | Status     | Priority | Description                  |
|---------------------------|------------|----------|------------------------------|
| Middleware Architecture          | ✅ Complete | HIGH   | Core system design           |
| Tool System                      | ✅ Complete | HIGH   | Agent capabilities           |
| Agent System                     | ✅ Complete | HIGH   | Agent lifecycle and patterns |
| Event System                     | ✅ Complete | HIGH   | Real-time event emission     |
| Web UI Event Architecture        | ✅ Complete | HIGH   | Why events enable web UI     |
| Web UI Integration Guide         | ✅ Complete | HIGH   | SSE, React, API integration  |
| MCP Integration                  | ✅ Complete | HIGH   | External tool servers        |
| LLM Provider Integration         | ✅ Complete | HIGH   | Multi-provider, costs, presets |
| Logging & Debugging              | ✅ Complete | HIGH   | ConsoleLogger, SimpleTracer  |
| Safety & Resource Management     | ✅ Complete | HIGH   | Limits, security, resources  |
| Developer Guides                 | ✅ Complete | HIGH   | Practical tutorials          |
| Unified Configuration            | ✅ Complete | MEDIUM | System setup                 |
| Execution Flow                   | ✅ Complete | MEDIUM | Visual system flow           |

## 🤝 Contributing

To improve documentation:

1. Follow existing document structure
2. Include real code examples
3. Reference source files
4. Test all examples
5. Update this index when adding documents

## 🔗 Related Resources

- **Source Code**: `../src/`
- **Examples**: `../examples/`
- **Tests**: `../tests/`
- **Agents**: `../agents/`
- **Main README**: `../README.md`
- **Claude Guide**: `../CLAUDE.md`