
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { LogRepository } from '../storage/LogRepository.js';
import { OperationsActionService } from './OperationsActionService.js';
import { OperationsHealthService } from '../observability/OperationsHealthService.js';
import { logger } from '../logger.js';
import { asErrorLike, errorMessage } from '../utils/errorLike.js';
type MaintenanceAutomationRuntime = {
  now?: () => Date;
  setIntervalImpl?: typeof setInterval;
  clearIntervalImpl?: typeof clearInterval;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
  priorityCooldownMs?: number;
  operationsHealthService?: Pick<OperationsHealthService, 'readSnapshot'>;
};

export type MaintenanceAutomationStatus = {
  enabled: boolean;
  running: boolean;
  lastTriggeredAt: string | null;
  lastTriggeredDateKey: string | null;
  lastTriggerSource: 'automation' | 'manual' | 'priority' | null;
  lastPriorityReason: string | null;
  lastActionId: string | null;
  lastActionLogFile: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  note: string | null;
  nextPlannedAt: string | null;
};

type PersistedMaintenanceAutomationState = Omit<MaintenanceAutomationStatus, 'nextPlannedAt'>;

type PriorityDispatchPlan = {
  actionId: 'validate-node-mesh-smoke' | 'validate-channel-providers' | 'validate-remote-transports';
  note: string;
};

