import fs from 'fs';
import { config } from '../config/index.js';
import { ZavorthDistributedRuntimeControlPlaneService } from './ZavorthDistributedRuntimeControlPlaneService.js';
import { ZavorthQaControlPlaneService, type ZavorthQaProfile } from './ZavorthQaControlPlaneService.js';
import { KeepaliveStatusService, type KeepaliveStatusSnapshot } from './KeepaliveStatusService.js';
import { PublishHistoryService } from './PublishHistoryService.js';
import { ZavorthRuntimeStabilityControlPlaneService } from './ZavorthRuntimeStabilityControlPlaneService.js';
import type { ZavorthReadinessGate } from '../contracts/ZavorthMutationPlaneContract.js';
type RolloutDynamic = any;

type RolloutPosture = 'healthy' | 'attention' | 'critical';
type RolloutSeverity = 'info' | 'warn' | 'critical';
export type RolloutReadinessScope = 'local' | 'beta' | 'production' | 'rollback-only';

type RolloutDeps = {
  now?: () => Date;
  workspaceRoot?: string | null;
  qaControlPlaneService?: Pick<ZavorthQaControlPlaneService, 'buildSnapshot'> | null;
  distributedRuntimeControlPlaneService?: Pick<ZavorthDistributedRuntimeControlPlaneService, 'buildSnapshot'> | null;
  keepaliveStatusService?: Pick<KeepaliveStatusService, 'readSnapshot'> | null;
  publishHistoryService?: Pick<PublishHistoryService, 'readHistory' | 'summarize'> | null;
  runtimeStabilityControlPlaneService?: Pick<ZavorthRuntimeStabilityControlPlaneService, 'buildSnapshot'> | null;
  evalControlPlaneService?: { buildSnapshot: (input?: RolloutDynamic) => Promise<RolloutDynamic> | RolloutDynamic } | null;
  maintenanceReportFilePath?: string;
  publishHistoryFilePath?: string;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
};

export type ZavorthRolloutReadinessCard = {
  id: 'qa' | 'stability' | 'distributed' | 'maintenance' | 'publish';
  label: string;
  posture: RolloutPosture;
  summary: string;
  nextAction: string;
  command: string | null;
};

