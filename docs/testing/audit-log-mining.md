# Audit Log Mining Guide

## The Hidden Test Suite in Your Logs

Every agent execution creates JSONL audit logs. These aren't just for debugging - they're a goldmine of test cases, performance data, and behavioral insights that cost $0 to analyze.

## What's in the Audit Logs?

```typescript
// Every execution produces entries like this in sessions/*/events.jsonl
{
  "timestamp": "2024-01-15T10:30:00Z",
  "sessionId": "abc-123",
  "type": "assistant",
  "data": {
    "agent": "claim-processor",
    "content": "I'll process this claim...",
    "tool_calls": [...],
    "metadata": {
      "model": "anthropic/claude-haiku-4-5",
      "temperature": 0.2,
      "tokensUsed": { "input": 1000, "output": 500, "cached": 800 }
    }
  }
}
```

## Mining Patterns

### 1. Safety Validation
```typescript
// Verify no agent exceeds iteration limits
export function validateSafetyLimits(logs: SessionLog[]): ValidationResult {
  const violations = logs.filter(log => {
    const iterations = log.filter(e => e.type === 'assistant').length;
    return iterations > 10; // MAX_ITERATIONS
  });

  return {
    passed: violations.length === 0,
    violations: violations.map(v => ({
      sessionId: v[0].sessionId,
      iterations: v.filter(e => e.type === 'assistant').length
    }))
  };
}

// Verify delegation depth limits
export function validateDelegationDepth(logs: SessionLog[]): ValidationResult {
  const violations = logs.filter(log => {
    const maxDepth = Math.max(
      ...log.filter(e => e.type === 'delegation')
        .map(e => e.data.depth),
      0
    );
    return maxDepth > 5; // MAX_DEPTH
  });

  return { passed: violations.length === 0, violations };
}
```

### 2. Behavioral Analysis
```typescript
// Detect agents that hallucinate (claim knowledge without tool use)
export function detectHallucination(logs: SessionLog[]): Finding[] {
  const findings: Finding[] = [];

  for (const session of logs) {
    const events = session.events;

    for (let i = 0; i < events.length; i++) {
      const event = events[i];

      if (event.type === 'assistant' && event.data.content) {
        // Check for claims about file contents
        if (event.data.content.match(/file contains|shows that|according to/i)) {
          // Look for preceding Read/Grep tool calls
          const recentTools = events
            .slice(Math.max(0, i - 5), i)
            .filter(e => e.type === 'tool_call')
            .map(e => e.data.tool);

          if (!recentTools.includes('Read') && !recentTools.includes('Grep')) {
            findings.push({
              sessionId: session.sessionId,
              agent: event.data.agent,
              issue: 'Possible hallucination - claimed file knowledge without reading',
              evidence: event.data.content.substring(0, 200)
            });
          }
        }
      }
    }
  }

  return findings;
}
```

### 3. Performance Profiling
```typescript
// Analyze token usage patterns
export function profileTokenUsage(logs: SessionLog[]): TokenProfile {
  const usage = logs.map(session => {
    const totalTokens = session.events
      .filter(e => e.data?.metadata?.tokensUsed)
      .reduce((sum, e) => {
        const tokens = e.data.metadata.tokensUsed;
        return sum + tokens.input + tokens.output;
      }, 0);

    const cachedTokens = session.events
      .filter(e => e.data?.metadata?.tokensUsed?.cached)
      .reduce((sum, e) => sum + e.data.metadata.tokensUsed.cached, 0);

    return {
      sessionId: session.sessionId,
      totalTokens,
      cachedTokens,
      cacheRate: cachedTokens / (totalTokens || 1),
      estimatedCost: calculateCost(totalTokens - cachedTokens)
    };
  });

  return {
    avgTokensPerSession: mean(usage.map(u => u.totalTokens)),
    avgCacheRate: mean(usage.map(u => u.cacheRate)),
    p95Tokens: percentile(usage.map(u => u.totalTokens), 95),
    totalCost: sum(usage.map(u => u.estimatedCost)),
    sessions: usage
  };
}
```

