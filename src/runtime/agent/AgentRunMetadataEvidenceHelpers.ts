import type { UniversalAgentRun } from './UniversalAgentRuntimeTypes.js';

export type CoreDietBaselineSnapshotRecord = {
  key: string;
  status: 'built-attached' | 'built-skipped' | 'cache-hit';
};

export type CoreDietBaselineStageRecord = {
  name: string;
  elapsedMs: number;
};

export type CoreDietBaselineDraft = {
  startedAtMs: number;
  snapshots: CoreDietBaselineSnapshotRecord[];
  phases: CoreDietBaselineStageRecord[];
};

export type CoreDietBaselineBudget = {
  metadataBytes: number;
  snapshotBuilds: number;
  attachedSnapshots: number;
  skippedSnapshots: number;
  cacheHits: number;
  phaseCount: number;
  maxStageMs: number;
  scheduledWorkerJobs: number;
};

export type EvidenceRefLike = {
  key: string;
  material?: boolean;
};

type MetadataDietClass = 'operational' | 'audit' | 'debug';

const CORE_DIET_BASELINE_BUDGETS: Record<string, CoreDietBaselineBudget> = {
  trivial: {
    metadataBytes: 12000,
    snapshotBuilds: 24,
    attachedSnapshots: 12,
    skippedSnapshots: 24,
    cacheHits: 24,
    phaseCount: 8,
    maxStageMs: 500,
    scheduledWorkerJobs: 2,
  },
  default: {
    metadataBytes: 24000,
    snapshotBuilds: 32,
    attachedSnapshots: 20,
    skippedSnapshots: 32,
    cacheHits: 32,
    phaseCount: 12,
    maxStageMs: 1000,
    scheduledWorkerJobs: 4,
  },
};

const METADATA_DIET_CLASSES: Record<MetadataDietClass, Set<string>> = {
  operational: new Set([
    'runBudget',
    'trustSlider',
    'trustPosture',
    'universalIntent',
    'capabilityLoopStatus',
    'toolRehearsal',
    'capabilityNegotiation',
    'providerArena',
    'lifecycleDefense',
    'runtimeEventBus',
    'evidenceRefs',
    'metadataDiet',
    'coreDietObservability',
    'corePipeline',
  ]),
  audit: new Set([
    'memoryWithReceipts',
    'skillMcpQuarantine',
    'universalIntentTrustEnforcement',
    'capabilityLoopGovernance',
    'safetyNarrative',
    'providerMeshConsolidation',
    'crossChannelContinuity',
    'agentTeamCompiler',
    'askBeforeAssumptionPolicy',
    'artifactMemory',
    'personalOpsAutopilot',
    'runArtifactReceiptReplay',
    'productizationEvidence',
    'productEntryRuntime',
    'releaseInstallerRollbackPath',
    'publicSiteDocsDemoSync',
    'feedbackTelemetryProductLoop',
    'publicAdoptionPilotLoop',
    'integrationShowcasePartnerSurface',
    'releaseAdoptionReadiness',
    'releaseCandidatePreCanaryGate',
    'blueprintCompletionGate',
    'evidenceCollectors',
    'evidenceWorkers',
  ]),
  debug: new Set([
    'coreDietBaseline',
    'selfingDashboard',
  ]),
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function measureJsonBytes(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value) || '', 'utf8');
  } catch {
    return -1;
  }
}

export class AgentRunMetadataEvidenceHelpers {
  private readonly evidenceSnapshotFingerprints = new WeakMap<UniversalAgentRun, Map<string, string>>();
  private readonly evidenceSnapshotCache = new WeakMap<UniversalAgentRun, Map<string, Record<string, unknown>>>();
  private readonly coreDietBaselines = new WeakMap<UniversalAgentRun, CoreDietBaselineDraft>();

  public startCoreDietBaseline(): CoreDietBaselineDraft {
    return {
      startedAtMs: Date.now(),
      snapshots: [],
      phases: [],
    };
  }

  public rememberCoreDietBaseline(run: UniversalAgentRun, baseline: CoreDietBaselineDraft): void {
    this.coreDietBaselines.set(run, baseline);
  }

  public timeCoreDietStage<T>(
    run: UniversalAgentRun | null,
    baseline: CoreDietBaselineDraft,
    name: string,
    action: () => T,
  ): T {
    const startedAtMs = Date.now();
    try {
      return action();
    } finally {
      baseline.phases.push({
        name,
        elapsedMs: Math.max(0, Date.now() - startedAtMs),
      });
      if (run) {
        this.rememberCoreDietBaseline(run, baseline);
      }
    }
  }

