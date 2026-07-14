
import type { AutoRepairReport, AutoRepairRunResult, AutoRepairService } from './AutoRepairService.js';
import type { OperationsHealthSnapshot, OperationsHealthService } from './OperationsHealthService.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

interface AutoRepairRunInput {
  dryRun: boolean;
  force: boolean;
  goal: 'auto' | 'repair' | 'improve';
  requestedBy: string;
  reason: string;
}

interface AutoRepairAttempt {
  status?: string;
}

interface AutoRepairReportDynamic {
  status?: string;
  attempts?: AutoRepairAttempt[];
  warnings?: string[];
}
interface SidecarCard {
  name?: string;
  id?: string;
  enabled?: boolean;
  ready?: boolean;
  running?: boolean;
  message?: string;
}

interface SidecarsSnapshot {
  down?: number;
  unhealthy?: number;
  failed?: number;
  [key: string]: unknown;
}

interface PerformanceSnapshot {
  runtimeP95Ms?: number;
  p95Ms?: number;
  latencyP95Ms?: number;
}

interface PublishSnapshot {
  smokeTest?: string;
  gitPush?: string;
  recommendedAction?: string;
  recommendation?: string;
  status?: string;
}

interface StorageHotspot {
  label?: string;
  id?: string;
  bytes?: number;
}

interface StorageSnapshot {
  hotspots?: StorageHotspot[];
  freePercent?: number;
}

interface RemoteTransportItem {
  status?: string;
  error?: string;
  summary?: string;
  transportId?: string;
}

interface RemoteTransportDoctor {
  status?: string;
  summary?: string;
  items?: RemoteTransportItem[];
}

interface ChannelConfigItem {
  configured?: boolean;
  status?: string;
  channelId?: string;
  error?: string;
  summary?: string;
}

interface ChannelProviderDoctor {
  items?: ChannelConfigItem[];
}

interface ErrorEntry {
  message?: string;
  category?: string;
}

interface ErrorsSnapshot {
  lastError?: ErrorEntry;
  recent?: ErrorEntry[];
}

interface SelfHealDynamic {
  sidecars?: SidecarsSnapshot;
  performance?: PerformanceSnapshot;
  runtime?: PerformanceSnapshot;
  publish?: PublishSnapshot;
  storage?: StorageSnapshot;
  storageHotspots?: StorageHotspot[];
  remoteTransportDoctor?: RemoteTransportDoctor;
  channelProviderDoctor?: ChannelProviderDoctor;
  errors?: ErrorsSnapshot;
}

export type ZavorthSelfHealFlowId =
  | 'sidecar_down'
  | 'runtime_slow'
  | 'publish_failed'
  | 'rollback_recommended'
  | 'cache_growth'
  | 'remote_executor_session_lost'
  | 'missing_config'
  | 'artifact_delivery_failed';

export type ZavorthSelfHealMode = 'preview' | 'apply' | 'daily-report';
export type ZavorthSelfHealStatus = 'ready' | 'paused' | 'applied' | 'blocked';
export type ZavorthSelfHealProbeStatus = 'healthy' | 'attention' | 'failed' | 'skipped';
export type ZavorthSelfHealRisk = 'low' | 'medium' | 'high';
export type ZavorthSelfHealActionStatus =
  | 'planned'
  | 'applied'
  | 'pending_approval'
  | 'blocked'
  | 'skipped';

export type ZavorthSelfHealProbe = {
  flowId: ZavorthSelfHealFlowId;
  label: string;
  status: ZavorthSelfHealProbeStatus;
  severity: ZavorthSelfHealRisk;
  executor: string;
  evidence: string[];
  recommendedAction: string;
};

export type ZavorthSelfHealRecoveryAction = {
  id: string;
  flowId: ZavorthSelfHealFlowId;
  label: string;
  command: string;
  applyCommand: string | null;
  previewOnly: boolean;
  risk: ZavorthSelfHealRisk;
  requiresApproval: boolean;
  budgetCost: number;
  status: ZavorthSelfHealActionStatus;
  reason: string;
};

export type ZavorthSelfHealOutboxItem = {
  id: string;
  actionId: string;
  flowId: ZavorthSelfHealFlowId;
  approvalRequired: boolean;
  command: string;
  reason: string;
  status: 'proposed' | 'blocked' | 'sent';
};

export type ZavorthSelfHealBudget = {
  id: 'daily-report' | 'recovery' | 'watchdog';
  label: string;
  maxCost: number;
  estimatedCost: number;
  remainingCost: number;
  exceeded: boolean;
  reset: 'per-run' | 'daily';
};

export type ZavorthSelfHealDailyReport = {
  generatedAt: string;
  topFailures: string[];
  pendingItems: string[];
  proposedActions: string[];
  summary: string;
};

