import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InMemoryStorage } from '@/session/memory.storage';
import { FilesystemStorage } from '@/session/filesystem.storage';
import { SessionStorage } from '@/session/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';

describe('Storage Implementations', () => {
  describe('InMemoryStorage', () => {
    let storage: InMemoryStorage;

    beforeEach(() => {
      storage = new InMemoryStorage();
    });

    it('should store and retrieve events', async () => {
      const event = { type: 'test', data: 'value' };
      await storage.appendEvent('session1', event);

      const events = await storage.readEvents('session1');
      expect(events).toEqual([event]);
    });

    it('should maintain separate sessions', async () => {
      await storage.appendEvent('session1', { id: 1 });
      await storage.appendEvent('session2', { id: 2 });

      const events1 = await storage.readEvents('session1');
      const events2 = await storage.readEvents('session2');

      expect(events1).toEqual([{ id: 1 }]);
      expect(events2).toEqual([{ id: 2 }]);
    });

    it('should preserve event order', async () => {
      await storage.appendEvent('session', { order: 1 });
      await storage.appendEvent('session', { order: 2 });
      await storage.appendEvent('session', { order: 3 });

      const events = await storage.readEvents('session');
      expect(events).toEqual([{ order: 1 }, { order: 2 }, { order: 3 }]);
    });

    it('should correctly report session existence', async () => {
      expect(await storage.sessionExists('session')).toBe(false);

      await storage.appendEvent('session', { data: 'test' });
      expect(await storage.sessionExists('session')).toBe(true);
    });

    it('should return empty array for non-existent session', async () => {
      const events = await storage.readEvents('non-existent');
      expect(events).toEqual([]);
    });

    it('should clear all sessions', async () => {
      await storage.appendEvent('session1', { id: 1 });
      await storage.appendEvent('session2', { id: 2 });

      storage.clear();

      expect(await storage.readEvents('session1')).toEqual([]);
      expect(await storage.readEvents('session2')).toEqual([]);
      expect(await storage.sessionExists('session1')).toBe(false);
      expect(await storage.sessionExists('session2')).toBe(false);
    });

    it('should clear specific session', async () => {
      await storage.appendEvent('session1', { id: 1 });
      await storage.appendEvent('session2', { id: 2 });

      storage.clearSession('session1');

      expect(await storage.readEvents('session1')).toEqual([]);
      expect(await storage.readEvents('session2')).toEqual([{ id: 2 }]);
      expect(await storage.sessionExists('session1')).toBe(false);
      expect(await storage.sessionExists('session2')).toBe(true);
    });

    it('should get all session IDs', async () => {
      await storage.appendEvent('session1', { id: 1 });
      await storage.appendEvent('session2', { id: 2 });
      await storage.appendEvent('session3', { id: 3 });

      const sessionIds = storage.getSessionIds();
      expect(sessionIds).toEqual(['session1', 'session2', 'session3']);
    });

    it('should get session count', async () => {
      expect(storage.getSessionCount()).toBe(0);

      await storage.appendEvent('session1', { id: 1 });
      expect(storage.getSessionCount()).toBe(1);

      await storage.appendEvent('session2', { id: 2 });
      expect(storage.getSessionCount()).toBe(2);

      storage.clearSession('session1');
      expect(storage.getSessionCount()).toBe(1);
    });

    it('should handle complex event objects', async () => {
      const complexEvent = {
        type: 'tool_call',
        timestamp: Date.now(),
        data: {
          id: 'call-123',
          tool: 'Read',
          params: {
            path: '/some/path',
            options: { recursive: true },
            metadata: { user: 'test', tags: ['a', 'b', 'c'] },
          },
        },
      };

      await storage.appendEvent('session', complexEvent);
      const events = await storage.readEvents('session');
      expect(events[0]).toEqual(complexEvent);
    });
  });

  describe('FilesystemStorage', () => {
    const testBasePath = './test-storage-temp';
    let storage: FilesystemStorage;

    beforeEach(async () => {
      // Clean up before each test
      if (existsSync(testBasePath)) {
        await fs.rm(testBasePath, { recursive: true, force: true });
      }
      storage = new FilesystemStorage(testBasePath);
    });

    afterEach(async () => {
      // Clean up after each test
      if (existsSync(testBasePath)) {
        await fs.rm(testBasePath, { recursive: true, force: true });
      }
    });

    it('should create base directory on first write', async () => {
      expect(existsSync(testBasePath)).toBe(false);

      await storage.appendEvent('session1', { test: 'data' });

      expect(existsSync(testBasePath)).toBe(true);
      expect(existsSync(path.join(testBasePath, 'session1'))).toBe(true);
    });

    it('should write events as JSONL', async () => {
      await storage.appendEvent('session1', { id: 1, type: 'test' });
      await storage.appendEvent('session1', { id: 2, type: 'test' });

      const filePath = path.join(testBasePath, 'session1', 'events.jsonl');
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0])).toEqual({ id: 1, type: 'test' });
      expect(JSON.parse(lines[1])).toEqual({ id: 2, type: 'test' });
    });

    it('should read events from JSONL', async () => {
      await storage.appendEvent('session1', { order: 1 });
      await storage.appendEvent('session1', { order: 2 });
      await storage.appendEvent('session1', { order: 3 });

      const events = await storage.readEvents('session1');
      expect(events).toEqual([{ order: 1 }, { order: 2 }, { order: 3 }]);
    });

    it('should handle multiple sessions in separate directories', async () => {
      await storage.appendEvent('session1', { session: 1 });
      await storage.appendEvent('session2', { session: 2 });

      const events1 = await storage.readEvents('session1');
      const events2 = await storage.readEvents('session2');

      expect(events1).toEqual([{ session: 1 }]);
      expect(events2).toEqual([{ session: 2 }]);

      // Check directory structure
      expect(existsSync(path.join(testBasePath, 'session1'))).toBe(true);
      expect(existsSync(path.join(testBasePath, 'session2'))).toBe(true);
    });

    it('should correctly detect session existence', async () => {
      expect(await storage.sessionExists('session1')).toBe(false);

      await storage.appendEvent('session1', { data: 'test' });
      expect(await storage.sessionExists('session1')).toBe(true);
    });

    it('should return empty array for non-existent session', async () => {
      const events = await storage.readEvents('non-existent');
      expect(events).toEqual([]);
    });

    it('should append to existing session file', async () => {
      // Write initial events
      await storage.appendEvent('session1', { id: 1 });
      await storage.appendEvent('session1', { id: 2 });

      // Create new storage instance (simulating restart)
      const storage2 = new FilesystemStorage(testBasePath);
      await storage2.appendEvent('session1', { id: 3 });

      const events = await storage2.readEvents('session1');
      expect(events).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    });

    it('should handle concurrent writes safely', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(storage.appendEvent('concurrent', { id: i }));
      }
      await Promise.all(promises);

      const events = await storage.readEvents('concurrent');
      expect(events).toHaveLength(10);

      // Check all events are present (order might vary due to concurrency)
      const ids = events.map((e: any) => e.id).sort((a: number, b: number) => a - b);
      expect(ids).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('should handle special characters in session IDs', async () => {
      const specialSession = 'session-123_test.name';
      await storage.appendEvent(specialSession, { test: 'data' });

      const events = await storage.readEvents(specialSession);
      expect(events).toEqual([{ test: 'data' }]);
      expect(await storage.sessionExists(specialSession)).toBe(true);
    });

    it('should handle malformed JSONL gracefully', async () => {
      // Manually create a file with bad JSON
      const sessionPath = path.join(testBasePath, 'bad-session');
      await fs.mkdir(sessionPath, { recursive: true });
      await fs.writeFile(
        path.join(sessionPath, 'events.jsonl'),
        '{"valid": "json"}\ninvalid json\n{"another": "valid"}\n'
      );

      const events = await storage.readEvents('bad-session');
      // Should skip the invalid line and return valid ones
      expect(events).toEqual([{ valid: 'json' }, { another: 'valid' }]);
    });

    it('should list all sessions', async () => {
      await storage.appendEvent('session-a', { id: 1 });
      await storage.appendEvent('session-b', { id: 2 });
      await storage.appendEvent('session-c', { id: 3 });

      const sessions = await storage.listSessions();
      expect(sessions.sort()).toEqual(['session-a', 'session-b', 'session-c']);
    });

    it('should delete a session', async () => {
      await storage.appendEvent('to-delete', { id: 1 });
      expect(await storage.sessionExists('to-delete')).toBe(true);

      await storage.deleteSession('to-delete');
      expect(await storage.sessionExists('to-delete')).toBe(false);
      expect(await storage.readEvents('to-delete')).toEqual([]);
    });

    it('should handle deleting non-existent session', async () => {
      // Should not throw
      await expect(storage.deleteSession('non-existent')).resolves.toBeUndefined();
    });
  });

  describe('Storage Interface Compliance', () => {
    // Test that all implementations conform to the interface
    const implementations: Array<[string, () => SessionStorage]> = [
      ['InMemoryStorage', () => new InMemoryStorage()],
      ['FilesystemStorage', () => new FilesystemStorage('./test-compliance-temp')],
    ];

    afterEach(async () => {
      // Clean up filesystem storage
      if (existsSync('./test-compliance-temp')) {
        await fs.rm('./test-compliance-temp', { recursive: true, force: true });
      }
    });

    implementations.forEach(([name, createStorage]) => {
      describe(name, () => {
        let storage: SessionStorage;

        beforeEach(() => {
          storage = createStorage();
        });

        it('should implement SessionStorage interface', () => {
          expect(storage.appendEvent).toBeDefined();
          expect(storage.readEvents).toBeDefined();
          expect(storage.sessionExists).toBeDefined();
        });

        it('should handle basic event flow', async () => {
          const sessionId = 'test-session';
          const event = { type: 'test', data: 'value' };

          // Should not exist initially (except NoOp always returns false)
          if (name === 'InMemoryStorage' || name === 'FilesystemStorage') {
            expect(await storage.sessionExists(sessionId)).toBe(false);
          }

          // Append event
          await expect(storage.appendEvent(sessionId, event)).resolves.toBeUndefined();

          // For NoOp, special handling
          // Remove this condition since we no longer have NoOpStorage
          if (false) {
            expect(await storage.readEvents(sessionId)).toEqual([]);
            expect(await storage.sessionExists(sessionId)).toBe(false);
          } else {
            expect(await storage.readEvents(sessionId)).toContainEqual(event);
            expect(await storage.sessionExists(sessionId)).toBe(true);
          }
        });
      });
    });
  });
});
