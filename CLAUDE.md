# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development
```bash
npm run build         # TypeScript compilation
npm run dev          # Run src/index.ts with tsx
npm run lint         # Run ESLint
npm run format       # Apply Prettier formatting
```

**IMPORTANT**: After implementing any feature or making code changes, ALWAYS run:
1. `npm run build` (tsc) - Ensure TypeScript compiles without errors
2. `npm run lint` - Check for code quality issues

These checks must pass before considering any feature complete.

### Testing
```bash
npm test             # Run unit tests only (fast, no API)
npm run test:unit:coverage  # Unit tests with coverage report
npm run test:integration    # Integration tests (requires ANTHROPIC_API_KEY)
npm run test:all     # Both unit and integration tests
npm run test:watch   # Watch mode for unit tests

# Run specific test file
npx vitest run tests/unit/specific.test.ts
```

### Examples
```bash
npx tsx examples/quickstart.ts       # Basic agent execution
npx tsx examples/orchestration.ts    # Agent delegation demo
npx tsx examples/configuration.ts    # Config file usage
npx tsx examples/logging.ts          # Logging features
npx tsx examples/mcp-integration.ts  # MCP tool server (time utilities)
npx tsx examples/werewolf-game.ts    # Autonomous multi-agent game
```

## Architecture Overview

### Core Concept: Middleware Pipeline
The system uses a **Chain of Responsibility pattern** where each middleware handles one concern:
1. **ErrorHandlerMiddleware** - Catches all errors, provides fallback responses
2. **AgentLoaderMiddleware** - Loads agent from markdown, filters available tools
3. **ContextSetupMiddleware** - Initializes conversation with system prompt
4. **ProviderSelectionMiddleware** - Selects LLM provider based on model (Anthropic, OpenRouter, etc.)
5. **SafetyChecksMiddleware** - Enforces limits (maxIterations, maxDepth, token estimates)
6. **LLMCallMiddleware** - Calls selected LLM provider with caching support
7. **ToolExecutionMiddleware** - Executes tools and handles agent delegation

### Pull Architecture (Claude Code Style)
When agent A delegates to agent B:
- B receives **only the task**, not parent's conversation history
- B uses tools (Read, Write, List, Grep, Task) to gather needed information
- Anthropic's cache makes repeated reads efficient (90% cost savings)
- Each agent maintains independent context

### Key Design Decisions

**Everything is an Agent**: No special orchestrator class. All agents use the same pipeline and can delegate to others via the Task tool.

**Autonomous Agents**: Agents are self-contained entities with their own knowledge and decision-making:
- Agent configuration lives in markdown files with YAML frontmatter
- Agents receive high-level requests and determine implementation details
- Example: Werewolf game-master knows how to set up and run games without hardcoded rules
- This promotes reusability and true agent autonomy

**Configuration via Builder Pattern**: `AgentSystemBuilder` provides fluent API with presets:
- `.minimal()` - Just AgentExecutor, no tools
- `.default()` - Standard tools (Read, Write, List, Grep, Task, TodoWrite)
- `.forTest()` - Optimized for testing

**Safety First**: Hard limits prevent runaway execution:
- `maxIterations`: Default 10 (prevents infinite loops)
- `maxDepth`: Default 5 (prevents infinite delegation chains)
- `warnAtIteration`: Default 5 (early warning)
- Token estimation before API calls

**Actual vs Estimated Tokens**: 
- Pre-flight estimation (`length/4`) prevents obviously oversized requests
- Actual token counts from API response used for tracking/metrics

### Code Style Guidelines

**TypeScript Best Practices**:
- **NO type assertions** (`as Type`) - Use proper typing or type guards
- **NO `any` types** - Use `unknown` and type guards if type is truly unknown
- **USE type guards** - Proper runtime type checking with type predicates
- **Keep it DRY** - This is an MVP/POC, avoid unnecessary abstractions
- **Prefer explicit types** - Don't rely on inference for public APIs
- **Follow YAGNI** - "You Aren't Gonna Need It" - Don't add functionality until it's actually needed

