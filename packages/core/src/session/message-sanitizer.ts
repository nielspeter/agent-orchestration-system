import { Message } from '@/base-types';

/**
 * Message Sanitizer for Session Recovery
 *
 * CRITICAL REQUIREMENT: Sessions must be recoverable from ANY state.
 * This sanitizer guarantees that recovered messages can always be used,
 * even if they contain incomplete tool calls, corrupted data, or other issues.
 *
 * Design Principles:
 * 1. NEVER throw errors - always return valid messages
 * 2. Preserve maximum context - keep all text, thinking, and history
 * 3. Degrade gracefully - if tools incomplete, continue without them
 * 4. Be transparent - log what was cleaned and why
 *
 * Multi-Layer Defense Strategy:
 * - Layer 1: Structure Validation
 * - Layer 2: Message Repair
 * - Layer 3: Relationship Validation (tool_call/tool_result pairs)
 * - Layer 4: Sequence Validation
 * - Layer 5: Final Validation
 */

export interface SanitizationResult {
  messages: Message[];
  issues: SanitizationIssue[];
  recovered: boolean;
}

export interface SanitizationIssue {
  type: 'incomplete_tool_call' | 'orphaned_tool_result' | 'invalid_message' | 'empty_message';
  index: number;
  action: 'removed_tool_calls' | 'removed_message' | 'skipped';
  details: string;
}

/**
 * Sanitize recovered session messages
 *
 * This is the main entry point. It applies all sanitization layers
 * and guarantees to return valid messages that work with the API.
 *
 * @param messages - Raw messages from session recovery
 * @returns Sanitization result with cleaned messages and issues log
 */
export function sanitizeRecoveredMessages(messages: Message[]): SanitizationResult {
  const issues: SanitizationIssue[] = [];

  // Layer 1: Structure Validation
  if (!Array.isArray(messages)) {
    issues.push({
      type: 'invalid_message',
      index: -1,
      action: 'skipped',
      details: 'Messages is not an array, returning empty',
    });
    return { messages: [], issues, recovered: true };
  }

  if (messages.length === 0) {
    // Empty is valid - fresh start
    return { messages: [], issues, recovered: true };
  }

  // Layer 2: Message Repair - Remove invalid messages
  const validatedMessages = messages.filter((msg, index) => {
    if (!isValidMessage(msg)) {
      issues.push({
        type: 'invalid_message',
        index,
        action: 'removed_message',
        details: `Invalid message structure: ${JSON.stringify(msg).substring(0, 100)}`,
      });
      return false;
    }
    return true;
  });

  // Layer 3: Relationship Validation - Fix tool_call/tool_result pairs
  const sanitized = fixToolCallRelationships(validatedMessages, issues);

  // Layer 4: Sequence Validation - Remove empty messages
  const cleaned = sanitized.filter((msg, index) => {
    if (isEmpty(msg)) {
      issues.push({
        type: 'empty_message',
        index,
        action: 'removed_message',
        details: 'Message has no content',
      });
      return false;
    }
    return true;
  });

  // Layer 5: Final Validation - Ensure API compatibility
  const validation = validateMessageStructure(cleaned);

  if (!validation.valid) {
    // If still invalid, apply progressive fallback
    return applyFallbackStrategy(messages, issues, validation.errors);
  }

  return {
    messages: cleaned,
    issues,
    recovered: true,
  };
}

/**
 * Layer 2: Basic message structure validation
 */
function isValidMessage(msg: unknown): msg is Message {
  if (!msg || typeof msg !== 'object') {
    return false;
  }

  const message = msg as Partial<Message>;

  // Must have a role
  if (!message.role || typeof message.role !== 'string') {
    return false;
  }

  // Role must be one of the valid values
  if (!['system', 'user', 'assistant', 'tool'].includes(message.role)) {
    return false;
  }

  // Tool role must have tool_call_id
  if (message.role === 'tool' && !message.tool_call_id) {
    return false;
  }

  return true;
}

/**
 * Check if message is empty (no meaningful content)
 */
