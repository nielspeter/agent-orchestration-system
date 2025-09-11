import { describe, expect, it } from 'vitest';
import { AgentSystemBuilder } from '@/config/system-builder';
import { NoOpStorage } from '@/session/noop.storage';

/**
 * Storage Configuration Validation Tests
 *
 * These tests verify that invalid storage types are properly validated
 * and throw errors to prevent silent data loss.
 */
describe('Storage Configuration Validation', () => {
  describe('Invalid Storage Type Handling', () => {
    it('should throw error for misspelled storage type', async () => {
      // User accidentally types 'filesytem' instead of 'filesystem'
      const buildWithTypo = async () => {
        return AgentSystemBuilder.minimal()
          .with({
            storage: {
              // @ts-expect-error - Testing runtime behavior with typo
              type: 'filesytem', // TYPO!
              options: { path: './important-sessions' },
            },
          })
          .withSessionId('critical-session')
          .build();
      };

      // System now throws error, preventing data loss
      await expect(buildWithTypo()).rejects.toThrow("Invalid storage type: 'filesytem'");
    });

    it('should throw error for invalid storage type from config', async () => {
      // Config loaded from JSON with invalid type
      const config = {
        storage: {
          type: 'database' as any, // Not implemented yet!
          options: {
            connectionString: 'postgresql://...',
          },
        },
      };

      await expect(
        AgentSystemBuilder.minimal()
          .with(config as any)
          .build()
      ).rejects.toThrow("Invalid storage type: 'database'");
    });

    it('should throw clear error for invalid storage type', async () => {
      const buildWithInvalidStorage = async () => {
        return AgentSystemBuilder.minimal()
          .with({
            storage: {
              // @ts-expect-error - Testing invalid type
              type: 'invalid-type',
            },
          })
          .build();
      };

      // Correctly throws with clear error message
      await expect(buildWithInvalidStorage()).rejects.toThrow(
        "Invalid storage type: 'invalid-type'"
      );
    });
  });

  describe('Production Configuration Scenarios', () => {
    it('should throw error for environment config with typo', async () => {
      // Production config with typo
      const prodConfig = {
        storage: {
          type: process.env.STORAGE_TYPE || 'file-system', // Wrong!
          options: {
            path: process.env.SESSION_PATH || './prod-sessions',
          },
        } as any,
      };

      // Now throws error preventing data loss
      await expect(AgentSystemBuilder.minimal().with(prodConfig).build()).rejects.toThrow(
        "Invalid storage type: 'file-system'"
      );
    });

    it('should throw error for case-sensitive storage type variations', async () => {
      // Some configs might use different casing
      const configs = [
        { storage: { type: 'FileSystem' as any } }, // Capital F and S
        { storage: { type: 'FILESYSTEM' as any } }, // All caps
        { storage: { type: 'Memory' as any } }, // Capital M
        { storage: { type: 'MEMORY' as any } }, // All caps
      ];

      for (const config of configs) {
        // All invalid cases now throw errors
        await expect(AgentSystemBuilder.minimal().with(config).build()).rejects.toThrow(
          'Invalid storage type'
        );
      }
    });
  });

  describe('Migration Scenarios', () => {
    it('should default to none storage for old config format', async () => {
      // Old format from before refactoring
      const oldConfig = {
        logging: {
          storage: 'filesystem', // Old location - ignored!
          path: './sessions',
        },
      } as any;

      const system = await AgentSystemBuilder.minimal().with(oldConfig).build();

      // Correctly defaults to 'none' storage when config is missing/invalid
      // This is expected behavior - old config format is not supported
      expect(system.storage).toBeInstanceOf(NoOpStorage);
      expect(system.config.storage.type).toBe('none');

      await system.cleanup();
    });
  });
});
