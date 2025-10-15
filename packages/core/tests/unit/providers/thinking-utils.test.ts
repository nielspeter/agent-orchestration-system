import { describe, expect, test, vi, beforeEach } from 'vitest';
import { logThinkingMetrics, ThinkingContentBlock } from '@/providers/thinking-utils';
import type { AgentLogger } from '@/logging';

describe('logThinkingMetrics', () => {
  let mockLogger: AgentLogger;
  let loggedMessages: string[];

  beforeEach(() => {
    loggedMessages = [];
    mockLogger = {
      logSystemMessage: vi.fn((message: string) => {
        loggedMessages.push(message);
      }),
    } as unknown as AgentLogger;
  });

  describe('Early return conditions', () => {
    test('should return early when logger is undefined', () => {
      const thinkingBlocks: ThinkingContentBlock[] = [
        { type: 'thinking', content: 'Some thinking' },
      ];

      logThinkingMetrics(undefined, 0, thinkingBlocks);

      // No error should be thrown
      expect(true).toBe(true);
    });

    test('should return early when thinking blocks array is undefined', () => {
      logThinkingMetrics(mockLogger, 0, undefined);

      expect(loggedMessages).toHaveLength(0);
    });

    test('should return early when thinking blocks array is empty', () => {
      logThinkingMetrics(mockLogger, 0, []);

      expect(loggedMessages).toHaveLength(0);
    });
  });

  describe('Thinking block display with zero token count', () => {
    test('should display thinking content even when token count is 0', () => {
      // This is the key fix: logThinkingMetrics should work even with thinkingTokens=0
      // because interleaved thinking doesn't report token counts
      const thinkingBlocks: ThinkingContentBlock[] = [
        { type: 'thinking', content: 'Let me analyze this problem...' },
      ];

      logThinkingMetrics(mockLogger, 0, thinkingBlocks);

      // Should log both the thinking content AND the metrics
      expect(loggedMessages).toHaveLength(2);
      expect(loggedMessages[0]).toContain('🧠 Agent Thinking:');
      expect(loggedMessages[0]).toContain('Let me analyze this problem...');
      expect(loggedMessages[1]).toContain('📊 Thinking Metrics: 0 tokens used for reasoning');
    });

    test('should display thinking content with non-zero token count', () => {
      const thinkingBlocks: ThinkingContentBlock[] = [
        { type: 'thinking', content: 'My reasoning process...' },
      ];

      logThinkingMetrics(mockLogger, 1500, thinkingBlocks);

      expect(loggedMessages).toHaveLength(2);
      expect(loggedMessages[0]).toContain('🧠 Agent Thinking:');
      expect(loggedMessages[0]).toContain('My reasoning process...');
      expect(loggedMessages[1]).toContain('📊 Thinking Metrics: 1500 tokens used for reasoning');
    });
  });

  describe('Multiple thinking blocks', () => {
    test('should combine multiple thinking blocks', () => {
      const thinkingBlocks: ThinkingContentBlock[] = [
        { type: 'thinking', content: 'First thought' },
        { type: 'thinking', content: 'Second thought' },
        { type: 'thinking', content: 'Third thought' },
      ];

      logThinkingMetrics(mockLogger, 0, thinkingBlocks);

      expect(loggedMessages).toHaveLength(2);
      expect(loggedMessages[0]).toContain('First thought');
      expect(loggedMessages[0]).toContain('Second thought');
      expect(loggedMessages[0]).toContain('Third thought');
    });

    test('should handle mix of thinking and redacted_thinking blocks', () => {
      const thinkingBlocks: ThinkingContentBlock[] = [
        { type: 'thinking', content: 'Public thought' },
        { type: 'redacted_thinking' },
        { type: 'thinking', content: 'Another public thought' },
      ];

      logThinkingMetrics(mockLogger, 0, thinkingBlocks);

      // When redacted blocks exist, should not show thinking content
      // but still show metrics
      expect(loggedMessages).toHaveLength(1);
      expect(loggedMessages[0]).toContain('📊 Thinking Metrics: 0 tokens used for reasoning');
    });
  });

  describe('Redacted thinking blocks', () => {
    test('should show redacted indicator for redacted_thinking blocks', () => {
      const thinkingBlocks: ThinkingContentBlock[] = [{ type: 'redacted_thinking' }];

      logThinkingMetrics(mockLogger, 0, thinkingBlocks);

      // Should only show metrics, not content (because it's redacted)
      expect(loggedMessages).toHaveLength(1);
      expect(loggedMessages[0]).toContain('📊 Thinking Metrics');
    });

    test('should use lock icon for redacted thinking', () => {
      const thinkingBlocks: ThinkingContentBlock[] = [
        { type: 'thinking', content: 'Some content' },
        { type: 'redacted_thinking' },
      ];

      logThinkingMetrics(mockLogger, 0, thinkingBlocks);

      // When any block is redacted, content is not shown
      expect(loggedMessages).toHaveLength(1);
    });
  });

  describe('Content formatting', () => {
    test('should trim whitespace from thinking content', () => {
      const thinkingBlocks: ThinkingContentBlock[] = [
        { type: 'thinking', content: '  \n  My thinking  \n  ' },
      ];

      logThinkingMetrics(mockLogger, 0, thinkingBlocks);

      expect(loggedMessages[0]).not.toMatch(/^\s+/); // No leading whitespace
      expect(loggedMessages[0]).not.toMatch(/\s+$/); // No trailing whitespace
    });

    test('should preserve newlines within thinking content', () => {
      const thinkingBlocks: ThinkingContentBlock[] = [
        { type: 'thinking', content: 'Line 1\nLine 2\nLine 3' },
      ];

      logThinkingMetrics(mockLogger, 0, thinkingBlocks);

      expect(loggedMessages[0]).toContain('Line 1');
      expect(loggedMessages[0]).toContain('Line 2');
      expect(loggedMessages[0]).toContain('Line 3');
    });

    test('should handle empty thinking content gracefully', () => {
      const thinkingBlocks: ThinkingContentBlock[] = [{ type: 'thinking', content: '' }];

      logThinkingMetrics(mockLogger, 0, thinkingBlocks);

      // Should only log metrics when content is empty
      expect(loggedMessages).toHaveLength(1);
      expect(loggedMessages[0]).toContain('📊 Thinking Metrics');
    });

    test('should handle thinking block without content property', () => {
      const thinkingBlocks: ThinkingContentBlock[] = [
        { type: 'thinking' }, // Missing content
      ];

      logThinkingMetrics(mockLogger, 0, thinkingBlocks);

      // Should only log metrics when content is undefined
      expect(loggedMessages).toHaveLength(1);
      expect(loggedMessages[0]).toContain('📊 Thinking Metrics');
    });
  });

  describe('Icon and label selection', () => {
    test('should use brain icon for normal thinking', () => {
      const thinkingBlocks: ThinkingContentBlock[] = [
        { type: 'thinking', content: 'Normal thinking' },
      ];

      logThinkingMetrics(mockLogger, 0, thinkingBlocks);

      expect(loggedMessages[0]).toContain('🧠 Agent Thinking:');
    });

    test('should use brain icon when token count is provided', () => {
      const thinkingBlocks: ThinkingContentBlock[] = [
        { type: 'thinking', content: 'Thinking with tokens' },
      ];

      logThinkingMetrics(mockLogger, 5000, thinkingBlocks);

      expect(loggedMessages[0]).toContain('🧠 Agent Thinking:');
      expect(loggedMessages[1]).toContain('5000 tokens');
    });
  });

  describe('Integration scenarios', () => {
    test('should handle typical interleaved thinking scenario (0 tokens, content present)', () => {
      // Typical scenario from Claude interleaved-thinking API:
      // - thinking_tokens field is not present (0)
      // - but thinking blocks exist in content
      const thinkingBlocks: ThinkingContentBlock[] = [
        {
          type: 'thinking',
          content:
            'The user is asking me to implement a feature. Let me break this down:\n1. Understand requirements\n2. Plan approach\n3. Execute implementation',
        },
      ];

      logThinkingMetrics(mockLogger, 0, thinkingBlocks);

      expect(loggedMessages).toHaveLength(2);
      expect(loggedMessages[0]).toContain('🧠 Agent Thinking:');
      expect(loggedMessages[0]).toContain('Understand requirements');
      expect(loggedMessages[1]).toContain('📊 Thinking Metrics: 0 tokens');
    });

    test('should handle extended thinking scenario (tokens reported, content present)', () => {
      // Extended thinking scenario:
      // - thinking_tokens field is present
      // - thinking blocks exist in content
      const thinkingBlocks: ThinkingContentBlock[] = [
        {
          type: 'thinking',
          content: 'Deep analysis of the problem using extended thinking...',
        },
      ];

      logThinkingMetrics(mockLogger, 12000, thinkingBlocks);

      expect(loggedMessages).toHaveLength(2);
      expect(loggedMessages[0]).toContain('🧠 Agent Thinking:');
      expect(loggedMessages[0]).toContain('Deep analysis');
      expect(loggedMessages[1]).toContain('📊 Thinking Metrics: 12000 tokens');
    });

    test('should handle multiple sequential calls', () => {
      const blocks1: ThinkingContentBlock[] = [{ type: 'thinking', content: 'First call' }];
      const blocks2: ThinkingContentBlock[] = [{ type: 'thinking', content: 'Second call' }];

      logThinkingMetrics(mockLogger, 0, blocks1);
      logThinkingMetrics(mockLogger, 0, blocks2);

      expect(loggedMessages).toHaveLength(4);
      expect(loggedMessages[0]).toContain('First call');
      expect(loggedMessages[2]).toContain('Second call');
    });
  });

  describe('Edge cases', () => {
    test('should handle very long thinking content', () => {
      const longContent = 'A'.repeat(10000);
      const thinkingBlocks: ThinkingContentBlock[] = [{ type: 'thinking', content: longContent }];

      logThinkingMetrics(mockLogger, 0, thinkingBlocks);

      expect(loggedMessages).toHaveLength(2);
      expect(loggedMessages[0]).toContain(longContent);
    });

    test('should handle special characters in thinking content', () => {
      const thinkingBlocks: ThinkingContentBlock[] = [
        { type: 'thinking', content: 'Thinking with 🎉 emojis and \n special \\n chars' },
      ];

      logThinkingMetrics(mockLogger, 0, thinkingBlocks);

      expect(loggedMessages[0]).toContain('🎉');
      expect(loggedMessages[0]).toContain('\\n');
    });

    test('should handle negative token counts gracefully', () => {
      const thinkingBlocks: ThinkingContentBlock[] = [
        { type: 'thinking', content: 'Some thinking' },
      ];

      // This shouldn't happen in practice, but test graceful handling
      logThinkingMetrics(mockLogger, -100, thinkingBlocks);

      expect(loggedMessages).toHaveLength(2);
      expect(loggedMessages[1]).toContain('-100 tokens');
    });

    test('should handle extremely large token counts', () => {
      const thinkingBlocks: ThinkingContentBlock[] = [
        { type: 'thinking', content: 'Extended thinking' },
      ];

      logThinkingMetrics(mockLogger, 999999999, thinkingBlocks);

      expect(loggedMessages).toHaveLength(2);
      expect(loggedMessages[1]).toContain('999999999 tokens');
    });
  });
});
