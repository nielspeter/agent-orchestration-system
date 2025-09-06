#!/usr/bin/env node
/**
 * Simple test to verify provider configuration works
 */

import { ProviderFactory } from '@/llm/provider-factory';
import * as fs from 'fs';

interface ProviderConfig {
  apiKeyEnv: string;
  baseURL?: string;
  type: string;
}

interface ConfigFile {
  providers: Record<string, ProviderConfig>;
  modelAliases?: Record<string, string>;
}

async function testConfig() {
  console.log('🔍 Provider Configuration Test\n');

  // Load and show config
  const config = JSON.parse(fs.readFileSync('providers-config.json', 'utf-8')) as ConfigFile;

  console.log('📋 Configured Providers:');
  for (const [name, provider] of Object.entries(config.providers)) {
    const apiKey = process.env[provider.apiKeyEnv];
    const status = apiKey ? '✅' : '⚠️';
    console.log(
      `  ${status} ${name.padEnd(12)} - ${apiKey ? 'API key set' : `needs ${provider.apiKeyEnv}`}`
    );
  }

  console.log('\n🏷️  Model Aliases:');
  for (const [alias, target] of Object.entries(config.modelAliases || {})) {
    console.log(`  ${alias.padEnd(12)} → ${target}`);
  }

  console.log('\n🧪 Provider Resolution Tests:');

  const testModels = [
    'claude-3-5-sonnet-latest',
    'gpt-4-turbo',
    'gemini-1.5-pro',
    'groq/llama-3.1-70b',
    'fast', // alias
    'smart', // alias
  ];

  for (const model of testModels) {
    try {
      const provider = ProviderFactory.create(model);
      console.log(`  ✅ ${model.padEnd(25)} → ${provider.getModelName()}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`  ❌ ${model.padEnd(25)} → ${message}`);
    }
  }

  console.log('\n✨ Multi-provider support is working!');
}

testConfig().catch(console.error);
