import type {
  IntegrationActionExecutionRecord,
  IntegrationDoctorSnapshot,
  IntegrationGuidedAction,
  IntegrationInstallStep,
  IntegrationManifest,
} from '../../../../contracts/IntegrationHubContract.js';
import { config } from '../../../../config/index.js';

import { AIGatewaySidecarService } from '../../../../services/AIGatewaySidecarService.js';
import { ZavorthBridgeRemoteUpstreamSyncService } from '../../../../services/ZavorthBridgeRemoteUpstreamSyncService.js';
import { GatewayUpstreamSyncService } from '../../../../services/GatewayUpstreamSyncService.js';
import { IntegrationHealthService } from '../../../../services/IntegrationHealthService.js';
import { IntegrationInstallerService } from '../../../../services/IntegrationInstallerService.js';
import { IntegrationProbeService } from '../../../../services/IntegrationProbeService.js';
import { TerminalSidecarService } from '../../../../services/TerminalSidecarService.js';
import type { IntegrationActionLedgerService } from './IntegrationActionLedgerService.js';
import { asErrorLike, errorMessage } from '../../../../utils/errorLike.js';
type VendorUpstreamRecipeReport = {
  ok: boolean;
  action: string;
  summary: string;
  status: string;
  command: string;
  compat?: unknown;
  doctor?: unknown;
  error: string | null;
};

export type ResolvedIntegrationCommand = {
  command: string;
  args: string[];
};

export type IntegrationActionRecipeRuntime = {
  installerService: IntegrationInstallerService;
  healthService: IntegrationHealthService;
  probeService: IntegrationProbeService;
  ledgerService: Pick<IntegrationActionLedgerService, 'persistRecord'>;
  applyRuntimeBinding?: (envKey: string, value: string) => void;
  now?: () => Date;
  TerminalSidecarService?: Pick<TerminalSidecarService, 'start'>;
  AIGatewaySidecarService?: Pick<AIGatewaySidecarService, 'start'>;
  zavorthBridgeRemoteUpstreamSyncService?: Pick<ZavorthBridgeRemoteUpstreamSyncService, 'sync' | 'promote' | 'rollback'>;
  GatewayUpstreamSyncService?: Pick<GatewayUpstreamSyncService, 'sync' | 'promote' | 'rollback'>;
};

type IntegrationActionExecution = IntegrationActionExecutionRecord;

export class IntegrationActionRecipeService {
  private readonly now: () => Date;
  private readonly installerService: IntegrationInstallerService;
  private readonly healthService: IntegrationHealthService;
  private readonly probeService: IntegrationProbeService;
  private readonly ledgerService: Pick<IntegrationActionLedgerService, 'persistRecord'>;
  private readonly applyRuntimeBinding: (envKey: string, value: string) => void;
  private readonly terminalSidecarService: Pick<TerminalSidecarService, 'start'>;
  private readonly aiGatewaySidecarService: Pick<AIGatewaySidecarService, 'start'>;
  private readonly zavorthBridgeRemoteUpstreamSyncService: Pick<ZavorthBridgeRemoteUpstreamSyncService, 'sync' | 'promote' | 'rollback'>;
  private readonly gatewayUpstreamSyncService: Pick<GatewayUpstreamSyncService, 'sync' | 'promote' | 'rollback'>;

  constructor(runtime: IntegrationActionRecipeRuntime) {
    this.now = runtime.now || (() => new Date());
    this.installerService = runtime.installerService;
    this.healthService = runtime.healthService;
    this.probeService = runtime.probeService;
    this.ledgerService = runtime.ledgerService;
    this.applyRuntimeBinding = runtime.applyRuntimeBinding || (() => {});
    this.terminalSidecarService = runtime.TerminalSidecarService || new TerminalSidecarService();
    this.aiGatewaySidecarService = runtime.AIGatewaySidecarService || new AIGatewaySidecarService();
    this.zavorthBridgeRemoteUpstreamSyncService =
      runtime.zavorthBridgeRemoteUpstreamSyncService || new ZavorthBridgeRemoteUpstreamSyncService();
    this.gatewayUpstreamSyncService =
      runtime.GatewayUpstreamSyncService || new GatewayUpstreamSyncService();
  }

