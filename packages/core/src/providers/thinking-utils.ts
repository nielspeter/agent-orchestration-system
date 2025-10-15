import { AgentLogger } from '@/logging';

/**
 * Shared utilities for thinking/reasoning support across providers
 *
 * Different providers implement thinking differently:
 * - Anthropic: Explicit thinking parameter with budget tokens
 * - OpenRouter: Dynamic discovery via API responses
 * - OpenAI o1/o3: Automatic internal reasoning
 *
 * These utilities provide common functionality without forcing inheritance.
 */

export interface ThinkingContentBlock {
  type: 'thinking' | 'redacted_thinking';
  content?: string;
}

/**
 * Log thinking metrics in a consistent format across providers
 */
export function logThinkingMetrics(
  logger: AgentLogger | undefined,
  thinkingTokens: number,
  thinkingBlocks?: ThinkingContentBlock[]
): void {
  if (!logger) return;

  // Allow logging even if thinkingTokens is 0 (interleaved thinking may not report token count)
  if (!thinkingBlocks || thinkingBlocks.length === 0) return;

  let thinkingText = '';
  let hasRedacted = false;

  if (thinkingBlocks && thinkingBlocks.length > 0) {
    for (const block of thinkingBlocks) {
      if (block.type === 'thinking' && block.content) {
        thinkingText += block.content + '\n\n';
      } else if (block.type === 'redacted_thinking') {
        hasRedacted = true;
        thinkingText += '[REDACTED - Content encrypted for safety]\n\n';
      }
    }

    const icon = hasRedacted ? '🔒' : '🧠';
    const label = hasRedacted ? 'Hidden Reasoning' : 'Agent Thinking';

    if (thinkingText && !hasRedacted) {
      logger.logSystemMessage(`${icon} ${label}:\n${thinkingText.trim()}`);
    }
  }

  logger.logSystemMessage(`📊 Thinking Metrics: ${thinkingTokens} tokens used for reasoning`);
}
