import { config } from '../config/index.js';
import type { ComputerUseWatchModeService, WatchModeRunSnapshot, WatchModeSnapshot } from './ComputerUseWatchModeService.js';
import { ComputerUseWatchModePolicyFileService } from './ComputerUseWatchModePolicyFileService.js';
import { ComputerUseWatchModeStateFileService } from './ComputerUseWatchModeStateFileService.js';

type WatchModePosture = 'healthy' | 'attention' | 'critical';
type WatchModeSeverity = 'info' | 'warn' | 'critical';
type WatchModeOperationalCostLevel = 'low' | 'moderate' | 'high';

type WatchModeRuntimeLike = Pick<ComputerUseWatchModeService, 'buildSnapshot'>;
type WatchModePolicyLike = Pick<ComputerUseWatchModePolicyFileService, 'readPolicy'>;
type WatchModeStateLike = Pick<ComputerUseWatchModeStateFileService, 'readSnapshot'>;

type WatchModeControlPlaneDeps = {
  now?: () => Date;
  workspaceRoot?: string | null;
  watchModeService?: WatchModeRuntimeLike | null;
  policyFileService?: WatchModePolicyLike | null;
  stateFileService?: WatchModeStateLike | null;
};

export type ZavorthWatchModeControlPlaneSnapshot = {
  generatedAt: string;
  workspaceRoot: string;
  summary: {
    posture: WatchModePosture;
    totalRuns: number;
    activeStatus: string;
    pendingApprovals: number;
    artifactEntries: number;
    throttledScreenshots: number;
    droppedTimelineEntries: number;
    expiredArtifacts: number;
    deletedScreenshotBytes: number;
    activeVisualHandles: number;
    averageApprovalLatencyMs: number;
    pausedRuns: number;
    failedRuns: number;
    completedRuns: number;
    strictApprovalDefault: boolean;
    allowedApps: number;
    allowedSites: number;
    maxIterations: number;
    maxDurationMs: number;
    maxScreenshots: number;
    screenshotTtlMs: number;
    maxScreenshotBytes: number;
    screenshotRedactionMode: string;
    sensitiveScreenPolicy: string;
  };
  cost: {
    level: WatchModeOperationalCostLevel;
    score: number;
    summary: string;
  };
  cards: Array<{
    id: 'status' | 'policy' | 'approvals' | 'replay';
    label: string;
    posture: WatchModePosture;
    summary: string;
    nextAction: string;
    command: string | null;
  }>;
  actions: Array<{
    id: string;
    label: string;
    severity: WatchModeSeverity;
    reason: string;
    command: string | null;
  }>;
  watchMode: WatchModeSnapshot;
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};

export class ZavorthWatchModeControlPlaneService {
  private readonly now: () => Date;
  private readonly workspaceRoot: string;
  private readonly watchMode: WatchModeRuntimeLike | null;
  private readonly policyFileService: WatchModePolicyLike;
  private readonly stateFileService: WatchModeStateLike;

  constructor(runtime: WatchModeControlPlaneDeps = {}) {
    this.now = runtime.now || (() => new Date());
    this.workspaceRoot = this.text(runtime.workspaceRoot, config.projectRoot || process.cwd());
    this.watchMode = runtime.watchModeService || null;
    this.policyFileService = runtime.policyFileService || new ComputerUseWatchModePolicyFileService();
    this.stateFileService = runtime.stateFileService || new ComputerUseWatchModeStateFileService();
  }

