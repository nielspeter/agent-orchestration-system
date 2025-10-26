/**
 * Skill Registry
 *
 * Central registry for all available skills.
 * Manages skill loading, lookup, and discovery.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { AgentLogger } from '../logging/types.js';
import type { Skill } from './types.js';
import { SkillLoader } from './loader.js';

/**
 * SkillRegistry
 *
 * Central registry for skills in the agent system.
 * Loads skills from a directory and provides lookup/discovery methods.
 *
 * Follows the same pattern as ToolRegistry for consistency.
 */
export class SkillRegistry {
  private skills = new Map<string, Skill>();
  private readonly loader: SkillLoader;

  constructor(
    private readonly skillsDir: string,
    private readonly logger?: AgentLogger
  ) {
    this.loader = new SkillLoader(logger);
  }

  /**
   * Load all skills from the skills directory
   *
   * Scans skillsDir for subdirectories, loads each skill using SkillLoader.
   *
   * @throws Error if skillsDir doesn't exist or isn't accessible
   */
  async loadSkills(): Promise<void> {
    this.logger?.logSystemMessage(`Loading skills from ${this.skillsDir}`);

    const startTime = Date.now();

    // 1. Check if skills directory exists
    try {
      await fs.access(this.skillsDir);
    } catch {
      throw new Error(`Skills directory not found: ${this.skillsDir}`);
    }

    // 2. Scan for subdirectories
    const entries = await fs.readdir(this.skillsDir, { withFileTypes: true });
    const skillDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

    // 3. Load each skill
    for (const dirName of skillDirs) {
      const skillPath = path.join(this.skillsDir, dirName);

      try {
        const skill = await this.loader.loadSkill(skillPath);
        this.registerSkill(skill);
      } catch (error) {
        // Log error but continue loading other skills
        const message = error instanceof Error ? error.message : String(error);
        this.logger?.logSystemMessage(`Error loading skill from ${dirName}: ${message}`);
      }
    }

    const loadTimeMs = Date.now() - startTime;
    this.logger?.logSystemMessage(`Loaded ${this.skills.size} skills in ${loadTimeMs}ms`);
  }

  /**
   * Register a skill programmatically
   *
   * Useful for:
   * - Testing (inject mock skills)
   * - Inline skills (programmatically defined)
   * - External skill sources
   *
   * @param skill - Skill to register
   */
  registerSkill(skill: Skill): void {
    if (this.skills.has(skill.name)) {
      const existing = this.skills.get(skill.name);
      const existingVersion = existing?.metadata?.version || 'unknown';
      const newVersion = skill.metadata?.version || 'unknown';
      this.logger?.logSystemMessage(
        `Warning: Overwriting skill '${skill.name}' (v${existingVersion} → v${newVersion})`
      );
    }
    this.skills.set(skill.name, skill);
  }

  /**
   * Get a skill by name
   *
   * Normalizes the name (lowercase, trimmed) for case-insensitive lookup.
   *
   * @param name - Skill name
   * @returns Skill if found, undefined otherwise
   */
  getSkill(name: string): Skill | undefined {
    const normalized = name.trim().toLowerCase();
    return this.skills.get(normalized);
  }

  /**
   * Get multiple skills by names
   *
   * Useful for loading all skills referenced by an agent.
   *
   * @param names - Array of skill names
   * @returns Array of found skills (skips missing skills)
   */
  getSkills(names: string[]): Skill[] {
    const skills: Skill[] = [];
    for (const name of names) {
      const skill = this.getSkill(name);
      if (skill) {
        skills.push(skill);
      }
    }
    return skills;
  }

  /**
   * List all available skills
   *
   * @returns Array of all registered skills
   */
  listSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Find skills by metadata tags
   *
   * Searches skills where metadata.tags includes any of the provided tags.
   * Tags in metadata are comma-separated strings: "tag1,tag2,tag3"
   *
   * @param tags - Tags to search for
   * @returns Array of skills matching any tag
   */
  findByTags(tags: string[]): Skill[] {
    return this.listSkills().filter((skill) => {
      if (!skill.metadata?.tags) {
        return false;
      }

      const skillTags = skill.metadata.tags.split(',').map((t) => t.trim());
      return tags.some((tag) => skillTags.includes(tag));
    });
  }

  /**
   * Check if a skill exists
   *
   * @param name - Skill name
   * @returns True if skill is registered
   */
  hasSkill(name: string): boolean {
    return this.skills.has(name);
  }

  /**
   * Get count of registered skills
   *
   * @returns Number of skills in registry
   */
  get size(): number {
    return this.skills.size;
  }

  /**
   * Clear all skills from registry
   *
   * Useful for testing or reloading skills.
   */
  clear(): void {
    this.skills.clear();
  }
}
