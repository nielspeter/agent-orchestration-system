/**
 * Core type definitions for the agent orchestration system
 */

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
  category?: string;
  metadata?: {
    tags?: string[];
    [key: string]: unknown;
  };
}

// Generic tool interface for typed implementations
export interface Tool<T = Record<string, unknown>> extends Omit<BaseTool, 'execute'> {
  execute: (args: T) => Promise<ToolResult>;
}

export interface ToolResult {
  content: unknown;
  error?: string;
}

// Alternative output format used by tool executor
export interface ToolOutput {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  // Raw content blocks from provider (preserved for thinking blocks, etc.)
  raw_content?: unknown;
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
  traceId?: string;
  parentCallId?: string;
  // Thinking metrics that flow through delegations
  thinkingMetrics?: {
    totalTokensUsed: number;
    totalCost: number;
    contextUsagePercent: number;
  };
}