  public buildSnapshot(input: { limit?: number } = {}): ZavorthWatchModeControlPlaneSnapshot {
    const limit = Math.max(1, Number(input.limit || 8) || 8);
    const watchMode = this.readWatchModeSnapshot(limit);
    const activeRun = watchMode.activeRun || watchMode.runs[0] || null;
    const summarisedRuns = watchMode.runs.length > 0 ? watchMode.runs : activeRun ? [activeRun] : [];
    const runsWithLatency = summarisedRuns.filter((entry) => Number(entry?.buffers?.approvalDecisions || 0) > 0);
    const approvalDecisionCount = runsWithLatency.reduce(
      (total, entry) => total + Number(entry?.buffers?.approvalDecisions || 0),
      0,
    );
    const approvalLatencyTotalMs = runsWithLatency.reduce(
      (total, entry) => total + (Number(entry?.buffers?.averageApprovalLatencyMs || 0) * Number(entry?.buffers?.approvalDecisions || 0)),
      0,
    );
    const summary = {
      posture: this.resolvePosture(watchMode, activeRun),
      totalRuns: Number(watchMode.summary?.totalRuns || watchMode.runs.length || 0),
      activeStatus: this.text(activeRun?.status, this.text(watchMode.summary?.lastStatus, 'idle')),
      pendingApprovals: Number(watchMode.summary?.pendingApprovals || activeRun?.pendingApprovalCount || 0),
      artifactEntries: Number(watchMode.summary?.artifactEntries || summarisedRuns.reduce((total, entry) => total + Number(entry?.buffers?.artifactEntries || entry?.artifacts?.length || 0), 0)),
      throttledScreenshots: Number(watchMode.summary?.throttledScreenshots || summarisedRuns.reduce((total, entry) => total + Number(entry?.buffers?.throttledScreenshots || 0), 0)),
      droppedTimelineEntries: Number(watchMode.summary?.droppedTimelineEntries || summarisedRuns.reduce((total, entry) => total + Number(entry?.buffers?.droppedTimelineEntries || 0), 0)),
      expiredArtifacts: Number(watchMode.summary?.expiredArtifacts || summarisedRuns.reduce((total, entry) => total + Number(entry?.buffers?.expiredArtifacts || 0), 0)),
      deletedScreenshotBytes: Number(watchMode.summary?.deletedScreenshotBytes || summarisedRuns.reduce((total, entry) => total + Number(entry?.buffers?.deletedScreenshotBytes || 0), 0)),
      activeVisualHandles: Number(watchMode.summary?.activeVisualHandles || summarisedRuns.reduce((total, entry) => total + Number(entry?.buffers?.activeVisualHandles || 0), 0)),
      averageApprovalLatencyMs: Number(watchMode.summary?.averageApprovalLatencyMs || (
        approvalDecisionCount > 0
          ? Math.round(approvalLatencyTotalMs / approvalDecisionCount)
          : 0
      )),
      pausedRuns: Number(watchMode.summary?.pausedRuns || watchMode.runs.filter((entry) => this.text(entry?.status) === 'paused').length || 0),
      failedRuns: watchMode.runs.filter((entry) => this.text(entry?.status) === 'failed').length,
      completedRuns: watchMode.runs.filter((entry) => this.text(entry?.status) === 'completed').length,
      strictApprovalDefault: watchMode.policy.strictApprovalDefault !== false,
      allowedApps: Array.isArray(watchMode.policy.allowedApps) ? watchMode.policy.allowedApps.length : 0,
      allowedSites: Array.isArray(watchMode.policy.allowedSites) ? watchMode.policy.allowedSites.length : 0,
      maxIterations: Number(watchMode.policy.defaultBudget?.maxIterations || 8),
      maxDurationMs: Number(watchMode.policy.defaultBudget?.maxDurationMs || 10 * 60 * 1000),
      maxScreenshots: Number(watchMode.policy.defaultBudget?.maxScreenshots || 24),
      screenshotTtlMs: Number(watchMode.policy.screenshotTtlMs || watchMode.policy.defaultBudget?.screenshotTtlMs || 24 * 60 * 60 * 1000),
      maxScreenshotBytes: Number(watchMode.policy.maxScreenshotBytes || watchMode.policy.defaultBudget?.maxScreenshotBytes || 250 * 1024 * 1024),
      screenshotRedactionMode: this.text(watchMode.policy.screenshotRedactionMode, 'redacted'),
      sensitiveScreenPolicy: this.text(watchMode.policy.sensitiveScreenPolicy, 'pause'),
    };
    const cost = this.buildOperationalCost(summary);
    const cards = this.buildCards(watchMode, activeRun, summary);
    const actions = this.buildActions(watchMode, activeRun, summary);
    return {
      generatedAt: this.now().toISOString(),
      workspaceRoot: this.workspaceRoot,
      summary,
      cost,
      cards,
      actions,
      watchMode,
      narrative: {
        headline: 'Watch mode: Watch Mode supervisionado',
        operatorSummary: this.buildOperatorSummary(activeRun, summary, watchMode),
        nextAction: actions[0]?.label || 'Ligar o Watch Mode somente quando existir um objetivo visual claro.',
      },
    };
  }

