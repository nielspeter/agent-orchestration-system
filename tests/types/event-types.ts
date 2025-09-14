/**
 * Type definitions for event stream messages used in testing
 */

export interface BaseEventMessage {
  type: string;
  timestamp?: number;
}

export interface AssistantMessage extends BaseEventMessage {
  type: 'assistant';
  data?: {
    content?: string;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: {
        name: string;
        arguments: string;
      };
    }>;
  };
}

// Specific tool parameter types
export interface TaskToolParams {
  subagent_type: string;
  prompt: string;
  [key: string]: unknown;
}

export interface ToolCallMessage extends BaseEventMessage {
  type: 'tool_call';
  data?: {
    tool: string;
    agent?: string;
    params?: Record<string, unknown> | TaskToolParams;
    tool_call_id?: string;
  };
}

export interface ToolResultMessage extends BaseEventMessage {
  type: 'tool_result';
  data?: {
    tool: string;
    result: string | Record<string, unknown>;
    error?: boolean;
  };
}

export interface DelegationMessage extends BaseEventMessage {
  type: 'delegation';
  data?: {
    parent: string;
    child: string;
    task: string;
  };
}

export interface AgentStartMessage extends BaseEventMessage {
  type: 'agent_start';
  data?: {
    agent: string;
    prompt?: string;
    depth?: number;
  };
}

export interface AgentCompleteMessage extends BaseEventMessage {
  type: 'agent_complete';
  data?: {
    agent: string;
    duration?: number;
    depth?: number;
    result?: string;
  };
}

export type EventMessage =
  | AssistantMessage
  | ToolCallMessage
  | ToolResultMessage
  | DelegationMessage
  | AgentStartMessage
  | AgentCompleteMessage
  | BaseEventMessage; // Fallback for unknown types

export interface ParsedDelegation {
  from: string;
  to: string;
  task: string;
}

export interface ParsedExecution {
  agentsCalled: string[];
  delegations: ParsedDelegation[];
  toolCalls: ToolCallMessage['data'][];
  messageCounts: Record<string, number>;
  timeline: Array<{
    agent: string;
    duration: number;
    depth: number;
  }>;
  totalMessages: number;
}
