#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(projectRoot, '.env') });

const args = process.argv.slice(2);
const runtimeDir = path.join(projectRoot, 'data', 'runtime');
const durationMinutes = readNumberArg('--duration-minutes', 15);
const intervalSeconds = readNumberArg('--interval-seconds', 60);
const bootMode = readStringArg('--boot', 'auto');
const skipSmoke = args.includes('--skip-smoke');
const host = process.env.ZAVORTH_WEB_HOST || '127.0.0.1';
const port = Number.parseInt(process.env.ZAVORTH_WEB_PORT || process.env.PORT || '33333', 10);
const healthUrl = `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}/healthz`;
const sidecarsUrl = `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}/api/sidecars`;

function readNumberArg(flag, fallback) {
  const arg = args.find((entry) => entry.startsWith(`${flag}=`));
  if (!arg) {
    return fallback;
  }
  const value = Number.parseFloat(arg.split('=').slice(1).join('='));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readStringArg(flag, fallback) {
  const arg = args.find((entry) => entry.startsWith(`${flag}=`));
  return arg ? arg.split('=').slice(1).join('=') : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  const response = await fetch(url);
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {}
  return {
    ok: response.ok,
    status: response.status,
    body: parsed,
    text,
  };
}

function runSmoke() {
  return new Promise((resolve, reject) => {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(npmCommand, ['run', 'test:smoke'], {
      cwd: projectRoot,
      env: process.env,
      stdio: 'inherit',
      shell: false,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`npm run test:smoke saiu with code ${code}`));
    });
  });
}

async function waitForHealth(timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetchJson(healthUrl);
      if (response.ok && response.body?.ok) {
        return response.body;
      }
    } catch {}
    await sleep(1500);
  }

  throw new Error(`Zavorth did not respond at ${healthUrl} dentro de ${timeoutMs}ms.`);
}

async function waitForHealthOrChildExit(child, timeoutMs) {
  const startedAt = Date.now();
  let childExited = false;

  if (child) {
    child.once('exit', () => {
      childExited = true;
    });
  }

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetchJson(healthUrl);
      if (response.ok && response.body?.ok) {
        return { mode: 'http', health: response.body };
      }
    } catch {}

    if (childExited) {
      return { mode: 'smoke-only', health: null };
    }

    await sleep(1500);
  }

  return { mode: 'smoke-only', health: null };
}

function spawnStack(mode, logFilePath) {
  const scriptName = mode === 'all' ? 'start-all.mjs' : 'start-full.mjs';
  const scriptPath = path.join(projectRoot, 'scripts', scriptName);
  const stream = fs.createWriteStream(logFilePath, { flags: 'a' });
  const child = spawn(process.execPath, [scriptPath], {
    cwd: projectRoot,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  child.stdout?.on('data', (chunk) => {
    process.stdout.write(chunk);
    stream.write(chunk);
  });
  child.stderr?.on('data', (chunk) => {
    process.stderr.write(chunk);
    stream.write(chunk);
  });
  child.on('exit', () => stream.end());

  return child;
}

async function stopChild(child) {
  if (!child || child.killed) {
    return;
  }

  await new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) {
        return;
      }
      done = true;
      resolve();
    };

    const timeout = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {}
      finish();
    }, 5000);

    child.once('exit', () => {
      clearTimeout(timeout);
      finish();
    });

    try {
      child.kill('SIGTERM');
    } catch {
      clearTimeout(timeout);
      finish();
    }
  });
}