export class MaintenanceAutomationService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private state: PersistedMaintenanceAutomationState;
  private readonly now: () => Date;
  private readonly setIntervalImpl: typeof setInterval;
  private readonly clearIntervalImpl: typeof clearInterval;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly priorityCooldownMs: number;
  private readonly operationsHealthService: Pick<OperationsHealthService, 'readSnapshot'>;

  constructor(
    private readonly actionService: OperationsActionService,
    private readonly logRepo: LogRepository,
    private readonly stateFile: string = config.maintenanceAutomationStateFile,
    private readonly runHour: number = config.maintenanceAutomationHour,
    private readonly runMinute: number = config.maintenanceAutomationMinute,
    runtime: MaintenanceAutomationRuntime = {},
  ) {
    this.now = runtime.now || (() => new Date());
    this.setIntervalImpl = runtime.setIntervalImpl || setInterval;
    this.clearIntervalImpl = runtime.clearIntervalImpl || clearInterval;
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.priorityCooldownMs =
      Number(runtime.priorityCooldownMs || config.maintenanceAutomationPriorityCooldownMs) || 3_600_000;
    this.operationsHealthService =
      runtime.operationsHealthService ||
      new OperationsHealthService(this.logRepo);
    this.state = this.load();
  }

  public start(intervalMs: number = 300_000): void {
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

  public getStatus(): MaintenanceAutomationStatus {
    return {
      ...this.state,
      nextPlannedAt: this.computeNextPlannedAt(),
    };
  }

  public enable(updatedBy: string | null = null, note: string | null = null): MaintenanceAutomationStatus {
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

  public disable(updatedBy: string | null = null, note: string | null = null): MaintenanceAutomationStatus {
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

  public triggerNow(updatedBy: string | null = null, note: string | null = null): MaintenanceAutomationStatus {
    this.dispatch('manual', updatedBy, note || 'Disparo manual da manutencao recorrente.');
    return this.getStatus();
  }

  private async tick(): Promise<void> {
    if (!this.state.enabled || this.state.running) {
      return;
    }

    const now = this.now();
    const priorityDispatch = this.resolvePriorityDispatch(now);
    if (priorityDispatch) {
      this.dispatch('priority', null, priorityDispatch.note, priorityDispatch.actionId);
      return;
    }

    const currentDateKey = this.dateKey(now);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const plannedMinutes = this.runHour * 60 + this.runMinute;

    if (currentMinutes < plannedMinutes) {
      return;
    }

    if (this.state.lastTriggeredDateKey === currentDateKey) {
      return;
    }

    this.dispatch('automation', null, 'Execucao automatica da manutencao recorrente.');
  }

  private dispatch(
    source: 'automation' | 'manual' | 'priority',
    updatedBy: string | null,
    note: string | null,
    priorityActionId: PriorityDispatchPlan['actionId'] = 'validate-node-mesh-smoke',
  ): void {
    const now = this.now();
    const actionId = source === 'priority' ? priorityActionId : 'scheduled-maintenance';
    const isRecurringMaintenance = actionId === 'scheduled-maintenance';
    const priorityActionLabel = this.describePriorityAction(actionId);
    this.state = {
      ...this.state,
      running: true,
      updatedAt: now.toISOString(),
      updatedBy: updatedBy || this.state.updatedBy,
      note: note || this.state.note,
    };
    this.persist();

    try {
      const action = this.actionService.execute(actionId);
      this.state = {
        ...this.state,
        running: false,
        lastTriggeredAt: now.toISOString(),
        lastTriggeredDateKey: isRecurringMaintenance ? this.dateKey(now) : this.state.lastTriggeredDateKey,
        lastTriggerSource: source,
        lastPriorityReason: source === 'priority' ? (note || null) : null,
        lastActionId: action.id,
        lastActionLogFile: action.logFile,
        updatedAt: now.toISOString(),
        updatedBy: updatedBy || this.state.updatedBy,
        note: note || this.state.note,
      };
      this.persist();
      this.logRepo.log(
        'info',
        'MaintenanceAutomationService',
        `${isRecurringMaintenance ? 'Manutencao recorrente disparada' : `${priorityActionLabel} disparada`} (${source}).`,
        { actionId: action.id, logFile: action.logFile, pid: action.pid },
      );
    } catch (error: unknown) {
      const err = asErrorLike(error);
      this.state = {
        ...this.state,
        running: false,
        updatedAt: now.toISOString(),
        updatedBy: updatedBy || this.state.updatedBy,
        note: errorMessage(error),
      };
      this.persist();
      this.logRepo.log(
        'error',
        'MaintenanceAutomationService',
        `Falha ao disparar ${isRecurringMaintenance ? 'manutencao recorrente' : priorityActionLabel.toLowerCase()}: ${errorMessage(error)}`,
      );
    }
  }

  private resolvePriorityDispatch(now: Date): PriorityDispatchPlan | null {
    try {
      const health = this.operationsHealthService.readSnapshot();
      const nodeMeshSmoke = health.nodeMeshSmoke;
      const channelProviderDoctor = health.channelProviderDoctor;
      const remoteTransportDoctor = health.remoteTransportDoctor;

      const lastTriggeredAtMs = Date.parse(String(this.state.lastTriggeredAt || ''));
      if (
        Number.isFinite(lastTriggeredAtMs) &&
        (now.getTime() - lastTriggeredAtMs) < this.priorityCooldownMs
      ) {
        return null;
      }

      if (nodeMeshSmoke && nodeMeshSmoke.status !== 'running') {
        const needsNodeMeshPriorityRevalidation =
          nodeMeshSmoke.status === 'failed' ||
          nodeMeshSmoke.stale === true;

        if (needsNodeMeshPriorityRevalidation) {
          if (nodeMeshSmoke.status === 'failed') {
            return {
              actionId: 'validate-node-mesh-smoke',
              note: nodeMeshSmoke.error
                ? `Prioridade operacional: revalidar o Node Mesh apos falha no smoke real (${nodeMeshSmoke.error}).`
                : 'Prioridade operacional: revalidar o Node Mesh apos falha no smoke real.',
            };
          }

          return {
            actionId: 'validate-node-mesh-smoke',
            note: nodeMeshSmoke.checkedAt
              ? `Prioridade operacional: renovar o Node Mesh smoke vencido (ultimo relatorio em ${nodeMeshSmoke.checkedAt}).`
              : 'Prioridade operacional: renovar o Node Mesh smoke vencido.',
          };
        }
      }

      if (
        channelProviderDoctor &&
        channelProviderDoctor.status !== 'missing' &&
        channelProviderDoctor.status !== 'skipped'
      ) {
        const needsChannelPriorityRevalidation =
          channelProviderDoctor.status === 'failed' ||
          channelProviderDoctor.stale === true;

        if (needsChannelPriorityRevalidation) {
          if (channelProviderDoctor.status === 'failed') {
            return {
              actionId: 'validate-channel-providers',
              note: channelProviderDoctor.summary
                ? `Prioridade operacional: revalidar Slack native / WhatsApp Cloud API apos falha no doctor (${channelProviderDoctor.summary}).`
                : 'Prioridade operacional: revalidar Slack native / WhatsApp Cloud API apos falha no doctor.',
            };
          }

          return {
            actionId: 'validate-channel-providers',
            note: channelProviderDoctor.checkedAt
              ? `Prioridade operacional: renovar o doctor dos canais nativos vencido (ultimo relatorio em ${channelProviderDoctor.checkedAt}).`
              : 'Prioridade operacional: renovar o doctor dos canais nativos vencido.',
          };
        }
      }

      if (
        remoteTransportDoctor &&
        remoteTransportDoctor.status !== 'missing' &&
        remoteTransportDoctor.status !== 'skipped'
      ) {
        const needsRemoteTransportPriorityRevalidation =
          remoteTransportDoctor.status === 'failed' ||
          remoteTransportDoctor.stale === true;

        if (needsRemoteTransportPriorityRevalidation) {
          if (remoteTransportDoctor.status === 'failed') {
            return {
              actionId: 'validate-remote-transports',
              note: remoteTransportDoctor.summary
                ? `Prioridade operacional: revalidar os transportes remotos apos falha no doctor (${remoteTransportDoctor.summary}).`
                : 'Prioridade operacional: revalidar os transportes remotos apos falha no doctor.',
            };
          }

          return {
            actionId: 'validate-remote-transports',
            note: remoteTransportDoctor.checkedAt
              ? `Prioridade operacional: renovar o doctor dos transportes remotos vencido (ultimo relatorio em ${remoteTransportDoctor.checkedAt}).`
              : 'Prioridade operacional: renovar o doctor dos transportes remotos vencido.',
          };
        }
      }

      return null;
    } catch (error: unknown) {logger.warn('[Maintenance Automation] validation failed', error); return null; }
  }

  private describePriorityAction(actionId: string): string {
    if (actionId === 'validate-channel-providers') {
      return 'Revalidacao prioritaria dos canais nativos';
    }
    if (actionId === 'validate-remote-transports') {
      return 'Revalidacao prioritaria dos transportes remotos';
    }
    return actionId === 'validate-channel-providers'
      ? 'Revalidacao prioritaria dos canais nativos'
      : 'Revalidacao prioritaria do Node Mesh';
  }

  private dateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private computeNextPlannedAt(): string | null {
    if (!this.state.enabled) {
      return null;
    }

    const now = this.now();
    const next = new Date(now);
    next.setHours(this.runHour, this.runMinute, 0, 0);
    if (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    return next.toISOString();
  }

  private load(): PersistedMaintenanceAutomationState {
    if (!this.stateFile || !this.existsSync(this.stateFile)) {
      return {
        enabled: config.maintenanceAutomationEnabled,
        running: false,
        lastTriggeredAt: null,
        lastTriggeredDateKey: null,
        lastTriggerSource: null,
        lastPriorityReason: null,
        lastActionId: null,
        lastActionLogFile: null,
        updatedAt: null,
        updatedBy: null,
        note: null,
      };
    }

    try {
      const raw = this.readFileSync(this.stateFile, 'utf8');
      const parsed = JSON.parse(raw) as Partial<PersistedMaintenanceAutomationState>;
      return {
        enabled: parsed.enabled ?? config.maintenanceAutomationEnabled,
        running: false,
        lastTriggeredAt: parsed.lastTriggeredAt || null,
        lastTriggeredDateKey: parsed.lastTriggeredDateKey || null,
        lastTriggerSource:
          parsed.lastTriggerSource === 'automation' || parsed.lastTriggerSource === 'manual' || parsed.lastTriggerSource === 'priority'
            ? parsed.lastTriggerSource
            : null,
        lastPriorityReason: parsed.lastPriorityReason || null,
        lastActionId: parsed.lastActionId || null,
        lastActionLogFile: parsed.lastActionLogFile || null,
        updatedAt: parsed.updatedAt || null,
        updatedBy: parsed.updatedBy || null,
        note: parsed.note || null,
      };
    } catch (error: unknown) {logger.warn('[Maintenance Automation] parsing failed', error);
    return {
        enabled: config.maintenanceAutomationEnabled,
        running: false,
        lastTriggeredAt: null,
        lastTriggeredDateKey: null,
        lastTriggerSource: null,
        lastPriorityReason: null,
        lastActionId: null,
        lastActionLogFile: null,
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
    } catch (error: unknown) {// Ignore persistence failures and keep the in-memory state.
      logger.warn('[Maintenance Automation] filesystem operation failed', error);
    }
  }
}
