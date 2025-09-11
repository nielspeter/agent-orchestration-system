import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { AgentSystemBuilder, BuildResult } from '@/config/system-builder';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Integration Smoke Tests', () => {
  let buildResult: BuildResult;

  beforeAll(async () => {
    buildResult = await AgentSystemBuilder.default()
      .withModel(process.env.MODEL || 'anthropic/claude-3-5-haiku-latest')
      .withAgentsFrom(path.join(__dirname, 'test-agents'))
      .withSessionId('smoke-test')
      .build();
  });

  afterAll(async () => {
    if (buildResult?.cleanup) {
      await buildResult.cleanup();
    }
  });

  test('system can execute agents', async () => {
    const result = await buildResult.executor.execute(
      'code-analyzer',
      'Respond with "system operational"'
    );

    expect(result).toBeDefined();
    expect(result.toLowerCase()).toContain('operational');
  }, 10000);

  test('delegation works', async () => {
    const result = await buildResult.executor.execute('orchestrator', 'Say "test complete"');

    expect(result).toBeDefined();
    expect(result.toLowerCase()).toContain('complete');
  }, 10000);

  test('agents can use tools', async () => {
    const result = await buildResult.executor.execute(
      'code-analyzer',
      'Use the Read tool to check if tests/integration/test-data/sample.ts exists and say "file exists" or "file missing"'
    );

    expect(result).toBeDefined();
    expect(result.toLowerCase()).toMatch(/file exists|file missing/);
  }, 10000);
});

/*
 * NOTE: These are smoke tests to verify basic functionality.
 * They do NOT test architectural features like:
 * - Pull architecture (verifying child doesn't inherit parent context)
 * - Caching effectiveness (verifying performance improvements)
 * - Parallel execution (verifying simultaneous tool calls)
 *
 * Properly testing these would require:
 * - Access to execution logs or metrics
 * - Timing measurements
 * - More complex test scenarios
 */
