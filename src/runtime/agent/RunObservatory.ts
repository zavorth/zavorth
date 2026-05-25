import type {
  UniversalAgentEvent,
  UniversalAgentRun,
  UniversalAgentRunStatus,
} from './UniversalAgentRuntimeTypes.js';
import {
  SidecarExecutionReceiptService,
  type SidecarExecutionReceiptSnapshot,
} from '../../services/SidecarExecutionReceiptService.js';
import {
  SidecarStatusService,
  type SidecarStatusCard,
} from '../../services/SidecarStatusService.js';
import {
  IntelligenceFabricPostDefaultHealthService,
  type IntelligenceFabricPostDefaultHealthSnapshot,
} from '../../services/IntelligenceFabricPostDefaultHealthService.js';

export const RUN_OBSERVATORY_CONTRACT_VERSION = '2026-05-03.run-observatory' as const;

export type UniversalAgentRunObservatoryQuery = {
  runId?: string | null;
  traceId?: string | null;
  sessionId?: string | null;
  status?: UniversalAgentRunStatus | UniversalAgentRunStatus[] | null;
  limit?: number | null;
};

export type UniversalAgentRunObservatoryRun = {
  run: UniversalAgentRun;
  matchedBy: Array<'runId' | 'traceId' | 'sessionId' | 'status' | 'recent'>;
};

export type UniversalAgentRunObservatoryStatusIndex = {
  status: UniversalAgentRunStatus;
  count: number;
};

export type UniversalAgentRunObservatoryReceiptKind =
  | UniversalAgentEvent['kind']
  | 'budget'
  | 'model-route'
  | 'capability'
  | 'workflow';

export type UniversalAgentRunObservatoryHealthStatus = 'ready' | 'attention' | 'degraded';

