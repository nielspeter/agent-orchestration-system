import { SessionStorage } from './types.js';

/**
 * In-memory storage implementation
 *
 * Stores events in memory for the lifetime of the process.
 * Useful for:
 * - Testing and debugging
 * - GUI applications that need to inspect session state
 * - Temporary sessions that don't need persistence
 *
 * Note: Sessions are lost when the process restarts
 */
export class InMemoryStorage implements SessionStorage {
  private readonly sessions = new Map<string, unknown[]>();

  async appendEvent(sessionId: string, event: unknown): Promise<void> {
    const events = this.sessions.get(sessionId) || [];
    events.push(event);
    this.sessions.set(sessionId, events);
  }

  async readEvents(sessionId: string): Promise<unknown[]> {
    return this.sessions.get(sessionId) || [];
  }

  async sessionExists(sessionId: string): Promise<boolean> {
    return this.sessions.has(sessionId);
  }

  /**
   * Clear all sessions from memory
   * Useful for testing
   */
  clear(): void {
    this.sessions.clear();
  }

  /**
   * Clear a specific session from memory
   * Useful for testing
   */
  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Get all session IDs
   * Useful for debugging/GUI
   */
  getSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Get session count
   * Useful for monitoring
   */
  getSessionCount(): number {
    return this.sessions.size;
  }
}
