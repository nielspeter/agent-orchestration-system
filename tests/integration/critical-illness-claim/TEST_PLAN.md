# Critical Illness Claim Processing - Integration Test Plan

## Overview
This document outlines the comprehensive test plan for the critical illness claim processing workflow. The tests verify that the multi-agent system correctly processes various claim scenarios through the complete workflow pipeline.

## Critical Requirements

### 🚨 MUST Verify Real Delegation (NOT Simulation)
**Problem:** Some LLM models (especially Claude) may simulate agent responses instead of actually delegating via the Task tool, pretending to be sub-agents and generating mock responses.

**Solution:** 
1. Configure all agents to use `openrouter/openai/gpt-4o` model (more reliable for tool use)
2. Verify delegation events in JSONL:
   - Look for `type: "tool_call"` with `tool: "Task"`
   - Verify `type: "delegation"` events with parent/child agents
   - Check for `agent_start` and `agent_end` events for each agent
   - Ensure NO simulated responses like "The categorization agent responds..."

**Anti-patterns to detect (indicates simulation):**
```json
// BAD - Simulated response (agent pretending to be another agent)
{
  "type": "assistant",
  "data": {
    "content": "The notification-categorization agent responds: {\"category\": \"critical_illness\"...}"
  }
}

// BAD - Mock response generation
{
  "type": "assistant", 
  "data": {
    "content": "Based on the notification, I'll categorize this as a critical illness claim..."
  }
}

// GOOD - Real delegation via Task tool
{
  "type": "tool_call",
  "data": {
    "tool": "Task",
    "params": {
      "subagent_type": "notification-categorization",
      "prompt": "Process this notification: {full JSON data}"
    }
  }
}

// GOOD - Delegation event tracking
{
  "type": "delegation",
  "data": {
    "parent": "claim-orchestrator",
    "child": "notification-categorization",
    "task": "categorize notification"
  }
}
```

### 🚨 MUST Pass Full JSON Data
**Problem:** Orchestrator might send summaries like "Jane Smith has cancer" instead of full JSON.

**Verification:**
- Task tool prompts must contain complete JSON structures
- Sub-agents will ERROR if they receive plain text instead of JSON
- This is a good thing - it proves real delegation is happening

### 🚨 MUST Use Dynamic Result Filenames
**Problem:** Fixed filename `claim-results.json` causes overwrites and test conflicts.

**Solution:**
- Each claim saves to unique file: `results/{claimId}.json`
- Example: `results/CI-20250113-1D5C8.json`
- Prevents overwrites and allows parallel testing

**Verification:**
- Write tool call must use claimId in filename
- File must exist at expected path after execution
- Filename must match claimId from workflow

## System Architecture Under Test

### Agent Hierarchy & Tool Usage
```
claim-orchestrator (main controller)
  Tools: Task, claim_id_generator, timestamp_generator, Write
  ├── notification-categorization (determines claim type)
  │   Tools: NONE
  ├── claim-registration (creates claim ID)
  │   Tools: claim_id_generator, timestamp_generator
  ├── documentation-verification (checks documents)
  │   Tools: get_policy_details
  ├── policy-assessment (verifies coverage)
  │   Tools: get_policy_details, check_fraud_indicators
  ├── payment-approval (approves payment)
  │   Tools: validate_bank_account, check_fraud_indicators, process_payment
  └── communication (sends notifications)
      Tools: send_notification
```

### Workflow Decision Tree with Exact Branching Logic
```
START → Receive Notification
   ↓
[1] notification-categorization
    Decision: Is Critical Illness?
    ├─ NO (hypertension, general inquiry) → End with outcome: "other"
    └─ YES (cancer, stroke, etc.) → Continue
           ↓
[2] claim-registration
    Generate: claim_id (CI-YYYYMMDD-XXXXX)
    Always succeeds if input valid
           ↓
[3] documentation-verification  
    Decision: Documentation Complete?
    ├─ NO (status: "pending") → communication → End: "pending_docs"
    └─ YES (all status: "received") → Continue
           ↓
[4] policy-assessment
    Decision: Illness Covered & Waiting Period Met?
    ├─ NO → communication → End: "rejected"
    │   - Waiting period < 90 days
    │   - Condition not in covered list
    │   - Policy not active
    └─ YES → Continue
           ↓
[5] payment-approval
    Decision: Payment Approved & Processed?
    ├─ NO (bank validation fails) → End: "payment_failed"
    └─ YES → End: "completed"
```

