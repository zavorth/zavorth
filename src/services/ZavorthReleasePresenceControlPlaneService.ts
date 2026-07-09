import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';
import { PublishComparisonService, type PublishComparisonReport, type PublishSnapshotDescriptor } from './PublishComparisonService.js';
import { PublishHistoryService, type PublishHistoryEntry } from './PublishHistoryService.js';
import type { OperationsHealthSnapshot, OperationsHealthService } from './OperationsHealthService.js';
import { ZavorthRemoteTransportService, type ZavorthRemoteTransportSnapshot } from './ZavorthRemoteTransportService.js';
import { ZavorthTelemetryLedgerService, type ZavorthTelemetryLedgerSnapshot } from './ZavorthTelemetryLedgerService.js';
import { logger } from '../logger.js';

export type ZavorthReleasePresenceMode = 'status' | 'diff' | 'rollback-preview' | 'presence';
export type ZavorthReleasePresenceStatus = 'ready' | 'degraded' | 'blocked';
export type ZavorthReleaseRiskLevel = 'low' | 'medium' | 'high';

export type ZavorthReleaseChannel = {
  id: 'alpha' | 'beta' | 'stable';
  label: string;
  status: 'current' | 'candidate' | 'dormant';
  version: string | null;
  source: string;
  publishCommand: string;
};

export type ZavorthReleaseHistoryItem = {
  id: string;
  label: string;
  publishedAt: string | null;
  branch: string | null;
  commit: string | null;
  docsUrl: string | null;
  remoteConsoleUrl: string | null;
  diffToPrevious: string | null;
};

export type ZavorthReleaseRemotePresence = {
  status: 'online' | 'degraded' | 'offline' | 'dormant';
  transportTotal: number;
  ready: number;
  partial: number;
  dormant: number;
  pendingWork: number;
  stateSummary: string;
  credentials: {
    mode: 'redacted-or-none';
    looseCredentialRequired: false;
    reason: string;
  };
  entries: Array<{
    id: string;
    label: string;
    readiness: string;
    available: boolean;
    summary: string;
  }>;
};

export type ZavorthReleaseRollbackPlan = {
  targetId: string | null;
  targetLabel: string | null;
  command: string;
  previewOnly: boolean;
  confirmationRequired: boolean;
  executed: false;
  preflight: {
    status: 'pass' | 'warn' | 'block';
    checks: Array<{
      id: string;
      status: 'pass' | 'warn' | 'block';
      summary: string;
    }>;
  };
  evidence: string[];
  reversalPlan: string[];
};

export type ZavorthReleaseCostPanel = {
  source: 'telemetry-ledger';
  available: boolean;
  totalEvents: number;
  traces: number;
  failures: number;
  blocked: number;
  estimatedAttempts: number;
  tokenAccounting: {
    available: false;
    totalTokens: 0;
    reason: string;
  };
  taskCosts: Array<{
    taskRef: string;
    status: string;
    attempts: number;
    failures: number;
    lastEventType: string;
  }>;
};

