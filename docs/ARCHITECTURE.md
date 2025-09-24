# Architecture

## Core Philosophy: Functional Agents

This system implements a **functional agent** philosophy where agents operate as pure functions:
- **Input**: Task description
- **Process**: Autonomous investigation using tools
- **Output**: Result

Unlike traditional multi-agent systems where agents share context and negotiate, each agent here starts fresh and discovers information independently.

## Design Principles

### 1. Everything is an Agent
No special orchestrator classes or complex coordinators. All agents use the same interface and pipeline:

```typescript
await executor.execute('orchestrator', 'complex task');
await executor.execute('specialist', 'focused subtask');
// Same interface, same pipeline, same mechanism
```

### 2. Pull Architecture
Agents don't inherit context from parents. They must actively gather information using tools:

```typescript
// Traditional: Share everything
agentB.execute(task, sharedContext);

// This system: Independent investigation
agentB.execute(task); // Must discover via tools
```

**Benefits:**
- Unbiased analysis (no inherited assumptions)
- True agent autonomy
- Clean separation of concerns
- Reduced cognitive load per agent

**Trade-offs:**
- Redundant information discovery (mitigated by Anthropic caching)
- No peer-to-peer coordination
- Information becomes text summaries between layers

### 3. Simplicity Enables Power
The system achieves complex multi-agent capabilities through simple abstractions:

- **Agent definition**: Markdown + YAML frontmatter
- **Tool interface**: 5 methods
- **Middleware**: Simple `(ctx, next) => {}` functions
- **Delegation**: One tool (`Delegate`) handles all orchestration

## System Architecture

### Middleware Pipeline
Seven focused middleware execute in order:

1. **ErrorHandler** - Global error boundary
2. **AgentLoader** - Loads agent definitions, filters tools
3. **ContextSetup** - Initializes conversation
4. **ProviderSelection** - Chooses LLM provider
5. **SafetyChecks** - Enforces limits (iterations, depth, tokens)
6. **LLMCall** - Handles LLM communication
7. **ToolExecution** - Orchestrates tool calls

Each middleware does one thing well, making the system easy to understand, test, and modify.

### Tool System

Tools are categorized by concurrency safety:

**Safe (parallel execution):**
- Read, List, Grep - No side effects

**Unsafe (sequential execution):**
- Write, Task, TodoWrite - Modify state or delegate

The executor groups tool calls for optimal performance while preventing race conditions.

### Agent Autonomy

Agents operate with true independence:

```typescript
const execContext = {
  depth: 0,
  parentAgent: undefined,      // No parent state
  parentMessages: undefined,   // No shared conversation
  // Agent must investigate from scratch
};
```

## Creating Agents

Define agents in markdown with YAML frontmatter:

```yaml
---
name: code-reviewer
tools: ["Read", "Write", "Grep"]
model: anthropic/claude-3-5-haiku-latest  # Optional, uses provider/model format
behavior: precise                # Optional preset
---

You are a code reviewer specializing in security analysis.
Focus on finding vulnerabilities and suggesting improvements.
```

## Creating Tools

Implement the minimal tool interface:

```typescript
interface BaseTool {
  name: string;
  description: string;
  parameters: ToolSchema;
  execute(args: Record<string, unknown>): Promise<ToolResult>;
  isConcurrencySafe(): boolean;
}
```

## Safety Mechanisms

Multiple layers protect against runaway execution:

- **Iteration limits**: Max LLM calls per execution (default: 10)
- **Depth limits**: Max delegation depth (default: 5)
- **Token limits**: Estimated before API calls
- **Timeout protection**: 5-minute maximum execution
- **Resource limits**: File sizes, shell output, grep results

## When to Use This Architecture

### Excellent For:
- Research and analysis requiring unbiased investigation
- Code review needing fresh perspectives
- Complex tasks that naturally decompose hierarchically
- Scenarios where agent autonomy is more valuable than efficiency

### Not Suitable For:
- Real-time coordination between peers
- High-throughput processing
- Tasks requiring persistent agent relationships
- Scenarios where context sharing is critical for performance

## Extension Points

Add new capabilities without modifying core:

- **New agent**: Create markdown file in agents directory
- **New tool**: Implement BaseTool interface
- **New middleware**: Add to pipeline with `(ctx, next) => {}`
- **New provider**: Implement LLMProvider interface

## Performance Considerations

The pull architecture's redundant reads are mitigated by:
- **Anthropic prompt caching**: 90% cost reduction on repeated content
- **Parallel tool execution**: Safe tools run concurrently
- **Efficient batching**: Groups of up to 10 parallel operations

## Configuration

System behavior is controlled through:
- `agent-config.json` - Default models and behaviors
- `providers-config.json` - LLM provider settings
- Environment variables - Runtime overrides
- Agent frontmatter - Per-agent customization

See `CLAUDE.md` for development guidelines and configuration examples.