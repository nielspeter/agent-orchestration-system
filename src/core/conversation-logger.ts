import * as fs from 'fs/promises';
import * as path from 'path';

export interface LogEntry {
  timestamp: string;
  agentName: string;
  depth: number;
  type: 'system' | 'user' | 'assistant' | 'tool' | 'delegation' | 'result' | 'error';
  content: string;
  metadata?: {
    toolName?: string;
    subAgent?: string;
    parentAgent?: string;
    executionTime?: number;
    tokenCount?: number;
    toolCount?: number | string;
    messageCount?: number;
    toolCallCount?: number;
    iterations?: number;
    model?: string;
    hasParentContext?: boolean;
    parentMessageCount?: number;
    isSidechain?: boolean;
    willCacheCount?: number;
    parentContext?: boolean;
    groups?: Array<{
      isConcurrent: boolean;
      tools: string[];
    }>;
    result?: { error?: string; success?: boolean };
    [key: string]: unknown; // Allow additional properties with unknown type
  };
}

export interface ConversationLogger {
  log(entry: LogEntry): void;
  flush(): Promise<void>;
}

/**
 * Console logger with colored, hierarchical output
 */
export class ConsoleLogger implements ConversationLogger {
  private readonly colors = {
    system: '\x1b[90m', // gray
    user: '\x1b[36m', // cyan
    assistant: '\x1b[32m', // green
    tool: '\x1b[33m', // yellow
    delegation: '\x1b[35m', // magenta
    result: '\x1b[34m', // blue
    error: '\x1b[31m', // red
    reset: '\x1b[0m',
  };

  private readonly icons = {
    system: '⚙️ ',
    user: '👤',
    assistant: '🤖',
    tool: '🔧',
    delegation: '📋',
    result: '✅',
    error: '❌',
  };

  log(entry: LogEntry): void {
    const indent = '  '.repeat(entry.depth);
    const color = this.colors[entry.type];
    const icon = this.icons[entry.type];
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();

    // Build the log line
    let logLine = `${indent}${color}[${timestamp}] ${icon} `;

    // Add agent name for context
    if (entry.agentName) {
      logLine += `[${entry.agentName}] `;
    }

    // Add type-specific formatting
    switch (entry.type) {
      case 'delegation':
        logLine += `→ Delegating to ${entry.metadata?.subAgent}`;
        break;
      case 'tool':
        logLine += `Tool: ${entry.metadata?.toolName}`;
        break;
      case 'result':
        logLine += 'Result: ';
        break;
      default:
        logLine += `${entry.type.toUpperCase()}: `;
    }

    // Add content (truncate if too long)
    const content =
      typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content, null, 2);

    const maxLength = 200;
    const displayContent =
      content.length > maxLength ? content.substring(0, maxLength) + '...' : content;

    logLine += displayContent;
    logLine += this.colors.reset;

    console.log(logLine);

    // Add execution time if available
    if (entry.metadata?.executionTime) {
      console.log(
        `${indent}  ${this.colors.system}⏱️  Execution time: ${entry.metadata.executionTime}ms${this.colors.reset}`
      );
    }
  }

  async flush(): Promise<void> {
    // Console logger doesn't need to flush
  }
}

/**
 * File logger for persistence and audit trail
 */
export class FileLogger implements ConversationLogger {
  private buffer: LogEntry[] = [];
  private readonly filePath: string;

  constructor(conversationId?: string) {
    const id = conversationId || new Date().toISOString().replace(/[:.]/g, '-');
    this.filePath = path.join(process.cwd(), 'conversations', `${id}.json`);
  }

  log(entry: LogEntry): void {
    this.buffer.push(entry);
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    // Ensure directory exists
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });

    // Read existing data if file exists
    let existingData: LogEntry[] = [];
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      existingData = JSON.parse(content);
    } catch {
      // File doesn't exist yet
    }

    // Append new entries
    const allData = [...existingData, ...this.buffer];

    // Write to file
    await fs.writeFile(this.filePath, JSON.stringify(allData, null, 2), 'utf-8');

    // Clear buffer
    this.buffer = [];
  }
}

/**
 * Combined logger that logs to both console and file
 */
export class CombinedLogger implements ConversationLogger {
  private readonly loggers: ConversationLogger[];

  constructor(loggers: ConversationLogger[]) {
    this.loggers = loggers;
  }

  log(entry: LogEntry): void {
    this.loggers.forEach((logger) => logger.log(entry));
  }

  async flush(): Promise<void> {
    await Promise.all(this.loggers.map((logger) => logger.flush()));
  }
}

/**
 * Logger factory
 */
export class LoggerFactory {
  static createConsoleLogger(): ConversationLogger {
    return new ConsoleLogger();
  }

  static createCombinedLogger(conversationId?: string): ConversationLogger {
    return new CombinedLogger([new ConsoleLogger(), new FileLogger(conversationId)]);
  }
}
