import { Tool, ToolResult } from '@/types';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface SessionLogEntry {
  uuid: string;
  parentUuid: string | null;
  timestamp: string;
  sessionId: string;
  type: string;
  message?: {
    role: string;
    content: unknown;
  };
  agentMetadata?: {
    agentName: string;
    depth: number;
    toolCount?: number;
  };
  userType?: string;
  summary?: string;
  [key: string]: unknown;
}

/**
 * Creates a GetSessionLog tool for retrieving conversation logs
 *
 * This tool allows agents to retrieve their own or other session logs.
 * The sessionId can be provided by the SystemBuilder when a logger is configured.
 *
 * @param currentSessionId - The current session ID (optional, can be provided at execution time)
 * @returns Tool configured for session log retrieval
 */
export const createGetSessionLogTool = (currentSessionId?: string): Tool => ({
  name: 'get_session_log',
  description: 'Retrieve the conversation log for the current session or a specific session by ID',

  parameters: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'Optional session ID. If not provided, uses the current session.',
      },
      includeSystemMessages: {
        type: 'boolean',
        description: 'Whether to include system messages in the log (default: false)',
      },
    },
    required: [],
  },

  execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
    try {
      // Get session ID from args or use the provided current session
      const sessionId = (args.sessionId as string) || currentSessionId;
      const includeSystemMessages = args.includeSystemMessages as boolean;

      if (!sessionId) {
        return {
          content: null,
          error: 'No session ID provided and no current session context available',
        };
      }

      // Find file containing the session ID
      const logsDir = 'logs';

      // Read directory to find file with this sessionId
      let sessionFile: string | undefined;
      try {
        const files = await fs.readdir(logsDir);
        // Look for files containing the sessionId UUID
        sessionFile = files.find((f) => f.includes(sessionId) && f.endsWith('.jsonl'));
      } catch {
        return {
          content: null,
          error: 'Logs directory not found',
        };
      }

      if (!sessionFile) {
        return {
          content: null,
          error: `Session log not found for ID: ${sessionId}`,
        };
      }

      const filePath = path.join(logsDir, sessionFile);

      // Read and parse the JSONL file
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());
      const entries: SessionLogEntry[] = [];

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);

          // Filter system messages if requested
          if (!includeSystemMessages && entry.type === 'system') {
            continue;
          }

          entries.push(entry);
        } catch {
          console.warn(`Skipping malformed log entry: ${line.substring(0, 100)}...`);
        }
      }

      return {
        content: {
          sessionId,
          entryCount: entries.length,
          entries,
          metadata: {
            firstEntry: entries[0]?.timestamp,
            lastEntry: entries[entries.length - 1]?.timestamp,
          },
        },
      };
    } catch (error) {
      return {
        content: null,
        error: `Failed to retrieve session log: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },

  isConcurrencySafe: () => true, // Reading logs is safe to do concurrently
});
