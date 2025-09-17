/**
 * Parser for extracting structured data from claim processing event streams.
 * Focuses on workflow events, delegations, tool calls, and audit trail.
 */

export interface Delegation {
  from: string;
  to: string;
  task: string;
}

export interface ToolCall {
  agent: string;
  tool: string;
  params: any;
}

export interface AuditEntry {
  sequence: number;
  timestamp: string;
  agent: string;
  action: string;
  target?: string;
  decisionPoint?: string;
  tool?: string;
  input?: any;
  output?: any;
  reasoning?: string;
}

export interface ClaimDetails {
  claimId: string;
  processId: string;
  claimantName: string;
  policyNumber: string;
  condition: string;
  decision: string;
  finalOutcome: string;
}

export interface SimulatedResponse {
  agent: string;
  content: string;
  isSimulated: boolean;
}

export class ClaimEventParser {
  /**
   * Extract workflow path from messages
   */
  static extractWorkflowPath(messages: any[]): string[] {
    for (const msg of messages) {
      // Look for Write tool call with results
      if (msg.type === 'tool_call' && msg.data?.tool === 'write') {
        const content = msg.data.params?.content;
        if (content) {
          try {
            const parsed = typeof content === 'string' ? JSON.parse(content) : content;
            if (parsed.workflowPath) {
              return parsed.workflowPath;
            }
          } catch {
            // Continue searching
          }
        }
      }

      // Look in assistant messages for workflow updates
      if (msg.type === 'assistant' && msg.data?.content) {
        const content = msg.data.content;
        const workflowMatch = /"workflowPath":\s*\[(.*?)\]/s.exec(content);
        if (workflowMatch) {
          try {
            return JSON.parse(`[${workflowMatch[1]}]`);
          } catch {
            // Continue searching
          }
        }
      }
    }
    return [];
  }

  /**
   * Extract final outcome from messages
   */
  static extractFinalOutcome(messages: any[]): string | null {
    for (const msg of messages) {
      // Look for Write tool call with results
      if (msg.type === 'tool_call' && msg.data?.tool === 'write') {
        const content = msg.data.params?.content;
        if (content) {
          try {
            const parsed = typeof content === 'string' ? JSON.parse(content) : content;
            if (parsed.finalOutcome) {
              return parsed.finalOutcome;
            }
          } catch {
            // Continue searching
          }
        }
      }
    }
    return null;
  }

  /**
   * Extract claim details from messages
   */
  static extractClaimDetails(messages: any[]): ClaimDetails | null {
    for (const msg of messages) {
      // Look for Write tool call with complete results
      if (msg.type === 'tool_call' && msg.data?.tool === 'write') {
        const content = msg.data.params?.content;
        if (content) {
          try {
            const parsed = typeof content === 'string' ? JSON.parse(content) : content;
            if (parsed.details && parsed.processId) {
              return {
                claimId: parsed.details.claimId,
                processId: parsed.processId,
                claimantName: parsed.details.claimantName,
                policyNumber: parsed.details.policyNumber,
                condition: parsed.details.illness || parsed.details.condition,
                decision: parsed.details.decision,
                finalOutcome: parsed.finalOutcome,
              };
            }
          } catch {
            // Continue searching
          }
        }
      }
    }
    return null;
  }

  /**
   * Extract real delegations (via Task tool)
   */
  static extractRealDelegations(messages: any[]): Delegation[] {
    const delegations: Delegation[] = [];

    for (const msg of messages) {
      // Check for Task tool calls (real delegation)
      if (msg.type === 'tool_call' && msg.data?.tool === 'task') {
        delegations.push({
          from: msg.data.agent || 'claim-orchestrator',
          to: msg.data.params?.subagent_type || 'unknown',
          task: msg.data.params?.description || msg.data.params?.prompt?.substring(0, 100) || '',
        });
      }

      // Also check delegation events
      if (msg.type === 'delegation' && msg.data) {
        delegations.push({
          from: msg.data.parent,
          to: msg.data.child,
          task: msg.data.task,
        });
      }
    }

    return delegations;
  }

