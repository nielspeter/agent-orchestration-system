/**
 * @agent-system/core
 *
 * Core agent orchestration system - autonomous agents with LLM providers
 */

// Main builder API - primary entry point
export { AgentSystemBuilder } from './config/system-builder';
export type { BuildResult } from './config/system-builder';

// Event logging - used by web UI for SSE
export { EventLogger } from './logging/event.logger';
export { ConsoleLogger } from './logging/console.logger';
export { CompositeLogger } from './logging/composite.logger';
export { NoOpLogger } from './logging/noop.logger';
export type { AgentLogger } from './logging/types';

// LLM Providers
export { AnthropicProvider } from './providers/anthropic-provider';
export { OpenAICompatibleProvider } from './providers/openai-compatible-provider';
export type { ILLMProvider } from './providers/llm-provider.interface';

// Session Management - Persistence and recovery with guaranteed recovery from ANY state
export { SimpleSessionManager } from './session/manager';
export {
  sanitizeRecoveredMessages,
  validateMessageStructure,
  formatSanitizationIssues,
} from './session/message-sanitizer';
export type { SanitizationResult, SanitizationIssue } from './session/message-sanitizer';
export { InMemoryStorage, FilesystemStorage, NoOpStorage } from './session';
export type { SessionStorage, SessionEvent, AnySessionEvent } from './session/types';
