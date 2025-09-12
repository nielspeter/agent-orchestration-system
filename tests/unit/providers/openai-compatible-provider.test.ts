import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Message } from '@/base-types';

// Mock must be at the top level for hoisting
vi.mock('openai');

// Import after mock declaration
import { OpenAICompatibleProvider } from '@/providers/openai-compatible-provider';
import OpenAI from 'openai';

// Create the mock implementation
const mockCreate = vi.fn();
vi.mocked(OpenAI).mockImplementation(
  () =>
    ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    }) as any
);

describe('OpenAI Compatible Provider - Tool Message Handling', () => {
  let provider: OpenAICompatibleProvider;

  beforeEach(() => {
    vi.clearAllMocks();

    const config = {
      baseURL: 'https://api.openrouter.ai/api/v1',
      apiKey: 'test-key',
    };

    provider = new OpenAICompatibleProvider('test-model', config);

    // The mockCreate function is already available from the module mock
  });

  test('handles tool messages with tool_call_id', async () => {
    const messages: Message[] = [
      {
        role: 'system',
        content: 'You are a helpful assistant.',
      },
      {
        role: 'user',
        content: 'What files are in the src directory?',
      },
      {
        role: 'assistant',
        content: 'Let me check the files in the src directory.',
        tool_calls: [
          {
            id: 'call_123',
            type: 'function',
            function: {
              name: 'list_files',
              arguments: '{"path": "src"}',
            },
          },
        ],
      },
      {
        role: 'tool',
        tool_call_id: 'call_123',
        content: '["file1.ts", "file2.ts", "file3.ts"]',
      },
    ];

    // Mock the API response
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'The src directory contains: file1.ts, file2.ts, and file3.ts',
          },
        },
      ],
      usage: {
        prompt_tokens: 50,
        completion_tokens: 20,
        total_tokens: 70,
      },
    });

    await provider.complete(messages);

    // Verify the create function was called
    expect(mockCreate).toHaveBeenCalledTimes(1);

    // Get the actual call arguments
    const callArgs = mockCreate.mock.calls[0][0];

    // Check that tool message was properly formatted
    const toolMessage = callArgs.messages[3];
    expect(toolMessage).toEqual({
      role: 'tool',
      content: '["file1.ts", "file2.ts", "file3.ts"]',
      tool_call_id: 'call_123',
    });
  });

  test('handles tool messages without tool_call_id by providing fallback', async () => {
    const messages: Message[] = [
      {
        role: 'system',
        content: 'You are a helpful assistant.',
      },
      {
        role: 'tool',
        // Missing tool_call_id - should use 'missing_id' fallback
        content: '{"result": "data"}',
      },
    ];

    // Mock the API response
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'I processed the data.',
          },
        },
      ],
      usage: {
        prompt_tokens: 30,
        completion_tokens: 10,
        total_tokens: 40,
      },
    });

    await provider.complete(messages);

    // Verify the create function was called
    expect(mockCreate).toHaveBeenCalledTimes(1);

    // Get the actual call arguments
    const callArgs = mockCreate.mock.calls[0][0];

    // Check that tool message has fallback tool_call_id
    const toolMessage = callArgs.messages[1];
    expect(toolMessage).toEqual({
      role: 'tool',
      content: '{"result": "data"}',
      tool_call_id: 'missing_id',
    });
  });

  test('preserves assistant messages with tool_calls', async () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: 'Help me with something',
      },
      {
        role: 'assistant',
        content: 'Let me help you with that.',
        tool_calls: [
          {
            id: 'call_456',
            type: 'function',
            function: {
              name: 'search',
              arguments: '{"query": "help topic"}',
            },
          },
        ],
      },
    ];

    // Mock the API response
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'Based on my search...',
          },
        },
      ],
      usage: {
        prompt_tokens: 40,
        completion_tokens: 15,
        total_tokens: 55,
      },
    });

    await provider.complete(messages);

    // Verify the create function was called
    expect(mockCreate).toHaveBeenCalledTimes(1);

    // Get the actual call arguments
    const callArgs = mockCreate.mock.calls[0][0];

    // Check that assistant message with tool_calls was properly formatted
    const assistantMessage = callArgs.messages[1];
    expect(assistantMessage).toEqual({
      role: 'assistant',
      content: 'Let me help you with that.',
      tool_calls: [
        {
          id: 'call_456',
          type: 'function',
          function: {
            name: 'search',
            arguments: '{"query": "help topic"}',
          },
        },
      ],
    });
  });

  test('handles regular messages without tool_calls', async () => {
    const messages: Message[] = [
      {
        role: 'system',
        content: 'You are helpful.',
      },
      {
        role: 'user',
        content: 'Hello!',
      },
      {
        role: 'assistant',
        content: 'Hi there!',
      },
    ];

    // Mock the API response
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'How can I help you today?',
          },
        },
      ],
      usage: {
        prompt_tokens: 20,
        completion_tokens: 10,
        total_tokens: 30,
      },
    });

    await provider.complete(messages);

    // Verify the create function was called
    expect(mockCreate).toHaveBeenCalledTimes(1);

    // Get the actual call arguments
    const callArgs = mockCreate.mock.calls[0][0];

    // Check all messages are properly formatted
    expect(callArgs.messages).toEqual([
      {
        role: 'system',
        content: 'You are helpful.',
      },
      {
        role: 'user',
        content: 'Hello!',
      },
      {
        role: 'assistant',
        content: 'Hi there!',
      },
    ]);
  });

  test('handles API errors with proper error details', async () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: 'Test error handling',
      },
    ];

    // Create a mock API error similar to what OpenAI library throws
    const apiError = new Error('400 Bad Request') as any;
    apiError.status = 400;
    apiError.message = '400 Bad Request';
    apiError.error = {
      message: 'Invalid model specified',
      type: 'invalid_request_error',
      code: 'model_not_found',
    };

    mockCreate.mockRejectedValueOnce(apiError);

    // Expect the error to be thrown with enhanced details
    await expect(provider.complete(messages)).rejects.toThrow(
      '400 400 Bad Request - {"message":"Invalid model specified","type":"invalid_request_error","code":"model_not_found"}'
    );
  });

  test('handles non-API errors gracefully', async () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: 'Test network error',
      },
    ];

    // Create a regular error (like network error)
    const networkError = new Error('Network timeout');
    mockCreate.mockRejectedValueOnce(networkError);

    // Expect the error message to be preserved
    await expect(provider.complete(messages)).rejects.toThrow('Network timeout');
  });
});
