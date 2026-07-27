#!/usr/bin/env node

import fs from 'fs';
import { spawn, spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const runtimeStateFile = path.join(rootDir, 'data', 'runtime', 'zavorthControl-runtime.json');

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function readRuntimeStateBaseUrl() {
  try {
    if (!fs.existsSync(runtimeStateFile)) {
      return '';
    }
    const payload = JSON.parse(String(fs.readFileSync(runtimeStateFile, 'utf8') || '{}'));
    return normalizeBaseUrl(payload?.url || '');
  } catch {
    return '';
  }
}

function listBaseUrls() {
  return Array.from(new Set([
    readRuntimeStateBaseUrl(),
    'http://127.0.0.1:33333',
  ].filter(Boolean)));
}

async function resolveControlUrl() {
  const baseUrls = listBaseUrls();
  for (const baseUrl of baseUrls) {
    if (await probeApp(`${baseUrl.replace(/\/+$/, '')}/zavorthControl`)) {
      return `${baseUrl.replace(/\/+$/, '')}/zavorthControl`;
    }
  }

  const fallbackBaseUrl = baseUrls[0] || 'http://127.0.0.1:33333';
  return `${fallbackBaseUrl.replace(/\/+$/, '')}/zavorthControl`;
}

function runCommand(args, label) {
  console.log(`[surface-qa] ${label}`);
  const result = spawnSync(npmCommand, args, {
    cwd: rootDir,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (typeof result.status === 'number' && result.status !== 0) {
    process.exitCode = result.status;
    throw new Error(`${label} failed with code ${result.status}.`);
  }
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function probeApp(appUrl) {
  try {
    const response = await fetch(appUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(2500),
      headers: {
        Connection: 'close',
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForApp(appUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probeApp(appUrl)) {
      return true;
    }
    await wait(1000);
  }
  return false;
}

async function ensureHostReady() {
  let appUrl = await resolveControlUrl();
  if (await waitForApp(appUrl, 3000)) {
    console.log('[surface-qa] host already estava available em /zavorthControl');
    return;
  }

  console.log('[surface-qa] iniciando host supervised para a bateria surface-qa');
  const result = spawnSync(npmCommand, ['run', 'ops:up', '--', '--allow-readonly'], {
    cwd: rootDir,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (typeof result.status === 'number' && result.status !== 0) {
    throw new Error(`ops:up failed with code ${result.status}.`);
  }

  appUrl = await resolveControlUrl();
  const ready = await waitForApp(appUrl, 60000);
  if (!ready) {
    throw new Error(`The supervised host did not respond at ${appUrl} within the expected window.`);
  }

  console.log('[surface-qa] host supervised ready');
}

async function main() {
  runCommand(['run', 'ops:bootstrap', '--', '--repair'], 'bootstrap seguro');
  await ensureHostReady();
  runCommand(['run', 'test:cross-surface'], 'E2E cross-surface');
  runCommand(['run', 'test:web:qa'], 'QA da ZavorthControl e legado');
  runCommand(['run', 'test:web:smoke'], 'smoke da ZavorthControl e legado');
}

main().catch((error) => {
  console.error('[surface-qa] failure ao run a bateria surface-qa.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(process.exitCode || 1);
});
