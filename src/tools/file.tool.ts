import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool, ToolResult } from '@/base-types';

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

// Security: POC-level path validation (block only truly sensitive files)
const BLOCKED_PATH_PATTERNS = [
  /\.ssh\/id_[rd]sa/, // Private SSH keys
  /\.aws\/credentials/, // AWS credentials
  /\.env$/, // Root .env files (allow .env.example, .env.test)
  /\/etc\/shadow/, // Password hashes
  /\.gnupg\//, // GPG keys
  /\.docker\/config\.json/, // Docker credentials
  /\.kube\/config/, // Kubernetes credentials
];

// File size limits to prevent memory exhaustion
const FILE_LIMITS = {
  maxFileReadSize: 50 * 1024 * 1024, // 50MB (generous for source code)
  maxReadLines: 10000, // 10K lines (most source files)
  maxLineLength: 5000, // 5K chars per line
  maxFileWriteSize: 10 * 1024 * 1024, // 10MB writes
};

/**
 * Validates file path against security patterns
 */
function validatePath(filePath: string): void {
  const resolved = path.resolve(filePath);

  // Check blocked patterns
  if (BLOCKED_PATH_PATTERNS.some((pattern) => pattern.test(resolved))) {
    throw new Error(`Security: Access denied to sensitive file: ${filePath}`);
  }

  // Warn on potentially sensitive paths
  const sensitivePaths = [/^\/etc/, /~\//, /\.git\//, /node_modules/];
  if (sensitivePaths.some((pattern) => pattern.test(resolved))) {
    console.warn(`⚠️ Accessing potentially sensitive path: ${filePath}`);
  }
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

      // Security check
      validatePath(args.path);

      // Check file size before reading
      const stats = await fs.stat(args.path);
      if (stats.size > FILE_LIMITS.maxFileReadSize) {
        return {
          content: null,
          error: `File too large: ${(stats.size / 1024 / 1024).toFixed(1)}MB (max: ${FILE_LIMITS.maxFileReadSize / 1024 / 1024}MB)`,
        };
      }

      // Read file
      const content = await fs.readFile(args.path, 'utf-8');
      const lines = content.split('\n');

      // Check line count and truncate if needed
      if (lines.length > FILE_LIMITS.maxReadLines) {
        const truncated = lines.slice(0, FILE_LIMITS.maxReadLines);
        truncated.push(
          `\n... [File truncated - ${lines.length - FILE_LIMITS.maxReadLines} more lines]`
        );
        return {
          content: truncated.join('\n'),
        };
      }

      // Truncate very long lines
      const processedLines = lines.map((line) =>
        line.length > FILE_LIMITS.maxLineLength
          ? line.slice(0, FILE_LIMITS.maxLineLength) + '... [line truncated]'
          : line
      );

      return { content: processedLines.join('\n') };
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

      // Security check
      validatePath(args.path);

      // Check content size
      if (args.content.length > FILE_LIMITS.maxFileWriteSize) {
        return {
          content: null,
          error: `Content too large to write: ${(args.content.length / 1024 / 1024).toFixed(1)}MB (max: ${FILE_LIMITS.maxFileWriteSize / 1024 / 1024}MB)`,
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

      // Security check (listing directories can also be sensitive)
      validatePath(args.path);

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
