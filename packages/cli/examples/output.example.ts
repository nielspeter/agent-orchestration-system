/**
 * Example usage of output formatting utilities
 *
 * Run with: npx tsx packages/cli/examples/output.example.ts
 */

import { formatOutput, formatError, formatSuccess, formatWarning, formatInfo } from '../src/output';
import type { ExecutionResult, AnySessionEvent } from '../src/output';

// Sample execution result with events
const sampleEvents: AnySessionEvent[] = [
  {
    type: 'assistant',
    timestamp: Date.now() - 3000,
    data: {
      role: 'assistant',
      content: 'I will analyze the codebase.',
    },
    metadata: {
      model: 'claude-3-5-sonnet-20241022',
      provider: 'anthropic',
      usage: {
        promptTokens: 1200,
        completionTokens: 150,
        totalTokens: 1350,
        promptCacheHitTokens: 800,
        promptCacheMissTokens: 400,
      },
      cost: {
        inputCost: 0.0024,
        outputCost: 0.0045,
        totalCost: 0.0069,
      },
      performance: {
        latencyMs: 1250,
      },
    },
  },
  {
    type: 'tool_call',
    timestamp: Date.now() - 2500,
    data: {
      tool: 'Read',
      params: {
        path: '/src/index.ts',
      },
    },
  },
  {
    type: 'tool_call',
    timestamp: Date.now() - 2000,
    data: {
      tool: 'Grep',
      params: {
        pattern: 'export.*function',
        path: '/src',
      },
    },
  },
  {
    type: 'assistant',
    timestamp: Date.now() - 1000,
    data: {
      role: 'assistant',
      content: 'Analysis complete.',
    },
    metadata: {
      model: 'claude-3-5-sonnet-20241022',
      provider: 'anthropic',
      usage: {
        promptTokens: 2500,
        completionTokens: 300,
        totalTokens: 2800,
        promptCacheHitTokens: 2000,
        promptCacheMissTokens: 500,
      },
      cost: {
        inputCost: 0.0038,
        outputCost: 0.009,
        totalCost: 0.0128,
      },
    },
  },
];

const executionResult: ExecutionResult = {
  result: `The codebase follows a modular architecture with clear separation of concerns:

1. **Core Types** (src/base-types.ts): Defines fundamental interfaces for tools, messages, and execution context
2. **Agent System** (src/agents/): Contains the agent executor and loader
3. **Middleware Pipeline**: Implements Chain of Responsibility pattern for request processing
4. **Tools**: Extensible tool system with built-in Read, Write, Grep, and Delegate tools
5. **LLM Providers**: Abstraction layer supporting Anthropic, OpenAI, and OpenRouter

The system uses a "pull architecture" where delegated agents receive minimal context and gather information via tools.`,
  agentName: 'code-analyzer',
  sessionId: 'session-abc123',
  duration: 3500,
  events: sampleEvents,
};

console.log('\n=== EXAMPLE: Clean Mode ===\n');
console.log(formatOutput(executionResult, 'clean'));

console.log('\n\n=== EXAMPLE: Verbose Mode ===\n');
console.log(formatOutput(executionResult, 'verbose'));

console.log('\n\n=== EXAMPLE: JSON Mode ===\n');
console.log(formatOutput(executionResult, 'json'));

console.log('\n\n=== EXAMPLE: Error Formatting ===\n');
console.log(formatError(new Error('Connection timeout'), 'verbose'));

console.log('\n\n=== EXAMPLE: Utility Messages ===\n');
console.log(formatSuccess('Build completed successfully'));
console.log(formatWarning('Deprecated API usage detected'));
console.log(formatInfo('Using cached results from previous run'));
console.log('\n');
