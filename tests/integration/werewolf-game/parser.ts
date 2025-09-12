/**
 * Generic event parser for agent-based games.
 * Extracts structured data from JSONL event streams.
 */
export class GameEventParser {
  /**
   * Extract role assignments from various message formats
   */
  static extractRoles(messages: any[]): Record<string, string> {
    let roles: Record<string, string> = {};

    for (const msg of messages) {
      // Handle tool results (e.g., random_roles)
      if (msg.type === 'tool_result' && msg.data?.tool === 'random_roles' && msg.data?.result) {
        try {
          const result = JSON.parse(msg.data.result);
          if (result.assignments) {
            return result.assignments;
          }
        } catch {}
      }

      // Handle assistant messages with role assignments
      if (msg.type === 'assistant' && msg.data?.content) {
        const content = msg.data.content;

        // Try various patterns for role assignments
        const patterns = [
          /{alice:\s*"(\w+)",\s*bob:\s*"(\w+)",\s*charlie:\s*"(\w+)"}/i,
          /{alice:\s*\\"(\w+)\\",\s*bob:\s*\\"(\w+)\\",\s*charlie:\s*\\"(\w+)\\"}/i,
        ];

        for (const pattern of patterns) {
          const match = content.match(pattern);
          if (match) {
            return {
              alice: match[1],
              bob: match[2],
              charlie: match[3],
            };
          }
        }
      }
    }

    return roles;
  }

  /**
   * Find delegations to other agents
   */
  static extractDelegations(messages: any[]): Array<{ from: string; to: string; task: string }> {
    const delegations: Array<{ from: string; to: string; task: string }> = [];

    for (const msg of messages) {
      if (msg.type === 'delegation' && msg.data) {
        delegations.push({
          from: msg.data.parent,
          to: msg.data.child,
          task: msg.data.task,
        });
      } else if (msg.type === 'tool_call' && msg.data?.tool === 'Task') {
        delegations.push({
          from: msg.data.agent || 'unknown',
          to: msg.data.params?.subagent_type || 'unknown',
          task: msg.data.params?.prompt || '',
        });
      }
    }

    return delegations;
  }

  /**
   * Check if game reached completion
   */
  static hasVictory(messages: any[]): boolean {
    return messages.some((msg) => {
      const content = msg.data?.content || '';
      return /victory|wins|game.*over|completed/i.test(content);
    });
  }

  /**
   * Extract winner from game messages
   */
  static extractWinner(messages: any[]): string | null {
    for (const msg of messages) {
      if (msg.type === 'assistant' && msg.data?.content) {
        const content = msg.data.content;

        // Look for victory patterns
        const patterns = [
          /(\w+).*wins/i,
          /(\w+).*victory/i,
          /winner.*(\w+)/i,
          /(\w+).*\(winner\)/i,
        ];

        for (const pattern of patterns) {
          const match = content.match(pattern);
          if (match) {
            return match[1].toLowerCase();
          }
        }
      }
    }

    return null;
  }

  /**
   * Count messages by type
   */
  static countByType(messages: any[]): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const msg of messages) {
      const type = msg.type || 'unknown';
      counts[type] = (counts[type] || 0) + 1;
    }

    return counts;
  }

  /**
   * Extract all agent interactions
   */
  static extractAgentCalls(messages: any[]): string[] {
    const agents = new Set<string>();

    for (const msg of messages) {
      if (msg.type === 'agent_start' && msg.data?.agent) {
        agents.add(msg.data.agent);
      }
    }

    return Array.from(agents);
  }

  /**
   * Parse complete game state from messages
   */
  static parseGame(messages: any[]) {
    return {
      roles: this.extractRoles(messages),
      delegations: this.extractDelegations(messages),
      hasVictory: this.hasVictory(messages),
      winner: this.extractWinner(messages),
      agentsCalled: this.extractAgentCalls(messages),
      messageCounts: this.countByType(messages),
      totalMessages: messages.length,
    };
  }
}
