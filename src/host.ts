import { fork, spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { config } from './config/index.js';
import {
  clearAutoRepairTriggerState,
  persistAutoRepairTriggerState,
  readAutoRepairCooldownState,
} from './host/HostAutoRepairState.js';
import { HostBackupStore } from './host/HostBackupStore.js';
import {
  ZAVORTH_PROCESS_LOCK_CONFLICT_EXIT_CODE,
  ZavorthProcessLockConflictError,
  ProcessLockService,
} from './services/ProcessLockService.js';

import { sanitizeWindowsEnv } from './host/HostEnvironment.js';
import { asErrorLike } from './utils/errorLike.js';
import {
  startExternalLauncherReload,
  type ExternalLauncherReloadInput,
} from './host/HostSupervisorLauncher.js';

const DEFAULT_WORKER_EXTENSION = path.extname(__filename) === '.ts' ? '.ts' : '.js';
const DEFAULT_WORKER_SCRIPT = path.resolve(__dirname, `index${DEFAULT_WORKER_EXTENSION}`);
const DEFAULT_BACKUPS_DIR = path.resolve(__dirname, '..', 'data', 'self-heal', 'backups');
const DEFAULT_MANIFEST_PATH = path.resolve(DEFAULT_BACKUPS_DIR, 'manifest.json');
const DEFAULT_HEARTBEAT_INTERVAL_MS = 60_000;
const DEFAULT_HEARTBEAT_MISS_LIMIT = 3;
const DEFAULT_BOOT_GRACE_PERIOD_MS = 90_000;
const DEFAULT_MAX_CONSECUTIVE_CRASHES = 3;
const DEFAULT_RESTART_DELAY_MS = 3_000;
const MAX_BACKUPS_PER_FILE = 3;

export type { BackupManifest } from './host/HostBackupStore.js';
type HostRuntime = {
  forkImpl?: typeof fork;
  spawnImpl?: typeof spawn;
  fetchImpl?: typeof fetch;
  setIntervalImpl?: typeof setInterval;
  clearIntervalImpl?: typeof clearInterval;
  setTimeoutImpl?: typeof setTimeout;
  clearTimeoutImpl?: typeof clearTimeout;
  now?: () => number;
  exitImpl?: (code?: number) => void;
  processRef?: NodeJS.Process;
  logFn?: (message: string) => void;
  processKillImpl?: (pid: number, signal?: number | NodeJS.Signals) => void;
};

export type ZavorthHostOptions = {
  workerScript?: string;
  backupsDir?: string;
  manifestPath?: string;
  hostLockFilePath?: string;
  hostAutoRepairStateFilePath?: string;
  supervisedReloadRequestScriptPath?: string;
  powershellExecutablePath?: string;
  heartbeatIntervalMs?: number;
  heartbeatMissLimit?: number;
  bootGracePeriodMs?: number;
  maxConsecutiveCrashes?: number;
  restartDelayMs?: number;
  crashLoopWindowMs?: number;
  autoRepairCooldownMs?: number;
  resourceMemoryLimitMb?: number;
  resourceCpuLimitPercent?: number;
  resourceBreachLimit?: number;
  registerSignalHandlers?: boolean;
  runtime?: HostRuntime;
};

export class ZavorthHost {
  private readonly hostLockOwner = 'host-supervisor';
  private worker: ChildProcess | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private bootTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private missedHeartbeats = 0;
  private consecutiveCrashes = 0;
  private bootTimestamp = 0;
  private bootAcknowledged = false;
  private isShuttingDown = false;
  private readonly workerScript: string;
  private readonly backupsDir: string;
  private readonly manifestPath: string;
  private readonly hostLockFilePath: string;
  private readonly hostAutoRepairStateFilePath: string;
  private readonly supervisedReloadRequestScriptPath: string;
  private readonly powershellExecutablePath: string;
  private readonly forkImpl: typeof fork;
  private readonly spawnImpl: typeof spawn;
  private readonly fetchImpl: typeof fetch | null;
  private readonly setIntervalImpl: typeof setInterval;
  private readonly clearIntervalImpl: typeof clearInterval;
  private readonly setTimeoutImpl: typeof setTimeout;
  private readonly clearTimeoutImpl: typeof clearTimeout;
  private readonly now: () => number;
  private readonly exitImpl: (code?: number) => void;
  private readonly processRef: NodeJS.Process;
  private readonly logFn: (message: string) => void;
  private readonly heartbeatIntervalMs: number;
  private readonly heartbeatMissLimit: number;
  private readonly bootGracePeriodMs: number;
  private readonly maxConsecutiveCrashes: number;
  private readonly restartDelayMs: number;
  private readonly crashLoopWindowMs: number;
  private readonly autoRepairCooldownMs: number;
  private readonly resourceMemoryLimitMb: number;
  private readonly resourceCpuLimitPercent: number;
  private readonly resourceBreachLimit: number;
  private readonly registerSignalHandlers: boolean;
  private readonly hostLock: ProcessLockService;
  private readonly backupStore: HostBackupStore;
  private consecutiveResourceBreaches = 0;
  private pendingBootFailureReason: string | null = null;
  private autoRepairHandoffInFlight = false;
  private unexpectedExitHistory: number[] = [];
  private lastBootProgressStage: string | null = null;
  private heartbeatRecoveryInFlight = false;

  constructor(options: ZavorthHostOptions = {}) {
    this.workerScript = options.workerScript || DEFAULT_WORKER_SCRIPT;
    this.backupsDir = options.backupsDir || DEFAULT_BACKUPS_DIR;
    this.manifestPath = options.manifestPath || DEFAULT_MANIFEST_PATH;
    this.hostLockFilePath = options.hostLockFilePath || config.hostSupervisorLockFile;
    this.hostAutoRepairStateFilePath = options.hostAutoRepairStateFilePath || config.hostAutoRepairStateFile;
    this.forkImpl = options.runtime?.forkImpl || fork;
    this.spawnImpl = options.runtime?.spawnImpl || spawn;
    this.fetchImpl = options.runtime?.fetchImpl || globalThis.fetch || null;
    this.setIntervalImpl = options.runtime?.setIntervalImpl || setInterval;
    this.clearIntervalImpl = options.runtime?.clearIntervalImpl || clearInterval;
    this.setTimeoutImpl = options.runtime?.setTimeoutImpl || setTimeout;
    this.clearTimeoutImpl = options.runtime?.clearTimeoutImpl || clearTimeout;
    this.now = options.runtime?.now || (() => Date.now());
    this.exitImpl = options.runtime?.exitImpl || ((code?: number) => process.exit(code ?? 0));
    this.processRef = options.runtime?.processRef || process;
    this.logFn = options.runtime?.logFn || ((message: string) => console.log(message));
    this.supervisedReloadRequestScriptPath =
      options.supervisedReloadRequestScriptPath || config.supervisedReloadRequestScriptPath;
    this.powershellExecutablePath =
      options.powershellExecutablePath ||
      (process.platform === 'win32'
        ? path.join(this.processRef.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
        : '');
    this.heartbeatIntervalMs = options.heartbeatIntervalMs || DEFAULT_HEARTBEAT_INTERVAL_MS;
    this.heartbeatMissLimit = options.heartbeatMissLimit || DEFAULT_HEARTBEAT_MISS_LIMIT;
    this.bootGracePeriodMs = options.bootGracePeriodMs || DEFAULT_BOOT_GRACE_PERIOD_MS;
    this.maxConsecutiveCrashes = options.maxConsecutiveCrashes || DEFAULT_MAX_CONSECUTIVE_CRASHES;
    this.restartDelayMs = options.restartDelayMs || DEFAULT_RESTART_DELAY_MS;
    this.crashLoopWindowMs = options.crashLoopWindowMs || config.hostCrashLoopWindowMs;
    this.autoRepairCooldownMs = options.autoRepairCooldownMs || config.hostAutoRepairCooldownMs;
    this.resourceMemoryLimitMb = options.resourceMemoryLimitMb || config.hostResourceMaxMemoryMb;
    this.resourceCpuLimitPercent = options.resourceCpuLimitPercent || config.hostResourceMaxCpuPercent;
    this.resourceBreachLimit = options.resourceBreachLimit || config.hostResourceBreachLimit;
    this.registerSignalHandlers = options.registerSignalHandlers !== false;
    this.hostLock = new ProcessLockService(this.hostLockFilePath, {
      pid: this.processRef.pid || process.pid,
      kill: options.runtime?.processKillImpl || process.kill.bind(process),
    });
    this.backupStore = new HostBackupStore({
      backupsDir: this.backupsDir,
      manifestPath: this.manifestPath,
      maxBackupsPerFile: MAX_BACKUPS_PER_FILE,
      now: this.now,
      log: (message) => this.log(message),
    });
  }

  public start(): void {
    try {
      this.hostLock.acquire(this.hostLockOwner);
      this.hostLock.ensure(this.hostLockOwner);
    } catch (error: unknown) {if (error instanceof ZavorthProcessLockConflictError || asErrorLike(error).code === 'ZAVORTH_PROCESS_LOCK_CONFLICT') {
        this.log(`Another Zavorth host supervisor is already active (PID ${(asErrorLike(error).existingPid as number | undefined)}). Exiting duplicate host.`);
        this.exitImpl(0);
        return;
      }

      throw error;
    }

    this.log('===========================================');
    this.log('  Zavorth Host Supervisor v1.0');
    this.log('===========================================');
    this.log(`Worker script: ${this.workerScript}`);
    this.log(`Backups dir:   ${this.backupsDir}`);

    this.spawnWorker();

    if (this.registerSignalHandlers) {
      this.processRef.on('SIGINT', () => this.shutdown('SIGINT'));
      this.processRef.on('SIGTERM', () => this.shutdown('SIGTERM'));
    }
  }

  private spawnWorker(): void {
    if (this.isShuttingDown) {
      return;
    }

    this.hostLock.ensure(this.hostLockOwner);
    this.log('Spawning worker...');
    this.bootTimestamp = this.now();
    this.bootAcknowledged = false;
    this.missedHeartbeats = 0;
    this.consecutiveResourceBreaches = 0;
    this.lastBootProgressStage = null;
    this.stopHeartbeatMonitor();
    this.clearBootTimeout();

    const isTsWorker = path.extname(this.workerScript) === '.ts';
    const pathRegister = path.resolve(__dirname, '..', 'scripts', 'register-zavorth-paths.cjs');
    // Compiled dist workers need @zavorth/* path aliases (tsconfig paths are not honored by Node).
    const execArgv = isTsWorker
      ? ['--import', 'tsx']
      : fs.existsSync(pathRegister)
        ? ['-r', pathRegister]
        : [];
    const workerEnv = { ...sanitizeWindowsEnv(this.processRef.env), ZAVORTH_SUPERVISED: 'true' };
    try {
      this.worker = this.forkImpl(this.workerScript, [], {
        execArgv,
        stdio: ['pipe', 'inherit', 'inherit', 'ipc'],
        env: workerEnv,
      });
    } catch (error: unknown) {if (process.platform !== 'win32' || asErrorLike(error).code !== 'EPERM') {
        throw error;
      }

      this.log('Worker fork failed with EPERM on Windows. Falling back to node spawn with IPC...');
      this.worker = this.spawnImpl(this.processRef.execPath, [...execArgv, this.workerScript], {
        stdio: ['pipe', 'inherit', 'inherit', 'ipc'],
        env: workerEnv,
        shell: false,
      });
    }

    this.scheduleBootTimeout();

    this.worker.on('message', (msg: any) => {
      if (msg?.type === 'heartbeat') {
        this.missedHeartbeats = 0;
        this.handleWorkerStats(msg?.stats || null);
        return;
      }

      if (msg?.type === 'boot_success') {
        this.bootAcknowledged = true;
        this.missedHeartbeats = 0;
        this.lastBootProgressStage = null;
        this.clearBootTimeout();
        this.startHeartbeatMonitor();
        this.log('Worker booted successfully.');
        this.consecutiveCrashes = 0;
        this.consecutiveResourceBreaches = 0;
        this.autoRepairHandoffInFlight = false;
        this.markCurrentAsStable();
        clearAutoRepairTriggerState(this.hostAutoRepairStateFilePath);
        return;
      }

      if (msg?.type === 'boot_progress') {
        if (!this.bootAcknowledged) {
          this.missedHeartbeats = 0;
          this.scheduleBootTimeout();
          const stage = String(msg?.stage || '').trim();
          if (stage && stage !== this.lastBootProgressStage) {
            this.lastBootProgressStage = stage;
            this.log(`Worker still booting: ${stage}`);
          }
        }
        return;
      }

      if (msg?.type === 'pre_modify') {
        this.handlePreModify(msg.files || []);
        return;
      }

      if (msg?.type === 'handoff_reload') {
        this.handleHandoffReload(msg);
      }
    });

    this.worker.on('exit', (code, signal) => {
      this.stopHeartbeatMonitor();
      this.clearBootTimeout();

      if (this.isShuttingDown) {
        this.log(`Worker exited (code=${code}, signal=${signal}). Host shutting down.`);
        this.hostLock.release();
        this.exitImpl(0);
        return;
      }

      const bootDuration = this.now() - this.bootTimestamp;
      this.log(`Worker exited unexpectedly (code=${code}, signal=${signal}, uptime=${Math.round(bootDuration / 1000)}s)`);

      const processLockConflict = code === ZAVORTH_PROCESS_LOCK_CONFLICT_EXIT_CODE;
      const failedBeforeStable = !this.bootAcknowledged || bootDuration < this.bootGracePeriodMs;
      const bootFailureReason = this.pendingBootFailureReason;
      this.pendingBootFailureReason = null;
      const crashLoop = processLockConflict ? { detected: false, count: 0 } : this.recordUnexpectedExit();
      let externalRecoveryRequested = false;
      if (failedBeforeStable && !processLockConflict) {
        this.consecutiveCrashes += 1;
        this.log(
          `Crash during boot grace period. Consecutive crashes: ${this.consecutiveCrashes}/${this.maxConsecutiveCrashes}`,
        );

        if (bootFailureReason) {
          this.log('Boot failure detected. Attempting rollback before external autorepair handoff...');
          this.rollback();
          this.consecutiveCrashes = 0;
          externalRecoveryRequested = this.triggerAutoRepairHandoff(bootFailureReason);
        } else if (this.consecutiveCrashes >= this.maxConsecutiveCrashes) {
          this.log('Max consecutive crashes reached. Attempting rollback...');
          this.rollback();
          this.consecutiveCrashes = 0;
          externalRecoveryRequested = this.triggerAutoRepairHandoff(
            'Crash loop detectado no host supervisor durante o periodo de boot do worker do Telegram.',
          );
        }
      } else {
        this.consecutiveCrashes = 0;
      }

      if (!externalRecoveryRequested && crashLoop.detected) {
        this.log(
          `Crash loop detectado fora do boot grace period (${crashLoop.count} saida(s) em ${Math.round(this.crashLoopWindowMs / 1000)}s).`,
        );
        externalRecoveryRequested = this.triggerAutoRepairHandoff(
          `Crash loop detectado no host supervisor: o worker saiu ${crashLoop.count} vez(es) em ${Math.round(this.crashLoopWindowMs / 1000)}s.`,
        );
      }

      if (processLockConflict) {
        this.log('Worker detected an existing Zavorth process lock. Waiting and retrying without rollback escalation.');
      }

      if (externalRecoveryRequested) {
        return;
      }

      this.log(`Restarting worker in ${this.restartDelayMs / 1000}s...`);
      this.setTimeoutImpl(() => this.spawnWorker(), this.restartDelayMs);
    });

    this.worker.on('error', (err: any) => {
      this.log(`Worker error: ${err.message}`);
    });
  }

  private scheduleBootTimeout(): void {
    this.clearBootTimeout();
    this.bootTimeoutTimer = this.setTimeoutImpl(() => {
      if (this.isShuttingDown || this.bootAcknowledged) {
        return;
      }

      this.log('Boot grace period exceeded without boot_success. Killing unresponsive worker...');
      this.pendingBootFailureReason =
        'Falha de boot detectada pelo host supervisor: o worker excedeu o boot grace period sem enviar boot_success.';
      this.worker?.kill('SIGKILL');
    }, this.bootGracePeriodMs);
  }

  private clearBootTimeout(): void {
    if (this.bootTimeoutTimer) {
      this.clearTimeoutImpl(this.bootTimeoutTimer);
      this.bootTimeoutTimer = null;
    }
  }

  private startHeartbeatMonitor(): void {
    this.stopHeartbeatMonitor();
    this.heartbeatTimer = this.setIntervalImpl(() => {
      this.hostLock.ensure(this.hostLockOwner);
      void this.evaluateHeartbeatHealth();
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeatMonitor(): void {
    if (this.heartbeatTimer) {
      this.clearIntervalImpl(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async evaluateHeartbeatHealth(): Promise<void> {
    this.missedHeartbeats += 1;
    if (this.missedHeartbeats < this.heartbeatMissLimit) {
      return;
    }

    if (this.heartbeatRecoveryInFlight) {
      return;
    }

    this.heartbeatRecoveryInFlight = true;
    try {
      if (await this.isWorkerSurfaceHealthy()) {
        this.log(
          `Missed ${this.missedHeartbeats} heartbeats, mas a superficie web segue saudavel. Mantendo o worker ativo.`,
        );
        this.missedHeartbeats = 0;
        return;
      }
    } finally {
      this.heartbeatRecoveryInFlight = false;
    }

    this.log(`Missed ${this.missedHeartbeats} heartbeats. Killing zombie worker...`);
    this.worker?.kill('SIGKILL');
  }

  private async isWorkerSurfaceHealthy(): Promise<boolean> {
    if (!this.fetchImpl) {
      return false;
    }

    const probeUrl = `http://${config.zavorthWebHost}:${config.zavorthWebPort}/zavorthControl`;

    try {
      const timeoutSignal =
        typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
          ? AbortSignal.timeout(4_000)
          : undefined;
      const response = await this.fetchImpl(probeUrl, {
        method: 'GET',
        signal: timeoutSignal,
      } as RequestInit);
      return Boolean(response?.ok);
    } catch (error: unknown) {return false;
    }
  }

  private recordUnexpectedExit(): { detected: boolean; count: number } {
    const now = this.now();
    this.unexpectedExitHistory = this.unexpectedExitHistory.filter((timestamp) => now - timestamp <= this.crashLoopWindowMs);
    this.unexpectedExitHistory.push(now);
    return {
      detected: this.unexpectedExitHistory.length >= this.maxConsecutiveCrashes,
      count: this.unexpectedExitHistory.length,
    };
  }

  private handlePreModify(files: string[]): void {
    this.backupStore.handlePreModify(files);
    this.worker?.send?.({ type: 'backup_done' });
  }

  private handleHandoffReload(message: any): void {
    const requestId = String(message?.requestId || '').trim() || `reload-${this.now()}`;
    const payload = message?.payload || {};
    const reason = String(payload.reason || '').trim() || 'Supervised reload requested by the worker.';
    const requestedBy = String(payload.requestedBy || '').trim() || 'unknown';
    const notifyChatId = String(payload.notifyChatId || '').trim();
    const forceRestart = payload.forceRestart !== false;

    if (this.isShuttingDown) {
      this.worker?.send?.({
        type: 'handoff_reload_ack',
        requestId,
        accepted: false,
        summary: 'O host supervisor ja esta encerrando e nao pode assumir outro reload agora.',
      });
      return;
    }

    const handoff = this.startExternalLauncherReload({
      reason,
      requestedBy,
      notifyChatId,
      forceRestart,
    });
    if (handoff.accepted) {
      this.worker?.send?.({
        type: 'handoff_reload_ack',
        requestId,
        accepted: true,
        summary:
          'O host supervisor aceitou o handoff do reload. Vou encerrar esta instancia para o launcher supervisionado reassumir com o codigo mais novo.',
      });
      this.log(`Accepted supervised reload handoff (request=${requestId}, requestedBy=${requestedBy}).`);

      this.setTimeoutImpl(() => this.shutdown('HANDOFF_RELOAD'), 250);
      return;
    }

    this.log(`Failed to hand off supervised reload: ${handoff.summary}`);
    this.worker?.send?.({
      type: 'handoff_reload_ack',
      requestId,
      accepted: false,
      summary: `Could not prepare the supervised reload handoff.\n\nReason: ${handoff.summary}`,
    });
  }

  private triggerAutoRepairHandoff(reason: string): boolean {
    if (this.autoRepairHandoffInFlight || this.isShuttingDown) {
      return false;
    }

    const cooldown = readAutoRepairCooldownState({
      stateFilePath: this.hostAutoRepairStateFilePath,
      autoRepairCooldownMs: this.autoRepairCooldownMs,
      now: this.now,
    });
    if (cooldown.active) {
      this.log(
        `Automatic autorepair is cooling down for another ${Math.ceil(cooldown.remainingMs / 1000)}s. Skipping handoff for now.`,
      );
      return false;
    }

    this.autoRepairHandoffInFlight = true;
    const handoff = this.startExternalLauncherReload({
      reason: 'Crash loop ou falha de boot detectados pelo host supervisor. Vou acionar um autoreparo completo.',
      requestedBy: 'host-autorepair',
      forceRestart: true,
      autoRepair: true,
      autoRepairReason: reason,
    });
    if (!handoff.accepted) {
      this.autoRepairHandoffInFlight = false;
      this.log(`Automatic autorepair handoff failed: ${handoff.summary}`);
      return false;
    }

    persistAutoRepairTriggerState(
      {
        stateFilePath: this.hostAutoRepairStateFilePath,
        now: this.now,
        log: (message) => this.log(message),
      },
      reason,
      this.processRef.pid || process.pid,
    );
    this.log(`Automatic autorepair handoff accepted: ${reason}`);
    this.setTimeoutImpl(() => this.shutdown('AUTO_REPAIR_HANDOFF'), 250);
    return true;
  }

  private startExternalLauncherReload(
    input: ExternalLauncherReloadInput,
  ): { accepted: boolean; summary: string } {
    return startExternalLauncherReload(input, {
      spawnImpl: this.spawnImpl,
      processRef: this.processRef,
      projectRoot: path.resolve(__dirname, '..'),
      powershellExecutablePath: this.powershellExecutablePath,
      supervisedReloadRequestScriptPath: this.supervisedReloadRequestScriptPath,
    });
  }

  private markCurrentAsStable(): void {
    this.backupStore.markCurrentAsStable();
  }

  private rollback(): void {
    this.backupStore.rollback();
  }

  private shutdown(signal: string): void {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.log(`Received ${signal}. Shutting down...`);
    this.stopHeartbeatMonitor();
    this.clearBootTimeout();
    if (this.worker) {
      this.worker.kill('SIGTERM');
      this.setTimeoutImpl(() => {
        this.worker?.kill('SIGKILL');
        this.hostLock.release();
        this.exitImpl(0);
      }, 5000);
    } else {
      this.hostLock.release();
      this.exitImpl(0);
    }
  }

  private log(message: string): void {
    const ts = new Date(this.now()).toISOString().replace('T', ' ').substring(0, 19);
    this.logFn(`[${ts}] [Host] ${message}`);
  }

  private handleWorkerStats(stats: any): void {
    if (!stats || typeof stats !== 'object') {
      this.consecutiveResourceBreaches = 0;
      return;
    }

    const rssMb = Number(stats.rssMb || 0);
    const cpuPercent = Number(stats.cpuPercent || 0);
    const memoryBreached = this.resourceMemoryLimitMb > 0 && rssMb >= this.resourceMemoryLimitMb;
    const cpuBreached = this.resourceCpuLimitPercent > 0 && cpuPercent >= this.resourceCpuLimitPercent;

    if (!memoryBreached && !cpuBreached) {
      this.consecutiveResourceBreaches = 0;
      return;
    }

    this.consecutiveResourceBreaches += 1;
    this.log(
      `Worker resource breach ${this.consecutiveResourceBreaches}/${this.resourceBreachLimit} (rss=${rssMb.toFixed(1)}MB, cpu=${cpuPercent.toFixed(1)}%).`,
    );

    if (this.consecutiveResourceBreaches >= this.resourceBreachLimit) {
      this.log('Worker exceeded CPU/RAM policy repeatedly. Restarting worker only...');
      this.worker?.kill('SIGKILL');
    }
  }
}

if (require.main === module) {
  new ZavorthHost({
    resourceMemoryLimitMb: config.hostResourceMaxMemoryMb,
    resourceCpuLimitPercent: config.hostResourceMaxCpuPercent,
    resourceBreachLimit: config.hostResourceBreachLimit,
  }).start();
}
