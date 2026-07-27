#!/usr/bin/env node
import { asErrorLike } from '../src/utils/errorLike';

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { config } from '../src/config/index.js';

type RegressionTest = {
  id: string;
  description: string;
  criticalPath: string;
  success: boolean;
  durationMs: number;
  error: string | null;
};

function authHeaders(): Headers {
  const headers = new Headers();
  const token = String(config.zavorthWebAuthToken || '').trim();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

async function fetchJson(pathname: string): Promise<unknown> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${config.zavorthWebPort}${pathname}`, {
        headers: authHeaders(),
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} em ${pathname}: ${text.slice(0, 160)}`);
      }
      return text ? JSON.parse(text) : null;
    } catch (error: unknown) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function fetchText(pathname: string): Promise<string> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${config.zavorthWebPort}${pathname}`, {
        headers: authHeaders(),
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} em ${pathname}: ${text.slice(0, 160)}`);
      }
      return text;
    } catch (error: unknown) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function quoteShellArg(value: string): string {
  if (!/[ \t"&|<>^]/.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '\\"')}"`;
}

function runCommand(args: string[], timeoutMs: number): void {
  const command = ['npx', 'tsx', ...args];
  const result = process.platform === 'win32'
    ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command.map(quoteShellArg).join(' ')], {
      cwd: config.projectRoot,
      encoding: 'utf8',
      timeout: timeoutMs,
      windowsHide: true,
      shell: false,
    })
    : spawnSync('npx', ['tsx', ...args], {
    cwd: config.projectRoot,
    encoding: 'utf8',
    timeout: timeoutMs,
    windowsHide: true,
    });
  if (result.error) {
    throw result.error;
  }
  if (typeof result.status === 'number' && result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `exit ${result.status}`).slice(0, 500));
  }
  if (result.status === null) {
    throw new Error(`timeout after de ${timeoutMs}ms`);
  }
}

async function runTest(id: string, description: string, criticalPath: string, fn: () => Promise<void> | void): Promise<RegressionTest> {
  const started = Date.now();
  try {
    await fn();
    return {
      id,
      description,
      criticalPath,
      success: true,
      durationMs: Date.now() - started,
      error: null,
    };
  } catch (error: unknown) {
    const err = asErrorLike(error);

    return {
      id,
      description,
      criticalPath,
      success: false,
      durationMs: Date.now() - started,
      error: error?.message || String(error),
    };
  }
}

async function main() {
  const tests = [
    await runTest('gateway-public-api', 'Public API exposes GUI readiness.', 'public-api', async () => {
      const payload: any = await fetchJson('/api/v1/ops/quality?sessionId=qa-regression');
      if (payload?.ok === false) {
        throw new Error('readiness returned ok=false');
      }
    }),
    await runTest('quality-metrics-api', 'Web quality metrics endpoint responds.', 'web-api', async () => {
      const payload: any = await fetchJson('/api/web/ops/quality?sessionId=qa-regression');
      if (payload?.ok === false) {
        throw new Error('quality returned ok=false');
      }
    }),
    await runTest('cli-status-json', 'CLI status/readiness command runs.', 'cli', () => {
      runCommand(['scripts/access-readiness.ts', '--json'], 8_000);
    }),
    await runTest('cli-ops-quality-json', 'CLI ops access command resolves runtime access.', 'cli', () => {
      runCommand(['scripts/access-readiness.ts', '--json'], 8_000);
    }),
    await runTest('node-mesh-doctor', 'Node Mesh smoke report exists and passed.', 'node-mesh', () => {
      const reportPath = path.join(config.projectRoot, 'data', 'runtime', 'node-mesh-smoke-last.json');
      if (!fs.existsSync(reportPath)) {
        throw new Error('node-mesh-smoke.json missing; run npm run test:nodes:smoke');
      }
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      if (report.ok !== true && report.status !== 'passed') {
        throw new Error(`node mesh smoke did not pass: ${report.status || 'unknown'}`);
      }
    }),
    await runTest('remote-transport-doctor', 'Remote transport doctor runs.', 'transports', () => {
      runCommand(['scripts/remote-transport-doctor.ts', '--json'], 20_000);
    }),
    await runTest('web-app-shell', 'Dashboard shell responds.', 'web', async () => {
      const html = await fetchText('/dashboard');
      if (!html.includes('Ask Zavorth')) {
        throw new Error('dashboard shell does not contain Ask Zavorth marker');
      }
    }),
  ];
  const failures = tests.filter((test) => !test.success).length;
  const payload = {
    generatedAt: new Date().toISOString(),
    status: failures > 0 ? 'failed' : 'passed',
    failures,
    tests,
  };
  const reportDir = path.join(config.projectRoot, 'data', 'runtime', 'qa');
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, 'critical-regression.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`[qa-regression] ${payload.status} (${tests.length - failures}/${tests.length})`);
  if (failures > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[qa-regression] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
