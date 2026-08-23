import { defineConfig } from 'vitest/config';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
    ],
    environmentMatchGlobs: [['tests/**/*.test.tsx', 'jsdom']],
  },
  resolve: {
    alias: {
      '@': resolve(root, 'src'),
    },
  },
});
