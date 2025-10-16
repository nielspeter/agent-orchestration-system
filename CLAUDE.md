# CLAUDE.md

This file provides guidance for AI assistants when working with code in this repository.

## Essential Commands

### Development
```bash
npm run build         # TypeScript compilation (all packages)
npm run dev          # Run src/index.ts with tsx
npm run lint         # Run ESLint
npm run format       # Apply Prettier formatting

# CLI-specific commands
npm run build:cli    # Build CLI package
npm run cli          # Run CLI tool
npm run cli -- -p "test"  # Run CLI with arguments
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
# Core examples
npx tsx examples/quickstart.ts       # Basic agent execution
npx tsx examples/orchestration.ts    # Agent delegation demo
npx tsx examples/configuration.ts    # Config file usage
npx tsx examples/logging.ts          # Logging features
npx tsx examples/mcp-integration.ts  # MCP tool server (time utilities)
npx tsx examples/werewolf-game.ts    # Autonomous multi-agent game

# CLI usage - run mode
npm run cli -- -p "Hello, world!"    # Basic CLI usage
echo "test" | npm run cli            # stdin support
npm run cli -- --list-agents         # List available agents

# CLI usage - serve mode (web UI)
npm run cli:serve                    # Start web server on localhost:3000
npm run cli -- serve --open          # Start server and open browser
npm run cli -- serve --working-dir ~/my-project --port 8080
```

## Security & Reliability

**IMPORTANT**: This system includes built-in security features. See [Security Documentation](docs/security.md) for details.

### Built-in Protections
- **File Security**: Blocks access to sensitive files (.ssh, .aws, .env, etc.)
- **Shell Security**: Prevents catastrophic commands (rm -rf /, fork bombs)
- **Rate Limit Retry**: Stateless exponential backoff with jitter for 429 errors (works across all providers)
- **Timeouts**: Configurable timeouts on all tool executions
- **Size Limits**: Prevents memory exhaustion (50MB read, 10MB write)
- **Metrics**: Token usage, cache hit rates, cost tracking
- **CLI Security**: stdin size limit (10MB), timeout protection (30s), signal handling, EPIPE handling

For production readiness assessment, see [Production Readiness](docs/production-readiness.md).

## Architecture Overview

### Core Concept: Middleware Pipeline
The system uses a **Chain of Responsibility pattern** where each middleware handles one concern:
1. **ErrorHandlerMiddleware** - Catches all errors, provides fallback responses
2. **AgentLoaderMiddleware** - Loads agent from markdown, filters available tools
3. **ThinkingMiddleware** - Validates and normalizes thinking configuration
4. **ContextSetupMiddleware** - Initializes conversation with system prompt
5. **ProviderSelectionMiddleware** - Selects LLM provider based on model (Anthropic, OpenRouter, etc.)
6. **SafetyChecksMiddleware** - Enforces limits (maxIterations, maxDepth, token estimates)
7. **SmartRetryMiddleware** - Retries on rate limit errors (429) with exponential backoff
8. **LLMCallMiddleware** - Calls selected LLM provider with caching support
9. **ToolExecutionMiddleware** - Executes tools and handles agent delegation

### Pull Architecture
When agent A delegates to agent B:
- B receives **only the task**, not parent's conversation history
- B uses tools (Read, Write, List, Grep, Delegate) to gather needed information
- Anthropic's cache makes repeated reads efficient (90% cost savings)
- Each agent maintains independent context

### Key Design Decisions

**Everything is an Agent**: No special orchestrator class. All agents use the same pipeline and can delegate to others via the Delegate tool.

**Autonomous Agents**: Agents are self-contained entities with their own knowledge and decision-making:
- Agent configuration lives in markdown files with YAML frontmatter
- Agents receive high-level requests and determine implementation details
- Example: Werewolf game-master knows how to set up and run games without hardcoded rules
- This promotes reusability and true agent autonomy

**Configuration via Builder Pattern**: `AgentSystemBuilder` provides fluent API with presets:
- `.minimal()` - Just AgentExecutor, no tools
- `.default()` - Standard tools (Read, Write, List, Grep, Delegate, TodoWrite)
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
- **Follow YAGNI** - "You Aren't Gonna Need It" - Don't implement features, abstractions, or optimizations just because you think you might need them in the future — you probably won't. Instead, focus on what is required right now

### Engineering Principles