## Detailed Test Scenarios with Expected Behavior

### 1. Happy Path Claim (happy_path_claim.json)
**Input Characteristics:**
- Type: "critical_illness_claim"
- Condition: Breast cancer (stage 2)
- Policy: POL-54321 (active, premiums paid)
- Documents: All 8 required documents with status "received"
- Bank: Valid account details

**Expected Agent Sequence:**
1. claim-orchestrator → notification-categorization
2. claim-orchestrator → claim-registration
3. claim-orchestrator → documentation-verification
4. claim-orchestrator → policy-assessment
5. claim-orchestrator → payment-approval

**Tool Calls Expected:**
- claim_id_generator (2x - by orchestrator and registration)
- timestamp_generator (2x - by orchestrator and registration)
- get_policy_details (2x - by doc verification and assessment)
- check_fraud_indicators (2x - by assessment and payment)
- validate_bank_account (1x - by payment)
- process_payment (1x - by payment)
- Write (1x - save results)

**Verification Points:**
- workflowPath: `["notification_received", "categorization_performed", "claim_registered", "documentation_verified", "coverage_assessed", "payment_approved", "payment_processed"]`
- finalOutcome: `"completed"`
- Payment amount: 54421000 in JSON, "54,421,000 USD" in notes
- NO currency symbols ($)

### 2. Missing Documentation (missing_docs_claim.json)
**Input Characteristics:**
- Type: "critical_illness_claim"
- Condition: Stroke
- Documents: 3 with status "pending" (CT_scan, neurologist_assessment, rehabilitation_plan)

**Expected Agent Sequence:**
1. claim-orchestrator → notification-categorization (YES)
2. claim-orchestrator → claim-registration
3. claim-orchestrator → documentation-verification (NO - missing docs)
4. claim-orchestrator → communication

**Stops After:** Documentation verification
**Does NOT Call:** policy-assessment, payment-approval

**Verification Points:**
- workflowPath ends with: `"communication_sent"`
- finalOutcome: `"pending_docs"`
- Notes should list specific missing documents

### 3. Non-Critical Illness (rejected_claim.json)
**Input Characteristics:**
- Type: "health_claim" (not critical_illness_claim)
- Condition: Hypertension (not a critical illness)

**Expected Agent Sequence:**
1. claim-orchestrator → notification-categorization (NO - not critical)

**Stops After:** Categorization
**Does NOT Call:** Any other agents

**Verification Points:**
- workflowPath: `["notification_received", "categorization_performed"]`
- finalOutcome: `"other"`
- No claim ID generated
- Reason: "not a critical illness"

### 4. Policy Rejection - Waiting Period (policy_rejected_claim.json)
**Input Characteristics:**
- Policy: POL-99999 (special test case - 30 days old)
- Condition: Heart attack (normally covered)
- Documents: Complete

**Expected Agent Sequence:**
1. claim-orchestrator → notification-categorization (YES)
2. claim-orchestrator → claim-registration
3. claim-orchestrator → documentation-verification (YES)
4. claim-orchestrator → policy-assessment (NO - waiting period)
5. claim-orchestrator → communication

**Key Rule:** Policy POL-99999 returns start date 30 days ago (< 90 day waiting period)

**Verification Points:**
- workflowPath includes: `"coverage_assessed"` but NOT `"payment_approved"`
- finalOutcome: `"rejected"`
- Rejection reason mentions waiting period (90 days)

### 5. Payment Failure (payment_failure_claim.json)
**Input Characteristics:**
- Condition: Valid critical illness
- Documents: Complete
- Bank: Account number "INVALID" or bankName "Failed Transaction Bank"

**Expected Agent Sequence:**
1. claim-orchestrator → notification-categorization (YES)
2. claim-orchestrator → claim-registration
3. claim-orchestrator → documentation-verification (YES)
4. claim-orchestrator → policy-assessment (YES)
5. claim-orchestrator → payment-approval (processes but payment fails)

**Payment Failure Triggers:**
- accountNumber == "INVALID"
- bankName == "Failed Transaction Bank"
- triggerFailure == true