**Documentation Best Practices**:
- **Use Mermaid diagrams** - Prefer Mermaid diagrams over ASCII art in markdown files
- Mermaid is more maintainable, visually appealing, and renders properly on GitHub
- Example: Use `graph LR` or `sequenceDiagram` instead of ASCII boxes and arrows

Example of good type guard usage:
```typescript
// Good - type guard
function isToolResult(value: unknown): value is ToolResult {
  return typeof value === 'object' && value !== null && 'success' in value;
}

// Bad - type assertion
const result = response as ToolResult; // Avoid this!
```

### File Organization

**Large Files** (need refactoring for production):
- `system-builder.ts` (563 lines) - Configuration builder
- `anthropic-provider.ts` (399 lines) - LLM provider with caching
- `jsonl-logger.ts` (398 lines) - Structured logging

**Middleware** (`src/middleware/`): Each ~50-100 lines, single responsibility

**Tools** (`src/tools/`): Implement `BaseTool` interface, registered in ToolRegistry

**Agents** (`agents/` and `examples/*/agents/`): Markdown files with YAML frontmatter defining agent capabilities

### Testing Strategy

**Unit Tests** (30% coverage on critical paths):
- Safety mechanisms (iteration/depth limits)
- Configuration building
- Tool registry
- No API calls, uses mocks

**Integration Tests** (manual, expensive):
- Real API calls
- End-to-end agent execution
- Run with `npm run test:integration`

### Known Issues & Limitations

1. ~~**Tight Coupling**: AgentExecutor directly instantiates AnthropicProvider~~ ✅ FIXED - Now uses ProviderFactory
2. **Console.log Usage**: 6 instances in production code (should use proper logger)
3. **No Retry Logic**: API failures aren't retried
4. **File Access**: No path restrictions on Read/Write/Grep tools
5. **Large Files**: Several files >400 lines need splitting

### Environment Setup

Required (at least one):
```bash
ANTHROPIC_API_KEY=your-key-here     # For Claude models
OPENROUTER_API_KEY=your-key-here    # For OpenRouter models
```

Optional:
```bash
NODE_ENV=development|production
DISABLE_PROMPT_CACHING=true  # Disable Anthropic caching
```

Multi-Provider Configuration:
```bash
# Copy and customize providers config
cp providers-config.example.json providers-config.json

# Models can be specified as:
# - Direct: "claude-3-5-haiku-latest"
# - Provider prefix: "openrouter/llama-3.1-70b"
```

### Behavior Presets

Agents can specify behavioral characteristics through presets that control temperature and top_p:

```yaml
# In agent markdown frontmatter
---
name: my-agent
behavior: precise  # Uses preset
# OR override specific values:
temperature: 0.3
top_p: 0.7
---
```

Available presets in `providers-config.json`:
- **deterministic** (0.1/0.5): Near-deterministic for validation, routing, business logic
- **precise** (0.2/0.6): Code analysis, verification, structured outputs  
- **balanced** (0.5/0.85): Default orchestration, tool use, general reasoning
- **creative** (0.7/0.95): Storytelling, game mastering, creative content
- **exploratory** (0.9/0.98): Research, brainstorming, generating alternatives

The system applies: Agent settings → Preset → Default (balanced)

For tests, create `.env.test` (not in git):
```bash
ANTHROPIC_API_KEY=test-key-for-integration-tests
```

### MCP (Model Context Protocol) Integration

To use external tool servers:
```typescript
const builder = AgentSystemBuilder.default()
  .withMCPServers({
    filesystem: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    }
  });
```

### Safety Configuration

Default limits in `src/config/types.ts`:
```typescript
{
  maxIterations: 10,      // Max LLM calls per execution
  maxDepth: 5,           // Max delegation depth
  warnAtIteration: 5,    // Console warning threshold
  maxTokensEstimate: 100000  // Pre-flight check limit
}
```