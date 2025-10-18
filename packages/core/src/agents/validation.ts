import { z } from 'zod';

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
  response_format: z.string().optional(),
  json_schema: z.unknown().optional(),
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
      const errors = error.errors
        .map((err) => {
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
