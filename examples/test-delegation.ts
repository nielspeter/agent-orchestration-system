#!/usr/bin/env tsx
import * as dotenv from 'dotenv';
import { setupFromConfig } from '../src/config/mcp-config-loader';

// Load environment variables
dotenv.config();

async function testDelegation() {
  console.log('Testing delegation fix...\n');
  
  const setup = await setupFromConfig({ 
    sessionId: 'delegation-test' 
  });
  
  // Simple delegation test
  const result = await setup.executor.execute(
    'orchestrator', 
    'Use the Task tool to delegate to code-analyzer to analyze the file src/types.ts'
  );
  
  console.log('\nResult:', result);
  
  await setup.cleanup();
}

testDelegation().catch(console.error);