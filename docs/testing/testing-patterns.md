# Testing Patterns

## Common Patterns for Fixture-Based Testing

### Pattern 1: Validate Workflow Sequence

```typescript
// Ensure agents are called in correct order
test('follows expected workflow', () => {
  const workflow = extractWorkflowPath(fixture);

  expect(workflow).toEqual([
    'intake-agent',
    'validation-agent',
    'processing-agent',
    'notification-agent'
  ]);
});
```

### Pattern 2: Verify No Hallucination

```typescript
// Ensure agent only claims what it actually read
test('no hallucination of file contents', () => {
  const messages = parseMessages(fixture);

  for (const msg of messages) {
    if (msg.content.includes('file contains')) {
      // Must have a preceding Read or Grep
      const recentTools = getRecentTools(messages, msg.index);
      expect(recentTools).toContain(anyOf(['Read', 'Grep']));
    }
  }
});
```

### Pattern 3: Check Tool Efficiency

```typescript
// Ensure no duplicate operations
test('no redundant file reads', () => {
  const reads = extractToolCalls(fixture)
    .filter(tc => tc.tool === 'Read')
    .map(tc => tc.params.file_path);

  const uniqueReads = [...new Set(reads)];
  expect(reads.length).toBe(uniqueReads.length);
});
```

### Pattern 4: Validate Delegation Depth

```typescript
// Ensure delegation chain isn't too deep
test('respects delegation depth limit', () => {
  const delegations = extractDelegations(fixture);
  const maxDepth = Math.max(...delegations.map(d => d.depth), 0);

  expect(maxDepth).toBeLessThanOrEqual(5); // MAX_DEPTH
});
```

### Pattern 5: Performance Benchmarking

```typescript
// Ensure performance hasn't degraded
test('maintains performance baseline', () => {
  const stats = extractPerformanceStats(fixture);

  expect(stats.totalDuration).toBeLessThan(10000); // 10s max
  expect(stats.totalTokens).toBeLessThan(5000);
  expect(stats.iterations).toBeLessThanOrEqual(10);
});
```

### Pattern 6: Error Recovery

```typescript
// Verify graceful error handling
test('recovers from tool errors', () => {
  const errors = extractErrors(fixture);
  const finalOutcome = extractFinalOutcome(fixture);

  if (errors.length > 0) {
    // Should still complete successfully
    expect(finalOutcome).toBeDefined();
    expect(finalOutcome).not.toContain('ERROR');
  }
});
```

### Pattern 7: Cost Tracking

```typescript
// Monitor cost per execution
test('stays within cost budget', () => {
  const tokens = extractTokenUsage(fixture);
  const cost = calculateCost(tokens);

  expect(cost).toBeLessThan(0.01); // $0.01 per execution

  // Verify caching is working
  const cacheRate = tokens.cached / tokens.total;
  expect(cacheRate).toBeGreaterThan(0.5); // 50%+ cache hit rate
});
```

### Pattern 8: Output Validation

```typescript
// Validate structured output format
test('produces valid JSON output', () => {
  const response = extractFinalResponse(fixture);

  // Should parse without errors
  const parsed = JSON.parse(response);

  // Should match expected schema
  expect(parsed).toMatchObject({
    status: expect.any(String),
    result: expect.any(Object),
    metadata: expect.any(Object)
  });
});
```

### Pattern 9: Audit Trail Completeness

```typescript
// Ensure audit trail captures all decisions
test('maintains complete audit trail', () => {
  const audit = extractAuditTrail(fixture);
  const decisions = extractDecisionPoints(fixture);

  // Every decision should be in audit trail
  for (const decision of decisions) {
    expect(audit).toContainEqual(
      expect.objectContaining({
        action: decision.action,
        timestamp: expect.any(String)
      })
    );
  }
});
```

### Pattern 10: Cross-Agent Communication

```typescript
// Verify information passed between agents
test('preserves context across delegations', () => {
  const delegations = extractDelegations(fixture);

  for (const delegation of delegations) {
    // Child should receive necessary context
    const childMessages = filterByAgent(fixture, delegation.to);
    const contextReceived = extractContext(childMessages[0]);

    expect(contextReceived).toContainEqual(
      expect.objectContaining({
        task: delegation.task
      })
    );
  }
});
```

