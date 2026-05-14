import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type { PermissionService } from './PermissionService.js';
import type {
  OperationsReportOverviewReaders,
  OperationsReportService,
} from '../observability/OperationsReportService.js';
import type { RuntimeDiagnosticsService, RuntimeDiagnosticsSnapshot } from './RuntimeDiagnosticsService.js';
import type { TaskManager } from '../orchestrator/TaskManager.js';
import type { Task } from '../contracts/TaskContract.js';

type ReportBroadcaster = (message: string, roles?: string[]) => Promise<void>;

type DailyReportRuntime = {
  now?: () => Date;
  setIntervalImpl?: typeof setInterval;
  clearIntervalImpl?: typeof clearInterval;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
  reportBuilder?: OperationsReportService;
  reportOverviewReaders?: OperationsReportOverviewReaders | null;
};

export type DailyReportStatus = {
  enabled: boolean;
  lastSentAt: string | null;
  lastSentDateKey: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  note: string | null;
  nextPlannedAt: string | null;
};

type PersistedDailyReportState = Omit<DailyReportStatus, 'nextPlannedAt'>;

export class DailyReportService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private broadcaster: ReportBroadcaster | null = null;
  private state: PersistedDailyReportState;
  private readonly now: () => Date;
  private readonly setIntervalImpl: typeof setInterval;
  private readonly clearIntervalImpl: typeof clearInterval;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly reportBuilder: OperationsReportService | null;
  private readonly reportOverviewReaders: OperationsReportOverviewReaders | null;

  constructor(
    private readonly taskManager: TaskManager,
    private readonly logRepo: { getRecentLogs(limit?: number): any[] },
    private readonly permissionService: PermissionService,
    private readonly runtimeDiagnostics: RuntimeDiagnosticsService,
    private readonly stateFile: string = config.dailyReportStateFile,
    private readonly reportHour: number = config.dailyReportHour,
    private readonly reportMinute: number = config.dailyReportMinute,
    private readonly defaultRoles: string[] = config.dailyReportRoles,
    runtime: DailyReportRuntime = {},
  ) {
    this.now = runtime.now || (() => new Date());
    this.setIntervalImpl = runtime.setIntervalImpl || setInterval;
    this.clearIntervalImpl = runtime.clearIntervalImpl || clearInterval;
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.reportBuilder = runtime.reportBuilder || null;
    this.reportOverviewReaders = runtime.reportOverviewReaders || null;
    this.state = this.load();
    if (this.state.updatedAt === null && config.dailyReportEnabled !== this.state.enabled) {
      this.state.enabled = config.dailyReportEnabled;
      this.persist();
    }
  }

  public start(broadcaster: ReportBroadcaster, intervalMs: number = 300_000): void {
    this.broadcaster = broadcaster;
    this.stop();
    this.timer = this.setIntervalImpl(() => {
      void this.tick();
    }, intervalMs);
    this.timer.unref?.();
    void this.tick();
  }

  public stop(): void {
    if (!this.timer) {
      return;
    }

    this.clearIntervalImpl(this.timer);
    this.timer = null;
  }

  public getStatus(): DailyReportStatus {
    return {
      ...this.state,
      nextPlannedAt: this.computeNextPlannedAt(),
    };
  }

  public enable(updatedBy: string | null = null, note: string | null = null): DailyReportStatus {
    this.state = {
      ...this.state,
      enabled: true,
      updatedAt: this.now().toISOString(),
      updatedBy: updatedBy || null,
      note: note || null,
    };
    this.persist();
    return this.getStatus();
  }

  public disable(updatedBy: string | null = null, note: string | null = null): DailyReportStatus {
    this.state = {
      ...this.state,
      enabled: false,
      updatedAt: this.now().toISOString(),
      updatedBy: updatedBy || null,
      note: note || null,
    };
    this.persist();
    return this.getStatus();
  }

  public async sendNow(updatedBy: string | null = null): Promise<{ sent: boolean; message: string }> {
    if (!this.broadcaster) {
      return { sent: false, message: 'Broadcast do relatorio diario ainda nao esta conectado.' };
    }

    const report = await this.buildReport();
    await this.broadcaster(report, this.defaultRoles);
    this.state = {
      ...this.state,
      lastSentAt: this.now().toISOString(),
      lastSentDateKey: this.dateKey(this.now()),
      updatedAt: this.now().toISOString(),
      updatedBy: updatedBy || this.state.updatedBy,
      note: updatedBy ? 'Envio manual do relatorio diario.' : this.state.note,
    };
    this.persist();
    return { sent: true, message: 'Relatorio diario enviado agora.' };
  }

  public async buildReport(referenceDate: Date = this.now()): Promise<string> {
    if (this.reportBuilder) {
      if (this.reportOverviewReaders) {
        return this.reportBuilder.buildTextReport(referenceDate, this.reportOverviewReaders);
      }
      return this.reportBuilder.buildTextReport(referenceDate);
    }

    const snapshot = this.runtimeDiagnostics.buildSnapshot();
    const recentTasks = this.taskManager.getRecentTasks(120);
    const last24h = this.filterTasksSince(recentTasks, new Date(referenceDate.getTime() - 24 * 60 * 60 * 1000));
    const pendingPermissions = await this.permissionService.listRequests('pending', 20);
    const completedCount = last24h.filter((task) => task.status === 'completed').length;
    const failedCount = last24h.filter((task) => ['failed', 'rejected', 'cancelled'].includes(task.status)).length;
    const approvalCount = last24h.filter((task) => task.status === 'waiting_approval').length;
    const activeCount = snapshot.tasks.activeCount;
    const executorSummary = this.buildExecutorSummary(last24h);
    const recentFailures = snapshot.tasks.recentFailures.slice(0, 3);

    const lines = [
      'Resumo diario do Zavorth',
      '',
      `Gerado em: ${referenceDate.toISOString()}`,
      `Modo operador: ${this.readOperatorMode(snapshot)}`,
      `Tasks ativas agora: ${activeCount}`,
      `Ultimas 24h: ${completedCount} concluidas | ${failedCount} com falha | ${approvalCount} aguardando aprovacao`,
      `Permissoes pendentes agora: ${pendingPermissions.length}`,
      executorSummary ? `Executores mais usados nas ultimas 24h: ${executorSummary}` : null,
      '',
      'Saude do runtime:',
      `- Host supervisor: ${snapshot.runtime.hostSupervisor.alive ? 'online' : 'offline'} (${snapshot.runtime.hostSupervisor.pid || 'n/a'})`,
      `- Worker Telegram: ${snapshot.runtime.telegramWorker.alive ? 'online' : 'offline'} (${snapshot.runtime.telegramWorker.pid || 'n/a'})`,
      `- Memoria atual: RSS ${snapshot.process.rssMb} MB | heap ${snapshot.process.heapMb} MB`,
      '',
      recentFailures.length > 0 ? 'Falhas relevantes:' : 'Falhas relevantes: nenhuma nova nas tasks recentes.',
      ...(
        recentFailures.length > 0
          ? recentFailures.map((failure) =>
              `- ${failure.executor || failure.commandType}: task ${failure.taskId.substring(0, 8)} | ${String(failure.errorSummary || 'sem resumo').substring(0, 110)}`,
            )
          : []
      ),
      '',
      pendingPermissions.length > 0 ? 'Permissoes pendentes:' : 'Permissoes pendentes: nenhuma.',
      ...(
        pendingPermissions.length > 0
          ? pendingPermissions.slice(0, 3).map((permission) =>
              `- ${permission.executor}/${permission.kind}: ${String(permission.reason || '').substring(0, 110)}`,
            )
          : []
      ),
    ].filter(Boolean);

    return lines.join('\n');
  }

  private async tick(): Promise<void> {
    if (!this.state.enabled || !this.broadcaster) {
      return;
    }

    const now = this.now();
    const currentDateKey = this.dateKey(now);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const plannedMinutes = this.reportHour * 60 + this.reportMinute;
    if (currentMinutes < plannedMinutes) {
      return;
    }

    if (this.state.lastSentDateKey === currentDateKey) {
      return;
    }

    const report = await this.buildReport(now);
    await this.broadcaster(report, this.defaultRoles);
    this.state = {
      ...this.state,
      lastSentAt: now.toISOString(),
      lastSentDateKey: currentDateKey,
      updatedAt: this.state.updatedAt,
      updatedBy: this.state.updatedBy,
      note: this.state.note,
    };
    this.persist();
  }

  private filterTasksSince(tasks: Task[], since: Date): Task[] {
    const cutoff = since.getTime();
    return tasks.filter((task) => {
      const updatedAt = Date.parse(String(task.updated_at || ''));
      return Number.isFinite(updatedAt) && updatedAt >= cutoff;
    });
  }

  private buildExecutorSummary(tasks: Task[]): string {
    const counts = new Map<string, number>();
    for (const task of tasks) {
      const key = String(task.executor_used || task.command_type || 'desconhecido').trim();
      if (!key) {
        continue;
      }
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([executor, count]) => `${executor}:${count}`)
      .join(' | ');
  }

  private readOperatorMode(snapshot: RuntimeDiagnosticsSnapshot): string {
    const note = snapshot.tasks.byStatus.waiting_approval > 0 ? 'com checkpoints ativos' : 'inativo ou sem checkpoints';
    return note;
  }

  private dateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private computeNextPlannedAt(): string | null {
    const now = this.now();
    const next = new Date(now);
    next.setHours(this.reportHour, this.reportMinute, 0, 0);
    if (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    return next.toISOString();
  }

  private load(): PersistedDailyReportState {
    if (!this.stateFile || !this.existsSync(this.stateFile)) {
      return {
        enabled: config.dailyReportEnabled,
        lastSentAt: null,
        lastSentDateKey: null,
        updatedAt: null,
        updatedBy: null,
        note: null,
      };
    }

    try {
      const raw = this.readFileSync(this.stateFile, 'utf8');
      const parsed = JSON.parse(raw) as Partial<PersistedDailyReportState>;
      return {
        enabled: Boolean(parsed.enabled),
        lastSentAt: parsed.lastSentAt || null,
        lastSentDateKey: parsed.lastSentDateKey || null,
        updatedAt: parsed.updatedAt || null,
        updatedBy: parsed.updatedBy || null,
        note: parsed.note || null,
      };
    } catch {
      return {
        enabled: config.dailyReportEnabled,
        lastSentAt: null,
        lastSentDateKey: null,
        updatedAt: null,
        updatedBy: null,
        note: null,
      };
    }
  }

  private persist(): void {
    try {
      this.mkdirSync(path.dirname(this.stateFile), { recursive: true });
      this.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2), 'utf8');
    } catch {
      // Ignore persistence failures and keep the in-memory state.
    }
  }
}
