# Critical Illness Claim Test Coverage Plan

## Current State Analysis

### Available Test Scenarios
We have 5 distinct test scenarios available in `examples/critical-illness-claim/claims/`:

| Scenario | File | Status | Purpose |
|----------|------|--------|---------|
| Happy Path | `happy_path_claim.json` | ✅ Implemented | Tests complete successful workflow |
| Missing Documents | `missing_docs_claim.json` | ❌ Not Implemented | Tests documentation validation branch |
| Policy Rejected | `policy_rejected_claim.json` | ❌ Not Implemented | Tests waiting period violation |
| Not Critical Illness | `rejected_claim.json` | ❌ Not Implemented | Tests non-critical illness (hypertension) |
| Payment Failure | `payment_failure_claim.json` | ❌ Not Implemented | Tests payment processing failure |

**Current Coverage: 20% (1/5 scenarios)**

## Testing Strategy Comparison

### Werewolf Game (Creative/Non-deterministic)
- Runs 5 **instances** of the same scenario
- Each run produces different outcomes
- Tests **consistency** and **creativity** of agent behavior
- Validates game mechanics work regardless of outcome

### Critical Illness (Deterministic Workflow)
- Should run 5 **different scenarios**, not 5 instances
- Each scenario tests a **specific branch** of the workflow
- Tests **error handling**, **validation**, and **decision points**
- Validates business logic correctness

## Critical Testing Gaps

Missing 80% of test coverage. The unimplemented scenarios test:

1. **missing-docs**: Communication agent integration, pending state handling
2. **policy-rejected**: Waiting period logic, policy assessment rules  
3. **rejected-claim**: Categorization accuracy (not a critical illness)
4. **payment-failure**: Error recovery, payment validation

## Implementation Plan

### Phase 1: HIGH Priority (Implement Immediately)

#### 1. Rejected - Not Critical Illness
```typescript
{
  name: 'rejected-not-critical',
  claimFile: 'rejected_claim.json',
  expectedOutcome: 'other',
  expectedPath: [
    'notification_received',
    'categorization_performed'
    // Should stop here - not a critical illness
  ],
  expectedAgents: [
    'claim-orchestrator',
    'notification-categorization'
  ],
}
```
**Tests**: Early exit condition, categorization logic

#### 2. Missing Documents
```typescript
{
  name: 'missing-docs',
  claimFile: 'missing_docs_claim.json',
  expectedOutcome: 'pending_docs',
  expectedPath: [
    'notification_received',
    'categorization_performed',
    'claim_registered',
    'documentation_verified',
    'communication_sent'
  ],
  expectedAgents: [
    'claim-orchestrator',
    'notification-categorization',
    'claim-registration',
    'documentation-verification',
    'communication'
  ],
}
```
**Tests**: Document validation, communication branch, pending states

### Phase 2: MEDIUM Priority

#### 3. Policy Rejected - Waiting Period
```typescript
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
    'communication_sent'
  ],
  expectedAgents: [
    'claim-orchestrator',
    'notification-categorization',
    'claim-registration',
    'documentation-verification',
    'policy-assessment',
    'communication'
  ],
}
```
**Tests**: Business rules, waiting period validation, rejection flow

### Phase 3: LOW Priority

#### 4. Payment Failure
```typescript
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
    'payment_failed'
  ],
  expectedAgents: [
    'claim-orchestrator',
    'notification-categorization',
    'claim-registration',
    'documentation-verification',
    'policy-assessment',
    'payment-approval'
  ],
}
```
**Tests**: Payment validation, error recovery, transaction failures

## Implementation Steps

### Step 1: Update Test Configuration
```typescript
// In claim-processing.test.ts
const testScenarios = [
  // ... existing happy-path
  {
    name: 'rejected-not-critical',
    claimFile: 'rejected_claim.json',
    expectedOutcome: 'other',
    expectedPath: ['notification_received', 'categorization_performed'],
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
      'communication_sent'
    ],
    expectedAgents: [
      'claim-orchestrator',
      'notification-categorization',
      'claim-registration',
      'documentation-verification',
      'communication'
    ],
  },
  // Add more scenarios progressively
];
```

