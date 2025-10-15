import { EventEmitter } from 'events';
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
 * Event-based logger that writes to storage abstraction and emits events for subscribers
 *
 * Replaces the JsonlLogger with a storage-agnostic implementation.
 * Events are written through the SessionStorage interface, allowing
 * for different backends (NoOp, Memory, Filesystem).
 *
 * Also emits events via EventEmitter for real-time subscribers (console, web UI, metrics, etc.)
 */
export class EventLogger implements AgentLogger {
  private readonly toolCallMap = new Map<string, { tool: string; agent: string }>();
  private traceId?: string;
  private parentCallId?: string;
  private readonly emitter = new EventEmitter();

  constructor(
    private readonly storage: SessionStorage,
    private readonly sessionId: string
  ) {
    // Set max listeners to avoid warnings when multiple subscribers exist
    this.emitter.setMaxListeners(20);

    // Storage subscribes to all events for persistence
    // Works with InMemoryStorage, FilesystemStorage, or NoOpStorage
    this.on('*', (event) => {
      this.storage.appendEvent(this.sessionId, event as AnySessionEvent).catch((error) => {
        const eventType =
          typeof event === 'object' && event !== null && 'type' in event
            ? (event as { type: string }).type
            : 'unknown';
        console.error(`Failed to persist event ${eventType}:`, error);
      });
    });
  }

  /**
   * Subscribe to specific event types or '*' for all events
   */
  on(event: string, handler: (event: AnySessionEvent | unknown) => void): void {
    this.emitter.on(event, handler);
  }

  /**
   * Unsubscribe from events
   */
  off(event: string, handler: (event: AnySessionEvent | unknown) => void): void {
    this.emitter.off(event, handler);
  }

  /**
   * Subscribe to a single event occurrence
   */
  once(event: string, handler: (event: AnySessionEvent | unknown) => void): void {
    this.emitter.once(event, handler);
  }

  /**
   * Emit event to subscribers (both specific event name and wildcard)
   */
  private emitEvent(eventName: string, event: AnySessionEvent | unknown): void {
    this.emitter.emit(eventName, event);
    this.emitter.emit('*', event); // Wildcard for catch-all subscribers
  }

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

    // Emit event (storage subscribes automatically in constructor)
    this.emitEvent('message:user', event);
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

    // Emit event (storage subscribes automatically in constructor)
    this.emitEvent('message:assistant', event);
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

    // Emit event (storage subscribes automatically in constructor)
    this.emitEvent('tool:call', event);
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

    // Emit event (storage subscribes automatically in constructor)
    this.emitEvent('tool:result', event);
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

    // Emit event (storage subscribes automatically in constructor)
    this.emitEvent('delegation:start', event);
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

    // Emit event (storage subscribes automatically in constructor)
    this.emitEvent('delegation:complete', event);
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

    // Emit event (storage subscribes automatically in constructor)
    this.emitEvent('agent:start', event);
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

    // Emit event (storage subscribes automatically in constructor)
    this.emitEvent('agent:iteration', event);
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

    // Emit event (storage subscribes automatically in constructor)
    this.emitEvent('agent:complete', event);
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

    // Emit event (storage subscribes automatically in constructor)
    this.emitEvent('agent:error', event);
  }

  logTodoUpdate(todos: Array<{ content: string; status: string; activeForm?: string }>): void {
    const event = {
      type: 'todo_update',
      timestamp: Date.now(),
      data: {
        todos,
      },
    };

    // Emit event (storage subscribes automatically in constructor)
    this.emitEvent('todo:update', event);
  }

  logSafetyLimit(reason: string, agent: string, details?: string): void {
    const event = {
      type: 'safety_limit',
      timestamp: Date.now(),
      data: {
        reason,
        agent,
        details,
      },
    };

    // Emit event (storage subscribes automatically in constructor)
    this.emitEvent('agent:safety_limit', event);
  }

  logSessionRecovery(sessionId: string, messageCount: number, todoCount?: number): void {
    const event = {
      type: 'session_recovery',
      timestamp: Date.now(),
      data: {
        sessionId,
        messageCount,
        todoCount,
      },
    };

    // Emit event (storage subscribes automatically in constructor)
    this.emitEvent('session:recovered', event);
  }

  logModelSelection(agent: string, model: string, provider: string): void {
    const event = {
      type: 'model_selection',
      timestamp: Date.now(),
      data: {
        agent,
        model,
        provider,
      },
    };

    // Emit event (storage subscribes automatically in constructor)
    this.emitEvent('agent:model_selected', event);
  }

  logMCPServerConnected(serverName: string, toolCount: number): void {
    const event = {
      type: 'mcp_server_connected',
      timestamp: Date.now(),
      data: {
        serverName,
        toolCount,
      },
    };

    // Emit event (storage subscribes automatically in constructor)
    this.emitEvent('mcp:server_connected', event);
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
