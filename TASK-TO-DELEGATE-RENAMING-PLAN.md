# Task Tool → Delegate Tool Renaming Plan

## Executive Summary

This plan details the comprehensive renaming of the "task" tool to "delegate" tool to eliminate confusion with the TodoWrite tool and improve code clarity. The renaming affects ~100+ references across source code, tests, documentation, and examples.

## Rationale

- **Current Problem**: "task" tool name conflicts with TodoWrite's task management, causing frequent confusion
- **Solution**: Rename to "delegate" which accurately describes the tool's function
- **Benefits**: Clearer code, reduced cognitive load, better developer experience

## Scope Analysis

### Files Requiring Changes

#### 1. Core Source Files (8 files)
- `src/tools/task.tool.ts` → Rename to `src/tools/delegate.tool.ts`
- `src/tools/index.ts` - Export statement
- `src/index.ts` - Import and usage
- `src/config/system-builder.ts` - Multiple references (lines 21, 195, 544-545, 609, 1014)
- `src/config/types.ts` - Line 234
- `src/tools/registry/executor-service.ts` - Lines 195, 197, 223-227, 233
- `src/tracing/simple-tracer.ts` - Line 102
- `src/tools/README.md` - Documentation update

#### 2. Test Files (11+ files)
- `tests/unit/structure.test.ts` - Import and multiple test cases
- `tests/unit/config/system-builder.test.ts` - Multiple assertions
- `tests/unit/config/system-builder-helpers.test.ts` - Tool list assertions
- `tests/unit/tools/registry/executor-service.test.ts` - Delegation tests
- `tests/unit/logging/event-logger.test.ts` - Delegation logging
- `tests/types/event-types.ts` - TaskToolParams interface
- `tests/utils/event-stream-parser.ts` - TaskToolParams usage
- `tests/integration/critical-illness-claim/matchers.ts` - Task tool detection
- `tests/integration/critical-illness-claim/parser.ts` - Task tool parsing
- `tests/integration/critical-illness-claim-structured/matchers.ts` - Task tool detection
- `tests/integration/critical-illness-claim-structured/parser.ts` - Task tool parsing
- `tests/integration/critical-illness-claim-structured/workflows/claim-processing.test.ts`
- `tests/integration/werewolf-game/parser.ts` - Task detection

#### 3. Documentation Files (15+ files)
- `README.md` - Multiple references to Task tool
- `CLAUDE.md` - AI assistant instructions
- `docs/README.md` - Documentation overview
- `docs/agent-system.md` - Agent system documentation (extensive)
- `docs/agent-communication.md` - Communication patterns
- `docs/middleware-architecture.md` - Middleware documentation
- `docs/framework-comparison.md` - Framework comparisons
- `docs/agentic-loop-pattern.md` - Pattern documentation
- `docs/tool-system.md` - Tool system documentation
- `docs/execution-flow-diagram.md` - Flow diagrams
- `docs/ARCHITECTURE.md` - Architecture documentation
- `docs/coding-agent-example-design.md` - Example designs
- `docs/default-agent-evaluation.md` - Default agent docs
- `docs/distributed-tracing.md` - Tracing documentation
- `docs/unified-configuration.md` - Configuration docs

#### 4. Example Files (10+ files)
- `examples/orchestration/agents/orchestrator.md` - Agent definition
- `examples/configuration/agents/orchestrator.md` - Agent definition
- `examples/logging/agents/orchestrator.md` - Agent definition
- `examples/coding-team/agents/driver.md` - Uses task tool
- `examples/coding-team/README.md` - Documentation
- `examples/coding-team/AGENT-TOOLS.md` - Tool documentation
- `examples/werewolf-game/agents/game-master.md` - Uses task tool
- `examples/critical-illness-claim/agents/claim-orchestrator.md` - Uses task tool
- `examples/critical-illness-claim-structured/agents/claim-orchestrator.md` - Uses task tool
- `examples/udbud/agents/tender-orchestrator.md` - Uses task tool
- `examples/memory-patterns.ts` - Code reference
- `examples/default-agent.ts` - Code reference

## Detailed Changes

### Phase 1: Core Renaming

#### 1.1 Rename the Tool File
```bash
git mv src/tools/task.tool.ts src/tools/delegate.tool.ts
```

