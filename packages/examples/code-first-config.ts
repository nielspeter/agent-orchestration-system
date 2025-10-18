/**
 * Code-First Configuration Example
 *
 * Demonstrates programmatic configuration without config files:
 * - withProvidersConfig() - Inject provider configuration
 * - withAPIKeys() - Inject API keys (e.g., from secret manager)
 * - No file dependencies - ideal for testing, CI/CD, production
 *
 * Run: npx tsx packages/examples/code-first-config.ts
 */

import { AgentSystemBuilder, type ProvidersConfig } from '@agent-system/core';

/**
 * Simulated secret manager
 * In production, this would be AWS Secrets Manager, Vault, etc.
 */
class MockSecretManager {
  private readonly secrets: Record<string, string>;

  constructor() {
    // Simulate secrets from a secret manager
    this.secrets = {
      'prod/anthropic-api-key': process.env.ANTHROPIC_API_KEY || 'mock-anthropic-key',
      'prod/openrouter-api-key': process.env.OPENROUTER_API_KEY || 'mock-openrouter-key',
    };
  }

  async getSecret(secretId: string): Promise<string> {
    console.log(`📦 Fetching secret: ${secretId}`);
    const secret = this.secrets[secretId];
    if (!secret) {
      throw new Error(`Secret not found: ${secretId}`);
    }
    return secret;
  }
}

/**
 * Example 1: Basic Code-First Configuration
 */
async function example1_BasicCodeFirst() {
  console.log('\n=== Example 1: Basic Code-First Configuration ===\n');

  // Define providers config programmatically
  const providersConfig: ProvidersConfig = {
    providers: {
      anthropic: {
        type: 'native',
        apiKeyEnv: 'ANTHROPIC_API_KEY',
        models: [
          {
            id: 'claude-haiku-4-5',
            contextLength: 200000,
            maxOutputTokens: 8192,
          },
        ],
      },
    },
    behaviorPresets: {
      balanced: { temperature: 0.5, top_p: 0.85 },
      precise: { temperature: 0.2, top_p: 0.6 },
    },
  };

  // Provide API keys programmatically
  const apiKeys = {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || 'test-key',
  };

  console.log('Building system with code-first configuration...');
  const { cleanup, config } = await AgentSystemBuilder.minimal()
    .withModel('anthropic/claude-haiku-4-5')
    .withProvidersConfig(providersConfig)
    .withAPIKeys(apiKeys)
    .build();

  console.log('✅ System built successfully');
  console.log(`   Model: ${config.model}`);
  console.log(`   Providers: ${Object.keys(config.providersConfig?.providers || {}).join(', ')}`);
  console.log(`   API Keys: ${Object.keys(config.apiKeys || {}).join(', ')}`);

  await cleanup();
}

/**
 * Example 2: Secret Manager Integration
 */
async function example2_SecretManager() {
  console.log('\n=== Example 2: Secret Manager Integration ===\n');

  const secretManager = new MockSecretManager();

  // Load API keys from secret manager
  console.log('Loading API keys from secret manager...');
  const apiKeys = {
    ANTHROPIC_API_KEY: await secretManager.getSecret('prod/anthropic-api-key'),
    OPENROUTER_API_KEY: await secretManager.getSecret('prod/openrouter-api-key'),
  };

  // Define providers config
  const providersConfig: ProvidersConfig = {
    providers: {
      anthropic: {
        type: 'native',
        apiKeyEnv: 'ANTHROPIC_API_KEY',
      },
      openrouter: {
        type: 'openai-compatible',
        baseURL: 'https://openrouter.ai/api/v1',
        apiKeyEnv: 'OPENROUTER_API_KEY',
      },
    },
    behaviorPresets: {
      balanced: { temperature: 0.5, top_p: 0.85 },
    },
  };

  console.log('\nBuilding system with secret manager keys...');
  const { cleanup, config } = await AgentSystemBuilder.minimal()
    .withModel('anthropic/claude-haiku-4-5')
    .withProvidersConfig(providersConfig)
    .withAPIKeys(apiKeys)
    .build();

  console.log('✅ System built with secret manager integration');
  console.log(`   Providers: ${Object.keys(config.providersConfig?.providers || {}).join(', ')}`);
  console.log(`   Keys loaded: ${Object.keys(apiKeys).length}`);

  await cleanup();
}

/**
 * Example 3: Testing Configuration (No Real API Keys)
 */
