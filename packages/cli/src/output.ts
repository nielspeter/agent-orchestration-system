/**
 * Output formatting utilities for CLI
 *
 * Provides functions to format execution results in different modes:
 * - clean: Just the result text
 * - verbose: With agent info, tool calls, timing
 * - json: Structured JSON output
 */

/**
 * Output format modes
 */
export type OutputFormat = 'clean' | 'verbose' | 'json';

/**
 * LLM metadata for tracking usage and costs
 * Based on @agent-system/core session types
 */
export interface LLMMetadata {
  model?: string;
  provider?: string;
  stopReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    promptCacheHitTokens?: number;
    promptCacheMissTokens?: number;
    cachedTokens?: number;
  };
  cost?: {
    inputCost?: number;
    outputCost?: number;
    totalCost?: number;
  };
  performance?: {
    latencyMs?: number;
    retries?: number;
  };
  config?: {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    responseFormat?: string;
  };
}

/**
 * Session event types
 */
export type SessionEventType = 'user' | 'assistant' | 'tool_call' | 'tool_result';

/**
 * Base session event structure
 */
export interface SessionEvent {
  type: SessionEventType;
  timestamp: number;
  data: unknown;
  metadata?: LLMMetadata;
}

/**
 * Union of all session event types
 */
export type AnySessionEvent = SessionEvent;

/**
 * Execution result with metadata
 */
export interface ExecutionResult {
  result: string;
  agentName: string;
  sessionId?: string;
  duration?: number;
  events?: AnySessionEvent[];
  metadata?: {
    totalTokens?: number;
    totalCost?: number;
    iterations?: number;
    toolCalls?: number;
  };
}

/**
 * ANSI color codes for terminal output
 * Using basic codes for compatibility
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
} as const;

/**
 * Check if colors should be disabled
 */
function shouldDisableColors(): boolean {
  return (
    process.env.NO_COLOR !== undefined ||
    process.env.TERM === 'dumb' ||
    (!process.stdout.isTTY && !process.env.FORCE_COLOR)
  );
}

/**
 * Apply color to text (respects NO_COLOR environment variable)
 */
function colorize(text: string, color: keyof typeof colors): string {
  if (shouldDisableColors()) {
    return text;
  }
  return `${colors[color]}${text}${colors.reset}`;
}

/**
 * Format a header with optional color
 */
function formatHeader(text: string, color: keyof typeof colors = 'bright'): string {
  return colorize(`\n${text}`, color);
}

/**
 * Format a key-value pair
 */
function formatKeyValue(key: string, value: string | number, indent = 0): string {
  const padding = ' '.repeat(indent);
  const keyColored = colorize(key + ':', 'cyan');
  return `${padding}${keyColored} ${value}`;
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = (ms / 1000).toFixed(2);
  return `${seconds}s`;
}

/**
 * Format cost in USD
 */
