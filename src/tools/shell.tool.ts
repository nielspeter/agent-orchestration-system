import { exec } from 'child_process';
import { promisify } from 'util';
import { BaseTool, ToolResult } from '@/base-types';

const execAsync = promisify(exec);

// Security: POC-level command validation (block only catastrophic commands)
const CATASTROPHIC_PATTERNS = [
  /rm\s+(-rf|-fr)\s+\/(?:\s|$)/, // rm -rf /
  /rm\s+.*--no-preserve-root/, // Force root deletion
  /mkfs/, // Format filesystem
  /dd\s+.*of=\/dev\/[sh]d/, // Direct disk write
  /:(){ :|:& };:/, // Fork bomb
  />\/dev\/[sh]da(?:\s|$)/, // Overwrite disk
  /chmod\s+-R\s+000\s+\//, // Remove all permissions
];

// Output limits to prevent memory exhaustion
const SHELL_LIMITS = {
  maxOutput: 500000, // 500K chars (generous for build output)
  truncateMessage: '\n... [Output truncated - exceeded 500K chars]',
};

/**
 * Validates shell commands against catastrophic patterns
 */
function validateCommand(command: string): void {
  for (const pattern of CATASTROPHIC_PATTERNS) {
    if (pattern.test(command)) {
      throw new Error(`Security: Blocked catastrophic command: ${command}`);
    }
  }

  // Warn on risky commands
  const riskyPatterns = [/sudo/, /rm\s+-rf/, /chmod/, /chown/];
  if (riskyPatterns.some((p) => p.test(command))) {
    console.warn(`⚠️ Executing potentially risky command: ${command}`);
  }
}

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
      // Validate and extract arguments with proper type checking
      if (typeof args.command !== 'string') {
        throw new Error('Command must be a string');
      }
      const command = args.command;

      const timeout = typeof args.timeout === 'number' ? args.timeout : 30000;
      const cwd = typeof args.cwd === 'string' ? args.cwd : undefined;
      const parseJson = typeof args.parseJson === 'boolean' ? args.parseJson : false;

      try {
        // Security check
        validateCommand(command);

        // Execute the command with timeout
        const { stdout, stderr } = await execAsync(command, {
          timeout,
          cwd: cwd || process.cwd(),
          encoding: 'utf8',
          maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        });

        // Truncate output if too large
        let finalOutput = stdout.trim();
        if (finalOutput.length > SHELL_LIMITS.maxOutput) {
          finalOutput = finalOutput.slice(0, SHELL_LIMITS.maxOutput) + SHELL_LIMITS.truncateMessage;
        }

        // Try to parse as JSON if requested
        if (parseJson && finalOutput) {
          try {
            const parsed = JSON.parse(finalOutput);
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
          content: finalOutput,
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