async function example3_TestingConfig() {
  console.log('\n=== Example 3: Testing Configuration ===\n');

  // For testing, inject mock keys without touching environment
  const testApiKeys = {
    ANTHROPIC_API_KEY: 'test-key-12345',
  };

  const testConfig: ProvidersConfig = {
    providers: {
      anthropic: {
        type: 'native',
        apiKeyEnv: 'ANTHROPIC_API_KEY',
      },
    },
  };

  console.log('Building system with test configuration...');
  const { cleanup, config } = await AgentSystemBuilder.minimal()
    .withProvidersConfig(testConfig)
    .withAPIKeys(testApiKeys)
    .build();

  console.log('✅ Test system built (no file dependencies)');
  console.log(`   Using test key: ${config.apiKeys?.ANTHROPIC_API_KEY?.substring(0, 10)}...`);

  await cleanup();
}

/**
 * Example 4: Dynamic Configuration at Runtime
 */
async function example4_DynamicConfig() {
  console.log('\n=== Example 4: Dynamic Configuration at Runtime ===\n');

  // Build configuration based on runtime conditions
  const environment = process.env.NODE_ENV || 'development';
  const useOpenRouter = process.env.USE_OPENROUTER === 'true';

  console.log(`Environment: ${environment}`);
  console.log(`Use OpenRouter: ${useOpenRouter}`);

  // Dynamically construct provider config
  const providersConfig: ProvidersConfig = {
    providers: {},
  };

  if (useOpenRouter) {
    providersConfig.providers.openrouter = {
      type: 'openai-compatible',
      baseURL: 'https://openrouter.ai/api/v1',
      apiKeyEnv: 'OPENROUTER_API_KEY',
    };
  } else {
    providersConfig.providers.anthropic = {
      type: 'native',
      apiKeyEnv: 'ANTHROPIC_API_KEY',
    };
  }

  // Behavior presets based on environment
  providersConfig.behaviorPresets =
    environment === 'production'
      ? {
          precise: { temperature: 0.2, top_p: 0.6 },
        }
      : {
          balanced: { temperature: 0.5, top_p: 0.85 },
        };

  const apiKeys = {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || 'test-key',
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || 'test-key',
  };

  console.log('\nBuilding system with dynamic configuration...');
  const { cleanup, config } = await AgentSystemBuilder.minimal()
    .withProvidersConfig(providersConfig)
    .withAPIKeys(apiKeys)
    .build();

  console.log('✅ Dynamic configuration applied');
  console.log(`   Providers: ${Object.keys(config.providersConfig?.providers || {}).join(', ')}`);
  console.log(
    `   Behavior presets: ${Object.keys(config.providersConfig?.behaviorPresets || {}).join(', ')}`
  );

  await cleanup();
}

/**
 * Example 5: API Key Precedence
 */
async function example5_KeyPrecedence() {
  console.log('\n=== Example 5: API Key Precedence ===\n');

  // Environment variable (fallback)
  process.env.ANTHROPIC_API_KEY = 'env-key-12345';

  // Programmatic key (takes precedence)
  const apiKeys = {
    ANTHROPIC_API_KEY: 'programmatic-key-67890',
  };

  const providersConfig: ProvidersConfig = {
    providers: {
      anthropic: {
        type: 'native',
        apiKeyEnv: 'ANTHROPIC_API_KEY',
      },
    },
  };

  console.log('Environment variable: env-key-12345');
  console.log('Programmatic key:     programmatic-key-67890');

  const { cleanup, config } = await AgentSystemBuilder.minimal()
    .withProvidersConfig(providersConfig)
    .withAPIKeys(apiKeys)
    .build();

  const usedKey = config.apiKeys?.ANTHROPIC_API_KEY;
  console.log('\n✅ Programmatic key takes precedence');
  console.log(`   Used key: ${usedKey?.substring(0, 20)}...`);
  console.log(
    `   Match: ${usedKey === 'programmatic-key-67890' ? 'programmatic ✓' : 'environment ✗'}`
  );

  await cleanup();
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Code-First Configuration Examples\n');
  console.log('Demonstrates programmatic configuration without config files');

  try {
    await example1_BasicCodeFirst();
    await example2_SecretManager();
    await example3_TestingConfig();
    await example4_DynamicConfig();
    await example5_KeyPrecedence();

    console.log('\n✅ All examples completed successfully!\n');
    console.log('Key Takeaways:');
    console.log('  1. No file dependencies - ideal for testing and CI/CD');
    console.log('  2. Secret manager integration for production');
    console.log('  3. Programmatic keys take precedence over environment');
    console.log('  4. Dynamic configuration based on runtime conditions');
    console.log('  5. Type-safe with full TypeScript support\n');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

// Run the examples
main();
