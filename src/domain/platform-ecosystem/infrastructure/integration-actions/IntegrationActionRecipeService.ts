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
        label: 'Subir sidecar AIGateway',
        description: 'Inicializa o gateway local, instala dependencias se necessario e espera o endpoint responder.',
        command: null,
        executable: true,
        manualOnly: false,
        kind: 'recipe',
        severity: 'primary',
        blocking: true,
        impact: {
          level: 'starts_local_service',
          summary: 'Sobe o gateway local do AIGateway no host.',
          details: [
            'Pode instalar dependencias do worktree local se elas estiverem ausentes.',
            'Inicia o sidecar AIGateway e espera o endpoint responder.',
            'Grava log local do sidecar e revalida o probe real.',
          ],
          requiresConfirmation: true,
        },
      });
    }

    if (manifest.id === 'zavorth-terminal' && config.ZavorthTerminalSidecarEnabled && doctor.status !== 'ok') {
      actions.push({
        id: 'recipe:zavorth-bridge-remote:start-sidecar',
        label: 'Subir sidecar ZavorthBridge Remote',
        description: 'Inicializa o sidecar remoto oficial do ZavorthBridge, instala dependencias se necessario e espera o health responder.',
        command: null,
        executable: true,
        manualOnly: false,
        kind: 'recipe',
        severity: 'primary',
        blocking: true,
        impact: {
          level: 'starts_local_service',
          summary: 'Sobe o sidecar remoto do ZavorthBridge no host.',
          details: [
            'Pode instalar dependencias do worktree local se elas estiverem ausentes.',
            'Inicia o sidecar remoto oficial do ZavorthBridge e espera o health responder.',
            'Grava log local do sidecar e revalida o doctor/probe real.',
          ],
          requiresConfirmation: true,
        },
      });
    }

    if (manifest.id === 'AIGateway') {
      actions.push({
        id: 'recipe:AIGateway:sync-upstream',
        label: 'Sincronizar upstream AIGateway',
        description: 'Inspeciona o estado do vendor AIGateway e atualiza o relatorio seguro de sync.',
        command: null,
        executable: true,
        manualOnly: false,
        kind: 'recipe',
        severity: 'recommended',
        blocking: false,
        impact: {
          level: 'read_only',
          summary: 'Inspecao segura do upstream vendorado do AIGateway.',
          details: [
            'Roda o vendor-toolkit em modo status para o target AIGateway.',
            'Atualiza o relatorio persistido do sync upstream sem promover mudancas.',
          ],
          requiresConfirmation: false,
        },
      });
      actions.push({
        id: 'recipe:AIGateway:promote-upstream',
        label: 'Promover upstream AIGateway',
        description: 'Atualiza o vendor AIGateway, reinicia o sidecar e revalida a compatibilidade do gateway do Zavorth.',
        command: null,
        executable: true,
        manualOnly: false,
        kind: 'recipe',
        severity: doctor.status === 'ok' ? 'recommended' : 'primary',
        blocking: true,
        impact: {
          level: 'writes_runtime',
          summary: 'Atualiza o vendor AIGateway e revalida o gateway proprio do Zavorth.',
          details: [
            'Roda o vendor-toolkit update para o target AIGateway.',
            'Reinicia o sidecar AIGateway e executa o doctor de compatibilidade.',
            'Aplica rollback automatico se a compatibilidade falhar.',
          ],
          requiresConfirmation: true,
        },
      });
      actions.push({
        id: 'recipe:AIGateway:rollback-upstream',
        label: 'Rollback do upstream AIGateway',
        description: 'Restaura o lock anterior do vendor AIGateway e revalida o gateway proprio do Zavorth.',
        command: null,
        executable: true,
        manualOnly: false,
        kind: 'recipe',
        severity: 'recommended',
        blocking: true,
        impact: {
          level: 'writes_runtime',
          summary: 'Restaura o vendor AIGateway para a revisao anterior conhecida.',
          details: [
            'Roda o vendor-toolkit rollback para o target AIGateway.',
            'Reinicia o sidecar e executa o doctor de compatibilidade.',
          ],
          requiresConfirmation: true,
        },
      });
    }

    if (manifest.id === 'zavorth-terminal') {
      actions.push({
        id: 'recipe:zavorth-bridge-remote:sync-upstream',
        label: 'Sincronizar upstream ZavorthBridge Remote',
        description: 'Inspeciona o estado do vendor ZavorthBridge Remote e atualiza o relatorio seguro de sync.',
        command: null,
        executable: true,
        manualOnly: false,
        kind: 'recipe',
        severity: 'recommended',
        blocking: false,
        impact: {
          level: 'read_only',
          summary: 'Inspecao segura do upstream vendorado do ZavorthBridge Remote.',
          details: [
            'Roda o vendor-toolkit em modo status para o target zavorth-terminal.',
            'Atualiza o relatorio persistido do sync upstream sem promover mudancas.',
          ],
          requiresConfirmation: false,
        },
      });
      actions.push({
        id: 'recipe:zavorth-bridge-remote:promote-upstream',
        label: 'Promover upstream ZavorthBridge Remote',
        description: 'Atualiza o vendor ZavorthBridge Remote, reinicia o sidecar e revalida o doctor remoto.',
        command: null,
        executable: true,
        manualOnly: false,
        kind: 'recipe',
        severity: doctor.status === 'ok' ? 'recommended' : 'primary',
        blocking: true,
        impact: {
          level: 'writes_runtime',
          summary: 'Atualiza o vendor ZavorthBridge Remote e revalida o remoto oficial do Zavorth.',
          details: [
            'Roda o vendor-toolkit update para o target zavorth-terminal.',
            'Reinicia o sidecar remoto oficial e executa o doctor do ZavorthBridge.',
            'Aplica rollback automatico se o doctor falhar depois da promocao.',
          ],
          requiresConfirmation: true,
        },
      });
      actions.push({
        id: 'recipe:zavorth-bridge-remote:rollback-upstream',
        label: 'Rollback do upstream ZavorthBridge Remote',
        description: 'Restaura o lock anterior do vendor ZavorthBridge Remote e revalida o doctor remoto.',
        command: null,
        executable: true,
        manualOnly: false,
        kind: 'recipe',
        severity: 'recommended',
        blocking: true,
        impact: {
          level: 'writes_runtime',
          summary: 'Restaura o vendor ZavorthBridge Remote para a revisao anterior conhecida.',
          details: [
            'Roda o vendor-toolkit rollback para o target zavorth-terminal.',
            'Reinicia o sidecar remoto e executa o doctor do ZavorthBridge.',
          ],
          requiresConfirmation: true,
        },
      });
    }

    if (manifest.id === 'ollama' && !this.resolveOllamaHost()) {
      actions.push({
        id: 'recipe:ollama:prepare-host',
        label: 'Preparar host local do Ollama',
        description: 'Configura o endpoint local padrao do Ollama para o Zavorth conseguir validar a instalacao.',
        command: null,
        executable: true,
        manualOnly: false,
        kind: 'recipe',
        severity: doctor.status === 'ok' ? 'recommended' : 'primary',
        blocking: true,
        impact: {
          level: 'writes_runtime',
          summary: 'Prepara o endpoint local do Ollama no runtime do Zavorth.',
          details: [
            'Escreve OLLAMA_HOST no .env local do Zavorth.',
            'Atualiza o processo atual para usar o host configurado.',
            'Roda um probe leve em /api/tags para verificar resposta.',
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
        summary: 'Faz checagem e diagnostico sem mutacao pesada.',
        details: [
          'Roda uma verificacao segura baseada nos scripts do Zavorth.',
          'Atualiza o doctor e os sinais de saude desta integracao.',
        ],
        requiresConfirmation: false,
      };
    }

    if (!executable || step.kind === 'manual') {
      return {
        level: 'manual',
        summary: 'Este passo ainda exige operacao manual guiada.',
        details: [
          'O Zavorth ainda nao tem uma automacao confiavel para este trecho.',
        ],
        requiresConfirmation: false,
      };
    }

    return {
      level: 'writes_runtime',
      summary: 'Este passo altera a configuracao local de integracao.',
      details: [
        'O Zavorth vai aplicar uma receita segura conhecida para esta integracao.',
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
        summary: 'Acao descritiva ou manual.',
        details: ['Revise o comando e execute manualmente se fizer sentido.'],
        requiresConfirmation: false,
      };
    }

    if (kind === 'inspect') {
      return {
        level: 'read_only',
        summary: 'Somente leitura do catalogo ou do manifesto.',
        details: ['Nao altera runtime nem instala componentes.'],
        requiresConfirmation: false,
      };
    }

    if (command.includes('integrations:doctor') || command.includes('sidecars:status')) {
      return {
        level: 'read_only',
        summary: 'Checagem segura de saude e estado.',
        details: [
          'Executa diagnostico leve do Integration Hub.',
          'Nao altera segredos nem instala novos componentes.',
        ],
        requiresConfirmation: false,
      };
    }

    return {
      level: 'writes_runtime',
      summary: 'Receita assistida com alteracoes locais.',
      details: ['Revise o comando antes de prosseguir.'],
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
        note: error?.message || String(error),
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
        note: error?.message || String(error),
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
        note: syncReport.ok
          ? `${summarize(syncReport)} ${probe.summary}.`.trim()
          : (syncReport.error || syncReport.summary),
        doctor,
        probe,
        appliedEnvKeys: [],
        exitCode: syncReport.ok ? 0 : null,
      };
      this.ledgerService.persistRecord(record);
      return record;
    } catch (error: unknown) {
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
        note: error?.message || String(error),
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
        ? `OLLAMA_HOST preparado em ${host}. ${probe.summary}.`
        : `OLLAMA_HOST preparado em ${host}, mas o host ainda precisa responder. ${probe.summary}.`,
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