### 4. Tool Usage Patterns
```typescript
// Find inefficient tool usage
export function analyzeToolPatterns(logs: SessionLog[]): ToolPattern[] {
  const patterns: ToolPattern[] = [];

  for (const session of logs) {
    const toolCalls = session.events
      .filter(e => e.type === 'tool_call')
      .map(e => ({ tool: e.data.tool, params: e.data.params }));

    // Detect duplicate reads
    const reads = toolCalls.filter(tc => tc.tool === 'Read');
    const duplicates = findDuplicates(reads, tc => tc.params.file_path);

    if (duplicates.length > 0) {
      patterns.push({
        sessionId: session.sessionId,
        pattern: 'duplicate_reads',
        details: `Read same file ${duplicates.length} times`,
        suggestion: 'Cache file contents in context'
      });
    }

    // Detect Read without preceding Grep
    for (let i = 0; i < toolCalls.length; i++) {
      if (toolCalls[i].tool === 'Read') {
        const hasGrep = toolCalls
          .slice(Math.max(0, i - 3), i)
          .some(tc => tc.tool === 'Grep');

        if (!hasGrep && !toolCalls[i].params.file_path.includes('README')) {
          patterns.push({
            sessionId: session.sessionId,
            pattern: 'read_without_grep',
            details: `Read ${toolCalls[i].params.file_path} without searching first`,
            suggestion: 'Use Grep to find relevant files before reading'
          });
        }
      }
    }
  }

  return patterns;
}
```

### 5. Regression Detection
```typescript
// Compare current behavior against baseline
export function detectRegressions(
  baseline: SessionLog[],
  current: SessionLog[]
): Regression[] {
  const regressions: Regression[] = [];

  // Compare token usage
  const baselineTokens = profileTokenUsage(baseline);
  const currentTokens = profileTokenUsage(current);

  if (currentTokens.avgTokensPerSession > baselineTokens.avgTokensPerSession * 1.2) {
    regressions.push({
      type: 'performance',
      metric: 'token_usage',
      baseline: baselineTokens.avgTokensPerSession,
      current: currentTokens.avgTokensPerSession,
      change: '+20%',
      severity: 'warning'
    });
  }

  // Compare success rates
  const baselineSuccess = calculateSuccessRate(baseline);
  const currentSuccess = calculateSuccessRate(current);

  if (currentSuccess < baselineSuccess - 0.05) {
    regressions.push({
      type: 'functionality',
      metric: 'success_rate',
      baseline: baselineSuccess,
      current: currentSuccess,
      change: `-${((baselineSuccess - currentSuccess) * 100).toFixed(1)}%`,
      severity: 'critical'
    });
  }

  return regressions;
}
```

## Automated Mining Pipeline

### Continuous Analysis
```typescript
// Run automated analysis on all new sessions
export class AuditLogMiner {
  async analyzeNewSessions(): Promise<AnalysisReport> {
    const sessions = await this.loadRecentSessions(24); // Last 24 hours

    return {
      safety: validateSafetyLimits(sessions),
      hallucinations: detectHallucination(sessions),
      performance: profileTokenUsage(sessions),
      toolPatterns: analyzeToolPatterns(sessions),
      regressions: detectRegressions(this.baseline, sessions),
      timestamp: new Date().toISOString()
    };
  }

  async generateDailyReport(): Promise<void> {
    const report = await this.analyzeNewSessions();

    // Flag critical issues
    if (!report.safety.passed) {
      await this.alertTeam('Safety limits exceeded', report.safety.violations);
    }

    if (report.hallucinations.length > 0) {
      await this.alertTeam('Hallucinations detected', report.hallucinations);
    }

    if (report.regressions.some(r => r.severity === 'critical')) {
      await this.alertTeam('Critical regression detected', report.regressions);
    }

    // Save report
    await this.saveReport(report);
  }
}
```

### Mining Scripts
```bash
# Extract all sessions from today
find sessions -name "events.jsonl" -mtime -1 -exec cat {} \; > today.jsonl

# Find slowest executions
jq -s 'sort_by(.duration) | reverse | .[:10]' today.jsonl

# Find highest token usage
jq -s 'sort_by(.tokensUsed.total) | reverse | .[:10]' today.jsonl

# Find all errors
jq 'select(.type == "error")' today.jsonl

# Find delegation chains
jq 'select(.type == "delegation") | {from: .data.parent, to: .data.child, depth: .data.depth}' today.jsonl
```

## Cost Analysis from Logs

