import { AgentLogger, ConsoleVerbosity } from './types';
import { LLMMetadata } from '@/session/types';

export class ConsoleLogger implements AgentLogger {
  private readonly colors = {
    dim: '\x1b[90m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    magenta: '\x1b[35m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
    reset: '\x1b[0m',
  };

  private readonly currentDepth: Map<string, number> = new Map();
  private readonly currentAgent: Map<number, string> = new Map(); // Track active agent at each depth
  private lastLoggedAgent: string | null = null; // Track last agent that logged
  private readonly timestamps: boolean;
  private readonly useColors: boolean;
  private readonly verbosity: ConsoleVerbosity;

  constructor(config?: { timestamps?: boolean; colors?: boolean; verbosity?: ConsoleVerbosity }) {
    this.timestamps = config?.timestamps ?? true;
    this.useColors = config?.colors ?? true;
    this.verbosity = config?.verbosity ?? 'normal';
  }

  private formatTimestamp(): string {
    if (!this.timestamps) return '';
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `[${hours}:${minutes}:${seconds}] `;
  }

  private color(text: string, colorName: keyof typeof this.colors): string {
    if (!this.useColors) return text;
    return `${this.colors[colorName]}${text}${this.colors.reset}`;
  }

  private getIndent(agent: string): string {
    const depth = this.currentDepth.get(agent) || 0;
    return '  '.repeat(depth);
  }
  private addAgentSeparatorIfNeeded(agent?: string): void {
    // Add visual separation when switching between agents
    if (agent && this.lastLoggedAgent && this.lastLoggedAgent !== agent) {
      console.log(''); // Empty line between different agents
    }
    if (agent) {
      this.lastLoggedAgent = agent;
    }
  }

  logUserMessage(content: string): void {
    this.addAgentSeparatorIfNeeded('user');
    const timestamp = this.formatTimestamp();
    console.log(`${timestamp}${this.color('> User', 'cyan')}: ${content}`);
  }

  logAssistantMessage(agent: string, text: string, _metadata?: LLMMetadata): void {
    if (this.verbosity === 'minimal' && text.length > 100) {
      text = text.substring(0, 100) + '...';
    }

    this.addAgentSeparatorIfNeeded(agent);
    const indent = this.getIndent(agent);
    const timestamp = this.formatTimestamp();

    // Split multiline responses and prefix each line with agent name
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      if (i === 0) {
        console.log(`${indent}${timestamp}${this.color(agent, 'green')}: ${line}`);
      } else if (line.trim()) {
        // For continuation lines, indent them but keep agent context
        console.log(
          `${indent}${''.padStart(timestamp.length, ' ')}${this.color('|', 'dim')} ${line}`
        );
      }
    });
  }

  logSystemMessage(message: string): void {
    if (this.verbosity === 'minimal') return;

    // Filter out noisy system messages in normal mode
    const noisyPatterns = [
      'Cache metrics',
      'Agent loaded',
      'Calling claude',
      'Executing',
      'PARALLEL',
      'SEQUENTIAL',
      'Starting',
      'Agent Orchestration',
    ];

    if (
      this.verbosity !== 'verbose' &&
      noisyPatterns.some((pattern) => message.includes(pattern))
    ) {
      return;
    }

    const timestamp = this.formatTimestamp();
    const formattedMessage = `# ${message}`;
    console.log(`${timestamp}${this.color(formattedMessage, 'dim')}`);
  }

  logToolCall(
    agent: string,
    tool: string,
    _toolId: string,
    params: Record<string, unknown>,
    _metadata?: LLMMetadata
  ): void {
    const indent = this.getIndent(agent);
    const timestamp = this.formatTimestamp();

    if (this.verbosity === 'minimal') {
      return;
    } else if (this.verbosity === 'normal') {
      // Show truncated preview of key parameters
      const preview = this.formatToolPreview(params);
      console.log(`${indent}${timestamp}${this.color('  calling', 'dim')} ${tool}(...)`);
      if (preview) {
        const previewLines = preview.split('\n');
        previewLines.forEach((line) => {
          console.log(
            `${indent}${''.padStart(timestamp.length + 2, ' ')}${this.color('│', 'dim')} ${line}`
          );
        });
      }
    } else {
      const paramStr = JSON.stringify(params, null, 2)
        .split('\n')
        .map((line, i) => (i === 0 ? line : `${indent}    ${line}`))
        .join('\n');
      console.log(`${indent}${timestamp}${this.color('  calling', 'dim')} ${tool}(${paramStr})`);
    }
  }

  private formatToolPreview(params: Record<string, unknown>): string {
    const lines: string[] = [];
    const maxLineLength = 300;
    const maxLines = 8;

    // Priority keys to show first
    const priorityKeys = ['file_path', 'pattern', 'path', 'command', 'agent', 'task', 'content'];
    const keys = Object.keys(params);

    // Keys that should never be truncated
    const noTruncateKeys = ['file_path', 'path', 'pattern', 'command', 'agent'];

    // Show priority keys first, then others
    const sortedKeys = [
      ...priorityKeys.filter((k) => keys.includes(k)),
      ...keys.filter((k) => !priorityKeys.includes(k)),
    ];

    for (const key of sortedKeys) {
      if (lines.length >= maxLines) break;

      const value = params[key];
      let valueStr: string;

      if (typeof value === 'string') {
        // Don't truncate important path/command fields - just show them in full
        const isPathOrCommand = noTruncateKeys.includes(key);

        if (isPathOrCommand) {
          // Never truncate these important fields
          valueStr = `"${value.replace(/\n/g, '\\n')}"`;
        } else if (value.length > maxLineLength) {
          // Truncate long content/task fields
          const truncated = value.substring(0, maxLineLength - 3).replace(/\n/g, '\\n');
          valueStr = `"${truncated}..."`;
        } else {
          valueStr = `"${value.replace(/\n/g, '\\n')}"`;
        }
      } else if (Array.isArray(value)) {
        valueStr = `[${value.length} items]`;
      } else if (typeof value === 'object' && value !== null) {
        const objKeys = Object.keys(value);
        valueStr = `{${objKeys.slice(0, 2).join(', ')}${objKeys.length > 2 ? ', ...' : ''}}`;
      } else {
        valueStr = String(value);
      }

      lines.push(`${key}: ${valueStr}`);
    }

    if (sortedKeys.length > maxLines) {
      lines.push(`... (${sortedKeys.length - maxLines} more)`);
    }

    return lines.join('\n');
  }

  logToolExecution(_agent: string, _tool: string, _toolId: string): void {
    // Skip execution logs - they're redundant
    return;
  }

  logToolResult(agent: string, _tool: string, _toolId: string, result: unknown): void {
    if (this.verbosity !== 'verbose') return;

    const indent = this.getIndent(agent);
    const timestamp = this.formatTimestamp();

    let resultStr: string;
    if (typeof result === 'string') {
      resultStr = result;
    } else if (
      result &&
      typeof result === 'object' &&
      'error' in result &&
      (result as { error?: string }).error
    ) {
      resultStr = `Error: ${(result as { error: string }).error}`;
    } else {
      resultStr = JSON.stringify(result, null, 2);
    }

    if (resultStr.length > 200) {
      resultStr = resultStr.substring(0, 200) + '...';
    }

    console.log(`${indent}${timestamp}${this.color('  result:', 'dim')} ${resultStr}`);
  }

  logToolError(agent: string, tool: string, _toolId: string, error: Error): void {
    const indent = this.getIndent(agent);
    const timestamp = this.formatTimestamp();
    console.log(`${indent}${timestamp}${this.color('  ERROR', 'red')}: ${tool} - ${error.message}`);
  }

  logDelegation(parent: string, child: string, task: string): void {
    const parentDepth = this.currentDepth.get(parent) || 0;
    const childDepth = parentDepth + 1;
    this.currentDepth.set(child, childDepth);
    this.currentAgent.set(childDepth, child);

    if (this.verbosity === 'minimal') return;

    this.addAgentSeparatorIfNeeded(parent);
    const indent = this.getIndent(parent);
    const timestamp = this.formatTimestamp();

    console.log(''); // Add space before delegation
    if (this.verbosity === 'verbose') {
      const taskPreview = task.length > 100 ? task.substring(0, 100) + '...' : task;
      const delegationMessage = `[Delegating to ${child}]`;
      console.log(`${indent}${timestamp}${this.color(delegationMessage, 'magenta')}`);
      console.log(`${indent}${''.padStart(timestamp.length, ' ')}Task: ${taskPreview}`);
    } else {
      const callingMessage = `[Calling ${child}]`;
      console.log(`${indent}${timestamp}${this.color(callingMessage, 'magenta')}`);
    }
  }

  logDelegationComplete(parent: string, child: string, result: string): void {
    this.currentDepth.delete(child);
    const childDepth = this.currentDepth.get(parent) || 1;
    this.currentAgent.delete(childDepth);

    if (this.verbosity !== 'verbose') return;

    const indent = this.getIndent(parent);
    const timestamp = this.formatTimestamp();
    const resultPreview = result.length > 100 ? result.substring(0, 100) + '...' : result;
    const returnMessage = `[${child} returned]`;
    console.log(`${indent}${timestamp}${this.color(returnMessage, 'magenta')}: ${resultPreview}`);
    console.log(''); // Add space after delegation completes
  }

  logAgentStart(agent: string, depth: number, task?: string): void {
    this.currentDepth.set(agent, depth);
    this.currentAgent.set(depth, agent);

    if (this.verbosity === 'minimal') return;

    const indent = this.getIndent(agent);
    const timestamp = this.formatTimestamp();

    console.log(''); // Add blank line before agent starts
    const agentHeader = `=== ${agent} ===`;
    if (task && this.verbosity === 'verbose') {
      console.log(`${indent}${timestamp}${this.color(agentHeader, 'green')}`);
      console.log(`${indent}${''.padStart(timestamp.length, ' ')}Task: ${task}`);
    } else {
      console.log(`${indent}${timestamp}${this.color(agentHeader, 'green')}`);
    }
  }

  logAgentIteration(agent: string, iteration: number): void {
    if (this.verbosity !== 'verbose') return;

    const indent = this.getIndent(agent);
    const timestamp = this.formatTimestamp();
    const iterationMessage = `(iteration ${iteration})`;
    console.log(`${indent}${timestamp}${this.color(iterationMessage, 'dim')}`);
  }

  logAgentComplete(agent: string, duration: number): void {
    if (this.verbosity === 'minimal') return;

    const indent = this.getIndent(agent);
    const timestamp = this.formatTimestamp();
    const durationStr = duration > 1000 ? `${(duration / 1000).toFixed(1)}s` : `${duration}ms`;
    const completionMessage = `=== ${agent} completed (${durationStr}) ===`;
    console.log(`${indent}${timestamp}${this.color(completionMessage, 'dim')}`);
    console.log(''); // Add blank line after agent completes

    this.currentDepth.delete(agent);
    const depth = Array.from(this.currentDepth.values()).find(
      (d) => this.currentAgent.get(d) === agent
    );
    if (depth !== undefined) {
      this.currentAgent.delete(depth);
    }
  }

  logAgentError(agent: string, error: Error): void {
    const indent = this.getIndent(agent);
    const timestamp = this.formatTimestamp();
    const errorHeader = `=== ${agent} ERROR ===`;
    console.log(`${indent}${timestamp}${this.color(errorHeader, 'red')}`);
    console.log(`${indent}${timestamp}${error.message}`);

    if (this.verbosity === 'verbose' && error.stack) {
      const stackLines = error.stack.split('\n').slice(1);
      stackLines.forEach((line) => {
        console.log(`${indent}  ${this.color(line.trim(), 'dim')}`);
      });
    }
    console.log(''); // Add blank line after error

    this.currentDepth.delete(agent);
  }

  logTodoUpdate(todos: Array<{ content: string; status: string; activeForm?: string }>): void {
    if (this.verbosity !== 'verbose') return;

    const timestamp = this.formatTimestamp();
    const pending = todos.filter((t) => t.status === 'pending').length;
    const inProgress = todos.filter((t) => t.status === 'in_progress').length;
    const completed = todos.filter((t) => t.status === 'completed').length;

    const todoMessage = `# Todos: ${pending} pending, ${inProgress} active, ${completed} done`;
    console.log(`${timestamp}${this.color(todoMessage, 'dim')}`);
  }

  logSafetyLimit(reason: string, agent: string, details?: string): void {
    const timestamp = this.formatTimestamp();
    const message = details ? `${reason}: ${details}` : reason;
    console.log(`${timestamp}${this.color(`🛑 Safety limit (${agent}): ${message}`, 'red')}`);
  }

  logSessionRecovery(sessionId: string, messageCount: number, todoCount?: number): void {
    if (this.verbosity === 'minimal') return;

    const timestamp = this.formatTimestamp();
    const todoInfo = todoCount ? `, ${todoCount} todos` : '';
    console.log(
      `${timestamp}${this.color(`# Recovered session ${sessionId}: ${messageCount} messages${todoInfo}`, 'dim')}`
    );
  }

  logModelSelection(agent: string, model: string, provider: string): void {
    if (this.verbosity !== 'verbose') return;

    const timestamp = this.formatTimestamp();
    console.log(`${timestamp}${this.color(`# ${agent} using ${model} (${provider})`, 'dim')}`);
  }

  logMCPServerConnected(serverName: string, toolCount: number): void {
    if (this.verbosity === 'minimal') return;

    const timestamp = this.formatTimestamp();
    console.log(
      `${timestamp}${this.color(`# MCP server ${serverName} connected: ${toolCount} tools`, 'dim')}`
    );
  }

  async getSessionEvents(): Promise<import('@/session/types').AnySessionEvent[]> {
    return []; // Console logger doesn't store events, only displays them
  }

  flush(): void {
    // Console output is immediate, no buffering
  }

  close(): void {
    // Clear depth tracking
    this.currentDepth.clear();
    this.currentAgent.clear();
    this.lastLoggedAgent = null;
  }
}
