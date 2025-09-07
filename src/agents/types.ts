/**
 * Agent domain types
 */

import { ID } from '@/base-types';

/**
 * Behavior presets for agents
 */
export type BehaviorPreset = 'deterministic' | 'precise' | 'balanced' | 'creative' | 'exploratory';

/**
 * Agent definition loaded from markdown
 */
export interface AgentDefinition {
  id: ID;
  name: string;
  description?: string;
  prompt: string;
  model?: string;
  temperature?: number;
  top_p?: number;
  behavior?: BehaviorPreset;
  tools?: string[] | '*';
  maxDepth?: number;
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
