#!/usr/bin/env node
import { asErrorLike } from '../src/utils/errorLike';

import { execFileSync, spawn } from 'child_process';
import * as fs from 'fs';
import path from 'path';
import { config } from '../src/config/index.js';
import { NodeRegistryService } from '../src/services/NodeRegistryService.js';

type ManagedProcess = {
  name: string;
  command: string;
  args: string[];
  cwd: string;
  shell?: boolean;
  manageProcess: boolean;
  skipReason?: string | null;
  restart: boolean;
  background: boolean;
  child: ReturnType<typeof spawn> | null;
  cooldownMs: number;
};

type ProcessHealth = {
  name: string;
  ready: boolean;
  lastCheckAt: string | null;
  lastStartAt: string | null;
  lastReadyAt: string | null;
  lastError: string | null;
  restarts: number;
};

type KeepaliveSnapshot = {
  ok: boolean;
  updatedAt: string;
  intervalMs: number;
  nodeHostId: string;
  processes: Record<string, ProcessHealth>;
  notes: string[];
};

const KEEPALIVE_INTERVAL_MS = 20_000;
const RESTART_DELAY_MS = 5_000;
const STALE_LOCK_MS = KEEPALIVE_INTERVAL_MS * 2;
const ONCE_RECHECK_INTERVAL_MS = 5_000;
const ONCE_RECHECK_ATTEMPTS = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, timeoutMs = 6000): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, { method: 'GET', signal: controller.signal });
    clearTimeout(timer);
    return response;
  } catch {
    return null;
  }
}

async function isUpstreamReady(): Promise<boolean> {
  const response = await fetchWithTimeout(`${config.AIGatewayUpstreamBaseUrl.replace(/\/+$/, '')}/models`, 5000);
  return Boolean(response && response.status > 0 && response.status < 500);
}

async function probeGatewayProxy(): Promise<{ listening: boolean; upstreamReady: boolean; message: string | null }> {
  const response = await fetchWithTimeout(`${config.zavorthAIGatewayGatewayBaseUrl.replace(/\/+$/, '')}/health`, 5000);
  if (!response) {
    return {
      listening: false,
      upstreamReady: false,
      message: 'local gateway proxy has not responded yet.',
    };
  }

  const upstreamReady = response.ok;
  return {
    listening: true,
    upstreamReady,
    message: upstreamReady
      ? null
      : `Local gateway proxy active; upstream returned health ${response.status}.`,
  };
}

function ensureRuntimeDir(): string {
  const runtimeDir = path.resolve(config.projectRoot, 'data', 'runtime');
  if (!fs.existsSync(runtimeDir)) {
    fs.mkdirSync(runtimeDir, { recursive: true });
  }
  return runtimeDir;
}

function readLock(lockPath: string): { pid: number; updatedAt: string } | null {
  try {
    const payload = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    if (typeof payload?.pid !== 'number' || typeof payload?.updatedAt !== 'string') {
      return null;
    }
    return { pid: payload.pid, updatedAt: payload.updatedAt };
  } catch {
    return null;
  }
}

function writeLock(lockPath: string, pid: number, updatedAt: string): void {
  fs.writeFileSync(lockPath, JSON.stringify({ pid, updatedAt }, null, 2));
}

function clearLock(lockPath: string): void {
  if (!fs.existsSync(lockPath)) {
    return;
  }
  try {
    fs.rmSync(lockPath, { force: true, maxRetries: 5, retryDelay: 100 });
  } catch {
    try {
      writeLock(lockPath, process.pid, new Date(0).toISOString());
    } catch {
      // ignore cleanup failures during keepalive shutdown on Windows
    }
  }
}

