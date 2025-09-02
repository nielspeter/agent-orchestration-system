import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Message, ToolResult } from '../types';

/**
 * Claude Code compatible JSONL event structure
 */
export interface JsonlEvent {
  // Core identifiers
  uuid: string;
  parentUuid: string | null;
  timestamp: string;

  // Conversation metadata
  sessionId: string;
  isSidechain: boolean;

  // Event type and content
  type: 'user' | 'assistant' | 'system' | 'summary';
  message?: {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: Array<{
      type: 'text' | 'tool_use' | 'tool_result';
      text?: string;
      id?: string;
      name?: string;
      input?: Record<string, unknown>;
      tool_use_id?: string;
      content?: string | Record<string, unknown>;
    }>;
    model?: string;
    stop_reason?: string | null;
    stop_sequence?: string | null;
    usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation?: {
        ephemeral_5m_input_tokens?: number;
        ephemeral_1h_input_tokens?: number;
      };
      service_tier?: string;
    };
  };

  // Optional metadata
  summary?: string;
  leafUuid?: string;
  userType?: 'external' | 'internal';
  cwd?: string;
  version?: string;
  gitBranch?: string;
  isMeta?: boolean;
  requestId?: string;

  // Tool execution results
  toolUseResult?: {
    type: string;
    file?: {
      filePath: string;
      content: string;
      numLines: number;
      startLine: number;
      totalLines: number;
    };
    [key: string]: unknown;
  };

  // Agent-specific metadata (our extension)
  agentMetadata?: {
    agentName: string;
    depth: number;
    parentAgent?: string;
    executionTime?: number;
    iterations?: number;
    toolCount?: number;
  };
}

/**
 * JSONL Logger compatible with Claude Code's conversation format
 */
export class JsonlLogger {
  private readonly filePath: string;
  private readonly sessionId: string;
  private currentParentUuid: string | null = null;
  private readonly eventChain: Map<string, string> = new Map(); // Maps event to its UUID

