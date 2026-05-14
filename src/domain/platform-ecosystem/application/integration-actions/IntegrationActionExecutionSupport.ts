import fs from 'fs';
import path from 'path';
import type { spawnCommand } from '../../../../core/CommandSpawn.js';
import { config } from '../../../../config/index.js';
import type {
  IntegrationActionPlan,
  IntegrationGuidedAction,
} from '../../../../contracts/IntegrationHubContract.js';
import type { IntegrationHealthService } from '../../../../services/IntegrationHealthService.js';
import type { IntegrationInstallerService } from '../../../../services/IntegrationInstallerService.js';
import type { IntegrationProbeService } from '../../../../services/IntegrationProbeService.js';
import type { IntegrationActionLedgerService } from './IntegrationActionLedgerService.js';
import type { IntegrationActionMonitorSupport } from './IntegrationActionMonitorSupport.js';
import type { IntegrationActionRecipeService } from './IntegrationActionRecipeService.js';
import type { IntegrationActionRuntimeBindingSupport } from './IntegrationActionRuntimeBindingSupport.js';
import type {
  IntegrationActionExecution,
  IntegrationActionExecutionContext,
  IntegrationActionManifestResolver,
} from './IntegrationActionTypes.js';

type IntegrationActionExecutionSupportRuntime = {
  now: () => Date;
  spawn: typeof spawnCommand;
  healthService: Pick<IntegrationHealthService, 'buildDoctorSnapshot'>;
  installerService: Pick<IntegrationInstallerService, 'recordHealthStatus'>;
  probeService: Pick<IntegrationProbeService, 'runProbe' | 'getLatestProbe'>;
  recipeService: Pick<IntegrationActionRecipeService, 'executeRecipeAction' | 'resolveCommand'>;
  ledgerService: Pick<IntegrationActionLedgerService, 'persistRecord'>;
  runtimeBindingSupport: Pick<IntegrationActionRuntimeBindingSupport, 'applyStoredSecretsToRuntime'>;
  monitorSupport: Pick<IntegrationActionMonitorSupport, 'buildBlockedRecord' | 'runAfterActionHook' | 'runBeforeActionHook' | 'trackBackgroundAction'>;
  actionLogDir: string;
  mkdirSync: typeof fs.mkdirSync;
  openSync: typeof fs.openSync;
  closeSync: typeof fs.closeSync;
  writeFileSync: typeof fs.writeFileSync;
};

export class IntegrationActionExecutionSupport {
  private readonly now: () => Date;
  private readonly spawnImpl: typeof spawnCommand;
  private readonly healthService: Pick<IntegrationHealthService, 'buildDoctorSnapshot'>;
  private readonly installerService: Pick<IntegrationInstallerService, 'recordHealthStatus'>;
  private readonly probeService: Pick<IntegrationProbeService, 'runProbe' | 'getLatestProbe'>;
  private readonly recipeService: Pick<IntegrationActionRecipeService, 'executeRecipeAction' | 'resolveCommand'>;
  private readonly ledgerService: Pick<IntegrationActionLedgerService, 'persistRecord'>;
  private readonly runtimeBindingSupport: Pick<IntegrationActionRuntimeBindingSupport, 'applyStoredSecretsToRuntime'>;
  private readonly monitorSupport: Pick<IntegrationActionMonitorSupport, 'buildBlockedRecord' | 'runAfterActionHook' | 'runBeforeActionHook' | 'trackBackgroundAction'>;
  private readonly actionLogDir: string;
  private readonly mkdirSyncImpl: typeof fs.mkdirSync;
  private readonly openSyncImpl: typeof fs.openSync;
  private readonly closeSyncImpl: typeof fs.closeSync;
  private readonly writeFileSyncImpl: typeof fs.writeFileSync;

