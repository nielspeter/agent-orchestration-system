import { getDirname } from '../src/utils/esm-helpers';
import { config } from 'dotenv';
import { AgentExecutor, AgentLoader, ToolRegistry } from '../src';
import { LoggerFactory } from '../src/core/conversation-logger';
import { createListTool, createReadTool, createWriteTool } from '../src/tools/file-tools';
import { createTaskTool } from '../src/tools/task-tool';
import * as fs from 'fs/promises';
import * as path from 'path';

// Load environment variables
config();

async function createTestFiles() {
  const testDir = path.join(getDirname(import.meta.url), 'test-files');
  await fs.mkdir(testDir, { recursive: true });

  // Create multiple test files to read
  const files = [
    { name: 'file1.txt', content: 'This is file 1 content' },
    { name: 'file2.txt', content: 'This is file 2 content' },
    { name: 'file3.txt', content: 'This is file 3 content' },
    { name: 'file4.txt', content: 'This is file 4 content' },
    { name: 'file5.txt', content: 'This is file 5 content' },
  ];

  for (const file of files) {
    await fs.writeFile(path.join(testDir, file.name), file.content);
  }

  return testDir;
}

async function cleanupTestFiles() {
  const testDir = path.join(getDirname(import.meta.url), 'test-files');
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch (error) {
    // Ignore errors
  }
}

async function runParallelExecutionTest() {
  console.log('🚀 Testing Parallel Execution with Claude Code Architecture\n');
  console.log('='.repeat(60));

  // Create test files
  const testDir = await createTestFiles();
  console.log(`✅ Created test files in ${testDir}\n`);

  // Initialize components
  const agentLoader = new AgentLoader(path.join(getDirname(import.meta.url), 'agents'));
  const toolRegistry = new ToolRegistry();
  const logger = LoggerFactory.createCombinedLogger();

  // Register tools
  toolRegistry.register(createReadTool());
  toolRegistry.register(createWriteTool());
  toolRegistry.register(createListTool());
  toolRegistry.register(createTaskTool());

  const modelName = process.env.MODEL || 'claude-3-5-haiku-20241022';
  const executor = new AgentExecutor(agentLoader, toolRegistry, modelName, logger);

  // Create test orchestrator agent with proper frontmatter
  const agentContent = `---
name: parallel-test-orchestrator
tools: ["*"]
---

# Test Orchestrator for Parallel Execution

You are a test orchestrator demonstrating parallel execution.
    
IMPORTANT: You must execute tools to demonstrate the parallel execution architecture.

When asked to read multiple files, use multiple read tool calls in the SAME response to trigger parallel execution.
When asked to perform mixed operations, combine read and write operations to show hybrid execution.

Always provide a summary of what operations were performed and their execution strategy.`;

  // Save agent
  await fs.mkdir(path.join(getDirname(import.meta.url), 'agents'), { recursive: true });
  await fs.writeFile(
    path.join(getDirname(import.meta.url), 'agents', 'parallel-test-orchestrator.md'),
    agentContent
  );

  console.log('Test 1: Parallel Read Operations');
  console.log('-'.repeat(40));

  try {
    const startTime = Date.now();

    const result1 = await executor.execute(
      'parallel-test-orchestrator',
      `Read all 5 text files in the test-files directory (file1.txt through file5.txt). 
      Use multiple read tool calls in a single response to demonstrate parallel execution.
      Then summarize what you found.`
    );

    const duration1 = Date.now() - startTime;
    console.log(`\n✅ Test 1 completed in ${duration1}ms`);
    console.log('Result:', result1);
  } catch (error) {
    console.error('❌ Test 1 failed:', error);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Test 2: Mixed Sequential and Parallel Operations');
  console.log('-'.repeat(40));

  try {
    const startTime = Date.now();

    const result2 = await executor.execute(
      'parallel-test-orchestrator',
      `First, list the files in test-files directory.
      Then read file1.txt and file2.txt in parallel.
      Finally, write a summary to summary.txt with the combined content.
      
      This should demonstrate:
      1. List operation (safe, can be parallel)
      2. Multiple read operations (safe, should be parallel)
      3. Write operation (unsafe, must be sequential)`
    );

    const duration2 = Date.now() - startTime;
    console.log(`\n✅ Test 2 completed in ${duration2}ms`);
    console.log('Result:', result2);
  } catch (error) {
    console.error('❌ Test 2 failed:', error);
  }

  // Check the audit log
  console.log('\n' + '='.repeat(60));
  console.log('📋 Checking Audit Log for Execution Patterns\n');

  const auditLogPath = path.join(getDirname(import.meta.url), 'logs', 'audit.jsonl');
  try {
    const logContent = await fs.readFile(auditLogPath, 'utf-8');
    const logLines = logContent
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    // Find parallel execution markers
    const parallelExecutions = logLines.filter(
      (log) =>
        log.content?.includes('[PARALLEL]') ||
        log.metadata?.groups?.some((g: any) => g.isConcurrent)
    );

    const sequentialExecutions = logLines.filter((log) => log.content?.includes('[SEQUENTIAL]'));

    const sidechainExecutions = logLines.filter(
      (log) => log.content?.includes('[SIDECHAIN]') || log.metadata?.isSidechain === true
    );

    console.log(`Found ${parallelExecutions.length} parallel execution groups`);
    console.log(`Found ${sequentialExecutions.length} sequential execution groups`);
    console.log(`Found ${sidechainExecutions.length} sidechain delegations`);

    if (parallelExecutions.length > 0) {
      console.log('\n🎉 SUCCESS: Parallel execution architecture is working!');
      console.log('Sample parallel execution:', JSON.stringify(parallelExecutions[0], null, 2));
    }
  } catch (error) {
    console.log('Could not read audit log:', error);
  }

  // Cleanup
  await cleanupTestFiles();
  console.log('\n✅ Test files cleaned up');
}

// Run the test
runParallelExecutionTest().catch(console.error);
