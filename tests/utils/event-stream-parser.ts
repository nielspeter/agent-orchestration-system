/**
 * Generic event stream parser for agent-based systems.
 * Extracts structured data from JSONL event streams.
 */
export class EventStreamParser {
  /**
   * Extract data from tool results by tool name
   */
  static extractToolResults(messages: any[], toolName: string): any[] {
    const results: any[] = [];

    for (const msg of messages) {
      if (msg.type === 'tool_result' && msg.data?.tool === toolName && msg.data?.result) {
        try {
          const result =
            typeof msg.data.result === 'string' ? JSON.parse(msg.data.result) : msg.data.result;
          results.push(result);
        } catch {
          results.push(msg.data.result);
        }
      }
    }

    return results;
  }

  /**
   * Extract content matching patterns from assistant messages
   */
  static extractContentByPattern(messages: any[], patterns: RegExp[]): string[] {
    const matches: string[] = [];

    for (const msg of messages) {
      if (msg.type === 'assistant' && msg.data?.content) {
        const content = msg.data.content;

        for (const pattern of patterns) {
          const match = content.match(pattern);
          if (match) {
            matches.push(match[0]);
          }
        }
      }
    }

    return matches;
  }

  /**
   * Extract structured data from content using regex patterns
   */
  static extractDataByPattern(messages: any[], pattern: RegExp): any[] {
    const results: any[] = [];

    for (const msg of messages) {
      const content = msg.data?.content || msg.content || '';
      const match = content.match(pattern);
      if (match) {
        results.push({
          message: msg,
          match: match[0],
          groups: match.slice(1),
        });
      }
    }

    return results;
  }

  /**
   * Find delegations between agents
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
   * Check if content contains any of the specified keywords
   */
  static hasKeywords(messages: any[], keywords: string[]): boolean {
    const keywordRegex = new RegExp(keywords.join('|'), 'i');

    return messages.some((msg) => {
      const content = msg.data?.content || msg.content || '';
      return keywordRegex.test(content);
    });
  }

  /**
   * Extract tool calls by tool name
   */
  static extractToolCalls(messages: any[], toolName?: string): any[] {
    const calls: any[] = [];

    for (const msg of messages) {
      if (msg.type === 'tool_call' && msg.data) {
        if (!toolName || msg.data.tool === toolName) {
          calls.push(msg.data);
        }
      }
    }

    return calls;
  }

  /**
   * Get execution timeline with durations
   */
  static getExecutionTimeline(
    messages: any[]
  ): Array<{ agent: string; duration: number; depth: number }> {
    const timeline: Array<{ agent: string; duration: number; depth: number }> = [];

    for (const msg of messages) {
      if (msg.type === 'agent_complete' && msg.data) {
        timeline.push({
          agent: msg.data.agent,
          duration: msg.data.duration || 0,
          depth: msg.data.depth || 0,
        });
      }
    }

    return timeline;
  }

  /**
   * Parse complete execution state from messages
   */
  static parseExecution(messages: any[]) {
    return {
      agentsCalled: this.extractAgentCalls(messages),
      delegations: this.extractDelegations(messages),
      toolCalls: this.extractToolCalls(messages),
      messageCounts: this.countByType(messages),
      timeline: this.getExecutionTimeline(messages),
      totalMessages: messages.length,
    };
  }
}
