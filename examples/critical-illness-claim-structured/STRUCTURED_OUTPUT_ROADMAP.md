# Structured Output Implementation Roadmap

## Overview
This is the structured output version of the critical illness claim system. We maintain both versions to:
1. Compare performance and reliability
2. Demonstrate the benefits of structured output
3. Provide a migration path for existing systems

## Benefits of This Approach
- **Both versions coexist** - No risk to existing functionality
- **Direct comparison** - Run both to measure improvements
- **Gradual adoption** - Teams can choose which version to use
- **Learning tool** - See differences side-by-side

## Implementation Plan

### Phase 1: Schema Definition (Day 1)
Create JSON schemas for all agent interfaces:

#### 1.1 Create Schema Directory
```
examples/critical-illness-claim-structured/schemas/
├── definitions.json        # Shared type definitions
├── notification-categorization.json
├── claim-registration.json
├── documentation-verification.json
├── policy-assessment.json
├── payment-approval.json
├── communication.json
└── claim-orchestrator.json
```

#### 1.2 Example Schema Structure
```json
{
  "notification-categorization": {
    "input": {
      "type": "object",
      "properties": {
        "notification": { "$ref": "#/definitions/Notification" },
        "documents": { 
          "type": "array",
          "items": { "$ref": "#/definitions/Document" }
        }
      },
      "required": ["notification"]
    },
    "output": {
      "type": "object",
      "properties": {
        "isCriticalIllness": { "type": "boolean" },
        "category": { 
          "enum": ["critical_illness", "general_health", "inquiry", "other"] 
        },
        "confidence": { "enum": ["high", "medium", "low"] },
        "identifiedCondition": { "type": "string" },
        "reasoning": { "type": "string" }
      },
      "required": ["isCriticalIllness", "category", "confidence", "reasoning"]
    }
  }
}
```

### Phase 2: Update Task Tool (Day 1)

#### 2.1 Create Enhanced Task Tool
```typescript
// src/tools/task-structured.tool.ts
export class TaskStructuredTool extends TaskTool {
  async execute(args: TaskStructuredArgs): Promise<any> {
    // Pure JSON input, no text wrapper
    const { agent, input, output_schema } = args;
    
    // Pass structured_output flag to enable JSON mode
    const result = await this.executor.execute(agent, {
      input,
      structured_output: true,
      output_schema
    });
    
    // Validate output against schema if provided
    if (output_schema) {
      this.validateSchema(result, output_schema);
    }
    
    return result;
  }
}
```

#### 2.2 Update Orchestrator to Use New Task Interface
Instead of:
```typescript
// Old way - text wrapper around JSON
prompt: "Process this notification: " + JSON.stringify(data)
```

Use:
```typescript
// New way - pure JSON
input: data,
output_schema: "notification-categorization-output"
```

### Phase 3: Update Agent Configurations (Day 2)

#### 3.1 Add Structured Output Flags
```yaml
---
name: notification-categorization
model: openrouter/openai/gpt-4o
structured_output: true
input_schema: NotificationCategorizationInput
output_schema: NotificationCategorizationOutput
---
```

#### 3.2 Update Agent Prompts
Remove instructions about JSON formatting since it's enforced:
```markdown
# OLD
You must return your response as valid JSON in the following format...

# NEW  
You receive structured input and return structured output according to the defined schemas.
```

### Phase 4: Add Schema Validation Middleware (Day 2)

#### 4.1 Create Validation Middleware
```typescript
// src/middleware/schema-validation.middleware.ts
import Ajv from 'ajv';

export class SchemaValidationMiddleware {
  private ajv = new Ajv();
  
  async process(context: Context, next: Next) {
    // Validate input
    if (context.agent.inputSchema) {
      this.validateInput(context.input, context.agent.inputSchema);
    }
    
    const result = await next(context);
    
    // Validate output
    if (context.agent.outputSchema) {
      this.validateOutput(result, context.agent.outputSchema);
    }
    
    return result;
  }
}
```

#### 4.2 Register Middleware in Builder
```typescript
.withMiddleware('schemaValidation', SchemaValidationMiddleware)
```

### Phase 5: Enable Structured Output in LLM Provider (Day 2)

#### 5.1 Update Anthropic/OpenAI Provider
```typescript
// src/providers/structured-provider.ts
async call(messages: Message[], config: AgentConfig) {
  const requestBody: any = {
    messages,
    model: config.model,
    temperature: config.temperature
  };
  
  // Enable structured output if configured
  if (config.structured_output && config.output_schema) {
    requestBody.response_format = {
      type: "json_schema",
      json_schema: this.getSchema(config.output_schema)
    };
  }
  
  return await this.client.messages.create(requestBody);
}
```

### Phase 6: Testing & Validation (Day 3)

#### 6.1 Create Test Suite
```bash
# Run structured version tests
npm run test:integration:critical-illness-structured
```

#### 6.2 Performance Comparison
Create metrics comparison:
- Token usage (expect 20% reduction)
- Error rates (expect 0 JSON parsing errors)
- Execution time (similar or slightly faster)
- Success rates (should be identical)

#### 6.3 Create Side-by-Side Runner
```typescript
// examples/compare-versions.ts
async function compareVersions() {
  const claim = loadTestClaim();
  
  // Run original version
  const originalResult = await runOriginal(claim);
  
  // Run structured version
  const structuredResult = await runStructured(claim);
  
  // Compare metrics
  console.log('Token Usage:');
  console.log('- Original:', originalResult.tokens);
  console.log('- Structured:', structuredResult.tokens);
  console.log('- Savings:', percentageSaved);
}
```

## Migration Strategy

### For New Projects
- Use structured version immediately
- Reference schemas as documentation
- Generate TypeScript types from schemas

### For Existing Projects
1. Run both versions in parallel
2. Compare outputs for consistency
3. Monitor error rates and performance
4. Gradually migrate once confidence is built

## Success Metrics

### Immediate Benefits
- ✅ Zero JSON parsing errors
- ✅ 20% token reduction
- ✅ Type-safe agent composition
- ✅ Self-documenting via schemas

### Long-term Benefits
- ✅ API generation from schemas
- ✅ Automatic documentation
- ✅ Better observability
- ✅ Easier debugging

## Next Steps

1. **Create schema files** for all agents
2. **Update Delegate tool** to support structured input
3. **Add structured_output flags** to agent configs
4. **Run tests** to generate new fixtures
5. **Compare performance** with original version
6. **Document findings** and benefits

## Notes

- Keep original version unchanged for comparison
- All changes isolated to `-structured` directories
- Can be deleted if approach doesn't work out
- Provides learning opportunity for the team