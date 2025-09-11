/**
 * Type Guards for Runtime Type Checking
 *
 * Provides proper runtime type checking to replace unsafe type assertions.
 * All type guards follow the pattern: isX(value: unknown): value is X
 */

import { TodoItem } from '@/tools/todowrite.tool';

/**
 * Check if an error is a Node.js system error with an error code
 */
export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as Record<string, unknown>).code === 'string'
  );
}

/**
 * Type for session events
 */
interface SessionEvent {
  type: string;
  timestamp: number;
  data: unknown;
}

/**
 * Check if an object is a valid session event
 */
export function isSessionEvent(event: unknown): event is SessionEvent {
  if (typeof event !== 'object' || event === null) {
    return false;
  }

  const e = event as Record<string, unknown>;
  return typeof e.type === 'string' && typeof e.timestamp === 'number' && e.data !== undefined;
}

/**
 * Check if a value is a TodoItem array
 * Validates against the TodoItem interface from todowrite.tool
 */
export function isTodoItemArray(value: unknown): value is TodoItem[] {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.every((item) => {
    if (typeof item !== 'object' || item === null) {
      return false;
    }

    const todo = item as Record<string, unknown>;
    return (
      typeof todo.content === 'string' &&
      typeof todo.status === 'string' &&
      (todo.status === 'pending' || todo.status === 'in_progress' || todo.status === 'completed') &&
      typeof todo.activeForm === 'string' &&
      typeof todo.id === 'string' &&
      typeof todo.priority === 'string' &&
      (todo.priority === 'high' || todo.priority === 'medium' || todo.priority === 'low')
    );
  });
}