async function main() {
  fs.mkdirSync(runtimeDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
  const logPath = path.join(runtimeDir, `soak-test-${stamp}.json`);
  const stackLogPath = path.join(runtimeDir, `soak-stack-${stamp}.log`);
  let child = null;
  let startedByScript = false;

  console.log('===========================================');
  console.log('  Zavorth Soak Test');
  console.log('===========================================');
  console.log(`Health URL: ${healthUrl}`);
  console.log(`Sidecars:   ${sidecarsUrl}`);
  console.log(`Duraction:    ${durationMinutes} minuto(s)`);
  console.log(`Intervalo:  ${intervalSeconds} segundo(s)`);

  try {
    const existingHealth = await fetchJson(healthUrl).catch(() => null);
    const shouldBoot =
      bootMode === 'full' ||
      bootMode === 'all' ||
      (bootMode === 'auto' && !(existingHealth?.ok && existingHealth.body?.ok));

    if (shouldBoot) {
      const effectiveMode = bootMode === 'all' ? 'all' : 'full';
      console.log(`[soak] stack was not ready; starting through ${effectiveMode}.`);
      child = spawnStack(effectiveMode, stackLogPath);
      startedByScript = true;
    } else {
      console.log('[soak] using stack already running.');
    }

    let probeMode = 'http';
    const healthCheck = await waitForHealthOrChildExit(child, bootMode === 'all' ? 240000 : 180000);
    probeMode = healthCheck.mode;

    if (probeMode === 'smoke-only') {
      console.log('[soak] healthz unavailable in this session; switching to smoke-test monitoring.');
    }

    if (!skipSmoke || probeMode === 'smoke-only') {
      console.log('[soak] smoke test inicial');
      await runSmoke();
    }

    const startedAt = Date.now();
    const until = startedAt + durationMinutes * 60_000;
    const samples = [];

    while (Date.now() <= until) {
      const timestamp = new Date().toISOString();
      let sample;

      if (probeMode === 'http') {
        const health = await fetchJson(healthUrl).catch((error) => ({
          ok: false,
          status: 0,
          body: null,
          text: String(error),
        }));
        const sidecars = await fetchJson(sidecarsUrl).catch((error) => ({
          ok: false,
          status: 0,
          body: null,
          text: String(error),
        }));

        sample = {
          timestamp,
          probeMode,
          healthOk: Boolean(health.ok && health.body?.ok),
          healthStatus: health.status,
          sidecarsOk: Boolean(sidecars.ok && sidecars.body?.sidecars),
          sidecarsStatus: sidecars.status,
          sidecars: sidecars.body?.sidecars || null,
        };
      } else {
        try {
          await runSmoke();
          sample = {
            timestamp,
            probeMode,
            healthOk: true,
            healthStatus: 200,
            sidecarsOk: true,
            sidecarsStatus: 200,
            sidecars: null,
          };
        } catch (error) {
          sample = {
            timestamp,
            probeMode,
            healthOk: false,
            healthStatus: 500,
            sidecarsOk: false,
            sidecarsStatus: 500,
            sidecars: null,
            error: String(error?.message || error),
          };
        }
      }
      samples.push(sample);
      console.log(
        `[soak] ${timestamp} mode=${sample.probeMode} health=${sample.healthOk ? 'ok' : 'failed'} sidecars=${sample.sidecarsOk ? 'ok' : 'failed'}`,
      );

      if (Date.now() + intervalSeconds * 1000 > until) {
        break;
      }
      await sleep(intervalSeconds * 1000);
    }

    if (!skipSmoke || probeMode === 'smoke-only') {
      console.log('[soak] smoke test final');
      await runSmoke();
    }

    const summary = {
      startedAt: new Date(startedAt).toISOString(),
      finishedAt: new Date().toISOString(),
      durationMinutes,
      intervalSeconds,
      startedByScript,
      bootMode,
      probeMode,
      healthUrl,
      sidecarsUrl,
      stackLogPath: startedByScript ? stackLogPath : null,
      samples,
      failures: samples.filter((sample) => !sample.healthOk || !sample.sidecarsOk).length,
    };
    fs.writeFileSync(logPath, JSON.stringify(summary, null, 2), 'utf8');

    console.log(`[soak] summary saved at ${logPath}`);
    if (summary.failures > 0) {
      process.exitCode = 1;
    }
  } finally {
    if (startedByScript && child) {
      console.log('[soak] encerrando stack started por este teste');
      await stopChild(child);
    }
  }
}

main().catch((error) => {
  console.error(`[soak] failed: ${error.message}`);
  process.exit(1);
});
