# Test Suite Documentation

## Overview

The test suite is divided into two categories:
- **Unit Tests**: Test individual components without external dependencies
- **Integration Tests**: Test the system with real API calls

## Test Configuration

### Environment Variables

Tests use the following environment files in priority order:
1. `.env.test.local` - Local test configuration (gitignored)
2. `.env.test` - Default test configuration
3. `.env` - Main environment file

### `.env.test` Structure

```bash
# For unit tests - use a mock key
ANTHROPIC_API_KEY=mock-api-key-for-unit-tests

# Model configuration
MODEL=claude-3-5-haiku-latest

# Test-specific settings
LOG_DIR=./test-logs
DISABLE_PROMPT_CACHING=false
MAX_ITERATIONS=10
MAX_DEPTH=3
```

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit
```
- Runs without API calls
- Uses mocked Anthropic client
- Fast execution (~1 second)
- No API key required

### Integration Tests Only
```bash
npm run test:integration
```
- Requires real API key
- Makes actual API calls
- Slower execution (60-120 seconds)
- Tests real agent orchestration
- **Note**: May hit rate limits if run too frequently

## Setting Up Integration Tests

To run integration tests with a real API key:

1. Copy the test environment template:
   ```bash
   cp .env.test .env.test.local
   ```

2. Edit `.env.test.local` and add your real API key:
   ```bash
   ANTHROPIC_API_KEY=your-real-api-key-here
   ```

3. Run integration tests:
   ```bash
   npm run test:integration
   ```

## Test Structure

```
tests/
├── unit/
│   ├── structure.test.ts      # Tests system structure
│   └── system-builder.test.ts # Tests configuration builder
├── integration/
│   ├── pull-architecture.test.ts  # Tests pull-based architecture
│   ├── caching.test.ts           # Tests caching behavior
│   └── parallel-execution.test.ts # Tests parallel tool execution
├── llm/
│   └── anthropic-provider.test.ts # Provider-specific tests
├── setup-unit.ts              # Unit test setup
├── setup-integration.ts       # Integration test setup
└── README.md                  # This file
```

## Coverage

Generate test coverage reports:

```bash
# Unit test coverage
npm run test:unit -- --coverage

# Integration test coverage
npm run test:integration -- --coverage
```

Coverage reports are generated in:
- `coverage/` - Unit test coverage
- `coverage-integration/` - Integration test coverage

## Writing Tests

### Unit Tests

```typescript
import { describe, test, expect } from '@jest/globals';

describe('Component', () => {
  test('should do something', () => {
    // Test without external dependencies
    expect(result).toBe(expected);
  });
});
```

### Integration Tests

```typescript
describe('Feature Integration', () => {
  test('should work with real API', async () => {
    if (!process.env.ANTHROPIC_API_KEY || 
        process.env.ANTHROPIC_API_KEY.startsWith('mock')) {
      console.log('Skipping - no real API key');
      return;
    }
    
    // Test with real API calls
    const result = await executor.execute(...);
    expect(result).toBeDefined();
  }, 30000); // 30 second timeout
});
```

## Handling Rate Limits

Integration tests make real API calls and may hit rate limits. To mitigate:

1. **Run tests sequentially**: Avoid running multiple test suites in parallel
2. **Add delays**: Space out test executions
3. **Use appropriate model**: `claude-3-5-haiku-latest` has lower token costs
4. **Monitor usage**: Check your Anthropic dashboard for usage metrics

If you encounter rate limit errors:
- Wait a few minutes before retrying
- Consider running individual test files instead of the full suite
- Use a different API key with higher limits for testing

## CI/CD Considerations

For CI/CD pipelines:
- Run unit tests on every commit
- Run integration tests on main branch only
- Use secrets management for API keys
- Set appropriate timeouts
- Consider adding retry logic for rate limit errors

Example GitHub Actions:
```yaml
- name: Run Unit Tests
  run: npm run test:unit
  
- name: Run Integration Tests
  if: github.ref == 'refs/heads/main'
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: npm run test:integration
  retry_on: error
  max_attempts: 2
  retry_wait_seconds: 60
```