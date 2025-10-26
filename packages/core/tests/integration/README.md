# Integration Tests

## When to Run

- **Before deployment** - Verify API connectivity
- **After major changes** - Ensure end-to-end flow works
- **NOT in regular development** - Too slow/expensive

## How to Run

```bash
# Run specific test
npm run test:integration -- tests/integration/pull-architecture.test.ts

# Run all (expensive!)
npm run test:integration
```

## Coverage

Integration tests are **intentionally excluded** from coverage because:

1. They test external APIs, not our code
2. They're too slow for regular development
3. Coverage from API calls is misleading

## For POC

Keep only essential integration tests:

- ✅ Basic LLM call works
- ✅ Tool execution works
- ❌ Everything else can wait for production