```typescript
// Calculate actual costs from audit logs
export function calculateCosts(logs: SessionLog[]): CostBreakdown {
  const costs = {
    byModel: {} as Record<string, number>,
    byAgent: {} as Record<string, number>,
    byDay: {} as Record<string, number>,
    total: 0
  };

  for (const session of logs) {
    for (const event of session.events) {
      if (event.data?.metadata?.tokensUsed) {
        const model = event.data.metadata.model;
        const agent = event.data.agent;
        const day = event.timestamp.split('T')[0];
        const cost = calculateModelCost(model, event.data.metadata.tokensUsed);

        costs.byModel[model] = (costs.byModel[model] || 0) + cost;
        costs.byAgent[agent] = (costs.byAgent[agent] || 0) + cost;
        costs.byDay[day] = (costs.byDay[day] || 0) + cost;
        costs.total += cost;
      }
    }
  }

  return costs;
}

// Find cost optimization opportunities
export function findCostOptimizations(logs: SessionLog[]): Optimization[] {
  const optimizations: Optimization[] = [];

  // Find agents using expensive models unnecessarily
  const agentCosts = calculateCosts(logs).byAgent;
  for (const [agent, cost] of Object.entries(agentCosts)) {
    const avgTokens = getAverageTokens(logs, agent);

    if (avgTokens < 1000 && cost > 10) {
      optimizations.push({
        agent,
        suggestion: 'Consider using claude-3-5-haiku for simple tasks',
        estimatedSavings: cost * 0.9 // Haiku is ~90% cheaper
      });
    }
  }

  // Find low cache utilization
  const cacheRates = logs.map(s => calculateCacheRate(s));
  const avgCacheRate = mean(cacheRates);

  if (avgCacheRate < 0.5) {
    optimizations.push({
      agent: 'all',
      suggestion: 'Enable prompt caching - current rate only ' + (avgCacheRate * 100).toFixed(1) + '%',
      estimatedSavings: costs.total * 0.4 // ~40% savings with good caching
    });
  }

  return optimizations;
}
```

## Anomaly Detection

```typescript
// Detect unusual patterns that might indicate bugs
export function detectAnomalies(logs: SessionLog[]): Anomaly[] {
  const anomalies: Anomaly[] = [];

  // Build baseline statistics
  const baseline = {
    avgDuration: mean(logs.map(s => s.duration)),
    stdDuration: stddev(logs.map(s => s.duration)),
    avgIterations: mean(logs.map(s => countIterations(s))),
    normalTools: getMostCommonTools(logs, 10)
  };

  // Find outliers
  for (const session of logs) {
    // Duration outliers (> 3 standard deviations)
    if (session.duration > baseline.avgDuration + 3 * baseline.stdDuration) {
      anomalies.push({
        sessionId: session.sessionId,
        type: 'performance',
        description: `Execution took ${session.duration}ms (normal: ${baseline.avgDuration}ms)`,
        severity: 'warning'
      });
    }

    // Unusual tool usage
    const tools = getToolsUsed(session);
    const unusual = tools.filter(t => !baseline.normalTools.includes(t));

    if (unusual.length > 0) {
      anomalies.push({
        sessionId: session.sessionId,
        type: 'behavior',
        description: `Used unusual tools: ${unusual.join(', ')}`,
        severity: 'info'
      });
    }

    // Excessive retries
    const retries = countRetries(session);
    if (retries > 3) {
      anomalies.push({
        sessionId: session.sessionId,
        type: 'reliability',
        description: `Had ${retries} retry attempts`,
        severity: 'warning'
      });
    }
  }

  return anomalies;
}
```

## Integration with CI/CD

```yaml
# .github/workflows/audit-analysis.yml
name: Audit Log Analysis

on:
  schedule:
    - cron: '0 */6 * * *' # Every 6 hours
  workflow_dispatch:

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run audit analysis
        run: |
          npm run audit:analyze
          npm run audit:report

      - name: Upload report
        uses: actions/upload-artifact@v3
        with:
          name: audit-report
          path: reports/audit-*.json

      - name: Check for regressions
        run: npm run audit:check-regressions

      - name: Alert on issues
        if: failure()
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: 'Audit Analysis Found Issues',
              body: 'Check the audit report for details'
            })
```

## Best Practices

### DO's
✅ **Run analysis continuously** - Catch issues early
✅ **Compare against baselines** - Detect regressions
✅ **Archive important sessions** - They become test fixtures
✅ **Alert on anomalies** - Don't wait for users to report bugs
✅ **Track costs religiously** - LLM costs add up quickly

### DON'Ts
❌ **Don't analyze in production** - Do it offline/async
❌ **Don't ignore patterns** - Repeated issues indicate systemic problems
❌ **Don't delete logs too quickly** - They're valuable test data
❌ **Don't test exact matches** - Focus on patterns and invariants

## Conclusion

Your audit logs are a continuous, free test suite running in production. Every user interaction is a test case. Every error is a regression test waiting to be written. Every successful execution proves your system works.

Mining these logs costs nothing but gives you:
- Proof of correct behavior
- Performance baselines
- Cost optimization opportunities
- Bug detection before users complain
- Regression prevention

This isn't just logging - it's continuous validation of your entire system.