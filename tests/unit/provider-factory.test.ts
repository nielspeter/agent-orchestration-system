import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ProviderFactory } from '@/llm/provider-factory';

describe('Provider Factory - Essential Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('gets behavior preset correctly', () => {
    const preset = ProviderFactory.getBehaviorPreset('creative');
    expect(preset).toBeDefined();
    expect(preset?.temperature).toBe(0.7);
    expect(preset?.top_p).toBe(0.95);
  });

  test('returns undefined for non-existent preset', () => {
    const preset = ProviderFactory.getBehaviorPreset('non-existent');
    expect(preset).toBeUndefined();
  });

  test('gets default behavior', () => {
    const defaultBehavior = ProviderFactory.getDefaultBehavior();
    expect(defaultBehavior).toBeDefined();
    expect(defaultBehavior.temperature).toBe(0.5);
    expect(defaultBehavior.top_p).toBe(0.85);
  });

  test('gets default model', () => {
    const defaultModel = ProviderFactory.getDefaultModel();
    expect(defaultModel).toBeDefined();
    expect(typeof defaultModel).toBe('string');
  });

  test('creates provider with custom behavior settings', () => {
    // Set a test API key
    const originalKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-key';

    const behaviorSettings = { temperature: 0.3, top_p: 0.7 };
    const result = ProviderFactory.createWithConfig(
      'claude-3-5-haiku-latest',
      undefined,
      behaviorSettings
    );

    expect(result).toBeDefined();
    expect(result.provider).toBeDefined();

    // Restore original key
    if (originalKey) {
      process.env.ANTHROPIC_API_KEY = originalKey;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  test('throws error when required API key is missing', () => {
    // Clear both API keys
    const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
    const originalOpenRouterKey = process.env.OPENROUTER_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENROUTER_API_KEY;

    expect(() => {
      ProviderFactory.createWithConfig('claude-3-5-haiku-latest');
    }).toThrow(/missing API key/);

    // Restore if they existed
    if (originalAnthropicKey) process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
    if (originalOpenRouterKey) process.env.OPENROUTER_API_KEY = originalOpenRouterKey;
  });

  test('all behavior presets are properly configured', () => {
    const presetNames = ['deterministic', 'precise', 'balanced', 'creative', 'exploratory'];

    for (const name of presetNames) {
      const preset = ProviderFactory.getBehaviorPreset(name);
      expect(preset).toBeDefined();
      expect(preset).toHaveProperty('temperature');
      expect(preset).toHaveProperty('top_p');
    }
  });
});
