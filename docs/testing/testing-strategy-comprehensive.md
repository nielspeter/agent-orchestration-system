# Comprehensive Testing Strategy for Agent Orchestration System

> **This is the authoritative testing strategy document, consolidating all testing approaches based on actual system architecture.**

## Table of Contents
1. [Core Principles](#core-principles)
2. [Testing Pyramid](#testing-pyramid)
3. [Implementation Strategy](#implementation-strategy)
4. [Universal Tests](#universal-tests)
5. [Audit Log Testing](#audit-log-testing)
6. [Code Examples](#code-examples)

## Core Principles

### The Foundation: Deterministic Testing of Non-Deterministic Systems

We CAN comprehensively test agent systems by focusing on:
- **Execution mechanics** (tool calls, parameters, sequences)
- **Safety boundaries** (iteration/depth/token limits)
- **Delegation patterns** (who calls whom, with what)
- **Information flow** (pull architecture compliance)

**Key Insight**: "Test the rails, not the train" - Ensure agents follow rules, not exact outputs.

### The Sandwich of Determinism

```
Deterministic Test Layer (validates)
    ↓
Non-deterministic LLM Layer (reasons)
    ↓
Deterministic Tool Layer (executes)
```

## Testing Pyramid

Based on actual system investigation, here's the optimal distribution:

### Level 1: Unit Tests (80%)
**Mock at the LLM Provider level, NOT individual tools**

```typescript
// CORRECT: Mock LLM responses
class MockLLMProvider implements Provider {
  mockResponse(response: LLMResponse) { ... }
  async complete(messages: Message[]): Promise<LLMResponse> { ... }
}

// WRONG: Don't mock individual tools or middleware
// The middleware pipeline is core to the system
```

**What to test:**
- Individual middleware components
- Tool implementations
- Agent logic with mocked LLM responses
- Safety mechanism enforcement

### Level 2: Integration Tests (15%)
**Test agent pairs/triplets with real LLM (cheap model)**

```typescript
// Test specific collaborations
const system = await AgentSystemBuilder.default()
  .withAgent('analyzer', './agents/analyzer.md')
  .withAgent('validator', './agents/validator.md')
  .withModel('anthropic/claude-3-5-haiku-latest') // Cheapest
  .build();
```

**What to test:**
- Delegation chains (A → B → C)
- Information passing between agents
- Pull architecture compliance
- Error propagation

### Level 3: System Tests (5%)
**Full workflows with all agents**

**What to test:**
- End-to-end workflows
- Emergent behavior
- System resilience
- Performance under load

## Implementation Strategy

### Phase 1: Create Core Test Infrastructure

#### 1. MockLLMProvider
```typescript
// tests/mocks/llm-provider.ts
export class MockLLMProvider implements Provider {
  private responses: LLMResponse[] = [];
  private currentIndex = 0;
  
  mockResponse(response: Partial<LLMResponse>) {
    this.responses.push({
      content: response.content || '',
      tool_calls: response.tool_calls || [],
      usage: response.usage || { input: 100, output: 50 }
    });
  }
  
  async complete(messages: Message[]): Promise<LLMResponse> {
    if (this.currentIndex >= this.responses.length) {
      return { content: 'Default response', usage: { input: 100, output: 50 } };
    }
    return this.responses[this.currentIndex++];
  }
}
```

#### 2. Session Log Verifier
```typescript
// tests/utils/session-verifier.ts
export class SessionVerifier {
  constructor(private log: SessionLog) {}
  
  expectToolSequence(tools: string[]) {
    const actual = this.log.toolCalls.map(tc => tc.tool);
    expect(actual).toEqual(tools);
  }
  
  expectDelegation(from: string, to: string) {
    expect(this.log.delegations).toContainEqual(
      expect.objectContaining({ from, to })
    );
  }
  
  expectPullArchitecture(parent: string, child: string, file: string) {
    // Both should read the same file independently
    const parentReads = this.log.toolCalls.filter(tc =>
      tc.agent === parent && tc.tool === 'Read' && 
      tc.params.file_path === file
    );
    const childReads = this.log.toolCalls.filter(tc =>
      tc.agent === child && tc.tool === 'Read' && 
      tc.params.file_path === file
    );
    expect(parentReads.length).toBeGreaterThan(0);
    expect(childReads.length).toBeGreaterThan(0);
  }
}
```

### Phase 2: Universal Tests (Every Agent Must Pass)

#### Universal Test Categories
1. **Safety Boundaries** - Iteration/depth/token limits
2. **Tool Authorization** - Only use allowed tools
3. **Error Recovery** - Handle failures gracefully
4. **Configuration Validity** - Proper YAML/settings
5. **Termination Guarantee** - Eventually stops
6. **Resource Management** - No leaks
7. **Input/Output Contract** - Handle edge cases
8. **Delegation Contract** - Valid task passing

#### Universal Test Runner
```typescript
// tests/universal/runner.ts
export class UniversalTestRunner {
  private executor: AgentExecutor;
  private agents: string[] = [];
  
  async runAllTests(agentName: string): Promise<TestReport> {
    const results = {
      safety: await this.testSafetyBoundaries(agentName),
      tools: await this.testToolAuthorization(agentName),
      errors: await this.testErrorRecovery(agentName),
      config: await this.testConfiguration(agentName),
      termination: await this.testTermination(agentName),
      resources: await this.testResourceManagement(agentName),
      io: await this.testInputOutput(agentName),
      delegation: await this.testDelegation(agentName)
    };
    
    return {
      agent: agentName,
      passed: Object.values(results).every(r => r.passed),
      results
    };
  }
  
  async testSafetyBoundaries(agent: string) {
    // Test iteration limit
    const hugeTask = 'Repeat forever: continue';
    const result = await this.executor.execute(agent, hugeTask);
    const log = this.executor.getSessionLog();
    
    return {
      passed: log.stats.iterations <= 10 && log.stats.depth <= 5,
      details: { iterations: log.stats.iterations, depth: log.stats.depth }
    };
  }
}
```

### Phase 3: Audit Log Mining

#### Why Audit Logs Are Gold
- **Free testing** - Analyze past executions without API costs
- **Pattern detection** - Find issues across ALL historical data
- **Regression detection** - Compare this week to last week
- **Replay testing** - Test new rules against old logs

#### Audit Log Analyzer
```typescript
// tests/audit/analyzer.ts
export class AuditLogAnalyzer {
  private logs: SessionLog[] = [];
  
  async loadLogs(pattern: string = 'logs/*.jsonl') {
    // Load and parse JSONL logs
  }
  
  testNoHallucination(): TestResult {
    const violations = [];
    
    for (const log of this.logs) {
      // If response mentions file contents...
      if (log.response.match(/file contains|shows that/i)) {
        // Must have used Read or Grep
        const hasAccess = log.toolCalls.some(tc =>
          tc.tool === 'Read' || tc.tool === 'Grep'
        );
        if (!hasAccess) {
          violations.push({
            session: log.sessionId,
            issue: 'Claimed knowledge without tool use'
          });
        }
      }
    }
    
    return { passed: violations.length === 0, violations };
  }
  
  detectAnomalies() {
    // Find sessions with unusual patterns
    const anomalies = [];
    const avgIterations = this.average(this.logs.map(l => l.stats.iterations));
    
    for (const log of this.logs) {
      if (log.stats.iterations > avgIterations * 2) {
        anomalies.push({
          type: 'excessive_iterations',
          session: log.sessionId,
          value: log.stats.iterations
        });
      }
    }
    
    return anomalies;
  }
}
```

## Universal Tests

### What Every Agent Must Pass

```typescript
describe('Universal Agent Compliance', () => {
  const agents = getAllAgents();
  
  agents.forEach(agent => {
    describe(`Agent: ${agent}`, () => {
      it('respects iteration limits', () => ...);
      it('respects depth limits', () => ...);
      it('handles errors gracefully', () => ...);
      it('only uses authorized tools', () => ...);
      it('eventually terminates', () => ...);
      it('manages resources properly', () => ...);
    });
  });
});
```

### Compliance Reporting

```typescript
// Generate compliance report
const report = {
  totalAgents: agents.length,
  compliant: passedAgents.length,
  violations: failedAgents.map(a => ({
    agent: a.name,
    failures: a.failedTests
  }))
};

// Block PRs if compliance drops
if (report.compliant < report.totalAgents) {
  process.exit(1);
}
```

## Audit Log Testing

### The Hidden Superpower

Your JSONL logs contain everything needed for comprehensive testing:
- Every tool call with parameters
- Every delegation with context
- Token usage and costs
- Timing and performance data

### Key Patterns to Detect

1. **Tool Hallucination** - Claiming knowledge without tool use
2. **Inefficient Patterns** - Multiple reads of same file
3. **Delegation Cycles** - A → B → A
4. **Cost Spikes** - Expensive operations
5. **Performance Regression** - Slowdowns over time

## Code Examples

### Example 1: Testing Agent with Mocked LLM

```typescript
describe('Analyzer Agent', () => {
  let executor: AgentExecutor;
  let mockProvider: MockLLMProvider;
  
  beforeEach(async () => {
    mockProvider = new MockLLMProvider();
    const system = await AgentSystemBuilder.forTest()
      .withProvider(mockProvider)
      .build();
    executor = system.executor;
  });
  
  it('should use Grep before Read', async () => {
    mockProvider.mockResponse({
      tool_calls: [
        { id: '1', function: { name: 'Grep', arguments: '{"pattern":"TODO"}' }},
        { id: '2', function: { name: 'Read', arguments: '{"file_path":"found.ts"}' }}
      ]
    });
    
    await executor.execute('analyzer', 'Find TODOs');
    
    const log = executor.getSessionLog();
    const tools = log.toolCalls.map(tc => tc.tool);
    expect(tools).toEqual(['Grep', 'Read']);
  });
});
```

### Example 2: Testing Delegation Chain

```typescript
describe('Delegation Chain', () => {
  it('should handle A → B → C', async () => {
    const system = await AgentSystemBuilder.default()
      .withAgentsFrom('./agents')
      .build();
    
    const result = await system.executor.execute(
      'orchestrator',
      'Analyze, validate, and report'
    );
    
    const log = system.executor.getSessionLog();
    const verifier = new SessionVerifier(log);
    
    verifier.expectDelegation('orchestrator', 'analyzer');
    verifier.expectDelegation('analyzer', 'validator');
    expect(log.stats.depth).toBeLessThanOrEqual(5);
  });
});
```

### Example 3: Mining Audit Logs

```typescript
describe('Audit Log Analysis', () => {
  it('should detect tool hallucination', async () => {
    const analyzer = new AuditLogAnalyzer();
    await analyzer.loadLogs('logs/2024-01-*.jsonl');
    
    const result = analyzer.testNoHallucination();
    expect(result.violations).toHaveLength(0);
  });
  
  it('should find performance regression', async () => {
    const analyzer = new AuditLogAnalyzer();
    const thisWeek = await analyzer.analyzeWeek(new Date());
    const lastWeek = await analyzer.analyzeWeek(lastWeekDate);
    
    const regression = thisWeek.avgDuration / lastWeek.avgDuration;
    expect(regression).toBeLessThan(1.2); // No more than 20% slower
  });
});
```

## Test Organization

```
tests/
├── unit/
│   ├── middleware/          # Individual middleware tests
│   ├── tools/              # Individual tool tests
│   └── agents/             # Agent logic with mocked LLM
├── integration/
│   ├── pairs/              # Agent pair interactions
│   └── workflows/          # Complete workflows
├── universal/              # Tests every agent must pass
│   ├── runner.ts
│   └── compliance.ts
├── audit/                  # Log analysis tests
│   ├── analyzer.ts
│   └── patterns.ts
└── mocks/                  # Test utilities
    ├── llm-provider.ts
    └── session-verifier.ts
```

## Cost Optimization

| Test Type | Model | Cost | When to Run |
|-----------|-------|------|-------------|
| Unit | MockLLMProvider | $0 | Every commit |
| Integration | claude-3-5-haiku | $0.001 | Every PR |
| System | claude-3-5-haiku | $0.01 | Before merge |
| Audit | N/A (logs) | $0 | Daily |

## Next Steps

1. **Immediate** (Today)
   - Create MockLLMProvider
   - Set up universal test runner
   - Start mining existing logs

2. **This Week**
   - Implement universal tests for all agents
   - Create compliance reporting
   - Set up CI/CD integration

3. **This Month**
   - Full test pyramid implementation
   - Automated regression detection
   - Performance optimization based on audit logs

## Key Takeaways

1. **Mock at the right level** - LLM provider, not tools
2. **Use session logs** - They're your primary verification mechanism
3. **Universal tests are mandatory** - Every agent must pass
4. **Audit logs are free tests** - Mine them aggressively
5. **Respect the pull architecture** - Children gather their own context

This strategy is based on actual system investigation, not theoretical patterns.