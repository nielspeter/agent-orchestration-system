import { exec } from 'child_process';
import { promisify } from 'util';
import { BaseTool, ToolResult } from '@/base-types';

const execAsync = promisify(exec);

/**
 * Shell execution tool - enables running shell commands
 *
 * This tool provides basic shell command execution with:
 * - Timeout support
 * - Cross-platform compatibility
 * - JSON output parsing
 * - Error handling
 */
export function createShellTool(): BaseTool {
  return {
    name: 'shell',
    description: 'Execute shell commands and scripts',
    parameters: {
      type: 'object' as const,
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 30000)',
        },
        cwd: {
          type: 'string',
          description: 'Working directory for command execution',
        },
        parseJson: {
          type: 'boolean',
          description: 'Attempt to parse stdout as JSON (default: false)',
        },
      },
      required: ['command'],
    },

    execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
      const command = args.command as string;
      const timeout = (args.timeout as number) || 30000;
      const cwd = args.cwd as string | undefined;
      const parseJson = (args.parseJson as boolean) || false;

      try {
        // Execute the command with timeout
        const { stdout, stderr } = await execAsync(command, {
          timeout,
          cwd: cwd || process.cwd(),
          encoding: 'utf8',
          maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        });

        // Try to parse as JSON if requested
        if (parseJson && stdout.trim()) {
          try {
            const parsed = JSON.parse(stdout.trim());
            return {
              content: parsed,
              // Include stderr in error field if present
              error: stderr ? `stderr: ${stderr}` : undefined,
            };
          } catch {
            // If JSON parsing fails, return raw output
          }
        }

        // Return raw output
        return {
          content: stdout.trim(),
          // Include stderr in error field if present
          error: stderr ? `stderr: ${stderr}` : undefined,
        };
      } catch (error) {
        // Handle execution errors with proper typing
        const execError = error as NodeJS.ErrnoException & {
          killed?: boolean;
          signal?: string;
          stdout?: string;
          stderr?: string;
          code?: number;
        };

        const errorMessage = execError.message || 'Command execution failed';
        const killed = execError.killed || false;
        const code = execError.code ?? 1;

        // Extract stdout/stderr from error if available
        const stdout = execError.stdout || '';
        const stderr = execError.stderr || '';

        // Check if it was a timeout
        if (killed && execError.signal === 'SIGTERM') {
          return {
            content: stdout || '',
            error: `Command timed out after ${timeout}ms. Exit code: ${code}${stderr ? `, stderr: ${stderr}` : ''}`,
          };
        }

        return {
          content: stdout || '',
          error: `${errorMessage}. Exit code: ${code}${stderr ? `, stderr: ${stderr}` : ''}`,
        };
      }
    },

    isConcurrencySafe: () => true, // Shell commands can run in parallel
  };
}
