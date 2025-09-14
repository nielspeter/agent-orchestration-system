import { ILLMProvider, UsageMetrics } from '@/providers/llm-provider.interface';
import { BaseTool, Message, ToolCall } from '@/base-types';

/**
 * MockLLMProvider for deterministic testing
 *
 * Allows tests to specify exact LLM responses, enabling:
 * - Deterministic testing of non-deterministic systems
 * - Testing specific tool call sequences
 * - Testing error scenarios
 * - Zero-cost testing (no API calls)
 */
export class MockLLMProvider implements ILLMProvider {
  private responses: Message[] = [];
  private currentIndex = 0;
  private callHistory: { messages: Message[]; tools?: BaseTool[] }[] = [];
  private modelName: string;
  private lastUsageMetrics: UsageMetrics | null = null;

  constructor(modelName: string = 'mock/test-model') {
    this.modelName = modelName;
  }

  /**
   * Queue a response to be returned by the next complete() call
   */
  mockResponse(response: Partial<Message>): MockLLMProvider {
    this.responses.push({
      role: 'assistant',
      content: response.content || '',
      tool_calls: response.tool_calls,
    });
    return this;
  }

  /**
   * Queue multiple responses at once
   */
  mockResponses(...responses: Partial<Message>[]): MockLLMProvider {
    responses.forEach((r) => this.mockResponse(r));
    return this;
  }

  /**
   * Queue a simple text response
   */
  mockTextResponse(content: string): MockLLMProvider {
    return this.mockResponse({ content });
  }

  /**
   * Queue a tool call response
   */
  mockToolCall(toolName: string, args: Record<string, any>, toolId?: string): MockLLMProvider {
    const toolCall: ToolCall = {
      id: toolId || `mock-tool-${Date.now()}`,
      type: 'function',
      function: {
        name: toolName,
        arguments: JSON.stringify(args),
      },
    };
    return this.mockResponse({
      tool_calls: [toolCall],
    });
  }

  /**
   * Queue multiple tool calls in a single response
   */
  mockToolCalls(
    ...tools: Array<{ name: string; args: Record<string, any>; id?: string }>
  ): MockLLMProvider {
    const toolCalls: ToolCall[] = tools.map((tool, i) => ({
      id: tool.id || `mock-tool-${Date.now()}-${i}`,
      type: 'function',
      function: {
        name: tool.name,
        arguments: JSON.stringify(tool.args),
      },
    }));
    return this.mockResponse({
      tool_calls: toolCalls,
    });
  }

  /**
   * Complete method - returns mocked responses in order
   */
  async complete(messages: Message[], tools?: BaseTool[]): Promise<Message> {
    // Store call history for verification
    this.callHistory.push({ messages: [...messages], tools });

    // Set mock usage metrics
    this.lastUsageMetrics = {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    };

    // Return next mocked response or default
    if (this.currentIndex >= this.responses.length) {
      // Default response when no more mocked responses
      return {
        role: 'assistant',
        content: 'Default mock response - no more mocked responses available',
      };
    }

    const response = this.responses[this.currentIndex];
    this.currentIndex++;
    return response;
  }

  /**
   * Get the history of complete() calls for verification
   */
  getCallHistory(): { messages: Message[]; tools?: BaseTool[] }[] {
    return this.callHistory;
  }

  /**
   * Get the last messages passed to complete()
   */
  getLastCall(): Message[] | undefined {
    return this.callHistory[this.callHistory.length - 1]?.messages;
  }

  /**
   * Get the last tools passed to complete()
   */
  getLastTools(): BaseTool[] | undefined {
    return this.callHistory[this.callHistory.length - 1]?.tools;
  }

  /**
   * Reset the provider state
   */
  reset(): void {
    this.responses = [];
    this.currentIndex = 0;
    this.callHistory = [];
  }

  /**
   * Verify that complete() was called with expected messages
   */
  expectCall(expectedMessages: Partial<Message>[]): boolean {
    const lastCall = this.getLastCall();
    if (!lastCall) return false;

    return expectedMessages.every((expected, i) => {
      const actual = lastCall[i];
      if (!actual) return false;

      // Check role
      if (expected.role && actual.role !== expected.role) return false;

      // Check content (partial match)
      if (expected.content && !actual.content?.includes(expected.content)) return false;

      return true;
    });
  }

  /**
   * Get the number of times complete() was called
   */
  getCallCount(): number {
    return this.callHistory.length;
  }

  /**
   * Verify all mocked responses were consumed
   */
  allResponsesConsumed(): boolean {
    return this.currentIndex >= this.responses.length;
  }

  // ILLMProvider interface methods
  getModelName(): string {
    return this.modelName;
  }

  getProviderName(): string {
    return 'mock';
  }

  supportsStreaming(): boolean {
    return false;
  }

  getLastUsageMetrics(): UsageMetrics | null {
    return this.lastUsageMetrics;
  }
}
