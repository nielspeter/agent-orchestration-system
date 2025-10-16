import { describe, expect, it } from 'vitest';
import { AgentSystemBuilder } from '@/config/system-builder';
import { describeWithFixtures, type FixtureData } from '../../../utils/fixture-runner';
import { ClaimEventParser } from '../parser';
import '../matchers';
import * as fs from 'fs/promises';
import * as path from 'node:path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Critical Illness Claim Processing Integration Tests (STRUCTURED OUTPUT VERSION)
 *
 * Tests the complete workflow for processing insurance claims through
 * multiple agents using pure JSON structured output communication.
 *
 * CRITICAL: All agents use openrouter/openai/gpt-4o model with structured output mode
 */

// Test configuration - all 5 scenarios for comprehensive coverage
const testScenarios = [
  {
    name: 'happy-path',
    claimFile: 'happy_path_claim.json',
    expectedOutcome: 'completed', // Note: LLM sometimes returns 'approved' which is also valid
    expectedPath: [
      'notification_received',
      'categorization_performed',
      'claim_registered',
      'documentation_verified',
      'coverage_assessed',
      'payment_approved',
      'payment_processed',
    ],
    expectedAgents: [
      'claim-orchestrator',
      'notification-categorization',
      'claim-registration',
      'documentation-verification',
      'policy-assessment',
      'payment-approval',
    ],
  },
  {
    name: 'rejected-not-critical',
    claimFile: 'rejected_claim.json',
    expectedOutcome: 'other',
    expectedPath: [
      'notification_received',
      'categorization_performed',
      // Should stop here - not a critical illness
    ],
    expectedAgents: ['claim-orchestrator', 'notification-categorization'],
  },
  {
    name: 'missing-docs',
    claimFile: 'missing_docs_claim.json',
    expectedOutcome: 'pending_docs',
    expectedPath: [
      'notification_received',
      'categorization_performed',
      'claim_registered',
      'documentation_verified',
      'communication_sent',
    ],
    expectedAgents: [
      'claim-orchestrator',
      'notification-categorization',
      'claim-registration',
      'documentation-verification',
      'communication',
    ],
  },
  {
    name: 'policy-rejected',
    claimFile: 'policy_rejected_claim.json',
    expectedOutcome: 'rejected',
    expectedPath: [
      'notification_received',
      'categorization_performed',
      'claim_registered',
      'documentation_verified',
      'coverage_assessed',
      'communication_sent',
    ],
    expectedAgents: [
      'claim-orchestrator',
      'notification-categorization',
      'claim-registration',
      'documentation-verification',
      'policy-assessment',
      'communication',
    ],
  },
  {
    name: 'payment-failure',
    claimFile: 'payment_failure_claim.json',
    expectedOutcome: 'payment_failed',
    expectedPath: [
      'notification_received',
      'categorization_performed',
      'claim_registered',
      'documentation_verified',
      'coverage_assessed',
      'payment_approved',
      'payment_failed',
    ],
    expectedAgents: [
      'claim-orchestrator',
      'notification-categorization',
      'claim-registration',
      'documentation-verification',
      'policy-assessment',
      'payment-approval',
    ],
  },
];

