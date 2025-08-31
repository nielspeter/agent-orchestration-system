# Claude Code Architecture Documentation

## Executive Summary
This document describes the revolutionary architecture of Claude Code, where "everything is an agent" 
and orchestration emerges through recursive composition. The key innovation is the combination of 
isolated agents with context passing, made efficient through Anthropic's ephemeral caching.

## Core Principles

### 1. Everything is an Agent
There is no special orchestrator class or coordination logic. All agents use the same execution loop,
and orchestration capability comes from giving an agent access to the Task tool, which can invoke 
other agents recursively.

### 2. Isolation with Context Passing
Each agent starts with a clean slate but inherits its parent's conversation context. This isolation 
ensures clean separation of concerns while context passing ensures continuity. The parent's entire 
conversation becomes the child's cached foundation.

### 3. Caching Makes it Efficient
Without caching, passing full context to each child agent would be expensive. With Anthropic's 
ephemeral caching (5-minute TTL), the parent's context is cached and reused, resulting in up to 
90% token savings and 2000x efficiency gains for multi-agent workflows.

## Technical Implementation

### Agent Definition
Agents are defined as markdown files with YAML frontmatter:
```yaml
name: agent-name
tools: ["tool1", "tool2"] # or "*" for all tools
```

### The Task Tool
The Task tool is the key to orchestration. It's just another tool that recursively calls the 
agent executor with a different agent. This simple pattern creates the entire orchestration capability.

### Context Inheritance
When agent A delegates to agent B:
1. Agent A passes its ENTIRE conversation history to B
2. B inherits this as cached context (5-minute TTL)
3. B adds its own system prompt and continues
4. The parent's work becomes the child's cached foundation

### Parallel vs Sequential Execution
Tools are grouped by concurrency safety:
- Read operations run in parallel (up to 10 concurrent)
- Write operations run sequentially for safety
- Task delegations are marked as sidechains

## Performance Metrics

### Without Caching (Traditional Approach)
- Parent with 10KB context delegates to child
- Child pays for full 10KB retransmission
- 3-level delegation = 30KB tokens
- Cost multiplies with depth

### With Caching (Claude Code Approach)
- Parent with 10KB context delegates to child
- Child reuses cached context (90% discount)
- 3-level delegation ≈ 11KB tokens (10KB cached + 1KB new)
- Cost remains nearly constant with depth

### Real-World Impact
- 90% reduction in token costs for repeated context
- 2000x efficiency for multi-agent workflows
- Near-instant context reuse within 5-minute window
- Enables complex multi-agent systems at scale

## Best Practices

### 1. Pass Complete Context
Always pass the full conversation history when delegating. Don't try to summarize or filter - 
let the caching handle efficiency.

### 2. Design for Isolation
Each agent should be self-contained with its own system prompt. Don't rely on implicit context - 
make everything explicit.

### 3. Leverage Caching Windows
The 5-minute cache TTL is perfect for interactive workflows. Design your agents to complete 
related work within this window.

### 4. Use Appropriate Models
- claude-3-5-haiku: Fast and efficient for most tasks
- claude-3-5-sonnet: More capable for complex reasoning
- claude-3-opus: Maximum capability when needed

## Conclusion

Claude Code's architecture demonstrates that simplicity and efficiency can coexist. By combining 
isolated agents with context passing and leveraging Anthropic's caching, we achieve a system that 
is both architecturally clean and economically efficient. The recursive pattern of "everything is 
an agent" creates emergent orchestration capabilities without special coordination logic.

This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
This additional content simulates a large document that benefits from caching.
