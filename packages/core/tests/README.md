# Test Infrastructure

## Overview

This directory contains a comprehensive testing framework for agent-based
systems, featuring:

- **Fixture-based testing** for deterministic, fast test execution
- **Generic utilities** for parsing and asserting on event streams
- **Custom matchers** for semantic test assertions
- **Type-safe event handling** with TypeScript definitions

## Directory Structure

```
tests/
├── unit/                      # Unit tests for individual components
├── integration/               # Integration tests
│   └── werewolf-game/        # Example: self-contained game test
│       ├── fixtures/         # Recorded game sessions
│       ├── matchers.ts       # Game-specific matchers
│       ├── parser.ts         # Game-specific parsing
│       └── werewolf-game.test.ts
├── utils/                     # Generic test utilities
│   ├── event-stream-parser.ts # Parse JSONL event streams
│   └── fixture-runner.ts     # Fixture lifecycle management
├── matchers/                  # Custom Vitest matchers
│   └── agent-matchers.ts     # Generic agent system matchers
├── types/                     # TypeScript definitions
│   └── event-types.ts        # Event message types
└── mocks/                     # Mock implementations
```

## Running Tests

### All Tests

```bash
npm test                       # Run all unit tests
npm run test:integration       # Run integration tests
npm run test:all              # Run both unit and integration
```

### Specific Tests

```bash
# Run specific test file
npx vitest run tests/integration/werewolf-game/werewolf-game.test.ts

# Watch mode for development
npm run test:watch

# With coverage
npm run test:unit:coverage
```

## Using Generic Utilities

### EventStreamParser

Parse and analyze event streams from agent executions:

```typescript
import { EventStreamParser } from '../utils/event-stream-parser';
import type { EventMessage } from '../types/event-types';

const messages: EventMessage[] = loadFixture('my-fixture');

// Extract specific data
const delegations = EventStreamParser.extractDelegations(messages);
const toolCalls = EventStreamParser.extractToolCalls(messages, 'Read');
const agentsCalled = EventStreamParser.extractAgentCalls(messages);

// Check conditions
const hasCompleted = EventStreamParser.hasKeywords(messages, [
  'done',
  'complete',
]);

// Get full execution summary
const execution = EventStreamParser.parseExecution(messages);
```

### Custom Matchers

Use semantic assertions for cleaner tests:

```typescript
import '../matchers/agent-matchers';

// Check completion
expect(messages).toHaveCompleted(['done', 'finished']);

// Check delegations
expect(messages).toHaveDelegatedToAgents(['agent1', 'agent2']);

// Check tool usage
expect(messages).toHaveExecutedTools(['Read', 'Write']);

// Check patterns aren't present
expect(messages).toNotContainPatterns([/simulated.*response/i]);

// Check minimum interactions
expect(messages).toHaveAgentInteractions(3);
```

### Fixture Runner

Manage fixture-based tests with automatic generation:

```typescript
import { describeWithFixtures } from '../utils/fixture-runner';

describeWithFixtures(
  {
    name: 'My Agent System',
    fixtureDir: path.join(__dirname, 'fixtures'),
    fixtureCount: 3,
    fixturePrefix: 'my-system',
    generator: async (sessionId: string) => {
      // Generate fixture if it doesn't exist
      const system = await buildMySystem(sessionId);
      await system.execute();
    },
  },
  ({ messages }) => {
    // Your tests here
    it('should complete successfully', () => {
      expect(messages).toHaveCompleted();
    });
  }
);
```

## Creating New Test Suites

### For Simple Agent Tests

Use generic utilities directly:

```typescript
import { expect } from 'vitest';
import { EventStreamParser } from '../utils/event-stream-parser';
import '../matchers/agent-matchers';

describe('My Agent', () => {
  it('should delegate tasks', async () => {
    const messages = await executeAgent('my-agent', 'Do something');

    expect(messages).toHaveDelegatedToAgents(['sub-agent']);
    expect(messages).toHaveCompleted();
  });
});
```

### For Complex Systems (Like Games)

Create a self-contained test directory:

1. Create directory structure:

```
tests/integration/my-system/
├── fixtures/           # Your fixtures
├── matchers.ts        # System-specific matchers (optional)
├── parser.ts          # System-specific parsing (optional)
└── my-system.test.ts  # Test file
```

2. Extend generic utilities if needed:

```typescript
// my-system/parser.ts
import { EventStreamParser } from '../../utils/event-stream-parser';

export class MySystemParser extends EventStreamParser {
  static extractCustomData(messages: EventMessage[]) {
    // Custom parsing logic
  }
}
```

3. Write tests using fixture runner:

```typescript
// my-system/my-system.test.ts
import { describeWithFixtures } from '../../utils/fixture-runner';

describeWithFixtures(config, ({ messages }) => {
  // Your tests
});
```

## Environment Variables

Configure test behavior with environment variables:

### Test Configuration

- `WEREWOLF_FIXTURE_COUNT`: Number of fixtures to generate (default: 5)
- `WEREWOLF_TEST_MODEL`: Model for werewolf game generation
- `WEREWOLF_MAX_ITERATIONS`: Max iterations per game
- `WEREWOLF_WARN_AT`: Warning threshold for iterations
- `WEREWOLF_MAX_DEPTH`: Max delegation depth

### API Configuration

Tests use the following environment files in priority order:

1. `.env.test.local` - Local test configuration (gitignored)
2. `.env.test` - Default test configuration
3. `.env` - Main environment file

Example `.env.test`:

```bash
# For unit tests - use a mock key
ANTHROPIC_API_KEY=mock-api-key-for-unit-tests

# For integration tests - use real key in .env.test.local
OPENROUTER_API_KEY=your-key-here

# Test-specific settings
LOG_DIR=./test-logs
DISABLE_PROMPT_CACHING=false
MAX_ITERATIONS=10
MAX_DEPTH=3
```

## Type Safety

All event messages are typed for better IDE support and compile-time checking:

```typescript
import type { EventMessage, ToolCallMessage } from '../types/event-types';

function processMessage(msg: EventMessage) {
  if (msg.type === 'tool_call') {
    const toolCall = msg as ToolCallMessage;
    console.log(toolCall.data?.tool);
  }
}
```

## Best Practices

1. **Use fixture-based testing** for integration tests to avoid API costs
2. **Leverage generic utilities** before creating custom ones
3. **Keep test data typed** using the provided TypeScript definitions
4. **Organize complex tests** in self-contained directories
5. **Configure via environment** rather than hardcoding values
6. **Use semantic matchers** for clearer test intent
7. **Mock external dependencies** in unit tests using vi.spyOn()

## Handling Rate Limits

Integration tests may hit API rate limits. To mitigate:

1. **Use fixtures**: Record once, replay many times
2. **Run sequentially**: Avoid parallel test execution
3. **Add delays**: Space out API calls if needed
4. **Monitor usage**: Check your API dashboard

If you encounter rate limit errors:

- Wait a few minutes before retrying
- Use fixture-based tests to avoid repeated API calls
- Consider using a different API key for testing

## Coverage Reports

Generate test coverage reports:

```bash
# Unit test coverage
npm run test:unit:coverage

# Integration test coverage (if needed)
npm run test:integration -- --coverage
```

Coverage reports are generated in:

- `coverage/` - Unit test coverage
- `coverage-integration/` - Integration test coverage

## CI/CD Considerations

For CI/CD pipelines:

- Run unit tests on every commit
- Run integration tests on main branch only
- Use fixture-based tests to avoid API costs
- Set appropriate timeouts
- Use secrets management for API keys

Example GitHub Actions:

```yaml
- name: Run Unit Tests
  run: npm run test:unit

- name: Run Integration Tests
  if: github.ref == 'refs/heads/main'
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: npm run test:integration
```

## Adding New Event Types

To add support for new event types:

1. Add the type definition to `tests/types/event-types.ts`
2. Update parsers if special handling is needed
3. Add matchers if new assertions are useful

Example:

```typescript
// In event-types.ts
export interface CustomEventMessage extends BaseEventMessage {
  type: 'custom_event';
  data?: {
    customField: string;
  };
}

// Update the union type
export type EventMessage =
  | AssistantMessage
  | CustomEventMessage  // Add here
  | ...
```

## Troubleshooting

### Tests failing with "File not found"

- Ensure fixtures are generated first
- Check paths are relative to test file location

### Type errors in tests

- Import types from `tests/types/event-types.ts`
- Ensure EventMessage type is used consistently

### Fixture generation takes too long

- Reduce `FIXTURE_COUNT` for development
- Use smaller/faster models for testing
- Consider recording fixtures once and committing them

### Custom matchers not recognized

- Import the matcher file: `import '../matchers/agent-matchers'`
- Ensure TypeScript module augmentation is correct