**Verification Points:**
- workflowPath includes: `"payment_approved"` but NOT `"payment_processed"`
- finalOutcome: `"payment_failed"`
- Audit trail shows payment failure reason

## Critical Data Validation Rules

### 1. ID Generation Rules
- **ProcessId:** `PROC-[8 hex chars]` (e.g., PROC-DE20A37E)
- **ClaimId:** `CI-YYYYMMDD-[5 hex chars]` (e.g., CI-20250113-1D5C8)
- **MessageId:** Generated by communication agent
- Must be unique per execution

### 2. Payment Formatting Rules
**In JSON fields:**
- Plain number: `54421000`
- No formatting, no currency

**In notes/messages:**
- Formatted: `"54,421,000 USD"`
- NEVER use symbols: No $, €, £
- Always use 3-letter currency codes

### 3. Coverage Calculation Rules
By condition type:
- Cancer, Heart Attack, Stroke: 100% of sum assured
- Parkinson's, Alzheimer's: 75% of sum assured
- All others in covered list: 100%

### 4. Document Requirements
**Cancer:** pathology results, oncologist statement, treatment plan
**Stroke:** CT/MRI scan, neurologist assessment, rehabilitation plan
**Heart Attack:** ECG/EKG, cardiac enzymes, cardiologist statement
**All Claims:** claim form, ID proof, policy document

### 5. Input Validation by Agents
Each agent MUST validate JSON input and will return error if:
- Not valid JSON
- Missing required fields
- Wrong structure

**Error Response Format:**
```json
{
  "error": true,
  "message": "Invalid input format...",
  "receivedInput": "<summary of what was received>"
}
```

## Tool Interactions to Verify

### Python Script Tools - Call Patterns
1. **claim_id_generator**
   - Called by: claim-registration, claim-orchestrator
   - Verify: Format CI-YYYYMMDD-XXXXX

2. **timestamp_generator**
   - Called by: claim-orchestrator, claim-registration
   - Verify: ISO 8601 with microseconds

3. **get_policy_details**
   - Called by: documentation-verification, policy-assessment
   - Special: POL-99999 returns 30-day old policy

4. **check_fraud_indicators**
   - Called by: policy-assessment, payment-approval
   - Returns: risk score 0.0-1.0

5. **validate_bank_account**
   - Called by: payment-approval
   - Validates: account_number length >= 8

6. **process_payment**
   - Called by: payment-approval
   - Fails if: account "INVALID" or bank "Failed Transaction Bank"

7. **send_notification**
   - Called by: communication
   - Types: acknowledgment, document_request, rejection, approval

## Audit Trail Requirements

### Required Entry Types
```json
{
  "sequence": 1-N,
  "timestamp": "ISO string",
  "agent": "agent-name",
  "action": "WORKFLOW_START|DELEGATE|DECISION|TOOL_USE|WORKFLOW_END",
  "target": "target-agent (for DELEGATE)",
  "decisionPoint": "decision-name (for DECISION)",
  "tool": "tool-name (for TOOL_USE)",
  "input": {}, // Full data
  "output": {}, // Full response
  "reasoning": "explanation"
}
```

### Expected Audit Entries by Scenario
- **Happy Path:** 15-20 entries (all agents, all tools)
- **Missing Docs:** 8-10 entries (stops early)
- **Non-Critical:** 3-4 entries (minimal flow)
- **Policy Rejected:** 12-14 entries (no payment)
- **Payment Failed:** 17-19 entries (full flow, payment fails)

## Parser Functions Required

```typescript
// Core workflow extraction
extractWorkflowPath(messages): string[]
extractFinalOutcome(messages): string
extractAuditTrail(messages): AuditEntry[]

// Agent verification - CRITICAL
extractRealDelegations(messages): Delegation[]
detectSimulatedResponses(messages): SimulatedResponse[]
verifyAgentCalls(messages): AgentCall[]

// Tool verification
extractToolCalls(messages): ToolCall[]
verifyToolParameters(messages): ParameterValidation[]

// Data extraction
extractClaimDetails(messages): ClaimDetails
extractPaymentInfo(messages): PaymentInfo
extractResultsFilename(messages): string // e.g., "CI-20250113-1D5C8.json"
verifyResultsFileExists(messages): boolean
```

