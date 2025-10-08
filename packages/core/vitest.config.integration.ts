import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      name: 'integration',
      environment: 'node',
      include: ['tests/integration/**/*.test.ts'],
      setupFiles: ['./tests/setup-integration.ts'],
      globals: true,
      testTimeout: 60000, // 60 seconds for integration tests (API calls)
      maxConcurrency: 1, // Run tests sequentially
      fileParallelism: false, // Disable parallel file execution
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov', 'html'],
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.d.ts', 'src/**/*.test.ts', 'src/**/index.ts'],
      },
    },
  })
);