  public buildRecipeActions(
    manifest: IntegrationManifest,
    doctor: IntegrationDoctorSnapshot,
  ): IntegrationGuidedAction[] {
    const actions: IntegrationGuidedAction[] = [];

    if (manifest.id === 'AIGateway' && config.AIGatewaySidecarEnabled && doctor.status !== 'ok') {
      actions.push({
        id: 'recipe:AIGateway:start-sidecar',
        label: 'Start AIGateway sidecar',
        description: 'Starts the local gateway, installs dependencies if needed, and waits for the endpoint to respond.',
        command: null,
        executable: true,
        manualOnly: false,
        kind: 'recipe',
        severity: 'primary',
        blocking: true,
        impact: {
          level: 'starts_local_service',
          summary: 'Starts the local AIGateway on the host.',
          details: [
            'Can install local worktree dependencies if they are missing.',
            'Starts the AIGateway sidecar and waits for the endpoint to respond.',
            'Writes a local sidecar log and revalidates the real probe.',
          ],
          requiresConfirmation: true,
        },
      });
    }

    if (manifest.id === 'zavorth-terminal' && config.ZavorthTerminalSidecarEnabled && doctor.status !== 'ok') {
      actions.push({
        id: 'recipe:zavorth-bridge-remote:start-sidecar',
        label: 'Start ZavorthBridge Remote sidecar',
        description: 'Starts the official ZavorthBridge remote sidecar, installs dependencies if needed, and waits for health to respond.',
        command: null,
        executable: true,
        manualOnly: false,
        kind: 'recipe',
        severity: 'primary',
        blocking: true,
        impact: {
          level: 'starts_local_service',
          summary: 'Starts the ZavorthBridge remote sidecar on the host.',
          details: [
            'Can install local worktree dependencies if they are missing.',
            'Starts the official ZavorthBridge remote sidecar and waits for health to respond.',
            'Writes a local sidecar log and revalidates the real doctor/probe.',
          ],
          requiresConfirmation: true,
        },
      });
    }

    if (manifest.id === 'AIGateway') {
      actions.push({
        id: 'recipe:AIGateway:sync-upstream',
        label: 'Sync AIGateway upstream',
        description: 'Inspects the vendor AIGateway state and updates the safe sync report.',
        command: null,
        executable: true,
        manualOnly: false,
        kind: 'recipe',
        severity: 'recommended',
        blocking: false,
        impact: {
          level: 'read_only',
          summary: 'Safe inspection of the vendored AIGateway upstream.',
          details: [
            'Runs vendor-toolkit in status mode for target AIGateway.',
            'Updates the persisted upstream sync report without promoting changes.',
          ],
          requiresConfirmation: false,
        },
      });
      actions.push({
        id: 'recipe:AIGateway:promote-upstream',
        label: 'Promote AIGateway upstream',
        description: 'Updates the AIGateway vendor, restarts the sidecar, and revalidates Zavorth gateway compatibility.',
        command: null,
        executable: true,
        manualOnly: false,
        kind: 'recipe',
        severity: doctor.status === 'ok' ? 'recommended' : 'primary',
        blocking: true,
        impact: {
          level: 'writes_runtime',
          summary: 'Updates the AIGateway vendor and revalidates Zavorth-owned gateway compatibility.',
          details: [
            'Runs vendor-toolkit update for target AIGateway.',
            'Restarts the AIGateway sidecar and runs the compatibility doctor.',
            'Applies automatic rollback if compatibility fails.',
          ],
          requiresConfirmation: true,
        },
      });
      actions.push({
        id: 'recipe:AIGateway:rollback-upstream',
        label: 'Rollback of the upstream AIGateway',
        description: 'Restores the previous AIGateway vendor lock and revalidates Zavorth-owned gateway compatibility.',
        command: null,
        executable: true,
        manualOnly: false,
        kind: 'recipe',
        severity: 'recommended',
        blocking: true,
        impact: {
          level: 'writes_runtime',
          summary: 'Restores the AIGateway vendor to the previous known revision.',
          details: [
            'Runs vendor-toolkit rollback for target AIGateway.',
            'Restarts the sidecar and runs the compatibility doctor.',
          ],
          requiresConfirmation: true,
        },
      });
    }

    if (manifest.id === 'zavorth-terminal') {
      actions.push({
        id: 'recipe:zavorth-bridge-remote:sync-upstream',
        label: 'Sync ZavorthBridge Remote upstream',
        description: 'Inspects the vendor ZavorthBridge Remote state and updates the safe sync report.',
        command: null,
        executable: true,
        manualOnly: false,
        kind: 'recipe',
        severity: 'recommended',
        blocking: false,
        impact: {
          level: 'read_only',
          summary: 'Safe inspection of the vendored ZavorthBridge Remote upstream.',
          details: [
            'Runs vendor-toolkit in status mode for target zavorth-terminal.',
            'Updates the persisted upstream sync report without promoting changes.',
          ],
          requiresConfirmation: false,
        },
      });
      actions.push({
        id: 'recipe:zavorth-bridge-remote:promote-upstream',
        label: 'Promote ZavorthBridge Remote upstream',
        description: 'Updates the ZavorthBridge Remote vendor, restarts the sidecar, and revalidates the remote doctor.',
        command: null,
        executable: true,
        manualOnly: false,
        kind: 'recipe',
        severity: doctor.status === 'ok' ? 'recommended' : 'primary',
        blocking: true,
        impact: {
          level: 'writes_runtime',
          summary: 'Updates the ZavorthBridge Remote vendor and revalidates the official Zavorth remote.',
          details: [
            'Runs vendor-toolkit update for target zavorth-terminal.',
            'Reinicia o sidecar remote oficial and executa o doctor of the ZavorthBridge.',
            'Applies automatic rollback if the doctor fails after promotion.',
          ],
          requiresConfirmation: true,
        },
      });
      actions.push({
        id: 'recipe:zavorth-bridge-remote:rollback-upstream',
        label: 'Rollback of the upstream ZavorthBridge Remote',
        description: 'Restaura o lock anterior of the vendor ZavorthBridge Remote and revalida o doctor remote.',
        command: null,
        executable: true,
        manualOnly: false,
        kind: 'recipe',
        severity: 'recommended',
        blocking: true,
        impact: {
          level: 'writes_runtime',
          summary: 'Restores the ZavorthBridge Remote vendor to the previous known revision.',
          details: [
            'Runs vendor-toolkit rollback for target zavorth-terminal.',
            'Reinicia o sidecar remote and executa o doctor of the ZavorthBridge.',
          ],
          requiresConfirmation: true,
        },
      });
    }

    if (manifest.id === 'ollama' && !this.resolveOllamaHost()) {
      actions.push({
        id: 'recipe:ollama:prepare-host',
        label: 'Prepare local Ollama host',
        description: 'Configures the default local Ollama endpoint so Zavorth can validate the installation.',
        command: null,
        executable: true,
        manualOnly: false,
        kind: 'recipe',
        severity: doctor.status === 'ok' ? 'recommended' : 'primary',
        blocking: true,
        impact: {
          level: 'writes_runtime',
          summary: 'Prepara o endpoint local of the Ollama in the runtime of the Zavorth.',
          details: [
            'Escreve OLLAMA_HOST in the .env local of the Zavorth.',
            'Updates the current process to use the configured host.',
            'Runs a lightweight /api/tags probe to verify the response.',
          ],
          requiresConfirmation: true,
        },
      });
    }

    return actions;
  }

