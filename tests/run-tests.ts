import { AnthropicProvider } from '../src/llm/anthropic-provider';

console.log('🧪 Running AnthropicProvider Tests\n');

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log('✅', name);
    passed++;
  } catch (error) {
    console.log('❌', name);
    console.log('   ', error);
    failed++;
  }
}

// Set required env var
process.env.ANTHROPIC_API_KEY = 'test-key';

test('should create provider with Claude model', () => {
  const provider = new AnthropicProvider('claude-3-5-haiku-20241022');
  if (!provider) throw new Error('Provider not created');
  if (provider.getModelName() !== 'claude-3-5-haiku-20241022') {
    throw new Error('Wrong model name');
  }
});

test('should handle caching when enabled', () => {
  delete process.env.DISABLE_PROMPT_CACHING;
  const provider = new AnthropicProvider('claude-3-5-haiku-20241022');
  if (!provider) throw new Error('Provider not created');
});

test('should handle caching when disabled', () => {
  process.env.DISABLE_PROMPT_CACHING = 'true';
  const provider = new AnthropicProvider('claude-3-5-haiku-20241022');
  if (!provider) throw new Error('Provider not created');
  delete process.env.DISABLE_PROMPT_CACHING;
});

test('should require Claude models', () => {
  try {
    new AnthropicProvider('gpt-4' as any);
    throw new Error('Should have thrown error');
  } catch (error: any) {
    if (!error.message.includes('AnthropicProvider only supports Claude models')) {
      throw error;
    }
  }
});

test('should require API key', () => {
  const savedKey = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    new AnthropicProvider('claude-3-5-haiku-20241022');
    throw new Error('Should have thrown error');
  } catch (error: any) {
    if (!error.message.includes('ANTHROPIC_API_KEY is required')) {
      throw error;
    }
  } finally {
    process.env.ANTHROPIC_API_KEY = savedKey;
  }
});

console.log('\n📊 Results:');
console.log(`   Passed: ${passed}`);
console.log(`   Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}
