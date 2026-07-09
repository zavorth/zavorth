import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { spawnNativeCommand } from '../core/CommandSpawn.js';
import { logger } from '../logger.js';

export type ZavorthBridgePublicTunnelStatus = {
  enabled: boolean;
  running: boolean;
  ready: boolean;
  pid: number | null;
  tunnelPid: number | null;
  cliPath: string;
  hostScriptPath: string;
  publicUrl: string | null;
  targetUrl: string | null;
  checkedAt: string;
  message: string;
  stateFile: string;
  logFile: string;
};

type SpawnLike = typeof spawnNativeCommand;

type ZavorthBridgePublicTunnelOptions = {
  spawn?: SpawnLike;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
};

export class ZavorthBridgePublicTunnelService {
  private readonly spawnImpl: SpawnLike;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => Date;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly mkdirSync: typeof fs.mkdirSync;

  constructor(options: ZavorthBridgePublicTunnelOptions = {}) {
    this.spawnImpl = options.spawn || spawnNativeCommand;
    this.sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.now = options.now || (() => new Date());
    this.existsSync = options.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = options.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = options.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSync = options.mkdirSync || fs.mkdirSync.bind(fs);
  }

  public readStatus(): ZavorthBridgePublicTunnelStatus {
    const fallback = this.buildStatus({
      running: false,
      ready: false,
      message: config.zavorthBridgePublicTunnelEnabled
        ? 'ZavorthBridge public tunnel has not been started yet.'
        : 'Automatic ZavorthBridge public tunnel is disabled.',
    });

    try {
      if (!this.existsSync(config.zavorthBridgePublicTunnelStateFile)) {
        return fallback;
      }
      const parsed = JSON.parse(
        this.readFileSync(config.zavorthBridgePublicTunnelStateFile, 'utf8'),
      ) as Partial<ZavorthBridgePublicTunnelStatus>;
      return {
        ...fallback,
        ...parsed,
      };
    } catch (error: unknown) {logger.warn('[Zavorth Bridge Public Tunnel] JSON parse failed', error); return fallback; }
  }

  public async ensureStarted(input: {
    targetUrl: string;
  }): Promise<ZavorthBridgePublicTunnelStatus & { started: boolean }> {
    const targetUrl = String(input.targetUrl || '').trim();
    const current = this.readStatus();
    if (!config.zavorthBridgePublicTunnelEnabled) {
      return {
        ...current,
        ready: false,
        running: false,
        targetUrl,
        message: 'Automatic ZavorthBridge public tunnel is disabled by configuration.',
        started: false,
      };
    }

    if (!targetUrl) {
      return {
        ...current,
        ready: false,
        running: false,
        targetUrl: null,
        message: 'I did not receive a valid target URL to publish ZavorthBridge.',
        started: false,
      };
    }

    if (!isLoopbackHttpUrl(targetUrl)) {
      return {
        ...current,
        ready: false,
        running: false,
        targetUrl: null,
        message: 'ZavorthBridge public tunnel can only publish a local HTTP URL.',
        started: false,
      };
    }

    if (current.ready && current.publicUrl && current.targetUrl === targetUrl && this.isPidAlive(current.pid)) {
      return {
        ...current,
        started: false,
      };
    }

    if (!this.existsSync(config.zavorthBridgePublicTunnelHostScriptPath)) {
      return {
        ...current,
        ready: false,
        running: false,
        targetUrl,
        message: `Public tunnel host script missing at ${config.zavorthBridgePublicTunnelHostScriptPath}.`,
        started: false,
      };
    }

    if (current.running && this.isPidAlive(current.pid)) {
      const awaited = await this.waitForReady();
      return {
        ...awaited,
        started: false,
      };
    }

    this.writeStatus(
      this.buildStatus({
        running: true,
        ready: false,
        targetUrl,
        message: 'Requesting ZavorthBridge public tunnel opening.',
      }),
    );

    const child = this.spawnImpl(
      process.execPath,
      [
        config.zavorthBridgePublicTunnelHostScriptPath,
        '--cli-path',
        config.zavorthBridgePublicTunnelCliPath,
        '--target-url',
        targetUrl,
        '--state-file',
        config.zavorthBridgePublicTunnelStateFile,
        '--log-file',
        config.zavorthBridgePublicTunnelLogFile,
      ],
      {
        cwd: config.projectRoot,
        env: buildTunnelChildEnv(),
        detached: true,
        stdio: 'ignore',
      },
    );
    child.unref();

    const awaited = await this.waitForReady();
    return {
      ...awaited,
      started: true,
    };
  }

