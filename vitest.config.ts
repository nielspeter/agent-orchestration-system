import { defineConfig } from 'vitest/config';
import path from 'path';

// Default config for WebStorm - will load integration setup by default
// For unit tests, use: npm run test:unit
// For integration tests from CLI: npm run test:integration
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Load integration setup by default (includes env loading)
    setupFiles: ['./tests/setup-integration.ts'],
    testTimeout: 60000, // 60 seconds for API calls
    include: ['tests/**/*.test.ts'], // Include all tests
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
