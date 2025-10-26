import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createSkillTool } from '@/tools/skill.tool';
import type { SkillRegistry } from '@/skills/registry';
import type { Skill } from '@/skills/types';

describe('SkillTool', () => {
  let skillTool: any;
  let mockRegistry: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock registry with default skills list
    mockRegistry = {
      getSkill: vi.fn(),
      listSkills: vi.fn().mockReturnValue([
        { name: 'test-skill', description: 'Test skill' },
        { name: 'another-skill', description: 'Another skill' },
      ]),
    };

    skillTool = createSkillTool(mockRegistry as unknown as SkillRegistry);
  });

  test('has correct metadata', () => {
    expect(skillTool.name).toBe('skill');
    expect(skillTool.description).toContain('Load specialized domain knowledge');
    expect(skillTool.category).toBe('knowledge');
    expect(skillTool.isConcurrencySafe()).toBe(true);
  });

  test('loads existing skill successfully', async () => {
    const mockSkill: Partial<Skill> = {
      name: 'test-skill',
      description: 'Test skill description',
      instructions: 'These are the test instructions.',
      path: '/test/skills/test-skill',
      listReferences: () => [],
      listAssets: () => [],
    };

    mockRegistry.getSkill.mockReturnValue(mockSkill);

    const result = await skillTool.execute({ name: 'test-skill' });

    expect(result.content).toContain('# Skill Loaded: test-skill');
    expect(result.content).toContain('Test skill description');
    expect(result.content).toContain('These are the test instructions.');
    expect(result.error).toBeUndefined();
    expect(mockRegistry.getSkill).toHaveBeenCalledWith('test-skill');
  });

  test('handles non-existent skill', async () => {
    mockRegistry.getSkill.mockReturnValue(undefined);
    mockRegistry.listSkills.mockReturnValue([
      { name: 'skill-1', description: 'First skill' },
      { name: 'skill-2', description: 'Second skill' },
    ]);

    const result = await skillTool.execute({ name: 'non-existent' });

    expect(result.content).toBeNull();
    expect(result.error).toContain("Skill 'non-existent' not found");
    expect(result.error).toContain('skill-1: First skill');
    expect(result.error).toContain('skill-2: Second skill');
  });

  test('handles empty input', async () => {
    const result = await skillTool.execute({});

    expect(result.content).toBeNull();
    expect(result.error).toContain('Skill name is required');
    expect(result.error).toContain('Usage: skill({name: "skill-name"})');
  });

  test('handles empty skill name', async () => {
    const result = await skillTool.execute({ name: '   ' });

    expect(result.content).toBeNull();
    expect(result.error).toContain('Skill name cannot be empty');
  });

  test('formats skill content with resources correctly', async () => {
    const mockSkill: Partial<Skill> = {
      name: 'resource-skill',
      description: 'Skill with resources',
      instructions: 'Instructions here',
      path: '/test/skills/resource-skill', // Add path for resource path calculation
      listReferences: () => ['doc1.md', 'doc2.pdf'],
      listAssets: () => ['template1.md', 'template2.txt'],
    };

    mockRegistry.getSkill.mockReturnValue(mockSkill);

    const result = await skillTool.execute({ name: 'resource-skill' });

    expect(result.content).toContain('## Available Resources');
    expect(result.content).toContain('**Reference docs:**');
    expect(result.content).toContain('doc1.md'); // Check filename is present
    expect(result.content).toContain('**Templates:**');
    expect(result.content).toContain('template1.md'); // Check filename is present
    expect(result.content).toContain('This knowledge is now available for your task');
    expect(result.error).toBeUndefined();
  });

  test('limits resource listing to 3 items', async () => {
    const mockSkill: Partial<Skill> = {
      name: 'many-resources',
      description: 'Skill with many resources',
      instructions: 'Instructions',
      path: '/test/skills/many-resources', // Add path for resource path calculation
      listReferences: () => ['ref1.md', 'ref2.md', 'ref3.md', 'ref4.md', 'ref5.md'],
      listAssets: () => [],
    };

    mockRegistry.getSkill.mockReturnValue(mockSkill);

    const result = await skillTool.execute({ name: 'many-resources' });

    expect(result.content).toContain('ref1.md');
    expect(result.content).toContain('ref2.md');
    expect(result.content).toContain('ref3.md');
    expect(result.content).not.toContain('ref4.md');
    expect(result.content).not.toContain('ref5.md');
    expect(result.error).toBeUndefined();
  });

  test('limits skill listing to 10 items when skill not found', async () => {
    const manySkills = Array.from({ length: 15 }, (_, i) => ({
      name: `skill-${i}`,
      description: `Description ${i}`,
    }));

    mockRegistry.getSkill.mockReturnValue(undefined);
    mockRegistry.listSkills.mockReturnValue(manySkills);

    const result = await skillTool.execute({ name: 'missing' });

    expect(result.content).toBeNull();
    expect(result.error).toContain('skill-0');
    expect(result.error).toContain('skill-9');
    expect(result.error).toContain('... and 5 more');
    expect(result.error).not.toContain('skill-10');
  });

  test('normalizes skill name (passes through to registry)', async () => {
    const mockSkill: Partial<Skill> = {
      name: 'test-skill',
      description: 'Test',
      instructions: 'Instructions',
      path: '/test/skills/test-skill',
      listReferences: () => [],
      listAssets: () => [],
    };

    mockRegistry.getSkill.mockReturnValue(mockSkill);

    await skillTool.execute({ name: 'Test-Skill' });

    // The tool passes the lowercase version to registry
    expect(mockRegistry.getSkill).toHaveBeenCalledWith('test-skill');
  });

  test('handles invalid arguments gracefully', async () => {
    const result = await skillTool.execute(null as any);

    expect(result.content).toBeNull();
    expect(result.error).toContain('Invalid arguments');
  });

  test('generates dynamic skill list in description', () => {
    // Tool should include skills from registry in description
    expect(skillTool.description).toContain('test-skill: Test skill');
    expect(skillTool.description).toContain('another-skill: Another skill');
  });

  test('handles empty skill registry gracefully', () => {
    const emptyRegistry = {
      getSkill: vi.fn(),
      listSkills: vi.fn().mockReturnValue([]),
    };

    const emptySkillTool = createSkillTool(emptyRegistry as unknown as SkillRegistry);

    expect(emptySkillTool.description).toContain('No skills currently available');
  });
});

