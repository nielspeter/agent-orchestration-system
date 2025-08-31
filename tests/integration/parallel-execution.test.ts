import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { AgentSystemBuilder, BuildResult } from '../../src/config/system-builder';

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Parallel Execution Integration Tests', () => {
  let buildResult: BuildResult;
  let testDir: string;

  beforeAll(async () => {
    buildResult = await AgentSystemBuilder.default()
      .withModel(process.env.MODEL || 'claude-3-5-haiku-latest')
      .withAgentsFrom(path.join(__dirname, 'test-agents'))
      .withSessionId('parallel-execution-test')
      .build();
  });

  afterAll(async () => {
    if (buildResult?.cleanup) {
      await buildResult.cleanup();
    }
  });

  beforeEach(async () => {
    // Create test files for parallel reading
    testDir = path.join(process.cwd(), 'tests', 'integration', 'test-parallel-files');
    await fs.mkdir(testDir, { recursive: true });

    const files = [
      { name: 'file1.txt', content: 'Content of file 1 - parallel test' },
      { name: 'file2.txt', content: 'Content of file 2 - parallel test' },
      { name: 'file3.txt', content: 'Content of file 3 - parallel test' },
      { name: 'file4.txt', content: 'Content of file 4 - parallel test' },
      { name: 'file5.txt', content: 'Content of file 5 - parallel test' },
    ];

    for (const file of files) {
      await fs.writeFile(path.join(testDir, file.name), file.content);
    }
  });

  afterEach(async () => {
    // Clean up test files
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  describe('Parallel Tool Execution', () => {
    test('should execute multiple read operations in parallel', async () => {
      if (!buildResult) {
        console.log('Skipping - no API key');
        return;
      }

      const result = await buildResult.executor.execute(
        'orchestrator',
        `Read all these files in parallel and summarize their contents:
         - ${path.join(testDir, 'file1.txt')}
         - ${path.join(testDir, 'file2.txt')}
         - ${path.join(testDir, 'file3.txt')}
         - ${path.join(testDir, 'file4.txt')}
         - ${path.join(testDir, 'file5.txt')}
         
         Execute all reads simultaneously, not sequentially.`
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');

      // Should mention all files
      expect(result).toMatch(/file1/i);
      expect(result).toMatch(/file2/i);
      expect(result).toMatch(/file3/i);
      expect(result).toMatch(/file4/i);
      expect(result).toMatch(/file5/i);
    }, 60000);

    test('should handle mixed parallel operations', async () => {
      if (!buildResult) {
        console.log('Skipping - no API key');
        return;
      }

      const result = await buildResult.executor.execute(
        'orchestrator',
        `Execute these operations in parallel:
         1. List files in ${testDir}
         2. Read ${path.join(testDir, 'file1.txt')}
         3. Read ${path.join(testDir, 'file2.txt')}
         
         Then write a summary to ${path.join(testDir, 'summary.txt')}`
      );

      expect(result).toBeDefined();

      // Check that summary file was created
      const summaryExists = await fs
        .access(path.join(testDir, 'summary.txt'))
        .then(() => true)
        .catch(() => false);

      expect(summaryExists).toBe(true);
    }, 60000);

    test('should respect concurrency safety', async () => {
      if (!buildResult) {
        console.log('Skipping - no API key');
        return;
      }

      const outputFile = path.join(testDir, 'output.txt');

      const result = await buildResult.executor.execute(
        'orchestrator',
        `Perform these operations:
         1. Read ${path.join(testDir, 'file1.txt')} and ${path.join(testDir, 'file2.txt')} in parallel
         2. Write both contents to ${outputFile} (this should be sequential)
         3. Read the output file to verify
         
         Note: Write operations should not be parallel due to concurrency safety.`
      );

      expect(result).toBeDefined();

      // Output file should exist and contain both contents
      const outputContent = await fs.readFile(outputFile, 'utf-8').catch(() => '');
      expect(outputContent.length).toBeGreaterThan(0);
    }, 60000);
  });

  describe('Parallel Discovery Operations', () => {
    test('should search multiple patterns in parallel', async () => {
      if (!buildResult) {
        console.log('Skipping - no API key');
        return;
      }

      // Create files with different content patterns
      await fs.writeFile(
        path.join(testDir, 'code1.ts'),
        'export function test1() { return "test"; }'
      );
      await fs.writeFile(path.join(testDir, 'code2.ts'), 'export class TestClass { method() {} }');
      await fs.writeFile(
        path.join(testDir, 'code3.ts'),
        'export interface TestInterface { prop: string; }'
      );

      const result = await buildResult.executor.execute(
        'orchestrator',
        `Search for these patterns in parallel in ${testDir}:
         1. Files containing "function"
         2. Files containing "class"
         3. Files containing "interface"
         
         Report which files match each pattern.`
      );

      expect(result).toBeDefined();
      expect(result.toLowerCase()).toMatch(/function/);
      expect(result.toLowerCase()).toMatch(/class/);
      expect(result.toLowerCase()).toMatch(/interface/);
    }, 60000);

    test('should handle glob patterns in parallel', async () => {
      if (!buildResult) {
        console.log('Skipping - no API key');
        return;
      }

      const result = await buildResult.executor.execute(
        'orchestrator',
        `Find these file patterns in parallel:
         1. All .txt files in ${testDir}
         2. All .ts files in ${testDir}
         
         List the files found for each pattern.`
      );

      expect(result).toBeDefined();
      expect(result).toMatch(/\.txt/);
      expect(result).toMatch(/file\d\.txt/);
    }, 60000);
  });
});
