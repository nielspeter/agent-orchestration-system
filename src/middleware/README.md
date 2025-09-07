# Middleware Module

## Overview
The middleware module implements the Chain of Responsibility pattern for processing agent requests through a pipeline of handlers.

## Middleware Pipeline Order

1. **error-handler.middleware.ts** - Catches and handles all errors
2. **agent-loader.middleware.ts** - Loads agent definition from markdown
3. **context-setup.middleware.ts** - Initializes conversation context
4. **provider-selection.middleware.ts** - Selects appropriate LLM provider
5. **safety-checks.middleware.ts** - Enforces safety limits
6. **llm-call.middleware.ts** - Makes the actual LLM API call
7. **tool-execution.middleware.ts** - Executes requested tools

## Key Concepts
- **Middleware Context**: Shared state passed through the pipeline
- **Next Function**: Calls the next middleware in the chain
- **Error Propagation**: Errors bubble up to error handler

## Usage
```typescript
import { MiddlewareExecutor } from '@/middleware';

const executor = new MiddlewareExecutor([
  errorHandler,
  agentLoader,
  // ... other middleware
]);

const result = await executor.execute(context);
```