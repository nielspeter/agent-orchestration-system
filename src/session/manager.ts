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
          messages.push({
            role: 'assistant',
            content: content,
          });
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
