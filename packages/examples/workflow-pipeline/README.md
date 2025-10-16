# Workflow Pipeline Example

Demonstrates building **structured multi-step workflows** with agent orchestration.

## What This Demonstrates

- **Pipeline Patterns**: Sequential multi-step processes
- **Workflow Coordination**: Orchestrator manages workflow stages
- **State Management**: Tracking progress through pipeline
- **Error Handling**: Graceful failure recovery

## Key Concepts

Workflow pipelines enable:
- **Structured Processes**: Defined stages and transitions
- **Coordination**: Orchestrator manages flow
- **Validation**: Each stage validates inputs/outputs
- **Observability**: Track progress through pipeline

## Running the Example

```bash
npx tsx packages/examples/workflow-pipeline/workflow-pipeline.ts
```

## Pipeline Stages

```
Input → Validation → Processing → Analysis → Output

1. Validation Stage
   - Verify input format
   - Check requirements

2. Processing Stage
   - Transform data
   - Apply business logic

3. Analysis Stage
   - Analyze results
   - Generate insights

4. Output Stage
   - Format results
   - Deliver output
```

## Workflow Patterns

### Sequential Pipeline
```
Stage 1 → Stage 2 → Stage 3 → Done
```

### Conditional Branching
```
Input → Validator
         ├─→ Valid → Process
         └─→ Invalid → Error
```

### Parallel Processing
```
Input → Split
         ├─→ Process A ┐
         └─→ Process B ├→ Merge → Output
```

## Code Highlights

```typescript
// Orchestrator manages workflow
const result = await executor.execute(
  'workflow-orchestrator',
  `Process document through pipeline:
   1. Validate format
   2. Extract data
   3. Analyze content
   4. Generate report`
);

// Orchestrator delegates to stage agents:
// - validator agent
// - extractor agent
// - analyzer agent
// - report-generator agent
```

## State Tracking

```typescript
// Workflow state
{
  stage: 'processing',
  completed: ['validation'],
  pending: ['analysis', 'output'],
  data: {
    // Stage results
  }
}
```

## Error Handling

### Retry on Failure
```
Process → Fail → Retry (3x) → Fallback
```

### Validation Gates
```
Input → Validate
         ├─→ Pass → Continue
         └─→ Fail → Return Error
```

## Use Cases

- **Data Processing**: ETL pipelines
- **Document Workflows**: Review → Approve → Process
- **Testing Pipelines**: Build → Test → Deploy
- **Content Publishing**: Write → Review → Edit → Publish
- **Order Processing**: Validate → Pay → Fulfill → Ship

## Best Practices

1. **Idempotency**: Stages can be re-run safely
2. **Validation**: Check inputs at each stage
3. **Observability**: Log stage transitions
4. **Error Recovery**: Handle failures gracefully
5. **State Persistence**: Save workflow state

## Comparison

**Workflow Pipeline** (this example):
- Structured, predictable stages
- Orchestrator manages flow
- Good for: Business processes, ETL

**Autonomous Orchestration** (see `orchestration/`):
- Dynamic, adaptive delegation
- Agent decides workflow
- Good for: Complex reasoning, exploration

## Next Steps

Explore:
- `orchestration/` - Dynamic agent delegation
- `coding-team/` - Software development workflow
- `session-analyzer/` - Session-based workflows
