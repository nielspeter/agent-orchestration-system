import { describe, expect, it } from 'vitest';
import { validateAgentFrontmatter, validateThinkingCompatibility } from '@/agents/validation';
import type { ProvidersConfig } from '@/config/types';

describe('Agent Validation', () => {
  describe('validateAgentFrontmatter', () => {
    it('should accept valid frontmatter with minimal config', () => {
      const frontmatter = {
        name: 'test-agent',
      };

      const result = validateAgentFrontmatter(frontmatter, 'test-agent');
      expect(result.name).toBe('test-agent');
    });

    it('should accept valid frontmatter with all options', () => {
      const frontmatter = {
        name: 'test-agent',
        model: 'claude-3-5-haiku-latest',
        tools: ['read', 'write'],
        behavior: 'balanced',
        temperature: 0.7,
        top_p: 0.9,
        response_format: 'text',
        thinking: {
          enabled: true,
          budget_tokens: 8000,
        },
      };

      const result = validateAgentFrontmatter(frontmatter, 'test-agent');
      expect(result.name).toBe('test-agent');
      expect(result.model).toBe('claude-3-5-haiku-latest');
      expect(result.tools).toEqual(['read', 'write']);
      expect(result.behavior).toBe('balanced');
      expect(result.temperature).toBe(0.7);
      expect(result.top_p).toBe(0.9);
      expect(result.response_format).toBe('text');
      expect(result.thinking).toEqual({ enabled: true, budget_tokens: 8000 });
    });

    it('should accept wildcard tools', () => {
      const frontmatter = {
        name: 'test-agent',
        tools: '*',
      };

      const result = validateAgentFrontmatter(frontmatter, 'test-agent');
      expect(result.tools).toBe('*');
    });

    it('should reject missing name', () => {
      const frontmatter = {};

      expect(() => validateAgentFrontmatter(frontmatter, 'test-agent')).toThrow(
        /Invalid frontmatter in agent 'test-agent'/
      );
    });

    it('should reject empty name', () => {
      const frontmatter = {
        name: '',
      };

      expect(() => validateAgentFrontmatter(frontmatter, 'test-agent')).toThrow(
        'Agent name is required'
      );
    });

    it('should reject invalid behavior preset', () => {
      const frontmatter = {
        name: 'test-agent',
        behavior: 'invalid-preset',
      };

      expect(() => validateAgentFrontmatter(frontmatter, 'test-agent')).toThrow(/behavior/);
    });

    it('should reject temperature out of range', () => {
      const frontmatter = {
        name: 'test-agent',
        temperature: 2.5,
      };

      expect(() => validateAgentFrontmatter(frontmatter, 'test-agent')).toThrow(/temperature/);
    });

    it('should reject top_p out of range', () => {
      const frontmatter = {
        name: 'test-agent',
        top_p: 1.5,
      };

      expect(() => validateAgentFrontmatter(frontmatter, 'test-agent')).toThrow(/top_p/);
    });

    it('should reject invalid response_format', () => {
      const frontmatter = {
        name: 'test-agent',
        response_format: 'invalid',
      };

      expect(() => validateAgentFrontmatter(frontmatter, 'test-agent')).toThrow(/response_format/);
    });

    it('should reject old thinking syntax (type: enabled)', () => {
      const frontmatter = {
        name: 'test-agent',
        thinking: {
          type: 'enabled',
        },
      };

      expect(() => validateAgentFrontmatter(frontmatter, 'test-agent')).toThrow(
        /Invalid frontmatter in agent 'test-agent'/
      );
    });

    it('should accept thinking as boolean', () => {
      const frontmatter = {
        name: 'test-agent',
        thinking: true,
      };

      const result = validateAgentFrontmatter(frontmatter, 'test-agent');
      expect(result.thinking).toBe(true);
    });

    it('should accept thinking with budget_tokens', () => {
      const frontmatter = {
        name: 'test-agent',
        thinking: {
          enabled: true,
          budget_tokens: 16000,
        },
      };

      const result = validateAgentFrontmatter(frontmatter, 'test-agent');
      expect(result.thinking).toEqual({ enabled: true, budget_tokens: 16000 });
    });

    it('should reject thinking with budget_tokens below minimum', () => {
      const frontmatter = {
        name: 'test-agent',
        thinking: {
          enabled: true,
          budget_tokens: 100, // Below 512 minimum
        },
      };

      expect(() => validateAgentFrontmatter(frontmatter, 'test-agent')).toThrow(/budget_tokens/);
    });

    it('should reject thinking with budget_tokens above maximum', () => {
      const frontmatter = {
        name: 'test-agent',
        thinking: {
          enabled: true,
          budget_tokens: 300000, // Above 200000 maximum
        },
      };

      expect(() => validateAgentFrontmatter(frontmatter, 'test-agent')).toThrow(/budget_tokens/);
    });

    it('should accept all valid behavior presets', () => {
      const presets = ['deterministic', 'precise', 'balanced', 'creative', 'exploratory'];

      for (const preset of presets) {
        const frontmatter = {
          name: 'test-agent',
          behavior: preset,
        };

        const result = validateAgentFrontmatter(frontmatter, 'test-agent');
        expect(result.behavior).toBe(preset);
      }
    });

    it('should accept all valid response formats', () => {
      const formats = ['text', 'json', 'json_schema'];

      for (const format of formats) {
        const frontmatter = {
          name: 'test-agent',
          response_format: format,
        };

        const result = validateAgentFrontmatter(frontmatter, 'test-agent');
        expect(result.response_format).toBe(format);
      }
    });
  });

  describe('validateThinkingCompatibility', () => {
    const providersConfig: ProvidersConfig = {
      providers: {
        anthropic: {
          type: 'native',
          apiKeyEnv: 'ANTHROPIC_API_KEY',
          models: [
            {
              id: 'claude-haiku-4-5',
              contextLength: 200000,
              maxOutputTokens: 4096,
              pricing: { input: 0.0008, output: 0.004 },
              capabilities: {
                thinking: true,
                thinkingMinBudget: 512,
                thinkingMaxBudget: 32768,
                thinkingDefaultBudget: 8000,
              },
            },
            {
              id: 'claude-3-5-haiku-latest',
              contextLength: 200000,
              maxOutputTokens: 8192,
              pricing: { input: 0.001, output: 0.005 },
              capabilities: {},
            },
          ],
        },
      },
      behaviorPresets: {
        balanced: { temperature: 0.5, top_p: 0.85 },
      },
    };

    it('should allow thinking when disabled', () => {
      const result = validateThinkingCompatibility(
        'test-agent',
        'anthropic/claude-haiku-4-5',
        false,
        0.7,
        0.9,
        'anthropic/claude-haiku-4-5',
        providersConfig
      );

      expect(result.valid).toBe(true);
    });

    it('should allow thinking without temperature or top_p', () => {
      const result = validateThinkingCompatibility(
        'test-agent',
        'anthropic/claude-haiku-4-5',
        { enabled: true, budget_tokens: 8000 },
        undefined,
        undefined,
        'anthropic/claude-haiku-4-5',
        providersConfig
      );

      expect(result.valid).toBe(true);
    });

    it('should reject thinking with temperature', () => {
      const result = validateThinkingCompatibility(
        'test-agent',
        'anthropic/claude-haiku-4-5',
        { enabled: true, budget_tokens: 8000 },
        0.7,
        undefined,
        'anthropic/claude-haiku-4-5',
        providersConfig
      );

      expect(result.valid).toBe(false);
      expect(result.message).toContain('incompatible with custom temperature');
      expect(result.message).toContain('Remove "temperature"');
    });

    it('should reject thinking with top_p', () => {
      const result = validateThinkingCompatibility(
        'test-agent',
        'anthropic/claude-haiku-4-5',
        { enabled: true, budget_tokens: 8000 },
        undefined,
        0.9,
        'anthropic/claude-haiku-4-5',
        providersConfig
      );

      expect(result.valid).toBe(false);
      expect(result.message).toContain('incompatible with custom top_p');
    });

    it('should reject thinking on unsupported model', () => {
      const result = validateThinkingCompatibility(
        'test-agent',
        'anthropic/claude-3-5-haiku-latest', // Must use provider/model format
        { enabled: true, budget_tokens: 8000 },
        undefined,
        undefined,
        'anthropic/claude-haiku-4-5',
        providersConfig
      );

      expect(result.valid).toBe(false);
      expect(result.message).toContain('does not support thinking');
      expect(result.message).toContain('anthropic/claude-3-5-haiku-latest');
    });

    it('should use default model when agent model not specified', () => {
      const result = validateThinkingCompatibility(
        'test-agent',
        undefined,
        { enabled: true, budget_tokens: 8000 },
        undefined,
        undefined,
        'anthropic/claude-haiku-4-5',
        providersConfig
      );

      expect(result.valid).toBe(true);
    });

    it('should handle model not found in config (best effort)', () => {
      const result = validateThinkingCompatibility(
        'test-agent',
        'anthropic/unknown-model',
        { enabled: true, budget_tokens: 8000 },
        undefined,
        undefined,
        'anthropic/claude-haiku-4-5',
        providersConfig
      );

      // Best effort: can't determine, so allow
      expect(result.valid).toBe(true);
    });

    it('should handle missing providers config gracefully', () => {
      const result = validateThinkingCompatibility(
        'test-agent',
        'anthropic/claude-haiku-4-5',
        { enabled: true, budget_tokens: 8000 },
        undefined,
        undefined,
        'anthropic/claude-haiku-4-5',
        undefined
      );

      // No config means we can't validate, so allow (best effort)
      expect(result.valid).toBe(true);
    });

    it('should accept thinking as boolean true', () => {
      const result = validateThinkingCompatibility(
        'test-agent',
        'anthropic/claude-haiku-4-5',
        true,
        undefined,
        undefined,
        'anthropic/claude-haiku-4-5',
        providersConfig
      );

      expect(result.valid).toBe(true);
    });

    it('should accept thinking as boolean false', () => {
      const result = validateThinkingCompatibility(
        'test-agent',
        'anthropic/claude-haiku-4-5',
        false,
        0.7,
        0.9,
        'anthropic/claude-haiku-4-5',
        providersConfig
      );

      expect(result.valid).toBe(true);
    });

    it('should provide helpful error message with solutions', () => {
      const result = validateThinkingCompatibility(
        'my-agent',
        'anthropic/claude-haiku-4-5',
        { enabled: true },
        0.5,
        undefined,
        'anthropic/claude-haiku-4-5',
        providersConfig
      );

      expect(result.valid).toBe(false);
      expect(result.message).toContain("Agent 'my-agent'");
      expect(result.message).toContain('Solutions:');
      expect(result.message).toContain('1. Remove "temperature"');
      expect(result.message).toContain('2. Remove thinking configuration');
    });
  });
});
