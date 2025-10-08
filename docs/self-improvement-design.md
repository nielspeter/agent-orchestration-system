# Agent Self-Improvement Design

## Overview

This document describes a **self-improvement system** where agents can learn from their executions and modify their own configuration to achieve better results in future runs.

**Core Philosophy**: Agents autonomously identify improvement opportunities and update their own prompts, not system-forced reflection after every execution.

## Key Concepts

### Agent-Initiated Learning

Agents have access to an `ImprovePrompt` tool when self-improvement is enabled. During execution, when an agent recognizes:
- A more efficient approach
- Suboptimal tool usage
- Successful strategies worth remembering
- Context about the codebase/domain
- Repeated mistakes

...it can call `ImprovePrompt` to update its own configuration.

### Hot Reload Architecture

The existing architecture already supports immediate improvements:

1. `AgentLoader.loadAgent()` reads agent .md files from disk on **every execution**
2. `AgentLoaderMiddleware` calls `loadAgent()` on each `execute()`
3. Changes to agent .md files are visible on the **next execution within the same session**

This means: **Agent improves itself → Changes written to .md file → Next execute() sees improvements**

### Git as Safety Net

All agent .md files are committed to git:
- ✅ Agents can freely modify their own files
- ✅ User reviews changes via `git diff`
- ✅ User commits valuable improvements
- ✅ User discards unhelpful changes
- ✅ No danger in experimentation

## Architecture

### Enable Self-Improvement

```typescript
const system = await AgentSystemBuilder.default()
  .withSelfImprovement(true)  // Enable for all agents
  .build();
```

When enabled:
1. Adds `ImprovePrompt` tool to all agents
2. Enhances system prompt with self-improvement instructions
3. Agent can call the tool during execution

### ImprovePrompt Tool

```typescript
interface ImprovePromptParams {
  observation: string;   // What the agent noticed
  improvement: string;   // What should change
  scope?: 'immediate' | 'next-execution';  // When to apply
  category?: 'strategy' | 'context' | 'example' | 'efficiency';
}
```

**Example usage by agent:**
```typescript
// Agent realizes during execution:
ImprovePrompt({
  observation: "I read 5 large files sequentially to find one function definition",
  improvement: "Use Grep to search for function name first, then Read only the relevant file",
  category: "efficiency"
})
```

### What Gets Learned

#### Strategy Improvements
- "When analyzing React docs, always check version first"
- "For research tasks, use Grep before Read to find relevant files"
- "Break large tasks into smaller delegations"

#### Context Awareness
- "This codebase uses TypeScript strict mode"
- "Tests are in tests/ not __tests__/"
- "Always run `npm run build` after code changes"

#### Successful Patterns (Few-Shot Learning)
- Capture tool usage sequences that worked well
- Store as examples in frontmatter
- Reference in future similar tasks

#### Efficiency Gains
- "Don't read entire files, use Grep with context lines"
- "Check file size before reading (use List -l)"
- "Delegate file operations to specialized agents"

#### Error Corrections
- Tool parameter mistakes
- Incorrect assumptions
- Failed approaches to avoid

## Agent Configuration Format

### Enhanced Frontmatter

```yaml
---
name: researcher
model: anthropic/claude-3-5-haiku-latest
behavior: balanced
tools:
  - Read
  - Write
  - List
  - Grep
  - Delegate

# Self-improvement learnings
learnings:
  strategies:
    - "Always check file size before reading entire contents"
    - "Use Grep to locate before Read to extract"
    - "When searching codebase, start with List to understand structure"

  context:
    - "This is a TypeScript monorepo with packages/core and packages/web"
    - "Build required after changes: npm run build && npm run lint"
    - "Documentation in docs/ using Mermaid diagrams"

  efficiency:
    - "Grep with -A/-B flags faster than Read then filter"
    - "Delegate to specialized agents for multi-step operations"

  examples:
    - task: "Find function definition in large codebase"
      approach: "Grep for 'function functionName' → Read specific file:line"
      result: "Success in 2 iterations instead of 6"
      tools: ["Grep", "Read"]

    - task: "Update configuration across multiple files"
      approach: "Grep to find all occurrences → Delegate to editor agent"
      result: "Consistent changes, no missed files"
      tools: ["Grep", "Delegate"]

---

Your task is to research and analyze codebases efficiently...
```