  constructor(runtime: IntegrationActionExecutionSupportRuntime) {
    this.now = runtime.now;
    this.spawnImpl = runtime.spawn;
    this.healthService = runtime.healthService;
    this.installerService = runtime.installerService;
    this.probeService = runtime.probeService;
    this.recipeService = runtime.recipeService;
    this.ledgerService = runtime.ledgerService;
    this.runtimeBindingSupport = runtime.runtimeBindingSupport;
    this.monitorSupport = runtime.monitorSupport;
    this.actionLogDir = runtime.actionLogDir;
    this.mkdirSyncImpl = runtime.mkdirSync;
    this.openSyncImpl = runtime.openSync;
    this.closeSyncImpl = runtime.closeSync;
    this.writeFileSyncImpl = runtime.writeFileSync;
  }

  public async execute(
    plan: IntegrationActionPlan,
    actionId: string,
    context: IntegrationActionExecutionContext,
    resolveManifest: IntegrationActionManifestResolver,
  ): Promise<IntegrationActionExecution> {
    const action = plan.actions.find((entry) => entry.id === actionId);
    if (!action) {
      throw new Error(`Acao guiada desconhecida: ${actionId}`);
    }

    const integrationId = plan.integrationId;
    const beforeOk = await this.monitorSupport.runBeforeActionHook(integrationId, action, context);
    if (!beforeOk) {
      const blockedRecord = this.monitorSupport.buildBlockedRecord(integrationId, action);
      this.ledgerService.persistRecord(blockedRecord);
      return blockedRecord;
    }

    let result: IntegrationActionExecution;
    if (action.id === 'validate-now') {
      result = await this.executeValidationAction(integrationId, action);
    } else if (action.id === 'repair-runtime') {
      result = await this.executeRepairAction(integrationId, action, resolveManifest);
    } else {
      const recipeExecution = await this.recipeService.executeRecipeAction(integrationId, action);
      result = recipeExecution || this.executeCommandAction(integrationId, action, context);
    }

    if (result.status !== 'started') {
      await this.monitorSupport.runAfterActionHook(result, context);
    }

    return result;
  }

  private async executeValidationAction(
    integrationId: string,
    action: IntegrationGuidedAction,
  ): Promise<IntegrationActionExecution> {
    const startedAt = this.now().toISOString();
    const probe = await this.probeService.runProbe(integrationId);
    const doctor = this.healthService.buildDoctorSnapshot(integrationId);
    this.installerService.recordHealthStatus(integrationId, doctor.status);
    const record: IntegrationActionExecution = {
      executionId: this.buildExecutionId(integrationId, action.id, startedAt),
      integrationId,
      actionId: action.id,
      label: action.label,
      command: action.command || '',
      startedAt,
      finishedAt: startedAt,
      pid: null,
      logFile: '',
      status: doctor.status === 'ok' ? 'completed' : 'partial',
      note: doctor.status === 'ok'
        ? `Doctor atualizado e integracao considerada saudavel. ${probe.summary}.`
        : `${doctor.nextAction.reason || 'Doctor atualizado com pendencias restantes.'} ${probe.summary}.`,
      doctor,
      probe,
      appliedEnvKeys: [],
      exitCode: 0,
    };
    this.ledgerService.persistRecord(record);
    return record;
  }

