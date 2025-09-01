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

import { AgentSystemBuilder } from '@/config/system-builder';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

async function main() {
  console.log('🏥 Critical Illness Claim Processing System');
  console.log('==========================================\n');

  // Build the agent system with agents and tools from this example
  const builder = AgentSystemBuilder.default()
    .withAgentsFrom('examples/09-critical-illness-claim/agents')
    .withToolsFrom('examples/09-critical-illness-claim/tools')
    .withBuiltinTools('read', 'write', 'shell') // Include shell for script execution
    .withSafetyLimits({
      maxIterations: 30, // Allow sufficient iterations for complex workflow
      maxDepth: 8, // Allow deeper delegation chains
      warnAtIteration: 20,
      maxTokensEstimate: 80000, // Higher token limit for detailed processing
    });

  const system = await builder.build();

  // Sample claim notification data
  const claimNotification = {
    notification: {
      id: 'NOTIF-2025-001',
      type: 'critical_illness_claim',
      content:
        'Patient diagnosed with stage 3 lung cancer, requesting claim under critical illness policy',
      timestamp: new Date().toISOString(),
      claimantInfo: {
        name: 'John Doe',
        policyNumber: 'POL-12345',
        contactInfo: 'john.doe@email.com, +1-555-0123',
      },
    },
  };

  try {
    console.log('📋 Processing claim notification...\n');
    console.log('Claim Details:');
    console.log(`- Notification ID: ${claimNotification.notification.id}`);
    console.log(`- Policy Number: ${claimNotification.notification.claimantInfo.policyNumber}`);
    console.log(`- Claimant: ${claimNotification.notification.claimantInfo.name}`);
    console.log(`- Type: ${claimNotification.notification.type}\n`);

    // Process the claim through the orchestrator
    const result = await system.executor.execute(
      'claim-orchestrator',
      `Process this critical illness claim notification and generate a complete audit trail:

${JSON.stringify(claimNotification, null, 2)}

Follow the complete workflow:
1. Acknowledge receipt
2. Categorize the notification
3. Register the claim if it's a critical illness
4. Verify documentation
5. Assess coverage
6. Process payment if approved
7. Save the final result to claim-results.json with complete audit trail

Important: Generate deterministic IDs and timestamps for testing consistency.`
    );

    console.log('\n✅ Claim Processing Complete!');
    console.log('================================');
    console.log(result);

    // The orchestrator should have saved results to claim-results.json
    console.log('\n📄 Results saved to: claim-results.json');
    console.log('Check the file for complete audit trail and processing details.');
  } catch (error) {
    console.error('❌ Processing error:', error);
  } finally {
    await system.cleanup();
  }
}

// Run the example
main().catch(console.error);
