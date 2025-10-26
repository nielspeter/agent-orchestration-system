/**
 * Unit tests for Skills validation
 */

import { describe, it, expect } from 'vitest';
import {
  SkillFrontmatterSchema,
  validateSkillFrontmatter,
  validateSkillNameMatchesDirectory,
} from '../../../src/skills/validation.js';

describe('SkillFrontmatterSchema', () => {
  describe('valid frontmatter', () => {
    it('should validate minimal required fields', () => {
      const data = {
        name: 'my-skill',
        description: 'A test skill',
      };

      const result = SkillFrontmatterSchema.parse(data);

      expect(result.name).toBe('my-skill');
      expect(result.description).toBe('A test skill');
      expect(result.license).toBeUndefined();
      expect(result['allowed-tools']).toBeUndefined();
      expect(result.metadata).toBeUndefined();
    });

    it('should validate all optional fields', () => {
      const data = {
        name: 'complete-skill',
        description: 'A complete skill with all fields',
        license: 'MIT',
        'allowed-tools': ['read', 'write', 'grep'],
        metadata: {
          version: '1.0.0',
          author: 'Test Author',
          tags: 'test,example',
        },
      };

      const result = SkillFrontmatterSchema.parse(data);

      expect(result.name).toBe('complete-skill');
      expect(result.description).toBe('A complete skill with all fields');
      expect(result.license).toBe('MIT');
      expect(result['allowed-tools']).toEqual(['read', 'write', 'grep']);
      expect(result.metadata).toEqual({
        version: '1.0.0',
        author: 'Test Author',
        tags: 'test,example',
      });
    });

    it('should accept hyphen-case skill names', () => {
      const validNames = [
        'simple',
        'my-skill',
        'multi-word-skill-name',
        'skill123',
        'skill-with-numbers-123',
      ];

      for (const name of validNames) {
        const data = { name, description: 'Test' };
        const result = SkillFrontmatterSchema.parse(data);
        expect(result.name).toBe(name);
      }
    });
  });

  describe('invalid frontmatter', () => {
    it('should reject missing name', () => {
      const data = {
        description: 'A skill without a name',
      };

      expect(() => SkillFrontmatterSchema.parse(data)).toThrow();
    });

    it('should reject missing description', () => {
      const data = {
        name: 'my-skill',
      };

      expect(() => SkillFrontmatterSchema.parse(data)).toThrow();
    });

    it('should reject empty name', () => {
      const data = {
        name: '',
        description: 'Test',
      };

      expect(() => SkillFrontmatterSchema.parse(data)).toThrow('Skill name is required');
    });

    it('should reject empty description', () => {
      const data = {
        name: 'my-skill',
        description: '',
      };

      expect(() => SkillFrontmatterSchema.parse(data)).toThrow('Skill description is required');
    });

    it('should reject invalid name formats', () => {
      const invalidNames = [
        'My-Skill', // uppercase
        'my_skill', // underscore
        'my skill', // space
        'my--skill', // double hyphen
        '-my-skill', // leading hyphen
        'my-skill-', // trailing hyphen
        'my.skill', // dot
        'my/skill', // slash
        'MySkill', // camelCase
        'MY_SKILL', // UPPER_CASE
      ];

      for (const name of invalidNames) {
        const data = { name, description: 'Test' };
        expect(() => SkillFrontmatterSchema.parse(data)).toThrow(/must be hyphen-case/);
      }
    });

    it('should reject invalid allowed-tools type', () => {
      const data = {
        name: 'my-skill',
        description: 'Test',
        'allowed-tools': 'not-an-array',
      };

      expect(() => SkillFrontmatterSchema.parse(data)).toThrow();
    });

    it('should reject invalid metadata type', () => {
      const data = {
        name: 'my-skill',
        description: 'Test',
        metadata: 'not-an-object',
      };

      expect(() => SkillFrontmatterSchema.parse(data)).toThrow();
    });

    it('should reject metadata with non-string values', () => {
      const data = {
        name: 'my-skill',
        description: 'Test',
        metadata: {
          version: 123, // should be string
        },
      };

      expect(() => SkillFrontmatterSchema.parse(data)).toThrow();
    });
  });
});

describe('validateSkillFrontmatter', () => {
  it('should validate and return valid frontmatter', () => {
    const data = {
      name: 'test-skill',
      description: 'A test skill',
      license: 'MIT',
    };

    const result = validateSkillFrontmatter(data);

    expect(result.name).toBe('test-skill');
    expect(result.description).toBe('A test skill');
    expect(result.license).toBe('MIT');
  });

  it('should throw formatted error for invalid frontmatter', () => {
    const data = {
      description: 'Missing name',
    };

    expect(() => validateSkillFrontmatter(data)).toThrow(/Invalid skill frontmatter/);
  });

  it('should include skill name in error message', () => {
    const data = {
      description: 'Missing name',
    };

    expect(() => validateSkillFrontmatter(data, 'my-skill')).toThrow(/in skill 'my-skill'/);
  });

  it('should format multiple validation errors', () => {
    const data = {
      name: '',
      description: '',
    };

    try {
      validateSkillFrontmatter(data);
      expect.fail('Should have thrown an error');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('Invalid skill frontmatter');
      expect(message).toContain('name');
      expect(message).toContain('description');
    }
  });

  it('should preserve all optional fields', () => {
    const data = {
      name: 'full-skill',
      description: 'Complete skill',
      license: 'Apache-2.0',
      'allowed-tools': ['read', 'write'],
      metadata: {
        version: '2.0.0',
        tags: 'test,production',
      },
    };

    const result = validateSkillFrontmatter(data);

    expect(result).toEqual(data);
  });
});

describe('validateSkillNameMatchesDirectory', () => {
  it('should not throw when names match', () => {
    expect(() => validateSkillNameMatchesDirectory('my-skill', 'my-skill')).not.toThrow();
  });

  it('should throw when names do not match', () => {
    expect(() => validateSkillNameMatchesDirectory('wrong-name', 'my-skill')).toThrow(
      /Skill name mismatch/
    );
  });

  it('should include both names in error message', () => {
    try {
      validateSkillNameMatchesDirectory('frontmatter-name', 'directory-name');
      expect.fail('Should have thrown an error');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('frontmatter-name');
      expect(message).toContain('directory-name');
    }
  });
});