  private async executeRepairAction(
    integrationId: string,
    action: IntegrationGuidedAction,
    resolveManifest: IntegrationActionManifestResolver,
  ): Promise<IntegrationActionExecution> {
    const manifest = resolveManifest(integrationId);
    if (!manifest) {
      throw new Error(`Integracao desconhecida: ${integrationId}`);
    }

    const startedAt = this.now().toISOString();
    const appliedEnvKeys = this.runtimeBindingSupport.applyStoredSecretsToRuntime(manifest);
    const probe = appliedEnvKeys.length > 0
      ? await this.probeService.runProbe(integrationId)
      : this.probeService.getLatestProbe(integrationId);
    const doctor = this.healthService.buildDoctorSnapshot(integrationId);
    this.installerService.recordHealthStatus(integrationId, doctor.status);

    const record: IntegrationActionExecution = {
      executionId: this.buildExecutionId(integrationId, action.id, startedAt),
      integrationId,
      actionId: action.id,
      label: action.label,
      command: action.command || '',
      startedAt,
      finishedAt: startedAt,
      pid: null,
      logFile: '',
      status: appliedEnvKeys.length === 0
        ? 'manual_only'
        : (doctor.status === 'ok' ? 'completed' : 'partial'),
      note: appliedEnvKeys.length === 0
        ? 'Nao encontrei configuracao guardada que pudesse ser aplicada automaticamente ao runtime.'
        : (doctor.status === 'ok'
          ? `Binding revalidado com sucesso apos aplicar ${appliedEnvKeys.join(', ')}. ${probe?.summary || ''}`.trim()
          : `Configuracao aplicada ao runtime (${appliedEnvKeys.join(', ')}), mas ainda restam pendencias. ${probe?.summary || ''}`.trim()),
      doctor,
      probe,
      appliedEnvKeys,
      exitCode: appliedEnvKeys.length === 0 ? null : 0,
    };
    this.ledgerService.persistRecord(record);
    return record;
  }

  private executeCommandAction(
    integrationId: string,
    action: IntegrationGuidedAction,
    context: IntegrationActionExecutionContext,
  ): IntegrationActionExecution {
    if (!action.executable || !action.command) {
      throw new Error(`A acao "${action.label}" exige um passo manual.`);
    }

    const resolved = this.recipeService.resolveCommand(action.command, integrationId);
    if (!resolved) {
      throw new Error(`A acao "${action.label}" nao esta liberada para execucao automatica.`);
    }

    this.mkdirSyncImpl(this.actionLogDir, { recursive: true });
    const startedAt = this.now().toISOString();
    const executionId = this.buildExecutionId(integrationId, action.id, startedAt);
    const logFile = path.join(this.actionLogDir, `${executionId}.log`);
    const lineBreak = process.platform === 'win32' ? '\r\n' : '\n';
    const logFd = this.openSyncImpl(logFile, 'a');
    this.writeFileSyncImpl(
      logFd,
      `[${startedAt}] Iniciando ${action.label}: ${resolved.command} ${resolved.args.join(' ')}${lineBreak}`,
      'utf8',
    );

    try {
      const child = this.spawnImpl(resolved.command, resolved.args, {
        cwd: config.projectRoot,
        env: process.env,
        detached: true,
        shell: false,
        stdio: ['ignore', logFd, logFd],
      });
      child.unref();
      this.closeSyncImpl(logFd);

      const record: IntegrationActionExecution = {
        executionId,
        integrationId,
        actionId: action.id,
        label: action.label,
        command: `${resolved.command} ${resolved.args.join(' ')}`.trim(),
        startedAt,
        pid: child.pid ?? null,
        logFile,
        status: 'started',
        note: 'Acao iniciada em background.',
      };
      this.ledgerService.persistRecord(record);
      this.monitorSupport.trackBackgroundAction(record, child, context);
      return record;
    } catch (error: any) {
      this.writeFileSyncImpl(
        logFd,
        `[${this.now().toISOString()}] Falha ao iniciar acao: ${error?.message || error}${lineBreak}`,
        'utf8',
      );
      this.closeSyncImpl(logFd);
      const record: IntegrationActionExecution = {
        executionId,
        integrationId,
        actionId: action.id,
        label: action.label,
        command: `${resolved.command} ${resolved.args.join(' ')}`.trim(),
        startedAt,
        pid: null,
        logFile,
        status: 'failed_to_start',
        note: error?.message || String(error),
      };
      this.ledgerService.persistRecord(record);
      return record;
    }
  }

  private buildExecutionId(integrationId: string, actionId: string, startedAt: string): string {
    return `${startedAt.replace(/[-:TZ.]/g, '').slice(0, 14)}-${integrationId}-${actionId}`;
  }
}
