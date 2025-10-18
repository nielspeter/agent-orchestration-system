import { beforeEach, describe, expect, it } from 'vitest';
import { SimpleSessionManager } from '@/session/manager';
import { InMemoryStorage } from '@/session/memory.storage';
import {
  AssistantMessageEvent,
  ToolCallEvent,
  ToolResultEvent,
  UserMessageEvent,
} from '@/session/types';

describe('SimpleSessionManager - Session Recovery', () => {
  let storage: InMemoryStorage;
  let sessionManager: SimpleSessionManager;
  const sessionId = 'test-session';

  beforeEach(() => {
    storage = new InMemoryStorage();
    sessionManager = new SimpleSessionManager(storage);
  });

  describe('recoverSession', () => {
    it('should recover empty session', async () => {
      const messages = await sessionManager.recoverSession(sessionId);
      expect(messages).toEqual([]);
    });

    it('should recover user messages', async () => {
      const event: UserMessageEvent = {
        type: 'user',
        timestamp: Date.now(),
        data: {
          role: 'user',
          content: 'Hello, assistant!',
        },
      };

      await storage.appendEvent(sessionId, event);
      const messages = await sessionManager.recoverSession(sessionId);

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({
        role: 'user',
        content: 'Hello, assistant!',
      });
    });

    it('should recover assistant messages', async () => {
      const event: AssistantMessageEvent = {
        type: 'assistant',
        timestamp: Date.now(),
        data: {
          role: 'assistant',
          content: 'Hello! How can I help you?',
          agent: 'default',
        },
      };

      await storage.appendEvent(sessionId, event);
      const messages = await sessionManager.recoverSession(sessionId);

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({
        role: 'assistant',
        content: 'Hello! How can I help you?',
      });
    });

    it('should recover tool calls as assistant messages (complete pair)', async () => {
      // Tool call
      const toolCallEvent: ToolCallEvent = {
        type: 'tool_call',
        timestamp: Date.now(),
        data: {
          id: 'call-123',
          tool: 'read',
          params: { path: 'file.txt' },
          agent: 'default',
        },
      };

      // Tool result (sanitizer requires matching pairs)
      const toolResultEvent: ToolResultEvent = {
        type: 'tool_result',
        timestamp: Date.now() + 1,
        data: {
          toolCallId: 'call-123',
          result: { content: 'File contents here' },
        },
      };

      await storage.appendEvent(sessionId, toolCallEvent);
      await storage.appendEvent(sessionId, toolResultEvent);
      const messages = await sessionManager.recoverSession(sessionId);

      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({
        role: 'assistant',
        tool_calls: [
          {
            id: 'call-123',
            type: 'function',
            function: {
              name: 'read',
              arguments: JSON.stringify({ path: 'file.txt' }),
            },
          },
        ],
      });
      expect(messages[1]).toEqual({
        role: 'tool',
        content: JSON.stringify({ content: 'File contents here' }),
        tool_call_id: 'call-123',
      });
    });

    it('should remove orphaned tool results (sanitizer behavior)', async () => {
      // Tool result without matching tool_call - sanitizer will remove it
      const event: ToolResultEvent = {
        type: 'tool_result',
        timestamp: Date.now(),
        data: {
          toolCallId: 'call-123',
          result: { content: 'File contents here' },
        },
      };

      await storage.appendEvent(sessionId, event);
      const messages = await sessionManager.recoverSession(sessionId);

      // Sanitizer removes orphaned tool results for API compatibility
      expect(messages).toHaveLength(0);
    });

    it('should recover complete conversation in order', async () => {
      // User asks
      await storage.appendEvent(sessionId, {
        type: 'user',
        timestamp: 1000,
        data: { role: 'user', content: 'Read file.txt' },
      });

      // Assistant responds
      await storage.appendEvent(sessionId, {
        type: 'assistant',
        timestamp: 2000,
        data: { role: 'assistant', content: "I'll read that file", agent: 'default' },
      });

      // Assistant calls tool
      await storage.appendEvent(sessionId, {
        type: 'tool_call',
        timestamp: 3000,
        data: { id: 'call-456', tool: 'read', params: { path: 'file.txt' }, agent: 'default' },
      });

      // Tool result
      await storage.appendEvent(sessionId, {
        type: 'tool_result',
        timestamp: 4000,
        data: { toolCallId: 'call-456', result: 'File contents' },
      });

      // Assistant final response
      await storage.appendEvent(sessionId, {
        type: 'assistant',
        timestamp: 5000,
        data: { role: 'assistant', content: 'The file contains: ...', agent: 'default' },
      });

      const messages = await sessionManager.recoverSession(sessionId);

      expect(messages).toHaveLength(5);
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
      expect(messages[2].role).toBe('assistant');
      expect(messages[2].tool_calls).toBeDefined();
      expect(messages[2].tool_calls?.[0]?.function.name).toBe('read');
      expect(messages[3].role).toBe('tool');
      expect(messages[3].tool_call_id).toBe('call-456');
      expect(messages[4].role).toBe('assistant');
    });

    it('should skip unknown event types', async () => {
      await storage.appendEvent(sessionId, {
        type: 'user',
        timestamp: 1000,
        data: { role: 'user', content: 'Hello' },
      });

      // Unknown event type
      await storage.appendEvent(sessionId, {
        type: 'unknown_type',
        timestamp: 2000,
        data: { some: 'data' },
      });

      await storage.appendEvent(sessionId, {
        type: 'assistant',
        timestamp: 3000,
        data: { role: 'assistant', content: 'Hi', agent: 'default' },
      });

      const messages = await sessionManager.recoverSession(sessionId);
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
    });

    it('should filter system messages during recovery (audit trail only)', async () => {
      // System messages are persisted for audit purposes
      await storage.appendEvent(sessionId, {
        type: 'assistant',
        timestamp: 1000,
        data: {
          role: 'assistant',
          content: 'Using built-in default agent',
          agent: 'system', // System message marker
        },
      });

      await storage.appendEvent(sessionId, {
        type: 'user',
        timestamp: 2000,
        data: { role: 'user', content: 'Hello' },
      });

      await storage.appendEvent(sessionId, {
        type: 'assistant',
        timestamp: 3000,
        data: {
          role: 'assistant',
          content: 'Model selected: claude-3-5-haiku-latest',
          agent: 'system', // Another system message
        },
      });

      await storage.appendEvent(sessionId, {
        type: 'assistant',
        timestamp: 4000,
        data: {
          role: 'assistant',
          content: 'Hi, how can I help?',
          agent: 'default', // Real assistant message
        },
      });

      const messages = await sessionManager.recoverSession(sessionId);

      // Should only have user message and real assistant message
      // System messages are filtered out for LLM conversation recovery
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe('Hello');
      expect(messages[1].role).toBe('assistant');
      expect(messages[1].content).toBe('Hi, how can I help?');

      // Verify system messages are still in storage (audit trail)
      const allEvents = await storage.readEvents(sessionId);
      const systemEvents = allEvents.filter(
        (e) =>
          e.type === 'assistant' && e.data && 'agent' in e.data && e.data.agent === 'system'
      );
      expect(systemEvents).toHaveLength(2);
    });

    it('should not create session recovery if only system messages exist', async () => {
      // When only system messages exist, recovery should return empty
      await storage.appendEvent(sessionId, {
        type: 'assistant',
        timestamp: 1000,
        data: {
          role: 'assistant',
          content: 'Agent loaded: test-agent',
          agent: 'system',
        },
      });

      const messages = await sessionManager.recoverSession(sessionId);
      expect(messages).toHaveLength(0);
    });
  });

  describe('hasIncompleteToolCall', () => {
    it('should return false for empty messages', () => {
      expect(sessionManager.hasIncompleteToolCall([])).toBe(false);
    });

    it('should return false when last message is user message', () => {
      const messages = [
        { role: 'assistant' as const, content: 'Hello' },
        { role: 'user' as const, content: 'Hi' },
      ];
      expect(sessionManager.hasIncompleteToolCall(messages)).toBe(false);
    });

    it('should return false when last message is plain assistant message', () => {
      const messages = [
        { role: 'user' as const, content: 'Hi' },
        { role: 'assistant' as const, content: 'Hello' },
      ];
      expect(sessionManager.hasIncompleteToolCall(messages)).toBe(false);
    });

    it('should return true when last message has tool_calls', () => {
      const messages = [
        { role: 'user' as const, content: 'Read file' },
        {
          role: 'assistant' as const,
          tool_calls: [
            {
              id: 'call-123',
              type: 'function' as const,
              function: {
                name: 'read',
                arguments: JSON.stringify({ path: 'file.txt' }),
              },
            },
          ],
        },
      ];
      expect(sessionManager.hasIncompleteToolCall(messages)).toBe(true);
    });

    it('should return false when tool call has result', () => {
      const messages = [
        {
          role: 'assistant' as const,
          tool_calls: [
            {
              id: 'call-123',
              type: 'function' as const,
              function: {
                name: 'read',
                arguments: JSON.stringify({ path: 'file.txt' }),
              },
            },
          ],
        },
        {
          role: 'tool' as const,
          content: 'File contents',
          tool_call_id: 'call-123',
        },
      ];
      expect(sessionManager.hasIncompleteToolCall(messages)).toBe(false);
    });
  });

  describe('getLastToolCall', () => {
    it('should return null for empty messages', () => {
      expect(sessionManager.getLastToolCall([])).toBeNull();
    });

    it('should return null when last message is not tool call', () => {
      const messages = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi' },
      ];
      expect(sessionManager.getLastToolCall(messages)).toBeNull();
    });

    it('should extract tool call from last assistant message', () => {
      const messages = [
        { role: 'user' as const, content: 'Read file' },
        {
          role: 'assistant' as const,
          tool_calls: [
            {
              id: 'call-789',
              type: 'function' as const,
              function: {
                name: 'read',
                arguments: JSON.stringify({ path: '/tmp/test.txt' }),
              },
            },
          ],
        },
      ];

      const toolCall = sessionManager.getLastToolCall(messages);
      expect(toolCall).toEqual({
        id: 'call-789',
        name: 'read',
        input: { path: '/tmp/test.txt' },
      });
    });

    it('should return null if no tool_calls present', () => {
      const messages = [
        {
          role: 'assistant' as const,
          content: 'Just a regular message without tool calls',
        },
      ];
      expect(sessionManager.getLastToolCall(messages)).toBeNull();
    });

    it('should handle multiple tool calls in one message', () => {
      const messages = [
        {
          role: 'assistant' as const,
          tool_calls: [
            {
              id: 'call-1',
              type: 'function' as const,
              function: {
                name: 'read',
                arguments: JSON.stringify({ path: 'file1.txt' }),
              },
            },
            {
              id: 'call-2',
              type: 'function' as const,
              function: {
                name: 'write',
                arguments: JSON.stringify({ path: 'file2.txt', content: 'data' }),
              },
            },
          ],
        },
      ];

      const toolCall = sessionManager.getLastToolCall(messages);
      // Should return the first tool call found
      expect(toolCall).toEqual({
        id: 'call-1',
        name: 'read',
        input: { path: 'file1.txt' },
      });
    });
  });

  describe('Integration - Recovery Flow', () => {
    it('should handle interrupted session with incomplete tool call (sanitizer removes it)', async () => {
      // Simulate a session that was interrupted mid-tool-execution
      await storage.appendEvent(sessionId, {
        type: 'user',
        timestamp: 1000,
        data: { role: 'user', content: 'Analyze this file' },
      });

      await storage.appendEvent(sessionId, {
        type: 'tool_call',
        timestamp: 2000,
        data: {
          id: 'interrupted-call',
          tool: 'read',
          params: { path: 'important.txt' },
          agent: 'default',
        },
      });
      // No tool_result - session was interrupted!

      const messages = await sessionManager.recoverSession(sessionId);

      // Sanitizer removes incomplete tool call for API compatibility
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe('Analyze this file');

      // After sanitization, no incomplete tool call remains
      expect(sessionManager.hasIncompleteToolCall(messages)).toBe(false);
      expect(sessionManager.getLastToolCall(messages)).toBeNull();
    });

    it('should handle completed session correctly', async () => {
      // Full cycle: user -> tool_call -> tool_result -> assistant
      await storage.appendEvent(sessionId, {
        type: 'user',
        timestamp: 1000,
        data: { role: 'user', content: 'What is 2+2?' },
      });

      await storage.appendEvent(sessionId, {
        type: 'tool_call',
        timestamp: 2000,
        data: {
          id: 'calc-123',
          tool: 'Calculator',
          params: { expression: '2+2' },
          agent: 'math-agent',
        },
      });

      await storage.appendEvent(sessionId, {
        type: 'tool_result',
        timestamp: 3000,
        data: { toolCallId: 'calc-123', result: '4' },
      });

      await storage.appendEvent(sessionId, {
        type: 'assistant',
        timestamp: 4000,
        data: { role: 'assistant', content: '2+2 equals 4', agent: 'math-agent' },
      });

      const messages = await sessionManager.recoverSession(sessionId);
      expect(messages).toHaveLength(4);

      // Should NOT have incomplete tool call
      expect(sessionManager.hasIncompleteToolCall(messages)).toBe(false);
      expect(sessionManager.getLastToolCall(messages)).toBeNull();
    });
  });
});
