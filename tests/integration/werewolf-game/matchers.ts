import { expect } from 'vitest';
import { GameEventParser } from './parser';

interface CustomMatchers<R = unknown> {
  toHaveGameCompletion(): R;
  toHaveDelegatedToAgents(expectedAgents: string[]): R;
  toHaveValidRoleAssignments(expectedRoles?: string[]): R;
  toNotSimulateResponses(): R;
  toHaveAgentInteractions(minInteractions: number): R;
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
 * Custom Vitest matchers for game testing.
 * These matchers provide clean, semantic assertions for game behavior.
 */
expect.extend({
  /**
   * Check if game reached completion (victory condition)
   */
  toHaveGameCompletion(messages: any[]) {
    const hasVictory = GameEventParser.hasVictory(messages);
    const winner = GameEventParser.extractWinner(messages);

    return {
      pass: hasVictory,
      message: () =>
        hasVictory
          ? `Expected game to not have completion, but ${winner} won`
          : 'Expected game to have completion (victory/win condition), but none found',
      actual: { hasVictory, winner },
      expected: { hasVictory: true },
    };
  },

  /**
   * Check if game delegated to expected agents
   */
  toHaveDelegatedToAgents(messages: any[], expectedAgents: string[]) {
    const delegations = GameEventParser.extractDelegations(messages);
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
   * Check if role assignments are valid
   */
  toHaveValidRoleAssignments(
    messages: any[],
    expectedRoles: string[] = ['werewolf', 'seer', 'villager']
  ) {
    const roles = GameEventParser.extractRoles(messages);
    const roleValues = Object.values(roles);

    const hasAllRoles = expectedRoles.every((role) => roleValues.includes(role));

    const hasCorrectCount = roleValues.length === expectedRoles.length;

    return {
      pass: hasAllRoles && hasCorrectCount,
      message: () => {
        if (!hasCorrectCount) {
          return `Expected ${expectedRoles.length} roles, but found ${roleValues.length}`;
        }
        const missing = expectedRoles.filter((r) => !roleValues.includes(r));
        return `Expected roles ${missing.join(', ')} not found. Got: ${roleValues.join(', ')}`;
      },
      actual: roles,
      expected: expectedRoles,
    };
  },

  /**
   * Check that responses are not simulated (delegated instead)
   */
  toNotSimulateResponses(messages: any[]) {
    const assistantMessages = messages.filter(
      (msg: any) => msg.type === 'assistant' && msg.data?.content
    );

    const simulatedPatterns = [
      /alice says.*:/i,
      /bob says.*:/i,
      /charlie says.*:/i,
      /"[^"]*"\s*[-–—]\s*(alice|bob|charlie)/i,
    ];

    const simulated = assistantMessages.filter((msg: any) =>
      simulatedPatterns.some((pattern) => pattern.test(msg.data?.content || ''))
    );

    return {
      pass: simulated.length === 0,
      message: () =>
        simulated.length === 0
          ? 'Expected to find simulated responses'
          : `Expected no simulated responses, but found ${simulated.length} simulated messages`,
      actual: simulated.length,
      expected: 0,
    };
  },

  /**
   * Check minimum agent interactions
   */
  toHaveAgentInteractions(messages: any[], minInteractions: number) {
    const agentCalls = GameEventParser.extractAgentCalls(messages);

    return {
      pass: agentCalls.length >= minInteractions,
      message: () =>
        `Expected at least ${minInteractions} agent interactions, but found ${agentCalls.length}: ${agentCalls.join(', ')}`,
      actual: agentCalls.length,
      expected: minInteractions,
    };
  },
});
