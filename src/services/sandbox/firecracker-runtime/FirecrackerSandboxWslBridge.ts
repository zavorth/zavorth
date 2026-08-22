
import { v4 as uuidv4 } from 'uuid';
import type { ChildProcess } from 'child_process';
import { config } from '../../../config/index.js';
import { execNativeCommandSync, spawnNativeCommand } from '../../../core/CommandSpawn.js';
import type { SandboxRequest, SandboxResult } from '../ISandboxRuntime.js';
import { logger } from '../../../logger.js';
import {
buildWslBaseArgs,
  buildWslEnvParts,
  buildWslReadyStatus,
  buildWslUnavailableStatus,
  getWslExecutable,
  getWslFirecrackerBinPath,
  quoteForBash,
  toRequiredWslPath,
  type FirecrackerSandboxStatus,
} from './FirecrackerSandboxEnvironment.js';
import { asErrorLike } from '../../../utils/errorLike.js';

type WslBridgeReadyEnvelope = {
  event: 'ready';
};

type WslBridgeResponseEnvelope = {
  id: string | null;
  ok: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  error?: string;
};

type WslBridgePendingRequest = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

type WslBridgeState = {
  child: ChildProcess;
  ready: boolean;
  startupPromise: Promise<void>;
  buffer: string;
  pending: Map<string, WslBridgePendingRequest>;
  idleTimer: NodeJS.Timeout | null;
  stderrTail: string;
};

type WslStatusCacheEntry = {
  status: FirecrackerSandboxStatus;
  cachedAt: number;
};

const WSL_STATUS_CACHE_TTL_MS = 15000;
let wslBridge: WslBridgeState | null = null;
let wslStatusCache: WslStatusCacheEntry | null = null;

export function getWslStatus(wslProjectRoot: string | null): FirecrackerSandboxStatus {
  if (!wslProjectRoot) {
    return buildWslUnavailableStatus(
      'Could not convert the Zavorth workspace to a valid WSL path.',
    );
  }

  const cached = wslStatusCache;
  if (cached && Date.now() - cached.cachedAt < WSL_STATUS_CACHE_TTL_MS) {
    return cached.status;
  }

  try {
    const response = runWslBridge({ mode: 'status' }, wslProjectRoot, 15000);
    if (response && typeof response === 'object' && response.status) {
      const status = {
        ...response.status,
        transport: 'wsl' as const,
        bridgeReady: true,
        detail:
          typeof response.status.detail === 'string' ? `${response.status.detail} (via WSL ${config.firecrackerWslDistro})`
            : `Firecracker available via WSL ${config.firecrackerWslDistro}.`,
      } satisfies FirecrackerSandboxStatus;
      wslStatusCache = {
        status,
        cachedAt: Date.now(),
      };
      return status;
    }
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[Firecracker Sandbox Wsl Bridge] cache operation failed', error);
    return buildWslUnavailableStatus(`[FirecrackerSandbox] Ponte WSL unavailable: ${err.message}`);
  }

  return buildWslUnavailableStatus(
    `Failed to obter status do Firecracker via WSL ${config.firecrackerWslDistro}.`,
  );
}

export async function executeViaWsl(
  request: SandboxRequest,
  wslProjectRoot: string | null,
): Promise<SandboxResult> {
  try {
    const bridgeTimeoutMs = Math.max(
      (request.timeoutMs || config.firecrackerExecutionTimeoutMs) + 10000,
      180000,
    );
    const response = await runWslBridgeAsync(
      {
        mode: 'execute',
        request,
      },
      wslProjectRoot,
      bridgeTimeoutMs,
    );

    if (response && typeof response === 'object' && response.result) {
      wslStatusCache = {
        status: buildWslReadyStatus(
          `Firecracker MicroVM ready for safe code execution. (via WSL ${config.firecrackerWslDistro})`,
        ),
        cachedAt: Date.now(),
      };
      return response.result as SandboxResult;
    }

    throw new Error('A ponte WSL returned um payload invalid.');
  } catch (error: unknown) {wslStatusCache = null;
    throw error;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function runWslBridge(payload: Record<string, unknown>, wslProjectRoot: string, timeoutMs: number): any {
  const args = buildWslBridgeArgs(payload, wslProjectRoot);
  const raw = execNativeCommandSync(getWslExecutable(), args, {
    timeout: timeoutMs,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  });

  const output = String(raw || '').trim();
  if (!output) {
    throw new Error('The WSL bridge returned no output.');
  }

  try {
    return JSON.parse(output);
  } catch (error: unknown) {
    const err = asErrorLike(error);
    throw new Error(`Resposta invalid da ponte WSL: ${err.message}`);
  }
}

async function runWslBridgeAsync(
  payload: Record<string, unknown>,
  wslProjectRoot: string | null,
  timeoutMs: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const bridge = await ensureWslBridge(wslProjectRoot);
  resetWslBridgeIdleTimer();
  const requestId = uuidv4();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      bridge.pending.delete(requestId);
      reject(
        new Error(
          `Ponte WSL excedeu ${timeoutMs}ms.${bridge.stderrTail ? ` ${bridge.stderrTail.trim()}` : ''}`,
        ),
      );
    }, timeoutMs);

    bridge.pending.set(requestId, {
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      },
      timer,
    });

    bridge.child.stdin?.write(`${JSON.stringify({ id: requestId, payload })}\n`);
  });
}