  public async stop(): Promise<ZavorthBridgePublicTunnelStatus> {
    const current = this.readStatus();
    this.tryKill(current.tunnelPid);
    this.tryKill(current.pid);

    const stopped = this.buildStatus({
      running: false,
      ready: false,
      targetUrl: current.targetUrl,
      publicUrl: null,
      pid: null,
      tunnelPid: null,
      message: 'ZavorthBridge public tunnel closed.',
    });
    this.writeStatus(stopped);
    return stopped;
  }

  private async waitForReady(): Promise<ZavorthBridgePublicTunnelStatus> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < config.zavorthBridgePublicTunnelReadyTimeoutMs) {
      await this.sleep(250);
      const status = this.readStatus();
      if (status.ready && status.publicUrl) {
        return status;
      }
      if (!status.running && status.message && !/has not been started yet/i.test(status.message)) {
        return status;
      }
    }

    const latest = this.readStatus();
    return {
      ...latest,
      message:
        latest.message
        || 'The ZavorthBridge public tunnel was triggered, but has not published an external URL yet.',
    };
  }

  private buildStatus(input: {
    running: boolean;
    ready: boolean;
    message: string;
    pid?: number | null;
    tunnelPid?: number | null;
    publicUrl?: string | null;
    targetUrl?: string | null;
  }): ZavorthBridgePublicTunnelStatus {
    return {
      enabled: config.zavorthBridgePublicTunnelEnabled,
      running: input.running,
      ready: input.ready,
      pid: input.pid ?? null,
      tunnelPid: input.tunnelPid ?? null,
      cliPath: config.zavorthBridgePublicTunnelCliPath,
      hostScriptPath: config.zavorthBridgePublicTunnelHostScriptPath,
      publicUrl: String(input.publicUrl || '').trim() || null,
      targetUrl: String(input.targetUrl || '').trim() || null,
      checkedAt: this.now().toISOString(),
      message: input.message,
      stateFile: config.zavorthBridgePublicTunnelStateFile,
      logFile: config.zavorthBridgePublicTunnelLogFile,
    };
  }

  private writeStatus(status: ZavorthBridgePublicTunnelStatus): void {
    this.mkdirSync(path.dirname(config.zavorthBridgePublicTunnelStateFile), { recursive: true });
    this.writeFileSync(config.zavorthBridgePublicTunnelStateFile, JSON.stringify(status, null, 2), 'utf8');
  }

  private isPidAlive(pid: number | null): boolean {
    if (!pid || !Number.isFinite(pid)) {
      return false;
    }
    try {
      process.kill(pid, 0);
      return true;
    } catch (error: unknown) {logger.warn('[Zavorth Bridge Public Tunnel] filesystem operation failed', error); return false; }
  }

  private tryKill(pid: number | null): void {
    if (!pid || !Number.isFinite(pid)) {
      return;
    }
    try {
      process.kill(pid);
    } catch (error: unknown) {// Ignore stale or already-dead pids.
      logger.warn('[Zavorth Bridge Public Tunnel] operation failed', error);
    }
  }
}

function isLoopbackHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    return (
      parsed.protocol === 'http:' &&
      (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]')
    );
  } catch (error: unknown) {logger.warn('[Zavorth Bridge Public Tunnel] network request failed', error); return false; }
}

function buildTunnelChildEnv(): NodeJS.ProcessEnv {
  const allowedNames = ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'HOME', 'USERPROFILE', 'TMP', 'TEMP'];
  const env: NodeJS.ProcessEnv = {};
  for (const name of allowedNames) {
    if (process.env[name]) {
      env[name] = process.env[name];
    }
  }
  return env;
}
