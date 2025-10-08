# Safety and Resource Management

## Overview

The agent system includes multiple layers of safety mechanisms to prevent:
- **Runaway execution** - Iteration and depth limits
- **Resource exhaustion** - Memory, token, and file size limits
- **Security vulnerabilities** - Command and file path validation
- **Cost overruns** - Token estimation and tracking

## Execution Safety Limits

### SafetyChecksMiddleware

The `SafetyChecksMiddleware` enforces limits on agent execution to prevent infinite loops and resource exhaustion.

#### Configuration

```typescript
interface SafetyConfig {
  maxIterations: number;      // Max LLM calls per agent
  maxDepth: number;           // Max delegation depth
  warnAtIteration: number;    // Console warning threshold
  maxTokensEstimate: number;  // Pre-flight token limit
}
```

Default values:
```typescript
{
  maxIterations: 10,        // Reasonable for most tasks
  maxDepth: 5,             // Prevents deep recursion
  warnAtIteration: 5,      // Early warning
  maxTokensEstimate: 100000 // ~25K words of context
}
```

#### Iteration Limit

Prevents infinite loops where agents keep calling themselves without making progress.

**Example scenario**:
```
Agent gets stuck trying to solve an impossible task:
Iteration 1: Calls tool, gets error
Iteration 2: Tries same tool, gets error
Iteration 3: Tries again, gets error
...
Iteration 10: STOPPED - "Stopped at 10 iterations (safety limit)"
```

**Configuration**:
```typescript
const system = await AgentSystemBuilder.default()
  .withSafetyLimits({
    maxIterations: 15  // Allow more iterations
  })
  .build();
```

**Per-agent override**:
```yaml
---
name: complex-agent
# No agent-level iteration limit (uses system default)
---
```

#### Depth Limit

Prevents infinite delegation chains where agents keep delegating to each other.

**Example scenario**:
```
orchestrator → analyzer → validator → checker → verifier → ...
```

After 5 levels:
```
🛑 Safety limit (checker): Max delegation depth (5) reached
```

**Configuration**:
```typescript
const system = await AgentSystemBuilder.default()
  .withSafetyLimits({
    maxDepth: 3  // Restrict delegation depth
  })
  .build();
```

**Per-agent override**:
```yaml
---
name: orchestrator
maxDepth: 10  # This specific agent can delegate deeper
---
```

#### Token Estimate Limit

Pre-flight check prevents sending oversized requests to the LLM API.

**How it works**:
```typescript
// Rough estimate: 4 chars per token
const estimatedTokens = JSON.stringify(messages).length / 4;

if (estimatedTokens > maxTokens) {
  // Stop before API call
  throw new Error('Token limit estimate exceeded');
}
```

**Context length awareness**:
```typescript
// Uses model's actual context length if available
const maxTokens =
  modelConfig?.contextLength ||     // e.g., 200000 for Claude
  safetyLimits.maxTokensEstimate || // e.g., 100000
  DEFAULTS.TOKEN_ESTIMATE_FALLBACK; // e.g., 128000
```

**Configuration**:
```typescript
const system = await AgentSystemBuilder.default()
  .withSafetyLimits({
    maxTokensEstimate: 150000  // Allow larger context
  })
  .build();
```

#### Warning Threshold

Early warning when iteration count gets high.

```typescript
// At iteration 5 (default warnAtIteration)
console.warn('⚠️ High iteration count: 5 - possible complex task');
```

Helps identify:
- Tasks that are too complex
- Agents that need better prompts
- Potential infinite loops

## Security Validation

### Shell Command Security

The `Shell` tool blocks catastrophic commands that could damage the system.

#### Blocked Patterns

```typescript
const CATASTROPHIC_PATTERNS = [
  /rm\s+(-rf|-fr)\s+\/(?:\s|$)/,  // rm -rf /
  /rm\s+.*--no-preserve-root/,     // Force root deletion
  /mkfs/,                           // Format filesystem
  /dd\s+.*of=\/dev\/[sh]d/,        // Direct disk write
  /:(){ :|:& };:/,                  // Fork bomb
  />\/dev\/[sh]da(?:\s|$)/,        // Overwrite disk
  /chmod\s+-R\s+000\s+\//,         // Remove all permissions
];
```

#### Example Protection

```
Agent tries: shell command="rm -rf /"
Result: ❌ Error: "Security: Blocked catastrophic command: rm -rf /"
```

#### Risky Command Warnings

Commands that might be dangerous but aren't always catastrophic:

```typescript
const riskyPatterns = [/sudo/, /rm\s+-rf/, /chmod/, /chown/];
```

Output:
```
⚠️ Executing potentially risky command: sudo apt-get install ...
```

Agent can still execute these, but you're warned.

### File Path Security

The `Read`, `Write`, and `List` tools block access to sensitive files.

#### Blocked Paths

