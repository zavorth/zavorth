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
      // Jest-era component suites targeting @jest/globals and jsdom fixtures;
      // reactivating them requires a dedicated migration (tracked separately).
      'tests/KeyboardShortcutsPanel.test.tsx',
      'tests/PluginMarketplacePanel.test.tsx',
      'tests/WorkboardPanel.test.tsx',
    ],
    environmentMatchGlobs: [['tests/**/*.test.tsx', 'jsdom']],
  },
  resolve: {
    alias: {
      '@': resolve(root, 'src'),
    },
  },
});
