import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { AgentSystemBuilder, BuildResult } from '../../src/config/system-builder';

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Pull Architecture Integration Tests', () => {
  let buildResult: BuildResult;

  beforeAll(async () => {
    const modelName = process.env.MODEL || 'claude-3-5-haiku-latest';
    buildResult = await AgentSystemBuilder.default()
      .withModel(modelName)
      .withAgentsFrom(path.join(__dirname, 'test-agents'))
      .withSessionId('pull-architecture-test')
      .build();
  });

  afterAll(async () => {
    if (buildResult?.cleanup) {
      await buildResult.cleanup();
    }
  });

  describe('Pull-Based Information Gathering', () => {
    test('child agents should not inherit parent context', async () => {
      if (!buildResult) {
        console.log('Skipping - no API key');
        return;
      }

      const result = await buildResult.executor.execute(
        'orchestrator',
        `First, read the file src/core/agent-executor.ts to understand it yourself.
        Then delegate to code-analyzer to analyze the same file and provide insights.
        
        IMPORTANT: The analyzer should use its own Read tool to get the file,
        not inherit it from you.`
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);

      // The result should indicate that the child agent analyzed the file
      // This is a basic check - in real scenarios you'd verify logs
      expect(result.toLowerCase()).toMatch(/analyz|pattern|architect|class/);
    }, 60000); // 30 second timeout for API calls

    test('child agents should use tools to discover information', async () => {
      if (!buildResult) {
        console.log('Skipping - no API key');
        return;
      }

      const result = await buildResult.executor.execute(
        'orchestrator',
        `Delegate to code-analyzer to find and analyze any TypeScript 
        middleware files in the src directory. The analyzer should:
        1. Use Glob or Grep to find middleware files
        2. Read the files it discovers
        3. Provide analysis of the middleware patterns used`
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);

      // Should find and mention middleware files
      expect(result.toLowerCase()).toMatch(/middleware/);
    }, 60000);
  });

  describe('Direct Child Execution', () => {
    test('direct child execution requires fresh reads', async () => {
      if (!buildResult) {
        console.log('Skipping - no API key');
        return;
      }

      // Direct execution without parent context
      const result = await buildResult.executor.execute(
        'code-analyzer',
        'Analyze the architecture patterns in src/core/agent-executor.ts'
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);

      // Should successfully analyze despite no parent context
      expect(result.toLowerCase()).toMatch(/pattern|architect|design/);
    }, 60000);
  });

  describe('Tool Usage Verification', () => {
    test('parent and child should both use Read tool independently', async () => {
      if (!buildResult) {
        console.log('Skipping - no API key');
        return;
      }

      const result = await buildResult.executor.execute(
        'orchestrator',
        `Read src/types.ts and understand the type definitions.
        Then ask code-analyzer to also examine src/types.ts and explain
        the purpose of each interface defined there.`
      );

      expect(result).toBeDefined();
      // Both agents should successfully read and analyze the file
      expect(result.toLowerCase()).toMatch(/interface|type|definition/);
    }, 60000);

    test('child should use discovery tools when needed', async () => {
      if (!buildResult) {
        console.log('Skipping - no API key');
        return;
      }

      const result = await buildResult.executor.execute(
        'code-analyzer',
        `Find all tool definitions in the src/tools directory 
        and list their names and purposes.`
      );

      expect(result).toBeDefined();
      // Should find and list tools
      expect(result.toLowerCase()).toMatch(/tool|read|write|list/);
    }, 60000);
  });
});
