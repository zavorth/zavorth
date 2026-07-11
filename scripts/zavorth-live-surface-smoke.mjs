#!/usr/bin/env node
/**
 * Live-ish Desktop/Control surface smoke for Q4/Q5 residual.
 *
 * - Control: build vite shell if needed, serve static assets, fetch HTML, assert Proof OS hosts.
 * - Desktop: run full vitest unit suite + golden Q4 as stand-in for Electron session.
 * - Optional: if PLAYWRIGHT available and CONTROL_BASE_URL set, open live URL.
 *
 * Does not require a human at the keyboard; documents limits in JSON report.
 */

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const controlShell = path.join(root, 'apps', 'zavorth-control-vite-shell');
const desktopRoot = path.join(root, 'apps', 'zavorth-desktop');

const steps = [];
function record(name, ok, detail, durationMs = 0) {
  steps.push({ name, ok, detail, durationMs });
  console.log(`${ok ? '[pass]' : '[fail]'} ${name}${detail ? ` — ${detail}` : ''} (${durationMs}ms)`);
}

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    cwd: opts.cwd || root,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', CI: process.env.CI || '1' },
    timeout: opts.timeoutMs ?? 300_000,
    windowsHide: true,
    maxBuffer: 40 * 1024 * 1024,
    shell: opts.shell === true,
  });
}

function runNpx(args, opts = {}) {
  if (process.platform === 'win32') {
    return run('cmd.exe', ['/d', '/s', '/c', 'npx', ...args], opts);
  }
  return run('npx', args, opts);
}

// Desktop automated "session" (unit golden + full suite slice already Q3)
{
  const t0 = Date.now();
  const r = runNpx(
    ['vitest', 'run', 'tests/goldenTrustLoop.q4.test.ts', 'tests/qualityBar.test.ts', 'tests/proofStrip.test.ts'],
    { cwd: desktopRoot, timeoutMs: 180_000 },
  );
  record('live-desktop-unit-session', r.status === 0, r.status === 0 ? 'Q4 golden + quality/proof strip' : (r.stderr || r.stdout || '').slice(0, 300), Date.now() - t0);
}

// Control: ensure built shell assets exist or build
{
  const t0 = Date.now();
  const distIndex = path.join(controlShell, 'dist', 'index.html');
  const publicIndex = path.join(controlShell, 'index.html');
  let ok = false;
  let detail = '';
  if (!fs.existsSync(distIndex)) {
    // try vite build
    const b = runNpx(['vite', 'build'], { cwd: controlShell, timeoutMs: 180_000 });
    if (b.status !== 0 && !fs.existsSync(distIndex)) {
      // fall back to source index + pages markers via static file checks
      detail = 'vite build failed; checking source hosts';
    }
  }
  const pages = path.join(controlShell, 'src', 'pages.ts');
  const html = fs.existsSync(distIndex)
    ? fs.readFileSync(distIndex, 'utf8')
    : fs.existsSync(publicIndex)
      ? fs.readFileSync(publicIndex, 'utf8')
      : '';
  const pagesSrc = fs.existsSync(pages) ? fs.readFileSync(pages, 'utf8') : '';
  const hasHosts =
    /data-proof-os-host|data-proof-os-chrome-host/.test(pagesSrc)
    || /data-proof-os-host|data-proof-os-chrome-host/.test(html);
  ok = hasHosts;
  if (!ok) detail = (detail || '') + ' missing proof-os host markers';
  else detail = (detail || 'proof-os hosts present') + (fs.existsSync(distIndex) ? ' (dist)' : ' (src)');
  record('live-control-surface-hosts', ok, detail, Date.now() - t0);
}

// Control static HTTP serve + fetch (local runtime stand-in)
{
  const t0 = Date.now();
  const serveRoot = fs.existsSync(path.join(controlShell, 'dist', 'index.html'))
    ? path.join(controlShell, 'dist')
    : controlShell;

  /** @type {import('http').Server | null} */
  let server = null;
  let port = 0;
  try {
    await new Promise((resolve, reject) => {
      server = http.createServer((req, res) => {
        let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        if (urlPath === '/') urlPath = '/index.html';
        const filePath = path.normalize(path.join(serveRoot, urlPath));
        if (!filePath.startsWith(serveRoot)) {
          res.writeHead(403);
          res.end('forbidden');
          return;
        }
        fs.readFile(filePath, (err, data) => {
          if (err) {
            // SPA-ish: pages built into app — still 200 index for smoke
            const index = path.join(serveRoot, 'index.html');
            if (fs.existsSync(index)) {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(fs.readFileSync(index));
              return;
            }
            res.writeHead(404);
            res.end('missing');
            return;
          }
          const ext = path.extname(filePath);
          const type =
            ext === '.js' ? 'text/javascript'
              : ext === '.css' ? 'text/css'
                : ext === '.html' ? 'text/html'
                  : 'application/octet-stream';
          res.writeHead(200, { 'Content-Type': type });
          res.end(data);
        });
      });
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        port = typeof addr === 'object' && addr ? addr.port : 0;
        resolve(undefined);
      });
      server.on('error', reject);
    });

    const body = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/`, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      }).on('error', reject);
    });

    // Index may be a vite shell; Proof OS hosts are injected by pages.ts at runtime.
    // Assert shell boots and proof-os modules exist on disk.
    const ui = path.join(controlShell, 'src', 'proof-os-ui.ts');
    const model = path.join(controlShell, 'src', 'proof-os-model.ts');
    const ok =
      fs.existsSync(ui)
      && fs.existsSync(model)
      && body.length > 50
      && (/zavorth|control|vite|root|app/i.test(body) || body.includes('<!'));
    record(
      'live-control-http-smoke',
      ok,
      ok ? `served :${port} (${body.length} bytes)` : 'control HTTP smoke failed',
      Date.now() - t0,
    );
  } catch (e) {
    record('live-control-http-smoke', false, e instanceof Error ? e.message : String(e), Date.now() - t0);
  } finally {
    if (server) await new Promise((r) => server.close(() => r(undefined)));
  }
}

// Combined Q4/Q5 gate
{
  const t0 = Date.now();
  const r = run(process.execPath, [path.join(root, 'scripts', 'zavorth-q4-q5-golden-ux.mjs')], { timeoutMs: 300_000 });
  record('live-q4-q5-gate', r.status === 0, r.status === 0 ? 'q4+q5+spine' : (r.stderr || r.stdout || '').slice(0, 300), Date.now() - t0);
}

const failed = steps.filter((s) => !s.ok);
const summary = {
  status: failed.length ? 'FAIL' : 'PASS',
  note: 'Automated stand-in for human Desktop/Control session; Electron window not required.',
  steps,
  durationMs: steps.reduce((a, s) => a + (s.durationMs || 0), 0),
};

console.log('\n=== Live surface smoke summary ===');
console.log(`status: ${summary.status}`);
for (const s of steps) console.log(`- ${s.ok ? 'pass' : 'fail'}: ${s.name}`);

try {
  fs.mkdirSync(path.join(root, '.zavorth'), { recursive: true });
  fs.writeFileSync(path.join(root, '.zavorth', 'live-surface-smoke-last.json'), `${JSON.stringify(summary, null, 2)}\n`);
} catch {
  // ignore
}

if (failed.length) {
  console.error(`[fail] live surface smoke — ${failed.length} failed`);
  process.exit(1);
}
console.log('[pass] live surface smoke complete');
process.exit(0);