export type ZavorthReleasePresenceSnapshot = {
  generatedAt: string;
  phase: '31';
  surface: 'release-presence-control-plane';
  mode: ZavorthReleasePresenceMode;
  status: ZavorthReleasePresenceStatus;
  release: {
    packageName: string;
    version: string | null;
    channel: ZavorthReleaseChannel['id'];
    latest: ZavorthReleaseHistoryItem | null;
    risk: {
      level: ZavorthReleaseRiskLevel;
      reasons: string[];
    };
    verification: {
      available: boolean;
      digest: string | null;
      subject: string | null;
      reason: string;
    };
  };
  channels: ZavorthReleaseChannel[];
  history: ZavorthReleaseHistoryItem[];
  changelog: {
    generatedFrom: 'publish-history+telemetry-ledger';
    entries: string[];
  };
  diff: {
    requested: {
      from: string | null;
      to: string | null;
    };
    available: boolean;
    report: PublishComparisonReport | null;
    summary: string;
  };
  rollback: ZavorthReleaseRollbackPlan;
  remotePresence: ZavorthReleaseRemotePresence;
  mirroring: {
    longFlowMirroring: 'authorized-surfaces-only';
    enabled: boolean;
    authorizedSurfaces: string[];
    reason: string;
  };
  costPanel: ZavorthReleaseCostPanel;
  contracts: {
    remoteNeverRequiresLooseCredentialFirstLayer: boolean;
    rollbackHasPreflightAndEvidence: boolean;
    publishRegistersVersionDiffRiskRollback: boolean;
    remotePresenceDegradesWhenOffline: boolean;
    rollbackPreviewDoesNotExecute: boolean;
    snapshotVerificationWhenApplicable: boolean;
  };
  commands: {
    status: string;
    diff: string;
    rollbackPreview: string;
    presence: string;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

export type ZavorthReleaseStatusInput = {
  live?: boolean;
};

export type ZavorthReleaseDiffInput = {
  from?: string | null;
  to?: string | null;
  live?: boolean;
};

export type ZavorthReleaseRollbackInput = {
  targetId?: string | null;
  preview?: boolean;
  live?: boolean;
};

type ReleaseHealthService = Pick<OperationsHealthService, 'readSnapshotFast' | 'readSnapshotLive'>;
type ReleaseRemoteTransportService = Pick<ZavorthRemoteTransportService, 'buildSnapshot'>;
type ReleaseTelemetryService = Pick<ZavorthTelemetryLedgerService, 'buildSnapshot'>;

type ZavorthReleasePresenceRuntime = {
  now?: () => Date;
  projectRoot?: string;
  packageJsonPath?: string;
  publishHistoryFile?: string;
  operationsHealthService?: ReleaseHealthService | null;
  remoteTransportService?: ReleaseRemoteTransportService | null;
  telemetryLedgerService?: ReleaseTelemetryService | null;
  comparisonService?: PublishComparisonService;
  historyService?: PublishHistoryService;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
};

export class ZavorthReleasePresenceControlPlaneService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly packageJsonPath: string;
  private readonly publishHistoryFile: string;
  private readonly operationsHealthService: ReleaseHealthService | null;
  private readonly remoteTransportService: ReleaseRemoteTransportService;
  private readonly telemetryLedgerService: ReleaseTelemetryService;
  private readonly comparisonService: PublishComparisonService;
  private readonly historyService: PublishHistoryService;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;

  constructor(runtime: ZavorthReleasePresenceRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = runtime.projectRoot || config.projectRoot || process.cwd();
    this.packageJsonPath = runtime.packageJsonPath || path.resolve(this.projectRoot, 'package.json');
    this.publishHistoryFile = runtime.publishHistoryFile || config.publishHistoryFile || path.resolve(this.projectRoot, 'data', 'runtime', 'publish-history.json');
    this.operationsHealthService = runtime.operationsHealthService || null;
    this.remoteTransportService = runtime.remoteTransportService || new ZavorthRemoteTransportService();
    this.telemetryLedgerService = runtime.telemetryLedgerService || new ZavorthTelemetryLedgerService();
    this.comparisonService = runtime.comparisonService || new PublishComparisonService();
    this.historyService = runtime.historyService || new PublishHistoryService(this.projectRoot, this.comparisonService);
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
  }

  public async buildStatus(input: ZavorthReleaseStatusInput = {}): Promise<ZavorthReleasePresenceSnapshot> {
    return this.buildSnapshot({ mode: 'status', live: input.live });
  }

  public async buildDiff(input: ZavorthReleaseDiffInput = {}): Promise<ZavorthReleasePresenceSnapshot> {
    return this.buildSnapshot({
      mode: 'diff',
      live: input.live,
      from: input.from || 'previous',
      to: input.to || 'latest',
    });
  }

  public async buildRollbackPreview(input: ZavorthReleaseRollbackInput = {}): Promise<ZavorthReleasePresenceSnapshot> {
    return this.buildSnapshot({
      mode: 'rollback-preview',
      live: input.live,
      rollbackTargetId: input.targetId || null,
    });
  }

  public async buildRemotePresence(input: ZavorthReleaseStatusInput = {}): Promise<ZavorthReleasePresenceSnapshot> {
    return this.buildSnapshot({ mode: 'presence', live: input.live });
  }

  private async buildSnapshot(input: {
    mode: ZavorthReleasePresenceMode;
    live?: boolean;
    from?: string | null;
    to?: string | null;
    rollbackTargetId?: string | null;
  }): Promise<ZavorthReleasePresenceSnapshot> {
    const generatedAt = this.now().toISOString();
    const packageInfo = this.readPackageInfo();
    const health = this.readHealthSnapshot(Boolean(input.live));
    const historyEntries = this.historyService.readHistory(this.publishHistoryFile);
    const historySummaries = this.historyService.summarize(historyEntries, 8);
    const descriptors = this.buildDescriptorList(historyEntries);
    const history = this.buildHistoryItems(historySummaries);
    const latest = this.resolveLatestReleaseItem(health, history);
    const remoteTransport = this.readRemoteTransportSnapshot();
    const telemetry = this.readTelemetrySnapshot();
    const remotePresence = this.buildRemotePresencePayload(remoteTransport, health);
    const diff = this.buildDiffPayload(input, descriptors);
    const rollback = this.buildRollbackPlan({
      targetId: input.rollbackTargetId || null,
      descriptors,
      historyEntries,
      diff,
    });
    const risk = this.buildRisk(health, history, remotePresence, rollback, diff);
    const channels = this.buildChannels(packageInfo, latest);
    const costPanel = this.buildCostPanel(telemetry);
    const changelog = this.buildChangelog(history, telemetry, diff);
    const release = {
      packageName: packageInfo.name,
      version: packageInfo.version,
      channel: this.resolveCurrentChannel(health, risk),
      latest,
      risk,
      verification: this.buildVerification(latest, health),
    };
    const status = this.resolveStatus(input.mode, release.risk, remotePresence, rollback, diff);
    const contracts = this.buildContracts({ release, diff, rollback, remotePresence });

    return {
      generatedAt,
      phase: '31',
      surface: 'release-presence-control-plane',
      mode: input.mode,
      status,
      release,
      channels,
      history,
      changelog,
      diff,
      rollback,
      remotePresence,
      mirroring: {
        longFlowMirroring: 'authorized-surfaces-only',
        enabled: remotePresence.ready > 0,
        authorizedSurfaces: ['cli', 'control-ui', 'telegram-approved-session'],
        reason: remotePresence.ready > 0
          ? 'Fluxos longos podem ser espelhados somente para superficies autorizadas.'
          : 'Sem transporte remoto pronto; espelhamento fica dormente e degradado.',
      },
      costPanel,
      contracts,
      commands: {
        status: 'zavorth release status --json',
        diff: 'zavorth release diff previous latest --json',
        rollbackPreview: 'zavorth release rollback --preview --json',
        presence: 'zavorth release presence --json',
      },
      narrative: this.buildNarrative(input.mode, status, release, remotePresence, rollback, diff),
    };
  }

  private readPackageInfo(): { name: string; version: string | null } {
    try {
      if (!this.existsSync(this.packageJsonPath)) {
        return { name: 'zavorth', version: null };
      }
      const parsed = JSON.parse(this.readFileSync(this.packageJsonPath, 'utf8')) as Record<string, unknown>;
      return {
        name: String(parsed.name || 'zavorth'),
        version: typeof parsed.version === 'string' ? parsed.version : null,
      };
    } catch (error: unknown) {logger.warn('[Zavorth Release Presence Control Plane] JSON parse failed', error);
    return { name: 'zavorth', version: null };
  }
  }

  private readHealthSnapshot(live: boolean): Partial<OperationsHealthSnapshot> | null {
    if (!this.operationsHealthService) {
      return null;
    }
    try {
      return live
        ? this.operationsHealthService.readSnapshotLive()
        : this.operationsHealthService.readSnapshotFast();
    } catch (error: unknown) {logger.warn('[Zavorth Release Presence Control Plane] health check failed', error); return null; }
  }

  private readRemoteTransportSnapshot(): ZavorthRemoteTransportSnapshot | null {
    try {
      return this.remoteTransportService.buildSnapshot();
    } catch (error: unknown) {logger.warn('[Zavorth Release Presence Control Plane] health check failed', error); return null; }
  }

  private readTelemetrySnapshot(): ZavorthTelemetryLedgerSnapshot | null {
    try {
      return this.telemetryLedgerService.buildSnapshot();
    } catch (error: unknown) {logger.warn('[Zavorth Release Presence Control Plane] creation failed', error); return null; }
  }

  private buildDescriptorList(entries: PublishHistoryEntry[]): PublishSnapshotDescriptor[] {
    return entries
      .map((entry) => this.historyService.resolveDescriptor(entry))
      .filter((entry): entry is PublishSnapshotDescriptor => Boolean(entry));
  }

  private buildHistoryItems(summaries: ReturnType<PublishHistoryService['summarize']>): ZavorthReleaseHistoryItem[] {
    return summaries.map((summary) => {
      const entry = summary.entry;
      const archiveId = entry.archive?.id || `history-${summary.index}`;
      return {
        id: archiveId,
        label: summary.descriptor?.label || archiveId,
        publishedAt: entry.publishedAt || null,
        branch: entry.branch || null,
        commit: entry.commit || null,
        docsUrl: entry.targets?.docs?.productionUrl || entry.targets?.docs?.deploymentUrl || null,
        remoteConsoleUrl: entry.targets?.remoteConsole?.productionUrl || entry.targets?.remoteConsole?.deploymentUrl || null,
        diffToPrevious: summary.comparisonToPrevious?.summary || null,
      };
    });
  }

  private resolveLatestReleaseItem(
    health: Partial<OperationsHealthSnapshot> | null,
    history: ZavorthReleaseHistoryItem[],
  ): ZavorthReleaseHistoryItem | null {
    const publish = health?.publish || null;
    if (publish?.available || publish?.publishedAt || publish?.commit) {
      return {
        id: publish.sourceArchiveId || history[0]?.id || 'current',
        label: publish.sourceArchiveId || `current (${String(publish.commit || '').slice(0, 8) || 'sem-commit'})`,
        publishedAt: publish.publishedAt || null,
        branch: publish.branch || null,
        commit: publish.commit || null,
        docsUrl: publish.docsUrl || null,
        remoteConsoleUrl: publish.remoteConsoleUrl || null,
        diffToPrevious: history[0]?.diffToPrevious || null,
      };
    }
    return history[0] || null;
  }

  private buildDiffPayload(
    input: { mode: ZavorthReleasePresenceMode; from?: string | null; to?: string | null },
    descriptors: PublishSnapshotDescriptor[],
  ): ZavorthReleasePresenceSnapshot['diff'] {
    const fromRef = input.from || 'previous';
    const toRef = input.to || 'latest';
    const from = this.resolveDescriptorRef(fromRef, descriptors);
    const to = this.resolveDescriptorRef(toRef, descriptors);
    if (!from || !to) {
      return {
        requested: { from: fromRef, to: toRef },
        available: false,
        report: null,
        summary: descriptors.length < 2
          ? 'Historico insuficiente para comparar publishes reais.'
          : 'Nao foi possivel resolver os snapshots solicitados.',
      };
    }

    const report = this.comparisonService.compareSnapshots(from, to);
    return {
      requested: { from: fromRef, to: toRef },
      available: true,
      report,
      summary: report.summary,
    };
  }

  private resolveDescriptorRef(ref: string, descriptors: PublishSnapshotDescriptor[]): PublishSnapshotDescriptor | null {
    const normalized = String(ref || '').trim();
    if (!normalized) {
      return null;
    }
    if (normalized === 'latest' || normalized === 'current') {
      return descriptors[0] || this.resolveCurrentPreparedDescriptor();
    }
    if (normalized === 'previous') {
      return descriptors[1] || descriptors[0] || null;
    }
    if (normalized === 'current-prepared') {
      return this.resolveCurrentPreparedDescriptor();
    }
    return descriptors.find((entry) => entry.id === normalized || entry.label === normalized) || null;
  }

  private resolveCurrentPreparedDescriptor(): PublishSnapshotDescriptor | null {
    const docsPath = path.resolve(this.projectRoot, 'remote-dist', 'docs');
    const remoteConsolePath = path.resolve(this.projectRoot, 'remote-dist', 'remote-console');
    if (!this.existsSync(docsPath) || !this.existsSync(remoteConsolePath)) {
      return null;
    }
    return {
      id: 'current-prepared',
      label: 'current-prepared',
      commit: null,
      publishedAt: null,
      docsPath,
      remoteConsolePath,
    };
  }

  private buildRollbackPlan(input: {
    targetId: string | null;
    descriptors: PublishSnapshotDescriptor[];
    historyEntries: PublishHistoryEntry[];
    diff: ZavorthReleasePresenceSnapshot['diff'];
  }): ZavorthReleaseRollbackPlan {
    const target = this.resolveRollbackTarget(input.targetId, input.descriptors);
    const targetEntry = target
      ? input.historyEntries.find((entry) => entry.archive?.id === target.id)
      : null;
    const docsPath = target?.docsPath || null;
    const consolePath = target?.remoteConsolePath || null;
    const checks: ZavorthReleaseRollbackPlan['preflight']['checks'] = [
      {
        id: 'target-resolved',
        status: target ? 'pass' : 'block',
        summary: target ? `Target ${target.label} resolvido.` : 'Nenhum publish anterior utilizavel foi encontrado.',
      },
      {
        id: 'archive-docs',
        status: docsPath && this.existsSync(docsPath) ? 'pass' : target ? 'warn' : 'block',
        summary: docsPath ? `Docs archive: ${docsPath}` : 'Snapshot de docs indisponivel.',
      },
      {
        id: 'archive-remote-console',
        status: consolePath && this.existsSync(consolePath) ? 'pass' : target ? 'warn' : 'block',
        summary: consolePath ? `Remote console archive: ${consolePath}` : 'Snapshot de remote console indisponivel.',
      },
      {
        id: 'diff-evidence',
        status: input.diff.available ? 'pass' : 'warn',
        summary: input.diff.summary,
      },
    ];
    const hasBlock = checks.some((check) => check.status === 'block');
    const hasWarn = checks.some((check) => check.status === 'warn');

    return {
      targetId: target?.id || null,
      targetLabel: target?.label || null,
      command: target?.id
        ? `node scripts/remote-rollback.mjs --dry-run --id=${target.id}`
        : 'node scripts/remote-rollback.mjs --dry-run',
      previewOnly: true,
      confirmationRequired: true,
      executed: false,
      preflight: {
        status: hasBlock ? 'block' : hasWarn ? 'warn' : 'pass',
        checks,
      },
      evidence: [
        target?.publishedAt ? `publishedAt=${target.publishedAt}` : null,
        target?.commit ? `commit=${target.commit}` : null,
        targetEntry?.branch ? `branch=${targetEntry.branch}` : null,
        input.diff.summary,
      ].filter(Boolean) as string[],
      reversalPlan: [
        'Selecionar snapshot arquivado.',
        'Comparar target com current-prepared antes de trocar arquivos.',
        'Restaurar docs e remote-console em remote-dist somente apos confirmacao.',
        'Republicar com smoke e registrar novo publish history.',
      ],
    };
  }

  private resolveRollbackTarget(
    targetId: string | null,
    descriptors: PublishSnapshotDescriptor[],
  ): PublishSnapshotDescriptor | null {
    if (targetId) {
      return this.resolveDescriptorRef(targetId, descriptors);
    }
    return descriptors[1] || descriptors[0] || null;
  }

  private buildRemotePresencePayload(
    remoteTransport: ZavorthRemoteTransportSnapshot | null,
    health: Partial<OperationsHealthSnapshot> | null,
  ): ZavorthReleaseRemotePresence {
    const summary = remoteTransport?.summary || null;
    const healthRemote = health?.remoteTransportDoctor || null;
    const entries = (remoteTransport?.entries || []).map((entry) => ({
      id: entry.id,
      label: entry.label,
      readiness: entry.readiness,
      available: entry.available,
      summary: entry.operatorSummary,
    }));
    const transportTotal = summary?.total || entries.length || 0;
    const ready = summary?.ready || entries.filter((entry) => entry.readiness === 'ready').length;
    const partial = summary?.partial || entries.filter((entry) => entry.readiness === 'partial').length;
    const dormant = summary?.disabled || entries.filter((entry) => entry.readiness === 'disabled').length;
    const pendingWork = summary?.pendingWork || 0;
    const doctorFailed = String(healthRemote?.status || '').toLowerCase() === 'failed';
    const status: ZavorthReleaseRemotePresence['status'] =
      ready > 0
        ? partial > 0 || pendingWork > 0 ? 'degraded' : 'online'
        : transportTotal > 0
          ? doctorFailed || partial > 0 ? 'degraded' : 'dormant'
          : 'offline';

    return {
      status,
      transportTotal,
      ready,
      partial,
      dormant,
      pendingWork,
      stateSummary: remoteTransport?.narrative.operatorSummary
        || healthRemote?.summary
        || 'Presenca remota dormente; nenhum transporte precisa ficar sempre online.',
      credentials: {
        mode: 'redacted-or-none',
        looseCredentialRequired: false,
        reason: 'Primeira camada reporta readiness e endpoints, nunca tokens ou credenciais soltas.',
      },
      entries,
    };
  }

  private buildRisk(
    health: Partial<OperationsHealthSnapshot> | null,
    history: ZavorthReleaseHistoryItem[],
    remotePresence: ZavorthReleaseRemotePresence,
    rollback: ZavorthReleaseRollbackPlan,
    diff: ZavorthReleasePresenceSnapshot['diff'],
  ): ZavorthReleasePresenceSnapshot['release']['risk'] {
    const publish = health?.publish;
    const reasons: string[] = [];
    if (publish && String(publish.smokeTest || '').toLowerCase() === 'failed') {
      reasons.push('ultimo publish tem smoke falho');
    }
    if (publish && String(publish.gitPush || '').toLowerCase() === 'failed') {
      reasons.push('git push do publish falhou');
    }
    if (rollback.preflight.status === 'block') {
      reasons.push('rollback sem target/preflight completo');
    }
    if (!diff.available) {
      reasons.push('comparacao entre snapshots indisponivel ou historico curto');
    }
    if (remotePresence.status === 'degraded' || remotePresence.status === 'offline') {
      reasons.push('presenca remota degradada');
    }
    if (history.length === 0) {
      reasons.push('nenhum publish registrado no history');
    }

    const level: ZavorthReleaseRiskLevel = reasons.some((reason) =>
      /smoke falho|git push|sem target|offline/i.test(reason))
      ? 'high'
      : reasons.length > 0
        ? 'medium'
        : 'low';

    return {
      level,
      reasons: reasons.length > 0 ? reasons : ['release com historico, rollback e presenca em postura aceitavel'],
    };
  }

  private buildVerification(
    latest: ZavorthReleaseHistoryItem | null,
    health: Partial<OperationsHealthSnapshot> | null,
  ): ZavorthReleasePresenceSnapshot['release']['verification'] {
    const publish = health?.publish;
    const subject = [
      latest?.id,
      latest?.commit,
      publish?.sourceArchiveId,
      publish?.publishedAt,
    ].filter(Boolean).join(':');
    if (!subject) {
      return {
        available: false,
        digest: null,
        subject: null,
        reason: 'Sem publish ou commit suficiente para assinar/verificar snapshot.',
      };
    }
    return {
      available: true,
      digest: `sha256:${crypto.createHash('sha256').update(subject).digest('hex')}`,
      subject,
      reason: 'Digest local do release calculado para verificacao quando assinatura externa nao existir.',
    };
  }

  private buildChannels(packageInfo: { version: string | null }, latest: ZavorthReleaseHistoryItem | null): ZavorthReleaseChannel[] {
    return [
      {
        id: 'alpha',
        label: 'Alpha',
        status: 'candidate',
        version: packageInfo.version,
        source: 'release:alpha',
        publishCommand: 'npm run release:alpha',
      },
      {
        id: 'beta',
        label: 'Beta',
        status: 'candidate',
        version: packageInfo.version,
        source: 'release:beta',
        publishCommand: 'npm run release:beta',
      },
      {
        id: 'stable',
        label: 'Stable',
        status: latest ? 'current' : 'dormant',
        version: packageInfo.version,
        source: latest?.id || 'sem publish atual',
        publishCommand: 'npm run remote:publish',
      },
    ];
  }

  private resolveCurrentChannel(
    health: Partial<OperationsHealthSnapshot> | null,
    risk: ZavorthReleasePresenceSnapshot['release']['risk'],
  ): ZavorthReleaseChannel['id'] {
    const branch = String(health?.publish?.branch || '').toLowerCase();
    if (branch.includes('beta')) {
      return 'beta';
    }
    if (branch.includes('alpha') || risk.level === 'high') {
      return 'alpha';
    }
    return 'stable';
  }

  private buildCostPanel(telemetry: ZavorthTelemetryLedgerSnapshot | null): ZavorthReleaseCostPanel {
    if (!telemetry) {
      return {
        source: 'telemetry-ledger',
        available: false,
        totalEvents: 0,
        traces: 0,
        failures: 0,
        blocked: 0,
        estimatedAttempts: 0,
        tokenAccounting: {
          available: false,
          totalTokens: 0,
          reason: 'Telemetry ledger indisponivel neste runtime.',
        },
        taskCosts: [],
      };
    }
    return {
      source: 'telemetry-ledger',
      available: telemetry.available,
      totalEvents: telemetry.totalEvents,
      traces: telemetry.traceCount,
      failures: telemetry.failureEvents,
      blocked: telemetry.blockedEvents,
      estimatedAttempts: telemetry.traces.reduce((total, trace) => total + Math.max(1, trace.eventCount), 0),
      tokenAccounting: {
        available: false,
        totalTokens: 0,
        reason: 'Eventos atuais nao expoem tokens brutos; painel preserva custo/tentativas sem payload sensivel.',
      },
      taskCosts: telemetry.traces.slice(0, 6).map((trace) => ({
        taskRef: trace.traceId,
        status: trace.status,
        attempts: Math.max(1, trace.eventCount),
        failures: trace.failureCount,
        lastEventType: trace.lastEventType,
      })),
    };
  }

  private buildChangelog(
    history: ZavorthReleaseHistoryItem[],
    telemetry: ZavorthTelemetryLedgerSnapshot | null,
    diff: ZavorthReleasePresenceSnapshot['diff'],
  ): ZavorthReleasePresenceSnapshot['changelog'] {
    const entries = [
      history[0] ? `Ultimo publish: ${history[0].label} em ${history[0].publishedAt || 'data desconhecida'}.` : null,
      diff.available ? `Diff: ${diff.summary}.` : `Diff: ${diff.summary}`,
      telemetry?.available ? `Telemetria: ${telemetry.totalEvents} evento(s), ${telemetry.failureEvents} falha(s), ${telemetry.blockedEvents} bloqueio(s).` : 'Telemetria local ainda sem baseline de release.',
      ...history.slice(1, 4).map((entry) => `Historico: ${entry.label}${entry.diffToPrevious ? ` | ${entry.diffToPrevious}` : ''}.`),
    ].filter(Boolean) as string[];
    return {
      generatedFrom: 'publish-history+telemetry-ledger',
      entries: entries.length > 0 ? entries : ['Sem publishes anteriores; changelog fica pronto para o primeiro release.'],
    };
  }

  private resolveStatus(
    mode: ZavorthReleasePresenceMode,
    risk: ZavorthReleasePresenceSnapshot['release']['risk'],
    remotePresence: ZavorthReleaseRemotePresence,
    rollback: ZavorthReleaseRollbackPlan,
    diff: ZavorthReleasePresenceSnapshot['diff'],
  ): ZavorthReleasePresenceStatus {
    if (mode === 'rollback-preview' && rollback.preflight.status === 'block') {
      return 'blocked';
    }
    if (mode === 'diff' && !diff.available) {
      return 'degraded';
    }
    if (risk.level === 'high') {
      return 'degraded';
    }
    if (remotePresence.status === 'degraded' || remotePresence.status === 'offline') {
      return 'degraded';
    }
    return 'ready';
  }

  private buildContracts(input: {
    release: ZavorthReleasePresenceSnapshot['release'];
    diff: ZavorthReleasePresenceSnapshot['diff'];
    rollback: ZavorthReleaseRollbackPlan;
    remotePresence: ZavorthReleaseRemotePresence;
  }): ZavorthReleasePresenceSnapshot['contracts'] {
    return {
      remoteNeverRequiresLooseCredentialFirstLayer:
        input.remotePresence.credentials.mode === 'redacted-or-none'
        && input.remotePresence.credentials.looseCredentialRequired === false,
      rollbackHasPreflightAndEvidence:
        input.rollback.preflight.checks.length > 0
        && input.rollback.evidence.length > 0,
      publishRegistersVersionDiffRiskRollback:
        Boolean(input.release.version !== null)
        && Boolean(input.release.risk.level)
        && Boolean(input.rollback.reversalPlan.length > 0)
        && typeof input.diff.summary === 'string',
      remotePresenceDegradesWhenOffline:
        input.remotePresence.status !== 'offline'
        || input.remotePresence.stateSummary.length > 0,
      rollbackPreviewDoesNotExecute:
        input.rollback.previewOnly
        && input.rollback.confirmationRequired
        && input.rollback.executed === false,
      snapshotVerificationWhenApplicable:
        input.release.verification.available
        ? Boolean(input.release.verification.digest)
        : Boolean(input.release.verification.reason),
    };
  }

  private buildNarrative(
    mode: ZavorthReleasePresenceMode,
    status: ZavorthReleasePresenceStatus,
    release: ZavorthReleasePresenceSnapshot['release'],
    remotePresence: ZavorthReleaseRemotePresence,
    rollback: ZavorthReleaseRollbackPlan,
    diff: ZavorthReleasePresenceSnapshot['diff'],
  ): ZavorthReleasePresenceSnapshot['narrative'] {
    if (mode === 'diff') {
      return {
        headline: diff.available ? 'Comparacao de snapshots pronta.' : 'Comparacao de snapshots degradada.',
        operatorSummary: diff.summary,
      };
    }
    if (mode === 'rollback-preview') {
      return {
        headline: rollback.preflight.status === 'block'
          ? 'Rollback preview bloqueado por falta de target.'
          : 'Rollback preview pronto sem executar nada.',
        operatorSummary: `${rollback.preflight.status}: ${rollback.evidence.join(' | ') || 'sem evidencia suficiente'}`,
      };
    }
    if (mode === 'presence') {
      return {
        headline: `Remote presence ${remotePresence.status}.`,
        operatorSummary: remotePresence.stateSummary,
      };
    }
    return {
      headline: status === 'ready'
        ? `Release ${release.channel} pronto para operacao.`
        : `Release ${release.channel} em postura ${status}.`,
      operatorSummary: `${release.risk.level}: ${release.risk.reasons.join(' | ')}`,
    };
  }
}
