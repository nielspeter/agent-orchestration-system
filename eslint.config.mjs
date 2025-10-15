import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default [
  // Global ignores - must be first
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**'],
  },
  {
    files: ['**/*.ts'],

    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        tsconfigRootDir: __dirname,
        project: [
          './packages/core/tsconfig.json',
          './packages/cli/tsconfig.lint.json',
          './packages/examples/tsconfig.json',
        ],
      },
    },

    plugins: {
      '@typescript-eslint': tseslint,
      prettier: prettierPlugin,
    },

    rules: {
      ...tseslint.configs.recommended.rules,
      ...prettierConfig.rules,

      // TypeScript specific rules
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // General rules
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      semi: ['error', 'always'],
      quotes: ['error', 'single', { avoidEscape: true }],

      // Prettier integration
      'prettier/prettier': [
        'error',
        {
          endOfLine: 'auto',
        },
      ],
    },
  },
  {
    // Test files and config files - disable type-aware linting
    // (they're not included in the main tsconfig.json project files)
    files: [
      '**/*.test.ts',
      '**/*.spec.ts',
      'tests/**/*.ts',
      '**/tests/**/*.ts',
      '**/vitest.config.*.ts',
      '**/vite.config.ts',
      'packages/web/server/**/*.ts',
    ],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        // Don't use project for test files - they're not in tsconfig.json
        project: null,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
  {
    // Examples need console.log for demonstration purposes
    files: ['packages/examples/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Logger implementations legitimately use console methods
    files: [
      'packages/core/src/logging/console.logger.ts',
      'packages/core/src/tracing/simple-tracer.ts',
      'packages/core/src/session/manager.ts', // Logs sanitization issues for debugging
    ],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // CLI package legitimately uses console for output
    files: ['packages/cli/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
];
