# Developer Guides

## Quick Start Guide

### 1. Basic Setup

```bash
# Clone and install
git clone <repo>
cd agent-orchestration-system
npm install

# Configure environment
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env

# Build the project
npm run build

# Run a simple example
npx tsx examples/01-quickstart.ts
```

### 2. Your First Agent

Create `agents/my-first-agent.md`:

```markdown
---
name: my-first-agent
tools: ["read", "write"]
---

You are a helpful assistant who can read and write files.

When asked to process files:

1. Read the file content
2. Analyze what's needed
3. Write the result

Be concise and accurate.
```

Use it:

```typescript
import {AgentSystemBuilder} from './src/config/system-builder';

const system = await AgentSystemBuilder.default()
  .withAgentsFrom('agents')
  .build();

const result = await system.executor.execute(
  'my-first-agent',
  'Read package.json and summarize the dependencies'
);

console.log(result);
```

## Creating Agents

### Step-by-Step Agent Creation

#### 1. Define the Purpose

Be specific about what the agent does:

- ❌ "You help with code"
- ✅ "You analyze TypeScript code for type safety issues"

#### 2. Create the Agent File

```markdown
---
name: type-checker
tools: ["read", "list"]
---

You are a TypeScript type safety analyzer.

## Your Expertise

- Identify type assertions (as Type)
- Find uses of 'any' type
- Detect missing type annotations
- Suggest type guard implementations

## Process

1. Read the TypeScript file
2. Analyze for type issues
3. Provide specific recommendations

## Output Format

For each issue found:

- Line number
- Issue type
- Current code
- Suggested fix
```

#### 3. Choose Tools Wisely

```yaml
# Minimal - read only
tools: [ "read" ]

# File operations
tools: [ "read", "write", "list" ]

# Orchestrator
tools: [ "task" ]

# Full access (use sparingly)
tools: [ "*" ]
```

#### 4. Test the Agent

```typescript
// test-agent.ts
const system = await AgentSystemBuilder.default()
  .withAgent('agents/type-checker.md')
  .build();

const result = await system.executor.execute(
  'type-checker',
  'Check src/index.ts for type safety'
);
```

### Agent Design Patterns

#### 1. The Specialist

```markdown
---
name: regex-expert
tools: ["read"]
---

You are a regex specialist. You:

- Write complex regular expressions
- Explain regex patterns
- Optimize regex performance
- Convert between regex flavors

Always test patterns with examples.
```

#### 2. The Orchestrator

```markdown
---
name: project-analyzer
tools: ["task", "read", "list"]
---

You analyze projects by coordinating specialists:

1. Use 'code-analyzer' for source code
2. Use 'dependency-checker' for packages
3. Use 'security-scanner' for vulnerabilities

Synthesize their findings into a report.
```

#### 3. The Transformer

```markdown
---
name: markdown-to-html
tools: ["read", "write"]
---

You convert markdown files to HTML:

1. Read the markdown file
2. Parse and convert to HTML
3. Write the HTML output

Preserve formatting and structure.
```

## Creating Tools

### Basic Tool Implementation

#### 1. Define the Tool Class

```typescript
// src/tools/git-tool.ts
import {Tool, ToolInput, ToolOutput} from './types';
import {execSync} from 'child_process';

export class GitTool implements Tool {
  name = 'git';
  description = 'Execute git commands';

  inputSchema = {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        enum: ['status', 'log', 'diff', 'branch']
      },
      args: {
        type: 'array',
        items: {type: 'string'}
      }
    },
    required: ['command']
  };

  async execute(input: ToolInput): Promise<ToolOutput> {
    try {
      const {command, args = []} = input;

      // Validate command is allowed
      const allowedCommands = ['status', 'log', 'diff', 'branch'];
      if (!allowedCommands.includes(command as string)) {
        throw new Error(`Command not allowed: ${command}`);
      }

      // Execute git command
      const fullCommand = `git ${command} ${args.join(' ')}`;
      const output = execSync(fullCommand, {encoding: 'utf-8'});

      return {
        success: true,
        output: output.trim()
      };
    } catch (error) {
      return {
        success: false,
        error: `Git command failed: ${error.message}`
      };
    }
  }
}
```

