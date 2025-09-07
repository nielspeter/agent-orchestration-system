import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool, ToolResult } from '../types';

// Type definitions for tool arguments
interface ReadArgs {
  path: string;
  [key: string]: unknown; // Index signature for Record<string, unknown> constraint
}

interface WriteArgs {
  path: string;
  content: string;
  [key: string]: unknown; // Index signature for Record<string, unknown> constraint
}

interface ListArgs {
  path: string;
  [key: string]: unknown; // Index signature for Record<string, unknown> constraint
}

// Type guard helper
function validateArgs<T extends Record<string, unknown>>(
  args: unknown,
  requiredFields: (keyof T)[]
): args is T {
  if (!args || typeof args !== 'object') return false;
  return requiredFields.every((field) => field in args);
}

/**
 * Creates a Read tool for file system access
 *
 * Allows agents to read file contents. This is a safe tool that
 * can be executed in parallel with other read operations.
 *
 * @returns BaseTool configured for file reading
 *
 * @example
 * Agent usage: Read path="src/index.ts"
 */
export const createReadTool = (): BaseTool => ({
  name: 'Read',
  description: 'Read the contents of a file',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to read',
      },
    },
    required: ['path'],
  },
  execute: async (args): Promise<ToolResult> => {
    try {
      if (!validateArgs<ReadArgs>(args, ['path'])) {
        return {
          content: null,
          error: 'Invalid arguments: path is required',
        };
      }
      const content = await fs.readFile(args.path, 'utf-8');
      return { content };
    } catch (error) {
      return {
        content: null,
        error: `Failed to read file: ${error}`,
      };
    }
  },
  isConcurrencySafe: () => true, // Read operations are safe to run in parallel
});

/**
 * Creates a Write tool for file system modification
 *
 * Allows agents to create or overwrite files. This tool provides
 * meaningful feedback about what was written to help agents understand
 * task completion. Must be executed sequentially for safety.
 *
 * @returns BaseTool configured for file writing
 *
 * @example
 * Agent usage: Write path="output.txt" content="Hello, World!"
 * Returns: "Successfully saved to output.txt (13 chars, 1 lines)"
 */
export const createWriteTool = (): BaseTool => ({
  name: 'Write',
  description: 'Write content to a file',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to write',
      },
      content: {
        type: 'string',
        description: 'Content to write to the file',
      },
    },
    required: ['path', 'content'],
  },
  execute: async (args): Promise<ToolResult> => {
    try {
      if (!validateArgs<WriteArgs>(args, ['path', 'content'])) {
        return {
          content: null,
          error: 'Invalid arguments: path and content are required',
        };
      }
      await fs.mkdir(path.dirname(args.path), { recursive: true });
      await fs.writeFile(args.path, args.content, 'utf-8');

      // Provide meaningful context about what was written
      const contentLength = args.content.length;
      const lineCount = args.content.split('\n').length;
      const preview = args.content.substring(0, 100).replace(/\n/g, ' ');

      return {
        content: `Successfully saved to ${args.path} (${contentLength} chars, ${lineCount} lines). Content: "${preview}${contentLength > 100 ? '...' : ''}"`,
      };
    } catch (error) {
      return {
        content: null,
        error: `Failed to write file: ${error}`,
      };
    }
  },
  isConcurrencySafe: () => false, // Write operations should be sequential
});

/**
 * Creates a List tool for directory exploration
 *
 * Allows agents to discover files and subdirectories. Safe to run
 * in parallel with other read operations. Essential for agents to
 * explore project structure in pull architecture.
 *
 * @returns BaseTool configured for directory listing
 *
 * @example
 * Agent usage: List path="src"
 * Returns: List of files and directories in src/
 */
export const createListTool = (): BaseTool => ({
  name: 'List',
  description: 'List files and directories in a given path',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the directory to list',
      },
    },
    required: ['path'],
  },
  execute: async (args): Promise<ToolResult> => {
    try {
      if (!validateArgs<ListArgs>(args, ['path'])) {
        return {
          content: null,
          error: 'Invalid arguments: path is required',
        };
      }
      const files = await fs.readdir(args.path);
      return { content: files };
    } catch (error) {
      return {
        content: null,
        error: `Failed to list directory: ${error}`,
      };
    }
  },
  isConcurrencySafe: () => true, // List operations are safe to run in parallel
});
