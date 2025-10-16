# Script Tools Example

Demonstrates using the **Shell tool** for executing system commands and scripts.

## What This Demonstrates

- **Shell Tool**: Execute bash commands from agents
- **Script Execution**: Run system scripts and utilities
- **Security**: Built-in safety restrictions
- **Output Handling**: Capturing and processing command output

## Key Concepts

The Shell tool enables agents to:
- Run system commands (`ls`, `grep`, `find`, etc.)
- Execute scripts
- Interact with the filesystem
- Process command output

### Security Features

Built-in protections prevent:
- Destructive commands (`rm -rf /`, `:(){ :|:& };:`)
- Sensitive data access (blocks `.ssh`, `.aws`, `.env`)
- Infinite loops and fork bombs
- Path traversal attacks

## Running the Example

```bash
npx tsx packages/examples/script-tools/script-tools.ts
```

## Safe Commands

✅ **Allowed:**
- File operations: `ls`, `cat`, `head`, `tail`
- Search: `grep`, `find`, `rg`
- Git operations: `git status`, `git log`
- Package managers: `npm`, `pip`
- Development tools: `node`, `python`, `tsc`

❌ **Blocked:**
- `rm -rf /` - Destructive file deletion
- `dd if=/dev/zero` - Disk operations
- `:(){ :|:& };:` - Fork bombs
- Access to `.ssh`, `.aws`, `.env`

## Code Highlights

```typescript
// Agent with Shell tool access
const { executor } = await AgentSystemBuilder.default()
  .withTools([new ShellTool()])
  .build();

// Agent can execute commands
const result = await executor.execute(
  'dev-ops',
  'Check git status and recent commits'
);
// Agent uses: git status && git log -5
```

## Use Cases

- **DevOps**: Git operations, deployments
- **Testing**: Run test suites
- **Build Automation**: Execute build scripts
- **System Monitoring**: Check system status
- **Data Processing**: Process files with scripts

## Example Agent

```markdown
---
name: dev-ops
tools: ["Shell", "Read", "Write"]
---

You are a DevOps agent. You can:
- Check git status
- Run tests
- Execute build scripts
- Monitor system resources

Always validate command safety before execution.
```

## Output Handling

```typescript
// Shell tool returns structured output
{
  success: true,
  output: "... command output ...",
  exitCode: 0
}
```

## Best Practices

1. **Validate Input**: Check command safety
2. **Handle Errors**: Process non-zero exit codes
3. **Limit Scope**: Use specific commands, not wildcards
4. **Parse Output**: Extract relevant information
5. **Security First**: Never disable safety checks

## Next Steps

For more advanced tool usage:
- `mcp-integration/` - External tool servers
- `coding-team/` - Shell in development workflows
- Custom tools - Create domain-specific tools