#### 2. Register the Tool

```typescript
// In system setup
import {GitTool} from './tools/git-tool';

const builder = AgentSystemBuilder.default()
  .withCustomTool(new GitTool());
```

#### 3. Use in Agent

```markdown
---
name: git-helper
tools: ["git", "read"]
---

You help with git operations. You can:

- Check repository status
- View commit history
- Show diffs
- List branches
```

### Tool Best Practices

#### Input Validation

```typescript
async
execute(input
:
ToolInput
):
Promise < ToolOutput > {
  // Validate required fields
  if(!
input.path || typeof input.path !== 'string'
)
{
  return {
    success: false,
    error: 'Path is required and must be a string'
  };
}

// Sanitize inputs
const safePath = path.resolve(input.path);
if (!safePath.startsWith(process.cwd())) {
  return {
    success: false,
    error: 'Path must be within working directory'
  };
}

// ... rest of implementation
}
```

#### Error Handling

```typescript
async
execute(input
:
ToolInput
):
Promise < ToolOutput > {
  try {
    const result = await riskyOperation(input);
    return {success: true, output: result};
  } catch(error) {
    // Provide helpful error messages
    if (error.code === 'ENOENT') {
      return {
        success: false,
        error: `File not found: ${input.path}`
      };
    }

    // Generic fallback
    return {
      success: false,
      error: `Operation failed: ${error.message}`
    };
  }
}
```

## Adding Middleware

### Custom Middleware Example

#### 1. Create Middleware Function

```typescript
// src/middleware/rate-limit.middleware.ts
import {Middleware, MiddlewareContext} from './middleware-types';

export function createRateLimitMiddleware(
  maxCallsPerMinute: number = 10
): Middleware {
  const calls: number[] = [];

  return async (ctx: MiddlewareContext, next: () => Promise<void>) => {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Remove old calls
    while (calls.length > 0 && calls[0] < oneMinuteAgo) {
      calls.shift();
    }

    // Check rate limit
    if (calls.length >= maxCallsPerMinute) {
      throw new Error(`Rate limit exceeded: ${maxCallsPerMinute} calls/minute`);
    }

    // Record this call
    calls.push(now);

    // Continue pipeline
    await next();
  };
}
```

#### 2. Add to Pipeline

```typescript
// In AgentExecutor setup
pipeline
  .use('error-handler', createErrorHandlerMiddleware())
  .use('rate-limit', createRateLimitMiddleware(20))  // Custom
  .use('agent-loader', createAgentLoaderMiddleware())
// ... rest of pipeline
```

## Testing Strategies

### Unit Testing Agents

```typescript
// tests/agents/my-agent.test.ts
import {describe, test, expect} from 'vitest';
import {AgentSystemBuilder} from '../src/config/system-builder';

describe('MyAgent', () => {
  test('processes files correctly', async () => {
    // Create test system with mocks
    const system = await AgentSystemBuilder.forTest()
      .withMockTool('read', async (input) => ({
        success: true,
        output: 'mock file content'
      }))
      .withMockTool('write', async (input) => ({
        success: true,
        output: 'written'
      }))
      .withAgent('agents/my-agent.md')
      .build();

    // Execute agent
    const result = await system.executor.execute(
      'my-agent',
      'Process the file'
    );

    // Verify result
    expect(result).toContain('processed');
  });
});
```

### Integration Testing

```typescript
// tests/integration/full-flow.test.ts
describe('Full Flow', () => {
  test('orchestrator coordinates multiple agents', async () => {
    const system = await AgentSystemBuilder.default()
      .withAgentsFrom('agents')
      .build();

    const result = await system.executor.execute(
      'orchestrator',
      'Analyze and document src/index.ts'
    );

    expect(result).toContain('analysis');
    expect(result).toContain('documentation');
  });
});
```

