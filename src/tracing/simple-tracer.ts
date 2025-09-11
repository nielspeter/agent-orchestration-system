import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

interface SpanData {
  spanId: string;
  parentId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  status?: 'ok' | 'error';
  attributes?: Record<string, unknown>;
  children: SpanData[];
}

export class SimpleTracer {
  private spans = new Map<string, SpanData>();
  private rootSpans: SpanData[] = [];

  loadSession(sessionId: string): void {
    const sessionPath = join(process.cwd(), 'sessions', `${sessionId}.jsonl`);

    if (!existsSync(sessionPath)) {
      console.error(`Session not found: ${sessionId}`);
      return;
    }

    const content = readFileSync(sessionPath, 'utf-8');
    const events = content
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    // Build span tree from events
    for (const event of events) {
      if (event.type === 'tool_call') {
        const span: SpanData = {
          spanId: event.data.id,
          parentId: event.data.parentCallId,
          name: `${event.data.agent || 'main'}:${event.data.tool}`,
          startTime: event.timestamp,
          attributes: {
            tool: event.data.tool,
            agent: event.data.agent,
            traceId: event.data.traceId,
          },
          children: [],
        };

        this.spans.set(span.spanId, span);

        // Build parent-child relationships
        if (span.parentId) {
          const parentSpan = this.spans.get(span.parentId);
          if (parentSpan) {
            parentSpan.children.push(span);
          }
        } else {
          this.rootSpans.push(span);
        }
      } else if (event.type === 'tool_result') {
        const span = this.spans.get(event.data.id);
        if (span) {
          span.endTime = event.timestamp;
          span.status = event.data.error ? 'error' : 'ok';
        }
      }
    }
  }

  printWaterfall(): void {
    console.log('\n' + chalk.bold('📊 Execution Waterfall'));
    console.log('═'.repeat(60));

    for (const span of this.rootSpans) {
      this.printSpan(span, 0);
    }

    this.printSummary();
  }

  private printSpan(span: SpanData, depth: number): void {
    const indent = '  '.repeat(depth);
    const duration = span.endTime ? span.endTime - span.startTime : 0;
    const durationStr = duration > 0 ? `${(duration / 1000).toFixed(2)}s` : 'pending';

    const status =
      span.status === 'error'
        ? chalk.red('✗')
        : span.status === 'ok'
          ? chalk.green('✓')
          : chalk.yellow('⟳');

    const name = chalk.cyan(span.name);
    const time = chalk.gray(durationStr);

    console.log(`${indent}├─ ${name} ${time} ${status}`);

    // Print attributes
    if (span.attributes?.tool === 'Task') {
      const childAgents = span.children
        .map((c) => c.name.split(':')[0])
        .filter((v, i, a) => a.indexOf(v) === i);
      if (childAgents.length > 0) {
        console.log(`${indent}│  └─ delegated to: ${chalk.yellow(childAgents.join(', '))}`);
      }
    }

    // Print children
    for (const child of span.children) {
      this.printSpan(child, depth + 1);
    }
  }

  private printSummary(): void {
    const totalSpans = this.spans.size;
    const errorSpans = Array.from(this.spans.values()).filter((s) => s.status === 'error').length;
    const totalDuration = Math.max(
      ...Array.from(this.spans.values())
        .filter((s) => s.endTime)
        .map((s) => {
          if (!s.endTime) {
            throw new Error('Span should have endTime');
          }
          return s.endTime - s.startTime;
        })
    );

    console.log('\n' + chalk.bold('Summary:'));
    console.log(`  Total Spans: ${totalSpans}`);
    console.log(`  Errors: ${errorSpans > 0 ? chalk.red(errorSpans) : chalk.green('0')}`);
    console.log(`  Total Time: ${(totalDuration / 1000).toFixed(2)}s`);
  }

  exportJson(): object {
    return {
      spans: Array.from(this.spans.values()),
      summary: {
        totalSpans: this.spans.size,
        rootSpans: this.rootSpans.length,
        errors: Array.from(this.spans.values()).filter((s) => s.status === 'error').length,
      },
    };
  }
}

// CLI usage
if (require.main === module) {
  const sessionId = process.argv[2];
  if (!sessionId) {
    console.error('Usage: npm run trace <sessionId>');
    process.exit(1);
  }

  const tracer = new SimpleTracer();
  tracer.loadSession(sessionId);
  tracer.printWaterfall();
}
