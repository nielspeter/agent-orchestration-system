#!/usr/bin/env tsx
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { AgentSystemBuilder } from '../src/config/system-builder';

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function test() {
  console.log('Testing simple builder pattern setup...\n');

  // Clean, self-contained setup with example-specific agents
  const { executor, cleanup } = await new AgentSystemBuilder()
    .withModel('claude-3-5-haiku-latest')
    .withAgentsFrom(path.join(__dirname, '01-quickstart', 'agents'))
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
