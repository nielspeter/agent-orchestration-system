# Agent Orchestration System - TypeScript PoC

A minimalist agent orchestration system where **everything is an agent** and orchestration emerges through recursive composition.

## Core Principle

There is no "orchestrator" class - orchestration capability comes from giving an agent access to the `Task` tool, which can invoke other agents. This creates a beautifully simple recursive architecture.

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Set up your API key:
```bash
cp .env.example .env
# Edit .env with your OpenAI or OpenRouter API key
```

3. Run the test:
```bash
npm test
```

## Architecture

### Everything is an Agent
- All agents use the same execution loop
- Agents are defined as markdown files with frontmatter
- No special orchestrator logic in the system

### Delegation via Tools
- The `Task` tool enables agent-to-agent delegation
- It's just another tool - nothing special about it
- The AgentExecutor handles Task tool specially to make recursive calls

### File Structure
```
poc-typescript/
├── src/
│   ├── core/
│   │   ├── agent-executor.ts    # Main execution loop
│   │   ├── agent-loader.ts      # Loads agents from markdown
│   │   └── tool-registry.ts     # Manages available tools
│   ├── tools/
│   │   ├── task-tool.ts         # The delegation tool
│   │   └── file-tools.ts        # Basic file operations
│   ├── llm/
│   │   └── provider.ts          # LLM interface (OpenAI)
│   └── index.ts                 # Main entry point
├── agents/
│   ├── orchestrator.md          # Root agent with Task tool
│   ├── code-analyzer.md         # Specialist for code analysis
│   ├── summarizer.md            # Specialist for summarization
│   └── writer.md                # Specialist for writing
└── package.json
```

## How It Works

1. **User Request** → Goes to orchestrator agent
2. **Orchestrator Reasons** → Using LLM with its system prompt
3. **Decision Point**:
   - Handle directly with available tools (read, write, list)
   - Delegate to specialist via Task tool
4. **Task Tool** → Recursively calls AgentExecutor with subagent
5. **Results Flow Back** → Through the call stack to user

## Creating New Agents

Create a markdown file in `agents/` directory:

```markdown
---
name: my-agent
tools: ["read", "write"]  # or "*" for all tools
---

You are a specialist agent that...
[System prompt describing the agent's role]
```

## Key Insights

- **No Orchestration Logic**: The system has no special coordination code
- **Recursive Simplicity**: One function (`executeAgent`) handles everything
- **Tool-Based Extension**: All capabilities are tools, including delegation
- **LLM Native**: Uses OpenAI's function calling directly

## Example Output

```
📝 Test 1: Direct file operation
Orchestrator handles this directly using the list tool

🔍 Test 2: Code analysis delegation  
Orchestrator delegates to code-analyzer specialist

🎯 Test 3: Multi-agent workflow
Orchestrator coordinates multiple specialists for complex task
```

## The Magic

The entire orchestration capability comes from this simple pattern:
- Orchestrator has `Task` tool in its tool list
- Task tool's execute method calls AgentExecutor recursively
- That's it - orchestration emerges from this recursion