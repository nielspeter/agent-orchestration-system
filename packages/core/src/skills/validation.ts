/**
 * Skills Validation
 *
 * Zod schemas and validation functions for Skills frontmatter.
 * Follows Anthropic's Agent Skills Spec v1.0.
 */

import { z } from 'zod';
import type { SkillFrontmatter } from './types.js';

/**
 * Skill Frontmatter Schema (Anthropic Spec v1.0)
 *
 * Required fields:
 * - name: hyphen-case skill identifier
 * - description: when Claude should use this skill
 *
 * Optional fields:
 * - license: license identifier or filename
 * - allowed-tools: pre-approved tools for Claude Code
 * - metadata: free-form key-value pairs
 */
export const SkillFrontmatterSchema = z.object({
  // Required fields
  name: z
    .string()
    .min(1, 'Skill name is required')
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Skill name must be hyphen-case (e.g., my-skill-name)'),

  description: z.string().min(1, 'Skill description is required'),

  // Optional fields
  license: z.string().optional(),

  'allowed-tools': z.array(z.string()).optional(),

  metadata: z.record(z.string(), z.string()).optional(),
});

/**
 * Validate skill frontmatter
 *
 * @param data - Raw frontmatter data (from YAML parsing)
 * @param skillName - Skill name for error messages (from directory or file)
 * @returns Validated frontmatter
 * @throws Error with detailed validation messages if invalid
 */
export function validateSkillFrontmatter(data: unknown, skillName?: string): SkillFrontmatter {
  try {
    return SkillFrontmatterSchema.parse(data) as SkillFrontmatter;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues
        .map((e: z.ZodIssue) => {
          const path = e.path.join('.');
          const message = e.message;
          return `  - ${path || 'root'}: ${message}`;
        })
        .join('\n');

      const skillLabel = skillName ? ` in skill '${skillName}'` : '';
      throw new Error(`Invalid skill frontmatter${skillLabel}:\n${issues}`);
    }
    throw error;
  }
}

/**
 * Validate skill name matches directory name
 *
 * @param frontmatterName - Name from SKILL.md frontmatter
 * @param directoryName - Name of the skill directory
 * @throws Error if names don't match
 */
export function validateSkillNameMatchesDirectory(
  frontmatterName: string,
  directoryName: string
): void {
  if (frontmatterName !== directoryName) {
    throw new Error(
      `Skill name mismatch: frontmatter says '${frontmatterName}' but directory is '${directoryName}'`
    );
  }
}
