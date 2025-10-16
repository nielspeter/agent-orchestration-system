# Quickstart Example

A minimal example demonstrating the basic setup and usage of the Agent Orchestration System.

## What This Demonstrates

- **Basic Setup**: Simple builder pattern configuration
- **Agent Execution**: Running a basic agent with a simple task
- **Default Tools**: Using built-in tools (Read, Write, List)
- **Session Management**: Simple session creation and cleanup

## Key Concepts

This is the simplest possible example - perfect for getting started. It shows:

1. How to configure the system with `AgentSystemBuilder`
2. How to specify a model
3. How to load agents from a directory
4. How to execute an agent with a task
5. How to properly clean up resources

## Running the Example

```bash
npx tsx packages/examples/quickstart/quickstart.ts
```

## Code Highlights

```typescript
const { executor, cleanup } = await new AgentSystemBuilder()
  .withModel('openrouter/openai/gpt-oss-20b')
  .withAgentsFrom('quickstart/agents')
  .withDefaultTools()
  .withSessionId('simple-test')
  .build();

const result = await executor.execute('orchestrator', 'List the files in the src directory');

await cleanup();
```

## Expected Output

The agent will list files in the src directory using the available tools.

## Next Steps

After running this example, check out:
- `orchestration/` - Learn about agent delegation
- `configuration/` - Explore configuration options
- `logging/` - See event logging in action