## Custom Matchers Required

```typescript
// CRITICAL - Verify real delegation
expect(messages).toHaveRealDelegations();
expect(messages).toNotHaveSimulatedResponses();

// Workflow verification
expect(messages).toHaveClaimDecision('completed');
expect(messages).toFollowWorkflowPath(expectedPath);

// Agent call verification
expect(messages).toHaveCalledAgents([
  'claim-orchestrator',
  'notification-categorization',
  // ... in order
]);

// Tool usage verification
expect(messages).toHaveUsedTools([
  'claim_id_generator',
  'get_policy_details',
  // ...
]);

// Data validation
expect(messages).toHaveValidClaimId(); // CI-YYYYMMDD-XXXXX
expect(messages).toHaveValidProcessId(); // PROC-XXXXXXXX
expect(messages).toHaveCorrectPaymentFormatting(); // 54,421,000 USD

// Result verification
expect(messages).toHaveSavedResultsFile(); // Verifies Write tool was called
expect(messages).toHaveUsedDynamicFilename(); // Verifies filename contains claimId
expect(messages).toHaveCompleteAuditTrail();
```

## Three-Level Testing Strategy

### Testing Pyramid
```
Level 3: Workflow Tests (End-to-End)
    ├── Full claim processing flows
    ├── Real agent delegation
    └── Complete audit trails

Level 2: Agent Tests (Business Logic)  
    ├── Individual agent behavior
    ├── Decision making
    └── Tool selection

Level 1: Tool Tests (Foundation)
    ├── Python script execution
    ├── Special cases (POL-99999)
    └── Failure triggers
```

### Test Directory Structure
```
tests/integration/critical-illness-claim/
├── tools/                          # Level 1: Tool Tests
│   ├── claim-id-generator.test.ts
│   ├── timestamp-generator.test.ts
│   ├── get-policy-details.test.ts
│   ├── check-fraud-indicators.test.ts
│   ├── validate-bank-account.test.ts
│   ├── process-payment.test.ts
│   └── send-notification.test.ts
├── agents/                         # Level 2: Agent Tests
│   ├── notification-categorization.test.ts
│   ├── claim-registration.test.ts
│   ├── documentation-verification.test.ts
│   ├── policy-assessment.test.ts
│   ├── payment-approval.test.ts
│   ├── communication.test.ts
│   └── claim-orchestrator.test.ts
├── workflows/                      # Level 3: Workflow Tests
│   ├── happy-path.test.ts
│   ├── missing-docs.test.ts
│   ├── non-critical.test.ts
│   ├── policy-rejected.test.ts
│   └── payment-failure.test.ts
└── shared/
    ├── parser.ts
    ├── matchers.ts
    ├── test-data.ts
    └── tool-executor.ts
```

## Level 1: Tool Tests (No LLM Calls)

### Tool Test Implementation
```typescript
// Direct Python script testing using ToolRegistry
import { ToolRegistry } from '@/tools';
import { ScriptToolLoader } from '@/tools/registry/loader';

describe('Tool: get_policy_details', () => {
  let tool: Tool;
  
  beforeAll(async () => {
    const loader = new ScriptToolLoader();
    tool = await loader.loadFromFile('examples/critical-illness-claim/tools/get_policy_details.py');
  });

  it('should return 30-day old policy for POL-99999', async () => {
    const result = await tool.execute({ policy_number: 'POL-99999' });
    const policy = JSON.parse(result.content);
    
    const daysSinceStart = calculateDaysSince(policy.coverageStartDate);
    expect(daysSinceStart).toBeLessThan(90); // Fails waiting period
    expect(policy.waitingPeriod).toBe(90);
  });

  it('should return valid policy for POL-54321', async () => {
    const result = await tool.execute({ policy_number: 'POL-54321' });
    const policy = JSON.parse(result.content);
    
    expect(policy.status).toBe('active');
    expect(policy.coveredConditions).toContain('Cancer');
  });
});
```

### Tool Test Cases

#### claim_id_generator
- ✅ Format matches `CI-YYYYMMDD-[5 hex]`
- ✅ Date component is current date
- ✅ Hex suffix is exactly 5 characters
- ✅ Multiple calls generate unique IDs

