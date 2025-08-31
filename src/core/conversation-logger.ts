import { JsonlEvent, JsonlLogger } from './jsonl-logger';
import { v4 as uuidv4 } from 'uuid';

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
    [key: string]: unknown;
  };
}

export interface ConversationLogger {
  log(entry: LogEntry): void;
  flush(): Promise<void>;
  initialize?(summary: string): Promise<void>;
}

/**
 * Bridge logger that outputs to both console and JSONL format
 */
export class ConsoleLogger implements ConversationLogger {
  private jsonlLogger: JsonlLogger;
  private sessionId: string;
  private currentModel: string = 'claude-3-5-haiku-latest';
  private toolUseIds: Map<string, string> = new Map();

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

  constructor(sessionId?: string) {
    this.sessionId = sessionId || uuidv4();
    this.jsonlLogger = new JsonlLogger(this.sessionId);
  }

  log(entry: LogEntry): void {
    // Console output (keep existing visualization)
    this.logToConsole(entry);

    // JSONL output (Claude Code compatible)
    this.logToJsonl(entry);
  }

  private logToConsole(entry: LogEntry): void {
    const indent = '  '.repeat(entry.depth);
    const color = this.colors[entry.type];
    const icon = this.icons[entry.type];
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();

    let logLine = `${indent}${color}[${timestamp}] ${icon} `;

    if (entry.agentName) {
      logLine += `[${entry.agentName}] `;
    }

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

    const content =
      typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content, null, 2);

    const maxLength = 200;
    const displayContent =
      content.length > maxLength ? content.substring(0, maxLength) + '...' : content;

    logLine += displayContent;
    logLine += this.colors.reset;

    console.log(logLine);

    if (entry.metadata?.executionTime) {
      console.log(
        `${indent}  ${this.colors.system}⏱️  Execution time: ${entry.metadata.executionTime}ms${this.colors.reset}`
      );
    }
  }

  private async logToJsonl(entry: LogEntry): Promise<void> {
    // Update model if provided
    if (entry.metadata?.model) {
      this.currentModel = entry.metadata.model;
    }

    switch (entry.type) {
      case 'user':
        await this.jsonlLogger.logUserMessage(entry.content);
        break;

      case 'assistant':
        await this.jsonlLogger.logAssistantMessage(entry.content, this.currentModel, {
          input_tokens: entry.metadata?.tokenCount || 0,
          output_tokens: 0,
          cache_read_input_tokens: entry.metadata?.parentMessageCount || 0,
          service_tier: 'standard',
        });
        break;

      case 'tool':
        const toolUseId = await this.jsonlLogger.logToolUse(
          entry.metadata?.toolName || 'unknown',
          entry.content,
          this.currentModel
        );
        this.toolUseIds.set(entry.metadata?.toolName || 'unknown', toolUseId);
        break;

      case 'delegation':
        await this.jsonlLogger.logAgentDelegation(
          entry.metadata?.subAgent || '',
          entry.content,
          entry.metadata?.parentAgent,
          entry.depth
        );
        break;

      case 'result':
        // Log as assistant message with result
        await this.jsonlLogger.logAssistantMessage(entry.content, this.currentModel, {
          input_tokens: entry.metadata?.tokenCount || 0,
          output_tokens: 0,
          service_tier: 'standard',
        });
        break;

      case 'system':
      case 'error':
        // Log as system events in JSONL
        const event: JsonlEvent = {
          uuid: uuidv4(),
          parentUuid: null,
          timestamp: entry.timestamp,
          sessionId: this.sessionId,
          isSidechain: entry.metadata?.isSidechain || false,
          type: 'system',
          message: {
            role: 'system',
            content: [
              {
                type: 'text',
                text: entry.content,
              },
            ],
          },
          agentMetadata: {
            agentName: entry.agentName,
            depth: entry.depth,
            parentAgent: entry.metadata?.parentAgent,
            executionTime: entry.metadata?.executionTime,
            iterations: entry.metadata?.iterations,
            toolCount: Number(entry.metadata?.toolCount) || undefined,
          },
        };
        await this.jsonlLogger.writeEvent(event);
        break;
    }
  }

  async flush(): Promise<void> {
    // JSONL logger auto-flushes, but we can read events if needed
  }

  async initialize(summary: string): Promise<void> {
    await this.jsonlLogger.initialize(summary);
  }
}

/**
 * File logger now uses JSONL format
 */
export class FileLogger implements ConversationLogger {
  private jsonlLogger: JsonlLogger;
  private sessionId: string;
  private currentModel: string = 'claude-3-5-haiku-latest';

  constructor(conversationId?: string) {
    this.sessionId = conversationId || uuidv4();
    this.jsonlLogger = new JsonlLogger(this.sessionId);
  }

  log(entry: LogEntry): void {
    // Convert LogEntry to JSONL format
    this.logToJsonl(entry).catch(console.error);
  }

  private async logToJsonl(entry: LogEntry): Promise<void> {
    if (entry.metadata?.model) {
      this.currentModel = entry.metadata.model;
    }

    const event: JsonlEvent = {
      uuid: uuidv4(),
      parentUuid: null,
      timestamp: entry.timestamp,
      sessionId: this.sessionId,
      isSidechain: entry.metadata?.isSidechain || false,
      type: entry.type === 'error' ? 'system' : (entry.type as any),
      message: {
        role: entry.type === 'user' ? 'user' : entry.type === 'assistant' ? 'assistant' : 'system',
        content: [
          {
            type: 'text',
            text: entry.content,
          },
        ],
        model: this.currentModel,
      },
      agentMetadata: {
        agentName: entry.agentName,
        depth: entry.depth,
        parentAgent: entry.metadata?.parentAgent,
        executionTime: entry.metadata?.executionTime,
        iterations: entry.metadata?.iterations,
        toolCount: Number(entry.metadata?.toolCount) || undefined,
      },
    };

    await this.jsonlLogger['writeEvent'](event);
  }

  async flush(): Promise<void> {
    // JSONL auto-flushes
  }

  async initialize(summary: string): Promise<void> {
    await this.jsonlLogger.initialize(summary);
  }
}

/**
 * Combined logger now uses JSONL format for both console and file
 */
export class CombinedLogger implements ConversationLogger {
  private consoleLogger: ConsoleLogger;
  private sessionId: string;

  constructor(sessionId?: string) {
    this.sessionId = sessionId || uuidv4();
    this.consoleLogger = new ConsoleLogger(this.sessionId);
  }

  log(entry: LogEntry): void {
    this.consoleLogger.log(entry);
  }

  async flush(): Promise<void> {
    await this.consoleLogger.flush();
  }

  async initialize(summary: string): Promise<void> {
    await this.consoleLogger.initialize(summary);
  }
}

/**
 * Logger factory for JSONL-based logging
 */
export class LoggerFactory {
  static createConsoleLogger(sessionId?: string): ConversationLogger {
    return new ConsoleLogger(sessionId);
  }

  static createCombinedLogger(conversationId?: string): ConversationLogger {
    return new CombinedLogger(conversationId);
  }
}
