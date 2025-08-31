#!/usr/bin/env npx tsx
/**
 * Test Authentication System
 * 
 * Demonstrates:
 * 1. API key authentication from environment
 * 2. Bearer token authentication (future)
 * 3. Secure logging with automatic redaction
 */

import { AuthProvider } from '../src/auth/auth-provider';
import { SecureLogger } from '../src/auth/secure-logger';
import { AnthropicProvider } from '../src/llm/anthropic-provider';

async function testAuthProvider() {
  console.log('🔐 Testing Authentication System\n');
  console.log('=' .repeat(50));

  // Test 1: API Key Authentication
  console.log('\n1️⃣ Testing API Key Authentication:');
  const auth1 = new AuthProvider();
  
  if (auth1.isAuthenticated()) {
    console.log('✅ API key loaded from environment');
    console.log('   Auth info:', auth1.getRedactedAuthInfo());
  } else {
    console.log('❌ No API key found in environment');
  }

  // Test 2: Manual API Key Setting
  console.log('\n2️⃣ Testing Manual API Key:');
  const auth2 = new AuthProvider();
  auth2.setApiKey('sk-ant-api03-fake-key-for-testing-1234567890');
  console.log('   Auth info:', auth2.getRedactedAuthInfo());

  // Test 3: Bearer Token (Future OAuth Support)
  console.log('\n3️⃣ Testing Bearer Token:');
  const auth3 = new AuthProvider();
  auth3.setBearerToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake.token');
  console.log('   Auth info:', auth3.getRedactedAuthInfo());
  console.log('   Headers:', JSON.stringify(auth3.getAuthHeaders(), null, 2));

  console.log('\n' + '='.repeat(50));
}

async function testSecureLogging() {
  console.log('\n🔒 Testing Secure Logging\n');
  console.log('='.repeat(50));

  // Test various sensitive data patterns
  const testCases = [
    {
      name: 'API Key in text',
      input: 'My API key is sk-ant-api03-abcdef1234567890abcdef1234567890abcdef1234567890',
    },
    {
      name: 'Bearer token',
      input: 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token.signature',
    },
    {
      name: 'Environment variable',
      input: 'Set ANTHROPIC_API_KEY=sk-ant-api03-secret123 in your environment',
    },
    {
      name: 'JSON with auth',
      input: JSON.stringify({
        headers: {
          'x-api-key': 'sk-ant-api03-verysecretkey',
          'authorization': 'Bearer secret.jwt.token',
        },
        data: 'normal data',
      }, null, 2),
    },
    {
      name: 'Object with sensitive keys',
      object: {
        apiKey: 'sk-ant-api03-mysecretkey',
        token: 'secret-token-123',
        password: 'my-password',
        normalData: 'this is fine',
        nested: {
          secret: 'nested-secret',
          public: 'public-info',
        },
      },
    },
  ];

  for (const testCase of testCases) {
    console.log(`\n📝 ${testCase.name}:`);
    
    if (testCase.input) {
      console.log('Original:', testCase.input.substring(0, 100) + (testCase.input.length > 100 ? '...' : ''));
      console.log('Redacted:', SecureLogger.redact(testCase.input).substring(0, 100));
    }
    
    if (testCase.object) {
      console.log('Original object:', JSON.stringify(testCase.object, null, 2).substring(0, 200));
      SecureLogger.info('Redacted object:', testCase.object);
    }
  }

  console.log('\n' + '='.repeat(50));
}

async function testAnthropicProviderAuth() {
  console.log('\n🤖 Testing AnthropicProvider with Auth\n');
  console.log('='.repeat(50));

  try {
    // Test with default auth (from environment)
    console.log('\nCreating provider with environment auth...');
    const provider = new AnthropicProvider('claude-3-5-haiku-20241022');
    console.log('✅ Provider created successfully');

    // Test a simple completion (only if API key is valid)
    if (process.env.ANTHROPIC_API_KEY?.startsWith('sk-ant-')) {
      console.log('\nTesting API call with redacted logging...');
      const response = await provider.complete([
        { role: 'user', content: 'Say "Hello, secure world!" in exactly 5 words.' }
      ]);
      console.log('Response:', response.content);
    }
  } catch (error) {
    SecureLogger.error('Failed to create provider:', error);
  }

  console.log('\n' + '='.repeat(50));
}

async function main() {
  console.log('🚀 Claude Code Authentication System Test\n');

  await testAuthProvider();
  await testSecureLogging();
  await testAnthropicProviderAuth();

  console.log('\n✨ All tests completed!\n');
}

// Run the test
main().catch((error) => {
  SecureLogger.error('Test failed:', error);
  process.exit(1);
});