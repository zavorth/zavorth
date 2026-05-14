import fs from 'fs';
import path from 'path';
import os from 'os';
import { config } from '../config/index.js';
import { TaskManager } from '../orchestrator/TaskManager.js';
import { StateMachine } from '../orchestrator/StateMachine.js';
import { SidecarStatusService, type SidecarStatusSummary } from './SidecarStatusService.js';
import { TenantRegistryService, type TenantRegistrySummary } from './TenantRegistryService.js';
import { LogRepository, type SystemLog } from '../storage/LogRepository.js';
import type { Task } from '../contracts/TaskContract.js';

type RuntimeDiagnosticsRuntime = {
  hostLockFilePath?: string;
  workerLockFilePath?: string;
  discordBridgeStatusFilePath?: string;
  tenantRegistryFilePath?: string;
  now?: () => Date;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
  kill?: (pid: number, signal?: number | NodeJS.Signals) => void;
  setIntervalImpl?: typeof setInterval;
  clearIntervalImpl?: typeof clearInterval;
};

type LockSnapshot = {
  active: boolean;
  pid: number | null;
  owner: string | null;
  startedAt: string | null;
  alive: boolean;
  file: string;
};

type BridgeSnapshot = {
  mode: 'bridge' | 'native' | 'unknown';
  enabled: boolean;
  started: boolean;
  pendingInbox: number;
  pendingOutbox: number;
  lastError: string | null;
  updatedAt: string | null;
  file: string;
};

export type RuntimeDiagnosticsSnapshot = {
  generatedAt: string;
  process: {
    uptimeSeconds: number;
    rssMb: number;
    heapMb: number;
    platform: string;
    cpuArch: string;
  };
  runtime: {
    hostSupervisor: LockSnapshot;
    telegramWorker: LockSnapshot;
    discordBridge: BridgeSnapshot;
  };
  tenants: TenantRegistrySummary & {
    file: string;
  };
  sidecars: SidecarStatusSummary;
  tasks: {
    activeCount: number;
    staleCount: number;
    byStatus: Record<string, number>;
    latestBySource: Record<string, {
      taskId: string;
      status: string;
      commandType: string;
      updatedAt: string;
    }>;
    recentFailures: Array<{
      taskId: string;
      executor: string | null;
      commandType: string;
      updatedAt: string;
      errorSummary: string | null;
    }>;
  };
  logs: {
    lastError: {
      timestamp: string;
      level: string;
      category: string;
      message: string;
    } | null;
  };
};

export class RuntimeDiagnosticsService {
  private static readonly ACTIVE_TASK_STALE_MS = 6 * 60 * 60 * 1000;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly now: () => Date;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly existsSync: typeof fs.existsSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly killFn: (pid: number, signal?: number | NodeJS.Signals) => void;
  private readonly setIntervalImpl: typeof setInterval;
  private readonly clearIntervalImpl: typeof clearInterval;
  private readonly hostLockFilePath: string;
  private readonly workerLockFilePath: string;
  private readonly discordBridgeStatusFilePath: string;
  private readonly tenantRegistryFilePath: string;
  private readonly sidecarStatus = new SidecarStatusService();
  private readonly tenantRegistry: TenantRegistryService;

  constructor(
    private readonly taskManager: TaskManager,
    private readonly logRepo: LogRepository,
    private readonly diagnosticsFilePath: string = config.runtimeDiagnosticsFile,
    runtime: RuntimeDiagnosticsRuntime = {},
  ) {
    this.now = runtime.now || (() => new Date());
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.killFn = runtime.kill || process.kill.bind(process);
    this.setIntervalImpl = runtime.setIntervalImpl || setInterval;
    this.clearIntervalImpl = runtime.clearIntervalImpl || clearInterval;
    this.hostLockFilePath = runtime.hostLockFilePath || config.hostSupervisorLockFile;
    this.workerLockFilePath = runtime.workerLockFilePath || config.telegramProcessLockFile;
    this.discordBridgeStatusFilePath = runtime.discordBridgeStatusFilePath || config.discordBridgeStatusFile;
    this.tenantRegistryFilePath = runtime.tenantRegistryFilePath || config.tenantRegistryStateFile;
    this.tenantRegistry = new TenantRegistryService({
      filePath: this.tenantRegistryFilePath,
      now: this.now,
      existsSync: this.existsSync,
      readFileSync: this.readFileSync,
      writeFileSync: this.writeFileSync,
      mkdirSync: this.mkdirSync,
    });
  }

  public start(intervalMs: number = 30_000): void {
    this.stop();
    this.writeSnapshot();
    this.timer = this.setIntervalImpl(() => {
      this.writeSnapshot();
    }, intervalMs);
    this.timer.unref?.();
  }

  public stop(): void {
    if (!this.timer) {
      return;
    }

    this.clearIntervalImpl(this.timer);
    this.timer = null;
  }