function buildWslBridgeArgs(payload: Record<string, unknown>, wslProjectRoot: string): string[] {
  const envParts = buildWslEnvParts({
    binPath: getWslFirecrackerBinPath(config.firecrackerBinPath),
    kernelPath: toRequiredWslPath(config.firecrackerKernelPath, 'kernel'),
    rootfsPath: toRequiredWslPath(config.firecrackerRootfsPath, 'rootfs'),
  });

  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  const command = [
    `cd ${quoteForBash(wslProjectRoot)}`,
    `env ${envParts.join(' ')} node scripts/firecracker-wsl-runner.mjs ${quoteForBash(encodedPayload)}`,
  ].join(' && ');

  return buildWslBaseArgs(config.firecrackerWslDistro, config.firecrackerWslUser, command);
}

async function ensureWslBridge(wslProjectRoot: string | null): Promise<WslBridgeState> {
  if (wslBridge) {
    await wslBridge.startupPromise;
    return wslBridge;
  }

  if (!wslProjectRoot) {
    throw new Error('Zavorth workspace cannot be converted to WSL.');
  }

  const command = [
    `cd ${quoteForBash(wslProjectRoot)}`,
    `env ${buildWslEnvParts({
      binPath: getWslFirecrackerBinPath(config.firecrackerBinPath),
      kernelPath: toRequiredWslPath(config.firecrackerKernelPath, 'kernel'),
      rootfsPath: toRequiredWslPath(config.firecrackerRootfsPath, 'rootfs'),
    }).join(' ')} node scripts/firecracker-wsl-bridge.mjs`,
  ].join(' && ');
  const child = spawnNativeCommand(getWslExecutable(), buildWslBaseArgs(config.firecrackerWslDistro, config.firecrackerWslUser, command), {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });

  const bridge: WslBridgeState = {
    child,
    ready: false,
    startupPromise: Promise.resolve(),
    buffer: '',
    pending: new Map<string, WslBridgePendingRequest>(),
    idleTimer: null,
    stderrTail: '',
  };

  bridge.startupPromise = new Promise<void>((resolve, reject) => {
    const startupTimer = setTimeout(() => {
      reject(new Error(`Firecracker WSL bridge did not respond within 15000ms.`));
    }, 15000);

    const failStartup = (error: Error) => {
      clearTimeout(startupTimer);
      reject(error);
    };

    child.on('error', failStartup);
    child.on('close', (code) => {
      if (!bridge.ready) {
        failStartup(new Error(`Ponte Firecracker WSL encerrou cedo with code ${code}.`));
        return;
      }

      clearWslBridge(
        new Error(bridge.stderrTail.trim() || `Ponte Firecracker WSL encerrou with code ${code}.`),
      );
    });

    child.stdout?.on('data', (chunk) => {
      bridge.buffer += chunk.toString();
      let newlineIndex = bridge.buffer.indexOf('\n');
      while (newlineIndex >= 0) {
        const line = bridge.buffer.slice(0, newlineIndex).trim();
        bridge.buffer = bridge.buffer.slice(newlineIndex + 1);
        if (line) {
          handleWslBridgeLine(bridge, line, resolve, failStartup, startupTimer);
        }
        newlineIndex = bridge.buffer.indexOf('\n');
      }
    });

    child.stderr?.on('data', (chunk) => {
      bridge.stderrTail = `${bridge.stderrTail}${chunk.toString()}`.slice(-4000);
    });
  });

  wslBridge = bridge;
  await bridge.startupPromise;
  resetWslBridgeIdleTimer();
  return bridge;
}

function handleWslBridgeLine(
  bridge: WslBridgeState,
  line: string,
  resolveStartup: () => void,
  rejectStartup: (error: Error) => void,
  startupTimer: NodeJS.Timeout,
): void {
  let parsed: WslBridgeReadyEnvelope | WslBridgeResponseEnvelope;
  try {
    parsed = JSON.parse(line);
  } catch (error: unknown) {
    const err = asErrorLike(error);
    if (!bridge.ready) {
      clearTimeout(startupTimer);
      rejectStartup(new Error(`Ponte Firecracker WSL returned JSON invalid: ${err.message}`));
    }
    return;
  }

  if ((parsed as WslBridgeReadyEnvelope).event === 'ready') {
    bridge.ready = true;
    clearTimeout(startupTimer);
    resolveStartup();
    return;
  }

  const envelope = parsed as WslBridgeResponseEnvelope;
  if (!envelope.id) {
    return;
  }

  const pending = bridge.pending.get(envelope.id);
  if (!pending) {
    return;
  }

  bridge.pending.delete(envelope.id);
  resetWslBridgeIdleTimer();

  if (envelope.ok) {
    pending.resolve(envelope.data);
    return;
  }

  pending.reject(new Error(envelope.error || 'unknown error in WSL bridge.'));
}

function clearWslBridge(error: Error): void {
  const bridge = wslBridge;
  if (!bridge) {
    return;
  }

  if (bridge.idleTimer) {
    clearTimeout(bridge.idleTimer);
  }

  for (const pending of bridge.pending.values()) {
    clearTimeout(pending.timer);
    pending.reject(error);
  }
  bridge.pending.clear();

  wslBridge = null;
  wslStatusCache = null;
}

function resetWslBridgeIdleTimer(): void {
  const bridge = wslBridge;
  if (!bridge) {
    return;
  }

  if (bridge.idleTimer) {
    clearTimeout(bridge.idleTimer);
  }

  bridge.idleTimer = setTimeout(() => {
    const current = wslBridge;
    if (!current || current.pending.size > 0) {
      return;
    }

    try {
      current.child.stdin?.end();
    } catch (error: unknown) {// ignore
      logger.warn('[Firecracker Sandbox Wsl Bridge] cache operation failed', error);
    }

    try {
      current.child.kill('SIGTERM');
    } catch (error: unknown) {// ignore
      logger.warn('[Firecracker Sandbox Wsl Bridge] operation failed', error);
    }

    wslBridge = null;
  }, config.firecrackerWslBridgeIdleMs);
}