### System Prompt Enhancement

When self-improvement is enabled, agents receive additional instructions:

```markdown
## Self-Improvement

You have access to the ImprovePrompt tool. Use it when you recognize:

1. **Efficiency gains**: You used a slow approach when a faster one exists
2. **Strategic insights**: You learned a better way to approach this type of task
3. **Context knowledge**: You discovered important facts about this codebase/domain
4. **Successful patterns**: An approach worked especially well and is worth remembering
5. **Error patterns**: You made a mistake that you want to avoid in the future

Your learnings are stored in your configuration and will be available in future executions.

**Current learnings:**
{agent.learnings formatted as markdown}

Apply these learnings to your current task.
```

## Example Execution Flow

### Scenario: Agent Learning Efficient File Search

```
Session: debug-001
Agent: researcher

─────────────────────────────────────────────────────────

Execute #1: "Find all TypeScript interfaces in src/"

Iteration 1: List src/
  → Result: Found 8 TypeScript files

Iteration 2: Read src/types.ts (2MB file)
  → Result: Found 5 interfaces, but took 3.2s

Iteration 3: Read src/models.ts (1.5MB file)
  → Result: Found 3 interfaces, took 2.1s

Iteration 4: Agent recognizes inefficiency
  → "Reading large files entirely is slow"
  → Calls ImprovePrompt({
      observation: "Reading entire large files to find interfaces is inefficient",
      improvement: "Use Grep with pattern 'interface\\s+\\w+' to search first, then Read only relevant sections if needed",
      category: "efficiency"
    })
  → System updates researcher.md frontmatter

Iteration 5: Read src/utils.ts
  → Result: Found 2 interfaces

Task complete: Found 10 interfaces total (8.6s)

─────────────────────────────────────────────────────────

Execute #2: "Find all TypeScript type aliases"

AgentLoader reloads researcher.md (sees new efficiency learning!)

Iteration 1: Grep with pattern 'type\s+\w+\s*='
  → Result: Found 15 type aliases across 5 files (0.8s)

Iteration 2: Format results
  → Task complete

Task complete: Found 15 type aliases (1.2s)
  → 7x faster than previous approach would have been!

─────────────────────────────────────────────────────────

User reviews git diff:
  git diff agents/researcher.md

  +  efficiency:
  +    - "Grep with pattern search faster than Read for finding code patterns"

User commits:
  git commit -m "agent learning: use Grep before Read for pattern search"
```

## Implementation Approach

### Phase 1: Core Tool (Simplest)

1. **Create `ImprovePrompt` tool** in `src/tools/improve-prompt.tool.ts`
   - Accepts observation, improvement, category
   - Modifies agent .md file frontmatter
   - Appends to `learnings` section

2. **Add `.withSelfImprovement(true)` to AgentSystemBuilder**
   - Adds ImprovePrompt to tool registry
   - Enhances system prompt with self-improvement instructions
   - Includes current learnings in context

3. **Update system prompt template**
   - Add self-improvement section when enabled
   - Format existing learnings for agent to see

### Phase 2: Safety & Controls

1. **Limit learning accumulation**
   - Max learnings per category (e.g., 10 strategies)
   - Prevent unbounded growth in frontmatter
   - Optional: LRU eviction of old learnings

2. **Validation**
   - Ensure improvements are meaningful
   - Prevent duplicate learnings
   - YAML frontmatter validation

3. **Rollback mechanism**
   - Track which learnings helped vs hurt
   - Optional: Auto-remove learnings that correlate with failures

