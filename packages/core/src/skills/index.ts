/**
 * Skills Module
 *
 * Public API for the Skills system.
 * Skills are domain expertise packages following Anthropic's Agent Skills Spec v1.0.
 */

// Types
export type { Skill, SkillFrontmatter, AgentSkillConfig } from './types.js';

// Validation
export {
  SkillFrontmatterSchema,
  validateSkillFrontmatter,
  validateSkillNameMatchesDirectory,
} from './validation.js';

// Core classes
export { SkillLoader } from './loader.js';
export { SkillRegistry } from './registry.js';
