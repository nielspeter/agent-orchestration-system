# Agent Orchestration Examples

This directory contains example scripts demonstrating various features of the agent orchestration system. Examples are numbered in order of increasing complexity.

## Prerequisites

Before running any examples, ensure you have:
1. Set up your environment variables in `.env` file
2. Added your `ANTHROPIC_API_KEY` to the `.env` file
3. Installed dependencies: `npm install`
4. Built the project: `npm run build`

## Examples

### 01-quickstart.ts
**Basic Hello World Example**
```bash
npm run example:quickstart
```
A simple example showing the minimal setup needed to get started with the agent orchestration system.

### 02-orchestration.ts
**Agent Orchestration and Delegation**
```bash
npm run example:orchestration
```
Demonstrates how agents autonomously decide to delegate work to specialized agents. Shows the difference between simple tasks handled directly and complex tasks requiring delegation.

### 03-configuration.ts
**Configuration Options**
```bash
npm run example:configuration
```
Shows different ways to configure the system using the AgentSystemBuilder:
- Minimal setup (no tools)
- Default setup (file tools)
- Full setup (all tools including TodoWrite)
- Custom configuration with specific settings
- Loading from config file

### 04-logging.ts
**Detailed Logging and Debugging**
```bash
npm run example:logging
```
Demonstrates how to enable verbose logging to see the full orchestration flow, including:
- Agent delegation decisions
- Tool executions
- Conversation history
- Depth tracking

### 05-mcp-integration.ts
**MCP Server Integration**
```bash
npm run example:mcp
```
Shows how to integrate with Model Context Protocol (MCP) servers. Requires `agent-config.json` with MCP server configuration.

## Running Examples

You can run examples in two ways:

1. **Using npm scripts:**
   ```bash
   npm run example:quickstart
   npm run example:orchestration
   npm run example:configuration
   npm run example:logging
   npm run example:mcp
   ```

2. **Direct execution:**
   ```bash
   tsx examples/01-quickstart.ts
   tsx examples/02-orchestration.ts
   tsx examples/03-configuration.ts
   tsx examples/04-logging.ts
   tsx examples/05-mcp-integration.ts
   ```

## Architecture Notes

- **Pull Architecture**: Child agents don't inherit parent context and must gather information via tools
- **Caching Strategy**: File reads are cached for 5 minutes using Claude's ephemeral caching
- **Parallel Execution**: Multiple tool calls can execute in parallel when safe
- **Safety Limits**: Built-in limits prevent infinite loops and excessive token usage

## Testing

For more comprehensive testing, see the test suites:
- **Unit Tests**: `npm run test:unit` - Tests without API calls
- **Integration Tests**: `npm run test:integration` - Tests with real API calls
- **All Tests**: `npm test`

Test files are located in:
- `/tests/unit/` - Unit tests for components
- `/tests/integration/` - Integration tests for features

## Configuration File

Some examples support loading from `agent-config.json`. Example configuration:

```json
{
  "model": "claude-3-5-haiku-latest",
  "agents": {
    "directories": ["./agents"]
  },
  "tools": {
    "builtin": ["read", "write", "list", "task", "todowrite"]
  },
  "safety": {
    "maxIterations": 50,
    "maxDepth": 10
  }
}
```

## Common Issues

1. **Missing API Key**: Ensure `ANTHROPIC_API_KEY` is set in your `.env` file
2. **Build Errors**: Run `npm run build` before running examples
3. **MCP Errors**: MCP server examples require proper server configuration
4. **Timeout Errors**: Complex tasks may timeout - adjust safety limits if needed

## Learn More

- See `/docs` for detailed documentation
- Check `/tests` for comprehensive test examples
- Review agent definitions in `/agents` directory