function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${(cost * 1000).toFixed(3)}k`;
  }
  return `$${cost.toFixed(4)}`;
}

/**
 * Extract metadata from session events
 */
function extractMetadata(events?: AnySessionEvent[]): {
  totalTokens: number;
  totalCost: number;
  iterations: number;
  toolCalls: number;
  cacheHits: number;
  cacheMisses: number;
} {
  if (!events || events.length === 0) {
    return {
      totalTokens: 0,
      totalCost: 0,
      iterations: 0,
      toolCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
  }

  let totalTokens = 0;
  let totalCost = 0;
  let iterations = 0;
  let toolCalls = 0;
  let cacheHits = 0;
  let cacheMisses = 0;

  for (const event of events) {
    // Count assistant messages as iterations
    if (event.type === 'assistant') {
      iterations++;
    }

    // Count tool calls
    if (event.type === 'tool_call') {
      toolCalls++;
    }

    // Sum up tokens and costs from metadata
    if (event.metadata) {
      const meta = event.metadata as LLMMetadata;

      if (meta.usage) {
        totalTokens += meta.usage.totalTokens || 0;
        cacheHits += meta.usage.promptCacheHitTokens || 0;
        cacheMisses += meta.usage.promptCacheMissTokens || 0;
      }

      if (meta.cost) {
        totalCost += meta.cost.totalCost || 0;
      }
    }
  }

  return {
    totalTokens,
    totalCost,
    iterations,
    toolCalls,
    cacheHits,
    cacheMisses,
  };
}

/**
 * Format tool calls from events
 */
function formatToolCalls(events: AnySessionEvent[]): string[] {
  const toolCallEvents = events.filter((e) => e.type === 'tool_call');

  return toolCallEvents.map((event) => {
    const data = event.data as { tool: string; params: unknown };
    const timestamp = new Date(event.timestamp).toISOString();
    const toolName = colorize(data.tool, 'green');
    const params = JSON.stringify(data.params, null, 2);

    return `  ${colorize('●', 'gray')} [${timestamp}] ${toolName}\n    ${colorize('args:', 'dim')} ${params}`;
  });
}

/**
 * Format output in clean mode (just the result)
 */
function formatClean(execution: ExecutionResult): string {
  return execution.result;
}

/**
 * Format output in verbose mode (with metadata and tool calls)
 */
function formatVerbose(execution: ExecutionResult): string {
  const lines: string[] = [];

  // Header
  lines.push(formatHeader('═══════════════════════════════════════════', 'bright'));
  lines.push(formatHeader('Agent Execution Result', 'bright'));
  lines.push(formatHeader('═══════════════════════════════════════════', 'bright'));
  lines.push('');

  // Agent info
  lines.push(formatKeyValue('Agent', execution.agentName));
  if (execution.sessionId) {
    lines.push(formatKeyValue('Session', execution.sessionId));
  }
  if (execution.duration !== undefined) {
    lines.push(formatKeyValue('Duration', formatDuration(execution.duration)));
  }

  // Extract and show metadata
  const meta = execution.metadata || extractMetadata(execution.events);

  if (meta.iterations && meta.iterations > 0) {
    lines.push('');
    lines.push(formatHeader('Execution Metrics', 'cyan'));
    lines.push(formatKeyValue('Iterations', meta.iterations.toString(), 2));
    lines.push(formatKeyValue('Tool Calls', (meta.toolCalls || 0).toString(), 2));

    if (meta.totalTokens && meta.totalTokens > 0) {
      lines.push(formatKeyValue('Total Tokens', meta.totalTokens.toLocaleString(), 2));
    }

    if (meta.totalCost && meta.totalCost > 0) {
      lines.push(formatKeyValue('Total Cost', formatCost(meta.totalCost), 2));
    }
  }

  // Show tool calls if available
  if (execution.events && execution.events.length > 0) {
    const toolCalls = formatToolCalls(execution.events);
    if (toolCalls.length > 0) {
      lines.push('');
      lines.push(formatHeader('Tool Calls', 'yellow'));
      lines.push(...toolCalls);
    }
  }

  // Result
  lines.push('');
  lines.push(formatHeader('Result', 'green'));
  lines.push('');
  lines.push(execution.result);

  lines.push('');
  lines.push(formatHeader('═══════════════════════════════════════════', 'bright'));

  return lines.join('\n');
}

/**
 * Format output in JSON mode
 */
function formatJson(execution: ExecutionResult): string {
  const meta = execution.metadata || extractMetadata(execution.events);

  const output = {
    result: execution.result,
    agent: execution.agentName,
    sessionId: execution.sessionId,
    duration: execution.duration,
    metrics: {
      iterations: meta.iterations,
      toolCalls: meta.toolCalls,
      totalTokens: meta.totalTokens,
      totalCost: meta.totalCost,
    },
    events: execution.events,
  };

  return JSON.stringify(output, null, 2);
}

/**
 * Main formatting function
 *
 * @param execution - Execution result with metadata
 * @param format - Output format mode
 * @returns Formatted string
 */
export function formatOutput(execution: ExecutionResult, format: OutputFormat = 'clean'): string {
  switch (format) {
    case 'clean':
      return formatClean(execution);
    case 'verbose':
      return formatVerbose(execution);
    case 'json':
      return formatJson(execution);
    default:
      // TypeScript exhaustiveness check
      const _exhaustive: never = format;
      throw new Error(`Unknown format: ${_exhaustive}`);
  }
}

/**
 * Format an error for output
 */
export function formatError(error: Error | string, format: OutputFormat = 'clean'): string {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorStack = typeof error === 'string' ? undefined : error.stack;

  if (format === 'json') {
    return JSON.stringify(
      {
        error: errorMessage,
        stack: errorStack,
      },
      null,
      2
    );
  }

  const lines: string[] = [];

  if (format === 'verbose') {
    lines.push(formatHeader('═══════════════════════════════════════════', 'red'));
    lines.push(colorize('ERROR', 'red'));
    lines.push(formatHeader('═══════════════════════════════════════════', 'red'));
    lines.push('');
  }

  lines.push(colorize(errorMessage, 'red'));

  if (format === 'verbose' && errorStack) {
    lines.push('');
    lines.push(colorize('Stack trace:', 'dim'));
    lines.push(colorize(errorStack, 'dim'));
  }

  return lines.join('\n');
}

/**
 * Format a success message
 */
export function formatSuccess(message: string): string {
  return colorize(`✓ ${message}`, 'green');
}

/**
 * Format a warning message
 */
export function formatWarning(message: string): string {
  return colorize(`⚠ ${message}`, 'yellow');
}

/**
 * Format an info message
 */
export function formatInfo(message: string): string {
  return colorize(`ℹ ${message}`, 'blue');
}
