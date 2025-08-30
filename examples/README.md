# Examples Directory

This directory contains demonstration scripts showing different aspects of the agent orchestration system.

## Available Examples

### Core Architecture Demos

- **orchestration-demo.ts** - Demonstrates the main orchestration pattern with parent-child agent delegation
  ```bash
  npm run example:orchestration
  ```

- **structure-demo.ts** - Shows the basic agent structure and component relationships
  ```bash
  npm run example:structure
  ```

- **logging-demo.ts** - Demonstrates the logging system and message flow visualization
  ```bash
  npm run example:logging
  ```

### Caching & Performance Demos

- **claude-code-caching-demo.ts** - Full demonstration of Claude Code's caching architecture with real API calls
  ```bash
  npm run example:caching
  ```

- **cache-verification-demo.ts** - Verifies cache behavior and metrics
  ```bash
  npm run example:cache-verify
  ```

- **parallel-execution-demo.ts** - Shows parallel agent execution patterns
  ```bash
  npm run example:parallel
  ```

## Notes

- These are integration tests that make real API calls (require ANTHROPIC_API_KEY)
- Unit tests are located in `src/**/*.test.ts` files
- Run all unit tests with `npm test`