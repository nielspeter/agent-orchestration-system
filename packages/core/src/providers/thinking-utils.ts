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

export interface ThinkingMetricsInput {
  thinkingTokens: number;
  model: string;
  provider: string;
}

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
  if (!logger || !thinkingTokens) return;

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

/**
 * Calculate thinking cost based on pricing
 * Thinking tokens are typically priced the same as input tokens
 */
export function calculateThinkingCost(thinkingTokens: number, inputPricePerK: number): number {
  return (thinkingTokens / 1000) * inputPricePerK;
}

/**
 * Format thinking content blocks for display
 */
export function formatThinkingContent(thinkingBlocks: ThinkingContentBlock[]): string {
  const parts: string[] = [];

  for (const block of thinkingBlocks) {
    if (block.type === 'thinking' && block.content) {
      parts.push(block.content);
    } else if (block.type === 'redacted_thinking') {
      parts.push('[REDACTED]');
    }
  }

  return parts.join('\n\n');
}

/**
 * Check if a response contains thinking/reasoning content
 */
export function hasThinkingContent(response: unknown): boolean {
  if (!response || typeof response !== 'object') return false;

  // Anthropic format: response.content array with thinking blocks
  if ('content' in response && Array.isArray(response.content)) {
    return response.content.some(
      (block: unknown) =>
        typeof block === 'object' &&
        block !== null &&
        'type' in block &&
        (block.type === 'thinking' || block.type === 'redacted_thinking')
    );
  }

  // OpenAI o1 format: response.reasoning field
  if ('reasoning' in response && typeof response.reasoning === 'string') {
    return response.reasoning.length > 0;
  }

  return false;
}
