#!/usr/bin/env tsx
import * as dotenv from 'dotenv';
import { setupFromConfig } from '../src/config/mcp-config-loader';

// Load environment variables
dotenv.config();

async function testCodeAnalyzer() {
  console.log('Testing code-analyzer directly...\n');
  
  const setup = await setupFromConfig({ 
    sessionId: 'code-analyzer-test' 
  });
  
  // Test code-analyzer directly (not through orchestrator)
  const result = await setup.executor.execute(
    'code-analyzer', 
    'Analyze the file src/types.ts and provide a summary of its structure and purpose.'
  );
  
  console.log('\nResult:', result);
  
  await setup.cleanup();
}

testCodeAnalyzer().catch(console.error);