  public createActionFromStep(
    integrationId: string,
    step: IntegrationInstallStep,
    doctor: IntegrationDoctorSnapshot,
  ): IntegrationGuidedAction | null {
    const severity = step.blocking
      ? (doctor.status === 'ok' && step.kind === 'verification' ? 'recommended' : 'primary')
      : 'manual';
    const executable = Boolean(step.command && this.resolveCommand(step.command, integrationId));
    return {
      id: `step:${step.id}`,
      label: step.title,
      description: step.description,
      command: step.command || null,
      executable,
      manualOnly: !executable,
      kind: step.kind === 'verification' ? 'doctor' : 'install_step',
      severity,
      blocking: step.blocking !== false,
      impact: this.buildImpactForStep(step, executable),
    };
  }

  public createActionFromCommand(
    integrationId: string,
    actionId: string,
    label: string,
    description: string,
    command: string | null,
    severity: IntegrationGuidedAction['severity'],
    blocking: boolean,
    kind: IntegrationGuidedAction['kind'],
  ): IntegrationGuidedAction | null {
    if (!command) {
      return null;
    }

    const executable = Boolean(this.resolveCommand(command, integrationId));
    return {
      id: actionId,
      label,
      description,
      command,
      executable,
      manualOnly: !executable,
      kind,
      severity,
      blocking,
      impact: this.buildImpactForCommand(command, executable, kind),
    };
  }

