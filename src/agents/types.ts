/**
 * Agent domain types
 */

/**
 * Behavior presets for agents
 */
export type BehaviorPreset = 'deterministic' | 'precise' | 'balanced' | 'creative' | 'exploratory';

/**
 * Response format for structured output
 */
export type ResponseFormat = 'text' | 'json' | 'json_schema';

/**
 * Agent definition loaded from markdown
 */
export interface AgentDefinition {
  id: string;
  name: string;
  description?: string;
  prompt: string;
  model?: string;
  temperature?: number;
  top_p?: number;
  behavior?: BehaviorPreset;
  tools?: string[] | '*';
  maxDepth?: number;
  response_format?: ResponseFormat;
  json_schema?: object; // Optional JSON schema for validation
  [key: string]: unknown; // Allow additional properties
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  directories: string[];
  additionalDirectories?: string[];
  agents?: AgentDefinition[];
}

/**
 * Agent execution state
 */
export interface AgentState {
  agentId: string;
  depth: number;
  iterationCount: number;
  tokenCount: number;
  startTime: number;
}
