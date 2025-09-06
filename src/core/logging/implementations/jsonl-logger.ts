import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AgentLogger } from '@/core/logging';
import { ToolResult } from '@/types';

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
export class JsonlLogger implements AgentLogger {
  private readonly filePath: string;
  private readonly sessionId: string;
  private currentParentUuid: string | null = null;
  private readonly eventChain: Map<string, string> = new Map(); // Maps event to its UUID

  constructor(outputDir: string = 'logs', sessionId?: string) {
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
   * Create a base event with common fields
   */
  private createBaseEvent(type: JsonlEvent['type']): JsonlEvent {
    return {
      uuid: uuidv4(),
      parentUuid: this.currentParentUuid,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      isSidechain: false,
      type,
    };
  }

  /**
   * Write an event to the JSONL file with fire-and-forget pattern
   */
  private fireAndForget(event: JsonlEvent): void {
    this.writeEvent(event).catch(() => {
      // Silent failure - logging should not break application
    });
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

  // ============= AgentLogger Interface Implementation =============
  // These methods adapt the JSONL logger to the AgentLogger interface

  logUserMessage(content: string): void {
    const event = this.createBaseEvent('user');
    event.userType = 'external';
    event.cwd = process.cwd();
    event.message = {
      role: 'user',
      content: [
        {
          type: 'text',
          text: content,
        },
      ],
    };

    // Update parent UUID for chaining
    this.currentParentUuid = event.uuid;
    this.fireAndForget(event);
  }

  logAssistantMessage(agent: string, text: string): void {
    const event = this.createBaseEvent('assistant');
    event.requestId = `req_${uuidv4().substring(0, 12)}`;
    event.message = {
      role: 'assistant',
      model: agent || 'claude-3-5-haiku-latest',
      content: [
        {
          type: 'text',
          text: text,
        },
      ],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: undefined,
    };

    // Update parent UUID for chaining
    this.currentParentUuid = event.uuid;
    this.fireAndForget(event);
  }

  logSystemMessage(message: string): void {
    const event = this.createBaseEvent('system');
    event.message = {
      role: 'system',
      content: [{ type: 'text', text: message }],
    };
    this.fireAndForget(event);
  }

  logToolCall(agent: string, tool: string, params: any): void {
    const event = this.createBaseEvent('assistant');
    const toolUseId = `toolu_${uuidv4().substring(0, 12)}`;

    event.message = {
      role: 'assistant',
      model: agent || 'claude-3-5-haiku-latest',
      content: [
        {
          type: 'tool_use',
          id: toolUseId,
          name: tool,
          input: params,
        },
      ],
      stop_reason: null,
      stop_sequence: null,
    };

    // Update parent UUID and track tool use ID
    this.currentParentUuid = event.uuid;
    this.eventChain.set(toolUseId, event.uuid);
    this.fireAndForget(event);
  }

  logToolExecution(_agent: string, tool: string, toolId: string): void {
    const event = this.createBaseEvent('system');
    event.message = {
      role: 'system',
      content: [
        {
          type: 'text',
          text: `Executing tool: ${tool} (id: ${toolId})`,
        },
      ],
    };
    this.fireAndForget(event);
  }

  logToolResult(_agent: string, _tool: string, toolId: string, result: any): void {
    const event = this.createBaseEvent('user');
    event.parentUuid = this.eventChain.get(toolId) || this.currentParentUuid;

    const toolResult: ToolResult =
      typeof result === 'object' && result.error
        ? { error: result.error, content: [] }
        : { content: [{ type: 'text', text: JSON.stringify(result) }] };

    event.message = {
      role: 'user',
      content: [
        {
          tool_use_id: toolId,
          type: 'tool_result',
          content: typeof result === 'string' ? result : JSON.stringify(result),
        },
      ],
    };
    event.toolUseResult = {
      type: 'tool_result',
      ...toolResult,
    };

    // Update parent UUID for chaining
    this.currentParentUuid = event.uuid;
    this.fireAndForget(event);
  }

  logToolError(_agent: string, _tool: string, toolId: string, error: Error): void {
    const event = this.createBaseEvent('user');
    event.parentUuid = this.eventChain.get(toolId) || this.currentParentUuid;

    const toolResult: ToolResult = { error: error.message, content: [] };

    event.message = {
      role: 'user',
      content: [
        {
          tool_use_id: toolId,
          type: 'tool_result',
          content: `Error: ${error.message}`,
        },
      ],
    };
    event.toolUseResult = {
      type: 'tool_result',
      ...toolResult,
    };

    // Update parent UUID for chaining
    this.currentParentUuid = event.uuid;
    this.fireAndForget(event);
  }

  logDelegation(parent: string, child: string, task: string): void {
    const event = this.createBaseEvent('system');
    event.isSidechain = true; // Agent delegations are sidechains
    event.message = {
      role: 'system',
      content: [
        {
          type: 'text',
          text: `Delegating to ${child}: ${task}`,
        },
      ],
    };
    event.agentMetadata = {
      agentName: child,
      depth: 0,
      parentAgent: parent,
    };
    this.fireAndForget(event);
  }

  logDelegationComplete(_parent: string, child: string, result: string): void {
    const event = this.createBaseEvent('system');
    event.message = {
      role: 'system',
      content: [{ type: 'text', text: `Delegation complete: ${child} returned: ${result}` }],
    };
    this.fireAndForget(event);
  }

  logAgentStart(agent: string, _depth: number, task?: string): void {
    const event = this.createBaseEvent('system');
    event.message = {
      role: 'system',
      content: [{ type: 'text', text: `Agent ${agent} starting${task ? `: ${task}` : ''}` }],
    };
    this.fireAndForget(event);
  }

  logAgentIteration(agent: string, iteration: number): void {
    const event = this.createBaseEvent('system');
    event.message = {
      role: 'system',
      content: [{ type: 'text', text: `Agent ${agent} iteration ${iteration}` }],
    };
    event.agentMetadata = {
      agentName: agent,
      depth: 0,
      iterations: iteration,
    };
    this.fireAndForget(event);
  }

  logAgentComplete(agent: string, duration: number): void {
    const event = this.createBaseEvent('system');
    event.message = {
      role: 'system',
      content: [{ type: 'text', text: `Agent ${agent} completed in ${duration}ms` }],
    };
    this.fireAndForget(event);
  }

  logAgentError(agent: string, error: Error): void {
    const event = this.createBaseEvent('system');
    event.message = {
      role: 'system',
      content: [{ type: 'text', text: `Agent ${agent} error: ${error.message}` }],
    };
    this.fireAndForget(event);
  }

  logTodoUpdate(todos: Array<{ content: string; status: string; activeForm?: string }>): void {
    const event = this.createBaseEvent('system');
    const completedCount = todos.filter((t) => t.status === 'completed').length;

    event.message = {
      role: 'system',
      content: [
        {
          type: 'text',
          text: `Todo list updated: ${todos.length} items (${completedCount} completed)`,
        },
      ],
    };
    event.agentMetadata = {
      agentName: 'system',
      depth: 0,
      toolCount: todos.length,
    };
    this.fireAndForget(event);
  }

  flush(): void {
    // JSONL auto-flushes on each write
  }

  close(): void {
    // No resources to close for JSONL file writing
  }
}