## Test Helpers

### Common Extractors

```typescript
// Extract specific event types
export function extractByType(fixture: any[], type: string): any[] {
  return fixture.filter(event => event.type === type);
}

// Extract events within time window
export function extractTimeWindow(
  fixture: any[],
  start: number,
  end: number
): any[] {
  return fixture.filter(e =>
    e.timestamp >= start && e.timestamp <= end
  );
}

// Extract by agent name
export function extractByAgent(
  fixture: any[],
  agentName: string
): any[] {
  return fixture.filter(e => e.data?.agent === agentName);
}
```

### Common Validators

```typescript
// Validate no infinite loops
export function validateNoInfiniteLoops(fixture: any[]): boolean {
  const iterations = countIterations(fixture);
  return iterations <= MAX_ITERATIONS;
}

// Validate proper termination
export function validateProperTermination(fixture: any[]): boolean {
  const lastEvent = fixture[fixture.length - 1];
  return lastEvent.type === 'session_end' ||
         lastEvent.type === 'final_response';
}

// Validate tool authorization
export function validateToolAuthorization(
  fixture: any[],
  agent: Agent
): boolean {
  const toolCalls = extractToolCalls(fixture);
  const allowedTools = agent.tools === '*'
    ? getAllTools()
    : agent.tools;

  return toolCalls.every(tc => allowedTools.includes(tc.tool));
}
```

### Statistical Helpers

```typescript
// Calculate percentiles
export function percentile(values: number[], p: number): number {
  const sorted = values.sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[index];
}

// Calculate mean
export function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// Calculate standard deviation
export function stddev(values: number[]): number {
  const m = mean(values);
  const variance = mean(values.map(v => Math.pow(v - m, 2)));
  return Math.sqrt(variance);
}
```

## Fixture Comparison Patterns

### Regression Detection

```typescript
test('no performance regression', () => {
  const baseline = loadFixture('baseline/happy-path');
  const current = loadFixture('current/happy-path');

  const baselineStats = extractStats(baseline);
  const currentStats = extractStats(current);

  // Allow 10% variance
  expect(currentStats.duration).toBeLessThanOrEqual(
    baselineStats.duration * 1.1
  );
  expect(currentStats.tokens).toBeLessThanOrEqual(
    baselineStats.tokens * 1.1
  );
});
```

### Behavior Consistency

```typescript
test('consistent behavior across runs', () => {
  const fixtures = [
    'run-001/events.jsonl',
    'run-002/events.jsonl',
    'run-003/events.jsonl'
  ].map(loadFixture);

  const outcomes = fixtures.map(extractFinalOutcome);

  // All runs should have same outcome
  expect(new Set(outcomes).size).toBe(1);
});
```

## Anti-Patterns to Avoid

### ❌ Testing Exact Content Match

```typescript
// BAD: Too brittle
test('exact response', () => {
  expect(response).toBe('I will process your claim now.');
});

// GOOD: Test intent/structure
test('response indicates processing', () => {
  expect(response.toLowerCase()).toContain('process');
  expect(response).toMatch(/claim|request/i);
});
```

### ❌ Testing Implementation Details

```typescript
// BAD: Testing internals
test('uses specific middleware order', () => {
  expect(middlewareStack[0]).toBe('ErrorHandler');
});

// GOOD: Test observable behavior
test('handles errors gracefully', () => {
  const errors = extractErrors(fixture);
  expect(finalResponse).not.toContain('ERROR');
});
```

### ❌ Over-Mocking

```typescript
// BAD: Mocking what you can capture
test('normal workflow', () => {
  mock.mockResponse(...);
  mock.mockToolCall(...);
});

// GOOD: Use real fixture
test('normal workflow', () => {
  const fixture = loadFixture('workflow-001');
  validateWorkflow(fixture);
});
```

## Conclusion

These patterns help you write robust tests that:
- Validate behavior, not implementation
- Use real data from fixtures
- Focus on observable outcomes
- Track performance and costs
- Ensure safety and limits

Remember: Test what matters to users, not what's easy to test.