import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Load unit test setup (mocks API)
    setupFiles: ['./tests/setup-unit.ts'],
    testTimeout: 10000,
    include: ['tests/unit/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