  public recordCoreDietSnapshot(
    run: UniversalAgentRun,
    key: string,
    status: CoreDietBaselineSnapshotRecord['status'],
  ): void {
    const baseline = this.coreDietBaselines.get(run);
    if (!baseline) {
      return;
    }
    baseline.snapshots.push({ key, status });
  }

  public finishCoreDietBaseline(
    run: UniversalAgentRun,
    baseline: CoreDietBaselineDraft,
    scheduledWorkerJobs: number,
  ): void {
    const metadataBeforeBaseline = { ...run.metadata };
    delete metadataBeforeBaseline.coreDietBaseline;
    const metadataBytes = measureJsonBytes(metadataBeforeBaseline);
    const snapshotBuilds = baseline.snapshots.filter((snapshot) => snapshot.status !== 'cache-hit').length;
    const attachedSnapshots = baseline.snapshots.filter((snapshot) => snapshot.status === 'built-attached').length;
    const skippedSnapshots = baseline.snapshots.filter((snapshot) => snapshot.status === 'built-skipped').length;
    const cacheHits = baseline.snapshots.filter((snapshot) => snapshot.status === 'cache-hit').length;
    const profile = this.resolveCoreDietBaselineProfile(run);
    const budget = CORE_DIET_BASELINE_BUDGETS[profile] || CORE_DIET_BASELINE_BUDGETS.default;
    const phaseCount = baseline.phases.length;
    const maxStageMs = baseline.phases.reduce((max, phase) => Math.max(max, phase.elapsedMs), 0);
    const overBudget = [
      metadataBytes > budget.metadataBytes ? 'metadataBytes' : '',
      snapshotBuilds > budget.snapshotBuilds ? 'snapshotBuilds' : '',
      attachedSnapshots > budget.attachedSnapshots ? 'attachedSnapshots' : '',
      skippedSnapshots > budget.skippedSnapshots ? 'skippedSnapshots' : '',
      cacheHits > budget.cacheHits ? 'cacheHits' : '',
      phaseCount > budget.phaseCount ? 'phaseCount' : '',
      maxStageMs > budget.maxStageMs ? 'maxStageMs' : '',
      scheduledWorkerJobs > budget.scheduledWorkerJobs ? 'scheduledWorkerJobs' : '',
    ].filter(Boolean);

    run.metadata = {
      ...run.metadata,
      coreDietBaseline: {
        source: 'AgentRunService',
        stage: 0,
        phase: 0,
        profile,
        elapsedMs: Math.max(0, Date.now() - baseline.startedAtMs),
        metadataBytes,
        metadataKeyCount: Object.keys(metadataBeforeBaseline).length,
        snapshotBuilds,
        attachedSnapshots,
        skippedSnapshots,
        cacheHits,
        phaseCount,
        maxStageMs,
        scheduledWorkerJobs,
        overBudget,
        budget,
        stages: baseline.phases.slice(),
        phases: baseline.phases.slice(),
        snapshotEvents: baseline.snapshots.slice(),
      },
      coreDietObservability: {
        source: 'AgentRunService',
        stage: 10,
        phase: 10,
        profile,
        status: overBudget.length > 0 ? 'over-budget' : 'within-budget',
        violations: overBudget,
        budgets: {
          ...budget,
          stageCount: budget.phaseCount,
        },
        metrics: {
          metadataBytes,
          snapshotBuilds,
          attachedSnapshots,
          skippedSnapshots,
          cacheHits,
          stageCount: phaseCount,
          phaseCount,
          maxStageMs,
          scheduledWorkerJobs,
        },
      },
    };
  }

  public applyMetadataDiet(run: UniversalAgentRun, evidenceRefs: EvidenceRefLike[]): void {
    const metadata = { ...run.metadata };
    delete metadata.metadataDiet;
    const refKeys = new Set(evidenceRefs.map((ref) => ref.key));
    const nonMaterialRefKeys = new Set(evidenceRefs.filter((ref) => !ref.material).map((ref) => ref.key));
    const removedAuditKeys: string[] = [];

    for (const key of nonMaterialRefKeys) {
      if (Object.prototype.hasOwnProperty.call(metadata, key)) {
        delete metadata[key];
        removedAuditKeys.push(key);
      }
    }

    const keys = Object.keys(metadata);
    const operationalKeys = keys.filter((key) => METADATA_DIET_CLASSES.operational.has(key));
    const auditKeys = keys.filter((key) => METADATA_DIET_CLASSES.audit.has(key) || refKeys.has(key));
    const debugKeys = keys.filter((key) => METADATA_DIET_CLASSES.debug.has(key));
    const unclassifiedKeys = keys.filter((key) => (
      !operationalKeys.includes(key)
      && !auditKeys.includes(key)
      && !debugKeys.includes(key)
    ));

    run.metadata = {
      ...metadata,
      metadataDiet: {
        source: 'AgentRunService',
        stage: 5,
        phase: 5,
        operationalKeys,
        auditKeys,
        debugKeys,
        unclassifiedKeys,
        removedAuditKeys,
        lazyRefCount: evidenceRefs.length,
        nonMaterialRefCount: nonMaterialRefKeys.size,
      },
    };
  }