#### 1.2 Update Tool Definition (`src/tools/delegate.tool.ts`)
```typescript
// Before
export const createTaskTool = async (agentLoader: AgentLoader): Promise<Tool> => {
  return {
    name: 'task',
    ...
  };
};

// After
export const createDelegateTool = async (agentLoader: AgentLoader): Promise<Tool> => {
  return {
    name: 'delegate',
    description: `Delegate work to a specialized agent for autonomous completion.

Use this tool proactively when:
- The task requires specialized domain expertise
- You need deep analysis or investigation
- The user's request involves code review or technical writing
- You've completed significant work that should be reviewed
- The task involves complex multi-step coordination

Available agents: ${availableAgents.join(', ')}

The agent will work autonomously to complete the delegated work and return comprehensive results.`,
    parameters: {
      type: 'object',
      properties: {
        agent: {  // Renamed from 'subagent_type'
          type: 'string',
          description: 'The specialized agent to delegate to'
        },
        instruction: {  // Renamed from 'prompt' for clarity
          type: 'string',
          description: 'Clear instructions for what the agent should accomplish'
        },
        description: {
          type: 'string',
          description: 'A short (3-5 word) description for logging purposes'
        }
      },
      required: ['agent', 'instruction']
    },
    ...
  };
};
```

#### 1.3 Update Interface (`src/tools/registry/executor-service.ts`)
```typescript
// Before
interface TaskArgs {
  subagent_type: string;
  prompt: string;
  [key: string]: unknown;
}

// After
interface DelegateArgs {
  agent: string;
  instruction: string;
  description?: string;
  [key: string]: unknown;
}
```

#### 1.4 Update Tool Detection
```typescript
// Before (line 195)
if (tool.name === 'task') {
  result = await handleDelegation(parsedArgs as TaskArgs, ctx, executeDelegate, toolCall.id);
}

// After
if (tool.name === 'delegate') {
  result = await handleDelegation(parsedArgs as DelegateArgs, ctx, executeDelegate, toolCall.id);
}
```

#### 1.5 Update handleDelegation Function
```typescript
// Update function signature and usage
async function handleDelegation(
  args: DelegateArgs,
  ctx: MiddlewareContext,
  executeDelegate: ExecuteDelegate,
  parentCallId: string
): Promise<ToolResult> {
  ctx.logger.logDelegation(ctx.agentName, args.agent, args.instruction);

  const subAgentResult = await executeDelegate(args.agent, args.instruction, {
    ...ctx.executionContext,
    depth: ctx.executionContext.depth + 1,
    parentAgent: ctx.agentName,
    isSidechain: true,
    parentMessages: [], // Pull architecture - child starts fresh
    traceId: ctx.traceId || crypto.randomUUID(),
    parentCallId: parentCallId,
  });

  return { content: subAgentResult };
}
```

### Phase 2: Update Imports and Exports

#### 2.1 Update `src/tools/index.ts`
```typescript
// Before
export { createTaskTool } from './task.tool';

// After
export { createDelegateTool } from './delegate.tool';
```

#### 2.2 Update `src/index.ts`
```typescript
// Before
import { createTaskTool } from './tools';

// After
import { createDelegateTool } from './tools';

// Update usage
this.toolRegistry.register(await createDelegateTool(this.agentLoader));
```

#### 2.3 Update `src/config/system-builder.ts`
```typescript
// Before (line 21)
import { createTaskTool } from '@/tools/task.tool';

// After
import { createDelegateTool } from '@/tools/delegate.tool';

// Update all references:
// Line 195: return this.withBuiltinTools('read', 'write', 'list', 'delegate');
// Line 544: case 'delegate':
// Line 545: toolRegistry.register(await createDelegateTool(agentLoader));
// Line 609: Use exact names like "read", "write", "delegate", etc.
// Line 1014: tools: { builtin: ['read', 'write', 'list', 'grep', 'delegate', 'todowrite'] }
```

### Phase 3: Update Tests

#### 3.1 Update Type Definitions (`tests/types/event-types.ts`)
```typescript
// Before
export interface TaskToolParams {
  subagent_type: string;
  prompt: string;
  description?: string;
}

// After
export interface DelegateToolParams {
  agent: string;
  instruction: string;
  description?: string;
}
```

#### 3.2 Update Test Files
All test files need updates to:
- Change `'task'` to `'delegate'`
- Change `createTaskTool` to `createDelegateTool`
- Change `TaskToolParams` to `DelegateToolParams`
- Update test descriptions from "Task tool" to "Delegate tool"

