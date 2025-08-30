import { Message, ToolCall } from '../types';
import { ConversationLogger } from './conversation-logger';

/**
 * Validates message history to ensure tool_use blocks have matching tool_result blocks
 */
export class MessageValidator {
  constructor(private readonly logger?: ConversationLogger) {}

  /**
   * Validates and fixes message history to ensure all tool_use blocks have matching tool_result blocks
   * @param messages The message history to validate
   * @param agentName The agent name for logging
   * @returns Fixed message history
   */
  validateAndFixMessages(messages: Message[], agentName: string): Message[] {
    const fixedMessages: Message[] = [];
    const pendingToolCalls = new Map<string, ToolCall>();

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      fixedMessages.push(message);

      // Track tool calls from assistant messages
      if (message.role === 'assistant' && message.tool_calls) {
        for (const toolCall of message.tool_calls) {
          pendingToolCalls.set(toolCall.id, toolCall);
        }
      }

      // Remove tool calls when we find their results
      if (message.role === 'tool' && message.tool_call_id) {
        if (pendingToolCalls.has(message.tool_call_id)) {
          pendingToolCalls.delete(message.tool_call_id);
        } else {
          // Orphaned tool result - log warning
          this.logWarning(
            agentName,
            `Found orphaned tool result for call ID: ${message.tool_call_id}`
          );
        }
      }
    }

    // Add missing tool results for orphaned tool calls
    if (pendingToolCalls.size > 0) {
      for (const [callId, toolCall] of pendingToolCalls) {
        this.logWarning(
          agentName,
          `Adding missing tool result for call ID: ${callId} (${toolCall.function.name})`
        );

        // Add a synthetic error result for the missing tool call
        const syntheticResult: Message = {
          role: 'tool',
          tool_call_id: callId,
          content: JSON.stringify({
            error: 'Tool execution was interrupted - no result available',
            tool_name: toolCall.function.name,
            synthetic: true,
          }),
        };

        fixedMessages.push(syntheticResult);
      }
    }

    return fixedMessages;
  }

  /**
   * Validates that tool calls have unique IDs within a message
   * @param toolCalls Array of tool calls to validate
   * @param agentName The agent name for logging
   * @returns Whether all tool call IDs are unique
   */
  validateToolCallIds(toolCalls: ToolCall[], agentName: string): boolean {
    const seenIds = new Set<string>();

    for (const toolCall of toolCalls) {
      if (seenIds.has(toolCall.id)) {
        this.logWarning(agentName, `Duplicate tool call ID detected: ${toolCall.id}`);
        return false;
      }
      seenIds.add(toolCall.id);
    }

    return true;
  }

  private logWarning(agentName: string, message: string): void {
    if (this.logger) {
      this.logger.log({
        timestamp: new Date().toISOString(),
        agentName: 'MessageValidator',
        depth: 0,
        type: 'system',
        content: `⚠️  ${message} (Agent: ${agentName})`,
      });
    } else {
      console.warn(`MessageValidator: ${message}`);
    }
  }
}
