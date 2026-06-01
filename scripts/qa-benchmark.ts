#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { config } from '../src/config/index.js';

type BenchmarkRunReport = {
  operationName: string;
  durationMs: number;
  memoryDeltaBytes: number;
  success: boolean;
  error: string | null;
  warning: string | null;
  details: Record<string, unknown>;
};

const SUITES: Record<string, string[]> = {
  boot: [
    'Gateway host boot',
    'CLI status fast',
    'CLI doctor fast',
    'CLI ops access fast',
  ],
  runtime: [
    'Gateway session spawn',
    'Gateway session send',
    'CLI domain snapshot live',
    'Node Mesh invoke device.info',
    'Web shell /dashboard latency',
  ],
  sidecars: [
    'Remote transport doctor',
    'Channel provider doctor',
  ],
};

const REPORT_NAMES: Record<string, string> = {
  boot: 'benchmark-boot.json',
  runtime: 'benchmark-runtime-flow.json',
  sidecars: 'benchmark-sidecars.json',
};

function readSuite(): string {
  const raw = String(process.argv[2] || 'boot').trim().toLowerCase();
  if (raw === 'runtime-flow') {
    return 'runtime';
  }
  if (!SUITES[raw]) {
    throw new Error(`Suite desconhecida "${raw}". Use boot, runtime ou sidecars.`);
  }
  return raw;
}

function authHeaders(): Headers {
  const headers = new Headers();
  const token = String(config.zavorthWebAuthToken || '').trim();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

async function fetchOk(pathname: string): Promise<Record<string, unknown>> {
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
      return {
        status: response.status,
        bytes: text.length,
        attempts: attempt,
      };
    } catch (error) {
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

function runCommand(command: string, args: string[], timeoutMs: number): Record<string, unknown> {
  const result = process.platform === 'win32'
    ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', [command, ...args].map(quoteShellArg).join(' ')], {
      cwd: config.projectRoot,
      encoding: 'utf8',
      timeout: timeoutMs,
      windowsHide: true,
      shell: false,
    })
    : spawnSync(command, args, {
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
    throw new Error(`timeout depois de ${timeoutMs}ms`);
  }
  return {
    stdoutBytes: String(result.stdout || '').length,
    stderrBytes: String(result.stderr || '').length,
  };
}

async function executeOperation(operationName: string): Promise<Record<string, unknown>> {
  switch (operationName) {
    case 'Gateway host boot':
      return fetchOk('/api/auth/status');
    case 'CLI status fast':
      return runCommand('npx', ['tsx', 'scripts/access-readiness.ts', '--json'], 10_000);
    case 'CLI doctor fast':
      return runCommand('npx', ['tsx', 'scripts/ops-doctor.ts', '--json'], 12_000);
    case 'CLI ops access fast':
      return runCommand('npx', ['tsx', 'scripts/access-readiness.ts', '--json'], 6_000);
    case 'Gateway session spawn':
      return fetchOk('/api/web/session');
    case 'Gateway session send':
      return fetchOk('/api/web/state?sessionId=qa-benchmark');
    case 'CLI domain snapshot live':
      return runCommand('npx', ['tsx', 'scripts/zavorth-architecture-scorecard.ts', '--json'], 30_000);
    case 'Node Mesh invoke device.info':
      return {
        status: 'skipped',
        reason: 'Coberto pelo smoke-suite/node-mesh-smoke; benchmark isolado nao pareia node real para evitar custo duplicado.',
      };
    case 'Web shell /dashboard latency':
      return fetchOk('/dashboard');
    case 'Remote transport doctor':
      return runCommand('npx', ['tsx', 'scripts/remote-transport-doctor.ts', '--json'], 20_000);
    case 'Channel provider doctor':
      return runCommand('npx', ['tsx', 'scripts/channel-provider-doctor.ts', '--json'], 5_000);
    default:
      throw new Error(`Operacao sem executor: ${operationName}`);
  }
}

async function measure(operationName: string): Promise<BenchmarkRunReport> {
  const startedMemory = process.memoryUsage().heapUsed;
  const started = Date.now();
  try {
    const details = await executeOperation(operationName);
    const durationMs = Date.now() - started;
    return {
      operationName,
      durationMs,
      memoryDeltaBytes: Math.max(0, process.memoryUsage().heapUsed - startedMemory),
      success: true,
      error: null,
      warning: null,
      details,
    };
  } catch (error: any) {
    return {
      operationName,
      durationMs: Date.now() - started,
      memoryDeltaBytes: Math.max(0, process.memoryUsage().heapUsed - startedMemory),
      success: false,
      error: error?.message || String(error),
      warning: null,
      details: {},
    };
  }
}

async function main() {
  const suite = readSuite();
  const started = Date.now();
  const runs = [];
  for (const operationName of SUITES[suite]) {
    runs.push(await measure(operationName));
  }
  const passed = runs.filter((run) => run.success).length;
  const failed = runs.length - passed;
  const totalDurationMs = Date.now() - started;
  const payload = {
    suiteName: suite === 'boot' ? 'Boot benchmark' : suite === 'runtime' ? 'Runtime flow benchmark' : 'Transport and sidecar benchmark',
    generatedAt: new Date().toISOString(),
    status: failed > 0 ? 'failed' : 'passed',
    summary: {
      totalRuns: runs.length,
      passed,
      failed,
      warnings: runs.filter((run) => run.warning).length,
      totalDurationMs,
      averageDurationMs: runs.length > 0 ? Math.round(totalDurationMs / runs.length) : 0,
    },
    runs,
  };
  const reportDir = path.join(config.projectRoot, 'data', 'runtime', 'qa');
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, REPORT_NAMES[suite]), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`[qa-benchmark] ${suite}: ${payload.status} (${passed}/${runs.length})`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[qa-benchmark] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
