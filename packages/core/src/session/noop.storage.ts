import { SessionStorage } from './types.js';

/**
 * No-operation storage implementation
 *
 * DEFAULT implementation with zero overhead.
 * Does not persist anything, suitable for:
 * - CLI usage without session recovery
 * - One-shot operations
 * - Environments where persistence is not needed
 */
export class NoOpStorage implements SessionStorage {
  async appendEvent(_sessionId: string, _event: unknown): Promise<void> {
    // Do nothing - no storage overhead
  }

  async readEvents(_sessionId: string): Promise<unknown[]> {
    return []; // No events to recover
  }

  async sessionExists(_sessionId: string): Promise<boolean> {
    return false; // Never exists
  }
}