  public resolveCommand(commandText: string, integrationId: string): ResolvedIntegrationCommand | null {
    const normalized = String(commandText || '').trim().replace(/\s+/g, ' ');
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

    if (normalized === `npm run integrations:doctor -- --id ${integrationId}`) {
      return {
        command: npmCommand,
        args: ['run', 'integrations:doctor', '--', '--id', integrationId],
      };
    }

    if (normalized === `npm run integrations:show -- --id ${integrationId}`) {
      return {
        command: npmCommand,
        args: ['run', 'integrations:show', '--', '--id', integrationId],
      };
    }

    if (normalized === 'npm run sidecars:status') {
      return {
        command: npmCommand,
        args: ['run', 'sidecars:status'],
      };
    }

    return null;
  }

  public async executeRecipeAction(
    integrationId: string,
    action: IntegrationGuidedAction,
  ): Promise<IntegrationActionExecution | null> {
    switch (action.id) {
      case 'recipe:AIGateway:start-sidecar':
        return this.executeAIGatewayStartRecipe(integrationId, action);
      case 'recipe:zavorth-bridge-remote:start-sidecar':
        return this.executeZavorthBridgeRemoteStartRecipe(integrationId, action);
      case 'recipe:AIGateway:sync-upstream':
        return this.executeVendorUpstreamRecipe(
          integrationId,
          action,
          async () => this.gatewayUpstreamSyncService.sync(),
          (report) => report.summary,
        );
      case 'recipe:zavorth-bridge-remote:sync-upstream':
        return this.executeVendorUpstreamRecipe(
          integrationId,
          action,
          async () => this.zavorthBridgeRemoteUpstreamSyncService.sync(),
          (report) => report.summary,
        );
      case 'recipe:AIGateway:promote-upstream':
        return this.executeVendorUpstreamRecipe(
          integrationId,
          action,
          async () => this.gatewayUpstreamSyncService.promote({ autoRollback: true }),
          (report) => report.summary,
        );
      case 'recipe:zavorth-bridge-remote:promote-upstream':
        return this.executeVendorUpstreamRecipe(
          integrationId,
          action,
          async () => this.zavorthBridgeRemoteUpstreamSyncService.promote({ autoRollback: true }),
          (report) => report.summary,
        );
      case 'recipe:AIGateway:rollback-upstream':
        return this.executeVendorUpstreamRecipe(
          integrationId,
          action,
          async () => this.gatewayUpstreamSyncService.rollback(),
          (report) => report.summary,
        );
      case 'recipe:zavorth-bridge-remote:rollback-upstream':
        return this.executeVendorUpstreamRecipe(
          integrationId,
          action,
          async () => this.zavorthBridgeRemoteUpstreamSyncService.rollback(),
          (report) => report.summary,
        );
      case 'recipe:ollama:prepare-host':
        return this.executeOllamaHostRecipe(integrationId, action);
      default:
        return null;
    }
  }

  private buildImpactForStep(
    step: IntegrationInstallStep,
    executable: boolean,
  ): NonNullable<IntegrationGuidedAction['impact']> {
    if (step.kind === 'verification') {
      return {
        level: 'read_only',
        summary: 'Faz checagem and diagnostic without mutation pesada.',
        details: [
          'Runs a safe verification based on Zavorth scripts.',
          'Refreshes diagnostics and health signals for this integration.',
        ],
        requiresConfirmation: false,
      };
    }

    if (!executable || step.kind === 'manual') {
      return {
        level: 'manual',
        summary: 'This step still requires guided manual operation.',
        details: [
          'Zavorth does not yet have a reliable automation for this segment.',
        ],
        requiresConfirmation: false,
      };
    }

    return {
      level: 'writes_runtime',
      summary: 'This step changes local integration configuration.',
      details: [
        'O Zavorth vai aplicar uma receita safe conhecida for this integration.',
      ],
      requiresConfirmation: true,
    };
  }

