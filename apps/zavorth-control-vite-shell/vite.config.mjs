import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const appDir = dirname(fileURLToPath(import.meta.url));
const repoDir = resolve(appDir, "../..");

export default defineConfig({
  root: appDir,
  base: "./",
  publicDir: resolve(appDir, "public"),
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
    fs: {
      allow: [repoDir],
    },
    proxy: {
      "/api": "http://127.0.0.1:3001",
    },
  },
  build: {
    outDir: resolve(repoDir, "src/zavorth-control/public/zavorth-control-vite-shell"),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: resolve(appDir, "index.html"),
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, "/");
          if (normalized.includes("/node_modules/pdfjs-dist/")) return "vendor-pdf";
          if (normalized.includes("/node_modules/jszip/")) return "vendor-archive";
          if (normalized.includes("/src/runtime-") || normalized.endsWith("/src/runtime-bridge.ts")) {
            return "runtime-control";
          }
          if (
            normalized.endsWith("/src/pages.ts")
            || normalized.endsWith("/src/model-preference-actions.ts")
            || normalized.endsWith("/src/learning-dreams-ui.ts")
            || normalized.endsWith("/src/memory-browser-ui.ts")
            || normalized.endsWith("/src/policy-simulator-ui.ts")
          ) {
            return "settings-control";
          }
          return undefined;
        },
      },
    },
  },
});
