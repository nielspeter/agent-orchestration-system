import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool, ToolResult } from '../types';

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
      const content = await fs.readFile((args as any).path, 'utf-8');
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
      const typedArgs = args as any;
      await fs.mkdir(path.dirname(typedArgs.path), { recursive: true });
      await fs.writeFile(typedArgs.path, typedArgs.content, 'utf-8');
      
      // Provide meaningful context about what was written
      const contentLength = typedArgs.content.length;
      const lineCount = typedArgs.content.split('\n').length;
      const preview = typedArgs.content.substring(0, 100).replace(/\n/g, ' ');
      
      return { 
        content: `Successfully saved to ${typedArgs.path} (${contentLength} chars, ${lineCount} lines). Content: "${preview}${contentLength > 100 ? '...' : ''}"` 
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
      const files = await fs.readdir((args as any).path);
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
