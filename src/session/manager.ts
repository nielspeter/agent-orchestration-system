import { AnySessionEvent, SessionStorage, ToolCallEvent } from './types';
import { TodoItem } from '@/tools/todowrite.tool';
import { isSessionEvent } from '@/utils/type-guards';
import { Message, ToolCall } from '@/base-types';

// Using Message type from base-types for consistency
// This ensures compatibility with the rest of the system

/**
 * Simple session manager for recovery
 *
 * Converts stored events back into LLM message format.
 * The recovered messages can be sent directly to the LLM
 * to continue the conversation from where it left off.
 */
export class SimpleSessionManager {
  constructor(private readonly storage: SessionStorage) {}

  /**
   * Recover a session from storage
   *
   * Reads all events and converts them to base-types Message format.
   * The messages represent the complete conversation history
   * and can be sent to the LLM to continue execution.
   */
  async recoverSession(sessionId: string): Promise<Message[]> {
    const events = await this.storage.readEvents(sessionId);
    const messages: Message[] = [];

    for (const event of events) {
      if (!isSessionEvent(event)) {
        console.warn('Invalid event format:', event);
        continue;
      }

      // Type guard ensures event matches expected structure
      const typedEvent = event as AnySessionEvent;

      switch (typedEvent.type) {
        case 'user': {
          messages.push({
            role: 'user',
            content: typedEvent.data.content,
          });
          break;
        }

        case 'assistant': {
          // Check if this is a text response or tool call based on content
          const content = typedEvent.data.content;
          if (typeof content === 'string') {
            messages.push({
              role: 'assistant',
              content: content,
            });
          }
          break;
        }

        case 'tool_call': {
          // Tool calls are assistant messages with tool_calls array
          const toolCall: ToolCall = {
            id: typedEvent.data.id,
            type: 'function',
            function: {
              name: typedEvent.data.tool,
              arguments: JSON.stringify(typedEvent.data.params),
            },
          };
          messages.push({
            role: 'assistant',
            tool_calls: [toolCall],
          });
          break;
        }

        case 'tool_result': {
          // Tool results use the 'tool' role
          messages.push({
            role: 'tool',
            content: JSON.stringify(typedEvent.data.result),
            tool_call_id: typedEvent.data.toolCallId,
          });
          break;
        }

        default: {
          // Silently skip other event types (agent_iteration, agent_start, etc.)
          // These are metadata events that don't need to be converted to messages
        }
      }
    }

    return messages;
  }

  /**
   * Check if a session has an incomplete tool call
   *
   * This happens when the last message is a tool_use without a corresponding tool_result.
   * In this case, the tool needs to be executed before continuing.
   */
  hasIncompleteToolCall(messages: Message[]): boolean {
    if (messages.length === 0) {
      return false;
    }

    const lastMessage = messages[messages.length - 1];

    // Check if last message is an assistant message with tool_calls
    return !!(
      lastMessage.role === 'assistant' &&
      lastMessage.tool_calls &&
      lastMessage.tool_calls.length > 0
    );
  }

  /**
   * Extract the last tool call from messages
   *
   * Used when we need to execute an incomplete tool call.
   */
  getLastToolCall(messages: Message[]): { id: string; name: string; input: unknown } | null {
    if (messages.length === 0) {
      return null;
    }

    const lastMessage = messages[messages.length - 1];

    if (
      lastMessage.role === 'assistant' &&
      lastMessage.tool_calls &&
      lastMessage.tool_calls.length > 0
    ) {
      const toolCall = lastMessage.tool_calls[0]; // Get the first tool call
      try {
        return {
          id: toolCall.id,
          name: toolCall.function.name,
          input: JSON.parse(toolCall.function.arguments),
        };
      } catch {
        return {
          id: toolCall.id,
          name: toolCall.function.name,
          input: {},
        };
      }
    }

    return null;
  }

  /**
   * Add synthetic tool results for incomplete tool calls
   *
   * This fixes sessions that ended with tool calls but no results,
   * making them valid for the Anthropic API again.
   */
  addMissingToolResults(messages: Message[]): Message[] {
    const result: Message[] = [];
    const pendingToolCalls = new Map<string, boolean>();

    for (const message of messages) {
      result.push(message);

      // Track tool calls
      if (message.role === 'assistant' && message.tool_calls) {
        for (const toolCall of message.tool_calls) {
          pendingToolCalls.set(toolCall.id, true);
        }
      }

      // Mark tool calls as complete when we see their results
      if (message.role === 'tool' && message.tool_call_id) {
        pendingToolCalls.delete(message.tool_call_id);
      }
    }

    // Add synthetic error results for any incomplete tool calls
    for (const [toolCallId] of pendingToolCalls) {
      result.push({
        role: 'tool',
        tool_call_id: toolCallId,
        content: JSON.stringify({
          error: 'Tool execution was interrupted. This result was added during session recovery.',
        }),
      });
    }

    return result;
  }