## Performance Optimization

### 1. Leverage Caching

```typescript
// Reuse system for multiple calls
const system = await AgentSystemBuilder.default().build();

// These calls reuse cached agent prompts
for (const file of files) {
  await system.executor.execute('analyzer', `Analyze ${file}`);
}
```

### 2. Parallel Processing

```typescript
// Process multiple tasks in parallel
const tasks = files.map(file =>
  system.executor.execute('processor', `Process ${file}`)
);

const results = await Promise.all(tasks);
```

### 3. Optimize Agent Prompts

```markdown
---
name: optimized-agent
tools: ["read"]
---

# Concise, focused prompt

You analyze code. Read the file and report issues.

## Check for:

- Syntax errors
- Type issues
- Security problems
```

## Common Patterns

### File Processing Pipeline

```typescript
const system = await AgentSystemBuilder.default()
  .withAgent('agents/reader.md')
  .withAgent('agents/processor.md')
  .withAgent('agents/writer.md')
  .build();

// Read -> Process -> Write
const content = await system.executor.execute('reader', 'Read input.txt');
const processed = await system.executor.execute('processor', content);
await system.executor.execute('writer', `Write to output.txt: ${processed}`);
```

### Multi-Agent Analysis

```typescript
// Different agents analyze different aspects
const codeAnalysis = system.executor.execute('code-analyzer', prompt);
const securityCheck = system.executor.execute('security-scanner', prompt);
const perfAnalysis = system.executor.execute('perf-analyzer', prompt);

const [code, security, perf] = await Promise.all([
  codeAnalysis,
  securityCheck,
  perfAnalysis
]);
```

## Debugging Tips

### 1. Enable Verbose Logging

```typescript
const system = await AgentSystemBuilder.default()
  .withLogLevel('debug')
  .build();
```

### 2. Inspect Conversation Logs

```bash
# Find recent conversation
ls -lt logs/*.jsonl | head -1

# View formatted log
cat logs/2024-*.jsonl | jq '.'
```

### 3. Test with Minimal Tools

```typescript
// Start with minimal tools to isolate issues
const system = await AgentSystemBuilder.minimal()
  .withAgent('agents/problematic.md')
  .build();
```

### 4. Add Debug Output to Agents

```markdown
---
name: debug-agent
tools: ["read"]
---

You help debug issues.

When processing:

1. Log what you're about to do
2. Show intermediate results
3. Explain your reasoning
```

## Security Considerations

### 1. Tool Restrictions

```typescript
// Limit file access
const safePath = path.resolve(input.path);
if (!safePath.startsWith(ALLOWED_DIR)) {
  throw new Error('Access denied');
}
```

### 2. Input Sanitization

```typescript
// Sanitize user inputs
const sanitized = input.replace(/[^\w\s-]/g, '');
```

### 3. Agent Isolation

```yaml
# Restricted agent
---
name: sandboxed
tools: [ "read" ]  # No write access
---
```

### 4. Resource Limits

```typescript
const system = await AgentSystemBuilder.default()
  .withSafetyLimits({
    maxIterations: 5,
    maxDepth: 2,
    maxTokensEstimate: 10000
  })
  .build();
```

## Troubleshooting

### Common Issues and Solutions

**Agent not found**

```bash
# Check agent file exists
ls agents/my-agent.md

# Verify frontmatter
head -10 agents/my-agent.md
```

**Tool execution fails**

```typescript
// Add error details to tool
return {
  success: false,
  error: `Failed at step X: ${error.message}`,
  details: {input, context: error.stack}
};
```

**Infinite loops**

```typescript
// Reduce iteration limit
.
withSafetyLimits({maxIterations: 3})
```

**Memory issues**

```typescript
// Clear system between runs
await system.cleanup();
```

## Related Resources

- [Middleware Architecture](./middleware-architecture.md)
- [Tool System](./tool-system.md)
- [Agent System](./agent-system.md)
- [Configuration](./unified-configuration.md)
- Examples: `examples/` directory
- Tests: `tests/` directory