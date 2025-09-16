# Testing Documentation

## Core Philosophy: Fixture-First Testing

**The Truth**: Testing LLM agents requires testing the **actual LLM behavior**, not imagined responses. Our testing strategy is built on captured real-world interactions stored as JSONL audit logs (fixtures).

## Testing Hierarchy

### 1. Primary: Fixture-Based Testing (95%)
- **What**: Replay captured JSONL audit logs from real LLM interactions
- **Cost**: One-time generation cost (~$0.10), then free forever
- **Value**: Proves the agent works with the ACTUAL model, prompts, and configuration
- **When**: All integration tests, regression tests, CI/CD pipelines

### 2. Supplementary: Mock-Based Testing (5%)
- **What**: Use MockLLMProvider for edge cases impossible to capture
- **Cost**: Developer time to write and maintain
- **Value**: Test error scenarios, network failures, rate limits
- **When**: Unit tests for error handling, TDD for new features

## Quick Start

### Running Existing Fixture Tests

```bash
# Run integration tests with fixtures
npm run test:integration

# Run specific fixture test
npx vitest run tests/integration/critical-illness-claim-structured/
```

### Creating New Fixture Tests

1. **Generate the fixture** (one-time cost):
```typescript
// Run your agent with real LLM
const result = await executor.execute('your-agent', 'test prompt');
// The JSONL is automatically saved to sessions/[sessionId]/events.jsonl
```

2. **Copy to test fixtures**:
```bash
cp -r sessions/abc-123 tests/fixtures/your-test-001
```

3. **Write the test**:
```typescript
import { describeWithFixtures } from '../utils/fixture-runner';

describeWithFixtures({
  name: 'Your Agent Test',
  fixtureDir: 'tests/fixtures/your-test',
  fixtureCount: 1
}, ({ messages, events }) => {
  it('should process correctly', () => {
    const result = ClaimEventParser.parseClaim(messages);
    expect(result.finalOutcome).toBe('approved');
  });
});
```

## Why Fixtures Are Superior

### Real Model Behavior
- **Claude 3.5 Haiku** formats JSON differently than GPT-4
- Each model has unique tool-calling patterns
- Prompts produce different results with different models
- Fixtures capture the ACTUAL behavior, not theoretical behavior

### Zero Ongoing Cost
```
Fixture: Generate once ($0.10) → Run 10,000 times ($0.00)
Mock: Write (30 min) → Maintain forever (hours of dev time)
```

### Production Proof
Fixtures are **evidence** that your agent works:
- Auditable trail for compliance
- Proof of correct behavior at a point in time
- Reproducible results for debugging

## When to Use Mocks (Rare)

Only use MockLLMProvider for scenarios you CAN'T capture:

```typescript
// Network failures
test('handles network timeout', () => {
  mock.mockTimeout(5000);
});

// Rate limits (hard to trigger naturally)
test('handles 429 rate limit', () => {
  mock.mockError({ status: 429 });
});

// Malformed responses (very rare from Claude/GPT)
test('handles invalid JSON', () => {
  mock.mockResponse({ content: '{broken": json{' });
});
```

## Document Structure

### Core Documents
- **[fixture-testing-guide.md](fixture-testing-guide.md)** - How to work with JSONL fixtures
- **[audit-log-mining.md](audit-log-mining.md)** - Extract insights from production logs
- **[edge-case-mocking.md](edge-case-mocking.md)** - When and how to use mocks

### Reference Documents
- **[testing-patterns.md](testing-patterns.md)** - Common test patterns and helpers
- **[migration-guide.md](migration-guide.md)** - Moving from other testing approaches

## Testing Checklist

### For Every New Agent
- [ ] Generate fixtures for happy path
- [ ] Generate fixtures for error cases (if possible)
- [ ] Write fixture-based integration tests
- [ ] Add edge case mock tests (only if needed)

### For Every Agent Change
- [ ] Regenerate affected fixtures
- [ ] Run fixture tests to verify behavior
- [ ] Check for regressions using fixture comparison

### Before Production
- [ ] All fixtures pass
- [ ] Audit logs analyzed for anomalies
- [ ] Performance metrics from fixtures acceptable

## Key Principles

1. **Fixtures are Truth** - They show what actually happens
2. **Mocks are Speculation** - They show what might happen
3. **Generate Once, Test Forever** - Fixtures are free after creation
4. **Test the System, Not Your Imagination** - Real LLM, real tools, real results

## Common Pitfalls to Avoid

❌ **Don't mock everything** - You'll test your mocks, not your system
❌ **Don't skip fixtures** - "Too expensive" is false economy ($0.10 once vs bugs in production)
❌ **Don't over-engineer** - MockLLMProvider is a tool, not a philosophy
❌ **Don't test LLM creativity** - Test that agents follow rules, not exact outputs

## The Bottom Line

**Use fixtures for everything you can capture. Use mocks only for things you can't.**

Your JSONL audit logs are not just logs - they're your test suite. Every production run is a potential test case. Every bug fixed becomes a regression test. Every successful execution proves your system works.

This is not just testing - it's evidence-based engineering.