  public buildSnapshot(): RuntimeDiagnosticsSnapshot {
    const memory = process.memoryUsage();
    const recentTasks = this.taskManager.getRecentTasks(50);
    const pendingTasks = this.taskManager.getPendingTasks();
    const activeTasks = pendingTasks.filter((task) => !this.isStaleActiveTask(task));
    const recentLogs = this.logRepo.getRecentLogs(50);
    const byStatus = activeTasks.reduce<Record<string, number>>((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {});

    return {
      generatedAt: this.now().toISOString(),
      process: {
        uptimeSeconds: Math.floor(process.uptime()),
        rssMb: Math.round(memory.rss / 1024 / 1024),
        heapMb: Math.round(memory.heapUsed / 1024 / 1024),
        platform: os.platform(),
        cpuArch: os.arch(),
      },
      runtime: {
        hostSupervisor: this.readLockSnapshot(this.hostLockFilePath),
        telegramWorker: this.readLockSnapshot(this.workerLockFilePath),
        discordBridge: this.readBridgeSnapshot(this.discordBridgeStatusFilePath),
      },
      tenants: {
        ...this.tenantRegistry.summarize(),
        file: this.tenantRegistryFilePath,
      },
      sidecars: this.sidecarStatus.readSummary(),
      tasks: {
        activeCount: activeTasks.length,
        staleCount: Math.max(0, pendingTasks.length - activeTasks.length),
        byStatus,
        latestBySource: this.collectLatestBySource(recentTasks),
        recentFailures: this.collectRecentFailures(recentTasks),
      },
      logs: {
        lastError: this.findLastError(recentLogs),
      },
    };
  }

  public writeSnapshot(): RuntimeDiagnosticsSnapshot {
    const snapshot = this.buildSnapshot();
    this.mkdirSync(path.dirname(this.diagnosticsFilePath), { recursive: true });
    this.writeFileSync(this.diagnosticsFilePath, JSON.stringify(snapshot, null, 2), 'utf8');
    return snapshot;
  }

  private readLockSnapshot(filePath: string): LockSnapshot {
    if (!this.existsSync(filePath)) {
      return {
        active: false,
        pid: null,
        owner: null,
        startedAt: null,
        alive: false,
        file: filePath,
      };
    }

    try {
      const raw = JSON.parse(this.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
      const pid = Number(raw.pid || 0) || null;
      const alive = pid ? this.isProcessAlive(pid) : false;
      return {
        active: true,
        pid,
        owner: typeof raw.owner === 'string' ? raw.owner : null,
        startedAt: typeof raw.startedAt === 'string' ? raw.startedAt : null,
        alive,
        file: filePath,
      };
    } catch {
      return {
        active: true,
        pid: null,
        owner: null,
        startedAt: null,
        alive: false,
        file: filePath,
      };
    }
  }

  private isProcessAlive(pid: number): boolean {
    try {
      this.killFn(pid, 0);
      return true;
    } catch (error: any) {
      return error?.code !== 'ESRCH';
    }
  }

  private readBridgeSnapshot(filePath: string): BridgeSnapshot {
    if (!this.existsSync(filePath)) {
      return {
        mode: config.discordBotToken ? 'native' : config.discordBridgeEnabled ? 'bridge' : 'unknown',
        enabled: false,
        started: false,
        pendingInbox: 0,
        pendingOutbox: 0,
        lastError: null,
        updatedAt: null,
        file: filePath,
      };
    }

    try {
      const raw = JSON.parse(this.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
      const mode =
        raw.mode === 'native' || raw.mode === 'bridge'
          ? raw.mode
          : config.discordBotToken
            ? 'native'
            : config.discordBridgeEnabled
              ? 'bridge'
              : 'unknown';
      const expectedMode = config.discordBotToken ? 'native' : config.discordBridgeEnabled ? 'bridge' : mode;
      const modeMismatch = expectedMode !== 'unknown' && mode !== expectedMode;
      return {
        mode: expectedMode,
        enabled: raw.enabled === true,
        started: !modeMismatch && raw.started === true,
        pendingInbox: Number(raw.pendingInbox || 0) || 0,
        pendingOutbox: Number(raw.pendingOutbox || 0) || 0,
        lastError: modeMismatch
          ? `Discord status snapshot belongs to ${mode} mode, but ${expectedMode} mode is configured.`
          : typeof raw.lastError === 'string'
            ? raw.lastError
            : null,
        updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
        file: filePath,
      };
    } catch {
      return {
        mode: config.discordBotToken ? 'native' : config.discordBridgeEnabled ? 'bridge' : 'unknown',
        enabled: false,
        started: false,
        pendingInbox: 0,
        pendingOutbox: 0,
        lastError: null,
        updatedAt: null,
        file: filePath,
      };
    }
  }

  private collectLatestBySource(tasks: Task[]): RuntimeDiagnosticsSnapshot['tasks']['latestBySource'] {
    const latestBySource: RuntimeDiagnosticsSnapshot['tasks']['latestBySource'] = {};

    for (const task of tasks) {
      if (!latestBySource[task.source]) {
        latestBySource[task.source] = {
          taskId: task.task_id,
          status: task.status,
          commandType: task.command_type,
          updatedAt: task.updated_at,
        };
      }
    }

    return latestBySource;
  }

  private collectRecentFailures(tasks: Task[]): RuntimeDiagnosticsSnapshot['tasks']['recentFailures'] {
    return tasks
      .filter((task) => StateMachine.isTerminal(task.status) && task.status !== 'completed')
      .slice(0, 5)
      .map((task) => ({
        taskId: task.task_id,
        executor: task.executor_used,
        commandType: task.command_type,
        updatedAt: task.updated_at,
        errorSummary: task.error_summary || task.result_summary || null,
      }));
  }

  private isStaleActiveTask(task: Task): boolean {
    const updatedAt = Date.parse(String(task.updated_at || ''));
    if (!Number.isFinite(updatedAt)) {
      return false;
    }

    return this.now().getTime() - updatedAt > RuntimeDiagnosticsService.ACTIVE_TASK_STALE_MS;
  }

  private findLastError(logs: SystemLog[]): RuntimeDiagnosticsSnapshot['logs']['lastError'] {
    const entry = logs.find((log) => log.level === 'error' || log.level === 'security');
    if (!entry) {
      return null;
    }

    return {
      timestamp: entry.timestamp || '',
      level: entry.level,
      category: entry.category,
      message: entry.message,
    };
  }
}