#### get_policy_details
- ✅ POL-99999 → coverageStartDate < 90 days ago
- ✅ POL-54321 → coverageStartDate > 90 days ago
- ✅ sumAssured calculation: 100000 + (seed * 1000)
- ✅ coveredConditions includes all 10 critical illnesses
- ✅ waitingPeriod is always 90 days

#### process_payment
- ✅ Valid account → status: "completed", transactionId generated
- ✅ accountNumber: "INVALID" → status: "failed", errorCode: "PAYMENT_FAILED"
- ✅ bankName: "Failed Transaction Bank" → status: "failed"
- ✅ triggerFailure: true → status: "failed"
- ✅ Transaction reference format: `PAY-[timestamp]-[claimId]`

#### validate_bank_account
- ✅ accountNumber.length < 8 → valid: false
- ✅ accountNumber.length >= 8 → valid: true
- ✅ accountName empty → valid: false
- ✅ Returns bankName: "Mock National Bank"

## Level 2: Agent Tests (Single LLM Call)

### Agent Test Implementation
```typescript
describe('Agent: notification-categorization', () => {
  let system: AgentSystem;
  
  beforeAll(async () => {
    system = await AgentSystemBuilder
      .forTest()
      .withAgent('notification-categorization')
      .build();
  });

  it('should categorize cancer as critical illness', async () => {
    const input = {
      notification: {
        type: "critical_illness_claim",
        content: "diagnosed with breast cancer",
        claimantInfo: { name: "Test", policyNumber: "POL-123" }
      }
    };
    
    const result = await system.executor.execute(
      'notification-categorization',
      JSON.stringify(input)
    );
    
    const response = JSON.parse(result);
    expect(response.isCriticalIllness).toBe(true);
    expect(response.identifiedCondition).toContain('cancer');
  });

  it('should return error on invalid JSON', async () => {
    const result = await system.executor.execute(
      'notification-categorization',
      'This is not JSON'
    );
    
    const response = JSON.parse(result);
    expect(response.error).toBe(true);
    expect(response.message).toContain('Invalid input format');
  });
});
```

### Agent Test Cases

#### notification-categorization
- ✅ Cancer → isCriticalIllness: true
- ✅ Hypertension → isCriticalIllness: false
- ✅ Invalid JSON → returns error response
- ✅ Missing fields → returns error response

#### claim-registration
- ✅ Valid input → generates claimId (CI-format)
- ✅ Uses claim_id_generator tool
- ✅ Uses timestamp_generator tool
- ✅ Invalid input → registrationSuccess: false

#### policy-assessment
- ✅ POL-99999 + recent diagnosis → coverageDecision: "not_covered" (waiting period)
- ✅ POL-54321 + cancer → coverageDecision: "covered"
- ✅ Hypertension → coverageDecision: "not_covered" (not in list)
- ✅ Uses get_policy_details tool
- ✅ Uses check_fraud_indicators tool

#### payment-approval
- ✅ Cancer → paymentAmount: 100% of sumAssured
- ✅ Parkinson's → paymentAmount: 75% of sumAssured
- ✅ Invalid bank → paymentApproved: false
- ✅ Format in notes: "54,421,000 USD" not "$54,421,000"
- ✅ Uses validate_bank_account, process_payment tools

## Level 3: Workflow Tests (Multiple LLM Calls)

