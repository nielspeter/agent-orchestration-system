# Edge Case Mocking Guide

## When to Use Mocks (5% of Tests)

MockLLMProvider exists for one reason: **testing scenarios that are impossible or impractical to capture with real LLM calls**.

## Valid Use Cases for Mocks

### 1. Network and Infrastructure Failures
```typescript
// These can't be reliably triggered with real API calls
describe('Network failure handling', () => {
  test('handles connection timeout', async () => {
    const mock = new MockLLMProvider();
    mock.mockTimeout(5000);

    const system = await AgentSystemBuilder.default()
      .withProvider(mock)
      .build();

    await expect(system.executor.execute('agent', 'delegate'))
      .rejects.toThrow('timeout');
  });

  test('handles rate limiting', async () => {
    const mock = new MockLLMProvider();
    mock.mockError({
      status: 429,
      message: 'Rate limit exceeded',
      headers: { 'retry-after': '60' }
    });

    // Verify retry logic works
  });
});
```

### 2. Malformed LLM Responses
```typescript
// Modern LLMs rarely produce malformed JSON, but we should handle it
test('handles malformed JSON response', async () => {
  const mock = new MockLLMProvider();
  mock.mockResponse({
    content: '{"status": "complete", "data": {broken json here'
  });

  const result = await system.executor.execute('json-agent', 'delegate');
  expect(result).toContain('error'); // Should handle gracefully
});

test('handles incomplete tool calls', async () => {
  const mock = new MockLLMProvider();
  mock.mockResponse({
    tool_calls: [{
      id: 'call_123',
      type: 'function',
      function: {
        name: 'Read',
        arguments: '{"file_path": ' // Incomplete JSON
      }
    }]
  });

  // Should handle gracefully, not crash
});
```

### 3. Testing Safety Limits
```typescript
// Test iteration limits without wasting API calls
test('respects MAX_ITERATIONS limit', async () => {
  const mock = new MockLLMProvider();

  // Queue 20 responses that keep requesting more iterations
  for (let i = 0; i < 20; i++) {
    mock.mockToolCall('Read', { file_path: `/file${i}.ts` });
  }

  const result = await system.executor.execute('agent', 'delegate');

  // Should stop at MAX_ITERATIONS (10), not continue to 20
  expect(mock.getCallCount()).toBeLessThanOrEqual(10);
});

test('respects MAX_DEPTH limit', async () => {
  const mock = new MockLLMProvider();

  // Mock infinite delegation chain
  for (let i = 0; i < 10; i++) {
    mock.mockToolCall('Task', {
      subagent_type: 'child-agent',
      prompt: 'Delegate further'
    });
  }

  // Should stop at MAX_DEPTH (5)
  const result = await system.executor.execute('parent', 'delegate');
  expect(result).not.toContain('Maximum depth exceeded');
});
```

### 4. TDD for New Components
```typescript
// When developing new middleware or tools, mocks help iterate quickly
describe('New middleware component', () => {
  test('transforms response correctly', async () => {
    const mock = new MockLLMProvider();
    mock.mockResponse({ content: 'Original response' });

    const middleware = new CustomTransformMiddleware();
    // Test middleware behavior without API calls
  });
});
```

### 5. Unit Testing Specific Components
```typescript
// Test individual components in isolation
describe('Tool Registry', () => {
  test('filters tools by agent configuration', () => {
    const mock = new MockLLMProvider();
    mock.mockToolCall('Read', { file_path: '/test.ts' });
    mock.mockToolCall('Write', { file_path: '/test.ts', content: 'data' });

    const agent = {
      tools: ['Read'] // Only Read allowed
    };

    // Verify Write tool is filtered out
  });
});
```

## What NOT to Mock

### ❌ Normal Agent Behavior
```typescript
// WRONG: Don't mock expected behavior
test('agent processes claim', async () => {
  mock.mockResponse({ content: '{"approved": true}' });
  // This proves nothing about real behavior!
});

// RIGHT: Use fixtures
test('agent processes claim', async () => {
  const fixture = loadFixture('claim-processing/happy-path-001');
  // This proves it actually works with real LLM
});
```

