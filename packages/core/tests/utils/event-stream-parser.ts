import type {
  DelegateToolParams,
  EventMessage,
  ParsedDelegation,
  ParsedExecution,
  ToolCallMessage,
} from '../types/event-types';

/**
 * Generic event stream parser for agent-based systems.
 * Extracts structured data from JSONL event streams.
 */
export class EventStreamParser {
  /**
   * Find delegations between agents
   */
  static extractDelegations(messages: EventMessage[]): ParsedDelegation[] {
    const delegations: ParsedDelegation[] = [];

    for (const msg of messages) {
      if (msg.type === 'delegation' && 'data' in msg) {
        const delegationMsg = msg;
        if (delegationMsg.data) {
          delegations.push({
            from: delegationMsg.data.parent,
            to: delegationMsg.data.child,
            task: delegationMsg.data.task,
          });
        }
      } else if (msg.type === 'tool_call' && 'data' in msg) {
        const toolCallMsg = msg;
        if (toolCallMsg.data?.tool === 'Delegate') {
          const params = toolCallMsg.data.params as DelegateToolParams | undefined;
          delegations.push({
            from: toolCallMsg.data.agent || 'unknown',
            to: params?.agent || 'unknown',
            task: params?.prompt || '',
          });
        }
      }
    }

    return delegations;
  }

  /**
   * Extract all agent interactions
   */
  static extractAgentCalls(messages: EventMessage[]): string[] {
    const agents = new Set<string>();

    for (const msg of messages) {
      if (msg.type === 'agent_start' && 'data' in msg) {
        const agentStartMsg = msg;
        if (agentStartMsg.data?.agent) {
          agents.add(agentStartMsg.data.agent);
        }
      }
    }

    return Array.from(agents);
  }

  /**
   * Count messages by type
   */
  static countByType(messages: EventMessage[]): Record<string, number> {
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
  static hasKeywords(messages: EventMessage[], keywords: string[]): boolean {
    const keywordRegex = new RegExp(keywords.join('|'), 'i');

    return messages.some((msg) => {
      let content = '';
      if ('data' in msg && msg.data && typeof msg.data === 'object' && 'content' in msg.data) {
        const dataWithContent = msg.data as { content?: string };
        content = dataWithContent.content || '';
      } else if ('content' in msg) {
        const msgWithContent = msg as unknown as { content?: string };
        content = msgWithContent.content || '';
      }
      return keywordRegex.test(content);
    });
  }

  /**
   * Extract tool calls by tool name
   */
  static extractToolCalls(
    messages: EventMessage[],
    toolName?: string
  ): (ToolCallMessage['data'] | undefined)[] {
    const calls: any[] = [];

    for (const msg of messages) {
      if (msg.type === 'tool_call' && 'data' in msg) {
        const toolCallMsg = msg;
        if (toolCallMsg.data && (!toolName || toolCallMsg.data.tool === toolName)) {
          calls.push(toolCallMsg.data);
        }
      }
    }

    return calls;
  }

  /**
   * Get execution timeline with durations
   */
  static getExecutionTimeline(
    messages: EventMessage[]
  ): Array<{ agent: string; duration: number; depth: number }> {
    const timeline: Array<{ agent: string; duration: number; depth: number }> = [];

    for (const msg of messages) {
      if (msg.type === 'agent_complete' && 'data' in msg) {
        const completeMsg = msg;
        if (completeMsg.data) {
          timeline.push({
            agent: completeMsg.data.agent,
            duration: completeMsg.data.duration || 0,
            depth: completeMsg.data.depth || 0,
          });
        }
      }
    }

    return timeline;
  }

  /**
   * Parse complete execution state from messages
   */
  static parseExecution(messages: EventMessage[]): ParsedExecution {
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