export type UniversalAgentRunObservatoryReceipt = {
  id: string;
  runId: string;
  traceId: string;
  sessionId: string;
  kind: UniversalAgentRunObservatoryReceiptKind;
  source: string;
  title: string;
  detail?: string;
  status: UniversalAgentRunStatus | 'pending' | 'running' | 'done' | 'failed' | 'ready' | 'draft' | 'approved' | 'rejected';
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type UniversalAgentRunObservatoryTimelineEvent = {
  id: string;
  runId: string;
  traceId: string;
  sessionId: string;
  kind: UniversalAgentRunObservatoryReceiptKind;
  title: string;
  detail?: string;
  status: UniversalAgentRunObservatoryReceipt['status'];
  createdAt: string;
  relativeOrder: number;
  receiptId: string;
};

export type UniversalAgentRunObservatoryRunSummary = {
  id: string;
  traceId: string;
  requestId: string;
  sessionId: string;
  title: string;
  status: UniversalAgentRunStatus;
  channel: UniversalAgentRun['channel'];
  providerLabel: string;
  modelLabel: string;
  eventCount: number;
  artifactCount: number;
  approvalCount: number;
  pendingApprovalCount: number;
  memorySignalCount: number;
  receiptCount: number;
  replayable: boolean;
  hasError: boolean;
  firstEventAt: string | null;
  lastEventAt: string;
};

export type UniversalAgentRunObservatorySummary = {
  totalRuns: number;
  matchedRuns: number;
  eventCount: number;
  artifactCount: number;
  approvalCount: number;
  pendingApprovalCount: number;
  memorySignalCount: number;
  receiptCount: number;
  replayableRunCount: number;
  failedRunCount: number;
  waitingApprovalRunCount: number;
  runningRunCount: number;
};

export type UniversalAgentRunObservatoryReplaySnapshot = {
  available: boolean;
  runCount: number;
  eventCount: number;
  artifactCount: number;
  receiptCount: number;
  anchors: Array<{
    id: string;
    runId: string;
    traceId: string;
    label: string;
    kind: UniversalAgentRunObservatoryReceiptKind;
    status: UniversalAgentRunObservatoryReceipt['status'];
    createdAt: string;
  }>;
  commandHints: string[];
  summary: string;
};

export type UniversalAgentRunObservatoryDiffPreview = {
  id: string;
  runId: string;
  traceId: string;
  sessionId: string;
  receiptId: string;
  planId: string | null;
  title: string;
  status: UniversalAgentRunObservatoryReceipt['status'];
  approvalRequired: boolean;
  applied: boolean;
  summary: string;
  text: string;
  observability: {
    draftReady: boolean;
    planGenerated: boolean;
    mutationPlaneStatus: string;
    mutationPlaneApprovalStatus: string;
    approvalPath: string;
    approvalReason: string;
    riskGateDecision: string;
    riskGateCanExecuteNow: boolean;
    draftLatencyMs: number | null;
    applyState: string;
    liveActionApplied: boolean;
  };
  files: Array<{
    path: string;
    operation: string;
    status: string;
    hunkCount: number;
  }>;
  actions: {
    approveApplyLabel: string;
    approveApplyInstruction: string;
    rollbackLabel: string;
    rollbackInstruction: string;
    rollbackArtifactPath: string | null;
    dashboardPath: string;
  };
};

export type UniversalAgentRunObservatoryHealth = {
  status: UniversalAgentRunObservatoryHealthStatus;
  issues: string[];
  nextSafeAction: string;
  receiptsAvailable: boolean;
  replayAvailable: boolean;
  staleRunCount: number;
};

export type UniversalAgentRunObservatorySurface = {
  dashboardPath: string;
  cliCommand: string;
  filterHints: string[];
};

export type UniversalAgentRunObservatorySidecars = {
  health: SidecarStatusCard[];
  receipts: SidecarExecutionReceiptSnapshot;
  summary: {
    totalSidecars: number;
    readySidecars: number;
    attentionSidecars: number;
    recentReceiptCount: number;
  };
};

export type UniversalAgentRunObservatorySnapshot = {
  contractVersion: typeof RUN_OBSERVATORY_CONTRACT_VERSION;
  generatedAt: string;
  query: UniversalAgentRunObservatoryQuery;
  totalRuns: number;
  matchedRuns: number;
  summary: UniversalAgentRunObservatorySummary;
  health: UniversalAgentRunObservatoryHealth;
  indexes: {
    runIds: string[];
    traceIds: string[];
    sessionIds: string[];
    statuses: UniversalAgentRunObservatoryStatusIndex[];
  };
  runSummaries: UniversalAgentRunObservatoryRunSummary[];
  runs: UniversalAgentRunObservatoryRun[];
  timeline: UniversalAgentRunObservatoryTimelineEvent[];
  receipts: UniversalAgentRunObservatoryReceipt[];
  diffPreviews: UniversalAgentRunObservatoryDiffPreview[];
  intelligenceFabricHealth: IntelligenceFabricPostDefaultHealthSnapshot;
  sidecars: UniversalAgentRunObservatorySidecars;
  replay: UniversalAgentRunObservatoryReplaySnapshot;
  surface: UniversalAgentRunObservatorySurface;
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeLimit(value: number | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 50;
}

function normalizeStatuses(
  status: UniversalAgentRunObservatoryQuery['status'],
): UniversalAgentRunStatus[] {
  if (!status) {
    return [];
  }
  return Array.isArray(status) ? status : [status];
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function buildStatusIndex(runs: UniversalAgentRun[]): UniversalAgentRunObservatoryStatusIndex[] {
  const counts = new Map<UniversalAgentRunStatus, number>();
  for (const run of runs) {
    counts.set(run.status, (counts.get(run.status) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => a.status.localeCompare(b.status));
}

function toSerializableRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(JSON.stringify(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function normalizeRunForObservatory(run: UniversalAgentRun): UniversalAgentRun {
  const raw = run as unknown as Record<string, unknown>;
  return {
    ...run,
    events: safeArray<UniversalAgentRun['events'][number]>(raw.events),
    artifacts: safeArray<UniversalAgentRun['artifacts'][number]>(raw.artifacts),
    approvals: safeArray<UniversalAgentRun['approvals'][number]>(raw.approvals),
    memorySignals: safeArray<UniversalAgentRun['memorySignals'][number]>(raw.memorySignals),
  };
}

function runHasError(run: UniversalAgentRun): boolean {
  return run.status === 'failed'
    || run.events.some((event) => event.kind === 'error' || event.status === 'failed');
}

function runIsReplayable(run: UniversalAgentRun): boolean {
  return run.events.length > 0
    || run.artifacts.length > 0
    || run.approvals.length > 0
    || run.memorySignals.length > 0;
}

function summarizeRun(run: UniversalAgentRun): UniversalAgentRunObservatoryRunSummary {
  const pendingApprovalCount = run.approvals.filter((approval) => approval.status === 'pending').length;
  const eventTimes = run.events.map((event) => event.createdAt).filter(Boolean).sort();
  const receiptCount = buildReceiptsForRun(run).length;
  return {
    id: run.id,
    traceId: run.traceId,
    requestId: run.requestId,
    sessionId: run.sessionId,
    title: run.title,
    status: run.status,
    channel: run.channel,
    providerLabel: run.modelProfile.providerLabel,
    modelLabel: run.modelProfile.modelLabel,
    eventCount: run.events.length,
    artifactCount: run.artifacts.length,
    approvalCount: run.approvals.length,
    pendingApprovalCount,
    memorySignalCount: run.memorySignals.length,
    receiptCount,
    replayable: runIsReplayable(run),
    hasError: runHasError(run),
    firstEventAt: eventTimes[0] || null,
    lastEventAt: run.updatedAt,
  };
}

function buildReceiptsForRun(run: UniversalAgentRun): UniversalAgentRunObservatoryReceipt[] {
  const receipts: UniversalAgentRunObservatoryReceipt[] = run.events.map((event) => ({
    id: `receipt:${event.id}`,
    runId: run.id,
    traceId: run.traceId,
    sessionId: run.sessionId,
    kind: event.kind,
    source: normalizeText(event.metadata?.source, `agent.${event.kind}`),
    title: event.title,
    detail: event.detail,
    status: event.status,
    createdAt: event.createdAt,
    metadata: toSerializableRecord(event.metadata),
  }));

  for (const approval of run.approvals) {
    receipts.push({
      id: `receipt:${approval.id}`,
      runId: run.id,
      traceId: run.traceId,
      sessionId: run.sessionId,
      kind: 'approval',
      source: 'approval-gate',
      title: approval.title,
      detail: approval.reason,
      status: approval.status,
      createdAt: approval.createdAt,
      metadata: {
        approvalId: approval.id,
        risk: approval.risk,
      },
    });
  }

  for (const artifact of run.artifacts) {
    receipts.push({
      id: `receipt:${artifact.id}`,
      runId: run.id,
      traceId: run.traceId,
      sessionId: run.sessionId,
      kind: 'artifact',
      source: 'artifact-ledger',
      title: artifact.title,
      detail: artifact.kind,
      status: artifact.status,
      createdAt: artifact.createdAt,
      metadata: {
        artifactId: artifact.id,
        kind: artifact.kind,
        sessionId: artifact.sessionId || null,
      },
    });
  }

  for (const signal of run.memorySignals) {
    receipts.push({
      id: `receipt:${signal.id}`,
      runId: run.id,
      traceId: run.traceId,
      sessionId: run.sessionId,
      kind: 'memory',
      source: 'memory-signal',
      title: signal.title,
      detail: signal.summary,
      status: 'done',
      createdAt: run.updatedAt,
      metadata: {
        memorySignalId: signal.id,
        layer: signal.layer,
        confidence: signal.confidence ?? null,
      },
    });
  }

  const runBudget = toSerializableRecord(run.metadata.runBudget);
  if (runBudget) {
    receipts.push({
      id: `receipt:${run.id}:budget`,
      runId: run.id,
      traceId: run.traceId,
      sessionId: run.sessionId,
      kind: 'budget',
      source: normalizeText(runBudget.source, 'RunBudgetPolicy'),
      title: 'Budget do run',
      detail: normalizeText(runBudget.reason, 'Budget avaliado para esta execucao.'),
      status: runBudget.degraded === true ? 'failed' : 'done',
      createdAt: run.updatedAt,
      metadata: runBudget,
    });
  }

  const routeBudget = toSerializableRecord(run.metadata.providerRouteBudgetCorrelation);
  if (routeBudget) {
    receipts.push({
      id: `receipt:${run.id}:provider-route`,
      runId: run.id,
      traceId: run.traceId,
      sessionId: run.sessionId,
      kind: 'model-route',
      source: normalizeText(routeBudget.source, 'AgentRunService'),
      title: 'Rota de provider correlacionada',
      detail: [
        normalizeText(routeBudget.providerName),
        normalizeText(routeBudget.modelName),
      ].filter(Boolean).join('/') || 'Rota de provider registrada.',
      status: 'done',
      createdAt: run.updatedAt,
      metadata: routeBudget,
    });
  }

  const capabilityLoop = toSerializableRecord(run.metadata.capabilityLoopGovernance);
  if (capabilityLoop) {
    receipts.push({
      id: `receipt:${run.id}:capability-loop`,
      runId: run.id,
      traceId: run.traceId,
      sessionId: run.sessionId,
      kind: 'capability',
      source: normalizeText(capabilityLoop.source, 'CapabilityLoopGovernanceService'),
      title: 'Capability loop governado',
      detail: normalizeText(capabilityLoop.summary, 'Capabilities avaliadas no loop canonico.'),
      status: Array.isArray(capabilityLoop.blockedCapabilityIds) && capabilityLoop.blockedCapabilityIds.length > 0
        ? 'pending'
        : 'done',
      createdAt: run.updatedAt,
      metadata: capabilityLoop,
    });
  }

  const intelligenceFabric = toSerializableRecord(run.metadata.intelligenceFabricCanary);
  if (intelligenceFabric) {
    receipts.push({
      id: `receipt:${run.id}:intelligence-fabric`,
      runId: run.id,
      traceId: run.traceId,
      sessionId: run.sessionId,
      kind: 'workflow',
      source: normalizeText(intelligenceFabric.source, 'AgentRunIntelligenceFabricCanary'),
      title: intelligenceFabricReceiptTitle(intelligenceFabric),
      detail: intelligenceFabricReceiptDetail(intelligenceFabric),
      status: 'done',
      createdAt: run.updatedAt,
      metadata: {
        mode: normalizeText(intelligenceFabric.mode, 'unknown'),
        status: normalizeText(intelligenceFabric.status, 'unknown'),
        selectedPath: normalizeText(intelligenceFabric.selectedPath, 'current-runtime-fallback'),
        dispatchTarget: normalizeText(intelligenceFabric.dispatchTarget, 'current-runtime'),
        fallbackRoute: normalizeText(toSerializableRecord(intelligenceFabric.fallback)?.route, 'current-runtime'),
        fallbackReason: normalizeText(toSerializableRecord(intelligenceFabric.fallback)?.reason),
        rollbackStrategy: normalizeText(toSerializableRecord(intelligenceFabric.rollback)?.strategy),
        orientationScope: normalizeText(toSerializableRecord(intelligenceFabric.orientation)?.scope),
        orientationApplied: toSerializableRecord(intelligenceFabric.orientation)?.applied === true,
        currentRuntimeFallbackRetained: toSerializableRecord(intelligenceFabric.safety)?.currentRuntimeFallbackRetained === true,
        receipts: Array.isArray(intelligenceFabric.receipts) ? intelligenceFabric.receipts : [],
      },
    });
  }

  return receipts.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function intelligenceFabricReceiptTitle(metadata: Record<string, unknown>): string {
  const status = normalizeText(metadata.status, 'observed');
  if (status === 'disabled') {
    return 'Intelligence Fabric desativado';
  }
  if (status === 'fallback-current-runtime') {
    return 'Intelligence Fabric usou fallback atual';
  }
  return 'Intelligence Fabric observado';
}

function intelligenceFabricReceiptDetail(metadata: Record<string, unknown>): string {
  const mode = normalizeText(metadata.mode, 'unknown');
  const selectedPath = normalizeText(metadata.selectedPath, 'current-runtime-fallback');
  const fallback = toSerializableRecord(metadata.fallback);
  const reason = normalizeText(fallback?.reason);
  return [
    `mode=${mode}`,
    `path=${selectedPath}`,
    reason,
  ].filter(Boolean).join(' | ');
}

function buildTimeline(receipts: UniversalAgentRunObservatoryReceipt[]): UniversalAgentRunObservatoryTimelineEvent[] {
  return receipts
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .map((receipt, index) => ({
      id: `timeline:${receipt.id}`,
      runId: receipt.runId,
      traceId: receipt.traceId,
      sessionId: receipt.sessionId,
      kind: receipt.kind,
      title: receipt.title,
      detail: receipt.detail,
      status: receipt.status,
      createdAt: receipt.createdAt,
      relativeOrder: index + 1,
      receiptId: receipt.id,
    }));
}

function buildDiffPreviews(receipts: UniversalAgentRunObservatoryReceipt[]): UniversalAgentRunObservatoryDiffPreview[] {
  const previews = receipts
    .map((receipt) => {
      const metadata = receipt.metadata || {};
      const text = normalizeText(metadata.diffReceiptText);
      if (!text) {
        return null;
      }
      const planId = normalizeText(metadata.planId) || null;
      const diffReceipt = toSerializableRecord(metadata.diffReceipt);
      const files = Array.isArray(diffReceipt?.files)
        ? diffReceipt.files
          .map((entry) => toSerializableRecord(entry))
          .filter((entry): entry is Record<string, unknown> => Boolean(entry))
          .map((entry) => ({
            path: normalizeText(entry.path, 'workspace'),
            operation: normalizeText(entry.operation, 'edit'),
            status: normalizeText(entry.status, 'pending'),
            hunkCount: Number(entry.hunkCount || 0),
          }))
        : [];
      const applied = metadata.status === 'applied' || receipt.status === 'done';
      const rollbackArtifactPath = normalizeText(metadata.rollbackArtifactPath) || null;
      const draftObservability = toSerializableRecord(metadata.draftObservability);
      return {
        id: `diff-preview:${receipt.id}`,
        runId: receipt.runId,
        traceId: receipt.traceId,
        sessionId: receipt.sessionId,
        receiptId: receipt.id,
        planId,
        title: 'Previa de alteracao',
        status: receipt.status,
        approvalRequired: metadata.approvalRequired === true,
        applied,
        summary: normalizeText(diffReceipt?.summary, receipt.detail || receipt.title),
        text,
        observability: {
          draftReady: !applied,
          planGenerated: draftObservability?.planGenerated === true,
          mutationPlaneStatus: normalizeText(metadata.mutationPlaneStatus || draftObservability?.mutationPlaneStatus, planId ? 'draft' : 'missing'),
          mutationPlaneApprovalStatus: normalizeText(metadata.mutationPlaneApprovalStatus || draftObservability?.mutationPlaneApprovalStatus, metadata.approvalRequired === true ? 'pending' : 'not_required'),
          approvalPath: normalizeText(metadata.approvalPath || draftObservability?.approvalPath, metadata.approvalRequired === true ? 'approval_required' : 'policy_allow_explicit'),
          approvalReason: normalizeText(metadata.approvalReason || draftObservability?.approvalReason, metadata.approvalRequired === true ? 'Approval exigido antes do apply.' : 'Policy allow explicito antes do pedido de apply.'),
          riskGateDecision: normalizeText(metadata.riskGateDecision || draftObservability?.riskGateDecision, metadata.approvalRequired === true ? 'require_approval' : 'allow'),
          riskGateCanExecuteNow: metadata.riskGateCanExecuteNow === true || draftObservability?.riskGateCanExecuteNow === true,
          draftLatencyMs: Number.isFinite(Number(metadata.draftLatencyMs || draftObservability?.draftLatencyMs))
            ? Number(metadata.draftLatencyMs || draftObservability?.draftLatencyMs)
            : null,
          applyState: normalizeText(metadata.applyState || draftObservability?.applyState, applied ? 'applied' : 'not_requested'),
          liveActionApplied: applied || metadata.liveActionApplied === true || draftObservability?.liveActionApplied === true,
        },
        files,
        actions: {
          approveApplyLabel: applied ? 'Aplicado' : 'Aprovar/aplicar',
          approveApplyInstruction: planId
            ? `Peça ao Zavorth: aplicar rascunho ${planId}.`
            : 'Peça ao Zavorth para aplicar este rascunho quando o plano estiver visivel.',
          rollbackLabel: rollbackArtifactPath ? 'Rollback disponivel' : 'Rollback sera gerado no apply',
          rollbackInstruction: rollbackArtifactPath
            ? `Rollback artifact: ${rollbackArtifactPath}`
            : 'Depois do apply, o receipt vai apontar o artifact de rollback reversivel.',
          rollbackArtifactPath,
          dashboardPath: `/dashboard?runId=${encodeURIComponent(receipt.runId)}`,
        },
      };
    })
    .filter((entry): entry is UniversalAgentRunObservatoryDiffPreview => Boolean(entry));
  const byPlan = new Map<string, UniversalAgentRunObservatoryDiffPreview>();
  for (const preview of previews) {
    const key = preview.planId
      ? `${preview.runId}:${preview.planId}`
      : preview.id;
    const existing = byPlan.get(key);
    if (existing?.applied && !preview.applied) {
      continue;
    }
    byPlan.set(key, preview);
  }
  return Array.from(byPlan.values());
}

function buildSummary(
  runs: UniversalAgentRun[],
  matchedRuns: UniversalAgentRunObservatoryRun[],
  receipts: UniversalAgentRunObservatoryReceipt[],
): UniversalAgentRunObservatorySummary {
  return {
    totalRuns: runs.length,
    matchedRuns: matchedRuns.length,
    eventCount: runs.reduce((total, run) => total + run.events.length, 0),
    artifactCount: runs.reduce((total, run) => total + run.artifacts.length, 0),
    approvalCount: runs.reduce((total, run) => total + run.approvals.length, 0),
    pendingApprovalCount: runs.reduce(
      (total, run) => total + run.approvals.filter((approval) => approval.status === 'pending').length,
      0,
    ),
    memorySignalCount: runs.reduce((total, run) => total + run.memorySignals.length, 0),
    receiptCount: receipts.length,
    replayableRunCount: runs.filter(runIsReplayable).length,
    failedRunCount: runs.filter((run) => run.status === 'failed').length,
    waitingApprovalRunCount: runs.filter((run) => run.status === 'waiting_approval').length,
    runningRunCount: runs.filter((run) => run.status === 'running' || run.status === 'thinking').length,
  };
}

function buildReplay(
  matchedRuns: UniversalAgentRunObservatoryRun[],
  receipts: UniversalAgentRunObservatoryReceipt[],
): UniversalAgentRunObservatoryReplaySnapshot {
  const runs = matchedRuns.map((entry) => entry.run);
  const eventCount = runs.reduce((total, run) => total + run.events.length, 0);
  const artifactCount = runs.reduce((total, run) => total + run.artifacts.length, 0);
  const anchors = receipts
    .filter((receipt) => ['input', 'approval', 'artifact', 'error', 'budget', 'model-route', 'capability'].includes(receipt.kind))
    .slice(0, 20)
    .map((receipt) => ({
      id: receipt.id,
      runId: receipt.runId,
      traceId: receipt.traceId,
      label: receipt.title,
      kind: receipt.kind,
      status: receipt.status,
      createdAt: receipt.createdAt,
    }));
  const available = receipts.length > 0 || eventCount > 0 || artifactCount > 0;
  return {
    available,
    runCount: runs.length,
    eventCount,
    artifactCount,
    receiptCount: receipts.length,
    anchors,
    commandHints: [
      'zavorth observatory --json',
      'zavorth observatory status failed --json',
      'zavorth observatory run <runId> --json',
    ],
    summary: available
      ? `${runs.length} run(s), ${receipts.length} receipt(s) e ${eventCount} evento(s) prontos para replay.`
      : 'Nenhum replay real disponivel ainda.',
  };
}

function buildHealth(
  runs: UniversalAgentRun[],
  summary: UniversalAgentRunObservatorySummary,
  replay: UniversalAgentRunObservatoryReplaySnapshot,
): UniversalAgentRunObservatoryHealth {
  const issues: string[] = [];
  if (runs.length === 0) {
    issues.push('Nenhuma run local observada ainda.');
  }
  if (summary.failedRunCount > 0) {
    issues.push(`${summary.failedRunCount} run(s) falharam e precisam de investigacao.`);
  }
  if (summary.pendingApprovalCount > 0) {
    issues.push(`${summary.pendingApprovalCount} approval(s) pendente(s).`);
  }
  const staleRunCount = runs.filter((run) => run.status === 'running' || run.status === 'thinking').length;
  if (staleRunCount > 0) {
    issues.push(`${staleRunCount} run(s) ainda em execucao ou pensamento.`);
  }

  const status: UniversalAgentRunObservatoryHealthStatus = summary.failedRunCount > 0
    ? 'degraded'
    : summary.pendingApprovalCount > 0 || staleRunCount > 0 || runs.length === 0
      ? 'attention'
      : 'ready';
  const nextSafeAction = summary.failedRunCount > 0
    ? 'Abrir /dashboard?status=failed ou rodar zavorth observatory status failed --json.'
    : summary.pendingApprovalCount > 0
      ? 'Revisar approvals pendentes antes de retomar qualquer execucao.'
      : runs.length === 0
        ? 'Executar uma tarefa pelo Zavorth Agent Gateway para gerar o primeiro receipt.'
        : 'Usar filters por run, trace, sessao ou status para investigar sem executar tools.';

  return {
    status,
    issues,
    nextSafeAction,
    receiptsAvailable: summary.receiptCount > 0,
    replayAvailable: replay.available,
    staleRunCount,
  };
}

function buildSurface(query: UniversalAgentRunObservatoryQuery): UniversalAgentRunObservatorySurface {
  const params = new URLSearchParams();
  const runId = normalizeText(query.runId);
  const traceId = normalizeText(query.traceId);
  const sessionId = normalizeText(query.sessionId);
  const statuses = normalizeStatuses(query.status);
  if (runId) {
    params.set('runId', runId);
  }
  if (traceId) {
    params.set('traceId', traceId);
  }
  if (sessionId) {
    params.set('sessionId', sessionId);
  }
  if (statuses.length > 0) {
    params.set('status', statuses.join(','));
  }
  return {
    dashboardPath: `/dashboard${params.toString() ? `?${params.toString()}` : ''}`,
    cliCommand: 'zavorth observatory --json',
    filterHints: [
      'runId',
      'traceId',
      'sessionId',
      'status',
    ],
  };
}

function buildSidecars(generatedAt: string): UniversalAgentRunObservatorySidecars {
  let health: SidecarStatusCard[] = [];
  let receipts: SidecarExecutionReceiptSnapshot = {
    contractVersion: 'sidecar-execution-receipts/v1',
    generatedAt,
    receiptFile: '',
    totalReceipts: 0,
    recentReceipts: [],
    summary: {
      shellReceipts: 0,
      browserReceipts: 0,
      succeeded: 0,
      failed: 0,
      blocked: 0,
    },
  };

  try {
    health = new SidecarStatusService().list();
  } catch {
    health = [];
  }

  try {
    receipts = new SidecarExecutionReceiptService().buildSnapshot(20);
  } catch {
    receipts = {
      ...receipts,
      generatedAt,
    };
  }

  const readySidecars = health.filter((sidecar) => sidecar.ready).length;
  return {
    health,
    receipts,
    summary: {
      totalSidecars: health.length,
      readySidecars,
      attentionSidecars: Math.max(0, health.length - readySidecars),
      recentReceiptCount: receipts.recentReceipts.length,
    },
  };
}

function runMatches(
  run: UniversalAgentRun,
  query: UniversalAgentRunObservatoryQuery,
): UniversalAgentRunObservatoryRun | null {
  const runId = normalizeText(query.runId);
  const traceId = normalizeText(query.traceId);
  const sessionId = normalizeText(query.sessionId);
  const statuses = normalizeStatuses(query.status);
  const hasFilter = Boolean(runId || traceId || sessionId || statuses.length > 0);
  const matchedBy: UniversalAgentRunObservatoryRun['matchedBy'] = [];

  if (!hasFilter) {
    matchedBy.push('recent');
    return { run, matchedBy };
  }
  if (runId && run.id === runId) {
    matchedBy.push('runId');
  }
  if (traceId && run.traceId === traceId) {
    matchedBy.push('traceId');
  }
  if (sessionId && run.sessionId === sessionId) {
    matchedBy.push('sessionId');
  }
  if (statuses.length > 0 && statuses.includes(run.status)) {
    matchedBy.push('status');
  }
  return matchedBy.length > 0 ? { run, matchedBy } : null;
}

export function queryUniversalAgentRuns(input: {
  runs: UniversalAgentRun[];
  query?: UniversalAgentRunObservatoryQuery | null;
  generatedAt: string;
}): UniversalAgentRunObservatorySnapshot {
  const query = input.query || {};
  const limit = normalizeLimit(query.limit);
  const sortedRuns = input.runs
    .map(normalizeRunForObservatory)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const matchedRuns = sortedRuns
    .map((run) => runMatches(run, query))
    .filter((entry): entry is UniversalAgentRunObservatoryRun => Boolean(entry))
    .slice(0, limit);
  const matchedReceipts = matchedRuns.flatMap((entry) => buildReceiptsForRun(entry.run));
  const diffPreviews = buildDiffPreviews(matchedReceipts);
  const timeline = buildTimeline(matchedReceipts);
  const replay = buildReplay(matchedRuns, matchedReceipts);
  const summary = buildSummary(sortedRuns, matchedRuns, matchedReceipts);
  const sidecars = buildSidecars(input.generatedAt);
  const intelligenceFabricHealth = new IntelligenceFabricPostDefaultHealthService({
    now: () => new Date(input.generatedAt),
  }).buildSnapshot(sortedRuns);

  return {
    contractVersion: RUN_OBSERVATORY_CONTRACT_VERSION,
    generatedAt: input.generatedAt,
    query: {
      ...query,
      limit,
    },
    totalRuns: sortedRuns.length,
    matchedRuns: matchedRuns.length,
    summary,
    health: buildHealth(sortedRuns, summary, replay),
    indexes: {
      runIds: uniqueValues(sortedRuns.map((run) => run.id)),
      traceIds: uniqueValues(sortedRuns.map((run) => run.traceId)),
      sessionIds: uniqueValues(sortedRuns.map((run) => run.sessionId)),
      statuses: buildStatusIndex(sortedRuns),
    },
    runSummaries: matchedRuns.map((entry) => summarizeRun(entry.run)),
    runs: matchedRuns,
    timeline,
    receipts: matchedReceipts,
    diffPreviews,
    intelligenceFabricHealth,
    sidecars,
    replay,
    surface: buildSurface(query),
  };
}
