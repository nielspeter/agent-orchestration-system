/**
 * Core type definitions for the agent orchestration system
 */

export interface AgentDefinition {
  name: string;
  description: string;
  tools: string[] | '*';
  model?: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  execute: (args: any) => Promise<ToolResult>;
  isConcurrencySafe: () => boolean;
}

export interface ToolResult {
  content: any;
  error?: string;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ExecutionContext {
  depth: number;
  parentAgent?: string;
  startTime: number;
  maxDepth: number;
  isSidechain?: boolean;
  parentMessages?: Message[];
}