### ❌ Integration Tests
```typescript
// WRONG: Don't mock multi-agent workflows
test('orchestrator delegates correctly', async () => {
  mock.mockToolCall('Task', { subagent_type: 'validator' });
  mock.mockResponse({ content: 'Validated' });
  // This doesn't test real delegation!
});

// RIGHT: Use fixtures or real LLM (cheap model)
test('orchestrator delegates correctly', async () => {
  const fixture = loadFixture('orchestration/delegation-001');
  // Real delegation chain captured
});
```

### ❌ Model-Specific Behavior
```typescript
// WRONG: Can't mock model differences
test('works with Claude 3.5', async () => {
  mock.mockResponse({ content: 'Claude-style response' });
  // You're just guessing how Claude responds!
});

// RIGHT: Use real model
test('works with Claude 3.5', async () => {
  const system = await AgentSystemBuilder.default()
    .withModel('anthropic/claude-haiku-4-5')
    .build();
  // Actually tests with Claude
});
```

## MockLLMProvider Reference

The existing MockLLMProvider (`tests/mocks/mock-llm-provider.ts`) provides:

```typescript
class MockLLMProvider {
  // Queue responses
  mockResponse(response: Partial<Message>): MockLLMProvider
  mockTextResponse(content: string): MockLLMProvider
  mockToolCall(toolName: string, args: any): MockLLMProvider

  // Simulate errors
  mockError(error: any): MockLLMProvider
  mockTimeout(ms: number): MockLLMProvider

  // Verify calls
  getCallHistory(): CallHistory[]
  getCallCount(): number
  expectCall(expected: Partial<Message>[]): boolean

  // Control
  reset(): void
}
```

## Best Practices for Mocking

### Keep Mocks Simple
```typescript
// Good: Simple, clear mock
mock.mockResponse({ content: 'Error: File not found' });

// Bad: Complex mock trying to simulate real LLM
mock.mockResponse({
  content: generateRealisticClaudeResponse(prompt)
});
```

### Use Mocks for Behavior, Not Content
```typescript
// Good: Test that agent handles errors
mock.mockError({ message: 'Network error' });
expect(result).toContain('Failed');

// Bad: Test exact LLM output
mock.mockResponse({ content: 'The analysis shows...' });
expect(result).toBe('The analysis shows...'); // Too specific
```

### Document Why You're Mocking
```typescript
describe('Rate limit handling', () => {
  // MOCKED: Can't trigger real rate limits without hitting API limits
  test('implements exponential backoff', async () => {
    // Mock test here
  });
});

describe('Claim processing', () => {
  // FIXTURE: Real behavior with actual LLM
  test('processes standard claim', async () => {
    // Fixture test here
  });
});
```

## Migration Path

If you have existing mock-heavy tests:

1. **Identify tests that test real behavior** → Convert to fixtures
2. **Identify tests that test edge cases** → Keep as mocks
3. **Generate fixtures for common scenarios** → One-time cost
4. **Delete unnecessary mocks** → Reduce maintenance

Example migration:
```typescript
// Before: Mock-based
test('agent analyzes code', async () => {
  mock.mockToolCall('Read', { file_path: 'index.ts' });
  mock.mockResponse({ content: 'Analysis complete' });
  const result = await executor.execute('analyzer', 'analyze index.ts');
  expect(result).toContain('complete');
});

// After: Fixture-based
test('agent analyzes code', async () => {
  const fixture = loadFixture('code-analysis/typescript-001');
  const result = parseAnalysis(fixture);
  expect(result.toolCalls).toContainEqual(
    expect.objectContaining({ tool: 'Read' })
  );
  expect(result.completed).toBe(true);
});
```

## Conclusion

MockLLMProvider is a specialized tool for specific scenarios:
- Network failures (can't capture)
- Rate limits (expensive to trigger)
- Malformed responses (rare in production)
- Safety limit testing (wasteful with real API)
- TDD for new components (speed of development)

For everything else, use fixtures. They're free after generation, they prove real behavior, and they're what actually happens in production.

**Remember: You're testing an LLM system. Test it with real LLM behavior whenever possible.**