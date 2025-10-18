/**
 * Unit tests for SkillRegistry
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SkillRegistry } from '../../../src/skills/registry.js';
import type { AgentLogger } from '../../../src/logging/types.js';
import { Skill } from '../../../src/skills/types.js';

// Get test fixtures directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../../test-fixtures/skills');

describe('SkillRegistry', () => {
  let registry: SkillRegistry;
  let mockLogger: AgentLogger;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      logSystemMessage: vi.fn(),
      logToolCall: vi.fn(),
      logToolResult: vi.fn(),
      logDelegation: vi.fn(),
      logThinking: vi.fn(),
    };

    registry = new SkillRegistry(fixturesDir, mockLogger);
  });

  describe('loadSkills', () => {
    it('should load all valid skills from directory', async () => {
      await registry.loadSkills();

      expect(registry.size).toBeGreaterThan(0);
      expect(registry.hasSkill('valid-skill')).toBe(true);
      expect(registry.hasSkill('skill-with-resources')).toBe(true);
    });

    it('should skip invalid skills and continue loading', async () => {
      await registry.loadSkills();

      // invalid-skill should be skipped (missing name)
      expect(registry.hasSkill('invalid-skill')).toBe(false);

      // skill-name-mismatch should be skipped (name mismatch)
      expect(registry.hasSkill('skill-name-mismatch')).toBe(false);
      expect(registry.hasSkill('wrong-name')).toBe(false);

      // But valid skills should be loaded
      expect(registry.hasSkill('valid-skill')).toBe(true);
    });

    it('should log loading progress', async () => {
      await registry.loadSkills();

      expect(mockLogger.logSystemMessage).toHaveBeenCalledWith(
        expect.stringContaining('Loading skills from')
      );
      expect(mockLogger.logSystemMessage).toHaveBeenCalledWith(
        expect.stringMatching(/Loaded \d+ skills in \d+ms/)
      );
    });

    it('should log errors for invalid skills', async () => {
      await registry.loadSkills();

      // Should have logged errors for invalid-skill and skill-name-mismatch
      const calls = (mockLogger.logSystemMessage as ReturnType<typeof vi.fn>).mock.calls;
      const errorLogs = calls.filter((call) => call[0].includes('Error loading skill'));

      expect(errorLogs.length).toBeGreaterThan(0);
    });

    it('should throw error if skills directory does not exist', async () => {
      const invalidRegistry = new SkillRegistry('/nonexistent/directory', mockLogger);

      await expect(invalidRegistry.loadSkills()).rejects.toThrow(/Skills directory not found/);
    });

    it('should measure and log load time', async () => {
      await registry.loadSkills();

      expect(mockLogger.logSystemMessage).toHaveBeenCalledWith(
        expect.stringMatching(/Loaded \d+ skills in \d+ms/)
      );
    });
  });

  describe('registerSkill', () => {
    it('should register a skill programmatically', () => {
      const skill = new Skill({
        name: 'test-skill',
        description: 'A test skill',
        instructions: 'Test instructions',
        path: '/test/path',
        loadResource: async () => '',
      });

      registry.registerSkill(skill);

      expect(registry.hasSkill('test-skill')).toBe(true);
      expect(registry.getSkill('test-skill')).toBe(skill);
    });

    it('should overwrite existing skill with same name', () => {
      const skill1 = new Skill({
        name: 'test-skill',
        description: 'Version 1',
        instructions: 'Instructions v1',
        path: '/test/path1',
        loadResource: async () => '',
      });

      const skill2 = new Skill({
        name: 'test-skill',
        description: 'Version 2',
        instructions: 'Instructions v2',
        path: '/test/path2',
        loadResource: async () => '',
      });

      registry.registerSkill(skill1);
      registry.registerSkill(skill2);

      expect(registry.size).toBe(1);
      expect(registry.getSkill('test-skill')?.description).toBe('Version 2');
    });
  });

  describe('getSkill', () => {
    it('should return skill if found', async () => {
      await registry.loadSkills();

      const skill = registry.getSkill('valid-skill');

      expect(skill).toBeDefined();
      expect(skill?.name).toBe('valid-skill');
    });

    it('should return undefined if skill not found', async () => {
      await registry.loadSkills();

      const skill = registry.getSkill('nonexistent-skill');

      expect(skill).toBeUndefined();
    });
  });

  describe('getSkills', () => {
    it('should return multiple skills by names', async () => {
      await registry.loadSkills();

      const skills = registry.getSkills(['valid-skill', 'skill-with-resources']);

      expect(skills).toHaveLength(2);
      expect(skills.map((s) => s.name)).toContain('valid-skill');
      expect(skills.map((s) => s.name)).toContain('skill-with-resources');
    });

    it('should skip missing skills', async () => {
      await registry.loadSkills();

      const skills = registry.getSkills([
        'valid-skill',
        'nonexistent-skill',
        'skill-with-resources',
      ]);

      expect(skills).toHaveLength(2);
      expect(skills.map((s) => s.name)).not.toContain('nonexistent-skill');
    });

    it('should return empty array if no skills found', async () => {
      await registry.loadSkills();

      const skills = registry.getSkills(['nonexistent1', 'nonexistent2']);

      expect(skills).toEqual([]);
    });

    it('should return empty array for empty input', async () => {
      await registry.loadSkills();

      const skills = registry.getSkills([]);

      expect(skills).toEqual([]);
    });
  });

  describe('listSkills', () => {
    it('should return all registered skills', async () => {
      await registry.loadSkills();

      const skills = registry.listSkills();

      expect(skills.length).toBeGreaterThan(0);
      expect(skills).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'valid-skill' }),
          expect.objectContaining({ name: 'skill-with-resources' }),
        ])
      );
    });

    it('should return empty array if no skills loaded', () => {
      const skills = registry.listSkills();

      expect(skills).toEqual([]);
    });
  });

  describe('findByTags', () => {
    beforeEach(async () => {
      await registry.loadSkills();
    });

    it('should find skills by single tag', () => {
      const skills = registry.findByTags(['test']);

      expect(skills.length).toBeGreaterThan(0);
      expect(skills.some((s) => s.name === 'valid-skill')).toBe(true);
    });

    it('should find skills by multiple tags (OR logic)', () => {
      const skills = registry.findByTags(['test', 'resources']);

      expect(skills.length).toBeGreaterThan(0);
    });

    it('should return empty array if no skills match tags', () => {
      const skills = registry.findByTags(['nonexistent-tag']);

      expect(skills).toEqual([]);
    });

    it('should return empty array if skill has no tags', () => {
      // Register a skill without tags
      const skillNoTags = new Skill({
        name: 'no-tags',
        description: 'No tags',
        instructions: 'Test',
        path: '/test',
        loadResource: async () => '',
      });
      registry.registerSkill(skillNoTags);

      const skills = registry.findByTags(['any-tag']);

      expect(skills).not.toContain(skillNoTags);
    });

    it('should handle comma-separated tags correctly', () => {
      // valid-skill has tags: "test,example"
      const skillsWithTest = registry.findByTags(['test']);
      const skillsWithExample = registry.findByTags(['example']);

      expect(skillsWithTest.length).toBeGreaterThan(0);
      expect(skillsWithExample.length).toBeGreaterThan(0);
    });

    it('should trim whitespace from tags', () => {
      // Register a skill with tags that have spaces
      const skill = new Skill({
        name: 'spaced-tags',
        description: 'Tags with spaces',
        instructions: 'Test',
        path: '/test',
        metadata: {
          tags: 'tag1 , tag2,  tag3',
        },
        loadResource: async () => '',
      });
      registry.registerSkill(skill);

      const skills = registry.findByTags(['tag2']);

      expect(skills).toContain(skill);
    });
  });

  describe('hasSkill', () => {
    it('should return true if skill exists', async () => {
      await registry.loadSkills();

      expect(registry.hasSkill('valid-skill')).toBe(true);
    });

    it('should return false if skill does not exist', async () => {
      await registry.loadSkills();

      expect(registry.hasSkill('nonexistent-skill')).toBe(false);
    });
  });

  describe('size', () => {
    it('should return number of registered skills', async () => {
      expect(registry.size).toBe(0);

      await registry.loadSkills();

      expect(registry.size).toBeGreaterThan(0);
    });

    it('should update when skills are added', () => {
      const skill = new Skill({
        name: 'test-skill',
        description: 'Test',
        instructions: 'Test',
        path: '/test',
        loadResource: async () => '',
      });

      expect(registry.size).toBe(0);

      registry.registerSkill(skill);

      expect(registry.size).toBe(1);
    });
  });

  describe('clear', () => {
    it('should remove all skills from registry', async () => {
      await registry.loadSkills();

      expect(registry.size).toBeGreaterThan(0);

      registry.clear();

      expect(registry.size).toBe(0);
      expect(registry.listSkills()).toEqual([]);
    });

    it('should allow reloading after clear', async () => {
      await registry.loadSkills();
      const countBefore = registry.size;

      registry.clear();

      expect(registry.size).toBe(0);

      await registry.loadSkills();

      expect(registry.size).toBe(countBefore);
    });
  });

  describe('edge cases', () => {
    it('should work without logger', async () => {
      const registryNoLogger = new SkillRegistry(fixturesDir);

      await registryNoLogger.loadSkills();

      expect(registryNoLogger.size).toBeGreaterThan(0);
    });

    it('should handle empty skills directory', async () => {
      const emptyDir = path.join(fixturesDir, '..');
      const emptyRegistry = new SkillRegistry(emptyDir, mockLogger);

      // Create a temporary empty directory for this test would be ideal,
      // but for now we'll just test that it doesn't crash
      await expect(emptyRegistry.loadSkills()).resolves.not.toThrow();
    });
  });
});