### Workflow Test Implementation
```typescript
describe('Workflow: Happy Path', () => {
  let system: AgentSystem;
  let fixture: FixtureData;
  
  beforeAll(async () => {
    // Use fixture runner for deterministic tests
    fixture = await loadOrGenerateFixture('happy-path', async () => {
      system = await AgentSystemBuilder
        .default()
        .withAgentsFrom('examples/critical-illness-claim/agents')
        .withToolsFrom('examples/critical-illness-claim/tools')
        .build();
      
      const claimData = await fs.readFile('claims/happy_path_claim.json');
      await system.executor.execute('claim-orchestrator', claimData);
    });
  });

  it('should complete full workflow', () => {
    expect(fixture.messages).toHaveClaimDecision('completed');
    expect(fixture.messages).toFollowWorkflowPath([
      'notification_received',
      'categorization_performed',
      'claim_registered',
      'documentation_verified',
      'coverage_assessed',
      'payment_approved',
      'payment_processed'
    ]);
  });

  it('should use real delegation not simulation', () => {
    expect(fixture.messages).toHaveRealDelegations();
    expect(fixture.messages).toNotHaveSimulatedResponses();
  });

  it('should call all expected agents', () => {
    expect(fixture.messages).toHaveCalledAgents([
      'claim-orchestrator',
      'notification-categorization',
      'claim-registration',
      'documentation-verification',
      'policy-assessment',
      'payment-approval'
    ]);
  });

  it('should save results with dynamic filename', () => {
    const claimId = extractClaimId(fixture.messages);
    const writeCall = extractWriteToolCall(fixture.messages);
    
    expect(writeCall.file_path).toBe(
      `examples/critical-illness-claim/results/${claimId}.json`
    );
    
    // Verify file actually exists
    const filePath = path.join(process.cwd(), writeCall.file_path);
    expect(fs.existsSync(filePath)).toBe(true);
  });
});
```

## Test Implementation Checklist

### Level 1: Tool Tests
- [ ] Setup tool test directory
- [ ] Create tool executor helper
- [ ] Test claim_id_generator format
- [ ] Test get_policy_details special cases
- [ ] Test process_payment failure triggers
- [ ] Test validate_bank_account validation
- [ ] Test all 7 Python tools

### Level 2: Agent Tests  
- [ ] Setup agent test directory
- [ ] Configure agents with openrouter/openai/gpt-4o
- [ ] Test each agent's input validation
- [ ] Test each agent's decision logic
- [ ] Test each agent's tool usage
- [ ] Test error responses
- [ ] Test all 7 agents

### Level 3: Workflow Tests
- [ ] Setup workflow test directory
- [ ] Configure fixture runner
- [ ] Test happy path flow
- [ ] Test missing docs flow
- [ ] Test non-critical flow
- [ ] Test policy rejected flow
- [ ] Test payment failure flow
- [ ] Verify no simulation
- [ ] Verify audit trails

### Verification Points
- [ ] Tools work independently (Level 1)
- [ ] Agents make correct decisions (Level 2)
- [ ] Workflows delegate properly (Level 3)
- [ ] No simulated responses at any level
- [ ] Correct data formatting throughout
- [ ] Complete audit trails in workflows

## Common Failure Patterns to Watch For

### 1. Simulation Instead of Delegation
**Symptom:** Test passes but no real agents called
**Detection:** No tool_call events with Task tool
**Fix:** Change model to openrouter/openai/gpt-4o

### 2. Summary Instead of JSON
**Symptom:** Sub-agents return errors about invalid input
**Detection:** Task prompts contain text like "Jane has cancer"
**Fix:** Ensure orchestrator passes full JSON

### 3. Missing Audit Entries
**Symptom:** Incomplete audit trail
**Detection:** Missing DELEGATE or TOOL_USE entries
**Fix:** Verify orchestrator captures all events

### 4. Wrong Payment Format
**Symptom:** Currency symbols in output
**Detection:** "$54,421,000" instead of "54,421,000 USD"
**Fix:** Enforce formatting rules in agents

### 5. Policy Rules Not Applied
**Symptom:** Claims approved that should fail
**Detection:** POL-99999 not rejected for waiting period
**Fix:** Verify get_policy_details returns correct dates

### 6. Fixed Filename Overwrites
**Symptom:** Results overwrite each other, tests fail randomly
**Detection:** All claims save to same `claim-results.json`
**Fix:** Use dynamic filename with claimId: `results/{claimId}.json`

## Success Criteria

### All Tests Must:
1. ✅ Use real agent delegation (no simulation)
2. ✅ Pass complete JSON between agents
3. ✅ Follow correct workflow paths
4. ✅ Use tools with proper parameters
5. ✅ Generate valid IDs (claim, process)
6. ✅ Format payments correctly
7. ✅ Save results to JSON file
8. ✅ Create complete audit trails
9. ✅ Handle all 5 test scenarios
10. ✅ Complete without API errors

### Performance Targets:
- Fixture generation: < 30s per scenario
- Fixture replay: < 500ms per test
- Total test suite: < 2s with fixtures
- No flaky tests (100% deterministic with fixtures)