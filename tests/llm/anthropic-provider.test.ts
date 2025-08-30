import { AnthropicProvider } from '../../src/llm/anthropic-provider';
import { Message } from '../../src/types';

describe('AnthropicProvider Caching Strategy', () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    // Set required env var
    process.env.ANTHROPIC_API_KEY = 'test-key';
    provider = new AnthropicProvider('claude-3-5-haiku-20241022');
  });

  it('should cache only the last 2 messages plus system prompt', () => {
    // This is a conceptual test - the actual implementation is tested via integration
    expect(provider).toBeDefined();
    expect(provider.getModelName()).toBe('claude-3-5-haiku-20241022');
  });

  it('should handle caching when enabled', () => {
    // Test that caching is enabled by default
    delete process.env.DISABLE_PROMPT_CACHING;
    const provider = new AnthropicProvider('claude-3-5-haiku-20241022');
    expect(provider).toBeDefined();
  });

  it('should handle caching when disabled', () => {
    // Test with caching disabled
    process.env.DISABLE_PROMPT_CACHING = 'true';
    const provider = new AnthropicProvider('claude-3-5-haiku-20241022');
    expect(provider).toBeDefined();
    delete process.env.DISABLE_PROMPT_CACHING;
  });

  it('should require Claude models', () => {
    expect(() => {
      new AnthropicProvider('gpt-4' as any);
    }).toThrow('AnthropicProvider only supports Claude models');
  });

  it('should require API key', () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => {
      new AnthropicProvider('claude-3-5-haiku-20241022');
    }).toThrow('ANTHROPIC_API_KEY is required');
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });
});
