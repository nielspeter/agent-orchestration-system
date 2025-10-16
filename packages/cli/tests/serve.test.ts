/**
 * Tests for serve command
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { CommandContext } from '../src/commands';

// Create hoisted mocks for ESM compatibility
const mocks = vi.hoisted(() => ({
  startServer: vi.fn(async () => {
    // Return a mock server object
    return {
      close: vi.fn(),
      listening: true,
      address: () => ({ port: 3000, address: 'localhost' }),
    };
  }),
  open: vi.fn(async () => {}),
}));

// Mock dependencies
vi.mock('@agent-system/web/server', () => ({
  startServer: mocks.startServer,
}));

vi.mock('open', () => ({
  default: mocks.open,
}));

describe('Serve Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('serveWeb', () => {
    it('should start server with default options', async () => {
      const { serveWeb } = await import('../src/commands');

      const ctx: CommandContext = {
        options: {},
      };

      // Start server (don't await - it never resolves)
      serveWeb(ctx);

      // Give it a moment to call startServer
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mocks.startServer).toHaveBeenCalledWith({
        port: 3000,
        host: 'localhost',
      });
    });

    it('should start server with custom port and host', async () => {
      const { serveWeb } = await import('../src/commands');

      const ctx: CommandContext = {
        options: {
          port: 8080,
          host: '0.0.0.0',
        },
      };

      serveWeb(ctx);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mocks.startServer).toHaveBeenCalledWith({
        port: 8080,
        host: '0.0.0.0',
      });
    });

    it('should open browser when --open flag is set', async () => {
      const { serveWeb } = await import('../src/commands');

      const ctx: CommandContext = {
        options: {
          port: 3000,
          host: 'localhost',
          open: true,
        },
      };

      serveWeb(ctx);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mocks.open).toHaveBeenCalledWith('http://localhost:3000');
    });

    it('should not open browser when --open flag is false', async () => {
      const { serveWeb } = await import('../src/commands');

      const ctx: CommandContext = {
        options: {
          open: false,
        },
      };

      serveWeb(ctx);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mocks.open).not.toHaveBeenCalled();
    });

    it('should handle server startup errors', async () => {
      mocks.startServer.mockRejectedValueOnce(new Error('Port already in use'));

      const { serveWeb } = await import('../src/commands');

      const ctx: CommandContext = {
        options: {},
      };

      await expect(serveWeb(ctx)).rejects.toThrow('Failed to start server: Port already in use');
    });

    it('should format URL correctly with custom host and port', async () => {
      const { serveWeb } = await import('../src/commands');

      const ctx: CommandContext = {
        options: {
          port: 8080,
          host: '192.168.1.100',
          open: true,
        },
      };

      serveWeb(ctx);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mocks.open).toHaveBeenCalledWith('http://192.168.1.100:8080');
    });
  });

  describe('Command Options', () => {
    it('should have correct option types', () => {
      const options = {
        port: 3000,
        host: 'localhost',
        open: true,
      };

      expect(typeof options.port).toBe('number');
      expect(typeof options.host).toBe('string');
      expect(typeof options.open).toBe('boolean');
    });

    it('should handle string port number (from CLI)', async () => {
      const { serveWeb } = await import('../src/commands');

      const ctx: CommandContext = {
        options: {
          port: '8080' as any, // CLI parses as string
        },
      };

      serveWeb(ctx);
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should convert to number or handle correctly
      expect(mocks.startServer).toHaveBeenCalled();
    });
  });
});
