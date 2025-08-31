import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load test environment variables for unit tests
const testEnvPath = path.resolve(process.cwd(), '.env.test');
if (fs.existsSync(testEnvPath)) {
  dotenv.config({ path: testEnvPath });
}

// Set test environment
process.env.NODE_ENV = 'test';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'mock-api-key-for-unit-tests';

// Mock will be handled directly in tests that need it
