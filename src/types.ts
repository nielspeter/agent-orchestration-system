/**
 * Core type definitions for the agent orchestration system
 */

export interface AgentDefinition {
  name: string;
  description: string;
  tools: string[] | '*';
  model?: string;
  behavior?: string; // Preset name like 'precise', 'creative'
  temperature?: number; // Override preset
  top_p?: number; // Override preset
}

export interface ToolParameter {
  type: string;
  description: string;
  items?: ToolParameter;
  enum?: string[];
  properties?: Record<string, ToolParameter>;
  required?: string[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  format?: string;
}

export interface ToolSchema {
  type: 'object';
  properties: Record<string, ToolParameter>;
  required?: string[];
}

// Base tool interface - backward compatible
export interface BaseTool {
  name: string;
  description: string;
  parameters: ToolSchema;
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
  isConcurrencySafe: () => boolean;
}

// Generic tool interface for typed implementations
export interface Tool<T = Record<string, unknown>> extends Omit<BaseTool, 'execute'> {
  execute: (args: T) => Promise<ToolResult>;
}

export interface ToolResult {
  content: unknown;
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
