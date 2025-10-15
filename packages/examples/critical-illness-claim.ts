#!/usr/bin/env npx tsx
/**
 * Critical Illness Claim Processing Example
 *
 * This example demonstrates a complex insurance claim workflow using:
 * - Agent orchestration for workflow management
 * - Script-based tools loaded from Python files
 * - Structured data processing with audit trails
 * - Decision points and routing logic
 */

import { AgentSystemBuilder } from '@agent-system/core';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: '../../.env' });

async function main() {
  console.log('🏥 Critical Illness Claim Processing System');
  console.log('==========================================\n');

  // Build the agent system with agents and tools from this example
  const builder = AgentSystemBuilder.default()
    .withAgentsFrom('critical-illness-claim/agents')
    .withToolsFrom('critical-illness-claim/tools')
    // Use default builtin tools which includes: read, write, list, task, todowrite
    .withSafetyLimits({
      maxIterations: 30, // Allow sufficient iterations for complex workflow
      maxDepth: 8, // Allow deeper delegation chains
      warnAtIteration: 20,
      maxTokensEstimate: 80000, // Higher token limit for detailed processing
    });

  const system = await builder.build();

  // Load claim notification data from JSON file
  const claimPath = path.join('critical-illness-claim/claims/happy_path_claim.json');
  const claimData = await fs.readFile(claimPath, 'utf-8');
  const claimNotification = JSON.parse(claimData);

  try {
    console.log('📋 Processing claim notification from file: happy_path_claim.json\n');
    console.log('Claim Details:');
    console.log(`- Notification ID: ${claimNotification.notification.id}`);
    console.log(`- Policy Number: ${claimNotification.notification.claimantInfo.policyNumber}`);
    console.log(`- Claimant: ${claimNotification.notification.claimantInfo.name}`);
    console.log(`- Type: ${claimNotification.notification.type}`);
    console.log(`- Documents: ${claimNotification.documents?.length || 0} files received\n`);

    // Process the claim through the orchestrator
    const result = await system.executor.execute(
      'claim-orchestrator',
      `Process this critical illness claim notification:

${JSON.stringify(claimNotification, null, 2)}`
    );

    console.log('\n✅ Claim Processing Complete!');
    console.log('================================');
    console.log(result);

    // The orchestrator should have saved results to the results directory
    console.log('\n📄 Results saved to: examples/critical-illness-claim/results/{claimId}.json');
    console.log(
      'Check the results directory for the claim-specific JSON file with complete audit trail.'
    );
  } catch (error) {
    console.error('❌ Processing error:', error);
  } finally {
    await system.cleanup();
  }
}

// Run the example
main().catch(console.error);
