import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const appDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: appDir,
  base: './',
  plugins: [react()],
  build: {
    outDir: resolve(appDir, 'dist'),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: resolve(appDir, 'index.html'),
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'vendor-react';
          if (id.includes('node_modules/@xterm')) return 'vendor-terminal';
          if (id.includes('node_modules/katex')) return 'vendor-math';
          if (id.includes('node_modules/highlight.js')) return 'vendor-highlight';
          if (id.includes('node_modules/marked')) return 'vendor-markdown';
          if (id.includes('node_modules')) return 'vendor-ui';
          return undefined;
        },
      },
    },
  },
});