```typescript
const BLOCKED_PATH_PATTERNS = [
  /\.ssh\/id_[rd]sa/,        // Private SSH keys
  /\.aws\/credentials/,       // AWS credentials
  /\.env$/,                   // Root .env files
  /\/etc\/shadow/,            // Password hashes
  /\.gnupg\//,                // GPG keys
  /\.docker\/config\.json/,   // Docker credentials
  /\.kube\/config/,           // Kubernetes credentials
];
```

#### Example Protection

```
Agent tries: Read path="/home/user/.ssh/id_rsa"
Result: ❌ Error: "Security: Access denied to sensitive file: /home/user/.ssh/id_rsa"
```

#### Sensitive Path Warnings

Paths that might be sensitive but aren't always blocked:

```typescript
const sensitivePaths = [/^\/etc/, /~\//, /\.git\//, /node_modules/];
```

Output:
```
⚠️ Accessing potentially sensitive path: /etc/hosts
```

Agent can still access, but you're warned.

#### Allowed Patterns

Some patterns are safe despite matching sensitive names:

```
✅ .env.example     - Documentation, not sensitive
✅ .env.test       - Test fixtures, not real credentials
✅ .env.template   - Templates for setup
```

## Resource Limits

### File Size Limits

Prevent memory exhaustion from reading/writing huge files.

```typescript
const FILE_LIMITS = {
  maxFileReadSize: 50 * 1024 * 1024,  // 50MB reads
  maxReadLines: 10000,                // 10K lines max
  maxLineLength: 5000,                // 5K chars per line
  maxFileWriteSize: 10 * 1024 * 1024, // 10MB writes
};
```

#### Read Limit Behavior

```typescript
// If file is too large
if (stat.size > FILE_LIMITS.maxFileReadSize) {
  throw new Error('File too large to read safely');
}

// If too many lines requested
if (lines.length > FILE_LIMITS.maxReadLines) {
  lines = lines.slice(0, FILE_LIMITS.maxReadLines);
  content += '\n... [Truncated: exceeded 10K lines]';
}
```

#### Write Limit Behavior

```typescript
// Before writing
if (Buffer.byteLength(content) > FILE_LIMITS.maxFileWriteSize) {
  throw new Error('Content too large to write safely (max 10MB)');
}
```

### Shell Output Limits

Prevent memory exhaustion from long-running commands.

```typescript
const SHELL_LIMITS = {
  maxOutput: 500000,  // 500K chars
  truncateMessage: '\n... [Output truncated - exceeded 500K chars]',
};
```

#### Behavior

```typescript
// After command execution
if (output.length > SHELL_LIMITS.maxOutput) {
  output = output.substring(0, SHELL_LIMITS.maxOutput);
  output += SHELL_LIMITS.truncateMessage;
}
```

#### Buffer Limit

```typescript
execAsync(command, {
  maxBuffer: 1024 * 1024 * 10,  // 10MB buffer
});
```

Prevents child process buffer overflow.

## Cost Management

### Token Tracking

Every LLM call tracks token usage and cost (Anthropic provider).

```typescript
system.eventLogger.on('message:assistant', (event) => {
  console.log('Input tokens:', event.metadata.inputTokens);
  console.log('Output tokens:', event.metadata.outputTokens);
  console.log('Cache read:', event.metadata.cacheReadTokens);
  console.log('Cache write:', event.metadata.cacheWriteTokens);
  console.log('Cost: $', event.metadata.cost);
});
```

### Cost Limits

Implement cost limits in your application:

```typescript
let totalCost = 0;
const BUDGET = 5.00; // $5 budget

system.eventLogger.on('message:assistant', (event) => {
  if (event.metadata?.cost) {
    totalCost += event.metadata.cost;

    if (totalCost > BUDGET) {
      throw new Error(`Budget exceeded: $${totalCost.toFixed(2)}`);
    }
  }
});
```

### Cache Efficiency

Anthropic's prompt caching dramatically reduces costs:

```
First call:  5,000 input tokens @ $0.003/1K = $0.015
Second call: 4,800 cached + 200 new @ $0.0003/1K cached = $0.0006
Savings: 96%
```

See `event.metadata.cacheReadTokens` to track cache hits.

## Safety Best Practices

### Development

```typescript
// Generous limits for development
const system = await AgentSystemBuilder.default()
  .withSafetyLimits({
    maxIterations: 20,       // More room for experimentation
    maxDepth: 10,           // Allow deep delegation
    maxTokensEstimate: 150000  // Larger context
  })
  .build();
```

### Production

```typescript
// Strict limits for production
const system = await AgentSystemBuilder.default()
  .withSafetyLimits({
    maxIterations: 10,       // Standard limit
    maxDepth: 5,            // Reasonable depth
    maxTokensEstimate: 100000, // Prevent oversized requests
  })
  .build();

// Add cost limits
let totalCost = 0;
const DAILY_BUDGET = 100.00;

system.eventLogger.on('message:assistant', (event) => {
  if (event.metadata?.cost) {
    totalCost += event.metadata.cost;
    if (totalCost > DAILY_BUDGET) {
      throw new Error('Daily budget exceeded');
    }
  }
});
```

### Testing

