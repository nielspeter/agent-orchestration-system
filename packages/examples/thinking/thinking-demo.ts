/**
 * Extended Thinking Demo
 *
 * Demonstrates the extended thinking/reasoning feature with different agents:
 * - Deep Reasoner: Uses default thinking budget with Anthropic
 * - Quick Thinker: Uses custom thinking budget
 * - OpenRouter Reasoner: Uses thinking via OpenRouter
 *
 * Usage:
 *   npx tsx packages/examples/thinking/thinking-demo.ts
 *
 * Environment:
 *   ANTHROPIC_API_KEY=... (required for Anthropic models)
 *   OPENROUTER_API_KEY=... (required for OpenRouter example)
 */

import { AgentSystemBuilder } from '@agent-system/core';

async function main() {
  console.log('🧠 Extended Thinking Demo\n');
  console.log('='.repeat(60));

  // Build the agent system with example agents
  const system = AgentSystemBuilder.default()
    .withAgentDirectories([__dirname + '/agents'])
    .withConsole()
    .build();

  // Test 1: Deep Reasoner with default budget
  console.log('\n\n📊 Test 1: Deep Reasoner (Default Budget)');
  console.log('-'.repeat(60));

  const problem1 = `
Solve this logic puzzle step-by-step:

You have 3 boxes: one contains only apples, one contains only oranges,
and one contains both apples and oranges. All boxes are labeled incorrectly.

You can pick one fruit from one box without looking inside.
Which box should you pick from to correctly label all three boxes?

Please show your reasoning process.
`;

  try {
    const result1 = await system.execute('deep-reasoner', problem1);
    console.log('\n✅ Result:\n', result1);
  } catch (error) {
    console.error('\n❌ Error:', error);
  }

  // Test 2: Quick Thinker with custom budget
  console.log('\n\n📊 Test 2: Quick Thinker (4000 tokens budget)');
  console.log('-'.repeat(60));

  const problem2 = `
Analyze this code for potential bugs:

\`\`\`typescript
function findMax(arr: number[]): number {
  let max = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > max) {
      max = arr[i];
    }
  }
  return max;
}
\`\`\`

What edge cases might cause issues?
`;

  try {
    const result2 = await system.execute('quick-thinker', problem2);
    console.log('\n✅ Result:\n', result2);
  } catch (error) {
    console.error('\n❌ Error:', error);
  }

  // Test 3: OpenRouter Reasoner (if OpenRouter is configured)
  if (process.env.OPENROUTER_API_KEY) {
    console.log('\n\n📊 Test 3: OpenRouter Reasoner (via OpenRouter)');
    console.log('-'.repeat(60));

    const problem3 = `
Design a simple caching strategy for a REST API.
Consider:
1. Cache invalidation approach
2. Storage mechanism
3. Key generation strategy

Provide a brief, well-reasoned recommendation.
`;

    try {
      const result3 = await system.execute('openrouter-reasoner', problem3);
      console.log('\n✅ Result:\n', result3);
    } catch (error) {
      console.error('\n❌ Error:', error);
    }
  } else {
    console.log('\n\n⏭️  Test 3: Skipped (OPENROUTER_API_KEY not set)');
  }

  console.log('\n\n' + '='.repeat(60));
  console.log('✅ Demo complete!');
  console.log('\nNote: Check the logs above for thinking metrics showing:');
  console.log('  - 🧠 Agent Thinking: The reasoning process');
  console.log('  - 📊 Thinking Metrics: Token usage for reasoning');
}

main().catch(console.error);
