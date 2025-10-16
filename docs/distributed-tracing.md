# Distributed Tracing in Agent Orchestration System

## Overview

The Agent Orchestration System has **built-in distributed tracing** through its unified session architecture. Unlike traditional microservices that require external tracing tools, this system provides complete execution visibility out of the box.

## How It Works

### Unified Session Design
All agents in a delegation chain share the same session ID and write to the same JSONL file:

```
User Request → Orchestrator (session_123)
                ├→ Claim Agent (session_123)  ← Same session!
                └→ Validation Agent (session_123)  ← Same session!
```

### Key Architecture Decisions

1. **Shared Logger Instance** (`src/agents/executor.ts:84`)
   - The executor passes `this.execute.bind(this)` as the delegation function
   - All delegated agents use the same logger instance
   - Events from all agents go to one location based on storage type:
     - Filesystem: `.agent-sessions/[sessionId]/events.jsonl`
     - Memory: InMemoryStorage (for testing/debugging)
     - None: No storage (default, for performance)

2. **Event-Based Logging** (`src/logging/event.logger.ts`)
   - Every interaction is an event with timestamp and agent name
   - Tool calls include unique IDs for correlation
   - Fire-and-forget pattern prevents blocking

3. **Pull Architecture Benefits**
   - Child agents don't need parent conversation history
   - Each agent gathers its own context via tools
   - Reduces data passed between agents
   - Makes tracing cleaner (focused on actions, not context passing)

## What You Get For Free

### 1. Complete Execution Trace
Every JSONL file contains:
```json
{"type":"tool_call","timestamp":1234567890,"data":{"id":"call_123","tool":"Task","params":{"subagent_type":"claim-agent","prompt":"Analyze claim"},"agent":"orchestrator"}}
{"type":"delegation","timestamp":1234567891,"data":{"parent":"orchestrator","child":"claim-agent","delegate":"Analyze claim"}}
{"type":"tool_call","timestamp":1234567892,"data":{"id":"call_456","tool":"Read","params":{"file":"claim.json"},"agent":"claim-agent"}}
{"type":"tool_result","timestamp":1234567893,"data":{"toolCallId":"call_456","result":{...}}}
```

### 2. Timing Analysis
- Timestamps on every event
- Calculate duration between tool call and result
- Identify slow operations
- Measure total execution time per agent

### 3. Cost Attribution
- Token usage per LLM call
- Cache hit rates per agent
- Cost savings from caching
- Already tracked in `src/metrics/cache-collector.ts`

### 4. Error Debugging
- Full error messages with stack traces
- Which agent failed
- What tool caused the error
- Complete context leading to failure

## Visualizing Traces

### Analyzing Sessions
Use the session-analyzer agent to generate comprehensive reports:

```bash
npx tsx examples/session-analyzer.ts
```

Creates markdown reports with:
- Summary statistics
- Mermaid sequence diagrams
- Token usage analysis
- Complete message logs

## Comparison with Traditional Distributed Tracing

| Feature | Traditional (Jaeger/Zipkin) | Agent Orchestration System |
|---------|------------------------------|---------------------------|
| Setup Complexity | High (requires infrastructure) | None (built-in) |
| Storage | Separate trace storage | Unified with logs |
| Context Propagation | HTTP headers | Shared session |
| Sampling | Required at scale | Not needed (efficient) |
| Cost | Additional infrastructure | Free |
| Query Language | Specialized (TraceQL) | Simple JSON/grep |

## Limitations and Future Improvements

### Current Limitations
1. **No Parent-Child IDs**: While we can infer relationships from timing and agent names, explicit parent-child IDs would be clearer
2. **No Span IDs**: Events have tool call IDs but not span IDs for non-tool operations
3. **Basic Visualization**: CLI output only, no web UI

### Easy Enhancements (< 1 day)
1. Add `parentCallId` to track delegation chains explicitly
2. Add `spanId` for all operations, not just tool calls
3. Add `traceId` that persists across sessions for end-to-end tracking

### Future Possibilities
1. **Web Dashboard**: Real-time trace visualization
2. **OpenTelemetry Export**: For teams with existing infrastructure
3. **Performance Profiling**: Automatic bottleneck detection
4. **Anomaly Detection**: Alert on unusual execution patterns

## Implementation Example

To add explicit parent-child tracking (10 lines of code):

```typescript
// 1. In middleware context (middleware-types.ts)
interface MiddlewareContext {
  // ... existing fields
  parentCallId?: string;  // NEW
  traceId?: string;       // NEW
}

// 2. In tool execution (executor-service.ts:200)
const subAgentResult = await executeDelegate(args.subagent_type, args.prompt, {
  ...ctx.executionContext,
  parentCallId: toolCall.id,  // NEW
  traceId: ctx.traceId || crypto.randomUUID()  // NEW
});

// 3. In EventLogger (event.logger.ts:70)
const event: ToolCallEvent = {
  type: 'tool_call',
  timestamp: Date.now(),
  data: {
    id,
    tool,
    params,
    agent,
    parentId: this.context?.parentCallId,  // NEW
    traceId: this.context?.traceId  // NEW
  }
};
```

## Conclusion

The Agent Orchestration System's unified session architecture provides distributed tracing capabilities that rival dedicated APM tools, without any additional infrastructure. The JSONL format is:

- **Human-readable**: Can be analyzed with standard text tools
- **Machine-parseable**: Easy to build visualizations
- **Complete**: Contains full execution history
- **Efficient**: No sampling needed, minimal overhead

For most use cases, the existing JSONL tracing is sufficient. Teams can start with the built-in capabilities and add external APM tools only when needed for specialized requirements.