  /**
   * Clean incomplete tool calls by removing them entirely
   *
   * Removes assistant messages with tool calls that don't have results,
   * and any messages that came after them.
   */
  cleanIncompleteToolCalls(messages: Message[]): Message[] {
    const result: Message[] = [];
    const toolCallIds = new Set<string>();
    const toolResultIds = new Set<string>();

    // First pass: collect all tool call and result IDs
    for (const message of messages) {
      if (message.role === 'assistant' && message.tool_calls) {
        for (const toolCall of message.tool_calls) {
          toolCallIds.add(toolCall.id);
        }
      }
      if (message.role === 'tool' && message.tool_call_id) {
        toolResultIds.add(message.tool_call_id);
      }
    }

    // Find incomplete tool call IDs
    const incompleteIds = new Set<string>();
    for (const id of toolCallIds) {
      if (!toolResultIds.has(id)) {
        incompleteIds.add(id);
      }
    }

    // Second pass: build result excluding incomplete tool calls
    let foundIncomplete = false;
    for (const message of messages) {
      if (foundIncomplete) {
        // Skip all messages after an incomplete tool call
        break;
      }

      if (message.role === 'assistant' && message.tool_calls) {
        // Check if this message has any incomplete tool calls
        const hasIncomplete = message.tool_calls.some((tc) => incompleteIds.has(tc.id));
        if (hasIncomplete) {
          foundIncomplete = true;
          continue; // Skip this message
        }
      }

      result.push(message);
    }

    return result;
  }

  /**
   * Truncate messages to the last valid point
   *
   * Removes everything after the last complete exchange.
   */
  truncateToLastValidPoint(messages: Message[]): Message[] {
    // Find the last point where we have a complete exchange
    let lastValidIndex = messages.length;

    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];

      // If we find an assistant message with tool calls
      if (message.role === 'assistant' && message.tool_calls && message.tool_calls.length > 0) {
        // Check if all tool calls have results
        const toolCallIds = message.tool_calls.map((tc) => tc.id);
        let hasAllResults = true;

        // Look for tool results after this message
        for (const toolCallId of toolCallIds) {
          let foundResult = false;
          for (let j = i + 1; j < messages.length; j++) {
            if (messages[j].role === 'tool' && messages[j].tool_call_id === toolCallId) {
              foundResult = true;
              break;
            }
          }
          if (!foundResult) {
            hasAllResults = false;
            break;
          }
        }

        if (!hasAllResults) {
          // This tool call is incomplete, truncate here
          lastValidIndex = i;
          break;
        }
      }
    }

    return messages.slice(0, lastValidIndex);
  }

  /**
   * Get IDs of incomplete tool calls
   *
   * Returns the IDs of tool calls that don't have corresponding results.
   */
  getIncompleteToolCallIds(messages: Message[]): string[] {
    const toolCallIds = new Set<string>();
    const toolResultIds = new Set<string>();

    for (const message of messages) {
      if (message.role === 'assistant' && message.tool_calls) {
        for (const toolCall of message.tool_calls) {
          toolCallIds.add(toolCall.id);
        }
      }
      if (message.role === 'tool' && message.tool_call_id) {
        toolResultIds.add(message.tool_call_id);
      }
    }

    const incomplete: string[] = [];
    for (const id of toolCallIds) {
      if (!toolResultIds.has(id)) {
        incomplete.push(id);
      }
    }

    return incomplete;
  }

  /**
   * Recover todos from session events
   *
   * Finds the last TodoWrite tool call and extracts the todos from it.
   * This allows todos to persist across sessions without a separate file.
   */
  async recoverTodos(sessionId: string): Promise<TodoItem[]> {
    const events = await this.storage.readEvents(sessionId);

    // Find the last TodoWrite tool call
    for (let i = events.length - 1; i >= 0; i--) {
      const event = events[i];
      if (!isSessionEvent(event)) {
        continue;
      }

      // Type guard validated the event structure
      const typedEvent = event as AnySessionEvent;

      if (typedEvent.type === 'tool_call' && this.isTodoWriteCall(typedEvent)) {
        // Found the last TodoWrite call, return its todos
        return typedEvent.data.params.todos;
      }
    }

    // No TodoWrite calls found, return empty
    return [];
  }

  /**
   * Type guard to check if a tool call event is a TodoWrite call with todos
   */
  private isTodoWriteCall(event: ToolCallEvent): event is ToolCallEvent & {
    data: {
      id: string;
      tool: 'TodoWrite';
      params: { todos: TodoItem[] };
      agent?: string;
    };
  } {
    return (
      event.data.tool === 'TodoWrite' &&
      typeof event.data.params === 'object' &&
      event.data.params !== null &&
      'todos' in event.data.params &&
      Array.isArray((event.data.params as { todos?: unknown }).todos)
    );
  }
}

// Re-export Message from base-types for backward compatibility
export type { Message } from '@/base-types';
