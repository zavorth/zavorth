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
    },
  },
});
