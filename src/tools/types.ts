// Re-export the canonical tool types from main types file
export type { BaseTool as Tool, ToolSchema, ToolResult, ToolOutput } from '../base-types';

// Tool-specific type aliases for clarity
export type ToolInput = Record<string, unknown>;
