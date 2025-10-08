/**
 * Storage abstraction for session persistence
 *
 * Three implementations:
 * - NoOpStorage: Zero overhead, no persistence (default)
 * - InMemoryStorage: For testing/debugging/GUI
 * - FilesystemStorage: Actual persistence with recovery
 */
export interface SessionStorage {
  /**
   * Append an event to the session log
   */
  appendEvent(sessionId: string, event: unknown): Promise<void>;

  /**
   * Read all events for a session (for recovery)
   */
  readEvents(sessionId: string): Promise<unknown[]>;

  /**
   * Check if a session exists
   */
  sessionExists(sessionId: string): Promise<boolean>;

  /**
   * Flush any pending writes (optional - for ensuring writes complete)
   */
  flush?(sessionId: string): Promise<void>;
}

/**
 * Event types for session persistence
 */
export type SessionEventType = 'user' | 'assistant' | 'tool_call' | 'tool_result';

/**
 * Metadata captured for LLM interactions
 */
export interface LLMMetadata {
  model?: string;
  provider?: string;
  stopReason?: string; // Why the LLM stopped: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use"
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    promptCacheHitTokens?: number;
    promptCacheMissTokens?: number;
    cachedTokens?: number;
  };
  cost?: {
    inputCost?: number;
    outputCost?: number;
    totalCost?: number;
  };
  performance?: {
    latencyMs?: number;
    retries?: number;
  };
  config?: {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    responseFormat?: string;
  };
}

/**
 * Base structure for session events
 */
export interface SessionEvent {
  type: SessionEventType;
  timestamp: number;
  data: unknown;
  metadata?: LLMMetadata;
}

/**
 * User message event
 */
export interface UserMessageEvent extends SessionEvent {
  type: 'user';
  data: {
    role: 'user';
    content: string;
  };
}

/**
 * Assistant message event
 */
export interface AssistantMessageEvent extends SessionEvent {
  type: 'assistant';
  data: {
    role: 'assistant';
    content: string;
    agent?: string;
  };
}

/**
 * Tool call event
 */
export interface ToolCallEvent extends SessionEvent {
  type: 'tool_call';
  data: {
    id: string;
    tool: string;
    params: unknown;
    agent?: string;
    traceId?: string;
    parentCallId?: string;
  };
}

/**
 * Tool result event
 */
export interface ToolResultEvent extends SessionEvent {
  type: 'tool_result';
  data: {
    toolCallId: string;
    result: unknown;
    // Size tracking for token estimation
    resultSizeBytes?: number;
    estimatedTokens?: number;
  };
}

export type AnySessionEvent =
  | UserMessageEvent
  | AssistantMessageEvent
  | ToolCallEvent
  | ToolResultEvent;