```typescript
// Minimal limits for fast tests
const system = await AgentSystemBuilder.forTest()
  .withSafetyLimits({
    maxIterations: 5,        // Keep tests fast
    maxDepth: 3,            // Shallow delegation
    maxTokensEstimate: 50000   // Smaller context
  })
  .build();
```

## Monitoring Safety Events

### Iteration Warnings

```typescript
system.eventLogger.on('agent:iteration', (event) => {
  if (event.data.iteration >= 8) {
    console.warn(`Agent ${event.data.agent} at iteration ${event.data.iteration}`);
  }
});
```

### Safety Limit Hits

```typescript
// ConsoleLogger automatically logs safety limits
// Output:
// 🛑 Safety limit (agent-name): Max delegation depth (5) reached
// 🛑 Safety limit (agent-name): Stopped at 10 iterations
// 🛑 Safety limit (agent-name): Token limit exceeded
```

### Security Blocks

Shell and file tools log security blocks to console:

```bash
❌ Error: Security: Blocked catastrophic command: rm -rf /
❌ Error: Security: Access denied to sensitive file: ~/.ssh/id_rsa
⚠️ Executing potentially risky command: sudo systemctl restart
⚠️ Accessing potentially sensitive path: /etc/passwd
```

## Adjusting Limits

### When to Increase Limits

**Iterations**:
- Task is legitimately complex
- Agent needs multiple attempts to succeed
- Building something in small steps

```typescript
withSafetyLimits({ maxIterations: 20 })
```

**Depth**:
- Deep delegation tree is intentional
- Orchestrator → Manager → Worker → Helper pattern

```typescript
withSafetyLimits({ maxDepth: 10 })
```

**Tokens**:
- Working with large files
- Complex context requirements
- Long conversation history

```typescript
withSafetyLimits({ maxTokensEstimate: 180000 })
```

### When to Decrease Limits

**Iterations**:
- Testing with simple tasks
- Want to fail fast
- Debugging infinite loops

```typescript
withSafetyLimits({ maxIterations: 5 })
```

**Depth**:
- Flat agent structure
- Avoiding over-delegation
- Simple use cases

```typescript
withSafetyLimits({ maxDepth: 2 })
```

**Tokens**:
- Cost optimization
- Simple tasks
- Testing

```typescript
withSafetyLimits({ maxTokensEstimate: 50000 })
```

## Debugging Safety Issues

### Agent Hit Iteration Limit

**Symptoms**:
```
Stopped at 10 iterations (safety limit)
```

**Investigation**:
1. Check console log for what agent was trying to do
2. Look for repeated failed attempts
3. Check if task is too complex

**Solutions**:
- Increase maxIterations if task is legitimately complex
- Improve agent prompt to be more direct
- Break task into smaller subtasks
- Fix tool errors that cause retries

### Agent Hit Depth Limit

**Symptoms**:
```
Max delegation depth (5) reached
```

**Investigation**:
1. Use SimpleTracer to visualize delegation tree
2. Check if delegation is unnecessary
3. Look for delegation loops

**Solutions**:
- Increase maxDepth if deep delegation is needed
- Flatten agent hierarchy
- Make agents more self-sufficient
- Fix delegation loops

### Agent Hit Token Limit

**Symptoms**:
```
Token limit estimate exceeded: ~120000 tokens
```

**Investigation**:
1. Check what's in the context
2. Look for unnecessary conversation history
3. Check file reads for huge files

**Solutions**:
- Increase maxTokensEstimate
- Read files in chunks instead of all at once
- Clear conversation history if not needed
- Use smaller context windows

## Security Considerations

### POC-Level Security

The current security validation is **POC-level**:

**What it does**:
- ✅ Blocks truly catastrophic commands
- ✅ Blocks obviously sensitive files
- ✅ Warns on risky operations

**What it doesn't do**:
- ❌ Comprehensive command injection prevention
- ❌ Sandbox execution environment
- ❌ Network access controls
- ❌ Fine-grained permission system

### Production Hardening

For production use, consider:

1. **Sandboxing** - Run agents in containers
2. **Network isolation** - Restrict external access
3. **File system restrictions** - Chroot or similar
4. **Command whitelisting** - Only allow specific commands
5. **Audit logging** - Log all file/command access
6. **Rate limiting** - Prevent abuse
7. **Authentication** - Verify agent identity

### Defensive Security Only

**IMPORTANT**: This system is designed for **defensive security only**.

Do NOT use it for:
- ❌ Credential harvesting
- ❌ Vulnerability exploitation
- ❌ Malicious automation
- ❌ Bulk key scanning

Appropriate uses:
- ✅ Security analysis
- ✅ Detection rules
- ✅ Defensive tools
- ✅ Code review
- ✅ Documentation

## See Also

- [Logging and Debugging](./logging-and-debugging.md) - Monitor safety events
- [LLM Provider Integration](./llm-provider-integration.md) - Cost tracking
- [Configuration](./unified-configuration.md) - Safety configuration
- [Event System](./event-system.md) - Safety event emission
