import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const appDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: appDir,
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      nanostores: resolve(appDir, 'src/store/nanostoresLight.ts'),
      '@nanostores/react': resolve(appDir, 'src/store/nanostoresLight.ts'),
      katex: resolve(appDir, 'src/lib/katexLight.ts'),
      '@xterm/xterm/css/xterm.css': resolve(appDir, 'src/styles/design-system.css'),
      '@xterm/xterm': resolve(appDir, 'src/lib/xtermLight.ts'),
      '@xterm/addon-fit': resolve(appDir, 'src/lib/xtermLight.ts'),
      '@xterm/addon-unicode11': resolve(appDir, 'src/lib/xtermLight.ts'),
      'isomorphic-dompurify': resolve(appDir, 'src/lib/dompurifyLight.ts'),
      dompurify: resolve(appDir, 'src/lib/dompurifyLight.ts'),
    },
  },
  build: {
    outDir: resolve(appDir, 'dist'),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: resolve(appDir, 'index.html'),
      output: {
        manualChunks(id) {
          const moduleId = id.replace(/\\/gu, '/');
          if (moduleId.includes('node_modules/react') || moduleId.includes('node_modules/scheduler')) return 'vendor-react';
          if (moduleId.includes('node_modules/@xterm')) return 'vendor-terminal';
          if (moduleId.includes('node_modules/katex')) return 'vendor-math';
          if (moduleId.includes('node_modules/highlight.js')) return 'vendor-highlight';
          if (moduleId.includes('node_modules/marked')) return 'vendor-markdown';
          if (moduleId.includes('node_modules')) return 'vendor-ui';
          return undefined;
        },
      },
    },
  },
});
