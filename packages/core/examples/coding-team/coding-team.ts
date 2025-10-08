/**
 * Coding Team Example
 *
 * Demonstrates how multiple agents can collaborate to implement software features.
 * The driver agent orchestrates, while specialist agents handle implementation and testing.
 *
 * This example shows:
 * - Pull architecture: Each agent discovers what they need
 * - Agentic loop: Agents iterate to refine their work
 * - TodoWrite: Task tracking and progress visibility
 * - Shell tool: Running tests and builds
 */

import { AgentSystemBuilder } from '@/config';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runCodingTeam() {
  console.log('🚀 Starting Coding Team Example');
  console.log('='.repeat(50));

  // Build the system with coding agents
  // .default() already includes read, write, list, grep, task, todowrite
  // We just need to add shell
  const system = await AgentSystemBuilder.default()
    .withAgentsFrom(path.join(__dirname, 'agents'))
    .addBuiltinTools('shell') // Add shell to the default tools
    .with({
      safety: {
        maxIterations: 20, // Allow more iterations for complex coding tasks
        maxDepth: 5,
        warnAtIteration: 10,
      },
    })
    .build();

  // Feature specification - minimal, let driver figure out the details
  const projectPath = path.join(__dirname, 'sample-project');
  const featureSpec = `
Implement a factorial function in the TypeScript project located at: ${projectPath}

Requirements:
- Function name: factorial(n)
- Returns n! (n factorial)
- Handle edge cases properly (0! = 1, negative numbers should error)
- Include comprehensive tests
- Ensure all tests pass
  `;

  console.log('\n📋 Feature Request:');
  console.log(featureSpec);
  console.log('\n' + '='.repeat(50));

  // Execute the driver agent with the feature request
  console.log('\n🎯 Driver agent starting orchestration...\n');

  try {
    const result = await system.executor.execute('driver', featureSpec);

    console.log('\n' + '='.repeat(50));
    console.log('✅ Feature Implementation Complete!');
    console.log('\n📊 Final Result:');
    console.log(result);

    // Show execution stats
    // Note: Session tracking would need to be added to get real session data
    // For now, we'll show placeholder stats
    console.log('\n📈 Execution Statistics:');
    console.log('- Feature implementation completed successfully');

    // In a real implementation, you'd track the session like this:
    // const sessionId = system.executor.getLastSessionId();
    // const events = await system.storage.readSession(sessionId);
    // Then you could show delegation chains, tool calls, etc.
  } catch (error) {
    console.error('\n❌ Error during execution:', error);
  } finally {
    // Cleanup
    await system.cleanup();
  }

  console.log('\n' + '='.repeat(50));
  console.log('🏁 Coding Team Example Complete');
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  runCodingTeam().catch(console.error);
}

export { runCodingTeam };
