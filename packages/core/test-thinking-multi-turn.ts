/**
 * Quick test to reproduce thinking multi-turn conversation issue
 */
import { AgentSystemBuilder } from './src/index';

async function test() {
  console.log('Testing multi-turn with thinking enabled...\n');

  const system = await AgentSystemBuilder.default()
    .with({
      agents: {
        agents: [
          {
            name: 'test-thinking',
            prompt: 'You are a test agent. Use the TodoWrite tool to create a simple todo list with 2 items, then respond with "Done".',
            tools: ['todowrite'],
            thinking: {
              enabled: true,
              budget_tokens: 4000,
            },
          },
        ],
      },
    })
    .withConsole({ verbosity: 'verbose' })
    .build();

  try {
    const result = await system.executor.execute(
      'test-thinking',
      'Create a simple todo list with 2 items: "Task 1" and "Task 2"'
    );
    console.log('\n✅ Result:', result);
  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await system.cleanup();
  }
}

test();