function isEmpty(msg: Message): boolean {
  // Has text content
  if (msg.content && msg.content.length > 0) {
    return false;
  }

  // Has tool calls
  if (msg.tool_calls && msg.tool_calls.length > 0) {
    return false;
  }

  // Has raw content (thinking blocks, etc.)
  if (msg.raw_content) {
    return false;
  }

  return true;
}

/**
 * Layer 3: Fix tool_call/tool_result relationship issues
 *
 * This handles:
 * 1. Incomplete tool calls (tool_call without result)
 * 2. Orphaned tool results (result without call)
 * 3. Partial parallel execution (some tools completed, some not)
 */
function fixToolCallRelationships(messages: Message[], issues: SanitizationIssue[]): Message[] {
  const fixed: Message[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // Check for incomplete tool calls in assistant messages
    if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
      const incompleteToolCallIds = findIncompleteToolCalls(messages, i);

      if (incompleteToolCallIds.length > 0) {
        // Has incomplete tool calls - need to clean them
        const cleanedMsg = removeIncompleteToolCalls(msg, incompleteToolCallIds);

        if (cleanedMsg) {
          fixed.push(cleanedMsg);
          issues.push({
            type: 'incomplete_tool_call',
            index: i,
            action: 'removed_tool_calls',
            details: `Removed ${incompleteToolCallIds.length} incomplete tool call(s): ${incompleteToolCallIds.join(', ')}`,
          });
        } else {
          // Message was only tool calls, remove entirely
          issues.push({
            type: 'incomplete_tool_call',
            index: i,
            action: 'removed_message',
            details: 'Removed message with only incomplete tool calls',
          });
        }
        continue;
      }
    }

    // Check for orphaned tool results
    if (msg.role === 'tool' && msg.tool_call_id) {
      const hasMatchingCall = hasMatchingToolCall(fixed, msg.tool_call_id);

      if (!hasMatchingCall) {
        issues.push({
          type: 'orphaned_tool_result',
          index: i,
          action: 'removed_message',
          details: `Removed orphaned tool_result for call_id: ${msg.tool_call_id}`,
        });
        continue;
      }
    }

    // Message is valid, add to fixed array
    fixed.push(msg);
  }

  return fixed;
}

/**
 * Find tool calls that don't have matching results
 *
 * Returns array of tool_call IDs that are incomplete
 */
function findIncompleteToolCalls(messages: Message[], assistantIndex: number): string[] {
  const msg = messages[assistantIndex];

  if (!msg.tool_calls || msg.tool_calls.length === 0) {
    return [];
  }

  const incompleteIds: string[] = [];

  for (const toolCall of msg.tool_calls) {
    // Check if there's a matching tool_result in the next messages
    let hasResult = false;

    for (let i = assistantIndex + 1; i < messages.length; i++) {
      const nextMsg = messages[i];

      if (nextMsg.role === 'tool' && nextMsg.tool_call_id === toolCall.id) {
        hasResult = true;
        break;
      }

      // Stop searching if we hit another assistant message
      if (nextMsg.role === 'assistant') {
        break;
      }
    }

    if (!hasResult) {
      incompleteIds.push(toolCall.id);
    }
  }

  return incompleteIds;
}

/**
 * Remove incomplete tool calls from a message
 *
 * Returns the cleaned message, or null if message should be removed entirely
 */
function removeIncompleteToolCalls(msg: Message, incompleteIds: string[]): Message | null {
  // If ALL tool calls are incomplete, check if we have other content
  const allIncomplete = msg.tool_calls?.every((tc) => incompleteIds.includes(tc.id));

  if (allIncomplete) {
    // All tool calls are incomplete
    if (msg.content || msg.raw_content) {
      // Has text/thinking content, preserve it
      return {
        role: msg.role,
        content: msg.content,
        raw_content: msg.raw_content,
      };
    } else {
      // Message only had tool calls, remove entirely
      return null;
    }
  }

  // Some tool calls are complete, some incomplete - remove only incomplete ones
  const validToolCalls = msg.tool_calls?.filter((tc) => !incompleteIds.includes(tc.id)) || [];

  if (validToolCalls.length === 0) {
    // After filtering, no tool calls left
    if (msg.content || msg.raw_content) {
      return {
        role: msg.role,
        content: msg.content,
        raw_content: msg.raw_content,
      };
    } else {
      return null;
    }
  }

  // Return message with only valid tool calls
  return {
    ...msg,
    tool_calls: validToolCalls,
  };
}

