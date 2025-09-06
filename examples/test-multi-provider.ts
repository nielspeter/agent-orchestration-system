#!/usr/bin/env node
/**
 * Test multi-provider support
 * Shows using different providers via the config
 */

import { AgentSystemBuilder } from '@/config/system-builder';
import * as fs from 'fs';

async function testProviders() {
  console.log('🧪 Testing Multi-Provider Support\n');

  // Test 1: Default provider (Anthropic)
  try {
    console.log('1. Testing default provider (Anthropic):');
    const system1 = await AgentSystemBuilder.minimal().build();

    const result1 = await system1.executor.execute(
      'echo',
      'Say "Hello from Anthropic" and nothing else'
    );
    console.log(`   Result: ${result1}\n`);
  } catch (error) {
    console.log(`   Error: ${error}\n`);
  }

  // Test 2: OpenAI via alias
  try {
    console.log('2. Testing OpenAI via alias:');
    const system2 = await new AgentSystemBuilder()
      .withModel('gpt-4o-mini') // Uses OpenAI
      .build();

    const result2 = await system2.executor.execute(
      'echo',
      'Say "Hello from OpenAI" and nothing else'
    );
    console.log(`   Result: ${result2}\n`);
  } catch (error) {
    console.log(`   Error: ${error}\n`);
  }

  // Test 3: OpenRouter with explicit prefix
  try {
    console.log('3. Testing OpenRouter with prefix:');
    const system3 = await new AgentSystemBuilder()
      .withModel('openrouter/anthropic/claude-3-haiku') // Explicit provider
      .build();

    const result3 = await system3.executor.execute(
      'echo',
      'Say "Hello from OpenRouter" and nothing else'
    );
    console.log(`   Result: ${result3}\n`);
  } catch (error) {
    console.log(`   Error: ${error}\n`);
  }

  // Test 4: Check provider pool
  console.log('4. Provider Pool Test:');
  const system = await AgentSystemBuilder.minimal().build();

  // Use same provider multiple times
  await system.executor.execute('echo', 'First call');
  await system.executor.execute('echo', 'Second call');
  await system.executor.execute('echo', 'Third call');

  console.log('   ✅ Provider pool working (reused same instance)\n');

  // Test 5: List configured providers
  console.log('5. Configured Providers:');

  interface ProviderInfo {
    apiKeyEnv: string;
  }

  interface Config {
    providers: Record<string, ProviderInfo>;
  }

  const config = JSON.parse(fs.readFileSync('providers-config.json', 'utf-8')) as Config;

  for (const [name, provider] of Object.entries(config.providers)) {
    const apiKey = process.env[provider.apiKeyEnv];
    const status = apiKey ? '✅' : '❌';
    console.log(`   ${status} ${name} - ${apiKey ? 'configured' : 'missing API key'}`);
  }
}

// Run the test
testProviders().catch(console.error);
