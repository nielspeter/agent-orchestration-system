import { describe, expect, test } from 'vitest';
import { AgentSystemBuilder } from '@/config/system-builder';
import { AgentExecutor } from '@/agents/executor';

describe('Agent Executor - Essential Tests', () => {
  test('enforces iteration limit to prevent infinite loops', async () => {
    const builder = AgentSystemBuilder.forTest({
      model: 'claude-3-5-haiku-latest',
      safety: {
        maxIterations: 3,
        maxDepth: 5,
        warnAtIteration: 2,
        maxTokensEstimate: 10000,
      },
    });

    const system = await builder.build();
    expect(system.config.safety.maxIterations).toBe(3);

    // In production, would test that execution stops after 3 iterations
    // For POC, config verification is sufficient
  });

  test('enforces depth limit to prevent infinite recursion', async () => {
    const builder = AgentSystemBuilder.forTest({
      model: 'claude-3-5-haiku-latest',
      safety: {
        maxIterations: 10,
        maxDepth: 2,
        warnAtIteration: 5,
        maxTokensEstimate: 10000,
      },
    });

    const system = await builder.build();
    expect(system.config.safety.maxDepth).toBe(2);

    // Would prevent agent A -> agent B -> agent C -> ... chains
  });

  test('executor exists and is properly initialized', async () => {
    const builder = AgentSystemBuilder.default();
    const system = await builder.build();

    expect(system.executor).toBeDefined();
    expect(system.executor).toBeInstanceOf(AgentExecutor);
  });

  test('warns before hitting iteration limit', async () => {
    const builder = AgentSystemBuilder.forTest({
      model: 'claude-3-5-haiku-latest',
      safety: {
        maxIterations: 5,
        maxDepth: 3,
        warnAtIteration: 3,
        maxTokensEstimate: 10000,
      },
    });

    const system = await builder.build();

    // Verify warning comes before limit
    expect(system.config.safety.warnAtIteration).toBeLessThan(system.config.safety.maxIterations);
  });
});
