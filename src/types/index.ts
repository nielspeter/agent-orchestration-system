/**
 * Shared types module
 *
 * This module contains primitive types and utilities used across the application.
 * Domain-specific types should remain in their respective modules.
 */

// Re-export common types
export * from './common';

// Re-export base types (tools, agents, etc.)
export {
  BaseTool,
  Tool,
  ToolResult,
  ToolOutput,
  ToolCall,
  ToolSchema,
  ToolParameter,
  Message,
  ExecutionContext,
} from '../base-types';
