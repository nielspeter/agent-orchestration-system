import { z } from 'zod';
import type { ProvidersConfig, ThinkingConfig } from '../config/types';

/**
 * Thinking configuration schema
 * Matches the ThinkingConfig interface in config/types.ts
 */
const ThinkingConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    budget_tokens: z.number().int().min(512).max(200000).optional(),
  })
  .strict(); // Reject unknown properties like 'type'

/**
 * Agent frontmatter schema
 * Validates the YAML frontmatter of agent markdown files
 */
export const AgentFrontmatterSchema = z.object({
  name: z.string().min(1, 'Agent name is required'),
  model: z.string().optional(),
  tools: z.union([z.array(z.string()), z.literal('*')]).optional(),
  behavior: z.enum(['deterministic', 'precise', 'balanced', 'creative', 'exploratory']).optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  response_format: z.enum(['text', 'json', 'json_schema']).optional(),
  json_schema: z.object({}).passthrough().optional(), // Object with any properties
  thinking: z.union([z.boolean(), ThinkingConfigSchema]).optional(),
});

export type AgentFrontmatter = z.infer<typeof AgentFrontmatterSchema>;

/**
 * Validate agent frontmatter and provide helpful error messages
 *
 * @param data Parsed frontmatter data
 * @param agentName Agent name for error context
 * @returns Validated frontmatter
 * @throws Error with detailed validation message if invalid
 */
export function validateAgentFrontmatter(data: unknown, agentName: string): AgentFrontmatter {
  try {
    return AgentFrontmatterSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Format validation errors for better DX
      const errors = error.issues
        .map((err: z.ZodIssue) => {
          const path = err.path.join('.');
          return `  - ${path || 'root'}: ${err.message}`;
        })
        .join('\n');

      throw new Error(
        `Invalid frontmatter in agent '${agentName}':\n${errors}\n\n` +
          'Common fixes:\n' +
          "  - Use 'enabled: true' not 'type: enabled' for thinking config\n" +
          "  - Behavior must be one of: 'deterministic', 'precise', 'balanced', 'creative', 'exploratory'\n" +
          '  - Temperature must be 0-2, top_p must be 0-1\n' +
          '  - Budget tokens must be 512-200000'
      );
    }
    throw error;
  }
}

/**
 * Validate that agent's thinking configuration is compatible with the model
 * This is "best effort" validation - only validates if model is in providers config
 *
 * @param agentName Agent name for error context
 * @param agentModel Model specified in agent frontmatter (optional)
 * @param thinking Thinking configuration from agent
 * @param temperature Temperature setting from agent (optional)
 * @param topP Top-p setting from agent (optional)
 * @param defaultModel Default model from system config
 * @param providersConfig Providers configuration
 * @returns Validation result with error/warning message if incompatible
 */
export function validateThinkingCompatibility(
  agentName: string,
  agentModel: string | undefined,
  thinking: boolean | ThinkingConfig | undefined,
  temperature: number | undefined,
  topP: number | undefined,
  defaultModel: string | undefined,
  providersConfig: ProvidersConfig | undefined
): { valid: boolean; message?: string } {
  // If thinking is not enabled, no validation needed
  const thinkingEnabled =
    typeof thinking === 'boolean' ? thinking : thinking?.enabled === true;
  if (!thinkingEnabled) {
    return { valid: true };
  }

  // Check for incompatible temperature/top_p settings
  // Extended thinking requires temperature=1.0 (model controls its own sampling)
  if (temperature !== undefined) {
    return {
      valid: false,
      message:
        `Agent '${agentName}' has both thinking enabled AND temperature configured.\n` +
        '  Extended thinking is incompatible with custom temperature settings.\n' +
        '  Solutions:\n' +
        '  1. Remove "temperature" from agent frontmatter (recommended)\n' +
        '  2. Remove thinking configuration if you need custom temperature\n' +
        '  Note: When thinking is enabled, the model controls its own sampling parameters.',
    };
  }

  if (topP !== undefined) {
    return {
      valid: false,
      message:
        `Agent '${agentName}' has both thinking enabled AND top_p configured.\n` +
        '  Extended thinking is incompatible with custom top_p settings.\n' +
        '  Solutions:\n' +
        '  1. Remove "top_p" from agent frontmatter (recommended)\n' +
        '  2. Remove thinking configuration if you need custom top_p\n' +
        '  Note: When thinking is enabled, the model controls its own sampling parameters.',
    };
  }

  // Determine which model will be used
  const modelToUse = agentModel || defaultModel;
  if (!modelToUse || !providersConfig) {
    // Can't validate without model or providers config
    return { valid: true }; // Assume valid, will be checked at runtime
  }

  // Parse model string: "provider/model-id" or "provider/model-id:modifier"
  const modelMatch = modelToUse.match(/^([^/]+)\/(.+?)(?::.*)?$/);
  if (!modelMatch) {
    // Invalid model format, but that's not this function's concern
    return { valid: true };
  }

  const [, providerName, modelId] = modelMatch;
  const provider = providersConfig.providers[providerName];

  if (!provider || !provider.models) {
    // Provider not found or no models defined
    return { valid: true }; // Can't validate
  }

  // Look up the model in provider's models list
  const modelConfig = provider.models.find((m) => m.id === modelId || m.id === '*');

  if (!modelConfig) {
    // Model not found in config (might be dynamic)
    return { valid: true }; // Can't validate
  }

  // Check if model supports thinking
  const modelSupportsThinking = modelConfig.capabilities?.thinking === true;

  if (!modelSupportsThinking) {
    return {
      valid: false,
      message:
        `Agent '${agentName}' has thinking enabled, but model '${modelToUse}' does not support thinking.\n` +
        '  Solutions:\n' +
        '  1. Switch to a thinking-capable model (e.g., claude-sonnet-4-5, claude-opus-4-1, o3)\n' +
        '  2. Remove thinking configuration from agent frontmatter\n' +
        '  3. Override model in agent frontmatter with a thinking-capable model',
    };
  }

  // Check budget_tokens if specified
  if (typeof thinking === 'object' && thinking.budget_tokens) {
    const budget = thinking.budget_tokens;
    const minBudget = modelConfig.capabilities?.thinkingMinBudget;
    const maxBudget = modelConfig.capabilities?.thinkingMaxBudget;

    if (minBudget && budget < minBudget) {
      return {
        valid: false,
        message:
          `Agent '${agentName}' thinking budget (${budget}) is below model minimum (${minBudget}).\n` +
          `  Set budget_tokens to at least ${minBudget}`,
      };
    }

    if (maxBudget && budget > maxBudget) {
      return {
        valid: false,
        message:
          `Agent '${agentName}' thinking budget (${budget}) exceeds model maximum (${maxBudget}).\n` +
          `  Set budget_tokens to at most ${maxBudget}`,
      };
    }
  }

  return { valid: true };
}
