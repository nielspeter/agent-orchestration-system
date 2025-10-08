import { expect } from 'vitest';
import { EventStreamParser } from '../utils/event-stream-parser';
import type { EventMessage } from '../types/event-types';

interface CustomMatchers<R = unknown> {
  toHaveCompleted(completionKeywords?: string[]): R;
  toHaveDelegatedToAgents(expectedAgents: string[]): R;
  toHaveExecutedTools(toolNames: string[]): R;
  toNotContainPatterns(patterns: RegExp[]): R;
  toHaveAgentInteractions(minInteractions: number): R;
  toHaveKeywords(keywords: string[]): R;
}

declare module 'vitest' {
  // These interfaces are intentionally empty - they extend CustomMatchers
  // This is the correct pattern for Vitest matcher type augmentation
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Assertion<T = any> extends CustomMatchers<T> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

/**
 * Custom Vitest matchers for agent system testing.
 * These matchers provide clean, semantic assertions for agent behavior.
 */
expect.extend({
  /**
   * Check if execution reached completion (using configurable keywords)
   */
  toHaveCompleted(
    messages: EventMessage[],
    completionKeywords: string[] = ['completed', 'finished', 'done', 'success', 'victory', 'wins']
  ) {
    const hasCompletion = EventStreamParser.hasKeywords(messages, completionKeywords);

    return {
      pass: hasCompletion,
      message: () =>
        hasCompletion
          ? 'Expected execution to not have completion markers'
          : `Expected execution to have completion (keywords: ${completionKeywords.join(', ')}), but none found`,
      actual: hasCompletion,
      expected: true,
    };
  },

  /**
   * Check if system delegated to expected agents
   */
  toHaveDelegatedToAgents(messages: EventMessage[], expectedAgents: string[]) {
    const delegations = EventStreamParser.extractDelegations(messages);
    const delegatedTo = new Set(delegations.map((d) => d.to));
    const missing = expectedAgents.filter((agent) => !delegatedTo.has(agent));

    return {
      pass: missing.length === 0,
      message: () =>
        missing.length === 0
          ? `Expected to not delegate to agents ${expectedAgents.join(', ')}`
          : `Expected to delegate to agents: ${missing.join(', ')}, but only found: ${Array.from(delegatedTo).join(', ')}`,
      actual: Array.from(delegatedTo),
      expected: expectedAgents,
    };
  },

  /**
   * Check if specific tools were executed
   */
  toHaveExecutedTools(messages: EventMessage[], toolNames: string[]) {
    const toolCalls = EventStreamParser.extractToolCalls(messages);
    const calledTools = new Set(toolCalls.map((tc) => tc?.tool).filter(Boolean));
    const missing = toolNames.filter((tool) => !calledTools.has(tool));

    return {
      pass: missing.length === 0,
      message: () => {
        if (missing.length === 0) {
          return `Expected to not execute tools: ${toolNames.join(', ')}`;
        }
        return `Expected tools ${missing.join(', ')} were not executed. Found: ${Array.from(calledTools).join(', ')}`;
      },
      actual: Array.from(calledTools),
      expected: toolNames,
    };
  },

  /**
   * Check that content does not contain certain patterns (e.g., simulated responses)
   */
  toNotContainPatterns(messages: EventMessage[], patterns: RegExp[]) {
    const assistantMessages = messages.filter(
      (msg: any) => msg.type === 'assistant' && msg.data?.content
    );

    const matches: string[] = [];
    assistantMessages.forEach((msg: any) => {
      patterns.forEach((pattern) => {
        if (pattern.test(msg.data?.content || '')) {
          matches.push(`Pattern "${pattern}" found in: "${msg.data.content.substring(0, 100)}..."`);
        }
      });
    });

    return {
      pass: matches.length === 0,
      message: () =>
        matches.length === 0
          ? 'Expected to find patterns'
          : `Expected no pattern matches, but found:\n${matches.join('\n')}`,
      actual: matches.length,
      expected: 0,
    };
  },

  /**
   * Check minimum agent interactions
   */
  toHaveAgentInteractions(messages: EventMessage[], minInteractions: number) {
    const agentCalls = EventStreamParser.extractAgentCalls(messages);

    return {
      pass: agentCalls.length >= minInteractions,
      message: () =>
        `Expected at least ${minInteractions} agent interactions, but found ${agentCalls.length}: ${agentCalls.join(', ')}`,
      actual: agentCalls.length,
      expected: minInteractions,
    };
  },

  /**
   * Check if messages contain specific keywords
   */
  toHaveKeywords(messages: EventMessage[], keywords: string[]) {
    const hasKeywords = EventStreamParser.hasKeywords(messages, keywords);

    return {
      pass: hasKeywords,
      message: () =>
        hasKeywords
          ? `Expected to not have keywords: ${keywords.join(', ')}`
          : `Expected to have keywords: ${keywords.join(', ')}, but none found`,
      actual: hasKeywords,
      expected: true,
    };
  },
});
