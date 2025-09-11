import { promises as fs } from 'fs';
import path from 'path';
import { SessionStorage } from './types.js';
import { isNodeError } from '@/utils/type-guards';

/**
 * Filesystem storage implementation
 *
 * Persists events to disk in JSONL format.
 * Provides actual persistence with crash recovery capability.
 *
 * Directory structure:
 * - {path}/{sessionId}/events.jsonl
 */
export class FilesystemStorage implements SessionStorage {
  constructor(private readonly basePath: string = '.agent-sessions') {}

  private getSessionDir(sessionId: string): string {
    return path.join(this.basePath, sessionId);
  }

  private getEventsFile(sessionId: string): string {
    return path.join(this.getSessionDir(sessionId), 'events.jsonl');
  }

  async appendEvent(sessionId: string, event: unknown): Promise<void> {
    const dir = this.getSessionDir(sessionId);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    // Append event as JSONL
    const eventsFile = this.getEventsFile(sessionId);
    const line = JSON.stringify(event) + '\n';
    await fs.appendFile(eventsFile, line, 'utf-8');
  }

  async readEvents(sessionId: string): Promise<unknown[]> {
    const eventsFile = this.getEventsFile(sessionId);

    try {
      const content = await fs.readFile(eventsFile, 'utf-8');

      // Parse JSONL format
      return content
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch (error) {
            console.error(`Failed to parse event line: ${line}`, error);
            return null;
          }
        })
        .filter((event) => event !== null);
    } catch (error) {
      // File doesn't exist or other error
      if (isNodeError(error) && error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async sessionExists(sessionId: string): Promise<boolean> {
    const dir = this.getSessionDir(sessionId);

    try {
      await fs.access(dir);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete a session and all its data
   * Useful for cleanup
   */
  async deleteSession(sessionId: string): Promise<void> {
    const dir = this.getSessionDir(sessionId);

    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors if directory doesn't exist
      if (isNodeError(error) && error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * List all session IDs
   * Useful for management/debugging
   */
  async listSessions(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.basePath, { withFileTypes: true });
      return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    } catch (error) {
      // Directory doesn't exist
      if (isNodeError(error) && error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }
}
