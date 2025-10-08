/**
 * @agent-system/core
 *
 * Core agent orchestration system - autonomous agents with LLM providers
 */

// Main builder API - primary entry point
export { AgentSystemBuilder } from './config/system-builder.js';
export type { BuildResult } from './config/system-builder.js';

// Event logging - used by web UI for SSE
export { EventLogger } from './logging/event.logger.js';
export { ConsoleLogger } from './logging/console.logger.js';
export { CompositeLogger } from './logging/composite.logger.js';
export { NoOpLogger } from './logging/noop.logger.js';
export type { AgentLogger } from './logging/types.js';

// LLM Providers
export { AnthropicProvider } from './providers/anthropic-provider.js';
export { OpenAICompatibleProvider } from './providers/openai-compatible-provider.js';
export type { ILLMProvider } from './providers/llm-provider.interface.js';
