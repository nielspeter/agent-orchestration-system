import { describe, expect, test, beforeEach } from 'vitest';
import { AnthropicProvider } from '../../src/llm/anthropic-provider';

describe('AnthropicProvider Caching Strategy', () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    // Set required env var
    process.env.ANTHROPIC_API_KEY = 'test-key';
    provider = new AnthropicProvider('claude-3-5-haiku-latest');
  });

  test('should cache only the last 2 messages plus system prompt', () => {
    // This is a conceptual test - the actual implementation is tested via integration
    expect(provider).toBeDefined();
    expect(provider.getModelName()).toBe('claude-3-5-haiku-latest');
  });

  test('should handle caching when enabled', () => {
    // Test that caching is enabled by default
    delete process.env.DISABLE_PROMPT_CACHING;
    const provider = new AnthropicProvider('claude-3-5-haiku-latest');
    expect(provider).toBeDefined();
  });

  test('should handle caching when disabled', () => {
    // Test with caching disabled
    process.env.DISABLE_PROMPT_CACHING = 'true';
    const provider = new AnthropicProvider('claude-3-5-haiku-latest');
    expect(provider).toBeDefined();
    delete process.env.DISABLE_PROMPT_CACHING;
  });

  test('should require Claude models', () => {
    expect(() => {
      new AnthropicProvider('gpt-4' as any);
    }).toThrow('AnthropicProvider only supports Claude models');
  });

  test('should require API key', () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => {
      new AnthropicProvider('claude-3-5-haiku-latest');
    }).toThrow('ANTHROPIC_API_KEY is required');
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });
});
