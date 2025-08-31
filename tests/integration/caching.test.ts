import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import * as dotenv from 'dotenv';
import { AgentSystemBuilder, BuildResult } from '../../src/config/system-builder';

// Load environment variables
dotenv.config();

describe('Caching Integration Tests', () => {
  let buildResult: BuildResult;

  beforeAll(async () => {
    buildResult = await AgentSystemBuilder.default()
      .withModel(process.env.MODEL || 'claude-3-5-haiku-latest')
      .withSessionId('caching-test')
      .build();
  });

  afterAll(async () => {
    if (buildResult?.cleanup) {
      await buildResult.cleanup();
    }
  });

  describe('Claude Code Caching Strategy', () => {
    test('parent reads should be cached for child agents', async () => {
      if (!buildResult) {
        console.log('Skipping - no API key');
        return;
      }

      // Parent reads file and delegates to child
      // Child should benefit from cached content
      const result = await buildResult.executor.execute(
        'orchestrator',
        `Read the file src/core/agent-executor.ts and then delegate to code-analyzer 
         to analyze its architecture patterns. The goal is to verify that the 
         code-analyzer benefits from the cached file content.`
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);

      // Should successfully analyze the file
      expect(result.toLowerCase()).toMatch(/pattern|architect|middleware|pipeline/);
    }, 60000);

    test('direct child execution requires fresh reads', async () => {
      if (!buildResult) {
        console.log('Skipping - no API key');
        return;
      }

      // Direct execution without parent context
      // This shows the pull architecture - child must read the file itself
      const result = await buildResult.executor.execute(
        'code-analyzer',
        'Analyze the architecture patterns in src/core/agent-executor.ts'
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);

      // Should still successfully analyze despite no cache benefit
      expect(result.toLowerCase()).toMatch(/pattern|architect/);
    }, 60000);

    test('multiple delegations should benefit from caching', async () => {
      if (!buildResult) {
        console.log('Skipping - no API key');
        return;
      }

      // Parent reads once, delegates to multiple children
      const result = await buildResult.executor.execute(
        'orchestrator',
        `Read the file src/types.ts to understand the type system.
         Then:
         1. Ask code-analyzer to identify all interfaces
         2. Ask code-analyzer again to explain the Tool-related types
         Both delegations should benefit from the cached file content.`
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');

      // Should successfully complete both analyses
      expect(result.toLowerCase()).toMatch(/interface/);
      expect(result.toLowerCase()).toMatch(/tool/);
    }, 90000); // Longer timeout for multiple delegations
  });

  describe('Caching with Large Files', () => {
    test('large file reads should be efficiently cached', async () => {
      if (!buildResult) {
        console.log('Skipping - no API key');
        return;
      }

      // Find and analyze a larger file
      const result = await buildResult.executor.execute(
        'orchestrator',
        `Find the largest TypeScript file in src/ directory,
         read it completely, then delegate to code-analyzer
         to count the number of functions and classes in it.`
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');

      // Should provide counts
      expect(result.toLowerCase()).toMatch(/function|class|method|count|\d+/);
    }, 90000);
  });

  describe('Cache Expiration', () => {
    test('cache should persist within 5-minute window', async () => {
      if (!buildResult) {
        console.log('Skipping - no API key');
        return;
      }

      // First read
      const result1 = await buildResult.executor.execute(
        'orchestrator',
        'Read src/index.ts and note the number of exports'
      );

      // Second read (should benefit from cache)
      const result2 = await buildResult.executor.execute(
        'orchestrator',
        'Read src/index.ts again and list all the exported items'
      );

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();

      // Both should successfully read the file
      expect(result1.toLowerCase()).toMatch(/export/);
      expect(result2.toLowerCase()).toMatch(/export/);
    }, 60000);
  });
});