  private buildImpactForCommand(
    command: string,
    executable: boolean,
    kind: IntegrationGuidedAction['kind'],
  ): NonNullable<IntegrationGuidedAction['impact']> {
    if (!executable) {
      return {
        level: 'manual',
        summary: 'Action descritiva or manual.',
        details: ['Review the command and execute it manually if it makes sense.'],
        requiresConfirmation: false,
      };
    }

    if (kind === 'inspect') {
      return {
        level: 'read_only',
        summary: 'Read-only access to the catalog or manifest.',
        details: ['Does not change runtime or install components.'],
        requiresConfirmation: false,
      };
    }

    if (command.includes('integrations:doctor') || command.includes('sidecars:status')) {
      return {
        level: 'read_only',
        summary: 'Safe health and state check.',
        details: [
          'Executa diagnostic leve of the Integration Hub.',
          'Does not change secrets or install new components.',
        ],
        requiresConfirmation: false,
      };
    }

    return {
      level: 'writes_runtime',
      summary: 'Receita assistida with changes locais.',
      details: ['Review the command before proceeding.'],
      requiresConfirmation: true,
    };
  }

  private async executeAIGatewayStartRecipe(
    integrationId: string,
    action: IntegrationGuidedAction,
  ): Promise<IntegrationActionExecution> {
    const startedAt = this.now().toISOString();

    try {
      const snapshot = await this.aiGatewaySidecarService.start();
      const probe = await this.probeService.runProbe(integrationId);
      const doctor = this.healthService.buildDoctorSnapshot(integrationId);
      this.installerService.recordHealthStatus(integrationId, doctor.status);

      const record: IntegrationActionExecution = {
        executionId: this.buildExecutionId(integrationId, action.id, startedAt),
        integrationId,
        actionId: action.id,
        label: action.label,
        command: 'receita: start AIGateway sidecar',
        startedAt,
        finishedAt: this.now().toISOString(),
        pid: snapshot.pid ?? null,
        logFile: config.AIGatewaySidecarLogFile || '',
        status: doctor.status === 'ok' ? 'completed' : 'partial',
        note: `${snapshot.message} ${probe.summary}.`.trim(),
        doctor,
        probe,
        appliedEnvKeys: [],
        exitCode: 0,
      };
      this.ledgerService.persistRecord(record);
      return record;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const doctor = this.healthService.buildDoctorSnapshot(integrationId);
      this.installerService.recordHealthStatus(integrationId, doctor.status);
      const record: IntegrationActionExecution = {
        executionId: this.buildExecutionId(integrationId, action.id, startedAt),
        integrationId,
        actionId: action.id,
        label: action.label,
        command: 'receita: start AIGateway sidecar',
        startedAt,
        finishedAt: this.now().toISOString(),
        pid: null,
        logFile: config.AIGatewaySidecarLogFile || '',
        status: 'failed',
        note: errorMessage(error),
        doctor,
        appliedEnvKeys: [],
        exitCode: null,
      };
      this.ledgerService.persistRecord(record);
      return record;
    }
  }

  private async executeZavorthBridgeRemoteStartRecipe(
    integrationId: string,
    action: IntegrationGuidedAction,
  ): Promise<IntegrationActionExecution> {
    const startedAt = this.now().toISOString();

    try {
      const snapshot = await this.terminalSidecarService.start();
      const probe = await this.probeService.runProbe(integrationId);
      const doctor = this.healthService.buildDoctorSnapshot(integrationId);
      this.installerService.recordHealthStatus(integrationId, doctor.status);

      const record: IntegrationActionExecution = {
        executionId: this.buildExecutionId(integrationId, action.id, startedAt),
        integrationId,
        actionId: action.id,
        label: action.label,
        command: 'receita: start zavorthBridge remote sidecar',
        startedAt,
        finishedAt: this.now().toISOString(),
        pid: snapshot.pid ?? null,
        logFile: config.ZavorthTerminalSidecarLogFile || '',
        status: doctor.status === 'ok' ? 'completed' : 'partial',
        note: `${snapshot.message} ${probe.summary}.`.trim(),
        doctor,
        probe,
        appliedEnvKeys: [],
        exitCode: 0,
      };
      this.ledgerService.persistRecord(record);
      return record;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const doctor = this.healthService.buildDoctorSnapshot(integrationId);
      this.installerService.recordHealthStatus(integrationId, doctor.status);
      const record: IntegrationActionExecution = {
        executionId: this.buildExecutionId(integrationId, action.id, startedAt),
        integrationId,
        actionId: action.id,
        label: action.label,
        command: 'receita: start zavorthBridge remote sidecar',
        startedAt,
        finishedAt: this.now().toISOString(),
        pid: null,
        logFile: config.ZavorthTerminalSidecarLogFile || '',
        status: 'failed',
        note: errorMessage(error),
        doctor,
        appliedEnvKeys: [],
        exitCode: null,
      };
      this.ledgerService.persistRecord(record);
      return record;
    }
  }

