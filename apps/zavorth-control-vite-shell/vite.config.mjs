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
    },
  },
});
