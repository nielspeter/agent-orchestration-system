#!/usr/bin/env tsx
/**
 * Inline Agent Definition Example
 *
 * Shows how to define agents directly in code instead of loading from files.
 * Perfect for quick prototyping and self-contained examples.
 */

import * as dotenv from 'dotenv';
import { AgentSystemBuilder } from '@agent-system/core';
import type { Agent } from '@agent-system/core';

dotenv.config({ path: '../../.env' });

async function main() {
  console.log('🤖 Inline Agent Example');
  console.log('='.repeat(50));

  // Define a simple agent directly in code
  const calculator: Agent = {
    name: 'calculator',
    prompt: `You are a helpful calculator. 
    When asked to perform calculations, work through them step by step.
    Be precise and explain your reasoning.`,
    tools: [], // No tools needed for simple calculations
  };

  // Define another agent that can list files
  const explorer: Agent = {
    name: 'explorer',
    prompt: `You are a file explorer.
    Your job is to help users understand the project structure.
    Use the List tool to explore directories.`,
    tools: ['List'],
  };

  // Build the system with inline agents
  const { executor, cleanup } = await AgentSystemBuilder.minimal()
    .withAgents(calculator, explorer)
    .withDefaultTools()
    .withConsole(false) // Clean output
    .withSessionId('inline-demo')
    .build();

  // Example 1: Use the calculator
  console.log('\n📐 Calculator Example:');
  const result1 = await executor.execute('calculator', 'What is 15% of 280?');
  console.log('Result:', result1);

  // Example 2: Use the explorer
  console.log('\n📁 Explorer Example:');
  const result2 = await executor.execute('explorer', 'What files are in the examples directory?');
  console.log('Result:', result2);

  await cleanup();
}

main().catch(console.error);
