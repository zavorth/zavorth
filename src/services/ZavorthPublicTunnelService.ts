import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { spawnNativeCommand } from '../core/CommandSpawn.js';
import { logger } from '../logger.js';

export type ZavorthPublicTunnelStatus = {
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

type ZavorthPublicTunnelOptions = {
  spawn?: SpawnLike;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
};

export class ZavorthPublicTunnelService {
  private readonly spawnImpl: SpawnLike;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => Date;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly mkdirSync: typeof fs.mkdirSync;

  constructor(options: ZavorthPublicTunnelOptions = {}) {
    this.spawnImpl = options.spawn || spawnNativeCommand;
    this.sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.now = options.now || (() => new Date());
    this.existsSync = options.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = options.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = options.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSync = options.mkdirSync || fs.mkdirSync.bind(fs);
  }

  public readStatus(): ZavorthPublicTunnelStatus {
    const fallback = this.buildStatus({
      running: false,
      ready: false,
      message: config.zavorthPublicTunnelEnabled
        ? 'Tunel publico do Zavorth ainda nao foi iniciado.'
        : 'Tunel publico automatico do Zavorth desativado.',
    });

    try {
      if (!this.existsSync(config.zavorthPublicTunnelStateFile)) {
        return fallback;
      }
      const parsed = JSON.parse(
        this.readFileSync(config.zavorthPublicTunnelStateFile, 'utf8'),
      ) as Partial<ZavorthPublicTunnelStatus>;
      return {
        ...fallback,
        ...parsed,
      };
    } catch (error: any) { logger.warn('[Zavorth Public Tunnel] JSON parse failed', error); return fallback; }
  }

  public async ensureStarted(input: { targetUrl?: string } = {}): Promise<ZavorthPublicTunnelStatus & { started: boolean }> {
    const targetUrl = String(input.targetUrl || this.buildDefaultTargetUrl()).trim();
    const current = this.readStatus();
    if (!config.zavorthPublicTunnelEnabled) {
      return {
        ...current,
        ready: false,
        running: false,
        targetUrl,
        message: 'Tunel publico automatico do Zavorth desativado por configuracao.',
        started: false,
      };
    }

    if (!targetUrl) {
      return {
        ...current,
        ready: false,
        running: false,
        targetUrl: null,
        message: 'Nao recebi uma URL alvo valida para publicar o /app do Zavorth.',
        started: false,
      };
    }

    if (current.ready && current.publicUrl && current.targetUrl === targetUrl && this.isPidAlive(current.pid)) {
      return {
        ...current,
        started: false,
      };
    }

    if (!this.existsSync(config.zavorthPublicTunnelHostScriptPath)) {
      return {
        ...current,
        ready: false,
        running: false,
        targetUrl,
        message: `Host script do tunel publico ausente em ${config.zavorthPublicTunnelHostScriptPath}.`,
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
        message: 'Solicitando a abertura do tunel publico do Zavorth.',
      }),
    );

    const child = this.spawnImpl(
      process.execPath,
      [
        config.zavorthPublicTunnelHostScriptPath,
        '--label',
        'Zavorth',
        '--cli-path',
        config.zavorthPublicTunnelCliPath,
        '--target-url',
        targetUrl,
        '--state-file',
        config.zavorthPublicTunnelStateFile,
        '--log-file',
        config.zavorthPublicTunnelLogFile,
      ],
      {
        cwd: config.projectRoot,
        env: process.env,
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

  public async stop(): Promise<ZavorthPublicTunnelStatus> {
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
      message: 'Tunel publico do Zavorth encerrado.',
    });
    this.writeStatus(stopped);
    return stopped;
  }

  private async waitForReady(): Promise<ZavorthPublicTunnelStatus> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < config.zavorthPublicTunnelReadyTimeoutMs) {
      await this.sleep(250);
      const status = this.readStatus();
      if (status.ready && status.publicUrl) {
        return status;
      }
      if (!status.running && status.message && !/ainda nao foi iniciado/i.test(status.message)) {
        return status;
      }
    }

    const latest = this.readStatus();
    return {
      ...latest,
      message:
        latest.message
        || 'O tunel publico do Zavorth foi acionado, mas ainda nao publicou uma URL externa.',
    };
  }

  private buildDefaultTargetUrl(): string {
    return `http://127.0.0.1:${config.zavorthWebPort}`;
  }

  private buildStatus(input: {
    running: boolean;
    ready: boolean;
    message: string;
    pid?: number | null;
    tunnelPid?: number | null;
    publicUrl?: string | null;
    targetUrl?: string | null;
  }): ZavorthPublicTunnelStatus {
    return {
      enabled: config.zavorthPublicTunnelEnabled,
      running: input.running,
      ready: input.ready,
      pid: input.pid ?? null,
      tunnelPid: input.tunnelPid ?? null,
      cliPath: config.zavorthPublicTunnelCliPath,
      hostScriptPath: config.zavorthPublicTunnelHostScriptPath,
      publicUrl: String(input.publicUrl || '').trim() || null,
      targetUrl: String(input.targetUrl || '').trim() || null,
      checkedAt: this.now().toISOString(),
      message: input.message,
      stateFile: config.zavorthPublicTunnelStateFile,
      logFile: config.zavorthPublicTunnelLogFile,
    };
  }

  private writeStatus(status: ZavorthPublicTunnelStatus): void {
    this.mkdirSync(path.dirname(config.zavorthPublicTunnelStateFile), { recursive: true });
    this.writeFileSync(config.zavorthPublicTunnelStateFile, JSON.stringify(status, null, 2), 'utf8');
  }

  private isPidAlive(pid: number | null): boolean {
    if (!pid || !Number.isFinite(pid)) {
      return false;
    }
    try {
      process.kill(pid, 0);
      return true;
    } catch (error: any) { logger.warn('[Zavorth Public Tunnel] filesystem operation failed', error); return false; }
  }

  private tryKill(pid: number | null): void {
    if (!pid || !Number.isFinite(pid)) {
      return;
    }
    try {
      process.kill(pid);
    } catch (error: any) {
      // Ignore stale or already-dead pids.
      logger.warn('[Zavorth Public Tunnel] operation failed', error);
    }
  }
}