  /**
   * Detect simulated responses (agent pretending to be another agent)
   */
  static detectSimulatedResponses(messages: any[]): SimulatedResponse[] {
    const simulated: SimulatedResponse[] = [];

    const simulationPatterns = [
      /(?:The |the )?(\w+[-\w]*)\s+agent\s+(?:responds?|says?|returns?):/i,
      /(?:Based on|After reviewing).*?(?:the )?(\w+[-\w]*)\s+(?:would|will|should)\s+(?:respond|return|say)/i,
      /(?:The )?(\w+[-\w]*)\s+(?:agent's|agent)\s+response:/i,
      /Simulating\s+(\w+[-\w]*)\s+agent/i,
      /Acting as\s+(?:the )?(\w+[-\w]*)/i,
    ];

    for (const msg of messages) {
      if (msg.type === 'assistant' && msg.data?.content) {
        const content = msg.data.content;

        for (const pattern of simulationPatterns) {
          const match = content.match(pattern);
          if (match) {
            simulated.push({
              agent: msg.data.agent || 'unknown',
              content: content.substring(0, 200),
              isSimulated: true,
            });
            break;
          }
        }
      }
    }

    return simulated;
  }

  /**
   * Extract all tool calls
   */
  static extractToolCalls(messages: any[]): ToolCall[] {
    const toolCalls: ToolCall[] = [];

    for (const msg of messages) {
      if (msg.type === 'tool_call' && msg.data) {
        toolCalls.push({
          agent: msg.data.agent || 'unknown',
          tool: msg.data.tool,
          params: msg.data.params || {},
        });
      }
    }

    return toolCalls;
  }

  /**
   * Extract agents that were actually called
   */
  static extractAgentCalls(messages: any[]): string[] {
    const agents = new Set<string>();

    for (const msg of messages) {
      // Check agent_start events
      if (msg.type === 'agent_start' && msg.data?.agent) {
        agents.add(msg.data.agent);
      }

      // Check delegation targets
      if (msg.type === 'delegation' && msg.data?.child) {
        agents.add(msg.data.child);
      }
    }

    return Array.from(agents);
  }

  /**
   * Extract the Write tool call to verify filename
   */
  static extractWriteToolCall(messages: any[]): { file_path: string; content: any } | null {
    for (const msg of messages) {
      if (msg.type === 'tool_call' && msg.data?.tool === 'write') {
        return {
          // Support both 'file_path' and 'path' for compatibility
          file_path: msg.data.params?.file_path || msg.data.params?.path || '',
          content: msg.data.params?.content || {},
        };
      }
    }
    return null;
  }

  /**
   * Extract claim ID from various message types
   */
  static extractClaimId(messages: any[]): string | null {
    // First check tool results for claim_id_generator
    for (const msg of messages) {
      if (msg.type === 'tool_result' && msg.data?.tool === 'claim_id_generator') {
        const content = msg.data.result?.content;
        if (content?.claimId) {
          return content.claimId;
        }
      }
    }

    // Then check claim details from Write tool
    const details = this.extractClaimDetails(messages);
    if (details?.claimId) {
      return details.claimId;
    }

    // Finally check assistant messages
    for (const msg of messages) {
      if (msg.type === 'assistant' && msg.data?.content) {
        const match = msg.data.content.match(/CI-\d{8}-[A-F0-9]{5}/);
        if (match) {
          return match[0];
        }
      }
    }

    return null;
  }

  /**
   * Extract audit trail from messages
   */
  static extractAuditTrail(messages: any[]): AuditEntry[] {
    for (const msg of messages) {
      // Look for Write tool call with audit trail
      if (msg.type === 'tool_call' && msg.data?.tool === 'write') {
        const content = msg.data.params?.content;
        if (content) {
          try {
            const parsed = typeof content === 'string' ? JSON.parse(content) : content;
            if (parsed.auditTrail && Array.isArray(parsed.auditTrail)) {
              return parsed.auditTrail;
            }
          } catch {
            // Continue searching
          }
        }
      }
    }
    return [];
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
   * Verify payment formatting (should be "54,421,000 USD" not "$54,421,000")
   */
  static verifyPaymentFormatting(messages: any[]): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    const details = this.extractClaimDetails(messages);

    if (details) {
      // Check for currency symbols in notes
      for (const msg of messages) {
        if (msg.type === 'assistant' && msg.data?.content) {
          const content = msg.data.content;
          // Look for currency symbols
          if (/\$[\d,]+/.test(content)) {
            issues.push('Found $ symbol in payment amount');
          }
          if (/€[\d,]+/.test(content)) {
            issues.push('Found € symbol in payment amount');
          }
          if (/£[\d,]+/.test(content)) {
            issues.push('Found £ symbol in payment amount');
          }
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Parse complete claim processing
   */
  static parseClaim(messages: any[]) {
    return {
      workflowPath: this.extractWorkflowPath(messages),
      finalOutcome: this.extractFinalOutcome(messages),
      claimDetails: this.extractClaimDetails(messages),
      realDelegations: this.extractRealDelegations(messages),
      simulatedResponses: this.detectSimulatedResponses(messages),
      toolCalls: this.extractToolCalls(messages),
      agentsCalled: this.extractAgentCalls(messages),
      writeCall: this.extractWriteToolCall(messages),
      claimId: this.extractClaimId(messages),
      auditTrail: this.extractAuditTrail(messages),
      messageCounts: this.countByType(messages),
      paymentFormatting: this.verifyPaymentFormatting(messages),
      totalMessages: messages.length,
    };
  }
}