  private async executeVendorUpstreamRecipe(
    integrationId: string,
    action: IntegrationGuidedAction,
    runner: () => Promise<VendorUpstreamRecipeReport>,
    summarize: (report: VendorUpstreamRecipeReport) => string,
  ): Promise<IntegrationActionExecution> {
    const startedAt = this.now().toISOString();

    try {
      const syncReport = await runner();
      const probe = await this.probeService.runProbe(integrationId);
      const doctor = this.healthService.buildDoctorSnapshot(integrationId);
      this.installerService.recordHealthStatus(integrationId, doctor.status);

      const record: IntegrationActionExecution = {
        executionId: this.buildExecutionId(integrationId, action.id, startedAt),
        integrationId,
        actionId: action.id,
        label: action.label,
        command: syncReport.command,
        startedAt,
        finishedAt: this.now().toISOString(),
        pid: null,
        logFile: '',
        status: syncReport.ok && doctor.status === 'ok' ? 'completed' : (syncReport.ok ? 'partial' : 'failed'),
        note: syncReport.ok ? `${summarize(syncReport)} ${probe.summary}.`.trim()
          : (syncReport.error || syncReport.summary),
        doctor,
        probe,
        appliedEnvKeys: [],
        exitCode: syncReport.ok ? 0 : null,
      };
      this.ledgerService.persistRecord(record);
      return record;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const doctor = this.healthService.buildDoctorSnapshot(integrationId);
      this.installerService.recordHealthStatus(integrationId, doctor.status);
      const record: IntegrationActionExecution = {
        executionId: this.buildExecutionId(integrationId, action.id, startedAt),
        integrationId,
        actionId: action.id,
        label: action.label,
        command: `receita: ${action.id}`,
        startedAt,
        finishedAt: this.now().toISOString(),
        pid: null,
        logFile: '',
        status: 'failed',
        note: errorMessage(error),
        doctor,
        appliedEnvKeys: [],
        exitCode: null,
      };
      this.ledgerService.persistRecord(record);
      return record;
    }
  }

  private async executeOllamaHostRecipe(
    integrationId: string,
    action: IntegrationGuidedAction,
  ): Promise<IntegrationActionExecution> {
    const startedAt = this.now().toISOString();
    const host = this.resolveOllamaHost() || 'http://127.0.0.1:11434';
    this.applyRuntimeBinding('OLLAMA_HOST', host);

    const probe = await this.probeService.runProbe(integrationId);
    const doctor = this.healthService.buildDoctorSnapshot(integrationId);
    this.installerService.recordHealthStatus(integrationId, doctor.status);

    const record: IntegrationActionExecution = {
      executionId: this.buildExecutionId(integrationId, action.id, startedAt),
      integrationId,
      actionId: action.id,
      label: action.label,
      command: `receita: set OLLAMA_HOST=${host}`,
      startedAt,
      finishedAt: this.now().toISOString(),
      pid: null,
      logFile: '',
      status: doctor.status === 'ok' ? 'completed' : 'partial',
      note: doctor.status === 'ok'
        ? `OLLAMA_HOST prepared at ${host}. ${probe.summary}.`
        : `OLLAMA_HOST prepared at ${host}, but the host still needs to respond. ${probe.summary}.`,
      doctor,
      probe,
      appliedEnvKeys: ['OLLAMA_HOST'],
      exitCode: 0,
    };
    this.ledgerService.persistRecord(record);
    return record;
  }

  private resolveOllamaHost(): string | null {
    const normalized = String(process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL || '').trim();
    return normalized ? normalized.replace(/\/+$/, '') : null;
  }

  private buildExecutionId(integrationId: string, actionId: string, startedAt: string): string {
    return `${startedAt.replace(/[-:TZ.]/g, '').slice(0, 14)}-${integrationId}-${actionId}`;
  }
}
