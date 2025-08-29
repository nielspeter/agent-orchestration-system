import * as fs from 'fs/promises';
import * as path from 'path';
import { Tool, ToolResult } from '../types';

export const createReadTool = (): Tool => ({
  name: 'read',
  description: 'Read the contents of a file',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to read'
      }
    },
    required: ['path']
  },
  execute: async (args: { path: string }): Promise<ToolResult> => {
    try {
      const content = await fs.readFile(args.path, 'utf-8');
      return { content };
    } catch (error) {
      return { 
        content: null, 
        error: `Failed to read file: ${error}` 
      };
    }
  },
  isConcurrencySafe: () => true  // Read operations are safe to run in parallel
});

export const createWriteTool = (): Tool => ({
  name: 'write',
  description: 'Write content to a file',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to write'
      },
      content: {
        type: 'string',
        description: 'Content to write to the file'
      }
    },
    required: ['path', 'content']
  },
  execute: async (args: { path: string; content: string }): Promise<ToolResult> => {
    try {
      await fs.mkdir(path.dirname(args.path), { recursive: true });
      await fs.writeFile(args.path, args.content, 'utf-8');
      return { content: `File written successfully to ${args.path}` };
    } catch (error) {
      return { 
        content: null, 
        error: `Failed to write file: ${error}` 
      };
    }
  },
  isConcurrencySafe: () => false  // Write operations must be sequential
});

export const createListTool = (): Tool => ({
  name: 'list',
  description: 'List files in a directory',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the directory'
      }
    },
    required: ['path']
  },
  execute: async (args: { path: string }): Promise<ToolResult> => {
    try {
      const files = await fs.readdir(args.path);
      return { content: files };
    } catch (error) {
      return { 
        content: null, 
        error: `Failed to list directory: ${error}` 
      };
    }
  },
  isConcurrencySafe: () => true  // Listing is a read-only operation
});