**NEVER GIVE UP ON IMPLEMENTATION**:
- **Think before reverting** - When something doesn't work, ANALYZE the problem first, don't just immediately rollback
- **Complete what you start** - Whether refactoring or implementing new features, see it through
- **Fix errors, don't revert** - When you encounter compilation errors or test failures, FIX them
- **No random attempts** - Think carefully about the solution; don't just try random things hoping they'll work
- **Ask for help** - If you're stuck, ask the user: "I'm getting these errors, should I fix them or try a different approach?"
- **Don't chicken out** - NEVER revert working changes just because of fixable errors
- **No backward compatibility needed** - This is an MVP, breaking changes are acceptable

**Problem-Solving Approach**:
1. When a new feature or change doesn't work immediately:
   - **STOP and THINK** - Analyze why it's not working
   - Investigate the actual root cause
   - Propose a thoughtful solution
   - NEVER: Immediately revert without analysis

2. When you encounter errors after changes, your options are (in order):
   - Understand the error first
   - Fix the errors systematically
   - Ask for guidance with specific questions
   - NEVER: Silently revert and delete your work

3. If implementation creates many errors:
   - List and categorize the errors
   - Identify patterns or common causes
   - Propose solutions based on understanding
   - Ask user preference
   - NEVER: Just give up and revert without user acceptance

**Example of BAD behavior** (what NOT to do):
```
❌ "The feature isn't working. Let me try a different approach."
❌ "There are compilation errors. Let me revert to the original."
❌ *Tries random fixes without understanding the problem*
❌ *Silently deletes new files and restores old ones*
```

**Example of GOOD behavior** (what TO do):
```
✅ "The feature isn't working because [specific reason]. Let me fix this by [specific solution]."
✅ "I'm getting type errors in 3 components. They all relate to the new interface. Let me update them to match."
✅ "The implementation has 15 type errors. Should I:
   1. Fix them systematically (I see they're mostly about missing properties)
   2. Show you the errors for guidance
   3. Try a different approach (with your approval)?"
```

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
- `system-builder.ts` (845 lines) - Configuration builder - TOO LARGE
- `anthropic-provider.ts` (399 lines) - LLM provider with caching - Acceptable
- `jsonl-logger.ts` (398 lines) - Structured logging - Acceptable

**Middleware** (`src/middleware/`): Each ~50-100 lines, single responsibility

**Tools** (`src/tools/`): Implement `BaseTool` interface, registered in ToolRegistry

**Agents** (`agents/` and `packages/examples/*/agents/`): Markdown files with YAML frontmatter defining agent capabilities

### Testing Strategy

**Unit Tests** (203 tests, ~65% coverage):
- Safety mechanisms (iteration/depth limits)
- Configuration building  
- Tool registry
- Session persistence and recovery
- Storage implementations
- Event logging
- No API calls, uses mocks

**Integration Tests** (manual, expensive):
- Real API calls
- End-to-end agent execution
- Run with `npm run test:integration`

### Known Issues & Limitations

1. ~~**Tight Coupling**: AgentExecutor directly instantiates AnthropicProvider~~ ✅ FIXED - Now uses ProviderFactory
2. **Console.log Usage**: 27 instances in ConsoleLogger (intentional for console output)
3. ~~**No Retry Logic**: API failures aren't retried~~ ✅ FIXED - Smart retry with exponential backoff implemented
4. ~~**File Access**: No path restrictions on Read/Write/Grep tools~~ ✅ FIXED - Security validation implemented
5. **Large Files**: SystemBuilder is 845 lines (needs refactoring)
6. ~~**No API Rate Limiting**: Could exhaust quotas~~ ✅ FIXED - Smart retry with exponential backoff handles 429 errors
7. **No Authentication**: System has no user management

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

# Models must use provider prefix format:
# - Anthropic: "anthropic/claude-3-5-haiku-latest"
# - OpenAI: "openai/gpt-4-turbo"
# - OpenRouter: "openrouter/meta-llama/llama-3.1-70b"
# - With modifiers: "openrouter/gpt-4:nitro"
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

Available presets in `providers-config.json` (default model and behavior are configured in `agent-config.json`):
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

### Code-First Configuration (No Files Required)

**IMPORTANT**: Configuration files (`agent-config.json`, `providers-config.json`) are now **optional**. The system supports fully programmatic configuration, which is the preferred approach for:

- **Testing**: Inject controlled configuration without file dependencies
- **Secret Managers**: Load API keys from AWS Secrets Manager, Vault, etc.
- **Library Usage**: Embed the agent system in other applications
- **CI/CD**: Dynamically configure based on environment

**Key Methods:**
- `.withProvidersConfig(config)` - Provide ProvidersConfig object instead of loading from file
- `.withAPIKeys(keys)` - Provide API keys programmatically (overrides environment variables)

**Example (Secret Manager Integration):**
```typescript
import { AgentSystemBuilder, type ProvidersConfig } from '@agent-system/core';

// Define providers config in code
const providersConfig: ProvidersConfig = {
  providers: {
    anthropic: {
      type: 'native',
      apiKeyEnv: 'ANTHROPIC_API_KEY',
    },
  },
  behaviorPresets: {
    balanced: { temperature: 0.5, top_p: 0.85 },
  },
};

// Load API keys from secret manager
const apiKeys = {
  ANTHROPIC_API_KEY: await secretManager.get('anthropic-api-key'),
};

const { executor, cleanup } = await AgentSystemBuilder.default()
  .withModel('anthropic/claude-3-5-haiku-latest')
  .withProvidersConfig(providersConfig)
  .withAPIKeys(apiKeys)
  .build();
```

**API Key Precedence:**
1. Programmatic keys (`.withAPIKeys()`) - highest priority
2. Environment variables (`process.env`) - fallback

**When to Use:**
- ✅ Testing: Inject test keys without touching environment
- ✅ Production: Load from secret managers (AWS, Vault, etc.)
- ✅ Library: Embed in other applications
- ✅ Dynamic: Build configuration at runtime
- ❌ Simple scripts: File-based config is still fine for quick scripts

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

### Smart Retry Configuration

The system includes automatic retry logic for rate limit errors (HTTP 429) from all providers (Anthropic, OpenAI, OpenRouter).

**Design Philosophy**:
- **Stateless**: No coordination between processes needed
- **Reactive**: Responds to actual rate limit errors, doesn't predict
- **Universal**: Works with all LLM providers
- **Self-Organizing**: Exponential backoff + jitter naturally spaces out requests across processes

**Default Configuration**:
```typescript
{
  maxRetries: 5,           // Maximum number of retry attempts
  baseBackoffMs: 1000,     // Base backoff duration (1 second)
  maxBackoffMs: 60000,     // Maximum backoff duration (60 seconds)
  jitterFactor: 0.3,       // Jitter for randomization (±30%)
  respectRetryAfter: true  // Respect provider's retry-after headers
}
```

**How It Works**:
1. When an LLM call returns a 429 error, the middleware automatically retries
2. Backoff grows exponentially: 1s → 2s → 4s → 8s → 16s
3. Jitter (±30%) prevents thundering herd (all processes retrying at once)
4. If provider includes a `retry-after` header, the longer of calculated backoff or provider suggestion is used
5. After max retries, the error is re-thrown to the error handler

**Retry Progression Example**:
- Attempt 1: Immediate (no wait)
- Attempt 2: Wait 1s (with ±30% jitter = 0.7-1.3s)
- Attempt 3: Wait 2s (with ±30% jitter = 1.4-2.6s)
- Attempt 4: Wait 4s (with ±30% jitter = 2.8-5.2s)
- Attempt 5: Wait 8s (with ±30% jitter = 5.6-10.4s)
- Attempt 6: Wait 16s (with ±30% jitter = 11.2-20.8s)

The middleware is integrated automatically in the pipeline and requires no configuration. For custom retry behavior, the smart retry middleware can be configured when building the system (though this is rarely needed).

## Git Commit Guidelines

When creating git commits:

**DO NOT include these lines in commit messages:**
- `🤖 Generated with Claude Code`
- `Co-Authored-By: Claude <noreply@anthropic.com>`

**DO include:**
- Clear, concise subject line (50 chars or less)
- Detailed body explaining what and why (not how)
- Reference issue numbers if applicable
- Breaking changes noted explicitly

**Good commit message example:**
```
fix(thinking): preserve thinking blocks in multi-turn conversations

Fixed API rejection errors where thinking blocks were lost during
format conversion. Added raw_content field to Message type to
preserve original API response structure.

- Fixes multi-turn conversation failures
- Adds 38 new unit tests
- Updates documentation
```

**Bad commit message example:**
```
fix some stuff

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>
```