import fs from 'fs';
import type { spawnCommand } from '../../../../core/CommandSpawn.js';
import type {
  IntegrationActionMonitorSnapshot,
  IntegrationGuidedAction,
} from '../../../../contracts/IntegrationHubContract.js';
import type { IntegrationHealthService } from '../../../../services/IntegrationHealthService.js';
import type { IntegrationInstallerService } from '../../../../services/IntegrationInstallerService.js';
import type { ToolHookPipelineService } from '../../../../services/ToolHookPipelineService.js';
import type { IntegrationActionLedgerService } from './IntegrationActionLedgerService.js';
import { logger } from '../../../../logger';
import type {
IntegrationActionExecuteOptions,
  IntegrationActionExecution,
  IntegrationActionExecutionContext,
} from './IntegrationActionTypes.js';

type IntegrationActionMonitorSupportRuntime = {
  now: () => Date;
  defaultWorkspace?: string | null;
  hookPipeline: Pick<ToolHookPipelineService, 'run'>;
  healthService: Pick<IntegrationHealthService, 'buildDoctorSnapshot'>;
  installerService: Pick<IntegrationInstallerService, 'recordHealthStatus'>;
  ledgerService: Pick<IntegrationActionLedgerService, 'persistRecord' | 'readActionHistory' | 'readLatestAction' | 'readLogExcerpt'>;
  appendFileSync: typeof fs.appendFileSync;
};

export class IntegrationActionMonitorSupport {
  private readonly now: () => Date;
  private readonly defaultWorkspace: string | null;
  private readonly hookPipeline: Pick<ToolHookPipelineService, 'run'>;
  private readonly healthService: Pick<IntegrationHealthService, 'buildDoctorSnapshot'>;
  private readonly installerService: Pick<IntegrationInstallerService, 'recordHealthStatus'>;
  private readonly ledgerService: Pick<IntegrationActionLedgerService, 'persistRecord' | 'readActionHistory' | 'readLatestAction' | 'readLogExcerpt'>;
  private readonly appendFileSyncImpl: typeof fs.appendFileSync;

  constructor(runtime: IntegrationActionMonitorSupportRuntime) {
    this.now = runtime.now;
    this.defaultWorkspace = String(runtime.defaultWorkspace || '').trim() || null;
    this.hookPipeline = runtime.hookPipeline;
    this.healthService = runtime.healthService;
    this.installerService = runtime.installerService;
    this.ledgerService = runtime.ledgerService;
    this.appendFileSyncImpl = runtime.appendFileSync;
  }

  public resolveExecutionContext(options: IntegrationActionExecuteOptions = {}): IntegrationActionExecutionContext {
    return {
      workspace: this.normalizeWorkspace(options.workspace),
      requestedBy: String(options.requestedBy || '').trim() || null,
    };
  }

  public async runBeforeActionHook(
    integrationId: string,
    action: IntegrationGuidedAction,
    context: IntegrationActionExecutionContext,
  ): Promise<boolean> {
    const before = await this.hookPipeline.run({
      event: 'integration.before_action',
      workspace: context.workspace,
      context: {
        integrationId,
        actionId: action.id,
        label: action.label,
        requestedBy: context.requestedBy,
      },
    });
    return Boolean(before.ok);
  }

  public buildBlockedRecord(
    integrationId: string,
    action: IntegrationGuidedAction,
  ): IntegrationActionExecution {
    const startedAt = this.now().toISOString();
    return {
      executionId: `${startedAt.replace(/[-:TZ.]/g, '').slice(0, 14)}-${integrationId}-${action.id}`,
      integrationId,
      actionId: action.id,
      label: action.label,
      command: action.command || '',
      startedAt,
      finishedAt: startedAt,
      pid: null,
      logFile: '',
      status: 'blocked',
      note: 'Um hook bloqueou a acao desta integracao.',
      doctor: this.healthService.buildDoctorSnapshot(integrationId),
      appliedEnvKeys: [],
      exitCode: null,
    };
  }

  public buildActionMonitor(integrationId: string, limit = 5): IntegrationActionMonitorSnapshot {
    const recentActions = this.ledgerService.readActionHistory(integrationId, limit);
    const latestAction = recentActions[0] || this.ledgerService.readLatestAction(integrationId) || null;
    return {
      generatedAt: this.now().toISOString(),
      integrationId,
      latestAction,
      recentActions,
      logExcerpt: {
        logFile: latestAction?.logFile || null,
        lines: latestAction?.logFile ? this.ledgerService.readLogExcerpt(latestAction.logFile, 12) : [],
      },
    };
  }

  public trackBackgroundAction(
    record: IntegrationActionExecution,
    child: ReturnType<typeof spawnCommand>,
    context: IntegrationActionExecutionContext,
  ): void {
    child.once('exit', (code) => {
      const finishedAt = this.now().toISOString();
      const doctor =
        record.actionId === 'doctor:next' || record.command.includes('integrations:doctor')
          ? this.healthService.buildDoctorSnapshot(record.integrationId)
          : null;
      if (doctor) {
        this.installerService.recordHealthStatus(record.integrationId, doctor.status);
      }
      const exitCode = typeof code === 'number' ? code : null;
      const status: IntegrationActionExecution['status'] = exitCode === 0
        ? (doctor ? (doctor.status === 'ok' ? 'completed' : 'partial') : 'completed')
        : 'failed';
      const note = exitCode === 0
        ? (doctor?.nextAction?.reason || 'Acao guiada finalizada com sucesso.')
        : `A acao terminou com codigo ${String(exitCode ?? 'desconhecido')}.`;
      if (record.logFile) {
        this.appendFileSyncImpl(
          record.logFile,
          `[${finishedAt}] Finalizado com status ${status}${exitCode !== null ? ` (exit ${exitCode})` : ''}${process.platform === 'win32' ? '\r\n' : '\n'}`,
          'utf8',
        );
      }
      const finalizedRecord = {
        ...record,
        finishedAt,
        status,
        note,
        doctor,
        exitCode,
      };
      this.ledgerService.persistRecord(finalizedRecord);
      void this.runAfterActionHook(finalizedRecord, context);
    });
  }

  public async runAfterActionHook(
    record: IntegrationActionExecution,
    context: IntegrationActionExecutionContext,
  ): Promise<void> {
    try {
      await this.hookPipeline.run({
        event: 'integration.after_action',
        workspace: context.workspace,
        context: {
          integrationId: record.integrationId,
          actionId: record.actionId,
          label: record.label,
          status: record.status,
          ok: !['failed', 'failed_to_start', 'blocked'].includes(record.status),
          requestedBy: context.requestedBy,
        },
      });
    } catch (error) { // hooks de observabilidade nunca devem quebrar a finalizacao da acao logger.warn('[Integration Action Monitor] lifecycle operation failed', error); }
  }

  private normalizeWorkspace(value: string | null | undefined): string | null {
    const normalized = String(value || '').trim();
    if (normalized) {
      return normalized;
    }
    return this.defaultWorkspace || process.cwd();
  }
}
