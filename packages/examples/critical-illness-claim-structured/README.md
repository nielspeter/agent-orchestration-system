# Critical Illness Claim (Structured) Example

Demonstrates **insurance claim processing with structured output** using JSON schema validation.

## What This Demonstrates

- **Structured Outputs**: JSON schema-validated responses
- **Type Safety**: Guaranteed output format
- **API Integration**: Machine-readable results
- **Validation**: Schema enforcement

## Key Concepts

This is the **structured output version** of the claim processor:

### Standard Version (`critical-illness-claim/`)
- Free-form text output
- Natural language explanations
- Human-friendly format

### Structured Version (this example)
- JSON schema-validated output
- Strict type safety
- API-ready format

## Running the Example

```bash
npx tsx packages/examples/critical-illness-claim-structured/claim-processor-structured.ts
```

## Output Schema

```typescript
interface ClaimDecision {
  decision: 'APPROVED' | 'REJECTED' | 'PENDING';
  amount: number;
  policyNumber: string;
  diagnosis: string;
  reasoning: {
    medical: string[];
    policy: string[];
    financial: string[];
  };
  conditions?: string[];
  requiredActions?: string[];
  auditTrail: {
    timestamp: string;
    actor: string;
    action: string;
    details: string;
  }[];
}
```

## Example Output

```json
{
  "decision": "APPROVED",
  "amount": 50000,
  "policyNumber": "CI-12345",
  "diagnosis": "Cancer (Stage 2)",
  "reasoning": {
    "medical": [
      "Pathology confirms malignant neoplasm",
      "TNM staging: T2N1M0",
      "Diagnosis date: 2024-01-15"
    ],
    "policy": [
      "Coverage active since 2020-01-01",
      "Waiting period satisfied (4 years)",
      "No exclusions apply"
    ],
    "financial": [
      "Claim amount within coverage limit",
      "No prior claims on this policy",
      "Maximum benefit: $100,000"
    ]
  },
  "conditions": [],
  "requiredActions": [],
  "auditTrail": [
    {
      "timestamp": "2024-10-16T12:00:00Z",
      "actor": "medical-analyst",
      "action": "document_review",
      "details": "Medical documentation validated"
    },
    {
      "timestamp": "2024-10-16T12:01:00Z",
      "actor": "policy-validator",
      "action": "coverage_check",
      "details": "Policy coverage confirmed"
    }
  ]
}
```

## Benefits

### For Integration
- **Type Safety**: Compile-time checking
- **Validation**: Schema enforcement
- **Consistency**: Guaranteed format
- **Parsing**: No ambiguity

### For Testing
- **Assertions**: Exact field validation
- **Mocking**: Known structure
- **Coverage**: Complete field coverage

### For APIs
- **Documentation**: OpenAPI/Swagger ready
- **Clients**: Auto-generated clients
- **Versioning**: Schema evolution

## Code Highlights

```typescript
// Define schema
const schema = {
  type: 'object',
  required: ['decision', 'amount', 'policyNumber'],
  properties: {
    decision: {
      type: 'string',
      enum: ['APPROVED', 'REJECTED', 'PENDING']
    },
    amount: { type: 'number', minimum: 0 },
    reasoning: {
      type: 'object',
      required: ['medical', 'policy', 'financial'],
      properties: {
        medical: { type: 'array', items: { type: 'string' } },
        policy: { type: 'array', items: { type: 'string' } },
        financial: { type: 'array', items: { type: 'string' } }
      }
    }
  }
};

// Execute with schema
const result = await executor.executeWithSchema(
  'claim-processor',
  prompt,
  schema
);

// result is guaranteed to match schema
```

## Validation

Schema validation ensures:
- All required fields present
- Correct data types
- Enum constraints respected
- Array items valid
- Nested objects complete

## Use Cases

- **API Integrations**: Return machine-readable results
- **Workflow Automation**: Reliable field extraction
- **Data Pipelines**: Predictable structure
- **Testing**: Exact assertions
- **Compliance**: Structured audit trails

## Comparison

| Aspect | Standard | Structured |
|--------|----------|------------|
| Output | Free-form text | JSON schema |
| Flexibility | High | Medium |
| Integration | Manual parsing | Direct use |
| Validation | None | Automatic |
| Use Case | Human review | Automation |

## Next Steps

Explore:
- `critical-illness-claim/` - Free-form version
- `workflow-pipeline/` - Workflow patterns
- Custom schemas - Define your own output formats
