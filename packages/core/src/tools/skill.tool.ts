import * as path from 'node:path';
import { BaseTool, ToolResult } from '@/base-types';
import type { SkillRegistry } from '@/skills/registry';
import type { Skill } from '@/skills/types';

interface SkillArgs {
  name?: string;
  [key: string]: unknown;
}

/**
 * Validates skill tool arguments
 */
function validateArgs(args: unknown): args is SkillArgs {
  if (!args || typeof args !== 'object') return false;
  return true; // name is optional, we'll check it in execute
}

/**
 * Formats skill content for display to agent
 */
function formatSkillContent(skill: Skill): string {
  let output = `# Skill Loaded: ${skill.name}\n\n`;

  if (skill.description) {
    output += `**Purpose:** ${skill.description}\n\n`;
  }

  output += '─'.repeat(60) + '\n\n';
  output += skill.instructions;
  output += '\n\n' + '─'.repeat(60) + '\n\n';

  // List resources with correct paths
  const referenceFiles = skill.listReferences();
  const assetFiles = skill.listAssets();

  if (referenceFiles.length > 0 || assetFiles.length > 0) {
    output += '## Available Resources\n\n';

    // Convert skill's absolute path to relative path from current working directory
    const skillDir = path.relative(process.cwd(), skill.path);

    if (referenceFiles.length > 0) {
      output += '**Reference docs:**\n';
      referenceFiles.slice(0, 3).forEach((file: string) => {
        const resourcePath = path.join(skillDir, 'reference', file);
        output += `  - Read: ${resourcePath}\n`;
      });
    }

    if (assetFiles.length > 0) {
      output += '\n**Templates:**\n';
      assetFiles.slice(0, 3).forEach((file: string) => {
        const resourcePath = path.join(skillDir, 'assets', file);
        output += `  - Read: ${resourcePath}\n`;
      });
    }
  }

  output += '\n**This knowledge is now available for your task.**';
  return output;
}

/**
 * Formats "skill not found" error with available skills list
 */
function formatSkillNotFound(name: string, skillRegistry: SkillRegistry): string {
  const skills = skillRegistry.listSkills();

  let output = `Skill '${name}' not found.\n\nAvailable skills:\n`;

  skills.slice(0, 10).forEach((s) => {
    output += `  - ${s.name}: ${s.description}\n`;
  });

  if (skills.length > 10) {
    output += `  ... and ${skills.length - 10} more\n`;
  }

  return output;
}

/**
 * Creates the Skill tool for loading domain knowledge on-demand
 *
 * This tool enables dynamic skill loading - agents can load specialized
 * domain knowledge as needed during conversation. Once loaded, the skill
 * content remains in conversation history and doesn't need reloading.
 *
 * No cache is needed because conversation history IS the cache.
 *
 * @param skillRegistry - Registry of available skills
 * @returns BaseTool configured for skill loading
 *
 * @example
 * Agent usage: skill({name: "danish-tender-guidelines"})
 */
export const createSkillTool = (skillRegistry: SkillRegistry): BaseTool => {
  // Generate dynamic skill list from registry
  const skills = skillRegistry.listSkills();
  const skillList =
    skills.length > 0
      ? skills.map((s) => `  - ${s.name}: ${s.description}`).join('\n')
      : '  (No skills currently available)';

  return {
    name: 'skill',
    description: `Load specialized domain knowledge on-demand.

Usage: skill({name: "skill-name"})

Available skills:
${skillList}

The skill content will be added to the conversation for your use.`,

    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the skill to load',
        },
      },
      required: ['name'],
    },

    execute: async (args): Promise<ToolResult> => {
      try {
        if (!validateArgs(args)) {
          return {
            content: null,
            error: 'Invalid arguments: expected an object',
          };
        }

        // Input validation
        if (!args.name) {
          return {
            content: null,
            error: 'Error: Skill name is required.\n\nUsage: skill({name: "skill-name"})',
          };
        }

        const skillName = args.name.trim().toLowerCase();
        if (!skillName) {
          return {
            content: null,
            error: 'Error: Skill name cannot be empty.',
          };
        }

        // Load skill
        const skill = skillRegistry.getSkill(skillName);
        if (!skill) {
          return {
            content: null,
            error: formatSkillNotFound(skillName, skillRegistry),
          };
        }

        // Return formatted content
        return {
          content: formatSkillContent(skill),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: null,
          error: `Failed to load skill: ${message}`,
        };
      }
    },

    isConcurrencySafe: () => true, // Reading skills is safe to do in parallel
    category: 'knowledge',
    metadata: {
      tags: ['knowledge', 'skills', 'domain-expertise'],
    },
  };
};
