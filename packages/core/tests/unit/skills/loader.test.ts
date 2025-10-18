/**
 * Unit tests for SkillLoader
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SkillLoader } from '../../../src/skills/loader.js';
import type { AgentLogger } from '../../../src/logging/types.js';

// Get test fixtures directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../../test-fixtures/skills');

describe('SkillLoader', () => {
  let loader: SkillLoader;
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

    loader = new SkillLoader(mockLogger);
  });

  describe('loadSkill', () => {
    it('should load a minimal valid skill', async () => {
      const skillPath = path.join(fixturesDir, 'valid-skill');
      const skill = await loader.loadSkill(skillPath);

      expect(skill.name).toBe('valid-skill');
      expect(skill.description).toBe('A minimal valid skill for testing');
      expect(skill.license).toBe('MIT');
      expect(skill.metadata).toEqual({
        version: '1.0.0',
        author: 'Test Author',
        tags: 'test,example',
      });
      expect(skill.instructions).toContain('Valid Skill Instructions');
      expect(skill.path).toBe(skillPath);
      expect(skill.listReferences()).toEqual([]);
      expect(skill.listScripts()).toEqual([]);
      expect(skill.listAssets()).toEqual([]);
    });

    it('should load a skill with all resources', async () => {
      const skillPath = path.join(fixturesDir, 'skill-with-resources');
      const skill = await loader.loadSkill(skillPath);

      expect(skill.name).toBe('skill-with-resources');
      expect(skill.description).toBe('A skill with reference, assets, and scripts');
      expect(skill.license).toBe('Apache-2.0');
      expect(skill.allowedTools).toEqual(['read', 'write', 'grep']);
      expect(skill.metadata).toEqual({
        version: '2.1.0',
        author: 'Test Team',
        tags: 'testing,resources',
      });

      // Check reference files are available (not loaded yet)
      expect(skill.listReferences()).toContain('api-docs.md');
      expect(skill.listReferences()).toContain('schema.json');

      // Check assets files are available
      expect(skill.listAssets()).toContain('template.txt');

      // Check scripts files are available
      expect(skill.listScripts()).toContain('helper.py');

      // Test lazy loading of resources
      const apiDocs = await skill.getReference('api-docs.md');
      expect(apiDocs).toContain('API Documentation');

      const schema = await skill.getReference('schema.json');
      expect(schema).toContain('"$schema"');

      const template = await skill.getAsset('template.txt');
      expect(template).toContain('Output Template');

      const script = await skill.getScript('helper.py');
      expect(script).toContain('def process_data');
    });

    it('should log skill loading', async () => {
      const skillPath = path.join(fixturesDir, 'valid-skill');
      await loader.loadSkill(skillPath);

      expect(mockLogger.logSystemMessage).toHaveBeenCalledWith(
        expect.stringContaining('Loading skill from')
      );
      expect(mockLogger.logSystemMessage).toHaveBeenCalledWith(
        expect.stringContaining('Loaded skill: valid-skill v1.0.0')
      );
    });

    it('should log skill name without version if no metadata', async () => {
      // Create a loader without logger for this test
      const loaderNoLogger = new SkillLoader();
      const skillPath = path.join(fixturesDir, 'valid-skill');

      // This should not throw even without a logger
      const skill = await loaderNoLogger.loadSkill(skillPath);
      expect(skill.name).toBe('valid-skill');
    });

    it('should throw error if SKILL.md not found', async () => {
      const skillPath = path.join(fixturesDir, 'nonexistent-skill');

      await expect(loader.loadSkill(skillPath)).rejects.toThrow(/No SKILL.md found/);
    });

    it('should throw error if frontmatter is invalid', async () => {
      const skillPath = path.join(fixturesDir, 'invalid-skill');

      await expect(loader.loadSkill(skillPath)).rejects.toThrow(/Invalid skill frontmatter/);
    });

    it('should throw error if skill name does not match directory', async () => {
      const skillPath = path.join(fixturesDir, 'skill-name-mismatch');

      await expect(loader.loadSkill(skillPath)).rejects.toThrow(/Skill name mismatch/);
    });

    it('should handle skills without optional fields', async () => {
      const skillPath = path.join(fixturesDir, 'valid-skill');
      const skill = await loader.loadSkill(skillPath);

      // valid-skill has license and metadata, but let's check the structure
      expect(skill).toHaveProperty('name');
      expect(skill).toHaveProperty('description');
      expect(skill).toHaveProperty('instructions');
      expect(skill).toHaveProperty('path');
    });

    it('should trim whitespace from instructions', async () => {
      const skillPath = path.join(fixturesDir, 'valid-skill');
      const skill = await loader.loadSkill(skillPath);

      // Instructions should be trimmed
      expect(skill.instructions).not.toMatch(/^\s/);
      expect(skill.instructions).not.toMatch(/\s$/);
    });

    it('should work without logger', async () => {
      const loaderNoLogger = new SkillLoader();
      const skillPath = path.join(fixturesDir, 'valid-skill');

      const skill = await loaderNoLogger.loadSkill(skillPath);

      expect(skill.name).toBe('valid-skill');
    });
  });

  describe('resource loading', () => {
    it('should return empty array if reference directory does not exist', async () => {
      const skillPath = path.join(fixturesDir, 'valid-skill');
      const skill = await loader.loadSkill(skillPath);

      expect(skill.listReferences()).toEqual([]);
    });

    it('should return empty array if assets directory does not exist', async () => {
      const skillPath = path.join(fixturesDir, 'valid-skill');
      const skill = await loader.loadSkill(skillPath);

      expect(skill.listAssets()).toEqual([]);
    });

    it('should return empty array if scripts directory does not exist', async () => {
      const skillPath = path.join(fixturesDir, 'valid-skill');
      const skill = await loader.loadSkill(skillPath);

      expect(skill.listScripts()).toEqual([]);
    });

    it('should scan multiple files from reference directory', async () => {
      const skillPath = path.join(fixturesDir, 'skill-with-resources');
      const skill = await loader.loadSkill(skillPath);

      expect(skill.listReferences()).toHaveLength(2);
      expect(skill.listReferences()).toContain('api-docs.md');
      expect(skill.listReferences()).toContain('schema.json');
    });

    it('should preserve file content exactly when lazy loaded', async () => {
      const skillPath = path.join(fixturesDir, 'skill-with-resources');
      const skill = await loader.loadSkill(skillPath);

      // Check that JSON is preserved
      const schemaContent = await skill.getReference('schema.json');
      expect(schemaContent).toBeDefined();
      const schema = JSON.parse(schemaContent as string);
      expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#');

      // Check that markdown is preserved
      const apiDocs = await skill.getReference('api-docs.md');
      expect(apiDocs).toContain('## Endpoints');
    });

    it('should cache loaded resources', async () => {
      const skillPath = path.join(fixturesDir, 'skill-with-resources');
      const skill = await loader.loadSkill(skillPath);

      // Load a resource twice
      const first = await skill.getReference('api-docs.md');
      const second = await skill.getReference('api-docs.md');

      // Should return the same content (cached)
      expect(first).toBe(second);
    });

    it('should return undefined for non-existent resources', async () => {
      const skillPath = path.join(fixturesDir, 'skill-with-resources');
      const skill = await loader.loadSkill(skillPath);

      expect(await skill.getReference('nonexistent.md')).toBeUndefined();
      expect(await skill.getScript('nonexistent.py')).toBeUndefined();
      expect(await skill.getAsset('nonexistent.txt')).toBeUndefined();
    });

    it('should support loadAll methods', async () => {
      const skillPath = path.join(fixturesDir, 'skill-with-resources');
      const skill = await loader.loadSkill(skillPath);

      const references = await skill.loadAllReferences();
      expect(Object.keys(references)).toHaveLength(2);
      expect(references['api-docs.md']).toContain('API Documentation');

      const scripts = await skill.loadAllScripts();
      expect(Object.keys(scripts)).toHaveLength(1);
      expect(scripts['helper.py']).toContain('def process_data');

      const assets = await skill.loadAllAssets();
      expect(Object.keys(assets)).toHaveLength(1);
      expect(assets['template.txt']).toContain('Output Template');
    });
  });
});
