import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { afterEach, vi } from 'vitest';

// Load test environment variables for integration tests
// Priority: .env.test.local > .env.test > .env
const localTestEnvPath = path.resolve(process.cwd(), '.env.test.local');
const testEnvPath = path.resolve(process.cwd(), '.env.test');
const envPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(localTestEnvPath)) {
  // Use local test env if available (for real API key)
  dotenv.config({ path: localTestEnvPath });
} else if (fs.existsSync(testEnvPath)) {
  // Fall back to test env
  dotenv.config({ path: testEnvPath });
} else if (fs.existsSync(envPath)) {
  // Fall back to regular env
  dotenv.config({ path: envPath });
}

// Set test environment
process.env.NODE_ENV = 'test';

// Global cleanup hook to prevent resource leaks
afterEach(() => {
  // Clear all mocks to reset call counts and spy states
  vi.clearAllMocks();
  // Reset all mocks to their initial implementation
  vi.resetAllMocks();
  // Note: We don't use restoreAllMocks() as it removes vi.mock() setups
});

// Check if we have a real API key for integration tests
if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.startsWith('mock')) {
  console.warn('\n⚠️  Warning: No real ANTHROPIC_API_KEY found for integration tests');
  console.warn('Integration tests will be skipped unless you provide a real API key');
  console.warn('To run integration tests:');
  console.warn('1. Copy .env.test to .env.test.local');
  console.warn('2. Add your real ANTHROPIC_API_KEY to .env.test.local\n');
}
