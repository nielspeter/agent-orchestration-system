import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      name: 'unit',
      environment: 'node',
      include: ['tests/unit/**/*.test.ts'],
      setupFiles: ['./tests/setup-unit.ts'],
      globals: true,
      testTimeout: 10000, // 10 seconds for unit tests
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov', 'html'],
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.d.ts', 'src/**/*.test.ts', 'src/**/index.ts'],
      },
    },
  })
);
