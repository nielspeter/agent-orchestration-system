# Agent Orchestration Examples

This directory contains example scripts demonstrating various features of the agent orchestration system, organized by complexity and use case.

## Prerequisites

Before running any examples, ensure you have:
1. Set up your environment variables in `.env` file at the repository root
2. Added your `ANTHROPIC_API_KEY` to the `.env` file
3. Installed dependencies: `npm install` (from repository root)
4. Built the project: `npm run build` (from repository root)

## Running Examples

All examples can be run using npm scripts from the `packages/examples` directory:

```bash
cd packages/examples
npm run <example-name>
```

Or directly with `tsx` from the repository root:

```bash
npx tsx packages/examples/<path-to-example>
```

## Basic Examples

### default-agent
**Minimal Setup with Default Agent**
```bash
npm run default-agent
# or: npx tsx packages/examples/default-agent.ts
```
Shows the system running with the built-in default agent (no agent definitions required).

### inline-agents
**Programmatic Agent Definition**
```bash
npm run inline-agents
# or: npx tsx packages/examples/inline-agents.ts
```
Demonstrates how to define agents programmatically in code rather than loading from markdown files.

### quickstart
**Basic Agent Execution**
```bash
npm run quickstart
# or: npx tsx packages/examples/quickstart/quickstart.ts
```
Simple introduction to agent execution with file operations.

## Configuration & Setup

### configuration
**Configuration Options**
```bash
npm run configuration
# or: npx tsx packages/examples/configuration/configuration.ts
```
Shows different ways to configure the system:
- Minimal setup (no tools)
- Default setup (file tools)
- Full setup (all tools including TodoWrite)
- Custom configuration with specific settings
- Loading from config file

### mcp-integration
**MCP Server Integration**
```bash
npm run mcp
# or: npx tsx packages/examples/mcp-integration.ts
```
Demonstrates integration with Model Context Protocol (MCP) servers for external tools.

## Orchestration & Delegation

### orchestration
**Agent Orchestration and Delegation**
```bash
npm run orchestration
# or: npx tsx packages/examples/orchestration/orchestration.ts
```
Shows how agents autonomously delegate work to specialized agents. Demonstrates the difference between simple tasks handled directly and complex tasks requiring delegation.

### coding-team
**Collaborative Development**
```bash
npm run coding-team
# or: npx tsx packages/examples/coding-team/coding-team.ts
```
Multi-agent system where specialized agents collaborate to implement software features:
- **Driver agent**: Orchestrates the development process
- **Implementer agent**: Writes production code
- **Test-writer agent**: Creates comprehensive test suites
- **Shell tool integration**: Enables running tests and type checking
- **TodoWrite tracking**: Real-time progress visibility

## Advanced Features

### thinking
**Extended Thinking & Reasoning**
```bash
npm run thinking
# or: npx tsx packages/examples/thinking/thinking.ts
```
Demonstrates extended thinking/reasoning features with different agents:
- Deep Reasoner: Default thinking budget with Anthropic
- Quick Thinker: Custom thinking budget
- OpenRouter Reasoner: Thinking via OpenRouter

### werewolf-game
**Autonomous Multi-Agent Game**
```bash
npm run werewolf
# or: npx tsx packages/examples/werewolf-game/werewolf-game.ts
```
A complex multi-agent game demonstrating true agent autonomy:
- **Game-master agent**: Orchestrates the entire game independently
- **Role agents**: Werewolf, seer, villager make strategic decisions
- **Evidence-based gameplay**: Alibis, deductions, and voting
- **No hardcoded logic**: All game rules exist in agent prompts

## Logging & Debugging

### logging
**Detailed Logging and Debugging**
```bash
npm run logging
# or: npx tsx packages/examples/logging/logging.ts
```
Shows how to enable verbose logging to see the full orchestration flow:
- Agent delegation decisions
- Tool executions
- Conversation history
- Depth tracking

### session-analyzer
**Session Analysis**
```bash
npm run session-analyzer
# or: npx tsx packages/examples/session-analyzer/session-analyzer.ts
```
Analyzes session logs and provides insights into agent behavior and tool usage.

## Specialized Use Cases

### udbud
**Tender Analysis System (Danish)**
```bash
npm run udbud
# or: npx tsx packages/examples/udbud/udbud.ts
```
Multi-agent system for analyzing and preparing tender/bid documentation:
- Document conversion
- Technical analysis
- GO/NO-GO decision support
- Clarification question identification

See [udbud/README.md](udbud/README.md) for detailed documentation.

### critical-illness
**Insurance Claim Processing**
```bash
npm run critical-illness
# or: npx tsx packages/examples/critical-illness-claim/critical-illness-claim.ts
```
Workflow-based claim processing demonstrating multi-step agent workflows.

### critical-illness-structured
**Structured Output Claim Processing**
```bash
npm run critical-illness-structured
# or: npx tsx packages/examples/critical-illness-claim-structured/critical-illness-claim-structured.ts
```
Similar to critical-illness but uses structured JSON output for integration with external systems.

## Additional Examples

### memory-patterns
**Memory and State Management**
```bash
npm run memory-patterns
# or: npx tsx packages/examples/memory-patterns.ts
```
Demonstrates different patterns for managing agent memory and state across conversations.

### script-tools
**Custom Script Tools**
```bash
npm run script-tools
# or: npx tsx packages/examples/script-tools/script-tools.ts
```
Shows how to create and use custom script-based tools that execute external commands.

### workflow-pipeline
**Workflow Orchestration**
```bash
npm run workflow-pipeline
# or: npx tsx packages/examples/workflow-pipeline/workflow-pipeline.ts
```
Demonstrates building complex workflows with multiple agents in a pipeline pattern.

## Architecture Notes

- **Pull Architecture**: Child agents don't inherit parent context and must gather information via tools
- **Caching Strategy**: File reads are cached for 5 minutes using Claude's ephemeral caching
- **Parallel Execution**: Multiple tool calls can execute in parallel when safe
- **Safety Limits**: Built-in limits prevent infinite loops and excessive token usage

## Testing

For comprehensive testing, see the test suites in the core package:
- **Unit Tests**: `npm run test:unit` (from repository root) - Tests without API calls
- **Integration Tests**: `npm run test:integration` (from repository root) - Tests with real API calls

## Configuration Files

Most examples support loading configuration from `agent-config.json`. Example configuration:

```json
{
  "model": "anthropic/claude-haiku-4-5",
  "agents": {
    "directories": ["./agents"]
  },
  "tools": {
    "builtin": ["read", "write", "list", "delegate", "todowrite"]
  },
  "safety": {
    "maxIterations": 50,
    "maxDepth": 10
  }
}
```

## Common Issues

1. **Missing API Key**: Ensure `ANTHROPIC_API_KEY` is set in your `.env` file at the repository root
2. **Build Errors**: Run `npm run build` from the repository root before running examples
3. **MCP Errors**: MCP server examples require proper server configuration in `agent-config.json`
4. **Timeout Errors**: Complex tasks may timeout - adjust safety limits if needed
5. **Path Issues**: Run examples from the repository root or use the correct relative paths

## Learn More

- See `/docs` for detailed documentation
- Check `/packages/core/tests` for comprehensive test examples
- Review agent definitions in example subdirectories (`*/agents/`)
- Main README: [../../README.md](../../README.md)
- Core package: [../core/README.md](../core/README.md)
