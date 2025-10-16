import * as dotenv from 'dotenv';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { afterEach, vi } from 'vitest';

// Load test environment variables for unit tests
const testEnvPath = path.resolve(process.cwd(), '.env.test');
if (fs.existsSync(testEnvPath)) {
  dotenv.config({ path: testEnvPath });
}

// Set test environment
process.env.NODE_ENV = 'test';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'mock-api-key-for-unit-tests';

// Global cleanup hook to prevent resource leaks
afterEach(() => {
  // Clear all mocks to reset call counts and spy states
  vi.clearAllMocks();
  // Reset all mocks to their initial implementation
  vi.resetAllMocks();
  // Note: We don't use restoreAllMocks() as it removes vi.mock() setups
});

// Mock will be handled directly in tests that need it
