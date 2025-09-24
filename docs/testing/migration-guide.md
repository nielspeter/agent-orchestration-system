# Testing Migration Guide

## From Mock-First to Fixture-First Testing

### Quick Summary

**Old Approach**: Mock everything, test imaginary behavior
**New Approach**: Use real JSONL fixtures, mock only edge cases

### If You Were Following the Old Docs

The previous testing documentation emphasized MockLLMProvider and complex testing theories. Here's how to migrate:

## Migration Steps

### 1. Identify Your Current Tests

```typescript
// Old: Mock-heavy test
test('agent processes request', () => {
  mock.mockResponse({ content: 'Processing...' });
  mock.mockToolCall('Read', { file: 'test.ts' });
  mock.mockResponse({ content: 'Done' });
  // Testing your mocks, not the agent!
});
```

### 2. Categorize Tests

| Test Type | Migration Action |
|-----------|-----------------|
| **Integration tests with mocks** | Replace with fixtures |
| **Unit tests of components** | Keep mocks if needed |
| **Edge case/error tests** | Keep mocks |
| **Agent behavior tests** | Must use fixtures |

### 3. Generate Fixtures for Integration Tests

```bash
# Run your agent with real LLM to generate fixture
npm run generate-fixture -- --agent claim-processor --prompt "Process claim"

# Copy to test fixtures
cp -r sessions/[sessionId] tests/fixtures/claim-processing/fixture-001
```

### 4. Rewrite Tests Using Fixtures

**Before (Mock-based):**
```typescript
describe('Claim Processing', () => {
  let mock: MockLLMProvider;

  beforeEach(() => {
    mock = new MockLLMProvider();
    mock.mockResponse({ content: '{"approved": true}' });
  });

  test('approves valid claim', async () => {
    const result = await executor.execute('claim-processor', 'claim data');
    expect(JSON.parse(result)).toHaveProperty('approved', true);
  });
});
```

**After (Fixture-based):**
```typescript
import { describeWithFixtures } from '../utils/fixture-runner';
import { ClaimEventParser } from './parser';

describeWithFixtures({
  name: 'Claim Processing',
  fixtureDir: 'tests/fixtures/claim-processing',
  fixtureCount: 3
}, ({ messages, events }) => {
  test('approves valid claim', () => {
    const result = ClaimEventParser.parseClaim(messages);
    expect(result.finalOutcome).toBe('approved');
    expect(result.claimId).toMatch(/^CI-\d{8}-[A-F0-9]{5}$/);
  });

  test('creates audit trail', () => {
    const audit = ClaimEventParser.extractAuditTrail(messages);
    expect(audit.length).toBeGreaterThan(0);
    // Test real audit data, not imagined
  });
});
```

### 5. Keep Mocks Only for Edge Cases

**Keep these mocked:**
```typescript
// Network failures - can't capture
test('handles timeout', () => {
  mock.mockTimeout(5000);
});

// Rate limits - expensive to trigger
test('handles 429', () => {
  mock.mockError({ status: 429 });
});

// Malformed responses - rare in production
test('handles invalid JSON', () => {
  mock.mockResponse({ content: '{invalid' });
});
```

## Common Migration Patterns

### Pattern 1: Testing Tool Usage

**Old (Mock):**
```typescript
test('uses Grep before Read', () => {
  mock.mockToolCall('Grep', { pattern: 'TODO' });
  mock.mockToolCall('Read', { file: 'found.ts' });
  // Proves nothing about real behavior
});
```

**New (Fixture):**
```typescript
test('uses Grep before Read', () => {
  const toolCalls = extractToolCalls(fixture);
  const grepIndex = toolCalls.findIndex(t => t.tool === 'Grep');
  const readIndex = toolCalls.findIndex(t => t.tool === 'Read');
  expect(grepIndex).toBeLessThan(readIndex);
  // Tests actual tool usage pattern
});
```

### Pattern 2: Testing Delegations

**Old (Mock):**
```typescript
test('delegates to validator', () => {
  mock.mockToolCall('Task', {
    subagent_type: 'validator',
    prompt: 'validate this'
  });
});
```

**New (Fixture):**
```typescript
test('delegates to validator', () => {
  const delegations = extractDelegations(fixture);
  expect(delegations).toContainEqual(
    expect.objectContaining({
      to: 'validator',
      from: 'orchestrator'
    })
  );
});
```

### Pattern 3: Testing Output Format

**Old (Mock):**
```typescript
test('returns JSON', () => {
  mock.mockResponse({ content: '{"valid": "json"}' });
  const result = await executor.execute('agent', 'delegate');
  expect(() => JSON.parse(result)).not.toThrow();
});
```

**New (Fixture):**
```typescript
test('returns valid JSON', () => {
  const finalResponse = extractFinalResponse(fixture);
  expect(() => JSON.parse(finalResponse)).not.toThrow();
  // Tests real JSON from real LLM
});
```

## Deprecation Timeline

1. **Immediate**: Start using fixtures for new tests
2. **Week 1**: Migrate critical integration tests to fixtures
3. **Week 2**: Move edge cases to dedicated mock test file
4. **Week 3**: Delete unused mock tests
5. **Month 1**: All tests migrated or removed

## FAQ

### Q: Fixtures are expensive to generate!
**A:** They cost ~$0.10 once, then are free forever. Mocks cost developer time forever.

### Q: What if the LLM behavior changes?
**A:** Regenerate fixtures when you upgrade models. This proves the new model works.

### Q: Fixtures are large files!
**A:** A 10KB fixture that proves real behavior beats a 1KB mock that proves nothing.

### Q: How do I test without internet/API keys?
**A:** Fixtures work offline. They're replaying captured data, not making API calls.

### Q: What about TDD?
**A:** Use mocks for rapid iteration during development, then generate fixtures for the test suite.

## Tools and Helpers

### Fixture Runner
```typescript
import { describeWithFixtures } from 'tests/utils/fixture-runner';
```

### Event Parsers
```typescript
import { ClaimEventParser } from 'tests/integration/parsers';
```

### Mock Provider (Edge Cases Only)
```typescript
import { MockLLMProvider } from 'tests/mocks/mock-llm-provider';
```

## Getting Help

1. See `docs/testing/fixture-testing-guide.md` for fixture details
2. See `docs/testing/edge-case-mocking.md` for valid mock use cases
3. See `docs/testing/audit-log-mining.md` for production insights

## The Golden Rule

**If you can capture it with a real LLM call, use a fixture.**
**If you can't capture it (network error, rate limit), use a mock.**

That's it. That's the whole strategy.