### Phase 4: Update Agent Definitions

Agent files using the task tool need their YAML frontmatter updated:

#### Example: `examples/coding-team/agents/driver.md`
```yaml
# Before
tools: ["list", "todowrite", "task"]

# After
tools: ["list", "todowrite", "delegate"]
```

This applies to:
- `examples/coding-team/agents/driver.md`
- `examples/udbud/agents/tender-orchestrator.md`
- `examples/critical-illness-claim/agents/claim-orchestrator.md`
- `examples/critical-illness-claim-structured/agents/claim-orchestrator.md`
- `examples/werewolf-game/agents/game-master.md`

### Phase 5: Update Documentation

#### 5.1 Primary Documentation Updates

**README.md:**
- Line 36: "Orchestration emerges through the `delegate` tool"
- Line 41: "B uses tools (Read, Write, List, Grep, Delegate)"
- Line 64: "Delegation: Calling another agent via delegate tool"
- Line 103: "Shows how agents delegate work to specialized sub-agents using the Delegate tool"

**CLAUDE.md:**
- Line 72: "B uses tools (Read, Write, List, Grep, Delegate)"
- Line 78: "All agents use the same pipeline and can delegate to others via the Delegate tool"

**docs/agent-system.md:**
- Update all references to "Task tool" → "Delegate tool"
- Update mermaid diagrams showing "task tool" → "delegate tool"
- Update JSON examples showing tool: "task" → tool: "delegate"

### Phase 6: Documentation Pattern Updates

Update conceptual documentation to reflect the new naming:

```markdown
# Before
The Task tool enables delegation to sub-agents...

# After
The Delegate tool enables delegation to specialized agents...
```

## Implementation Order

1. **Create feature branch**: `git checkout -b rename-task-to-delegate`

2. **Phase 1: Core changes** (Most critical)
   - Rename file
   - Update tool definition
   - Update executor service
   - Run tests to ensure basic functionality

3. **Phase 2: Update imports/exports**
   - Update all import statements
   - Update system builder
   - Run build to catch compilation errors

4. **Phase 3: Update tests**
   - Fix test compilation errors
   - Update test descriptions
   - Ensure all tests pass

5. **Phase 4: Update agent definitions**
   - Update agent markdown files
   - Test example executions

6. **Phase 5: Update documentation**
   - Update all markdown documentation
   - Update code comments
   - Update inline documentation

7. **Phase 6: Final validation**
   - Run full test suite: `npm test`
   - Build project: `npm run build`
   - Run linter: `npm run lint`
   - Test examples manually

## Validation Checklist

- [ ] All TypeScript files compile without errors
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Build completes successfully
- [ ] Linter passes
- [ ] Example agents execute correctly
- [ ] Documentation is consistent
- [ ] No references to "task tool" remain (except historical/migration notes)

## Rollback Plan

If issues arise:
1. `git stash` any uncommitted changes
2. `git checkout main`
3. Investigate issues before retry
4. Consider phased approach with deprecation warnings

## Search Commands for Verification

After implementation, verify no "task" tool references remain:

```bash
# Check for any remaining 'task' tool references
grep -r "'task'" src/ tests/ --include="*.ts" | grep -v todowrite
grep -r '"task"' src/ tests/ --include="*.ts" | grep -v todowrite
grep -r "Task tool" docs/ examples/ --include="*.md"
grep -r "task tool" docs/ examples/ --include="*.md"

# Check for any remaining createTaskTool references
grep -r "createTaskTool" src/ tests/ --include="*.ts"
grep -r "TaskTool" src/ tests/ --include="*.ts"
grep -r "TaskArgs" src/ tests/ --include="*.ts"
```

## Migration for External Users

If this system has external users, consider:

1. **Deprecation period**: Support both names temporarily
2. **Migration guide**: Document the change
3. **Version bump**: This is a breaking change (major version)

## Notes

- The term "delegate" better reflects the hierarchical, autonomous nature of agent communication
- This change eliminates the Task/Todo confusion permanently
- Parameter renaming (subagent_type → agent, prompt → instruction) improves clarity
- The change aligns with the system's pull architecture philosophy

## Success Criteria

- Zero references to "task tool" in active code (excluding migration docs)
- All tests pass
- Documentation accurately reflects new naming
- No confusion between delegate and todowrite tools
- Improved developer experience confirmed through usage