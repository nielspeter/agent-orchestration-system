#!/usr/bin/env tsx
/**
 * Default Agent Example - Demonstrates fallback and explicit usage
 *
 * This example shows how the default agent works:
 * 1. As a fallback when an agent doesn't exist
 * 2. When explicitly called for general tasks
 */

import * as dotenv from 'dotenv';
import { AgentSystemBuilder } from '../src';

// Load environment variables from .env file
dotenv.config();

async function main() {
  console.log('🤖 Default Agent Example\n');

  try {
    // Build system with default configuration
    // No agents directory specified - only default agent available
    const builder = AgentSystemBuilder.default(); // Includes default agent and tools

    const { executor, toolRegistry, cleanup } = await builder.build();

    console.log(
      'Available tools:',
      toolRegistry
        .getAllTools()
        .map((t) => t.name)
        .join(', ')
    );
    console.log();

    // Demo 1: Explicit use of default agent
    console.log('=== Demo 1: Explicit Default Agent Usage ===\n');

    const result1 = await executor.execute(
      'default', // Explicitly use default agent
      'Generate a greeting message and explain what you are. Just return the text, do not write any files.'
    );

    console.log('Result:', result1);
    console.log();

    // Demo 2: Fallback when agent doesn't exist
    console.log('=== Demo 2: Fallback to Default Agent ===\n');
    console.log('Attempting to use non-existent "analyzer" agent...\n');

    const result2 = await executor.execute(
      'analyzer', // This agent doesn't existReturn your response as text only.
      'Tell me what agent you are and how you were invoked. Just return the text, do not write any files.'
    );

    console.log('Result:', result2);
    console.log();

    // Demo 3: Task delegation to default
    console.log('=== Demo 3: Task Delegation to Default ===\n');

    // Create a simple orchestrator agent
    const orchestrator = await executor.execute(
      'default',
      `You have the Task tool. Delegate this to the 'helper' agent (which doesn't exist):
       "Create a list of 3 programming languages and their main use cases"
       
       Return the result you receive from the delegation.`
    );

    console.log('Result:', orchestrator);

    await cleanup();
    console.log('\n✅ Done');
  } catch (error) {
    console.error('Error:', error);
  }
}

main().catch(console.error);
