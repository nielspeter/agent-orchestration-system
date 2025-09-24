import { AgentLogger } from './types.js';
import {
  AnySessionEvent,
  AssistantMessageEvent,
  LLMMetadata,
  SessionStorage,
  ToolCallEvent,
  ToolResultEvent,
  UserMessageEvent,
} from '@/session/types';

/**
 * Event-based logger that writes to storage abstraction
 *
 * Replaces the JsonlLogger with a storage-agnostic implementation.
 * Events are written through the SessionStorage interface, allowing
 * for different backends (NoOp, Memory, Filesystem).
 */
export class EventLogger implements AgentLogger {
  private readonly toolCallMap = new Map<string, { tool: string; agent: string }>();
  private traceId?: string;
  private parentCallId?: string;

  constructor(
    private readonly storage: SessionStorage,
    private readonly sessionId: string
  ) {}

  setTraceContext(traceId?: string, parentCallId?: string): void {
    this.traceId = traceId;
    this.parentCallId = parentCallId;
  }

  logUserMessage(content: string): void {
    const event: UserMessageEvent = {
      type: 'user',
      timestamp: Date.now(),
      data: {
        role: 'user',
        content,
      },
    };

    // Fire and forget - don't await
    this.storage.appendEvent(this.sessionId, event).catch((error) => {
      console.error('Failed to log user message:', error);
    });
  }

  logAssistantMessage(agent: string, content: string, metadata?: LLMMetadata): void {
    const event: AssistantMessageEvent = {
      type: 'assistant',
      timestamp: Date.now(),
      data: {
        role: 'assistant',
        content,
        agent,
      },
      metadata,
    };

    // Fire and forget - don't await
    this.storage.appendEvent(this.sessionId, event).catch((error) => {
      console.error('Failed to log assistant message:', error);
    });
  }

  logSystemMessage(message: string): void {
    // System messages can be logged as special events or ignored
    // For now, we'll treat them as assistant messages from 'system'
    this.logAssistantMessage('system', message);
  }

  logToolCall(
    agent: string,
    tool: string,
    toolId: string,
    params: Record<string, unknown>,
    metadata?: LLMMetadata
  ): void {
    // Store mapping for later use
    this.toolCallMap.set(toolId, { tool, agent });

    const event: ToolCallEvent = {
      type: 'tool_call',
      timestamp: Date.now(),
      data: {
        id: toolId,
        tool,
        params,
        agent,
        traceId: this.traceId,
        parentCallId: this.parentCallId,
      },
      metadata,
    };

    // Fire and forget - don't await
    this.storage.appendEvent(this.sessionId, event).catch((error) => {
      console.error('Failed to log tool call:', error);
    });
  }

  logToolExecution(agent: string, tool: string, toolId: string): void {
    // Store the tool execution info for result/error logging
    this.toolCallMap.set(toolId, { tool, agent });
    // Actual execution is already tracked by tool_call event
  }

  logToolResult(_agent: string, _tool: string, toolId: string, result: unknown): void {
    // Calculate size for token estimation with circular reference protection
    let resultStr: string;
    let resultSizeBytes: number;
    let estimatedTokens: number;

    try {
      resultStr = JSON.stringify(result);
      resultSizeBytes = new TextEncoder().encode(resultStr).length;
      estimatedTokens = Math.ceil(resultSizeBytes / 4); // Rough estimate: 1 token ≈ 4 bytes
    } catch {
      // Handle circular references or non-serializable objects
      resultStr = '[Circular or non-serializable]';
      resultSizeBytes = resultStr.length;
      estimatedTokens = Math.ceil(resultSizeBytes / 4);
    }

    const event: ToolResultEvent = {
      type: 'tool_result',
      timestamp: Date.now(),
      data: {
        toolCallId: toolId,
        result,
        resultSizeBytes,
        estimatedTokens,
      },
    };

    // Fire and forget - don't await
    this.storage.appendEvent(this.sessionId, event).catch((error) => {
      console.error('Failed to log tool result:', error);
    });
  }

  logToolError(agent: string, tool: string, toolId: string, error: Error): void {
    // Log errors as tool results with error information
    this.logToolResult(agent, tool, toolId, {
      error: true,
      message: error.message,
      stack: error.stack,
    });
  }

  logDelegation(parent: string, child: string, task: string): void {
    // Delegation is tracked through tool calls to the Delegate tool
    // This is additional metadata that could be stored if needed
    const event = {
      type: 'delegation',
      timestamp: Date.now(),
      data: {
        parent,
        child,
        task,
      },
    };

    // Fire and forget - don't await
    this.storage.appendEvent(this.sessionId, event).catch((error) => {
      console.error('Failed to log delegation:', error);
    });
  }

  logDelegationComplete(parent: string, child: string, result: string): void {
    // Delegation completion is tracked through tool results
    const event = {
      type: 'delegation_complete',
      timestamp: Date.now(),
      data: {
        parent,
        child,
        result,
      },
    };

    // Fire and forget - don't await
    this.storage.appendEvent(this.sessionId, event).catch((error) => {
      console.error('Failed to log delegation complete:', error);
    });
  }

  logAgentStart(agent: string, depth: number, task?: string): void {
    const event = {
      type: 'agent_start',
      timestamp: Date.now(),
      data: {
        agent,
        depth,
        task,
      },
    };

    // Fire and forget - don't await
    this.storage.appendEvent(this.sessionId, event).catch((error) => {
      console.error('Failed to log agent start:', error);
    });
  }

  logAgentIteration(agent: string, iteration: number): void {
    const event = {
      type: 'agent_iteration',
      timestamp: Date.now(),
      data: {
        agent,
        iteration,
      },
    };

    // Fire and forget - don't await
    this.storage.appendEvent(this.sessionId, event).catch((error) => {
      console.error('Failed to log agent iteration:', error);
    });
  }

  logAgentComplete(agent: string, duration: number): void {
    const event = {
      type: 'agent_complete',
      timestamp: Date.now(),
      data: {
        agent,
        duration,
      },
    };

    // Fire and forget - don't await
    this.storage.appendEvent(this.sessionId, event).catch((error) => {
      console.error('Failed to log agent complete:', error);
    });
  }

  logAgentError(agent: string, error: Error): void {
    const event = {
      type: 'agent_error',
      timestamp: Date.now(),
      data: {
        agent,
        error: {
          message: error.message,
          stack: error.stack,
        },
      },
    };

    // Fire and forget - don't await
    this.storage.appendEvent(this.sessionId, event).catch((error) => {
      console.error('Failed to log agent error:', error);
    });
  }

  logTodoUpdate(todos: Array<{ content: string; status: string; activeForm?: string }>): void {
    const event = {
      type: 'todo_update',
      timestamp: Date.now(),
      data: {
        todos,
      },
    };

    // Fire and forget - don't await
    this.storage.appendEvent(this.sessionId, event).catch((error) => {
      console.error('Failed to log todo update:', error);
    });
  }

  async getSessionEvents(): Promise<AnySessionEvent[]> {
    // Return events from storage, properly typed
    const events = await this.storage.readEvents(this.sessionId);
    // Filter to only return properly typed session events
    return events.filter(
      (e): e is AnySessionEvent =>
        typeof e === 'object' &&
        e !== null &&
        'type' in e &&
        ['user', 'assistant', 'tool_call', 'tool_result'].includes((e as AnySessionEvent).type)
    );
  }

  flush(): void {
    // Storage implementations handle their own flushing
    // This is a no-op for the event logger
  }

  close(): void {
    // Storage implementations handle their own cleanup
    // This is a no-op for the event logger
  }
}
