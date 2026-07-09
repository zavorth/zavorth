/**
 * Sprint 3 — Vite HMR + Electron for daily desktop development.
 *
 * Starts Vite on a free localhost port, then launches Electron with
 * ZAVORTH_DESKTOP_RENDERER_URL pointing at the dev server.
 */
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createNetServer } from 'node:net';

const require = createRequire(import.meta.url);
const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const electronBinary = require('electron');

function getFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = createNetServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = address && typeof address === 'object' ? address.port : 0;
      server.close((error) => {
        if (error) reject(error);
        else resolvePort(port);
      });
    });
    server.on('error', reject);
  });
}

async function main() {
  const port = await getFreePort();
  const rendererUrl = `http://127.0.0.1:${port}/`;

  const vite = await createServer({
    root: appDir,
    configFile: resolve(appDir, 'vite.config.mjs'),
    server: {
      host: '127.0.0.1',
      port,
      strictPort: true,
    },
  });

  await vite.listen();
  console.log(`[zavorth-desktop:dev] Vite ready at ${rendererUrl}`);

  const electronEnv = {
    ...process.env,
    ZAVORTH_DESKTOP_RENDERER_URL: rendererUrl,
    ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
  };

  const child = spawn(String(electronBinary), [resolve(appDir, 'electron', 'main.cjs')], {
    cwd: appDir,
    env: electronEnv,
    stdio: 'inherit',
  });

  const shutdown = async (code = 0) => {
    try {
      child.kill();
    } catch {
      // already exited
    }
    try {
      await vite.close();
    } catch {
      // ignore
    }
    process.exit(code);
  };

  child.on('exit', (code) => {
    void shutdown(code || 0);
  });

  process.on('SIGINT', () => void shutdown(0));
  process.on('SIGTERM', () => void shutdown(0));
}

main().catch((error) => {
  console.error('[zavorth-desktop:dev] failed:', error);
  process.exit(1);
});