describe('Skill Tool - Argument Validation', () => {
  let skillTool: BaseTool;

  beforeEach(() => {
    const mockRegistry = {
      getSkill: vi.fn(),
      listSkills: vi.fn().mockReturnValue([{ name: 'test-skill', description: 'Test skill' }]),
    };
    skillTool = createSkillTool(mockRegistry as unknown as SkillRegistry);
  });

  test('rejects null arguments', async () => {
    const result = await skillTool.execute(null);
    expect(result.error).toBe('Invalid arguments: expected an object');
  });

  test('rejects undefined arguments', async () => {
    const result = await skillTool.execute(undefined);
    expect(result.error).toBe('Invalid arguments: expected an object');
  });

  test('rejects array arguments', async () => {
    const result = await skillTool.execute(['test-skill']);
    expect(result.error).toBe('Invalid arguments: expected an object');
  });

  test('rejects string arguments', async () => {
    const result = await skillTool.execute('test-skill');
    expect(result.error).toBe('Invalid arguments: expected an object');
  });

  test('rejects number arguments', async () => {
    const result = await skillTool.execute(123);
    expect(result.error).toBe('Invalid arguments: expected an object');
  });

  test('accepts empty object (will fail later with missing name)', async () => {
    const result = await skillTool.execute({});
    expect(result.error).toContain('name is required');
  });

  test('accepts valid object with name', async () => {
    // This will fail because skill doesn't exist, but argument validation passes
    const result = await skillTool.execute({ name: 'nonexistent' });
    expect(result.error).toContain('not found');
    expect(result.error).not.toContain('Invalid arguments');
  });
});
