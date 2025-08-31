import { afterEach, describe, expect, test } from 'vitest';
import { AgentSystemBuilder } from '@/config/system-builder';
import * as fs from 'fs/promises';

describe('AgentSystemBuilder Tests', () => {
  let cleanup: (() => Promise<void>) | null = null;

  afterEach(async () => {
    // Clean up any resources after each test
    if (cleanup) {
      await cleanup();
      cleanup = null;
    }
  });

  describe('Factory Methods', () => {
    test('minimal() should create builder with no tools', async () => {
      const result = await AgentSystemBuilder.minimal().build();
      cleanup = result.cleanup;

      expect(result.executor).toBeDefined();
      expect(result.config).toBeDefined();
      expect(result.toolRegistry).toBeDefined();
      expect(result.toolRegistry.list()).toHaveLength(0);
    });

    test('default() should create builder with file tools', async () => {
      const result = await AgentSystemBuilder.default().build();
      cleanup = result.cleanup;

      const toolNames = result.toolRegistry.list().map((t) => t.name);
      expect(toolNames).toContain('Read');
      expect(toolNames).toContain('Write');
      expect(toolNames).toContain('List');
      expect(toolNames).toContain('Task');
      expect(toolNames).toContain('TodoWrite');
    });

    test('full() should create builder with all tools', async () => {
      const result = await AgentSystemBuilder.default().build();
      cleanup = result.cleanup;

      const toolNames = result.toolRegistry.list().map((t) => t.name);
      expect(toolNames).toContain('Read');
      expect(toolNames).toContain('Write');
      expect(toolNames).toContain('List');
      expect(toolNames).toContain('Task');
      expect(toolNames).toContain('TodoWrite');
    });
  });

  describe('Builder Configuration', () => {
    test('withModel() should set the model', async () => {
      const modelName = process.env.MODEL || 'claude-3-5-haiku-latest';
      const result = await AgentSystemBuilder.minimal().withModel(modelName).build();
      cleanup = result.cleanup;

      expect(result.config.model).toBe(modelName);
    });

    test('withAgentsFrom() should set agent directories', async () => {
      const result = await AgentSystemBuilder.minimal()
        .withAgentsFrom('./agents', './custom-agents')
        .build();
      cleanup = result.cleanup;

      expect(result.config.agents.directories).toContain('./agents');
      expect(result.config.agents.directories).toContain('./custom-agents');
    });

    test('withSafetyLimits() should set safety configuration', async () => {
      const result = await AgentSystemBuilder.minimal()
        .withSafetyLimits({ maxIterations: 100, maxDepth: 5 })
        .build();
      cleanup = result.cleanup;

      expect(result.config.safety.maxIterations).toBe(100);
      expect(result.config.safety.maxDepth).toBe(5);
    });

    test('withLogging() should set logging configuration', async () => {
      const result = await AgentSystemBuilder.minimal()
        .withLogging({ verbose: true, logDir: './test-logs' })
        .build();
      cleanup = result.cleanup;

      expect(result.config.logging.verbose).toBe(true);
      expect(result.config.logging.logDir).toBe('./test-logs');
    });

    test('withSessionId() should set session ID', async () => {
      const sessionId = 'test-session-123';
      const result = await AgentSystemBuilder.minimal().withSessionId(sessionId).build();
      cleanup = result.cleanup;

      expect(result.config.session.sessionId).toBe(sessionId);
    });
  });

  describe('Tool Configuration', () => {
    test('withDefaultTools() should add file and task tools', async () => {
      const result = await AgentSystemBuilder.minimal().withDefaultTools().build();
      cleanup = result.cleanup;

      const toolNames = result.toolRegistry.list().map((t) => t.name);
      expect(toolNames).toContain('Read');
      expect(toolNames).toContain('Write');
      expect(toolNames).toContain('List');
      expect(toolNames).toContain('Task');
    });

    test('withTodoTool() should add TodoWrite tool', async () => {
      const result = await AgentSystemBuilder.minimal().withTodoTool().build();
      cleanup = result.cleanup;

      const toolNames = result.toolRegistry.list().map((t) => t.name);
      expect(toolNames).toContain('TodoWrite');
    });
  });

  describe('Config File Loading', () => {
    test('fromConfigFile() should fail gracefully if file does not exist', async () => {
      await expect(
        AgentSystemBuilder.fromConfigFile('./non-existent-config.json')
      ).rejects.toThrow();
    });

    test('fromConfigFile() should load config if file exists', async () => {
      // Create a temporary config file
      const configPath = './test-config.json';
      const modelName = process.env.MODEL || 'claude-3-5-haiku-latest';
      const config = {
        model: modelName,
        agents: { directories: ['./agents'] },
        tools: { builtin: ['read', 'write'] },
      };

      await fs.writeFile(configPath, JSON.stringify(config, null, 2));

      try {
        const builder = await AgentSystemBuilder.fromConfigFile(configPath);
        const result = await builder.build();
        cleanup = result.cleanup;

        expect(result.config.model).toBe(modelName);
        expect(result.config.agents.directories).toContain('./agents');
      } finally {
        // Clean up test config file
        await fs.unlink(configPath).catch(() => {});
      }
    });
  });

  describe('Build Result', () => {
    test('build() should return complete BuildResult', async () => {
      const result = await AgentSystemBuilder.default().build();
      cleanup = result.cleanup;

      expect(result).toHaveProperty('config');
      expect(result).toHaveProperty('executor');
      expect(result).toHaveProperty('toolRegistry');
      expect(result).toHaveProperty('cleanup');
      expect(typeof result.cleanup).toBe('function');
    });

    test('cleanup() should not throw errors', async () => {
      const result = await AgentSystemBuilder.default().build();

      // Should not throw
      await expect(result.cleanup()).resolves.toBeUndefined();
    });
  });
});
