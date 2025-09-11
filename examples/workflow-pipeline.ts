#!/usr/bin/env tsx
/**
 * Workflow Pipeline Example - Financial Transaction Processing
 *
 * This example demonstrates when you NEED orchestrated workflow vs autonomous agents.
 * Financial transactions require:
 * - Strict ordering of validation steps (regulatory requirement)
 * - Conditional execution based on previous results
 * - Complete audit trail of each decision
 * - Deterministic, predictable flow (no agent autonomy allowed)
 *
 * This CANNOT be done with autonomous agents because:
 * - Agents can't decide to skip compliance checks
 * - Order of operations is legally mandated
 * - Each step must explicitly log its decision for audit
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { AgentSystemBuilder } from '@/config';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface Transaction {
  id: string;
  from: string;
  to: string;
  amount: number;
  currency: string;
  timestamp: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  transactionId: string;
}

interface FraudResult {
  riskScore: number;
  flags: string[];
  proceed: boolean;
  reason?: string;
}

interface ComplianceResult {
  compliant: boolean;
  reportRequired: boolean;
  restrictions: string[];
}

interface ProcessingResult {
  status: 'executed' | 'rejected' | 'held';
  transactionId: string;
  auditLog: string[];
}

async function processTransaction(transaction: Transaction) {
  console.log('🏦 Financial Transaction Pipeline');
  console.log('='.repeat(50));
  console.log(`Processing transaction ${transaction.id}`);
  console.log(`From: ${transaction.from} → To: ${transaction.to}`);
  console.log(`Amount: ${transaction.amount} ${transaction.currency}`);
  console.log('='.repeat(50));

  // Create executor for the pipeline
  const { executor, cleanup } = await AgentSystemBuilder.minimal()
    .withModel('anthropic/claude-3-5-haiku-latest')
    .withAgentsFrom(path.join(__dirname, 'workflow-pipeline', 'agents'))
    .withConsole(false) // Disable console for clean output
    .withSessionId(`transaction-${transaction.id}`)
    .build();

  const auditLog: string[] = [];

  try {
    // STEP 1: Validation (MUST happen first - regulatory requirement)
    console.log('\n📋 Step 1: Validation');
    const validationPrompt = `
      Validate this financial transaction and return JSON:
      ${JSON.stringify(transaction, null, 2)}
      
      Check for:
      - Valid account numbers (must start with ACC)
      - Positive amount
      - Supported currency (USD, EUR, GBP)
      - Required fields present
      
      Return JSON: {"valid": boolean, "errors": [], "transactionId": "${transaction.id}"}
    `;

    const validationResult = await executor.execute('validator', validationPrompt);
    const validation: ValidationResult = JSON.parse(validationResult);

    auditLog.push(`VALIDATION: ${validation.valid ? 'PASSED' : 'FAILED'}`);
    console.log(`   Result: ${validation.valid ? '✅ Valid' : '❌ Invalid'}`);

    if (!validation.valid) {
      console.log(`   Errors: ${validation.errors.join(', ')}`);
      console.log('\n🚫 Transaction rejected at validation');
      return { status: 'rejected', reason: 'validation_failed', auditLog };
    }

    // STEP 2: Fraud Detection (ONLY if validation passed)
    console.log('\n🔍 Step 2: Fraud Detection');
    const fraudPrompt = `
      Analyze fraud risk for this validated transaction:
      ${JSON.stringify(transaction, null, 2)}
      
      Check for:
      - High amount (>5000 is medium risk, >20000 is high risk)
      - New account patterns (accounts ending in 9 are new)
      - Velocity (multiple transactions noted in ID)
      
      Return JSON: {"riskScore": 0-100, "flags": [], "proceed": boolean, "reason": "explanation"}
    `;

    const fraudResult = await executor.execute('fraud-detector', fraudPrompt);
    const fraud: FraudResult = JSON.parse(fraudResult);

    auditLog.push(`FRAUD_CHECK: Score=${fraud.riskScore}, Proceed=${fraud.proceed}`);
    console.log(`   Risk Score: ${fraud.riskScore}/100`);
    console.log(`   Decision: ${fraud.proceed ? '✅ Proceed' : '❌ Block'}`);

    if (!fraud.proceed) {
      console.log(`   Reason: ${fraud.reason}`);
      console.log('\n🚫 Transaction blocked by fraud detection');
      return { status: 'rejected', reason: 'fraud_detected', auditLog };
    }

    // STEP 3: Compliance Check (ONLY if fraud check passed)
    console.log('\n⚖️ Step 3: Compliance Check');
    const compliancePrompt = `
      Check AML/KYC compliance for transaction:
      ${JSON.stringify(transaction, null, 2)}
      
      With fraud assessment:
      Risk Score: ${fraud.riskScore}
      Flags: ${JSON.stringify(fraud.flags)}
      
      Check for:
      - Amount thresholds (>10000 requires reporting)
      - Sanctioned countries (accounts starting with ACC9)
      - PEP status (accounts ending in 99)
      
      Return JSON: {"compliant": boolean, "reportRequired": boolean, "restrictions": []}
    `;

    const complianceResult = await executor.execute('compliance-checker', compliancePrompt);
    const compliance: ComplianceResult = JSON.parse(complianceResult);

    auditLog.push(
      `COMPLIANCE: Compliant=${compliance.compliant}, Report=${compliance.reportRequired}`
    );
    console.log(`   Compliant: ${compliance.compliant ? '✅ Yes' : '❌ No'}`);
    console.log(`   Report Required: ${compliance.reportRequired ? '📄 Yes' : 'No'}`);

    if (!compliance.compliant) {
      console.log(`   Restrictions: ${compliance.restrictions.join(', ')}`);
      console.log('\n🚫 Transaction failed compliance check');
      return { status: 'rejected', reason: 'compliance_violation', auditLog };
    }

    // STEP 4: Process Transaction (deterministic based on all checks)
    console.log('\n💳 Step 4: Processing Transaction');
    const processingPrompt = `
      Execute this approved transaction:
      ${JSON.stringify(transaction, null, 2)}
      
      Validation: PASSED
      Fraud Score: ${fraud.riskScore}
      Compliance: ${compliance.compliant ? 'APPROVED' : 'FAILED'}
      Report Required: ${compliance.reportRequired}
      
      Create audit entry and confirmation.
      Return JSON: {"status": "executed", "transactionId": "${transaction.id}", "auditLog": ["entries"]}
    `;

    const processingResult = await executor.execute('transaction-processor', processingPrompt);
    const processing: ProcessingResult = JSON.parse(processingResult);

    auditLog.push(`PROCESSING: Status=${processing.status}`);
    auditLog.push(...processing.auditLog);

    console.log(`   Status: ✅ ${processing.status.toUpperCase()}`);
    console.log('\n🎉 Transaction successfully processed!');

    // Final audit log
    console.log('\n📝 Audit Trail:');
    auditLog.forEach((entry) => console.log(`   ${entry}`));

    return { status: processing.status, auditLog };
  } finally {
    await cleanup();
  }
}

// Test with different scenarios
async function runExamples() {
  console.log('🚀 Starting Financial Transaction Pipeline Examples\n');

  // Scenario 1: Valid transaction
  const validTransaction: Transaction = {
    id: 'TXN-001',
    from: 'ACC123456',
    to: 'ACC789012',
    amount: 2500,
    currency: 'USD',
    timestamp: new Date().toISOString(),
  };

  // Scenario 2: High-risk transaction (will require reporting)
  const highRiskTransaction: Transaction = {
    id: 'TXN-002',
    from: 'ACC100001',
    to: 'ACC999999', // New account (ends in 9), PEP account (ends in 99)
    amount: 15000, // Over reporting threshold
    currency: 'USD',
    timestamp: new Date().toISOString(),
  };

  // Scenario 3: Invalid transaction (will fail validation)
  const invalidTransaction: Transaction = {
    id: 'TXN-003',
    from: 'INVALID',
    to: 'ACC456789',
    amount: -100, // Negative amount
    currency: 'BTC', // Unsupported currency
    timestamp: new Date().toISOString(),
  };

  // Process each transaction
  console.log('Example 1: Standard Transaction');
  console.log('-'.repeat(50));
  await processTransaction(validTransaction);

  console.log('\n\nExample 2: High-Risk Transaction');
  console.log('-'.repeat(50));
  await processTransaction(highRiskTransaction);

  console.log('\n\nExample 3: Invalid Transaction');
  console.log('-'.repeat(50));
  await processTransaction(invalidTransaction);
}

// Run the examples
runExamples().catch(console.error);