  public resolveCoreDietBaselineProfile(run: UniversalAgentRun): 'trivial' | 'default' {
    const input = normalizeText(run.input).toLowerCase();
    if (/^(oi|ola|olá|bom dia|boa tarde|boa noite|ok|valeu|obrigad[oa]|thanks|hi|hello)[\s.!?]*$/.test(input)) {
      return 'trivial';
    }
    return 'default';
  }

  public buildEvidenceSnapshotFingerprint(run: UniversalAgentRun): string {
    return JSON.stringify({
      status: run.status,
      summary: run.summary,
      artifacts: run.artifacts.map((artifact) => artifact.id).join('|'),
      approvals: run.approvals.map((approval) => `${approval.id}:${approval.status}`).join('|'),
      memorySignals: run.memorySignals.length,
      toolExposure: run.toolExposure.mode,
      providerLabel: run.modelProfile.providerLabel,
      modelLabel: run.modelProfile.modelLabel,
    });
  }

  public readEvidenceSnapshotFingerprint(run: UniversalAgentRun, key: string): string | null {
    return this.evidenceSnapshotFingerprints.get(run)?.get(key) || null;
  }

  public writeEvidenceSnapshotFingerprint(run: UniversalAgentRun, key: string, fingerprint: string): void {
    const fingerprints = this.evidenceSnapshotFingerprints.get(run) || new Map<string, string>();
    fingerprints.set(key, fingerprint);
    this.evidenceSnapshotFingerprints.set(run, fingerprints);
  }

  public readCachedEvidenceSnapshot(run: UniversalAgentRun, key: string): Record<string, unknown> | null {
    return this.evidenceSnapshotCache.get(run)?.get(key) || null;
  }

  public writeCachedEvidenceSnapshot(
    run: UniversalAgentRun,
    key: string,
    snapshot: Record<string, unknown>,
  ): void {
    const snapshots = this.evidenceSnapshotCache.get(run) || new Map<string, Record<string, unknown>>();
    snapshots.set(key, snapshot);
    this.evidenceSnapshotCache.set(run, snapshots);
  }

  public isMaterialEvidenceSnapshot(value: unknown): boolean {
    const record = recordOrNull(value);
    if (!record) {
      return false;
    }

    const status = normalizeText(record.status).toLowerCase();
    if (['blocked', 'partial', 'failed', 'waiting-approval', 'needs-index', 'needs-attention'].includes(status)) {
      return true;
    }
    if (status.endsWith('-ready')) {
      return true;
    }
    if (status === 'ready') {
      return this.hasMaterialEvidenceValue(record);
    }
    if (['empty', 'not-needed', 'idle', 'skipped'].includes(status)) {
      return this.hasMaterialEvidenceValue(record.summary)
        || this.hasMaterialEvidenceValue(record.entries)
        || this.hasMaterialEvidenceValue(record.receipts)
        || this.hasMaterialEvidenceValue(record.actions)
        || this.hasMaterialEvidenceValue(record.blockers)
        || this.hasMaterialEvidenceValue(record.recommendations);
    }

    return this.hasMaterialEvidenceValue(record);
  }

  private hasMaterialEvidenceValue(value: unknown): boolean {
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) && value !== 0;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      return normalizeText(value).length > 0;
    }

    const record = recordOrNull(value);
    if (!record) {
      return false;
    }

    const ignoredKeys = new Set([
      'contractVersion',
      'generatedAt',
      'identifiers',
      'source',
      'status',
      'policy',
      'surface',
      'nextSafeAction',
    ]);

    return Object.entries(record).some(([key, entry]) => (
      !ignoredKeys.has(key) && this.hasMaterialEvidenceValue(entry)
    ));
  }
}
