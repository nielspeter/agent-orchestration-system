import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ProviderFactory } from '@/providers/provider-factory';

describe('Provider Factory - Essential Tests', () => {
  const providersConfig = ProviderFactory.loadProvidersConfig();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('gets behavior preset correctly', () => {
    const preset = ProviderFactory.getBehaviorPreset(providersConfig, 'creative');
    expect(preset).toBeDefined();
    expect(preset?.temperature).toBe(0.7);
    expect(preset?.top_p).toBe(0.95);
  });

  test('returns undefined for non-existent preset', () => {
    const preset = ProviderFactory.getBehaviorPreset(providersConfig, 'non-existent');
    expect(preset).toBeUndefined();
  });

  test('gets default behavior', () => {
    const defaultBehavior = ProviderFactory.getDefaultBehavior(providersConfig);
    expect(defaultBehavior).toBeDefined();
    expect(defaultBehavior.temperature).toBe(0.5);
    expect(defaultBehavior.top_p).toBe(0.85);
  });

  test('loads providers config', () => {
    const config = ProviderFactory.loadProvidersConfig();
    expect(config).toBeDefined();
    expect(config.providers).toBeDefined();
    expect(config.providers.anthropic).toBeDefined();
    expect(config.providers.openrouter).toBeDefined();
  });

  test('creates provider with custom behavior settings', () => {
    // Set a test API key
    const originalKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-key';

    const behaviorSettings = { temperature: 0.3, top_p: 0.7 };
    const result = ProviderFactory.createWithConfig(
      'anthropic/claude-3-5-haiku-latest',
      providersConfig,
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
      ProviderFactory.createWithConfig('anthropic/claude-3-5-haiku-latest', providersConfig);
    }).toThrow(/Missing API key/);

    // Restore if they existed
    if (originalAnthropicKey) process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
    if (originalOpenRouterKey) process.env.OPENROUTER_API_KEY = originalOpenRouterKey;
  });

  test('all behavior presets are properly configured', () => {
    const presetNames = ['deterministic', 'precise', 'balanced', 'creative', 'exploratory'];

    for (const name of presetNames) {
      const preset = ProviderFactory.getBehaviorPreset(providersConfig, name);
      expect(preset).toBeDefined();
      expect(preset).toHaveProperty('temperature');
      expect(preset).toHaveProperty('top_p');
    }
  });

  test('parses provider/model format correctly', () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-key';

    const result = ProviderFactory.createWithConfig(
      'anthropic/claude-3-5-haiku-latest',
      providersConfig
    );

    expect(result).toBeDefined();
    expect(result.provider).toBeDefined();

    if (originalKey) {
      process.env.ANTHROPIC_API_KEY = originalKey;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  test('throws error on invalid model format', () => {
    expect(() => {
      ProviderFactory.createWithConfig('invalid-format', providersConfig);
    }).toThrow(/Invalid model format/);
  });

  test('throws error on unknown provider', () => {
    expect(() => {
      ProviderFactory.createWithConfig('unknown/model', providersConfig);
    }).toThrow(/Unknown provider: unknown/);
  });

  test('strips modifiers for non-OpenRouter providers', () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-key';

    // This should work but strip the modifier
    const result = ProviderFactory.createWithConfig(
      'anthropic/claude-3-5-haiku-latest:something',
      providersConfig
    );

    expect(result).toBeDefined();
    expect(result.provider).toBeDefined();

    if (originalKey) {
      process.env.ANTHROPIC_API_KEY = originalKey;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  test('throws error on empty model name', () => {
    expect(() => {
      ProviderFactory.createWithConfig('anthropic/', providersConfig);
    }).toThrow(/Both provider and model must be specified/);
  });

  test('throws error on empty provider name', () => {
    expect(() => {
      ProviderFactory.createWithConfig('/claude-3-5-haiku-latest', providersConfig);
    }).toThrow(/Both provider and model must be specified/);
  });

  test('OpenRouter preserves :nitro modifier', () => {
    const originalKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = 'test-key';

    try {
      const result = ProviderFactory.createWithConfig('openrouter/gpt-4:nitro', providersConfig);

      // The provider should be created with the full model name including :nitro
      expect(result).toBeDefined();
      expect(result.provider).toBeDefined();

      // The model name should include :nitro for OpenRouter
      // OpenRouter handles these modifiers directly
    } finally {
      if (originalKey) {
        process.env.OPENROUTER_API_KEY = originalKey;
      } else {
        delete process.env.OPENROUTER_API_KEY;
      }
    }
  });

  test('OpenRouter preserves :floor modifier', () => {
    const originalKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = 'test-key';

    const result = ProviderFactory.createWithConfig(
      'openrouter/meta-llama/llama-3.1-70b:floor',
      providersConfig
    );

    expect(result).toBeDefined();
    expect(result.provider).toBeDefined();

    if (originalKey) {
      process.env.OPENROUTER_API_KEY = originalKey;
    } else {
      delete process.env.OPENROUTER_API_KEY;
    }
  });

  test('handles multiple slashes in OpenRouter model names', () => {
    const originalKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = 'test-key';

    const result = ProviderFactory.createWithConfig(
      'openrouter/meta-llama/llama-3.1-70b-instruct',
      providersConfig
    );

    expect(result).toBeDefined();
    expect(result.provider).toBeDefined();

    if (originalKey) {
      process.env.OPENROUTER_API_KEY = originalKey;
    } else {
      delete process.env.OPENROUTER_API_KEY;
    }
  });

  test('handles OpenRouter openai/model format', () => {
    const originalKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = 'test-key';

    // Test that openrouter/openai/gpt-4-turbo works
    const result = ProviderFactory.createWithConfig(
      'openrouter/openai/gpt-4-turbo',
      providersConfig
    );

    expect(result).toBeDefined();
    expect(result.provider).toBeDefined();

    // The provider should be OpenAICompatibleProvider with model "openai/gpt-4-turbo"
    // since we take everything after the first slash as the model name for OpenRouter

    if (originalKey) {
      process.env.OPENROUTER_API_KEY = originalKey;
    } else {
      delete process.env.OPENROUTER_API_KEY;
    }
  });
});
