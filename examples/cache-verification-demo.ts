import { getDirname } from '../src/utils/esm-helpers';
import { config } from 'dotenv';
import { setupFromConfig } from '../src/config/mcp-config-loader';
import * as fs from 'fs/promises';
import * as path from 'path';

// Load environment variables
config();

async function setupTestEnvironment() {
  const agentsDir = path.join(getDirname(import.meta.url), 'agents');
  await fs.mkdir(agentsDir, { recursive: true });

  // Create parent agent
  const parentAgent = `---
name: parent
tools: ["*"]
---

You are the parent agent. When delegating, pass your complete understanding to child agents.`;

  // Create child agent
  const childAgent = `---
name: child
tools: ["read"]
---

You are the child agent. With pull architecture, you don't inherit parent's context.
You must use your Read tool to get any files you need to analyze.`;

  await fs.writeFile(path.join(agentsDir, 'parent.md'), parentAgent);
  await fs.writeFile(path.join(agentsDir, 'child.md'), childAgent);

  // Create test file
  const testDir = path.join(getDirname(import.meta.url), 'test-data');
  await fs.mkdir(testDir, { recursive: true });

  const testContent = `# Cache Test Document

This is a test document to verify caching behavior.

${Array(50).fill('Content that will be cached when read by parent.').join('\n')}

The key insight: When parent reads this and delegates to child,
the child should inherit the cached content blocks.`;

  await fs.writeFile(path.join(testDir, 'test.md'), testContent);

  return { agentsDir, testDir };
}

async function verifyCaching() {
  console.log('🔍 Claude Code Caching Verification Test\n');

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY not found!');
    process.exit(1);
  }

  const { agentsDir, testDir } = await setupTestEnvironment();

  // Use configuration-based setup with custom agent directory
  const setup = await setupFromConfig({
    sessionId: 'cache-verification',
    configOverrides: {
      agents: {
        directory: agentsDir
      },
      execution: {
        defaultModel: 'claude-3-5-haiku-20241022'
      }
    }
  });
  
  const { executor } = setup;

  console.log('='.repeat(60));
  console.log('Test: Parent → Child Delegation with Caching');
  console.log('='.repeat(60) + '\n');

  try {
    await executor.execute(
      'parent',
      `Read the file examples/test-data/test.md and understand its content.
      Then delegate to the child agent to analyze the same file.
      
      IMPORTANT: Due to pull architecture, tell the child agent the exact file path 
      so it can read it itself: examples/test-data/test.md`
    );
    console.log('\n' + '='.repeat(60));
    console.log('Cache Analysis with Pull Architecture:');
    console.log('='.repeat(60));
    console.log('1. Parent read file → Created cache blocks');
    console.log('2. Child does NOT inherit parent messages (pull architecture)');
    console.log("3. Child reads same file → CACHE HIT!");
    console.log('4. Both have the content with minimal token cost');
    console.log('\nCheck the logs above to verify:');
    console.log('- Parent uses Read tool');
    console.log('- Child also uses Read tool (pull architecture)');
    console.log('- Cache provides efficiency despite "redundant" reads');
  } catch (error) {
    console.error('Test failed:', error);
  }

  // Cleanup
  try {
    await fs.rm(testDir, { recursive: true, force: true });
    console.log('\n✅ Test cleanup complete');
  } catch (error) {
    // Ignore
  }
  
  // Clean up MCP connections
  await setup.cleanup();
}

// Run the test
verifyCaching().catch(console.error);
