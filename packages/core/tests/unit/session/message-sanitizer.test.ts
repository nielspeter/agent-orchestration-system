import { describe, it, expect } from 'vitest';
import {
  sanitizeRecoveredMessages,
  validateMessageStructure,
  formatSanitizationIssues,
  SanitizationResult,
} from '@/session/message-sanitizer';
import { Message } from '@/base-types';

describe('Message Sanitizer: Guaranteed Recovery from ANY State', () => {
  describe('Layer 1: Structure Validation', () => {
    it('should handle empty messages array', () => {
      const result = sanitizeRecoveredMessages([]);

      expect(result.recovered).toBe(true);
      expect(result.messages).toEqual([]);
      expect(result.issues).toHaveLength(0);
    });

    it('should handle non-array input', () => {
      const result = sanitizeRecoveredMessages(null as unknown as Message[]);

      expect(result.recovered).toBe(true);
      expect(result.messages).toEqual([]);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('invalid_message');
    });

    it('should remove invalid messages (missing role)', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
        { content: 'No role' } as Message,
        { role: 'assistant', content: 'Hi' },
      ];

      const result = sanitizeRecoveredMessages(messages);

      expect(result.recovered).toBe(true);
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].content).toBe('Hello');
      expect(result.messages[1].content).toBe('Hi');
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('invalid_message');
    });

    it('should remove invalid messages (invalid role)', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
        { role: 'invalid' as 'user', content: 'Bad role' },
        { role: 'assistant', content: 'Hi' },
      ];

      const result = sanitizeRecoveredMessages(messages);

      expect(result.recovered).toBe(true);
      expect(result.messages).toHaveLength(2);
      expect(result.issues).toHaveLength(1);
    });

    it('should remove tool messages without tool_call_id', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
        { role: 'tool', content: 'Result' } as Message, // Missing tool_call_id
      ];

      const result = sanitizeRecoveredMessages(messages);

      expect(result.recovered).toBe(true);
      expect(result.messages).toHaveLength(1);
      expect(result.issues).toHaveLength(1);
    });
  });

  describe('Layer 2: Empty Message Removal', () => {
    it('should remove messages with no content', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant' }, // No content
        { role: 'assistant', content: 'Response' },
      ];

      const result = sanitizeRecoveredMessages(messages);

      expect(result.recovered).toBe(true);
      expect(result.messages).toHaveLength(2);
      expect(result.issues.some((i) => i.type === 'empty_message')).toBe(true);
    });

    it('should keep messages with raw_content (thinking blocks)', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', raw_content: { thinking: 'analyzing...' } },
      ];

      const result = sanitizeRecoveredMessages(messages);

      expect(result.recovered).toBe(true);
      expect(result.messages).toHaveLength(2);
      expect(result.messages[1].raw_content).toBeDefined();
    });
  });

  describe('Layer 3: Incomplete Tool Call Handling', () => {
    it('should remove incomplete tool call at end of conversation', () => {
      const messages: Message[] = [
        { role: 'user', content: 'List files' },
        {
          role: 'assistant',
          tool_calls: [
            {
              id: 'call_123',
              type: 'function',
              function: { name: 'list', arguments: '{}' },
            },
          ],
        },
        // Missing tool result
      ];

      const result = sanitizeRecoveredMessages(messages);

      expect(result.recovered).toBe(true);
      expect(result.messages).toHaveLength(1); // Only user message kept
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('incomplete_tool_call');
      expect(result.issues[0].action).toBe('removed_message');
    });

    it('should preserve text content when removing incomplete tool calls', () => {
      const messages: Message[] = [
        { role: 'user', content: 'List files' },
        {
          role: 'assistant',
          content: 'Let me check that...',
          tool_calls: [
            {
              id: 'call_123',
              type: 'function',
              function: { name: 'list', arguments: '{}' },
            },
          ],
        },
        // Missing tool result
      ];

      const result = sanitizeRecoveredMessages(messages);

      expect(result.recovered).toBe(true);
      expect(result.messages).toHaveLength(2);
      expect(result.messages[1].role).toBe('assistant');
      expect(result.messages[1].content).toBe('Let me check that...');
      expect(result.messages[1].tool_calls).toBeUndefined();
      expect(result.issues[0].type).toBe('incomplete_tool_call');
      expect(result.issues[0].action).toBe('removed_tool_calls');
    });

    it('should remove incomplete tool call in middle of conversation', () => {
      const messages: Message[] = [
        { role: 'user', content: 'First question' },
        {
          role: 'assistant',
          tool_calls: [
            {
              id: 'call_123',
              type: 'function',
              function: { name: 'read', arguments: '{}' },
            },
          ],
        },
        // Missing tool result
        { role: 'user', content: 'Second question' },
        { role: 'assistant', content: 'Second answer' },
      ];

      const result = sanitizeRecoveredMessages(messages);

      expect(result.recovered).toBe(true);
      expect(result.messages).toHaveLength(3);
      expect(result.messages[0].content).toBe('First question');
      expect(result.messages[1].content).toBe('Second question');
      expect(result.messages[2].content).toBe('Second answer');
    });

    it('should handle partial parallel tool execution', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Do three things' },
        {
          role: 'assistant',
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: { name: 'tool1', arguments: '{}' },
            },
            {
              id: 'call_2',
              type: 'function',
              function: { name: 'tool2', arguments: '{}' },
            },
            {
              id: 'call_3',
              type: 'function',
              function: { name: 'tool3', arguments: '{}' },
            },
          ],
        },
        {
          role: 'tool',
          tool_call_id: 'call_1',
          content: 'Result 1',
        },
        {
          role: 'tool',
          tool_call_id: 'call_2',
          content: 'Result 2',
        },
        // Missing call_3 result - crash happened
      ];

      const result = sanitizeRecoveredMessages(messages);

      expect(result.recovered).toBe(true);
      // Should remove the incomplete tool call but keep completed ones
      const assistantMsg = result.messages.find((m) => m.role === 'assistant');
      expect(assistantMsg?.tool_calls).toHaveLength(2);
      expect(assistantMsg?.tool_calls?.[0].id).toBe('call_1');
      expect(assistantMsg?.tool_calls?.[1].id).toBe('call_2');
    });

    it('should remove all tool calls if all incomplete in parallel execution', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Do three things' },
        {
          role: 'assistant',
          content: 'Working on it...',
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: { name: 'tool1', arguments: '{}' },
            },
            {
              id: 'call_2',
              type: 'function',
              function: { name: 'tool2', arguments: '{}' },
            },
          ],
        },
        // All tool results missing - crash before any completed
      ];

      const result = sanitizeRecoveredMessages(messages);

      expect(result.recovered).toBe(true);
      expect(result.messages).toHaveLength(2);
      const assistantMsg = result.messages.find((m) => m.role === 'assistant');
      expect(assistantMsg?.content).toBe('Working on it...');
      expect(assistantMsg?.tool_calls).toBeUndefined();
    });
  });

  describe('Layer 4: Orphaned Tool Result Handling', () => {
    it('should remove orphaned tool result', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
        {
          role: 'tool',
          tool_call_id: 'call_nonexistent',
          content: 'Orphaned result',
        },
        { role: 'assistant', content: 'Response' },
      ];

      const result = sanitizeRecoveredMessages(messages);

      expect(result.recovered).toBe(true);
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[1].role).toBe('assistant');
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('orphaned_tool_result');
    });

    it('should remove multiple orphaned tool results', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
        {
          role: 'tool',
          tool_call_id: 'call_1',
          content: 'Orphaned 1',
        },
        {
          role: 'tool',
          tool_call_id: 'call_2',
          content: 'Orphaned 2',
        },
        { role: 'assistant', content: 'Response' },
      ];

      const result = sanitizeRecoveredMessages(messages);

      expect(result.recovered).toBe(true);
      expect(result.messages).toHaveLength(2);
      expect(result.issues).toHaveLength(2);
      expect(result.issues.every((i) => i.type === 'orphaned_tool_result')).toBe(true);
    });
  });

  describe('Layer 5: Complete Tool Call/Result Pairs', () => {
    it('should preserve complete tool_call/tool_result pair', () => {
      const messages: Message[] = [
        { role: 'user', content: 'List files' },
        {
          role: 'assistant',
          tool_calls: [
            {
              id: 'call_123',
              type: 'function',
              function: { name: 'list', arguments: '{}' },
            },
          ],
        },
        {
          role: 'tool',
          tool_call_id: 'call_123',
          content: 'file1.txt, file2.txt',
        },
        { role: 'assistant', content: 'Here are the files' },
      ];

      const result = sanitizeRecoveredMessages(messages);

      expect(result.recovered).toBe(true);
      expect(result.messages).toHaveLength(4);
      expect(result.issues).toHaveLength(0);
    });

    it('should preserve multiple complete tool_call/result pairs', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Do stuff' },
        {
          role: 'assistant',
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: { name: 'tool1', arguments: '{}' },
            },
            {
              id: 'call_2',
              type: 'function',
              function: { name: 'tool2', arguments: '{}' },
            },
          ],
        },
        {
          role: 'tool',
          tool_call_id: 'call_1',
          content: 'Result 1',
        },
        {
          role: 'tool',
          tool_call_id: 'call_2',
          content: 'Result 2',
        },
        { role: 'assistant', content: 'Done' },
      ];

      const result = sanitizeRecoveredMessages(messages);

      expect(result.recovered).toBe(true);
      expect(result.messages).toHaveLength(5);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('Complex Mixed Scenarios', () => {
    it('should handle mix of complete and incomplete tool calls', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Task 1' },
        {
          role: 'assistant',
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: { name: 'tool1', arguments: '{}' },
            },
          ],
        },
        {
          role: 'tool',
          tool_call_id: 'call_1',
          content: 'Result 1',
        },
        { role: 'assistant', content: 'Done with task 1' },
        { role: 'user', content: 'Task 2' },
        {
          role: 'assistant',
          tool_calls: [
            {
              id: 'call_2',
              type: 'function',
              function: { name: 'tool2', arguments: '{}' },
            },
          ],
        },
        // Missing result for call_2
      ];

      const result = sanitizeRecoveredMessages(messages);

      expect(result.recovered).toBe(true);
      // First 4 messages (complete interaction) + user message + partial assistant
      expect(result.messages.length).toBeGreaterThanOrEqual(5);
      expect(result.issues.some((i) => i.type === 'incomplete_tool_call')).toBe(true);
    });

    it('should handle corrupted message in middle of valid conversation', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Start' },
        { role: 'assistant', content: 'Started' },
        { content: 'Corrupted - no role' } as Message,
        { role: 'user', content: 'Continue' },
        { role: 'assistant', content: 'Continuing' },
      ];

      const result = sanitizeRecoveredMessages(messages);

      expect(result.recovered).toBe(true);
      expect(result.messages).toHaveLength(4);
      expect(result.messages.map((m) => m.content)).toEqual([
        'Start',
        'Started',
        'Continue',
        'Continuing',
      ]);
    });
  });

  describe('Fallback Strategy: Progressive Recovery', () => {
    it('should apply fallback when sanitization still invalid', () => {
      // Create a scenario that's hard to fix - artificially break validation
      const messages: Message[] = [
        { role: 'user', content: 'Test' },
        {
          role: 'assistant',
          tool_calls: [
            {
              id: 'call_loop',
              type: 'function',
              function: { name: 'tool', arguments: '{}' },
            },
          ],
        },
      ];

      const result = sanitizeRecoveredMessages(messages);

      // Even if it has to remove messages, it should still recover
      expect(result.recovered).toBe(true);
      expect(result.messages).toBeDefined();
      // Validation should pass for returned messages
      const validation = validateMessageStructure(result.messages);
      expect(validation.valid).toBe(true);
    });

    it('should fallback to empty array if completely corrupted', () => {
      const messages: Message[] = [
        { role: 'invalid' } as Message,
        { content: 'no role' } as Message,
        {} as Message,
      ];

      const result = sanitizeRecoveredMessages(messages);

      expect(result.recovered).toBe(true);
      expect(result.messages).toEqual([]);
      expect(result.issues.length).toBeGreaterThan(0);
    });
  });

  describe('Validation Function', () => {
    it('should validate clean messages as valid', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
      ];

      const validation = validateMessageStructure(messages);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect incomplete tool call', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Test' },
        {
          role: 'assistant',
          tool_calls: [
            {
              id: 'call_123',
              type: 'function',
              function: { name: 'test', arguments: '{}' },
            },
          ],
        },
      ];

      const validation = validateMessageStructure(messages);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0]).toContain('tool_call call_123');
      expect(validation.errors[0]).toContain('missing matching tool_result');
    });

    it('should detect orphaned tool result', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Test' },
        {
          role: 'tool',
          tool_call_id: 'call_nonexistent',
          content: 'Result',
        },
      ];

      const validation = validateMessageStructure(messages);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0]).toContain('tool_result call_nonexistent');
      expect(validation.errors[0]).toContain('missing matching tool_call');
    });
  });

  describe('Issue Formatting', () => {
    it('should format no issues correctly', () => {
      const formatted = formatSanitizationIssues([]);
      expect(formatted).toBe('No issues found');
    });

    it('should format issues with details', () => {
      const result: SanitizationResult = {
        messages: [],
        recovered: true,
        issues: [
          {
            type: 'incomplete_tool_call',
            index: 2,
            action: 'removed_tool_calls',
            details: 'Removed incomplete tool_call call_123',
          },
          {
            type: 'orphaned_tool_result',
            index: 5,
            action: 'removed_message',
            details: 'Removed orphaned tool_result call_456',
          },
        ],
      };

      const formatted = formatSanitizationIssues(result.issues);

      expect(formatted).toContain('Sanitized 2 issue(s)');
      expect(formatted).toContain('incomplete_tool_call');
      expect(formatted).toContain('orphaned_tool_result');
      expect(formatted).toContain('call_123');
      expect(formatted).toContain('call_456');
    });
  });

  describe('Real-World Scenarios', () => {
    it('should recover from session saved mid-tool-execution', () => {
      // Simulates: Agent requested tool, session saved, process killed before tool executed
      const messages: Message[] = [
        { role: 'user', content: 'Analyze the codebase' },
        { role: 'assistant', content: 'Let me read the main file...' },
        {
          role: 'assistant',
          tool_calls: [
            {
              id: 'call_read',
              type: 'function',
              function: { name: 'read', arguments: '{"path":"src/main.ts"}' },
            },
          ],
        },
        // Process killed here - no tool result
      ];

      const result = sanitizeRecoveredMessages(messages);

      expect(result.recovered).toBe(true);
      expect(result.messages.length).toBeGreaterThan(0);
      const validation = validateMessageStructure(result.messages);
      expect(validation.valid).toBe(true);
    });

    it('should recover from session with thinking blocks and incomplete tools', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Complex task' },
        {
          role: 'assistant',
          content: 'Let me think about this...',
          raw_content: { thinking: 'analyzing requirements...' },
          tool_calls: [
            {
              id: 'call_analyze',
              type: 'function',
              function: { name: 'analyze', arguments: '{}' },
            },
          ],
        },
        // No tool result
      ];

      const result = sanitizeRecoveredMessages(messages);

      expect(result.recovered).toBe(true);
      // Should preserve thinking content
      const assistantMsg = result.messages.find((m) => m.role === 'assistant');
      expect(assistantMsg?.content).toBe('Let me think about this...');
      expect(assistantMsg?.raw_content).toBeDefined();
      expect(assistantMsg?.tool_calls).toBeUndefined();
    });
  });

  describe('GUARANTEE: Recovery from ANY State', () => {
    it('should ALWAYS recover successfully - empty array', () => {
      const result = sanitizeRecoveredMessages([]);
      expect(result.recovered).toBe(true);
    });

    it('should ALWAYS recover successfully - single user message', () => {
      const result = sanitizeRecoveredMessages([{ role: 'user', content: 'Test' }]);
      expect(result.recovered).toBe(true);
      expect(validateMessageStructure(result.messages).valid).toBe(true);
    });

    it('should ALWAYS recover successfully - incomplete tool call', () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: { name: 'tool', arguments: '{}' },
            },
          ],
        },
      ];

      const result = sanitizeRecoveredMessages(messages);
      expect(result.recovered).toBe(true);
      expect(validateMessageStructure(result.messages).valid).toBe(true);
    });

    it('should ALWAYS recover successfully - orphaned tool result', () => {
      const messages: Message[] = [
        {
          role: 'tool',
          tool_call_id: 'call_orphan',
          content: 'Result',
        },
      ];

      const result = sanitizeRecoveredMessages(messages);
      expect(result.recovered).toBe(true);
      expect(validateMessageStructure(result.messages).valid).toBe(true);
    });

    it('should ALWAYS recover successfully - all messages corrupted', () => {
      const messages: Message[] = [
        {} as Message,
        { content: 'no role' } as Message,
        { role: 'invalid' as 'user' },
      ];

      const result = sanitizeRecoveredMessages(messages);
      expect(result.recovered).toBe(true);
      expect(validateMessageStructure(result.messages).valid).toBe(true);
    });

    it('should ALWAYS recover successfully - complex chaos', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Start' },
        {} as Message, // Corrupted
        {
          role: 'assistant',
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: { name: 'tool1', arguments: '{}' },
            },
          ],
        },
        // No result for call_1
        {
          role: 'tool',
          tool_call_id: 'call_orphan',
          content: 'Orphaned',
        },
        { content: 'no role' } as Message,
        {
          role: 'assistant',
          tool_calls: [
            {
              id: 'call_2',
              type: 'function',
              function: { name: 'tool2', arguments: '{}' },
            },
          ],
        },
        // No result for call_2
      ];

      const result = sanitizeRecoveredMessages(messages);
      expect(result.recovered).toBe(true);
      expect(validateMessageStructure(result.messages).valid).toBe(true);
      // Should have removed problematic messages
      expect(result.issues.length).toBeGreaterThan(0);
    });
  });
});
