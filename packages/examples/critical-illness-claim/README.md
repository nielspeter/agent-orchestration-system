# Critical Illness Claim Example

Demonstrates **insurance claim processing** with multi-agent validation and analysis.

## What This Demonstrates

- **Domain-Specific Workflows**: Insurance claim processing
- **Document Analysis**: Medical report processing
- **Validation Logic**: Multi-criteria claim validation
- **Decision Making**: Autonomous claim approval/rejection

## Key Concepts

This example shows how agents can handle complex domain-specific tasks:

- Medical document analysis
- Policy validation
- Claim assessment
- Decision automation
- Audit trail generation

## Running the Example

```bash
npx tsx packages/examples/critical-illness-claim/claim-processor.ts
```

## Claim Processing Flow

```
1. Document Intake
   - Receive claim documents
   - Extract medical information
   - Identify claim type

2. Validation
   - Verify policy coverage
   - Check medical criteria
   - Validate documentation

3. Assessment
   - Analyze medical evidence
   - Apply policy rules
   - Calculate payout

4. Decision
   - Approve/Reject determination
   - Generate explanation
   - Create audit record
```

## Agents

### Claim Processor
- Orchestrates claim workflow
- Coordinates specialist agents
- Makes final decision

### Medical Analyst
- Reviews medical documentation
- Validates diagnoses
- Assesses severity

### Policy Validator
- Checks policy coverage
- Verifies waiting periods
- Confirms eligibility

## Example Claim

```typescript
const claim = {
  policyNumber: 'CI-12345',
  diagnosis: 'Cancer (Stage 2)',
  documents: [
    'medical-report.pdf',
    'pathology-results.pdf'
  ],
  claimAmount: 50000
};
```

## Code Highlights

```typescript
// Process claim
const result = await executor.execute(
  'claim-processor',
  `Process critical illness claim:
   - Policy: CI-12345
   - Diagnosis: Cancer (Stage 2)
   - Amount: $50,000`
);

// Processor delegates to:
// 1. medical-analyst: Validate diagnosis
// 2. policy-validator: Check coverage
// 3. Synthesizes decision
```

## Decision Output

```json
{
  "decision": "APPROVED",
  "amount": 50000,
  "reasoning": [
    "Diagnosis confirmed by pathology report",
    "Policy coverage verified for cancer",
    "Waiting period satisfied",
    "No exclusions apply"
  ],
  "conditions": [],
  "auditTrail": [
    "Medical analysis completed",
    "Policy validation passed",
    "Amount within limits"
  ]
}
```

## Validation Criteria

### Medical
- Diagnosis matches policy definitions
- Medical documentation complete
- Severity meets thresholds

### Policy
- Policy active and in force
- Coverage includes claimed condition
- Waiting periods satisfied
- No exclusions apply

### Financial
- Claim amount within limits
- No duplicate claims
- Payment calculations correct

## Use Cases

- **Automated Triage**: Quick decisions for clear cases
- **Expert Review**: Flag complex cases for human review
- **Consistency**: Apply rules uniformly
- **Audit Trail**: Document decision process
- **Cost Reduction**: Reduce manual processing time

## Best Practices

1. **Transparency**: Document all decision factors
2. **Compliance**: Follow regulatory requirements
3. **Human Oversight**: Flag edge cases for review
4. **Data Privacy**: Protect sensitive medical information
5. **Audit Trail**: Maintain complete processing history

## Next Steps

See also:
- `critical-illness-claim-structured/` - Structured output version
- `workflow-pipeline/` - Generic workflow patterns
- `orchestration/` - Agent delegation patterns
