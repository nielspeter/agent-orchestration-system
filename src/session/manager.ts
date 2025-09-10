import { AnySessionEvent, SessionStorage, ToolCallEvent } from './types';
import { TodoItem } from '@/tools/todowrite.tool';

/**
 * Message structure expected by the LLM
 */
export interface Message {
  role: 'user' | 'assistant';
  content: string | MessageContent[];
}

export interface MessageContent {
  type: 'tool_use' | 'tool_result';
  id?: string;
  tool_use_id?: string;
  name?: string;
  input?: unknown;
  content?: unknown;
}

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
   * Reads all events and converts them to LLM message format.
   * The messages represent the complete conversation history
   * and can be sent to the LLM to continue execution.
   */
  async recoverSession(sessionId: string): Promise<Message[]> {
    const events = await this.storage.readEvents(sessionId);
    const messages: Message[] = [];

    for (const event of events) {
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
          messages.push({
            role: 'assistant',
            content: typedEvent.data.content,
          });
          break;
        }

        case 'tool_call': {
          // Tool calls are assistant messages with structured content
          messages.push({
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: typedEvent.data.id,
                name: typedEvent.data.tool,
                input: typedEvent.data.params,
              },
            ],
          });
          break;
        }

        case 'tool_result': {
          // Tool results are user messages with structured content
          messages.push({
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: typedEvent.data.toolCallId,
                content: typedEvent.data.result,
              },
            ],
          });
          break;
        }

        default: {
          // Skip unknown event types
          console.warn(`Unknown event type: ${(typedEvent as AnySessionEvent).type}`);
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

    // Check if last message is an assistant message with tool_use content
    if (lastMessage.role === 'assistant' && Array.isArray(lastMessage.content)) {
      return lastMessage.content.some((item) => item.type === 'tool_use');
    }

    return false;
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

    if (lastMessage.role === 'assistant' && Array.isArray(lastMessage.content)) {
      const toolUse = lastMessage.content.find((item) => item.type === 'tool_use');
      if (toolUse?.id && toolUse.name) {
        return {
          id: toolUse.id,
          name: toolUse.name,
          input: toolUse.input,
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
      const event = events[i] as AnySessionEvent;

      if (event.type === 'tool_call' && this.isTodoWriteCall(event)) {
        // Found the last TodoWrite call, return its todos
        return event.data.params.todos;
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
