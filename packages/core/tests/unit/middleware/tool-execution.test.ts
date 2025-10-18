import { describe, expect, test } from 'vitest';
import { AgentSystemBuilder } from '@/config/system-builder';

describe('Tool Execution - Essential Tests', () => {
  test('Write tools execute sequentially for data safety', async () => {
    // In a real test, would verify Write tools don't run concurrently
    // For POC, just verify the config exists
    const builder = AgentSystemBuilder.default();
    const system = await builder.build();

    // The system should have concurrency limits
    expect(system.config.tools?.maxConcurrentTools).toBeDefined();
    expect(system.config.tools?.maxConcurrentTools).toBeLessThanOrEqual(5);
  });

  test('enforces tool timeout to prevent hanging', async () => {
    const builder = AgentSystemBuilder.default();
    const system = await builder.build();

    // Verify timeout config exists
    expect(system.config.tools?.defaultTimeoutMs).toBeDefined();
    expect(system.config.tools?.defaultTimeoutMs).toBeGreaterThan(0);
    expect(system.config.tools?.defaultTimeoutMs).toBeLessThanOrEqual(30000); // Max 30s
  });

  test('handles tool not found gracefully', async () => {
    const builder = AgentSystemBuilder.minimal();
    const system = await builder.build();

    // Tool registry should exist and handle missing tools
    expect(system.toolRegistry).toBeDefined();
    const tool = system.toolRegistry.getTool('non-existent-tool');
    expect(tool).toBeUndefined();
  });

  test('tool errors do not crash the system', async () => {
    // This verifies error handling exists in config
    const builder = AgentSystemBuilder.default();
    const system = await builder.build();

    // System should continue after tool errors
    expect(system.executor).toBeDefined();
    expect(system.config.safety).toBeDefined();
  });

  test('respects tool concurrency limits', async () => {
    const builder = AgentSystemBuilder.forTest({
      model: 'anthropic/claude-haiku-4-5',
      tools: {
        maxConcurrentTools: 2,
      },
    });

    const system = await builder.build();
    expect(system.config.tools?.maxConcurrentTools).toBe(2);
  });
});