### Phase 3: Advanced Features

1. **Scope: immediate**
   - Apply learning mid-execution
   - Reload agent configuration without restarting
   - Useful for "catching yourself" during execution

2. **Learning analytics**
   - Track which learnings are most referenced
   - Identify successful vs unused learnings
   - Suggest consolidation or removal

3. **Cross-agent learning**
   - Share learnings between related agents
   - Common knowledge pool for all agents
   - Domain-specific learning groups

## Benefits

### For Agents
- **Continuous improvement** without human intervention
- **Context-aware** learning specific to codebases/domains
- **Cumulative knowledge** building over time
- **Autonomous decision-making** about when to improve

### For Users
- **Git safety net** - review, commit, or discard changes
- **Transparency** - all learnings visible in .md frontmatter
- **Immediate effect** - improvements work in same session
- **Zero configuration** - just `.withSelfImprovement(true)`

### For System
- **Leverages existing hot reload** - no new infrastructure needed
- **Simple implementation** - just one new tool
- **Fits agent philosophy** - agents are autonomous and self-sufficient
- **Scales naturally** - each agent improves independently

## Design Rationale

### Why Agent-Initiated?

**Alternative considered**: System-forced reflection after every execution

**Chosen approach**: Agent decides when improvement is needed

**Rationale**:
- ✅ Agent has full context of what happened and why
- ✅ More selective - only improves when actually needed
- ✅ More intelligent - understands nuance of what was suboptimal
- ✅ Fits autonomous agent philosophy
- ✅ Can improve mid-execution if pattern recognized early

### Why Store in Frontmatter?

**Alternative considered**: Separate learning database

**Chosen approach**: YAML frontmatter in agent .md files

**Rationale**:
- ✅ Learnings travel with agent definition
- ✅ Git provides version control
- ✅ Human-readable and editable
- ✅ No additional storage infrastructure
- ✅ Visible in agent marketplace/sharing

### Why Git as Safety Net?

**Alternative considered**: Approval mechanism before applying changes

**Chosen approach**: Write changes, user reviews via git

**Rationale**:
- ✅ Developers already know git workflows
- ✅ Diffing shows exactly what changed
- ✅ Easy to revert unhelpful changes
- ✅ Commit messages document why learning was valuable
- ✅ No additional UI needed

## Known Limitations

### POC/MVP Constraints

1. **No automatic quality assessment** of learnings
   - Agent might learn incorrect patterns
   - User must review via git diff
   - Future: Could add validation/scoring

2. **Frontmatter size growth**
   - Unbounded learning accumulation
   - Could hit token limits for large agents
   - Future: Implement LRU eviction

3. **No cross-agent coordination**
   - Each agent learns independently
   - Duplicate learnings across agents
   - Future: Shared knowledge pool

4. **No learning analytics**
   - Can't track which learnings help most
   - No automatic removal of unused learnings
   - Future: Usage tracking and optimization

### Production Considerations

For production use, consider:

1. **Learning validation** - Prevent harmful or nonsensical improvements
2. **Size limits** - Cap frontmatter growth
3. **Review workflow** - Require approval before applying in production
4. **Rollback tracking** - Correlate learnings with performance metrics
5. **Audit logging** - Track all self-modifications

## Future Enhancements

### Short Term
- Learning deduplication
- Max learnings per category
- Improved formatting in system prompt

### Medium Term
- Learning effectiveness metrics
- Auto-removal of unused learnings
- Learning templates for common patterns

### Long Term
- Shared knowledge pools
- Cross-agent learning transfer
- ML-based learning quality assessment
- Learning marketplace/library

## See Also

- [Agent System](./agent-system.md) - Agent lifecycle and architecture
- [Tool System](./tool-system.md) - How tools work
- [Logging and Debugging](./logging-and-debugging.md) - GetSessionLog tool for self-reflection
- [Safety and Resource Management](./safety-and-resource-management.md) - Safety constraints
