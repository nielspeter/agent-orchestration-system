# Middleware Module

## Overview

The middleware module implements the Chain of Responsibility pattern for
processing agent requests through a pipeline of handlers.

## Middleware Pipeline Order

1. **error-handler.middleware.ts** - Catches and handles all errors
2. **agent-loader.middleware.ts** - Loads agent definition from markdown
3. **thinking.middleware.ts** - Validates and normalizes thinking configuration
4. **context-setup.middleware.ts** - Initializes conversation context
5. **provider-selection.middleware.ts** - Selects appropriate LLM provider
6. **safety-checks.middleware.ts** - Enforces safety limits
7. **smart-retry.middleware.ts** - Retries on rate limit errors (429) with
   exponential backoff
8. **llm-call.middleware.ts** - Makes the actual LLM API call
9. **tool-execution.middleware.ts** - Executes requested tools

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
