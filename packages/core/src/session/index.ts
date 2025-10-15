/**
 * Session Management Module
 *
 * Provides session persistence and recovery with guaranteed recovery from ANY state.
 * The message sanitizer ensures that sessions can always be resumed, regardless of
 * whether they were saved mid-execution with incomplete tool calls or other edge cases.
 */

// Session Manager - Core recovery logic
export { SimpleSessionManager } from './manager';

// Message Sanitizer - Guaranteed recovery from ANY state
export {
  sanitizeRecoveredMessages,
  validateMessageStructure,
  formatSanitizationIssues,
  type SanitizationResult,
  type SanitizationIssue,
} from './message-sanitizer';

// Storage Implementations
export { InMemoryStorage } from './memory.storage';
export { FilesystemStorage } from './filesystem.storage';
export { NoOpStorage } from './noop.storage';

// Types
export type {
  SessionStorage,
  SessionEvent,
  UserMessageEvent,
  AssistantMessageEvent,
  ToolCallEvent,
  ToolResultEvent,
  AnySessionEvent,
} from './types';