export type ZavorthSelfHealPlanSnapshot = {
  generatedAt: string;
  gate: 'self-heal-control-plane';
  surface: 'self-heal-control-plane';
  mode: ZavorthSelfHealMode;
  status: ZavorthSelfHealStatus;
  summary: {
    probes: number;
    issues: number;
    actions: number;
    pendingApproval: number;
    blocked: number;
    budgetCost: number;
    budgetLimit: number;
  };
  probes: ZavorthSelfHealProbe[];
  plan: ZavorthSelfHealRecoveryAction[];
  outbox: ZavorthSelfHealOutboxItem[];
  watchdog: {
    mode: 'lazy';
    enabled: false;
    alwaysOn: false;
    command: string;
    reason: string;
  };
  automationBudgets: ZavorthSelfHealBudget[];
  repetitionGuard: {
    failures: number;
    threshold: number;
    paused: boolean;
    reason: string | null;
    source: string;
  };
  dailyReport: ZavorthSelfHealDailyReport;
  execution: {
    attempted: boolean;
    status: string | null;
    summary: string | null;
    result: AutoRepairRunResult | null;
  };
  contracts: {
    previewDoesNotExecute: boolean;
    applyRespectsTrustPolicy: boolean;
    nothingAlwaysOnWithoutExplicitConfig: boolean;
    everyAutomationHasBudget: boolean;
    sensitiveRecoveryRequiresApproval: boolean;
    repeatedFailuresPause: boolean;
    brokenExecutorAttemptsStandardRecovery: boolean;
  };
  commands: {
    preview: string;
    apply: string;
    report: string;
    outbox: string;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

export type ZavorthSelfHealPlanInput = {
  live?: boolean;
  apply?: boolean;
  requestedBy?: string | null;
  budget?: number | null;
  force?: boolean;
  includeDaily?: boolean;
};

type SelfHealHealthService = Pick<OperationsHealthService, 'readSnapshotFast' | 'readSnapshotLive'>;
type SelfHealAutoRepairService = Pick<AutoRepairService, 'run' | 'readLastReport' | 'summarizeLastRun'>;

type ZavorthSelfHealRuntime = {
  now?: () => Date;
  operationsHealthService?: SelfHealHealthService | null;
  autoRepairService?: SelfHealAutoRepairService | null;
};

type FlowDefinition = {
  flowId: ZavorthSelfHealFlowId;
  label: string;
  executor: string;
  healthyEvidence: string;
  severity: ZavorthSelfHealRisk;
  actionLabel: string;
  command: string;
  applyCommand: string | null;
  risk: ZavorthSelfHealRisk;
  requiresApproval: boolean;
  budgetCost: number;
};

const FLOW_DEFINITIONS: Record<ZavorthSelfHealFlowId, FlowDefinition> = {
  sidecar_down: {
    flowId: 'sidecar_down',
    label: 'Sidecars',
    executor: 'runtime',
    healthyEvidence: 'Sidecars habilitados estao prontos ou dormentes por configuracao.',
    severity: 'medium',
    actionLabel: 'Recuperar sidecars',
    command: 'zavorth ops autorepair dryrun --json',
    applyCommand: 'zavorth ops autorepair --json',
    risk: 'medium',
    requiresApproval: false,
    budgetCost: 0.9,
  },
  runtime_slow: {
    flowId: 'runtime_slow',
    label: 'Runtime lento',
    executor: 'host',
    healthyEvidence: 'Nenhum timeout ou sinal de lentidao recente foi encontrado.',
    severity: 'low',
    actionLabel: 'Renovar diagnostico rapido',
    command: 'zavorth status --live --json',
    applyCommand: 'zavorth ops autorepair dryrun --json',
    risk: 'low',
    requiresApproval: false,
    budgetCost: 0.4,
  },
  publish_failed: {
    flowId: 'publish_failed',
    label: 'Publish',
    executor: 'release',
    healthyEvidence: 'There is no publish falho no snapshot operacional.',
    severity: 'high',
    actionLabel: 'Preparar reparo de publish',
    command: 'zavorth ops autorepair dryrun --json',
    applyCommand: 'zavorth ops autorepair --json',
    risk: 'high',
    requiresApproval: true,
    budgetCost: 1.6,
  },
  rollback_recommended: {
    flowId: 'rollback_recommended',
    label: 'Rollback',
    executor: 'release',
    healthyEvidence: 'Nenhum rollback foi recomendado pelo runtime.',
    severity: 'high',
    actionLabel: 'Abrir rollback guiado',
    command: 'npm run remote:rollback -- --dry-run',
    applyCommand: 'npm run remote:rollback',
    risk: 'high',
    requiresApproval: true,
    budgetCost: 1.4,
  },
  cache_growth: {
    flowId: 'cache_growth',
    label: 'Cache e temporarys',
    executor: 'storage',
    healthyEvidence: 'Hotspots de storage estao dentro do limite de revisao.',
    severity: 'medium',
    actionLabel: 'Planejar limpeza segura',
    command: 'zavorth ops quality --json',
    applyCommand: null,
    risk: 'medium',
    requiresApproval: true,
    budgetCost: 0.8,
  },
  remote_executor_session_lost: {
    flowId: 'remote_executor_session_lost',
    label: 'Executor remoto',
    executor: 'node-mesh',
    healthyEvidence: 'Transportes remotos nao reportaram perda de sessao.',
    severity: 'medium',
    actionLabel: 'Recuperaction padronizada do executor',
    command: 'zavorth ops autorepair dryrun --json',
    applyCommand: 'zavorth ops autorepair --json',
    risk: 'medium',
    requiresApproval: false,
    budgetCost: 0.9,
  },
  missing_config: {
    flowId: 'missing_config',
    label: 'Config e tokens',
    executor: 'config',
    healthyEvidence: 'Nenhum token ou provider obrigatorio parece ausente.',
    severity: 'high',
    actionLabel: 'Gerar checklist de configuracao',
    command: 'zavorth ops access --json',
    applyCommand: null,
    risk: 'high',
    requiresApproval: true,
    budgetCost: 0.7,
  },
  artifact_delivery_failed: {
    flowId: 'artifact_delivery_failed',
    label: 'Entrega de artefatos',
    executor: 'artifact-pipeline',
    healthyEvidence: 'Nenhuma falha recente de entrega de artefatos foi encontrada.',
    severity: 'medium',
    actionLabel: 'Revalidar entrega de artefatos',
    command: 'zavorth ops autorepair dryrun --json',
    applyCommand: 'zavorth ops autorepair --json',
    risk: 'medium',
    requiresApproval: false,
    budgetCost: 0.8,
  },
};

const FLOW_ORDER: ZavorthSelfHealFlowId[] = [
  'sidecar_down',
  'runtime_slow',
  'publish_failed',
  'rollback_recommended',
  'cache_growth',
  'remote_executor_session_lost',
  'missing_config',
  'artifact_delivery_failed',
];

export class ZavorthSelfHealControlPlaneService {
  private readonly now: () => Date;
  private readonly operationsHealthService: SelfHealHealthService | null;
  private readonly autoRepairService: SelfHealAutoRepairService | null;

  constructor(runtime: ZavorthSelfHealRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.operationsHealthService = runtime.operationsHealthService || null;
    this.autoRepairService = runtime.autoRepairService || null;
  }

  public async buildPreview(input: ZavorthSelfHealPlanInput = {}): Promise<ZavorthSelfHealPlanSnapshot> {
    return this.buildSnapshot({
      ...input,
      apply: input.apply === true,
      includeDaily: input.includeDaily === true,
    });
  }

  public async buildDailyReport(input: ZavorthSelfHealPlanInput = {}): Promise<ZavorthSelfHealPlanSnapshot> {
    return this.buildSnapshot({
      ...input,
      apply: false,
      includeDaily: true,
      mode: 'daily-report' as ZavorthSelfHealMode,
    } as ZavorthSelfHealPlanInput & { mode: ZavorthSelfHealMode });
  }

  private async buildSnapshot(
    input: ZavorthSelfHealPlanInput & { mode?: ZavorthSelfHealMode } = {},
  ): Promise<ZavorthSelfHealPlanSnapshot> {
    const generatedAt = this.now().toISOString();
    const mode = input.mode || (input.apply ? 'apply' : 'preview');
    const health = this.readHealthSnapshot(Boolean(input.live));
    const lastReport = this.readLastAutoRepairReport();
    const probes = this.buildProbes(health.snapshot, health.error);
    const repetitionGuard = this.buildRepetitionGuard(lastReport);
    const budgetLimit = this.positiveNumber(input.budget, 3);
    let plan = this.buildPlan(probes);
    const budgetCost = this.sumBudget(plan);
    const automationBudgets = this.buildBudgets(budgetLimit, budgetCost);
    const outbox = this.buildOutbox(plan);
    let execution: ZavorthSelfHealPlanSnapshot['execution'] = {
      attempted: false,
      status: null,
      summary: null,
      result: null,
    };

    let status: ZavorthSelfHealStatus = this.resolvePreviewStatus(probes, plan, repetitionGuard, budgetCost, budgetLimit);

    if (mode === 'apply') {
      const applyResult = await this.applySafePlan({
        plan,
        budgetCost,
        budgetLimit,
        repetitionGuard,
        requestedBy: input.requestedBy || null,
        force: Boolean(input.force),
      });
      plan = applyResult.plan;
      execution = applyResult.execution;
      status = applyResult.status;
    } else if (mode === 'daily-report') {
      status = repetitionGuard.paused ? 'paused' : status;
    }

    const dailyReport = this.buildDailyReportPayload(generatedAt, probes, plan, outbox, repetitionGuard);
    const summary = this.buildSummary(probes, plan, budgetCost, budgetLimit);
    const contracts = this.buildContracts({
      mode,
      plan,
      outbox,
      repetitionGuard,
      budgetCost,
      budgetLimit,
    });

    return {
      generatedAt,
      gate: 'self-heal-control-plane',
      surface: 'self-heal-control-plane',
      mode,
      status,
      summary,
      probes,
      plan,
      outbox,
      watchdog: {
        mode: 'lazy',
        enabled: false,
        alwaysOn: false,
        command: 'zavorth heal --preview --json',
        reason: 'Watchdog fica dormente; so roda quando configurado explicitamente por automacao com budget.',
      },
      automationBudgets,
      repetitionGuard,
      dailyReport,
      execution,
      contracts,
      commands: {
        preview: 'zavorth heal --preview --json',
        apply: 'zavorth heal --apply --json',
        report: 'zavorth heal report --json',
        outbox: 'zavorth heal --preview --json',
      },
      narrative: this.buildNarrative(status, summary, dailyReport),
    };
  }

  private readHealthSnapshot(live: boolean): {
    snapshot: Partial<OperationsHealthSnapshot> | null;
    error: string | null;
  } {
    if (!this.operationsHealthService) {
      return {
        snapshot: null,
        error: 'OperationsHealthService indisponivel neste runtime.',
      };
    }

    try {
      const snapshot = live
        ? this.operationsHealthService.readSnapshotLive()
        : this.operationsHealthService.readSnapshotFast();
      return { snapshot, error: null };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : String(error);
      return {
        snapshot: null,
        error: `Falha ao ler OperationsHealthService: ${message}`,
      };
    }
  }

  private readLastAutoRepairReport(): AutoRepairReport | null {
    if (!this.autoRepairService) {
      return null;
    }
    try {
      return this.autoRepairService.readLastReport();
    } catch (error: unknown) {logger.warn('[Zavorth Self Heal Control Plane] health check failed', error); return null; }
  }

  private buildProbes(
    snapshot: Partial<OperationsHealthSnapshot> | null,
    healthError: string | null,
  ): ZavorthSelfHealProbe[] {
    if (!snapshot) {
      return FLOW_ORDER.map((flowId) => {
        const definition = FLOW_DEFINITIONS[flowId];
        return {
          flowId,
          label: definition.label,
          status: flowId === 'runtime_slow' ? 'failed' : 'skipped',
          severity: flowId === 'runtime_slow' ? 'high' : definition.severity,
          executor: definition.executor,
          evidence: flowId === 'runtime_slow'
            ? [healthError || 'Snapshot operacional indisponivel.']
            : ['Probe depende do snapshot operacional.'],
          recommendedAction: flowId === 'runtime_slow'
            ? 'Restaurar leitura do snapshot operacional antes do apply.'
            : definition.actionLabel,
        };
      });
    }

    return FLOW_ORDER.map((flowId) => this.buildProbe(flowId, snapshot));
  }

  private buildProbe(
    flowId: ZavorthSelfHealFlowId,
    snapshot: Partial<OperationsHealthSnapshot>,
  ): ZavorthSelfHealProbe {
    const definition = FLOW_DEFINITIONS[flowId];
    const result = this.detectIssue(flowId, snapshot);
    const status: ZavorthSelfHealProbeStatus = result.issue
      ? result.failed ? 'failed' : 'attention'
      : 'healthy';
    return {
      flowId,
      label: definition.label,
      status,
      severity: result.issue ? result.severity || definition.severity : 'low',
      executor: definition.executor,
      evidence: result.issue ? result.evidence : [definition.healthyEvidence],
      recommendedAction: result.issue ? definition.actionLabel : 'Nenhuma acao necessaria.',
    };
  }

  private detectIssue(
    flowId: ZavorthSelfHealFlowId,
    snapshot: Partial<OperationsHealthSnapshot>,
  ): {
    issue: boolean;
    failed?: boolean;
    severity?: ZavorthSelfHealRisk;
    evidence: string[];
  } {
    const text = this.snapshotText(snapshot);
    const lastErrorText = this.errorText(snapshot);
    switch (flowId) {
      case 'sidecar_down':
        return this.detectSidecarDown(snapshot);
      case 'runtime_slow':
        return this.detectRuntimeSlow(snapshot, lastErrorText);
      case 'publish_failed':
        return this.detectPublishFailed(snapshot, lastErrorText);
      case 'rollback_recommended':
        return this.detectRollback(snapshot, text);
      case 'cache_growth':
        return this.detectCacheGrowth(snapshot);
      case 'remote_executor_session_lost':
        return this.detectRemoteSessionLost(snapshot, lastErrorText);
      case 'missing_config':
        return this.detectMissingConfig(snapshot, text);
      case 'artifact_delivery_failed':
        return this.detectArtifactDelivery(snapshot, lastErrorText);
      default:
        return { issue: false, evidence: [] };
    }
  }

  private detectSidecarDown(snapshot: Partial<OperationsHealthSnapshot>): {
    issue: boolean;
    failed?: boolean;
    severity?: ZavorthSelfHealRisk;
    evidence: string[];
  } {
    const sidecars = (snapshot as SelfHealDynamic).sidecars;
    if (!sidecars || typeof sidecars !== 'object') {
      return { issue: false, evidence: [] };
    }
    const cards = Array.isArray(sidecars)
      ? sidecars
      : Object.values(sidecars).filter((value) => value && typeof value === 'object');
    const failing = cards.filter((card: SidecarCard) =>
      card.enabled === true && (card.ready === false || card.running === false || /fail|down|erro|error/i.test(String(card.message || ''))));
    if (failing.length === 0) {
      const unhealthy = Number((sidecars as SidecarsSnapshot).down ?? (sidecars as SidecarsSnapshot).unhealthy ?? (sidecars as SidecarsSnapshot).failed ?? 0);
      if (unhealthy <= 0) {
        return { issue: false, evidence: [] };
      }
    }
    const evidence = failing.length > 0
      ? failing.map((card: SidecarCard) => `${card.name || card.id || 'sidecar'}: ${card.message || 'nao esta pronto'}`)
      : [`${Number((sidecars as SidecarsSnapshot).down ?? (sidecars as SidecarsSnapshot).unhealthy ?? (sidecars as SidecarsSnapshot).failed ?? 0)} sidecar(s) reportaram falha.`];
    return { issue: true, failed: true, severity: 'medium', evidence };
  }

  private detectRuntimeSlow(
    snapshot: Partial<OperationsHealthSnapshot>,
    lastErrorText: string,
  ): {
    issue: boolean;
    failed?: boolean;
    severity?: ZavorthSelfHealRisk;
    evidence: string[];
  } {
    const performance = (snapshot as SelfHealDynamic).performance || (snapshot as SelfHealDynamic).runtime || {};
    const p95 = Number(performance.runtimeP95Ms ?? performance.p95Ms ?? performance.latencyP95Ms ?? 0);
    if (Number.isFinite(p95) && p95 > 5_000) {
      return {
        issue: true,
        severity: p95 > 12_000 ? 'medium' : 'low',
        evidence: [`P95 do runtime em ${p95}ms.`],
      };
    }
    if (/\b(timeout|slow|lento|latency|hung|travou)\b/i.test(lastErrorText)) {
      return {
        issue: true,
        severity: 'low',
        evidence: [this.compact(lastErrorText, 180)],
      };
    }
    return { issue: false, evidence: [] };
  }

  private detectPublishFailed(
    snapshot: Partial<OperationsHealthSnapshot>,
    lastErrorText: string,
  ): {
    issue: boolean;
    failed?: boolean;
    severity?: ZavorthSelfHealRisk;
    evidence: string[];
  } {
    const publish = (snapshot as SelfHealDynamic).publish || {};
    const smoke = String(publish.smokeTest || publish.status || '').toLowerCase();
    const gitPush = String(publish.gitPush || '').toLowerCase();
    if (smoke === 'failed' || gitPush === 'failed' || /\bpublish\b.*\b(fail|failed|falhou|erro)\b/i.test(lastErrorText)) {
      return {
        issue: true,
        failed: true,
        severity: 'high',
        evidence: [
          publish.smokeTest ? `smokeTest=${publish.smokeTest}` : null,
          publish.gitPush ? `gitPush=${publish.gitPush}` : null,
          /\bpublish\b/i.test(lastErrorText) ? this.compact(lastErrorText, 160) : null,
        ].filter(Boolean) as string[],
      };
    }
    return { issue: false, evidence: [] };
  }

  private detectRollback(
    snapshot: Partial<OperationsHealthSnapshot>,
    snapshotText: string,
  ): {
    issue: boolean;
    failed?: boolean;
    severity?: ZavorthSelfHealRisk;
    evidence: string[];
  } {
    const publish = (snapshot as SelfHealDynamic).publish || {};
    const recommended = String(publish.recommendedAction || publish.recommendation || '');
    if (/\brollback|reverter|reversao\b/i.test(`${recommended}\n${snapshotText}`)) {
      return {
        issue: true,
        severity: 'high',
        evidence: [this.compact(recommended || 'Snapshot menciona rollback/reversao.', 160)],
      };
    }
    return { issue: false, evidence: [] };
  }

  private detectCacheGrowth(snapshot: Partial<OperationsHealthSnapshot>): {
    issue: boolean;
    failed?: boolean;
    severity?: ZavorthSelfHealRisk;
    evidence: string[];
  } {
    const storage = (snapshot as SelfHealDynamic).storage || {};
    const hotspots = (Array.isArray(storage.hotspots)
      ? storage.hotspots
      : Array.isArray((snapshot as SelfHealDynamic).storageHotspots)
        ? (snapshot as SelfHealDynamic).storageHotspots
        : []) as StorageHotspot[];
    const bigHotspots = hotspots.filter((entry: StorageHotspot) => Number(entry.bytes || 0) >= 512 * 1024 * 1024);
    const freePercent = Number(storage.freePercent ?? 100);
    if (bigHotspots.length > 0 || (Number.isFinite(freePercent) && freePercent < 12)) {
      return {
        issue: true,
        severity: freePercent < 8 ? 'high' : 'medium',
        evidence: [
          Number.isFinite(freePercent) ? `freePercent=${freePercent}` : null,
          ...bigHotspots.slice(0, 3).map((entry: StorageHotspot) =>
            `${entry.label || entry.id || 'hotspot'}=${this.formatBytes(Number(entry.bytes || 0))}`),
        ].filter(Boolean) as string[],
      };
    }
    return { issue: false, evidence: [] };
  }

  private detectRemoteSessionLost(
    snapshot: Partial<OperationsHealthSnapshot>,
    lastErrorText: string,
  ): {
    issue: boolean;
    failed?: boolean;
    severity?: ZavorthSelfHealRisk;
    evidence: string[];
  } {
    const doctor = (snapshot as SelfHealDynamic).remoteTransportDoctor || {};
    const status = String(doctor.status || '').toLowerCase();
    const failedItems = Array.isArray(doctor.items)
      ? doctor.items.filter((item: RemoteTransportItem) => /failed|missing|lost|expired/i.test(String(item.status || item.error || item.summary || '')))
      : [];
    if (status === 'failed' || failedItems.length > 0 || /\b(remote|executor|session|transport).*\b(lost|expired|falhou|failed)\b/i.test(lastErrorText)) {
      return {
        issue: true,
        failed: status === 'failed',
        severity: 'medium',
        evidence: [
          doctor.summary ? String(doctor.summary) : null,
          ...failedItems.slice(0, 3).map((item: RemoteTransportItem) =>
            `${item.transportId || 'transport'}: ${item.error || item.summary || item.status}`),
          /\b(remote|executor|session|transport)/i.test(lastErrorText) ? this.compact(lastErrorText, 160) : null,
        ].filter(Boolean) as string[],
      };
    }
    return { issue: false, evidence: [] };
  }

  private detectMissingConfig(
    snapshot: Partial<OperationsHealthSnapshot>,
    snapshotText: string,
  ): {
    issue: boolean;
    failed?: boolean;
    severity?: ZavorthSelfHealRisk;
    evidence: string[];
  } {
    const channelDoctor = (snapshot as SelfHealDynamic).channelProviderDoctor || {};
    const failedConfigs = Array.isArray(channelDoctor.items)
      ? channelDoctor.items.filter((item: ChannelConfigItem) => item.configured === false && item.status !== 'skipped')
      : [];
    if (
      failedConfigs.length > 0
      || /\b(token|secret|api key|apikey|config|provider).*\b(missing|ausente|not configured|nao configurado)\b/i.test(snapshotText)
    ) {
      return {
        issue: true,
        failed: failedConfigs.length > 0,
        severity: 'high',
        evidence: failedConfigs.length > 0
          ? failedConfigs.slice(0, 3).map((item: ChannelConfigItem) =>
              `${item.channelId || 'provider'}: ${item.error || item.summary || 'config ausente'}`)
          : [this.compact(snapshotText, 180)],
      };
    }
    return { issue: false, evidence: [] };
  }

  private detectArtifactDelivery(
    _snapshot: Partial<OperationsHealthSnapshot>,
    lastErrorText: string,
  ): {
    issue: boolean;
    failed?: boolean;
    severity?: ZavorthSelfHealRisk;
    evidence: string[];
  } {
    if (/\b(artifact|artefato|delivery|entrega).*\b(fail|failed|falhou|erro|missing)\b/i.test(lastErrorText)) {
      return {
        issue: true,
        failed: true,
        severity: 'medium',
        evidence: [this.compact(lastErrorText, 180)],
      };
    }
    return { issue: false, evidence: [] };
  }

  private buildPlan(probes: ZavorthSelfHealProbe[]): ZavorthSelfHealRecoveryAction[] {
    return probes
      .filter((probe) => probe.status === 'attention' || probe.status === 'failed')
      .map((probe) => {
        const definition = FLOW_DEFINITIONS[probe.flowId];
        return {
          id: `heal:${probe.flowId}`,
          flowId: probe.flowId,
          label: definition.actionLabel,
          command: definition.command,
          applyCommand: definition.applyCommand,
          previewOnly: definition.applyCommand === null,
          risk: definition.risk,
          requiresApproval: definition.requiresApproval,
          budgetCost: definition.budgetCost,
          status: definition.requiresApproval ? 'pending_approval' : 'planned',
          reason: probe.evidence[0] || probe.recommendedAction,
        };
      });
  }

  private async applySafePlan(input: {
    plan: ZavorthSelfHealRecoveryAction[];
    budgetCost: number;
    budgetLimit: number;
    repetitionGuard: ZavorthSelfHealPlanSnapshot['repetitionGuard'];
    requestedBy: string | null;
    force: boolean;
  }): Promise<{
    plan: ZavorthSelfHealRecoveryAction[];
    status: ZavorthSelfHealStatus;
    execution: ZavorthSelfHealPlanSnapshot['execution'];
  }> {
    if (input.plan.length === 0) {
      return {
        plan: input.plan,
        status: 'applied',
        execution: {
          attempted: false,
          status: 'noop',
          summary: 'Nenhuma recuperacao necessaria no momento.',
          result: null,
        },
      };
    }

    if (input.repetitionGuard.paused) {
      return {
        plan: input.plan.map((action) => ({ ...action, status: 'blocked' })),
        status: 'paused',
        execution: {
          attempted: false,
          status: 'paused',
          summary: input.repetitionGuard.reason,
          result: null,
        },
      };
    }

    if (input.budgetCost > input.budgetLimit) {
      return {
        plan: input.plan.map((action) => ({ ...action, status: 'blocked' })),
        status: 'paused',
        execution: {
          attempted: false,
          status: 'budget_exceeded',
          summary: `Budget estimado ${input.budgetCost} excede limite ${input.budgetLimit}.`,
          result: null,
        },
      };
    }

    if (input.plan.some((action) => action.requiresApproval || action.previewOnly || action.risk === 'high')) {
      return {
        plan: input.plan.map((action) => ({
          ...action,
          status: action.requiresApproval || action.previewOnly || action.risk === 'high'
            ? 'pending_approval'
            : action.status,
        })),
        status: 'blocked',
        execution: {
          attempted: false,
          status: 'approval_required',
          summary: 'Plano contem recuperacao sensivel; ficou na outbox para aprovacao.',
          result: null,
        },
      };
    }

    if (!this.autoRepairService) {
      return {
        plan: input.plan.map((action) => ({ ...action, status: 'blocked' })),
        status: 'blocked',
        execution: {
          attempted: false,
          status: 'autorepair_unavailable',
          summary: 'AutoRepairService indisponivel neste runtime.',
          result: null,
        },
      };
    }

    const result = await this.autoRepairService.run({
      dryRun: false,
      force: input.force,
      goal: 'auto',
      requestedBy: input.requestedBy || 'cli-operator',
      reason: 'Self-Heal aplicou recuperaction segura e supervisionada.',
    } as AutoRepairRunInput);

    return {
      plan: input.plan.map((action) => ({ ...action, status: result.success ? 'applied' : 'blocked' })),
      status: result.success ? 'applied' : 'blocked',
      execution: {
        attempted: true,
        status: result.status,
        summary: result.summary,
        result,
      },
    };
  }

  private buildRepetitionGuard(report: AutoRepairReport | null): ZavorthSelfHealPlanSnapshot['repetitionGuard'] {
    if (!report) {
      return {
        failures: 0,
        threshold: 2,
        paused: false,
        reason: null,
        source: 'sem relatorio anterior de autorepair',
      };
    }

    const reportDynamic = report as AutoRepairReportDynamic;
    const attempts = Array.isArray(reportDynamic.attempts) ? reportDynamic.attempts : [];
    const failedAttempts = attempts.filter((attempt) =>
      /failed|blocked|error/i.test(String(attempt.status || ''))).length;
    const statusFailed = /failed|blocked|error/i.test(String(reportDynamic.status || '')) ? 1 : 0;
    const warnings = Array.isArray(reportDynamic.warnings) ? reportDynamic.warnings : [];
    const repeatedWarning = warnings.some((warning) => /\brepeat|repet|loop|flap\b/i.test(String(warning || '')));
    const failures = Math.max(failedAttempts, statusFailed + (repeatedWarning ? 2 : 0));
    const paused = failures >= 2;

    return {
      failures,
      threshold: 2,
      paused,
      reason: paused
        ? 'Falhas repetidas detectadas; self-heal pausou para evitar loop infinito.'
        : null,
      source: `autorepair:${String(reportDynamic.status || 'unknown')}`,
    };
  }

  private buildOutbox(plan: ZavorthSelfHealRecoveryAction[]): ZavorthSelfHealOutboxItem[] {
    return plan
      .filter((action) => action.requiresApproval || action.previewOnly || action.risk === 'high')
      .map((action) => ({
        id: `outbox:${action.id}`,
        actionId: action.id,
        flowId: action.flowId,
        approvalRequired: true,
        command: action.applyCommand || action.command,
        reason: action.previewOnly
          ? `${action.label} precisa de aprovacao/manualizacao antes de executar.`
          : action.reason,
        status: 'proposed',
      }));
  }

  private buildBudgets(budgetLimit: number, budgetCost: number): ZavorthSelfHealBudget[] {
    return [
      {
        id: 'daily-report',
        label: 'Relatorio diario opcional',
        maxCost: 0.6,
        estimatedCost: 0.2,
        remainingCost: 0.4,
        exceeded: false,
        reset: 'daily',
      },
      {
        id: 'recovery',
        label: 'Recuperaction supervisionada',
        maxCost: budgetLimit,
        estimatedCost: Number(budgetCost.toFixed(2)),
        remainingCost: Number((budgetLimit - budgetCost).toFixed(2)),
        exceeded: budgetCost > budgetLimit,
        reset: 'per-run',
      },
      {
        id: 'watchdog',
        label: 'Watchdog lazy',
        maxCost: 1,
        estimatedCost: 0,
        remainingCost: 1,
        exceeded: false,
        reset: 'daily',
      },
    ];
  }

  private buildDailyReportPayload(
    generatedAt: string,
    probes: ZavorthSelfHealProbe[],
    plan: ZavorthSelfHealRecoveryAction[],
    outbox: ZavorthSelfHealOutboxItem[],
    repetitionGuard: ZavorthSelfHealPlanSnapshot['repetitionGuard'],
  ): ZavorthSelfHealDailyReport {
    const failed = probes.filter((probe) => probe.status === 'failed' || probe.status === 'attention');
    const topFailures = failed.length > 0
      ? failed.slice(0, 5).map((probe) => `${probe.label}: ${probe.evidence[0] || probe.status}`)
      : ['Nenhuma falha operacional prioritizada hoje.'];
    const pendingItems = [
      ...outbox.map((item) => `${item.actionId}: aprovacao pendente`),
      repetitionGuard.paused ? repetitionGuard.reason : null,
    ].filter(Boolean) as string[];
    const proposedActions = plan.length > 0
      ? plan.slice(0, 5).map((action) => `${action.label}: ${action.command}`)
      : ['Manter self-heal em preview e revisar novamente no proximo ciclo.'];

    return {
      generatedAt,
      topFailures,
      pendingItems: pendingItems.length > 0 ? pendingItems : ['Nenhuma pendencia bloqueante.'],
      proposedActions,
      summary: failed.length > 0
        ? `${failed.length} fluxo(s) precisam de atencao; ${outbox.length} item(ns) ficaram na outbox.`
        : 'Operacao continua sem recuperacao pendente.',
    };
  }

  private resolvePreviewStatus(
    probes: ZavorthSelfHealProbe[],
    plan: ZavorthSelfHealRecoveryAction[],
    repetitionGuard: ZavorthSelfHealPlanSnapshot['repetitionGuard'],
    budgetCost: number,
    budgetLimit: number,
  ): ZavorthSelfHealStatus {
    if (repetitionGuard.paused || budgetCost > budgetLimit) {
      return 'paused';
    }
    if (plan.some((action) => action.requiresApproval || action.risk === 'high')) {
      return 'blocked';
    }
    if (probes.some((probe) => probe.status === 'failed' || probe.status === 'attention')) {
      return 'ready';
    }
    return 'ready';
  }

  private buildSummary(
    probes: ZavorthSelfHealProbe[],
    plan: ZavorthSelfHealRecoveryAction[],
    budgetCost: number,
    budgetLimit: number,
  ): ZavorthSelfHealPlanSnapshot['summary'] {
    return {
      probes: probes.length,
      issues: probes.filter((probe) => probe.status === 'failed' || probe.status === 'attention').length,
      actions: plan.length,
      pendingApproval: plan.filter((action) => action.status === 'pending_approval' || action.requiresApproval).length,
      blocked: plan.filter((action) => action.status === 'blocked').length,
      budgetCost: Number(budgetCost.toFixed(2)),
      budgetLimit,
    };
  }

  private buildContracts(input: {
    mode: ZavorthSelfHealMode;
    plan: ZavorthSelfHealRecoveryAction[];
    outbox: ZavorthSelfHealOutboxItem[];
    repetitionGuard: ZavorthSelfHealPlanSnapshot['repetitionGuard'];
    budgetCost: number;
    budgetLimit: number;
  }): ZavorthSelfHealPlanSnapshot['contracts'] {
    const sensitive = input.plan.filter((action) => action.requiresApproval || action.risk === 'high' || action.previewOnly);
    const remoteAction = input.plan.find((action) => action.flowId === 'remote_executor_session_lost');
    return {
      previewDoesNotExecute: input.mode !== 'preview' || input.plan.every((action) => action.status !== 'applied'),
      applyRespectsTrustPolicy: input.mode !== 'apply'
        || sensitive.every((action) => action.status === 'pending_approval' || action.status === 'blocked'),
      nothingAlwaysOnWithoutExplicitConfig: true,
      everyAutomationHasBudget: true,
      sensitiveRecoveryRequiresApproval: sensitive.every((action) =>
        input.outbox.some((item) => item.actionId === action.id && item.approvalRequired)),
      repeatedFailuresPause: !input.repetitionGuard.paused || input.repetitionGuard.reason !== null,
      brokenExecutorAttemptsStandardRecovery: !remoteAction || remoteAction.command.includes('ops autorepair dryrun'),
    };
  }

  private buildNarrative(
    status: ZavorthSelfHealStatus,
    summary: ZavorthSelfHealPlanSnapshot['summary'],
    dailyReport: ZavorthSelfHealDailyReport,
  ): ZavorthSelfHealPlanSnapshot['narrative'] {
    if (summary.issues === 0) {
      return {
        headline: 'Self-Heal nao encontrou recuperacoes obrigatorias.',
        operatorSummary: 'Watchdog permanece lazy e o relatorio diario esta pronto para auditoria.',
      };
    }
    if (status === 'paused') {
      return {
        headline: 'Self-Heal pausou antes de executar.',
        operatorSummary: 'Budget ou repeticao de falhas exige revisao humana antes de continuar.',
      };
    }
    if (status === 'blocked') {
      return {
        headline: 'Self-Heal preparou acoes, mas aguardou aprovacao.',
        operatorSummary: dailyReport.summary,
      };
    }
    if (status === 'applied') {
      return {
        headline: 'Self-Heal aplicou recuperaction supervisionada.',
        operatorSummary: `${summary.actions} acao(oes) processadas com budget ${summary.budgetCost}/${summary.budgetLimit}.`,
      };
    }
    return {
      headline: 'Self-Heal gerou um plano de recuperaction seguro.',
      operatorSummary: `${summary.actions} acao(oes) prontas para apply supervisionado.`,
    };
  }

  private sumBudget(plan: ZavorthSelfHealRecoveryAction[]): number {
    return Number(plan.reduce((total, action) => total + action.budgetCost, 0).toFixed(2));
  }

  private errorText(snapshot: Partial<OperationsHealthSnapshot>): string {
    const errors = (snapshot as SelfHealDynamic).errors || {};
    const last = errors.lastError || null;
    const recent = Array.isArray(errors.recent) ? errors.recent : [];
    return [
      last?.message,
      last?.category,
      ...recent.map((entry: ErrorEntry) => `${entry.category || ''} ${entry.message || ''}`),
    ].filter(Boolean).join('\n');
  }

  private snapshotText(snapshot: Partial<OperationsHealthSnapshot>): string {
    try {
      return JSON.stringify(snapshot).slice(0, 20_000);
    } catch (error: unknown) {logger.warn('[Zavorth Self Heal Control Plane] health check failed', error); return ''; }
  }

  private compact(value: string | null | undefined, maxLength = 120): string {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) {
      return normalized || 'nao informado';
    }
    return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
  }

  private formatBytes(value: number): string {
    if (!Number.isFinite(value) || value <= 0) {
      return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let current = value;
    let unitIndex = 0;
    while (current >= 1024 && unitIndex < units.length - 1) {
      current /= 1024;
      unitIndex += 1;
    }
    return `${current.toFixed(current >= 10 ? 0 : 1)} ${units[unitIndex]}`;
  }

  private positiveNumber(value: number | null | undefined, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return Number(parsed.toFixed(2));
  }
}