  public renderReport(input: { limit?: number } = {}): string {
    const snapshot = this.buildSnapshot(input);
    const lines = [
      'Watch mode: Watch Mode supervisionado',
      '',
      snapshot.narrative.operatorSummary,
      `Postura: ${snapshot.summary.posture}.`,
      `Runs: ${snapshot.summary.totalRuns} total | status ativo ${snapshot.summary.activeStatus} | approvals ${snapshot.summary.pendingApprovals}.`,
      `Buffers: artifacts ${snapshot.summary.artifactEntries} | throttled screenshots ${snapshot.summary.throttledScreenshots} | dropped timeline ${snapshot.summary.droppedTimelineEntries} | handles ${snapshot.summary.activeVisualHandles}.`,
      `Custo operacional: ${snapshot.cost.level} (${snapshot.cost.score}/100) | ${snapshot.cost.summary}`,
      `Policy: strict default ${snapshot.summary.strictApprovalDefault ? 'on' : 'off'} | apps ${snapshot.summary.allowedApps} | sites ${snapshot.summary.allowedSites} | redaction ${snapshot.summary.screenshotRedactionMode}/${snapshot.summary.sensitiveScreenPolicy}.`,
      `Budget default: iteracoes ${snapshot.summary.maxIterations} | duracao ${snapshot.summary.maxDurationMs}ms | screenshots ${snapshot.summary.maxScreenshots} | TTL ${snapshot.summary.screenshotTtlMs}ms.`,
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
    lines.push(
      '',
      'Comandos uteis:',
      '- /watchmode para ler esta mesma postura no chat.',
      '- /watchmode strict off para reduzir friccao quando o app/site ja for conhecido.',
      '- /watchmode allow-app <janela> para promover a janela atual na allowlist.',
      '- /watchmode allow-site <host> para promover o site atual na allowlist.',
      '- npm run ops:watch-mode para revisar ou ajustar o Watch Mode pela CLI.',
    );
    return lines.join('\n');
  }

  private readWatchModeSnapshot(limit: number): WatchModeSnapshot {
    if (this.watchMode) {
      return this.watchMode.buildSnapshot(limit);
    }
    const persisted = this.stateFileService.readSnapshot();
    if (persisted) {
      return {
        ...persisted,
        runs: Array.isArray(persisted.runs) ? persisted.runs.slice(0, limit) : [],
      };
    }
    const policy = this.policyFileService.readPolicy();
    return {
      generatedAt: this.now().toISOString(),
      summary: {
        totalRuns: 0,
        runningRuns: 0,
        pausedRuns: 0,
        waitingApprovalRuns: 0,
        pendingApprovals: 0,
        artifactEntries: 0,
        throttledScreenshots: 0,
        droppedTimelineEntries: 0,
        expiredArtifacts: 0,
        deletedScreenshotBytes: 0,
        activeVisualHandles: 0,
        averageApprovalLatencyMs: 0,
        lastStatus: 'idle',
      },
      policy: {
        strictApprovalDefault: policy.strictApprovalDefault !== false,
        allowedApps: Array.isArray(policy.allowedApps) ? policy.allowedApps.slice() : [],
        allowedSites: Array.isArray(policy.allowedSites) ? policy.allowedSites.slice() : [],
        screenshotTtlMs: policy.screenshotTtlMs,
        maxScreenshotBytes: policy.maxScreenshotBytes,
        screenshotRedactionMode: policy.screenshotRedactionMode,
        sensitiveScreenPolicy: policy.sensitiveScreenPolicy,
        defaultBudget: { ...policy.defaultBudget },
      },
      activeRun: null,
      runs: [],
    };
  }

  private buildCards(
    watchMode: WatchModeSnapshot,
    activeRun: WatchModeRunSnapshot | null,
    summary: ZavorthWatchModeControlPlaneSnapshot['summary'],
  ): ZavorthWatchModeControlPlaneSnapshot['cards'] {
    const timelineCount = Array.isArray(activeRun?.timeline) ? activeRun!.timeline.length : 0;
    const approvalCount = summary.pendingApprovals;
    return [
      {
        id: 'status',
        label: 'Status supervisionado',
        posture: summary.activeStatus === 'failed'
          ? 'critical'
          : (summary.activeStatus === 'running' || summary.activeStatus === 'paused' || summary.activeStatus === 'waiting_approval'
            ? 'attention'
            : 'healthy'),
        summary: activeRun
          ? `${this.text(activeRun.targetWindow, 'janela')} | ${this.text(activeRun.objective, 'objetivo nao informado')}.`
          : 'Nenhum run visual ativo ou recente o bastante para o resumo curto.',
        nextAction: activeRun?.nextOperatorStep || 'Inicie um run visual somente quando existir um objetivo claro.',
        command: 'npm run ops:watch-mode',
      },
      {
        id: 'policy',
        label: 'Policy e allowlists',
        posture: watchMode.policy.strictApprovalDefault === false && summary.allowedApps === 0 && summary.allowedSites === 0
          ? 'attention'
          : 'healthy',
        summary: `strict ${watchMode.policy.strictApprovalDefault === false ? 'off' : 'on'} | apps ${summary.allowedApps} | sites ${summary.allowedSites}.`,
        nextAction: activeRun?.allowlist?.mode === 'guarded'
          ? 'Se o app/site for recorrente e seguro, promova-o para allowlist antes da proxima sessao.'
          : 'Mantenha o default estrito e libere excecoes so quando fizer sentido operacional.',
        command: '/watchmode strict on',
      },
      {
        id: 'approvals',
        label: 'Approvals e handoffs',
        posture: approvalCount > 0 ? 'attention' : 'healthy',
        summary: approvalCount > 0
          ? `${approvalCount} approval(s) aguardando decisao humana.`
          : 'Nenhum approval pendente no momento.',
        nextAction: approvalCount > 0
          ? 'Revise o screenshot atual e aprove ou negue a proxima acao mutavel.'
          : 'A fila esta limpa; siga monitorando a timeline visual.',
        command: '/watchmode',
      },
      {
        id: 'replay',
        label: 'Replay visual',
        posture: timelineCount > 0 || this.text(activeRun?.latestScreenshotPath)
          ? 'healthy'
          : (summary.activeStatus === 'running' ? 'attention' : 'healthy'),
        summary: timelineCount > 0
          ? `${timelineCount} evento(s) recentes | artifacts ${Number(activeRun?.buffers?.artifactEntries || activeRun?.artifacts?.length || 0)} | throttled ${Number(activeRun?.buffers?.throttledScreenshots || 0)}.`
          : 'Sem timeline visual suficiente no resumo atual.',
        nextAction: timelineCount > 0
          ? 'Use o replay curto para auditar o que aconteceu antes de repetir a acao.'
          : 'Assim que o run capturar tela, a auditoria visual aparece aqui.',
        command: 'GET /api/web/watch-mode',
      },
    ];
  }

  private buildActions(
    watchMode: WatchModeSnapshot,
    activeRun: WatchModeRunSnapshot | null,
    summary: ZavorthWatchModeControlPlaneSnapshot['summary'],
  ): ZavorthWatchModeControlPlaneSnapshot['actions'] {
    const actions: ZavorthWatchModeControlPlaneSnapshot['actions'] = [];
    if (summary.pendingApprovals > 0) {
      actions.push({
        id: 'review-approvals',
        label: 'Decidir approvals pendentes',
        severity: 'warn',
        reason: `${summary.pendingApprovals} approval(s) ainda bloqueiam a proxima acao visual.`,
        command: '/watchmode',
      });
    }
    if (this.text(activeRun?.status) === 'failed') {
      actions.push({
        id: 'review-failure',
        label: 'Revisar falha do ultimo run',
        severity: 'critical',
        reason: this.text(activeRun?.lastError, 'O ultimo run terminou com falha visual.'),
        command: 'npm run ops:watch-mode',
      });
    }
    if (activeRun?.allowlist?.mode === 'guarded' && this.text(activeRun?.targetWindow)) {
      actions.push({
        id: 'allow-current-app',
        label: 'Promover a janela atual para allowlist',
        severity: 'info',
        reason: `A janela ${this.text(activeRun.targetWindow, 'atual')} ainda roda em modo guarded.`,
        command: `/watchmode allow-app ${this.text(activeRun.targetWindow, '')}`,
      });
    }
    const siteHost = this.extractSiteHost(activeRun?.siteUrl);
    if (activeRun?.allowlist?.mode === 'guarded' && siteHost) {
      actions.push({
        id: 'allow-current-site',
        label: 'Promover o site atual para allowlist',
        severity: 'info',
        reason: `O host ${siteHost} ainda nao esta na allowlist do Watch Mode.`,
        command: `/watchmode allow-site ${siteHost}`,
      });
    }
    if (actions.length === 0) {
      actions.push({
        id: 'review-status',
        label: 'Revisar a postura do Watch Mode',
        severity: 'info',
        reason: 'O Watch Mode esta sem pendencias urgentes; mantenha a policy e a auditoria prontas para o proximo run.',
        command: 'npm run ops:watch-mode',
      });
    }
    return actions.slice(0, 6);
  }

  private resolvePosture(watchMode: WatchModeSnapshot, activeRun: WatchModeRunSnapshot | null): WatchModePosture {
    const activeStatus = this.text(activeRun?.status, this.text(watchMode.summary?.lastStatus, 'idle'));
    if (activeStatus === 'failed') {
      return 'critical';
    }
    if (
      Number(watchMode.summary?.pendingApprovals || activeRun?.pendingApprovalCount || 0) > 0
      || activeStatus === 'running'
      || activeStatus === 'paused'
      || activeStatus === 'waiting_approval'
    ) {
      return 'attention';
    }
    return 'healthy';
  }

  private buildOperatorSummary(
    activeRun: WatchModeRunSnapshot | null,
    summary: ZavorthWatchModeControlPlaneSnapshot['summary'],
    watchMode: WatchModeSnapshot,
  ): string {
    if (!activeRun) {
      return `Watch Mode pronto para cold start supervisionado, com strict default ${watchMode.policy.strictApprovalDefault === false ? 'off' : 'on'} e ${summary.allowedApps + summary.allowedSites} item(ns) em allowlist.`;
    }
    return `${this.text(activeRun.targetWindow, 'Janela')} esta em ${summary.activeStatus}, com ${summary.pendingApprovals} approval(s), ${summary.artifactEntries} artifact(s) e ${summary.throttledScreenshots} screenshot(s) compactados no buffer atual.`;
  }

  private buildOperationalCost(
    summary: ZavorthWatchModeControlPlaneSnapshot['summary'],
  ): ZavorthWatchModeControlPlaneSnapshot['cost'] {
    const latencyPressure =
      summary.averageApprovalLatencyMs >= 5_000
        ? 15
        : summary.averageApprovalLatencyMs >= 2_000
          ? 8
          : summary.averageApprovalLatencyMs >= 750
            ? 4
            : 0;
    const rawScore = (
      (summary.pendingApprovals * 25)
      + (summary.artifactEntries * 3)
      + (summary.throttledScreenshots * 4)
      + (summary.droppedTimelineEntries * 5)
      + (summary.activeVisualHandles * 20)
      + latencyPressure
    );
    const score = Math.max(0, Math.min(100, rawScore));
    const level: WatchModeOperationalCostLevel = score >= 60
      ? 'high'
      : score >= 25
        ? 'moderate'
        : 'low';
    const drivers: string[] = [];
    if (summary.pendingApprovals > 0) {
      drivers.push(`${summary.pendingApprovals} approval(s) pendente(s)`);
    }
    if (summary.averageApprovalLatencyMs > 0) {
      drivers.push(`latencia media ${summary.averageApprovalLatencyMs}ms`);
    }
    if (summary.throttledScreenshots > 0) {
      drivers.push(`${summary.throttledScreenshots} screenshot(s) compactados`);
    }
    if (summary.droppedTimelineEntries > 0) {
      drivers.push(`${summary.droppedTimelineEntries} evento(s) descartado(s)`);
    }
    if (summary.activeVisualHandles > 0) {
      drivers.push(`${summary.activeVisualHandles} handle(s) visual(is) ativo(s)`);
    }
    if (drivers.length === 0) {
      drivers.push('buffers e approvals sob controle');
    }
    return {
      level,
      score,
      summary: drivers.slice(0, 3).join(' | '),
    };
  }

  private extractSiteHost(value: unknown): string | null {
    const raw = this.text(value);
    if (!raw) {
      return null;
    }
    try {
      const target = raw.match(/^https?:\/\//i) ? raw : `https://${raw}`;
      return new URL(target).hostname.trim().toLowerCase();
    } catch {
      return null;
    }
  }

  private text(value: unknown, fallback = ''): string {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  }
}
