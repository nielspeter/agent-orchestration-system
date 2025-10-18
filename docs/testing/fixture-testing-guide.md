# Fixture Testing Guide

## What Are Fixtures?

Fixtures are captured JSONL audit logs from real agent executions. Each fixture is a complete recording of:
- User prompts
- Agent responses
- Tool calls made
- Delegation chains
- Token usage
- Timing information
- Errors encountered

## Fixture Lifecycle

### 1. Generation (One-Time)
```typescript
// Generate fixture by running agent with real LLM
const result = await executor.execute('claim-processor', 'Process claim for John Doe...');
// Automatically saved to: sessions/[sessionId]/events.jsonl
```

### 2. Preservation
```bash
# Copy session to test fixtures
cp -r sessions/session-123 tests/fixtures/claim-processing/fixture-001

# Commit to git for permanent storage
git add tests/fixtures/claim-processing/fixture-001
git commit -m "test: add fixture for claim processing happy path"
```

### 3. Validation
```typescript
// Test against fixture
describeWithFixtures({
  name: 'Claim Processing',
  fixtureDir: 'tests/fixtures/claim-processing',
  fixtureCount: 3
}, ({ messages, events, sessionId }) => {
  it('processes claim correctly', () => {
    const result = ClaimEventParser.parseClaim(messages);
    expect(result.finalOutcome).toBe('approved');
    expect(result.claimId).toMatch(/^CI-\d{8}-[A-F0-9]{5}$/);
  });

  it('follows correct workflow', () => {
    const workflow = ClaimEventParser.extractWorkflowPath(messages);
    expect(workflow).toEqual([
      'notification-categorization',
      'critical-illness-validator',
      'payment-processor'
    ]);
  });

  it('maintains audit trail', () => {
    const audit = ClaimEventParser.extractAuditTrail(messages);
    expect(audit).toHaveLength(greaterThan(0));
    expect(audit[0]).toHaveProperty('timestamp');
  });
});
```

## Working with Fixtures

### Reading Fixture Data
```typescript
// Fixtures are JSONL files - one JSON object per line
import { readFileSync } from 'fs';

function loadFixture(path: string): any[] {
  const content = readFileSync(path, 'utf-8');
  return content
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}
```

### Parsing Fixture Events
```typescript
// Example: Extract specific event types
function extractToolCalls(events: any[]): ToolCall[] {
  return events
    .filter(e => e.type === 'tool_call')
    .map(e => ({
      tool: e.data.tool,
      params: e.data.params,
      timestamp: e.timestamp
    }));
}

function extractDelegations(events: any[]): Delegation[] {
  return events
    .filter(e => e.type === 'delegation')
    .map(e => ({
      from: e.data.parent,
      to: e.data.child,
      task: e.data.task,
      depth: e.data.depth
    }));
}
```

### Fixture Comparison
```typescript
// Compare fixtures to detect regressions
function compareFixtures(baseline: any[], current: any[]): Diff {
  const diff = {
    toolCallChanges: compareToolCalls(baseline, current),
    delegationChanges: compareDelegations(baseline, current),
    tokenUsageChange: compareTokens(baseline, current),
    durationChange: compareDuration(baseline, current)
  };

  return diff;
}

// Example: Ensure performance hasn't degraded
it('maintains performance characteristics', () => {
  const baseline = loadFixture('fixtures/baseline/events.jsonl');
  const current = loadFixture('fixtures/current/events.jsonl');

  const baselineTokens = extractTokenUsage(baseline);
  const currentTokens = extractTokenUsage(current);

  // Allow 10% variance in token usage
  expect(currentTokens.total).toBeLessThanOrEqual(baselineTokens.total * 1.1);
});
```

## Fixture Organization

### Directory Structure
```
tests/
├── fixtures/
│   ├── claim-processing/
│   │   ├── happy-path-001/
│   │   │   └── events.jsonl
│   │   ├── error-case-001/
│   │   │   └── events.jsonl
│   │   └── edge-case-001/
│   │       └── events.jsonl
│   ├── werewolf-game/
│   │   ├── quick-game-001/
│   │   │   └── events.jsonl
│   │   └── full-game-001/
│   │       └── events.jsonl
│   └── README.md
```

### Naming Conventions
- **Happy path**: `happy-path-001`, `happy-path-002`
- **Error cases**: `error-[type]-001` (e.g., `error-timeout-001`)
- **Edge cases**: `edge-[scenario]-001` (e.g., `edge-max-iterations-001`)
- **Regressions**: `regression-[issue]-001` (e.g., `regression-issue-123-001`)

## Fixture Maintenance

### When to Regenerate Fixtures

1. **Agent prompt changes** - Behavior will be different
2. **Model upgrades** - Claude 3.5 → Claude 4.0
3. **Tool interface changes** - New parameters, different returns
4. **Bug fixes** - Capture corrected behavior

