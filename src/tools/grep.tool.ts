import { execSync } from 'child_process';
import { BaseTool, ToolResult } from '@/base-types';

/**
 * Grep tool - Search for patterns in files using ripgrep
 *
 * Uses ripgrep (rg) for fast searching across codebases.
 * Returns matches in format: filename:line:content
 */
export const createGrepTool = (): BaseTool => ({
  name: 'grep',
  description:
    'Search for text patterns in files. Returns matching lines with file and line number.',
  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Text or regex pattern to search for',
      },
      path: {
        type: 'string',
        description: 'Directory or file to search in (default: current directory)',
      },
    },
    required: ['pattern'],
  },
  execute: async (args): Promise<ToolResult> => {
    const pattern = args.pattern as string;
    const path = (args.path as string) || '.';

    try {
      // Use ripgrep with:
      // -n: line numbers
      // -H: filenames
      // --max-count: limit matches per file
      // --no-heading: inline format
      const cmd = `rg -n -H --max-count=10 --no-heading "${pattern.replace(/"/g, '\\"')}" "${path}"`;

      const output = execSync(cmd, {
        encoding: 'utf8',
        maxBuffer: 1024 * 1024, // 1MB buffer
        stdio: ['pipe', 'pipe', 'pipe'], // Capture stderr too
      });

      // Split into lines and limit total results
      const lines = output.trim().split('\n').filter(Boolean);
      const limited = lines.slice(0, 100); // Max 100 results

      if (limited.length < lines.length) {
        limited.push(`... ${lines.length - limited.length} more matches truncated`);
      }

      return {
        content: limited.join('\n'),
      };
    } catch (error) {
      // Exit code 1 means no matches found - this is not an error
      if (error && typeof error === 'object' && 'status' in error && error.status === 1) {
        return {
          content: 'No matches found',
        };
      }

      // Real errors (bad regex, path not found, etc)
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: null,
        error: `Search failed: ${errorMessage}`,
      };
    }
  },
  isConcurrencySafe: () => true, // Read-only operation
});