function killPid(pid: number | null | undefined): void {
  if (!Number.isFinite(pid) || Number(pid) <= 0) {
    return;
  }
  if (process.platform === 'win32') {
    execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  process.kill(Number(pid), 'SIGTERM');
}

function resolveNodeHostId(): string | null {
  const explicit = String(process.env.ZAVORTH_NODE_HOST_ID || '').trim();
  if (explicit) {
    return explicit;
  }
  const registry = new NodeRegistryService();
  const nodes = registry.listNodes();
  const preferred = nodes.find((node) =>
    node.paired
    && node.kind === 'headless'
    && node.label.toLowerCase().includes('node-host'),
  );
  if (preferred) {
    return preferred.id;
  }
  const fallback = nodes.find((node) => node.paired && node.kind === 'headless');
  return fallback?.id || null;
}

function resolveNodeHostSecret(nodeId: string): string | null {
  const registry = new NodeRegistryService();
  return registry.getSecretValue(nodeId, 'sharedSecret');
}

function isLoopbackUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(String(rawUrl || '').trim());
    return ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function resolveAIGatewayUpstreamWorktree(): string | null {
  const configured = path.resolve(config.AIGatewaySidecarWorktreeDir);
  if (fs.existsSync(path.join(configured, 'package.json'))) {
    return configured;
  }

  const legacy = path.resolve(config.projectRoot, 'src', 'zavorth-control');
  if (fs.existsSync(path.join(legacy, 'package.json'))) {
    return legacy;
  }

  return null;
}

function spawnManaged(processSpec: ManagedProcess, health: ProcessHealth): void {
  if (!processSpec.manageProcess || processSpec.child) {
    return;
  }
  const child = spawn(processSpec.command, processSpec.args, {
    cwd: processSpec.cwd,
    stdio: processSpec.background ? 'ignore' : 'inherit',
    detached: processSpec.background,
    shell: processSpec.shell === true,
  });
  processSpec.child = child;
  health.lastStartAt = new Date().toISOString();
  health.restarts += 1;
  health.ready = false;
  if (processSpec.background && typeof child.unref === 'function') {
    child.unref();
  }
  child.on('exit', async () => {
    processSpec.child = null;
    if (!processSpec.restart) {
      return;
    }
    await sleep(processSpec.cooldownMs);
    spawnManaged(processSpec, health);
  });
  child.on('error', (error) => {
    health.lastError = error instanceof Error ? error.message : String(error);
  });
}

function updateHealth(health: ProcessHealth, ready: boolean, error?: string | null): void {
  health.ready = ready;
  health.lastCheckAt = new Date().toISOString();
  if (ready) {
    health.lastReadyAt = health.lastCheckAt;
  }
  if (error !== undefined) {
    health.lastError = error;
  }
}

async function ensureAIGatewayUpstream(processSpec: ManagedProcess, health: ProcessHealth): Promise<void> {
  try {
    const ready = await isUpstreamReady();
    if (!processSpec.manageProcess) {
      updateHealth(health, ready, ready ? processSpec.skipReason || null : (processSpec.skipReason || 'AIGateway upstream has not responded yet.'));
      return;
    }
    updateHealth(health, ready, ready ? null : health.lastError);
    if (!ready) {
      spawnManaged(processSpec, health);
    }
  } catch (error: unknown) {
    const err = asErrorLike(error);

    updateHealth(health, false, error instanceof Error ? error.message : String(error));
    if (processSpec.manageProcess) {
      spawnManaged(processSpec, health);
    }
  }
}

async function ensureAIGatewayProxy(processSpec: ManagedProcess, health: ProcessHealth): Promise<void> {
  try {
    const probe = await probeGatewayProxy();
    updateHealth(health, probe.listening, probe.message);
    if (!probe.listening) {
      spawnManaged(processSpec, health);
    }
  } catch (error: unknown) {
    const err = asErrorLike(error);

    updateHealth(health, false, error instanceof Error ? error.message : String(error));
    spawnManaged(processSpec, health);
  }
}

async function ensureNodeHost(
  processSpec: ManagedProcess,
  health: ProcessHealth,
  nodeId: string,
  registry: NodeRegistryService,
): Promise<void> {
  try {
    const node = registry.getNode(nodeId);
    const ready = Boolean(node && node.status === 'online');
    updateHealth(health, ready);
    if (!ready) {
      spawnManaged(processSpec, health);
    }
  } catch (error: unknown) {
    const err = asErrorLike(error);

    updateHealth(health, false, error instanceof Error ? error.message : String(error));
    spawnManaged(processSpec, health);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const runOnce = args.includes('--once');
  const stopOnly = args.includes('--stop');
  const runtimeDir = ensureRuntimeDir();
  const lockPath = path.join(runtimeDir, 'ops-remote-keepalive.lock.json');
  const snapshotPath = path.join(runtimeDir, 'ops-remote-keepalive.json');
  if (stopOnly) {
    const existingLock = readLock(lockPath);
    if (existingLock?.pid && existingLock.pid !== process.pid) {
      try {
        killPid(existingLock.pid);
      } catch (error: unknown) {
        const err = asErrorLike(error);

        console.error('[ops-keepalive] failure ao encerrar PID ' + existingLock.pid + ': ' + (error instanceof Error ? error.message : String(error)));
      }
    }
    clearLock(lockPath);
    fs.writeFileSync(snapshotPath, JSON.stringify({
      ok: false,
      updatedAt: new Date().toISOString(),
      intervalMs: KEEPALIVE_INTERVAL_MS,
      nodeHostId: null,
      processes: {},
      notes: ['keepalive stop requested'],
    }, null, 2));
    console.log('[ops-keepalive] keepalive interrupted.');
    return;
  }

  const workspaceRoot = config.projectRoot;
  const upstreamCwd = resolveAIGatewayUpstreamWorktree();
  const upstreamIsLoopback = isLoopbackUrl(config.AIGatewayUpstreamBaseUrl);
  const manageLocalAIGatewayUpstream = upstreamIsLoopback && Boolean(upstreamCwd);
  const upstreamSkipReason = manageLocalAIGatewayUpstream
    ? null
    : upstreamIsLoopback ? 'local upstream configured, but the AIGateway worktree has not been provisioned yet.'
      : 'Using configured remote upstream; local AIGateway sidecar is not required.';
  const nodeHostId = resolveNodeHostId();
  if (!nodeHostId) {
    console.error('[ops-keepalive] No node host paired encontrado.');
    process.exitCode = 1;
    return;
  }
  const sharedSecret = resolveNodeHostSecret(nodeHostId);
  if (!sharedSecret) {
    console.error('[ops-keepalive] sharedSecret not found for the node host.');
    process.exitCode = 1;
    return;
  }

  const now = Date.now();
  const existingLock = readLock(lockPath);
  if (existingLock) {
    const updatedAtMs = Number.isNaN(Date.parse(existingLock.updatedAt))
      ? 0
      : Date.parse(existingLock.updatedAt);
    if (existingLock.pid !== process.pid && now - updatedAtMs < STALE_LOCK_MS) {
      console.error('[ops-keepalive] already existe um keepalive active com PID ' + existingLock.pid + '.');
      process.exitCode = 1;
      return;
    }
  }
  writeLock(lockPath, process.pid, new Date().toISOString());

  const processes: ManagedProcess[] = [
    {
      name: 'zavorth-control-upstream',
      command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
      args: ['run', 'dev'],
      cwd: upstreamCwd || workspaceRoot,
      shell: process.platform === 'win32',
      manageProcess: manageLocalAIGatewayUpstream,
      skipReason: upstreamSkipReason,
      restart: !runOnce,
      background: runOnce,
      child: null,
      cooldownMs: RESTART_DELAY_MS,
    },
    {
      name: 'zavorth-control-proxy',
      command: process.execPath,
      args: [path.resolve(config.projectRoot, 'scripts', 'start-ai-gateway-runtime.mjs')],
      cwd: workspaceRoot,
      shell: false,
      manageProcess: true,
      restart: !runOnce,
      background: runOnce,
      child: null,
      cooldownMs: RESTART_DELAY_MS,
    },
    {
      name: 'node-host',
      command: process.execPath,
      args: [
        path.resolve(config.projectRoot, 'dist-ops', 'scripts', 'node-mesh-host.js'),
        '--base-url',
        `http://127.0.0.1:${config.zavorthWebPort}`,
        '--node-id',
        nodeHostId,
        '--shared-secret',
        sharedSecret,
        '--workspace',
        workspaceRoot,
        '--capabilities',
        'browser.proxy,device.info,files.read,files.watch,files.write,system.run',
      ],
      cwd: workspaceRoot,
      shell: false,
      manageProcess: true,
      restart: !runOnce,
      background: runOnce,
      child: null,
      cooldownMs: RESTART_DELAY_MS,
    },
  ];

  const registry = new NodeRegistryService();
  const healthByName: Record<string, ProcessHealth> = {
    'zavorth-control-upstream': {
      name: 'zavorth-control-upstream',
      ready: false,
      lastCheckAt: null,
      lastStartAt: null,
      lastReadyAt: null,
      lastError: null,
      restarts: 0,
    },
    'zavorth-control-proxy': {
      name: 'zavorth-control-proxy',
      ready: false,
      lastCheckAt: null,
      lastStartAt: null,
      lastReadyAt: null,
      lastError: null,
      restarts: 0,
    },
    'node-host': {
      name: 'node-host',
      ready: false,
      lastCheckAt: null,
      lastStartAt: null,
      lastReadyAt: null,
      lastError: null,
      restarts: 0,
    },
  };

  const writeSnapshot = (notes: string[] = []) => {
    const snapshot: KeepaliveSnapshot = {
      ok: Object.values(healthByName).every((item) => item.ready),
      updatedAt: new Date().toISOString(),
      intervalMs: KEEPALIVE_INTERVAL_MS,
      nodeHostId,
      processes: healthByName,
      notes,
    };
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
    writeLock(lockPath, process.pid, snapshot.updatedAt);
  };

  await ensureAIGatewayUpstream(processes[0], healthByName['ai-gateway-upstream']);
  await ensureAIGatewayProxy(processes[1], healthByName['ai-gateway-proxy']);
  await ensureNodeHost(processes[2], healthByName['node-host'], nodeHostId, registry);
  writeSnapshot();

  if (runOnce) {
    for (let attempt = 0; attempt < ONCE_RECHECK_ATTEMPTS; attempt += 1) {
      if (Object.values(healthByName).every((entry) => entry.ready)) {
        break;
      }
      await sleep(ONCE_RECHECK_INTERVAL_MS);
      await ensureAIGatewayUpstream(processes[0], healthByName['ai-gateway-upstream']);
      await ensureAIGatewayProxy(processes[1], healthByName['ai-gateway-proxy']);
      await ensureNodeHost(processes[2], healthByName['node-host'], nodeHostId, registry);
      writeSnapshot([`runOnce recheck ${attempt + 1}/${ONCE_RECHECK_ATTEMPTS}`]);
    }
    clearLock(lockPath);
    return;
  }

  // Periodic health check to trigger restarts if needed.
  setInterval(async () => {
    await ensureAIGatewayUpstream(processes[0], healthByName['ai-gateway-upstream']);
    await ensureAIGatewayProxy(processes[1], healthByName['ai-gateway-proxy']);
    await ensureNodeHost(processes[2], healthByName['node-host'], nodeHostId, registry);
    writeSnapshot();
  }, KEEPALIVE_INTERVAL_MS);

  const handleExit = () => {
    clearLock(lockPath);
  };
  process.on('SIGINT', () => {
    handleExit();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    handleExit();
    process.exit(0);
  });

  process.on('unhandledRejection', (error) => {
    const message = error instanceof Error ? error.message : String(error);
    healthByName['node-host'].lastError = message;
    writeSnapshot(['unhandledRejection: ' + message]);
  });
  process.on('uncaughtException', (error) => {
    const message = error instanceof Error ? error.message : String(error);
    healthByName['node-host'].lastError = message;
    writeSnapshot(['uncaughtException: ' + message]);
  });
}

main().catch((error) => {
  console.error('[ops-keepalive] failure ao manter remote transports vivos.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
