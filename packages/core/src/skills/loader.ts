/**
 * Skill Loader
 *
 * Loads individual skills from filesystem.
 * Handles parsing SKILL.md files and loading resource directories.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import type { AgentLogger } from '../logging/types.js';
import { Skill } from './types.js';
import { validateSkillFrontmatter, validateSkillNameMatchesDirectory } from './validation.js';

/**
 * Allowed file extensions for each resource type
 */
const ALLOWED_EXTENSIONS = {
  reference: ['.md', '.txt', '.json', '.yaml', '.yml', '.xml', '.csv'],
  scripts: ['.py', '.js', '.ts', '.sh', '.bash', '.zsh', '.fish', '.rb', '.pl'],
  assets: ['.txt', '.md', '.json', '.yaml', '.yml', '.xml', '.csv', '.html', '.css', '.svg'],
} as const;

/**
 * SkillLoader
 *
 * Loads skills from SKILL.md files following Anthropic's Agent Skills Spec v1.0.
 */
export class SkillLoader {
  constructor(private readonly logger?: AgentLogger) {}

  /**
   * Load a skill from a directory
   *
   * @param skillPath - Absolute path to skill directory
   * @returns Loaded skill with lazy-loaded resources
   * @throws Error if SKILL.md not found or validation fails
   */
  async loadSkill(skillPath: string): Promise<Skill> {
    this.logger?.logSystemMessage(`Loading skill from ${skillPath}`);

    // 1. Check for SKILL.md
    const skillFile = path.join(skillPath, 'SKILL.md');
    try {
      await fs.access(skillFile);
    } catch {
      throw new Error(`No SKILL.md found in ${skillPath}`);
    }

    // 2. Parse SKILL.md (frontmatter + content)
    const content = await fs.readFile(skillFile, 'utf-8');
    const parsed = matter(content);

    // 3. Validate frontmatter
    const directoryName = path.basename(skillPath);
    const validated = validateSkillFrontmatter(parsed.data, directoryName);

    // 4. Verify name matches directory
    validateSkillNameMatchesDirectory(validated.name, directoryName);

    // 5. Scan for resource files (don't load content yet)
    const referenceFiles = await this.scanResourceFiles(skillPath, 'reference');
    const scriptFiles = await this.scanResourceFiles(skillPath, 'scripts');
    const assetFiles = await this.scanResourceFiles(skillPath, 'assets');

    // 6. Create resource loader function with path traversal protection
    const loadResource = async (resourcePath: string): Promise<string> => {
      const fullPath = path.resolve(skillPath, resourcePath);

      // Security: Ensure resolved path is still within skill directory
      const normalizedSkillPath = path.resolve(skillPath);
      if (!fullPath.startsWith(normalizedSkillPath + path.sep)) {
        throw new Error(`Path traversal detected: ${resourcePath} escapes skill directory`);
      }

      return await fs.readFile(fullPath, 'utf-8');
    };

    // 7. Construct Skill instance
    const skill = new Skill({
      name: validated.name,
      description: validated.description,
      license: validated.license,
      allowedTools: validated['allowed-tools'],
      metadata: validated.metadata,
      instructions: parsed.content.trim(),
      path: skillPath,
      referenceFiles,
      scriptFiles,
      assetFiles,
      loadResource,
    });

    this.logger?.logSystemMessage(
      `Loaded skill: ${skill.name}${skill.metadata?.version ? ` v${skill.metadata.version}` : ''} (${referenceFiles.length + scriptFiles.length + assetFiles.length} resources available)`
    );

    return skill;
  }

  /**
   * Scan for resource files in a directory (doesn't load content)
   * @param skillPath - Path to skill directory
   * @param resourceType - Type of resource (reference, scripts, assets)
   * @returns Array of filenames
   */
  private async scanResourceFiles(
    skillPath: string,
    resourceType: 'reference' | 'scripts' | 'assets'
  ): Promise<string[]> {
    const resourceDir = path.join(skillPath, resourceType);

    try {
      await fs.access(resourceDir);
    } catch {
      // No resource directory is fine
      return [];
    }

    const allowedExtensions = ALLOWED_EXTENSIONS[resourceType];
    const filenames: string[] = [];
    const files = await fs.readdir(resourceDir);

    for (const file of files) {
      const filePath = path.join(resourceDir, file);
      const stats = await fs.stat(filePath);

      // Only include files with allowed extensions
      if (stats.isFile()) {
        const ext = path.extname(file).toLowerCase();
        if ((allowedExtensions as readonly string[]).includes(ext)) {
          filenames.push(file);
        } else {
          this.logger?.logSystemMessage(
            `Skipping ${resourceType} file '${file}' (unsupported extension: ${ext})`
          );
        }
      }
    }

    return filenames;
  }
}
