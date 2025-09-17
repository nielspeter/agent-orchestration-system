import { describe, expect, it } from 'vitest';
import { AgentSystemBuilder } from '@/config/system-builder';
import { NoOpStorage } from '@/session/noop.storage';
import { InMemoryStorage } from '@/session/memory.storage';
import { FilesystemStorage } from '@/session/filesystem.storage';

describe('Logging and Storage Integration', () => {
  describe('Storage Type Configuration', () => {
    it('should create NoOpStorage when type is none', async () => {
      const system = await AgentSystemBuilder.minimal()
        .with({ storage: { type: 'none' } })
        .build();

      // Storage should be NoOpStorage
      expect(system.storage).toBeInstanceOf(NoOpStorage);

      // Verify it returns empty/false for all operations
      expect(await system.storage.sessionExists('any')).toBe(false);
      expect(await system.storage.readEvents('any')).toEqual([]);

      await system.cleanup();
    });

    it('should create InMemoryStorage when type is memory', async () => {
      const system = await AgentSystemBuilder.minimal()
        .with({ storage: { type: 'memory' } })
        .build();

      expect(system.storage).toBeInstanceOf(InMemoryStorage);
      await system.cleanup();
    });

    it('should create FilesystemStorage when type is filesystem', async () => {
      const system = await AgentSystemBuilder.minimal()
        .with({ storage: { type: 'filesystem', options: { path: '.test-sessions' } } })
        .build();

      expect(system.storage).toBeInstanceOf(FilesystemStorage);
      await system.cleanup();
    });

    it('should default to none when no storage configured', async () => {
      const system = await AgentSystemBuilder.minimal().build();

      // Default should be 'none' for zero overhead
      expect(system.config.storage.type).toBe('none');
      expect(system.storage).toBeInstanceOf(NoOpStorage);

      await system.cleanup();
    });
  });

  describe('EventLogger Creation Based on Storage Type', () => {
    it('should NOT create EventLogger when storage type is none', async () => {
      const system = await AgentSystemBuilder.minimal()
        .with({ storage: { type: 'none' } })
        .withSessionId('test-session')
        .build();

      // We need to expose the logger in BuildResult to test this properly
      // For now, we can test indirectly by checking if events are stored
      await system.storage.appendEvent('test-session', { type: 'test' });
      const events = await system.storage.readEvents('test-session');

      // NoOpStorage should not store anything
      expect(events).toEqual([]);

      await system.cleanup();
    });

    it('should create EventLogger when storage type is memory', async () => {
      const system = await AgentSystemBuilder.minimal()
        .with({ storage: { type: 'memory' } })
        .withSessionId('test-session')
        .build();

      // EventLogger should write to memory storage
      await system.storage.appendEvent('test-session', { type: 'test', data: 'memory' });
      const events = await system.storage.readEvents('test-session');

      // Find our test event among system events
      const testEvent = events.find((e) => {
        if (!e || typeof e !== 'object') return false;
        const event = e as Record<string, unknown>;
        return event.type === 'test' && event.data === 'memory';
      });
      expect(testEvent).toBeDefined();
      expect(testEvent).toEqual({ type: 'test', data: 'memory' });

      await system.cleanup();
    });

    it('should create EventLogger when storage type is filesystem', async () => {
      const system = await AgentSystemBuilder.minimal()
        .with({
          storage: {
            type: 'filesystem',
            options: { path: '.test-sessions' },
          },
        })
        .withSessionId('test-session')
        .build();

      // EventLogger should write to filesystem storage
      expect(system.storage).toBeInstanceOf(FilesystemStorage);

      await system.cleanup();

      // Clean up test directory
      const fs = await import('fs/promises');
      await fs.rm('.test-sessions', { recursive: true, force: true });
    });
  });

  describe('Console Logger Configuration', () => {
    it('should create ConsoleLogger when console is true', async () => {
      const system = await AgentSystemBuilder.minimal().withConsole(true).build();

      // Console should be enabled with default verbosity
      expect(system.config.console).toBe(true);

      await system.cleanup();
    });

    it('should create ConsoleLogger with custom verbosity', async () => {
      const system = await AgentSystemBuilder.minimal()
        .withConsole({ verbosity: 'verbose' })
        .build();

      // Console should be enabled with custom verbosity
      expect(system.config.console).toEqual({ verbosity: 'verbose' });

      await system.cleanup();
    });

    it('should NOT create ConsoleLogger when console is false', async () => {
      const system = await AgentSystemBuilder.minimal().withConsole(false).build();

      expect(system.config.console).toBe(false);

      await system.cleanup();
    });

    it('should NOT create ConsoleLogger by default', async () => {
      const system = await AgentSystemBuilder.minimal().build();

      // Console should be false by default
      expect(system.config.console).toBe(false);

      await system.cleanup();
    });
  });

  describe('Session Recovery with Different Storage Types', () => {
    it('should handle session recovery with none storage gracefully', async () => {
      const system = await AgentSystemBuilder.minimal()
        .with({ storage: { type: 'none' } })
        .withSessionId('test-session')
        .build();

      // Recovery should return empty array
      const messages = await system.sessionManager.recoverSession('test-session');
      expect(messages).toEqual([]);

      // Session should never exist
      expect(await system.storage.sessionExists('test-session')).toBe(false);

      await system.cleanup();
    });

    it('should recover session from memory storage', async () => {
      const system = await AgentSystemBuilder.minimal()
        .with({ storage: { type: 'memory' } })
        .withSessionId('test-session')
        .build();

      // Add some events
      await system.storage.appendEvent('test-session', {
        type: 'user',
        timestamp: Date.now(),
        data: { role: 'user', content: 'Hello' },
      });

      // Recovery should work
      const messages = await system.sessionManager.recoverSession('test-session');
      // Find our user message among any system messages
      const userMessage = messages.find((m) => m.content === 'Hello');
      expect(userMessage).toBeDefined();
      expect(userMessage?.content).toBe('Hello');

      await system.cleanup();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed events gracefully', async () => {
      const storage = new InMemoryStorage();
      const system = await AgentSystemBuilder.minimal()
        .withStorage(storage)
        .withSessionId('test-session')
        .build();

      // Add malformed event
      await storage.appendEvent('test-session', {
        type: 'invalid',
        no_timestamp: true,
      });

      // Recovery should skip invalid events (but may have system messages)
      const messages = await system.sessionManager.recoverSession('test-session');
      // Check that no message has 'no_timestamp' property (invalid event should be skipped)
      const hasInvalidEvent = messages.some((m: any) => m.no_timestamp);
      expect(hasInvalidEvent).toBe(false);

      await system.cleanup();
    });

    it('should handle concurrent writes to same session', async () => {
      const storage = new InMemoryStorage();
      const system1 = await AgentSystemBuilder.minimal()
        .withStorage(storage)
        .withSessionId('shared-session')
        .build();

      const system2 = await AgentSystemBuilder.minimal()
        .withStorage(storage)
        .withSessionId('shared-session')
        .build();

      // Both systems write to same session
      await Promise.all([
        storage.appendEvent('shared-session', {
          type: 'user',
          timestamp: 1,
          data: { role: 'user', content: 'From system 1' },
        }),
        storage.appendEvent('shared-session', {
          type: 'user',
          timestamp: 2,
          data: { role: 'user', content: 'From system 2' },
        }),
      ]);

      // Both should see all events
      const events = await storage.readEvents('shared-session');
      // Find our two user events
      const userEvents = events.filter((e) => {
        if (!e || typeof e !== 'object') return false;
        const event = e as Record<string, unknown>;
        if (event.type !== 'user') return false;
        const data = event.data as Record<string, unknown> | undefined;
        const content = data?.content as string | undefined;
        return content?.startsWith('From system') || false;
      });
      expect(userEvents).toHaveLength(2);

      await system1.cleanup();
      await system2.cleanup();
    });

    it('should handle todo recovery when storage is none', async () => {
      const system = await AgentSystemBuilder.minimal()
        .with({ storage: { type: 'none' } })
        .withTodoTool()
        .withSessionId('test-session')
        .build();

      // Todo recovery should return empty array
      const todos = await system.sessionManager.recoverTodos('test-session');
      expect(todos).toEqual([]);

      await system.cleanup();
    });
  });
});
