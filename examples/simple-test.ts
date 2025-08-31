#!/usr/bin/env tsx
import * as dotenv from 'dotenv';
import { setupFromConfig } from '../src/config/mcp-config-loader';

// Load environment variables
dotenv.config();

async function test() {
  console.log('Testing simple config-based setup...\n');
  
  const setup = await setupFromConfig({ 
    sessionId: 'simple-test' 
  });
  
  console.log('Setup complete. Testing with simple task...\n');
  
  const result = await setup.executor.execute(
    'orchestrator', 
    'List the files in the src directory'
  );
  
  console.log('\nResult:', result);
  
  await setup.cleanup();
  console.log('\nCleanup complete.');
}

test().catch(console.error);