export type ZavorthRolloutReadinessSnapshot = {
  generatedAt: string;
  workspaceRoot: string;
  profile: ZavorthQaProfile;
  summary: {
    posture: RolloutPosture;
    releaseReady: boolean;
    qaPosture: string;
    distributedPosture: string;
    maintenanceFresh: boolean;
    keepaliveActive: boolean;
    publishEntries: number;
    publishComparisons: number;
    scope: RolloutReadinessScope;
    mode: 'snapshot' | 'refresh';
    gateStatus: ZavorthReadinessGate['status'];
    canProceed: boolean;
  };
  gate: ZavorthReadinessGate & {
    releaseReady: boolean;
  };
  cards: ZavorthRolloutReadinessCard[];
  actions: Array<{
    id: string;
    label: string;
    severity: RolloutSeverity;
    reason: string;
    command: string | null;
  }>;
  keepalive: KeepaliveStatusSnapshot | null;
  sourceSnapshots: {
    qa: RolloutDynamic;
    distributedRuntime: RolloutDynamic;
    runtimeStability: RolloutDynamic;
    evals: RolloutDynamic;
    maintenance: RolloutDynamic;
    publishHistory: RolloutDynamic[];
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};

export class ZavorthRolloutReadinessControlPlaneService {
  private readonly now: () => Date;
  private readonly workspaceRoot: string;
  private readonly qa: Pick<ZavorthQaControlPlaneService, 'buildSnapshot'>;
  private readonly distributedRuntime: Pick<ZavorthDistributedRuntimeControlPlaneService, 'buildSnapshot'>;
  private readonly keepaliveStatus: Pick<KeepaliveStatusService, 'readSnapshot'>;
  private readonly publishHistory: Pick<PublishHistoryService, 'readHistory' | 'summarize'>;
  private readonly runtimeStability: Pick<ZavorthRuntimeStabilityControlPlaneService, 'buildSnapshot'> | null;
  private readonly evalControlPlane: { buildSnapshot: (input?: RolloutDynamic) => Promise<RolloutDynamic> | RolloutDynamic } | null;
  private readonly maintenanceReportFilePath: string;
  private readonly publishHistoryFilePath: string;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;

  constructor(runtime: RolloutDeps = {}) {
    this.now = runtime.now || (() => new Date());
    this.workspaceRoot = this.text(runtime.workspaceRoot, config.projectRoot || process.cwd());
    this.qa = runtime.qaControlPlaneService || new ZavorthQaControlPlaneService();
    this.distributedRuntime = runtime.distributedRuntimeControlPlaneService || new ZavorthDistributedRuntimeControlPlaneService();
    this.keepaliveStatus = runtime.keepaliveStatusService || new KeepaliveStatusService();
    this.publishHistory = runtime.publishHistoryService || new PublishHistoryService(this.workspaceRoot);
    this.runtimeStability = runtime.runtimeStabilityControlPlaneService || new ZavorthRuntimeStabilityControlPlaneService();
    this.evalControlPlane = runtime.evalControlPlaneService || null;
    this.maintenanceReportFilePath = runtime.maintenanceReportFilePath || config.maintenanceAutomationReportFile;
    this.publishHistoryFilePath = runtime.publishHistoryFilePath || config.publishHistoryFile;
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
  }

  public async buildSnapshot(input: {
    profile?: ZavorthQaProfile | string | null;
    scope?: RolloutReadinessScope | string | null;
    refresh?: boolean;
    includeSources?: boolean;
  } = {}): Promise<ZavorthRolloutReadinessSnapshot> {
    const profile = this.normalizeProfile(input.profile);
    const scope = this.normalizeScope(input.scope);
    const refresh = input.refresh === true;
    const mode: 'snapshot' | 'refresh' = refresh ? 'refresh' : 'snapshot';
    const [qa, distributedRuntime, runtimeStability, evals] = await Promise.all([
      Promise.resolve(this.qa.buildSnapshot({ profile })),
      Promise.resolve(this.distributedRuntime.buildSnapshot()),
      Promise.resolve(this.runtimeStability?.buildSnapshot({ deepDoctor: refresh }) || null),
      Promise.resolve(this.evalControlPlane?.buildSnapshot({ sourceSurface: 'rollout-readiness' }) || null),
    ]);
    const keepalive = this.keepaliveStatus.readSnapshot();
    const maintenance = this.readMaintenanceReport();
    const publishEntries = this.publishHistory.readHistory(this.publishHistoryFilePath);
    const publishSummaries = this.publishHistory.summarize(publishEntries, 4);
    const cards = this.buildCards({ qa, distributedRuntime, runtimeStability, maintenance, keepalive, publishSummaries });
    const actions = this.buildActions({ qa, distributedRuntime, runtimeStability, maintenance, keepalive, publishEntries, profile });
    const gate = this.buildReadinessGate({
      scope,
      qa,
      distributedRuntime,
      runtimeStability,
      evals,
      maintenance,
      keepalive,
      publishEntries,
    });
    const summary = {
      posture: this.resolvePosture(cards, actions),
      releaseReady: gate.releaseReady,
      qaPosture: this.text(qa?.summary?.posture, 'unknown'),
      distributedPosture: this.text(distributedRuntime?.summary?.posture, 'unknown'),
      maintenanceFresh: !this.isMaintenanceStale(maintenance?.finishedAt || maintenance?.startedAt || null),
      keepaliveActive: keepalive?.ok === true,
      publishEntries: publishEntries.length,
      publishComparisons: publishSummaries.filter((entry: RolloutDynamic) => entry?.comparisonToPrevious).length,
      scope,
      mode,
      gateStatus: gate.status,
      canProceed: gate.canProceed,
    };

    return {
      generatedAt: this.now().toISOString(),
      workspaceRoot: this.workspaceRoot,
      profile,
      summary,
      gate,
      cards,
      actions,
      keepalive,
      sourceSnapshots: {
        qa: input.includeSources === true ? qa : this.compactQaSnapshot(qa),
        distributedRuntime: input.includeSources === true ? distributedRuntime : this.compactDistributedSnapshot(distributedRuntime),
        runtimeStability: input.includeSources === true ? runtimeStability : this.compactRuntimeStabilitySnapshot(runtimeStability),
        evals: input.includeSources === true ? evals : this.compactEvalSnapshot(evals),
        maintenance: input.includeSources === true ? maintenance : this.compactMaintenanceSnapshot(maintenance),
        publishHistory: input.includeSources === true ? publishEntries : publishEntries.slice(0, 4).map((entry: RolloutDynamic) => ({
          publishedAt: entry?.publishedAt || null,
          branch: entry?.branch || null,
          commit: entry?.commit || null,
          archiveId: entry?.archive?.id || null,
        })),
      },
      narrative: {
        headline: 'Rollout e QA persistentes',
        operatorSummary:
          `QA ${summary.qaPosture}, runtime distribuido ${summary.distributedPosture}, `
          + `maintenance ${summary.maintenanceFresh ? 'fresca' : 'vencida'} e `
          + `${summary.publishEntries} publish entrie(s) no historico. Gate ${scope}: ${gate.status}.`,
        nextAction: actions[0]?.label || `Rodar npm run release:${profile} e renovar a malha supervisionada.`,
      },
    };
  }

  public async renderReport(input: {
    profile?: ZavorthQaProfile | string | null;
    scope?: RolloutReadinessScope | string | null;
    refresh?: boolean;
  } = {}): Promise<string> {
    const snapshot = await this.buildSnapshot(input);
    const lines = [
      'Rollout e QA persistentes',
      '',
      snapshot.narrative.operatorSummary,
      `Postura: ${snapshot.summary.posture}.`,
      `Release ${snapshot.profile}: ${snapshot.summary.releaseReady ? 'pronto' : 'pendente'}.`,
      `Modo: ${snapshot.summary.mode}.`,
      `Gate ${snapshot.summary.scope}: ${snapshot.gate.status} | canProceed=${snapshot.gate.canProceed ? 'sim' : 'nao'}.`,
      '',
      'Cards operacionais:',
      ...snapshot.cards.map((entry) =>
        `- ${entry.label}: ${entry.posture} | ${entry.summary}${entry.command ? ` | ${entry.command}` : ''}`),
    ];
    if (snapshot.actions.length > 0) {
      lines.push(
        '',
        'Acoes sugeridas:',
        ...snapshot.actions.map((entry) =>
          `- ${entry.label}: ${entry.reason}${entry.command ? ` | ${entry.command}` : ''}`),
      );
    }
    if (snapshot.gate.blockers.length > 0 || snapshot.gate.warnings.length > 0) {
      lines.push(
        '',
        'Gate:',
        ...snapshot.gate.blockers.map((entry) => `- bloqueio: ${entry}`),
        ...snapshot.gate.warnings.map((entry) => `- aviso: ${entry}`),
      );
    }
    return lines.join('\n');
  }

  private buildCards(input: {
    qa: RolloutDynamic;
    distributedRuntime: RolloutDynamic;
    runtimeStability?: RolloutDynamic;
    maintenance: RolloutDynamic;
    keepalive: KeepaliveStatusSnapshot | null;
    publishSummaries: RolloutDynamic[];
  }): ZavorthRolloutReadinessCard[] {
    const maintenanceFresh = !this.isMaintenanceStale(input.maintenance?.finishedAt || input.maintenance?.startedAt || null);
    return [
      {
        id: 'qa',
        label: 'QA e release gates',
        posture: this.text(input.qa?.summary?.posture, 'attention') as RolloutPosture,
        summary: `${input.qa?.summary?.healthy || 0} healthy | ${input.qa?.summary?.attention || 0} attention | ${input.qa?.summary?.critical || 0} critical.`,
        nextAction: input.qa?.summary?.releaseReady
          ? 'QA pronto para repeticao de release.'
          : 'Renovar benchmarks, smokes e regressions antes do proximo rollout.',
        command: 'npm run qa:product -- --skip-build',
      },
      {
        id: 'stability',
        label: 'Runtime Stability Gate',
        posture: this.resolveRuntimeStabilityPosture(input.runtimeStability),
        summary: input.runtimeStability?.narrative?.operatorSummary
          || `Gate ${this.text(input.runtimeStability?.gate?.status, 'warning')}.`,
        nextAction: input.runtimeStability?.gate?.canProceedToRollout
          ? 'Gate de estabilidade permite seguir para rollout.'
          : this.text(input.runtimeStability?.narrative?.nextAction, 'Rodar runtime stability com refresh antes de promover.'),
        command: 'npm run ops:runtime-stability',
      },
      {
        id: 'distributed',
        label: 'Runtime distribuido',
        posture: this.text(input.distributedRuntime?.summary?.posture, 'attention') as RolloutPosture,
        summary: `${input.distributedRuntime?.summary?.readyChannels || 0} canal(is) pronto(s) | ${input.distributedRuntime?.summary?.onlineNodes || 0} node(s) online | ${input.distributedRuntime?.summary?.readyTransports || 0} transport(s) prontos.`,
        nextAction: input.distributedRuntime?.summary?.posture === 'healthy'
          ? 'Malha pronta para rollout remoto.'
          : 'Fechar canais, fleet e transports antes de promover o rollout.',
        command: 'npm run ops:distributed',
      },
      {
        id: 'maintenance',
        label: 'Ciclo persistente',
        posture: maintenanceFresh && input.keepalive?.ok === true ? 'healthy' : 'attention',
        summary: maintenanceFresh
          ? `Ultimo ciclo terminou em ${this.text(input.maintenance?.finishedAt || input.maintenance?.startedAt, 'n/d')}.`
          : 'Nao existe ciclo recorrente recente suficiente para sustentar o rollout longo.',
        nextAction: maintenanceFresh
          ? 'Manter a manutencao recorrente ativa e revisar o snapshot periodico.'
          : 'Renovar a manutencao recorrente e o keepalive supervisionado.',
        command: 'npm run ops:maintain:scheduled -- --dry-run',
      },
      {
        id: 'publish',
        label: 'Historico de publish',
        posture: input.publishSummaries.length > 0 ? 'healthy' : 'attention',
        summary: input.publishSummaries.length > 0
          ? `${input.publishSummaries.length} publish(es) resumidos e ${input.publishSummaries.filter((entry) => entry?.comparisonToPrevious).length} comparacao(oes) com baseline anterior.`
          : 'Ainda nao existe historico suficiente de publish para rollout persistente comparavel.',
        nextAction: input.publishSummaries.length > 0
          ? 'Usar o historico de publish para comparar rollout e rollback.'
          : 'Executar um publish oficial antes de considerar o rollout persistente fechado.',
        command: 'npm run remote:history',
      },
    ];
  }

  private buildActions(input: {
    qa: RolloutDynamic;
    distributedRuntime: RolloutDynamic;
    runtimeStability?: RolloutDynamic;
    maintenance: RolloutDynamic;
    keepalive: KeepaliveStatusSnapshot | null;
    publishEntries: RolloutDynamic[];
    profile: ZavorthQaProfile;
  }): ZavorthRolloutReadinessSnapshot['actions'] {
    const actions: ZavorthRolloutReadinessSnapshot['actions'] = [];
    if (input.qa?.summary?.releaseReady !== true) {
      actions.push({
        id: 'qa-product',
        label: 'Fechar o QA de produto',
        severity: 'critical',
        reason: this.text(input.qa?.narrative?.nextAction, 'O release gate ainda nao esta verde.'),
        command: `npm run release:${input.profile}`,
      });
    }
    if (this.text(input.distributedRuntime?.summary?.posture) !== 'healthy') {
      actions.push({
        id: 'distributed-readiness',
        label: 'Fechar o runtime distribuido',
        severity: 'warn',
        reason: this.text(input.distributedRuntime?.narrative?.nextAction, 'O runtime distribuido ainda nao esta pronto para rollout longo.'),
        command: 'npm run ops:distributed',
      });
    }
    if (this.text(input.runtimeStability?.gate?.status, 'warning') !== 'passed') {
      actions.push({
        id: 'runtime-stability',
        label: 'Passar o Runtime Stability Gate',
        severity: this.text(input.runtimeStability?.gate?.status) === 'failed' ? 'critical' : 'warn',
        reason: this.text(input.runtimeStability?.narrative?.nextAction, 'O gate de estabilidade ainda nao esta passed.'),
        command: 'npm run ops:runtime-stability -- --refresh',
      });
    }
    if (this.isMaintenanceStale(input.maintenance?.finishedAt || input.maintenance?.startedAt || null) || input.keepalive?.ok !== true) {
      actions.push({
        id: 'maintenance-refresh',
        label: 'Renovar maintenance e keepalive',
        severity: 'warn',
        reason: 'O ambiente persistente precisa de sinais recentes de manutencao e keepalive.',
        command: 'npm run ops:maintain:scheduled -- --dry-run',
      });
    }
    if (input.publishEntries.length === 0) {
      actions.push({
        id: 'publish-history',
        label: 'Gerar historico de publish comparavel',
        severity: 'info',
        reason: 'Ainda nao existe baseline de publish suficiente para rollout persistente.',
        command: 'npm run remote:history',
      });
    }
    return actions.slice(0, 6);
  }

  private resolvePosture(
    cards: ZavorthRolloutReadinessCard[],
    actions: ZavorthRolloutReadinessSnapshot['actions'],
  ): RolloutPosture {
    if (cards.some((entry) => entry.posture === 'critical') || actions.some((entry) => entry.severity === 'critical')) {
      return 'critical';
    }
    if (cards.some((entry) => entry.posture === 'attention') || actions.length > 0) {
      return 'attention';
    }
    return 'healthy';
  }

  private buildReadinessGate(input: {
    scope: RolloutReadinessScope;
    qa: RolloutDynamic;
    distributedRuntime: RolloutDynamic;
    runtimeStability: RolloutDynamic;
    evals: RolloutDynamic;
    maintenance: RolloutDynamic;
    keepalive: KeepaliveStatusSnapshot | null;
    publishEntries: RolloutDynamic[];
  }): ZavorthReadinessGate & { releaseReady: boolean } {
    const checkedAt = this.now().toISOString();
    const warnings: string[] = [];
    const blockers: string[] = [];
    const reasons: string[] = [];
    const qaReady = input.qa?.summary?.releaseReady === true;
    const distributedOk = this.text(input.distributedRuntime?.summary?.posture, 'unknown') !== 'critical';
    const stabilityStatus = this.text(input.runtimeStability?.gate?.status, input.runtimeStability ? 'warning' : 'warning');
    const regressionCritical = Array.isArray(input.evals?.regressions)
      && input.evals.regressions.some((entry: RolloutDynamic) => entry?.severity === 'critical');
    const backupRestoreFresh = !this.isMaintenanceStale(input.maintenance?.finishedAt || input.maintenance?.startedAt || null);
    const publishHistoryClean = input.publishEntries.length > 0;

    if (!qaReady) {
      (input.scope === 'local' || input.scope === 'rollback-only' ? warnings : blockers).push('QA releaseReady ainda nao passou.');
    }
    if (!distributedOk) {
      (input.scope === 'local' || input.scope === 'rollback-only' ? warnings : blockers).push('Runtime distribuido esta em postura critica.');
    }
    if (stabilityStatus === 'failed') {
      (input.scope === 'local' || input.scope === 'rollback-only' ? warnings : blockers).push('Runtime Stability Gate falhou.');
    } else if (stabilityStatus !== 'passed' && input.scope === 'production') {
      blockers.push('Runtime Stability Gate precisa estar passed para production.');
    } else if (stabilityStatus !== 'passed') {
      warnings.push('Runtime Stability Gate nao esta passed.');
    }
    if (regressionCritical) {
      (input.scope === 'production' ? blockers : warnings).push('Eval Regression Gate encontrou regressao critica.');
    }
    if (!backupRestoreFresh) {
      (input.scope === 'production' ? blockers : warnings).push('Backup/maintenance/restore recente ausente ou vencido.');
    }
    if (!publishHistoryClean) {
      (input.scope === 'production' || input.scope === 'rollback-only' ? blockers : warnings).push('Historico de publish limpo/recente ausente.');
    }
    if (input.scope === 'production' && input.keepalive?.ok !== true) {
      blockers.push('Keepalive supervisionado nao esta ativo.');
    }

    if (input.scope === 'rollback-only') {
      reasons.push('Scope rollback-only permite apenas caminhos de reversao e exige historico de publish.');
    } else if (input.scope === 'local') {
      reasons.push('Scope local le snapshots e permite seguir com warnings, sem promover production.');
    } else if (input.scope === 'beta') {
      reasons.push('Scope beta exige QA e runtime sem estado critico.');
    } else {
      reasons.push('Scope production exige stability passed, sem regressao critica, maintenance recente e publish history.');
    }

    const releaseReady = qaReady && distributedOk && stabilityStatus !== 'failed' && !regressionCritical;
    const canProceed = blockers.length === 0;
    return {
      id: `rollout-readiness:${input.scope}`,
      status: blockers.length > 0 ? 'failed' : warnings.length > 0 ? 'warning' : 'passed',
      canProceed,
      scope: input.scope,
      releaseReady,
      reasons,
      warnings,
      blockers,
      checkedAt,
      budgets: {
        maxMaintenanceAgeHours: 24,
        productionRequiresStabilityPassed: true,
        productionRequiresKeepalive: true,
        productionRequiresPublishHistory: true,
        betaBlocksCriticalDistributedRuntime: true,
      },
      evidence: [
        {
          id: 'qa',
          label: 'QA release gate',
          status: qaReady ? 'passed' : 'warning',
          summary: this.text(input.qa?.narrative?.operatorSummary, 'QA snapshot indisponivel.'),
          command: `npm run release:${this.normalizeProfile(input.qa?.profile)}`,
          updatedAt: this.nullableText(input.qa?.generatedAt),
        },
        {
          id: 'runtime-stability',
          label: 'Runtime Stability Gate',
          status: stabilityStatus,
          summary: this.text(input.runtimeStability?.narrative?.operatorSummary, 'Runtime Stability snapshot indisponivel.'),
          command: 'npm run ops:runtime-stability -- --refresh',
          updatedAt: this.nullableText(input.runtimeStability?.generatedAt),
        },
        {
          id: 'distributed-runtime',
          label: 'Distributed Runtime',
          status: this.text(input.distributedRuntime?.summary?.posture, 'unknown'),
          summary: this.text(input.distributedRuntime?.narrative?.operatorSummary, 'Distributed runtime snapshot indisponivel.'),
          command: 'npm run ops:distributed',
          updatedAt: this.nullableText(input.distributedRuntime?.generatedAt),
        },
        {
          id: 'maintenance',
          label: 'Maintenance/backup signal',
          status: backupRestoreFresh ? 'fresh' : 'stale',
          summary: backupRestoreFresh
            ? `Maintenance recente em ${this.text(input.maintenance?.finishedAt || input.maintenance?.startedAt, 'n/d')}.`
            : 'Maintenance/backup recente ausente ou vencido.',
          command: 'npm run ops:maintain:scheduled -- --dry-run',
          updatedAt: this.nullableText(input.maintenance?.finishedAt || input.maintenance?.startedAt),
        },
        {
          id: 'publish-history',
          label: 'Publish history',
          status: publishHistoryClean ? 'present' : 'missing',
          summary: `${input.publishEntries.length} publish entrie(s) disponiveis para comparacao/rollback.`,
          command: 'npm run remote:history',
          updatedAt: this.nullableText(input.publishEntries[0]?.publishedAt),
        },
      ],
      nextActions: [
        ...blockers,
        ...warnings,
      ].slice(0, 6),
    };
  }

  private resolveRuntimeStabilityPosture(snapshot: RolloutDynamic): RolloutPosture {
    const status = this.text(snapshot?.gate?.status, 'warning');
    if (status === 'failed') {
      return 'critical';
    }
    if (status === 'passed') {
      return 'healthy';
    }
    return 'attention';
  }

  private compactQaSnapshot(snapshot: RolloutDynamic): RolloutDynamic {
    if (!snapshot) {
      return null;
    }
    return {
      generatedAt: snapshot.generatedAt || null,
      profile: snapshot.profile || null,
      summary: snapshot.summary || null,
      architecture: snapshot.architecture
        ? {
          gate: snapshot.architecture.gate,
          canProceed: snapshot.architecture.canProceed,
          summary: snapshot.architecture.summary,
        }
        : null,
      narrative: snapshot.narrative || null,
    };
  }

  private compactDistributedSnapshot(snapshot: RolloutDynamic): RolloutDynamic {
    if (!snapshot) {
      return null;
    }
    return {
      generatedAt: snapshot.generatedAt || null,
      summary: snapshot.summary || null,
      cards: Array.isArray(snapshot.cards) ? snapshot.cards : [],
      actions: Array.isArray(snapshot.actions) ? snapshot.actions.slice(0, 6) : [],
      narrative: snapshot.narrative || null,
    };
  }

  private compactRuntimeStabilitySnapshot(snapshot: RolloutDynamic): RolloutDynamic {
    if (!snapshot) {
      return null;
    }
    return {
      generatedAt: snapshot.generatedAt || null,
      summary: snapshot.summary || null,
      gate: snapshot.gate || null,
      actions: Array.isArray(snapshot.actions) ? snapshot.actions.slice(0, 6) : [],
      narrative: snapshot.narrative || null,
    };
  }

  private compactEvalSnapshot(snapshot: RolloutDynamic): RolloutDynamic {
    if (!snapshot) {
      return null;
    }
    return {
      generatedAt: snapshot.generatedAt || null,
      summary: snapshot.summary || null,
      regressionGate: snapshot.regressionGate || null,
      regressions: Array.isArray(snapshot.regressions) ? snapshot.regressions.slice(0, 6) : [],
      narrative: snapshot.narrative || null,
    };
  }

  private compactMaintenanceSnapshot(snapshot: RolloutDynamic): RolloutDynamic {
    if (!snapshot) {
      return null;
    }
    return {
      startedAt: snapshot.startedAt || null,
      finishedAt: snapshot.finishedAt || null,
      status: snapshot.status || null,
      ok: typeof snapshot.ok === 'boolean' ? snapshot.ok : null,
      summary: snapshot.summary || null,
    };
  }

  private readMaintenanceReport(): Record<string, RolloutDynamic> | null {
    try {
      if (!this.existsSync(this.maintenanceReportFilePath)) {
        return null;
      }
      return JSON.parse(this.readFileSync(this.maintenanceReportFilePath, 'utf8')) as Record<string, RolloutDynamic>;
    } catch {
      return null;
    }
  }

  private isMaintenanceStale(timestamp: string | null): boolean {
    if (!timestamp) {
      return true;
    }
    const parsed = Date.parse(timestamp);
    if (!Number.isFinite(parsed)) {
      return true;
    }
    return (this.now().getTime() - parsed) > (24 * 60 * 60 * 1000);
  }

  private normalizeProfile(value: string | null | undefined): ZavorthQaProfile {
    return String(value || '').trim().toLowerCase() === 'beta' ? 'beta' : 'alpha';
  }

  private normalizeScope(value: string | null | undefined): RolloutReadinessScope {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'beta' || normalized === 'production' || normalized === 'rollback-only') {
      return normalized;
    }
    return 'local';
  }

  private text(value: unknown, fallback = ''): string {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  }

  private nullableText(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
  }
}