/**
 * Check if a tool_call_id has a matching tool_call in previous messages
 */
function hasMatchingToolCall(messages: Message[], toolCallId: string): boolean {
  // Look backwards for an assistant message with this tool_call
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];

    if (msg.role === 'assistant' && msg.tool_calls) {
      for (const toolCall of msg.tool_calls) {
        if (toolCall.id === toolCallId) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Layer 5: Validate message structure for API compatibility
 */
export function validateMessageStructure(messages: Message[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // Validate assistant messages with tool_calls have matching results
    if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
      for (const toolCall of msg.tool_calls) {
        // Look for matching tool_result in next few messages
        let hasResult = false;

        for (let j = i + 1; j < Math.min(i + 10, messages.length); j++) {
          const nextMsg = messages[j];

          if (nextMsg.role === 'tool' && nextMsg.tool_call_id === toolCall.id) {
            hasResult = true;
            break;
          }

          // Stop if we hit another assistant message
          if (nextMsg.role === 'assistant') {
            break;
          }
        }

        if (!hasResult) {
          errors.push(
            `Message ${i}: tool_call ${toolCall.id} (${toolCall.function.name}) missing matching tool_result`
          );
        }
      }
    }

    // Validate tool results have matching calls
    if (msg.role === 'tool' && msg.tool_call_id) {
      let hasCall = false;

      // Look backwards for matching tool_call
      for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
        const prevMsg = messages[j];

        if (
          prevMsg.role === 'assistant' &&
          prevMsg.tool_calls?.some((tc) => tc.id === msg.tool_call_id)
        ) {
          hasCall = true;
          break;
        }
      }

      if (!hasCall) {
        errors.push(`Message ${i}: tool_result ${msg.tool_call_id} missing matching tool_call`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Fallback strategy when sanitization still produces invalid messages
 *
 * Progressive fallback:
 * 1. Remove last N messages until valid
 * 2. Keep only first half of messages
 * 3. Return empty array (always works)
 */
function applyFallbackStrategy(
  originalMessages: Message[],
  existingIssues: SanitizationIssue[],
  validationErrors: string[]
): SanitizationResult {
  const issues = [...existingIssues];

  issues.push({
    type: 'invalid_message',
    index: -1,
    action: 'skipped',
    details: `Sanitization produced invalid messages. Errors: ${validationErrors.join('; ')}`,
  });

  // Try removing last 1-5 messages
  for (let removeCount = 1; removeCount <= 5; removeCount++) {
    const trimmed = originalMessages.slice(0, -removeCount);
    const validation = validateMessageStructure(trimmed);

    if (validation.valid) {
      issues.push({
        type: 'invalid_message',
        index: -1,
        action: 'removed_message',
        details: `Fallback: Removed last ${removeCount} message(s) to achieve valid state`,
      });

      return {
        messages: trimmed,
        issues,
        recovered: true,
      };
    }
  }

  // Try keeping only first half
  const halfSize = Math.floor(originalMessages.length / 2);
  if (halfSize > 0) {
    const firstHalf = originalMessages.slice(0, halfSize);
    const validation = validateMessageStructure(firstHalf);

    if (validation.valid) {
      issues.push({
        type: 'invalid_message',
        index: -1,
        action: 'removed_message',
        details: `Fallback: Kept only first ${halfSize} messages (50% of original)`,
      });

      return {
        messages: firstHalf,
        issues,
        recovered: true,
      };
    }
  }

  // Final fallback: empty array (always works)
  issues.push({
    type: 'invalid_message',
    index: -1,
    action: 'removed_message',
    details: 'Fallback: Session too corrupted, starting fresh with empty conversation',
  });

  return {
    messages: [],
    issues,
    recovered: true,
  };
}

/**
 * Format sanitization issues for logging
 */
export function formatSanitizationIssues(issues: SanitizationIssue[]): string {
  if (issues.length === 0) {
    return 'No issues found';
  }

  const summary = issues.map((issue) => `[${issue.type}] ${issue.details}`).join('; ');

  return `Sanitized ${issues.length} issue(s): ${summary}`;
}
