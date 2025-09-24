# Migration Guide: Task Tool Renamed to Delegate Tool

## Overview
To eliminate confusion between the `Task` and `TodoWrite` tools, we've renamed the `Task` tool to `Delegate`. This is a **breaking change** that requires updates to any existing agent configurations and code that references the Task tool.

## What Changed

### Tool Name
- **Old**: `task`
- **New**: `delegate`

### Parameter Name
- **Old**: `subagent_type`
- **New**: `agent`

### TypeScript Changes

#### Tool Creation
```typescript
// Old
export const createTaskTool = async (agentLoader: AgentLoader): Promise<Tool> => {
  // ...
}

// New
export const createDelegateTool = async (agentLoader: AgentLoader): Promise<Tool> => {
  // ...
}
```

#### Interface Names
```typescript
// Old
interface TaskArgs {
  subagent_type: string;
  prompt: string;
  description?: string;
}

// New
interface DelegateArgs {
  agent: string;
  prompt: string;
  description?: string;
}
```

### Agent Markdown Files

#### Tool Declaration
```yaml
# Old
tools: ["task", "read", "write"]

# New
tools: ["delegate", "read", "write"]
```

#### Tool Usage in Prompts
```markdown
# Old
Use Task tool to delegate to notification-categorization:
Task(subagent_type="notification-categorization", prompt="...")

# New
Use Delegate tool to delegate to notification-categorization:
Delegate(agent="notification-categorization", prompt="...")
```

## Migration Steps

### 1. Update Your Code

If you have custom code that references the Task tool:

```typescript
// Old
import { createTaskTool } from './tools/task.tool';
const taskTool = await createTaskTool(agentLoader);

// New
import { createDelegateTool } from './tools/delegate.tool';
const delegateTool = await createDelegateTool(agentLoader);
```

### 2. Update Agent Configurations

Search and replace in all your agent markdown files:

```bash
# Replace tool name in YAML frontmatter
sed -i '' 's/"task"/"delegate"/g' agents/*.md

# Replace Task( with Delegate(
sed -i '' 's/Task(/Delegate(/g' agents/*.md

# Replace subagent_type with agent
sed -i '' 's/subagent_type/agent/g' agents/*.md
```

### 3. Update Test Fixtures

If you have integration test fixtures, they will need to be regenerated:

```bash
# Remove old fixtures
rm -rf tests/integration/*/fixtures/*/events.jsonl

# Regenerate by running tests
npm run test:integration
```

### 4. Update Documentation

Update any documentation that references the Task tool:

- API documentation
- README files
- Example code
- Tutorial content

## Examples

### Before (Task Tool)

```typescript
// In agent markdown
Use Task tool to delegate to code-analyzer:
Task(subagent_type="code-analyzer", prompt="Analyze this code for improvements")

// In TypeScript
const args = {
  subagent_type: "code-analyzer",
  prompt: "Analyze this code"
};
```

### After (Delegate Tool)

```typescript
// In agent markdown
Use Delegate tool to delegate to code-analyzer:
Delegate(agent="code-analyzer", prompt="Analyze this code for improvements")

// In TypeScript
const args = {
  agent: "code-analyzer",
  prompt: "Analyze this code"
};
```

## Rationale

The rename addresses a common source of confusion:
- **Task Tool**: Used for delegating work to other agents
- **TodoWrite Tool**: Used for managing a todo list

Users frequently confused these two tools due to the similar naming. The new name "Delegate" clearly indicates the tool's purpose of delegating work to other agents.

## Impact

- **Breaking Change**: All existing code and configurations must be updated
- **No Backward Compatibility**: The old `task` tool no longer exists
- **Test Fixtures**: Need regeneration with new tool names
- **Documentation**: All references need updating

## Timeline

- **Immediate**: Update all code in this repository
- **Before Next Release**: Ensure all examples and tests pass
- **Documentation**: Update before announcing the change

## Support

If you encounter issues during migration:
1. Check that all references are updated (tool name and parameter name)
2. Regenerate test fixtures if tests are failing
3. Verify agent markdown files have been updated correctly

## Verification

After migration, verify:
- [ ] All unit tests pass: `npm run test:unit`
- [ ] Integration tests pass: `npm run test:integration`
- [ ] Example scripts run: `npx tsx examples/orchestration.ts`
- [ ] No references to "task" tool remain: `grep -r '"task"' --include="*.md" --include="*.ts"`
- [ ] No references to "subagent_type" remain: `grep -r 'subagent_type' --include="*.md" --include="*.ts"`