  constructor(outputDir: string = 'conversations', sessionId?: string) {
    // Always use UUID for sessionId
    this.sessionId = sessionId || uuidv4();

    // Prepend timestamp to filename for chronological sorting
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}-${this.sessionId}.jsonl`;
    this.filePath = path.join(process.cwd(), outputDir, filename);
  }

  /**
   * Initialize the log file with a summary event
   */
  async initialize(summary: string): Promise<void> {
    const summaryEvent: JsonlEvent = {
      type: 'summary',
      summary,
      leafUuid: uuidv4(),
      uuid: uuidv4(),
      parentUuid: null,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      isSidechain: false,
    };

    await this.writeEvent(summaryEvent);
  }

  /**
   * Log a user message
   */
  async logUserMessage(content: string, parentUuid?: string): Promise<string> {
    const uuid = uuidv4();

    const event: JsonlEvent = {
      uuid,
      parentUuid: parentUuid || this.currentParentUuid,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      isSidechain: false,
      type: 'user',
      userType: 'external',
      cwd: process.cwd(),
      message: {
        role: 'user',
        content: [
          {
            type: 'text',
            text: content,
          },
        ],
      },
    };

    await this.writeEvent(event);
    this.currentParentUuid = uuid;
    return uuid;
  }

  /**
   * Log an assistant message
   */
  async logAssistantMessage(
    content: string,
    model: string,
    usage?: Record<string, unknown>,
    parentUuid?: string
  ): Promise<string> {
    const uuid = uuidv4();
    const requestId = `req_${uuidv4().substring(0, 12)}`;

    // Convert usage to proper type if provided
    const typedUsage = usage
      ? {
          input_tokens: (usage.input_tokens as number) || 0,
          output_tokens: (usage.output_tokens as number) || 0,
          cache_creation_input_tokens: usage.cache_creation_input_tokens as number | undefined,
          cache_read_input_tokens: usage.cache_read_input_tokens as number | undefined,
          cache_creation: usage.cache_creation as
            | {
                ephemeral_5m_input_tokens?: number;
                ephemeral_1h_input_tokens?: number;
              }
            | undefined,
          service_tier: usage.service_tier as string | undefined,
        }
      : undefined;

    const event: JsonlEvent = {
      uuid,
      parentUuid: parentUuid || this.currentParentUuid,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      isSidechain: false,
      type: 'assistant',
      requestId,
      message: {
        role: 'assistant',
        model,
        content: [
          {
            type: 'text',
            text: content,
          },
        ],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: typedUsage,
      },
    };

    await this.writeEvent(event);
    this.currentParentUuid = uuid;
    return uuid;
  }

  /**
   * Log a tool use
   */
  async logToolUse(
    toolName: string,
    toolInput: Record<string, unknown>,
    model: string,
    parentUuid?: string
  ): Promise<string> {
    const uuid = uuidv4();
    const toolUseId = `toolu_${uuidv4().substring(0, 12)}`;

    const event: JsonlEvent = {
      uuid,
      parentUuid: parentUuid || this.currentParentUuid,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      isSidechain: false,
      type: 'assistant',
      message: {
        role: 'assistant',
        model,
        content: [
          {
            type: 'tool_use',
            id: toolUseId,
            name: toolName,
            input: toolInput,
          },
        ],
        stop_reason: null,
        stop_sequence: null,
      },
    };

    await this.writeEvent(event);
    this.currentParentUuid = uuid;
    this.eventChain.set(toolUseId, uuid);
    return toolUseId;
  }

  /**
   * Log a tool result
   */
  async logToolResult(toolUseId: string, result: ToolResult, parentUuid?: string): Promise<string> {
    const uuid = uuidv4();

    const event: JsonlEvent = {
      uuid,
      parentUuid: parentUuid || this.eventChain.get(toolUseId) || this.currentParentUuid,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      isSidechain: false,
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            tool_use_id: toolUseId,
            type: 'tool_result',
            content: typeof result === 'string' ? result : JSON.stringify(result),
          },
        ],
      },
      toolUseResult: {
        type: 'tool_result',
        ...result,
      },
    };

    await this.writeEvent(event);
    this.currentParentUuid = uuid;
    return uuid;
  }

  /**
   * Log an agent delegation (sidechain)
   */
  async logAgentDelegation(
    agentName: string,
    prompt: string,
    parentAgent?: string,
    depth: number = 0
  ): Promise<string> {
    const uuid = uuidv4();

    const event: JsonlEvent = {
      uuid,
      parentUuid: this.currentParentUuid,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      isSidechain: true, // Agent delegations are sidechains
      type: 'system',
      message: {
        role: 'system',
        content: [
          {
            type: 'text',
            text: `Delegating to ${agentName}: ${prompt}`,
          },
        ],
      },
      agentMetadata: {
        agentName,
        depth,
        parentAgent,
      },
    };

    await this.writeEvent(event);
    return uuid;
  }

  /**
   * Start a new sidechain for agent execution
   */
  startSidechain(): string {
    const previousParent = this.currentParentUuid;
    this.currentParentUuid = uuidv4();
    return previousParent || '';
  }

  /**
   * End a sidechain and restore parent context
   */
  endSidechain(previousParent: string): void {
    this.currentParentUuid = previousParent;
  }

  /**
   * Write an event to the JSONL file
   */
  async writeEvent(event: JsonlEvent): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });

    const line = JSON.stringify(event) + '\n';
    await fs.appendFile(this.filePath, line, 'utf-8');
  }

  /**
   * Read all events from the log file
   */
  async readEvents(): Promise<JsonlEvent[]> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      return content
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));
    } catch {
      return [];
    }
  }

  /**
   * Convert our Message format to JSONL events
   */
  static fromMessages(messages: Message[], sessionId?: string): JsonlEvent[] {
    const events: JsonlEvent[] = [];
    let currentParent: string | null = null;

    for (const msg of messages) {
      const uuid = uuidv4();
      const event: JsonlEvent = {
        uuid,
        parentUuid: currentParent,
        timestamp: new Date().toISOString(),
        sessionId: sessionId || uuidv4(),
        isSidechain: false,
        type: msg.role === 'user' ? 'user' : 'assistant',
        message: {
          role: msg.role,
          content: [
            {
              type: 'text',
              text: msg.content,
            },
          ],
        },
      };

      events.push(event);
      currentParent = uuid;
    }

    return events;
  }

  /**
   * Get file path for external tools
   */
  getFilePath(): string {
    return this.filePath;
  }

  /**
   * Get the session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Get just the filename (not full path)
   */
  getFilename(): string {
    return path.basename(this.filePath);
  }
}