### Step 2: Update Fixture Count
```typescript
// Update fixtureCount to match scenarios
fixtureCount: testScenarios.length,
```

### Step 3: Add Scenario-Specific Tests
```typescript
// Add conditional tests based on scenario
if (scenario.name === 'rejected-not-critical') {
  it('should stop after categorization', () => {
    const agentsCalled = claimData.agentsCalled;
    expect(agentsCalled).not.toContain('claim-registration');
    expect(agentsCalled).not.toContain('policy-assessment');
  });
}

if (scenario.name === 'missing-docs') {
  it('should identify missing documents', () => {
    const delegations = claimData.realDelegations;
    const commDelegation = delegations.find(d => d.to === 'communication');
    expect(commDelegation).toBeDefined();
  });
}
```

## Testing Coverage Goals

### Branch Coverage
- ✅ Happy path (complete workflow)
- ⬜ Early exit (not critical illness)
- ⬜ Missing documents (pending state)
- ⬜ Policy rejection (business rules)
- ⬜ Payment failure (error handling)

### Agent Coverage
- ✅ claim-orchestrator
- ✅ notification-categorization
- ✅ claim-registration
- ✅ documentation-verification
- ✅ policy-assessment
- ✅ payment-approval
- ⬜ communication (not tested yet)

### Error Handling Coverage
- ⬜ Invalid input handling
- ⬜ Missing required fields
- ⬜ Agent communication failures
- ⬜ Payment processing errors
- ⬜ Document validation errors

## Success Metrics

1. **Immediate Goal**: 60% coverage (3/5 scenarios)
   - Happy path ✅
   - Rejected (not critical) 
   - Missing docs

2. **Short-term Goal**: 80% coverage (4/5 scenarios)
   - Add policy rejection scenario

3. **Complete Goal**: 100% coverage (5/5 scenarios)
   - Add payment failure scenario

## Key Testing Insights

### Why This Matters for Agent Orchestration
1. **Branch Coverage**: Each scenario exercises different delegation paths
2. **Error Handling**: Tests how agents handle invalid inputs
3. **State Management**: Tests pending states and recovery
4. **Agent Communication**: Tests error propagation between agents
5. **Business Logic**: Validates domain-specific rules

### Testing Philosophy
- Werewolf tests **agent creativity** with multiple runs
- Critical illness tests **workflow completeness** with multiple scenarios
- We're testing a state machine, not creative storytelling

## Recommended Enhancements

### Environment-Based Configuration
```typescript
// Add configuration like werewolf
const TEST_SCENARIOS = process.env.CI_TEST_SCENARIOS?.split(',') || ['happy-path'];
const FIXTURE_COUNT = TEST_SCENARIOS.length;

// Dynamic scenario loading
const testScenarios = TEST_SCENARIOS.map(name => ({
  name,
  claimFile: `${name.replace('-', '_')}_claim.json`,
  ...getScenarioExpectations(name)
}));
```

### Parallel vs Sequential Generation
- Consider sequential generation for deterministic workflows
- Each scenario builds on understanding from previous
- Reduces API costs during development

## Action Items

### Immediate (This Sprint)
- [ ] Implement `rejected-not-critical` scenario
- [ ] Implement `missing-docs` scenario
- [ ] Update test documentation

### Next Sprint
- [ ] Implement `policy-rejected` scenario
- [ ] Add performance benchmarks
- [ ] Create scenario-specific matchers

### Future
- [ ] Implement `payment-failure` scenario
- [ ] Add chaos testing (random failures)
- [ ] Create visual workflow documentation

## Conclusion

The critical illness claim workflow has excellent test infrastructure but lacks comprehensive scenario coverage. By implementing the additional test scenarios, we can:

1. Increase confidence in the agent orchestration system
2. Validate all workflow branches
3. Ensure proper error handling
4. Test agent communication patterns
5. Verify business logic implementation

**Bottom Line**: The test data is ready, the infrastructure is proven. We just need to implement the remaining scenarios to achieve comprehensive workflow coverage.