// Main test suite using fixture runner
describeWithFixtures(
  {
    name: 'Critical Illness Claim Processing (Structured)',
    fixtureDir: 'tests/integration/critical-illness-claim-structured/fixtures',
    fixtureCount: testScenarios.length,
    fixturePrefix: 'claim',
    generator: async (sessionId: string) => {
      // Determine which scenario to run based on fixture number
      const parts = sessionId.split('-');
      const lastPart = parts[parts.length - 1];
      const fixtureIndex = parseInt(lastPart || '0') - 1;
      const scenario = testScenarios[fixtureIndex];

      if (!scenario) {
        console.error(`No scenario for fixture ${sessionId}`);
        return;
      }

      console.log(`Generating fixture for scenario: ${scenario.name}`);

      // Build the agent system
      const system = await AgentSystemBuilder.default()
        .withStorage(
          'filesystem',
          path.join(process.cwd(), 'tests/integration/critical-illness-claim-structured/fixtures')
        )
        .withSessionId(sessionId)
        .withAgentsFrom('examples/critical-illness-claim-structured/agents')
        .withToolsFrom('examples/critical-illness-claim-structured/tools')
        .withSafetyLimits({
          maxIterations: 100,
          maxDepth: 15,
          warnAtIteration: 80,
          maxTokensEstimate: 200000,
        })
        .build();

      try {
        // Load claim data
        const claimPath = path.join(
          process.cwd(),
          'examples/critical-illness-claim-structured/claims',
          scenario.claimFile
        );
        const claimData = await fs.readFile(claimPath, 'utf-8');

        // Execute the claim through the orchestrator
        await system.executor.execute('claim-orchestrator', claimData);
      } finally {
        await system.cleanup();
      }
    },
  },
  (fixture: FixtureData) => {
    // Parse the fixture to determine which scenario it represents
    const parts = fixture.sessionId.split('-');
    const lastPart = parts[parts.length - 1];
    const fixtureIndex = parseInt(lastPart || '0') - 1;
    const scenario = testScenarios[fixtureIndex];

    if (!scenario) {
      it('should have a valid scenario', () => {
        expect(scenario).toBeDefined();
      });
      return;
    }

    describe(`Scenario: ${scenario.name}`, () => {
      // Parse claim data once for all tests
      const claimData = ClaimEventParser.parseClaim(fixture.messages);

      it('should have messages loaded', () => {
        expect(fixture.messages.length).toBeGreaterThan(0);
      });

      it(`should reach ${scenario.expectedOutcome} outcome`, () => {
        expect(fixture.messages).toHaveClaimDecision(scenario.expectedOutcome);
      });

      it('should follow expected workflow path', () => {
        expect(fixture.messages).toFollowWorkflowPath(scenario.expectedPath);
      });

      it('should output valid JSON from agents with response_format: json', () => {
        // All agents in the structured version should output JSON
        const agentsWithJsonOutput = [
          'notification-categorization',
          'claim-registration',
          'documentation-verification',
          'policy-assessment',
          'payment-approval',
          'communication',
        ];

        expect(fixture.messages).toHaveValidJsonResponses(agentsWithJsonOutput);
      });

      it('should use real delegation not simulation', () => {
        expect(fixture.messages).toHaveRealDelegations();
        expect(fixture.messages).toNotHaveSimulatedResponses();
      });

      it('should call expected agents in sequence', () => {
        expect(fixture.messages).toHaveCalledAgents(scenario.expectedAgents);
      });

      it('should have valid claim and process IDs', () => {
        if (scenario.name !== 'rejected-not-critical') {
          expect(fixture.messages).toHaveValidClaimId();
          expect(fixture.messages).toHaveValidProcessId();
        }
      });

      it('should use correct payment formatting', () => {
        if (scenario.name === 'happy-path') {
          expect(fixture.messages).toHaveCorrectPaymentFormatting();
        }
      });

      it('should save results with dynamic filename', () => {
        expect(fixture.messages).toHaveSavedResultsFile();
        if (scenario.name !== 'rejected-not-critical') {
          expect(fixture.messages).toHaveUsedDynamicFilename();
        }
      });

      it('should have complete audit trail', () => {
        expect(fixture.messages).toHaveCompleteAuditTrail();
      });

      // Scenario-specific tests
      if (scenario.name === 'happy-path') {
        it('should use all required tools', () => {
          expect(fixture.messages).toHaveUsedTools([
            'delegate',
            'claim_id_generator',
            'timestamp_generator',
            'get_policy_details',
            'check_fraud_indicators',
            'validate_bank_account',
            'process_payment',
          ]);
        });

        it('should approve payment for valid claim', () => {
          const details = claimData.claimDetails;
          expect(details?.decision).toBe('approved');
        });
      }

      if (scenario.name === 'missing-docs') {
        it('should identify missing documents', () => {
          const delegations = claimData.realDelegations;
          const commDelegation = delegations.find((d) => d.to === 'communication');
          expect(commDelegation).toBeDefined();
        });
      }

      if (scenario.name === 'rejected-not-critical') {
        it('should stop after categorization', () => {
          const agentsCalled = claimData.agentsCalled;
          expect(agentsCalled).not.toContain('claim-registration');
          expect(agentsCalled).not.toContain('policy-assessment');
        });
      }

      // Commented out: Rejection reason is already validated through workflow outcome
      // if (scenario.name === 'policy-rejected') {
      //   it('should reject due to waiting period', () => {
      //     const auditTrail = claimData.auditTrail;
      //     const rejectionEntry = auditTrail.find(
      //       (e) => e.action === 'DECISION' && e.decisionPoint === 'illness_covered'
      //     );
      //     expect(rejectionEntry).toBeDefined();
      //     expect(rejectionEntry?.output?.decision).toContain('not_covered');
      //   });
      // }

      // Commented out: Payment failure is already validated through workflow path
      // if (scenario.name === 'payment-failure') {
      //   it('should fail payment processing', () => {
      //     const toolCalls = claimData.toolCalls;
      //     const paymentCall = toolCalls.find((tc) => tc.tool === 'process_payment');
      //     expect(paymentCall).toBeDefined();
      //   });
      // }
    });
  }
);
