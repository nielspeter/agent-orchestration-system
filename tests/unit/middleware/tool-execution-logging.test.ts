import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createToolExecutionMiddleware } from '@/middleware/tool-execution.middleware';
import { ToolRegistry } from '@/tools/registry/registry';
import { MiddlewareContext } from '@/middleware/middleware-types';
import { ConsoleLogger } from '@/logging/console.logger';
import { MockLLMProvider } from '../../mocks/mock-llm-provider';

describe('ToolExecutionMiddleware - Result Logging', () => {
  let toolRegistry: ToolRegistry;
  let middleware: any;
  let context: MiddlewareContext;
  let logger: ConsoleLogger;
  let mockProvider: MockLLMProvider;
  let toolCallsLogged: string[] = [];
  let toolResultsLogged: string[] = [];

  beforeEach(() => {
    logger = new ConsoleLogger({ verbosity: 'minimal' });
    mockProvider = new MockLLMProvider();
    toolRegistry = new ToolRegistry();

    // Track tool logging
    toolCallsLogged = [];
    toolResultsLogged = [];

    const originalLogToolCall = logger.logToolCall;
    const originalLogToolResult = logger.logToolResult;

    logger.logToolCall = vi.fn((agent, tool, toolId) => {
      toolCallsLogged.push(toolId);
      originalLogToolCall.call(logger, agent, tool, toolId, {});
    });

    logger.logToolResult = vi.fn((agent, tool, toolId) => {
      toolResultsLogged.push(toolId);
      originalLogToolResult.call(logger, agent, tool, toolId, { content: 'test' });
    });

    // Register test tools
    toolRegistry.register({
      name: 'SuccessTool',
      description: 'Always succeeds',
      parameters: { type: 'object', properties: {}, required: [] },
      execute: async () => ({ content: 'success' }),
      isConcurrencySafe: () => true,
    });

    toolRegistry.register({
      name: 'ErrorTool',
      description: 'Always fails',
      parameters: { type: 'object', properties: {}, required: [] },
      execute: async () => {
        throw new Error('Tool execution failed');
      },
      isConcurrencySafe: () => true,
    });

    const delegateToAgent = async () => 'delegated result';
    middleware = createToolExecutionMiddleware(toolRegistry, delegateToAgent);

    context = {
      agentName: 'test-agent',
      prompt: 'test prompt',
      executionContext: {
        depth: 0,
        startTime: Date.now(),
        maxDepth: 5,
        isSidechain: false,
        traceId: 'test-trace',
      },
      messages: [],
      iteration: 1,
      logger,
      modelName: 'test-model',
      shouldContinue: true,
      provider: mockProvider,
      tools: toolRegistry.getAllTools(),
    };
  });

  it('should log both tool call and result for successful execution', async () => {
    // Add a message with tool call
    context.messages = [
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: 'call_123',
            type: 'function',
            function: {
              name: 'SuccessTool',
              arguments: '{}',
            },
          },
        ],
      },
    ];

    await middleware(context, async () => {
      // Verify tool result was added to messages
      const hasToolResult = context.messages.some(
        (msg) => msg.role === 'user' && msg.tool_call_id === 'call_123'
      );
      expect(hasToolResult).toBe(true);
    });

    // Verify both call and result were logged with same ID
    expect(toolCallsLogged).toContain('call_123');
    expect(toolResultsLogged).toContain('call_123');
    expect(toolCallsLogged.length).toBe(toolResultsLogged.length);
  });

  it('should log tool result even when tool execution fails', async () => {
    context.messages = [
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: 'call_error',
            type: 'function',
            function: {
              name: 'ErrorTool',
              arguments: '{}',
            },
          },
        ],
      },
    ];

    await middleware(context, async () => {
      // Find the tool result message
      const toolResult = context.messages.find(
        (msg) => msg.role === 'user' && msg.tool_call_id === 'call_error'
      );

      // Should have error in content
      expect(toolResult).toBeDefined();
      expect(toolResult?.content).toContain('Tool execution failed');
    });

    // CRITICAL: Result must be logged even on error
    expect(toolCallsLogged).toContain('call_error');
    expect(toolResultsLogged).toContain('call_error');
    expect(toolCallsLogged.length).toBe(toolResultsLogged.length);
  });

  it('should handle multiple tool calls in sequence', async () => {
    context.messages = [
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'SuccessTool',
              arguments: '{}',
            },
          },
          {
            id: 'call_2',
            type: 'function',
            function: {
              name: 'ErrorTool',
              arguments: '{}',
            },
          },
          {
            id: 'call_3',
            type: 'function',
            function: {
              name: 'SuccessTool',
              arguments: '{}',
            },
          },
        ],
      },
    ];

    await middleware(context, async () => {
      // All tool results should be added
      const toolResults = context.messages.filter((msg) => msg.role === 'user' && msg.tool_call_id);
      expect(toolResults.length).toBe(3);
    });

    // All calls and results must be logged
    expect(toolCallsLogged).toEqual(['call_1', 'call_2', 'call_3']);
    expect(toolResultsLogged).toEqual(['call_1', 'call_2', 'call_3']);
  });

  it('should handle invalid tool name gracefully', async () => {
    context.messages = [
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: 'call_invalid',
            type: 'function',
            function: {
              name: 'NonExistentTool',
              arguments: '{}',
            },
          },
        ],
      },
    ];

    await middleware(context, async () => {
      const toolResult = context.messages.find(
        (msg) => msg.role === 'user' && msg.tool_call_id === 'call_invalid'
      );

      expect(toolResult).toBeDefined();
      expect(toolResult?.content).toContain('not found');
    });

    // Must still log the attempt and result
    expect(toolCallsLogged).toContain('call_invalid');
    expect(toolResultsLogged).toContain('call_invalid');
  });

  it('should handle malformed tool arguments', async () => {
    context.messages = [
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: 'call_malformed',
            type: 'function',
            function: {
              name: 'SuccessTool',
              arguments: 'not valid json{',
            },
          },
        ],
      },
    ];

    await middleware(context, async () => {
      const toolResult = context.messages.find(
        (msg) => msg.role === 'user' && msg.tool_call_id === 'call_malformed'
      );

      expect(toolResult).toBeDefined();
      expect(toolResult?.content).toMatch(/error|invalid|parse/i);
    });

    // Must still log even with parse errors
    expect(toolCallsLogged).toContain('call_malformed');
    expect(toolResultsLogged).toContain('call_malformed');
  });

  it('should maintain atomicity - no orphaned tool calls', async () => {
    // Test with mix of success and failure
    const scenarios = [
      { name: 'SuccessTool', shouldFail: false },
      { name: 'ErrorTool', shouldFail: true },
      { name: 'NonExistentTool', shouldFail: true },
      { name: 'SuccessTool', shouldFail: false },
    ];

    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i];
      const callId = `call_${i}`;

      context.messages = [
        {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: callId,
              type: 'function',
              function: {
                name: scenario.name,
                arguments: '{}',
              },
            },
          ],
        },
      ];

      await middleware(context, async () => {});
    }

    // CRITICAL INVARIANT: Every tool call must have a corresponding result
    expect(toolCallsLogged.length).toBe(toolResultsLogged.length);
    expect(toolCallsLogged.length).toBe(scenarios.length);

    // Verify IDs match
    toolCallsLogged.forEach((callId, index) => {
      expect(toolResultsLogged[index]).toBe(callId);
    });
  });
});
