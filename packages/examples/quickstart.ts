#!/usr/bin/env tsx
import * as dotenv from 'dotenv';
import { AgentSystemBuilder } from '@agent-system/core';

// Load environment variables
dotenv.config({ path: '../../.env' });

async function test() {
  console.log('Testing simple builder pattern setup...\n');

  // Clean, self-contained setup with example-specific agents
  const { executor, cleanup } = await new AgentSystemBuilder()
    .withModel('openrouter/openai/gpt-oss-20b')
    .withAgentsFrom('quickstart/agents')
    .withDefaultTools() // read, write, list
    .withSessionId('simple-test')
    .build();

  console.log('Setup complete. Testing with simple task...\n');

  const result = await executor.execute('orchestrator', 'List the files in the src directory');

  console.log('\nResult:', result);

  // Clean up
  await cleanup();
}

test().catch(console.error);