### Regeneration Process
```bash
# 1. Run fixture generator
npm run generate-fixtures

# 2. Review changes
git diff tests/fixtures/

# 3. Validate new behavior is correct
npm run test:fixtures

# 4. Commit if approved
git add tests/fixtures/
git commit -m "test: regenerate fixtures for Claude 3.5 Haiku upgrade"
```

### Fixture Versioning
```typescript
// Track fixture metadata
interface FixtureMetadata {
  version: string;
  generatedAt: string;
  model: string;
  agentVersion: string;
  description: string;
}

// Store alongside fixture
{
  "version": "1.0.0",
  "generatedAt": "2024-01-15T10:00:00Z",
  "model": "anthropic/claude-haiku-4-5",
  "agentVersion": "2.1.0",
  "description": "Happy path for critical illness claim"
}
```

## Advanced Fixture Techniques

### Parameterized Fixtures
```typescript
// Test same behavior across multiple fixtures
const fixtures = [
  'happy-path-001',
  'happy-path-002',
  'happy-path-003'
];

describe.each(fixtures)('Claim processing %s', (fixtureName) => {
  const fixture = loadFixture(`fixtures/claim-processing/${fixtureName}/events.jsonl`);

  it('completes successfully', () => {
    expect(extractFinalOutcome(fixture)).toBeDefined();
  });

  it('generates valid claim ID', () => {
    expect(extractClaimId(fixture)).toMatch(/^CI-\d{8}-[A-F0-9]{5}$/);
  });
});
```

### Fixture Filtering
```typescript
// Test specific aspects of fixtures
function filterByAgent(events: any[], agentName: string): any[] {
  return events.filter(e => e.data?.agent === agentName);
}

function filterByTimeRange(events: any[], start: number, end: number): any[] {
  return events.filter(e => e.timestamp >= start && e.timestamp <= end);
}

// Example: Test only orchestrator behavior
it('orchestrator makes correct decisions', () => {
  const events = loadFixture('fixtures/complex-workflow/events.jsonl');
  const orchestratorEvents = filterByAgent(events, 'claim-orchestrator');

  // Verify orchestrator's specific behavior
  expect(orchestratorEvents).toSatisfyAll(
    event => event.data.iterations <= 5
  );
});
```

### Statistical Analysis
```typescript
// Analyze patterns across fixtures
function analyzeFixtures(fixtureDir: string): Statistics {
  const fixtures = loadAllFixtures(fixtureDir);

  return {
    avgTokensUsed: mean(fixtures.map(f => extractTokens(f).total)),
    avgDuration: mean(fixtures.map(f => extractDuration(f))),
    avgIterations: mean(fixtures.map(f => extractIterations(f))),
    p95Duration: percentile(fixtures.map(f => extractDuration(f)), 95),
    successRate: fixtures.filter(f => extractSuccess(f)).length / fixtures.length
  };
}

// Set performance baselines
it('meets performance SLA', () => {
  const stats = analyzeFixtures('fixtures/production-samples');

  expect(stats.p95Duration).toBeLessThan(10000); // 95% complete in <10s
  expect(stats.avgTokensUsed).toBeLessThan(5000); // Average under 5k tokens
  expect(stats.successRate).toBeGreaterThan(0.99); // 99%+ success rate
});
```

## Debugging with Fixtures

### Replay Specific Sessions
```typescript
// Reproduce issues using fixtures
async function replaySession(fixturePath: string): Promise<void> {
  const events = loadFixture(fixturePath);

  for (const event of events) {
    console.log(`[${event.timestamp}] ${event.type}:`, event.data);

    if (event.type === 'error') {
      console.error('ERROR FOUND:', event.data);
      // Analyze error context
    }
  }
}
```

### Fixture Diffing
```bash
# Use diff tools to compare fixtures
diff -u fixtures/baseline/events.jsonl fixtures/current/events.jsonl

# Or use JSON-aware diff
jq . fixtures/baseline/events.jsonl > baseline.json
jq . fixtures/current/events.jsonl > current.json
diff -u baseline.json current.json
```

## Best Practices

### DO's
✅ **Generate fixtures for all critical paths** - Cover happy paths and known error cases
✅ **Version control fixtures** - They're part of your test suite
✅ **Document fixture purpose** - Add README in each fixture directory
✅ **Validate fixtures before committing** - Ensure they test what you intend
✅ **Use fixtures for regression tests** - Every bug becomes a test case

### DON'Ts
❌ **Don't edit fixtures manually** - Regenerate from real executions
❌ **Don't ignore fixture size** - Large fixtures slow down tests
❌ **Don't test exact output matching** - Test behavior patterns instead
❌ **Don't skip fixture review** - Verify new fixtures are correct before committing

## Conclusion

Fixtures are your proof that the system works. They're not just test data - they're captured reality from your production system. Treat them as first-class citizens in your test suite, and they'll give you confidence that your agents behave correctly with real LLMs in real scenarios.