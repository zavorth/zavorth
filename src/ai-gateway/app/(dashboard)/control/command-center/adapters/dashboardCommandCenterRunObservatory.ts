import type {
  DashboardAgentRun,
  DashboardRunObservatoryReceipt,
  DashboardRunObservatoryReceiptKind,
  DashboardRunObservatorySnapshot,
  DashboardRunObservatoryTimelineEvent,
  DashboardTaskSummary,
} from "../contracts";

type LooseRecord = Record<string, any>;

function asArray<T = LooseRecord>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asText(value: unknown, fallback = ""): string {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asRecord(value: unknown): LooseRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as LooseRecord
    : null;
}

function normalizeStatus(value: unknown): DashboardAgentRun["status"] {
  const raw = asText(value).toLowerCase();
  if (raw.includes("cancel")) {
    return "cancelled";
  }
  if (raw.includes("fail") || raw.includes("error")) {
    return "failed";
  }
  if (raw.includes("approval") || raw.includes("wait")) {
    return "waiting_approval";
  }
  if (raw.includes("queue") || raw.includes("pending")) {
    return "queued";
  }
  if (raw.includes("think") || raw.includes("reason")) {
    return "thinking";
  }
  if (raw.includes("run") || raw.includes("progress")) {
    return "running";
  }
  if (raw.includes("complete") || raw.includes("done") || raw.includes("success")) {
    return "completed";
  }
  return "idle";
}

function normalizeMatchedBy(value: unknown): DashboardRunObservatorySnapshot["runs"][number]["matchedBy"] {
  const allowed = new Set(["runId", "traceId", "sessionId", "status", "recent"]);
  return asArray<string>(value)
    .map((entry) => asText(entry))
    .filter((entry): entry is DashboardRunObservatorySnapshot["runs"][number]["matchedBy"][number] => allowed.has(entry));
}

function normalizeReceiptKind(value: unknown): DashboardRunObservatoryReceiptKind {
  const raw = asText(value).toLowerCase();
  const allowed = new Set<DashboardRunObservatoryReceiptKind>([
    "input",
    "planning",
    "memory",
    "tool",
    "approval",
    "artifact",
    "reply",
    "error",
    "status",
    "budget",
    "model-route",
    "capability",
    "workflow",
  ]);
  return allowed.has(raw as DashboardRunObservatoryReceiptKind)
    ? raw as DashboardRunObservatoryReceiptKind
    : "status";
}

function mapReceipt(entry: LooseRecord): DashboardRunObservatoryReceipt {
  return {
    id: asText(entry.id, "receipt:unknown"),
    runId: asText(entry.runId, "run:unknown"),
    traceId: asText(entry.traceId) || undefined,
    sessionId: asText(entry.sessionId) || undefined,
    kind: normalizeReceiptKind(entry.kind),
    source: asText(entry.source, asText(entry.kind, "run-observatory")),
    title: asText(entry.title ?? entry.label, "Receipt"),
    detail: asText(entry.detail ?? entry.summary) || undefined,
    status: asText(entry.status, "done"),
    createdAt: asText(entry.createdAt ?? entry.timestamp, "agora"),
  };
}

function mapTimelineEvent(entry: LooseRecord): DashboardRunObservatoryTimelineEvent {
  const receipt = mapReceipt(entry);
  return {
    ...receipt,
    relativeOrder: asNumber(entry.relativeOrder) ?? 0,
    receiptId: asText(entry.receiptId, receipt.id),
  };
}

function normalizeSidecarReceiptStatus(value: unknown): "succeeded" | "failed" | "blocked" {
  const raw = asText(value).toLowerCase();
  if (raw === "blocked") {
    return "blocked";
  }
  if (raw === "failed") {
    return "failed";
  }
  return "succeeded";
}

function normalizeSidecarKind(value: unknown): "shell" | "browser" {
  return asText(value).toLowerCase() === "browser" ? "browser" : "shell";
}

function mapSidecars(rawSidecars: LooseRecord | null): DashboardRunObservatorySnapshot["sidecars"] | undefined {
  if (!rawSidecars) {
    return undefined;
  }
  const rawReceipts = asRecord(rawSidecars.receipts);
  const rawReceiptSummary = asRecord(rawReceipts?.summary);
  const rawSummary = asRecord(rawSidecars.summary);
  return {
    health: asArray<LooseRecord>(rawSidecars.health).map((entry) => ({
      id: asText(entry.id, "sidecar:unknown"),
      name: asText(entry.name, "Sidecar"),
      enabled: entry.enabled === true,
      running: entry.running === true,
      ready: entry.ready === true,
      baseUrl: asText(entry.baseUrl) || null,
      checkedAt: asText(entry.checkedAt) || null,
      message: asText(entry.message) || null,
    })),
    receipts: {
      contractVersion: asText(rawReceipts?.contractVersion, "sidecar-execution-receipts/v1"),
      generatedAt: asText(rawReceipts?.generatedAt, "agora"),
      totalReceipts: asNumber(rawReceipts?.totalReceipts) ?? 0,
      recentReceipts: asArray<LooseRecord>(rawReceipts?.recentReceipts).map((entry) => ({
        id: asText(entry.id, "sidecar-receipt:unknown"),
        sidecarId: asText(entry.sidecarId, "sidecar:unknown"),
        kind: normalizeSidecarKind(entry.kind),
        action: asText(entry.action, "sidecar-action"),
        status: normalizeSidecarReceiptStatus(entry.status),
        createdAt: asText(entry.createdAt, "agora"),
        auditId: asText(entry.auditId),
        runtime: asText(entry.runtime, "sidecar"),
        isolationLevel: asText(entry.isolationLevel, "unknown"),
        durationMs: asNumber(entry.durationMs) ?? null,
        exitCode: asNumber(entry.exitCode) ?? null,
        summary: asText(entry.summary, "Execucao sidecar registrada."),
      })),
      summary: {
        shellReceipts: asNumber(rawReceiptSummary?.shellReceipts) ?? 0,
        browserReceipts: asNumber(rawReceiptSummary?.browserReceipts) ?? 0,
        succeeded: asNumber(rawReceiptSummary?.succeeded) ?? 0,
        failed: asNumber(rawReceiptSummary?.failed) ?? 0,
        blocked: asNumber(rawReceiptSummary?.blocked) ?? 0,
      },
    },
    summary: {
      totalSidecars: asNumber(rawSummary?.totalSidecars) ?? 0,
      readySidecars: asNumber(rawSummary?.readySidecars) ?? 0,
      attentionSidecars: asNumber(rawSummary?.attentionSidecars) ?? 0,
      recentReceiptCount: asNumber(rawSummary?.recentReceiptCount) ?? 0,
    },
  };
}

function mapDiffPreviews(value: unknown): DashboardRunObservatorySnapshot["diffPreviews"] {
  return asArray<LooseRecord>(value).map((entry) => {
    const actions = asRecord(entry.actions);
    const observability = asRecord(entry.observability) || {};
    return {
      id: asText(entry.id, "diff-preview:unknown"),
      runId: asText(entry.runId, "run:unknown"),
      traceId: asText(entry.traceId) || undefined,
      sessionId: asText(entry.sessionId) || undefined,
      receiptId: asText(entry.receiptId, "receipt:unknown"),
      planId: asText(entry.planId) || null,
      title: asText(entry.title, "Previa de alteracao"),
      status: asText(entry.status, "pending"),
      approvalRequired: entry.approvalRequired === true,
      applied: entry.applied === true,
      summary: asText(entry.summary, "Diff receipt pendente de revisao."),
      text: asText(entry.text, "Previa de alteracao indisponivel."),
      observability: {
        draftReady: observability.draftReady !== false,
        planGenerated: observability.planGenerated === true,
        mutationPlaneStatus: asText(observability.mutationPlaneStatus, "draft"),
        mutationPlaneApprovalStatus: asText(observability.mutationPlaneApprovalStatus, entry.approvalRequired === true ? "pending" : "not_required"),
        approvalPath: asText(observability.approvalPath, entry.approvalRequired === true ? "approval_required" : "policy_allow_explicit"),
        approvalReason: asText(observability.approvalReason, entry.approvalRequired === true ? "Approval exigido antes do apply." : "Policy allow explicito antes do pedido de apply."),
        riskGateDecision: asText(observability.riskGateDecision, entry.approvalRequired === true ? "require_approval" : "allow"),
        riskGateCanExecuteNow: observability.riskGateCanExecuteNow === true,
        draftLatencyMs: asNumber(observability.draftLatencyMs) ?? null,
        applyState: asText(observability.applyState, entry.applied === true ? "applied" : "not_requested"),
        liveActionApplied: entry.applied === true || observability.liveActionApplied === true,
      },
      files: asArray<LooseRecord>(entry.files).map((file) => ({
        path: asText(file.path, "workspace"),
        operation: asText(file.operation, "edit"),
        status: asText(file.status, "pending"),
        hunkCount: asNumber(file.hunkCount) ?? 0,
      })),
      actions: {
        approveApplyLabel: asText(actions.approveApplyLabel, "Aprovar/aplicar"),
        approveApplyInstruction: asText(actions.approveApplyInstruction, "Peça ao Zavorth para aplicar este rascunho."),
        rollbackLabel: asText(actions.rollbackLabel, "Rollback"),
        rollbackInstruction: asText(actions.rollbackInstruction, "Rollback aparece depois do apply."),
        rollbackArtifactPath: asText(actions.rollbackArtifactPath) || null,
        commandCenterPath: asText(actions.commandCenterPath, "/control"),
      },
    };
  });
}

function normalizeFabricHealthStatus(value: unknown): "ready" | "attention" | "degraded" {
  const raw = asText(value).toLowerCase();
  if (raw === "degraded") {
    return "degraded";
  }
  if (raw === "attention") {
    return "attention";
  }
  return "ready";
}

function normalizeFabricHealthRecommendation(value: unknown): "maintain_default" | "observe" | "auto_demote_controlled" {
  const raw = asText(value).toLowerCase();
  if (raw === "auto_demote_controlled") {
    return "auto_demote_controlled";
  }
  if (raw === "observe") {
    return "observe";
  }
  return "maintain_default";
}

function mapFabricHealth(value: unknown): DashboardRunObservatorySnapshot["intelligenceFabricHealth"] {
  const raw = asRecord(value);
  if (!raw) {
    return undefined;
  }
  const summary = asRecord(raw.summary);
  const thresholds = asRecord(raw.thresholds);
  const rollback = asRecord(raw.rollback);
  return {
    contractVersion: asText(raw.contractVersion, "zavorth-intelligence-fabric-post-default-health/v1"),
    generatedAt: asText(raw.generatedAt, "agora"),
    status: normalizeFabricHealthStatus(raw.status),
    recommendation: normalizeFabricHealthRecommendation(raw.recommendation),
    summary: {
      runs: asNumber(summary?.runs) ?? 0,
      fabricRuns: asNumber(summary?.fabricRuns) ?? 0,
      observedRuns: asNumber(summary?.observedRuns) ?? 0,
      disabledRuns: asNumber(summary?.disabledRuns) ?? 0,
      fallbackCurrentRuntimeRuns: asNumber(summary?.fallbackCurrentRuntimeRuns) ?? 0,
      errorFallbackRuns: asNumber(summary?.errorFallbackRuns) ?? 0,
      orientedRuns: asNumber(summary?.orientedRuns) ?? 0,
      fallbackRate: asNumber(summary?.fallbackRate) ?? 0,
      errorFallbackRate: asNumber(summary?.errorFallbackRate) ?? 0,
      disabledRate: asNumber(summary?.disabledRate) ?? 0,
      orientationRate: asNumber(summary?.orientationRate) ?? 0,
      averageLatencyMs: asNumber(summary?.averageLatencyMs) ?? 0,
      p95LatencyMs: asNumber(summary?.p95LatencyMs) ?? 0,
    },
    thresholds: {
      minRuns: asNumber(thresholds?.minRuns) ?? 0,
      maxFallbackRate: asNumber(thresholds?.maxFallbackRate) ?? 0,
      maxErrorFallbackRate: asNumber(thresholds?.maxErrorFallbackRate) ?? 0,
      maxDisabledRate: asNumber(thresholds?.maxDisabledRate) ?? 0,
      maxAverageLatencyMs: asNumber(thresholds?.maxAverageLatencyMs) ?? 0,
      maxP95LatencyMs: asNumber(thresholds?.maxP95LatencyMs) ?? 0,
    },
    surfaces: asArray<LooseRecord>(raw.surfaces).map((surface) => ({
      surface: asText(surface.surface, "unknown"),
      runs: asNumber(surface.runs) ?? 0,
      observed: asNumber(surface.observed) ?? 0,
      disabled: asNumber(surface.disabled) ?? 0,
      fallbackCurrentRuntime: asNumber(surface.fallbackCurrentRuntime) ?? 0,
      errorFallback: asNumber(surface.errorFallback) ?? 0,
      oriented: asNumber(surface.oriented) ?? 0,
      averageLatencyMs: asNumber(surface.averageLatencyMs) ?? 0,
    })),
    findings: asArray<LooseRecord>(raw.findings).map((finding) => {
      const severity = asText(finding.severity);
      return {
        id: asText(finding.id, "fabric-health-finding"),
        severity: severity === "blocker" ? "blocker" : severity === "warning" ? "warning" : "info",
        message: asText(finding.message, "Fabric health finding."),
      };
    }),
    rollback: {
      available: rollback?.available === true,
      demoteMode: "disabled",
      instruction: asText(rollback?.instruction, "Set intelligenceFabricMode=disabled at runtime or request metadata."),
      destructive: rollback?.destructive === true,
    },
    receipts: asArray<string>(raw.receipts).map((entry) => asText(entry)).filter(Boolean),
  };
}

function normalizeLlmAttemptStatus(value: unknown): "skipped_unavailable" | "failed" | "succeeded" {
  const raw = asText(value).toLowerCase();
  if (raw === "failed") {
    return "failed";
  }
  if (raw === "skipped_unavailable") {
    return "skipped_unavailable";
  }
  return "succeeded";
}

function mapLlmTelemetry(value: unknown): DashboardRunObservatorySnapshot["llmTelemetry"] {
  const raw = asRecord(value);
  if (!raw) {
    return undefined;
  }
  const summary = asRecord(raw.summary);
  return {
    contractVersion: asText(raw.contractVersion, "llm-runtime-telemetry/v1"),
    generatedAt: asText(raw.generatedAt, "agora"),
    summary: {
      totalAttempts: asNumber(summary?.totalAttempts) ?? 0,
      succeeded: asNumber(summary?.succeeded) ?? 0,
      failed: asNumber(summary?.failed) ?? 0,
      skippedUnavailable: asNumber(summary?.skippedUnavailable) ?? 0,
      fallbackAttempts: asNumber(summary?.fallbackAttempts) ?? 0,
      fallbackRate: asNumber(summary?.fallbackRate) ?? 0,
      averageLatencyMs: asNumber(summary?.averageLatencyMs) ?? 0,
      p95LatencyMs: asNumber(summary?.p95LatencyMs) ?? 0,
      providerCount: asNumber(summary?.providerCount) ?? 0,
      surfaceCount: asNumber(summary?.surfaceCount) ?? 0,
    },
    providers: asArray<LooseRecord>(raw.providers).map((provider) => ({
      providerName: asText(provider.providerName, "unknown"),
      attempts: asNumber(provider.attempts) ?? 0,
      succeeded: asNumber(provider.succeeded) ?? 0,
      failed: asNumber(provider.failed) ?? 0,
      skippedUnavailable: asNumber(provider.skippedUnavailable) ?? 0,
      fallbackAttempts: asNumber(provider.fallbackAttempts) ?? 0,
      averageLatencyMs: asNumber(provider.averageLatencyMs) ?? 0,
      p95LatencyMs: asNumber(provider.p95LatencyMs) ?? 0,
      lastStatus: normalizeLlmAttemptStatus(provider.lastStatus),
      lastError: asText(provider.lastError) || undefined,
      lastAttemptAt: asText(provider.lastAttemptAt, "agora"),
      models: asArray<string>(provider.models).map((entry) => asText(entry)).filter(Boolean),
    })),
    surfaces: asArray<LooseRecord>(raw.surfaces).map((surface) => ({
      surface: asText(surface.surface, "unknown"),
      attempts: asNumber(surface.attempts) ?? 0,
      fallbackAttempts: asNumber(surface.fallbackAttempts) ?? 0,
      fallbackRate: asNumber(surface.fallbackRate) ?? 0,
      averageLatencyMs: asNumber(surface.averageLatencyMs) ?? 0,
      p95LatencyMs: asNumber(surface.p95LatencyMs) ?? 0,
    })),
    recentAttempts: asArray<LooseRecord>(raw.recentAttempts).map((attempt) => ({
      id: asText(attempt.id, "llm-attempt:unknown"),
      recordedAt: asText(attempt.recordedAt, "agora"),
      runId: asText(attempt.runId) || null,
      traceId: asText(attempt.traceId) || null,
      sessionId: asText(attempt.sessionId) || null,
      surface: asText(attempt.surface, "unknown"),
      requestedProviderName: asText(attempt.requestedProviderName, "unknown"),
      primaryProviderName: asText(attempt.primaryProviderName, "unknown"),
      providerName: asText(attempt.providerName, "unknown"),
      modelName: asText(attempt.modelName) || null,
      status: normalizeLlmAttemptStatus(attempt.status),
      fallback: attempt.fallback === true,
      fallbackAllowed: attempt.fallbackAllowed === true,
      durationMs: asNumber(attempt.durationMs) ?? 0,
      error: asText(attempt.error) || undefined,
    })),
    receipts: asArray<string>(raw.receipts).map((entry) => asText(entry)).filter(Boolean),
  };
}

function mapRawRun(entry: LooseRecord): DashboardRunObservatorySnapshot["runs"][number] {
  const run = asRecord(entry.run) || entry;
  return {
    id: asText(run.id ?? run.runId, "run:unknown"),
    traceId: asText(run.traceId) || undefined,
    requestId: asText(run.requestId) || undefined,
    sessionId: asText(run.sessionId) || undefined,
    title: asText(run.title ?? run.input ?? run.summary, "Run do runtime"),
    status: normalizeStatus(run.status ?? run.state),
    summary: asText(run.summary ?? run.description, "Run registrada no observatorio."),
    updatedAt: asText(run.updatedAt ?? run.timestamp ?? run.createdAt, "agora"),
    providerLabel: asText(run.providerLabel ?? run.modelProfile?.providerLabel) || undefined,
    modelLabel: asText(run.modelLabel ?? run.modelProfile?.modelLabel) || undefined,
    eventCount: asNumber(run.eventCount ?? run.events?.length) ?? 0,
    artifactCount: asNumber(run.artifactCount ?? run.artifacts?.length) ?? 0,
    approvalCount: asNumber(run.approvalCount ?? run.approvals?.length) ?? 0,
    matchedBy: normalizeMatchedBy(entry.matchedBy).length > 0 ? normalizeMatchedBy(entry.matchedBy) : ["recent"],
  };
}

function buildFallbackRows(
  agentRun: DashboardAgentRun | null,
  tasks: DashboardTaskSummary[],
): DashboardRunObservatorySnapshot["runs"] {
  const rows: DashboardRunObservatorySnapshot["runs"] = [];
  if (agentRun) {
    rows.push({
      id: agentRun.id,
      traceId: agentRun.traceId,
      requestId: agentRun.requestId,
      sessionId: agentRun.sessionId,
      title: agentRun.title,
      status: agentRun.status,
      summary: agentRun.summary,
      updatedAt: agentRun.updatedAt,
      providerLabel: agentRun.providerLabel,
      modelLabel: agentRun.modelLabel,
      eventCount: agentRun.events.length,
      artifactCount: 0,
      approvalCount: 0,
      matchedBy: ["recent"],
    });
  }
  for (const task of tasks) {
    if (rows.some((row) => row.id === task.id || row.id === task.runId)) {
      continue;
    }
    rows.push({
      id: task.runId || task.id,
      sessionId: task.sessionId,
      title: task.title,
      status: task.status,
      summary: task.summary,
      updatedAt: task.updatedAt,
      eventCount: 0,
      artifactCount: 0,
      approvalCount: 0,
      matchedBy: ["recent"],
    });
  }
  return rows;
}

export function buildDashboardRunObservatory(input: {
  runObservatory?: LooseRecord | null;
  runtime?: LooseRecord | null;
  state?: LooseRecord | null;
}, agentRun: DashboardAgentRun | null, tasks: DashboardTaskSummary[]): DashboardRunObservatorySnapshot {
  const raw = asRecord(input.runObservatory)
    || asRecord(input.runtime?.runObservatory)
    || asRecord(input.state?.runObservatory);
  const fallbackRows = buildFallbackRows(agentRun, tasks);
  const rawRows = asArray<LooseRecord>(raw?.runs).map(mapRawRun);
  const runs = rawRows.length > 0 ? rawRows : fallbackRows;
  const receipts = asArray<LooseRecord>(raw?.receipts).map(mapReceipt);
  const timeline = asArray<LooseRecord>(raw?.timeline).map(mapTimelineEvent);
  const summary = asRecord(raw?.summary);
  const health = asRecord(raw?.health);
  const replay = asRecord(raw?.replay);
  const surface = asRecord(raw?.surface);
  const sidecars = mapSidecars(asRecord(raw?.sidecars));

  return {
    contractVersion: asText(raw?.contractVersion) || undefined,
    generatedAt: asText(raw?.generatedAt, new Date().toISOString()),
    query: asRecord(raw?.query) || {},
    totalRuns: asNumber(raw?.totalRuns) ?? runs.length,
    matchedRuns: asNumber(raw?.matchedRuns) ?? runs.length,
    summary: summary ? {
      totalRuns: asNumber(summary.totalRuns) ?? runs.length,
      matchedRuns: asNumber(summary.matchedRuns) ?? runs.length,
      eventCount: asNumber(summary.eventCount) ?? runs.reduce((total, row) => total + row.eventCount, 0),
      artifactCount: asNumber(summary.artifactCount) ?? runs.reduce((total, row) => total + row.artifactCount, 0),
      approvalCount: asNumber(summary.approvalCount) ?? runs.reduce((total, row) => total + row.approvalCount, 0),
      pendingApprovalCount: asNumber(summary.pendingApprovalCount) ?? 0,
      memorySignalCount: asNumber(summary.memorySignalCount) ?? 0,
      receiptCount: asNumber(summary.receiptCount) ?? receipts.length,
      replayableRunCount: asNumber(summary.replayableRunCount) ?? runs.filter((row) => row.eventCount > 0 || row.artifactCount > 0).length,
      failedRunCount: asNumber(summary.failedRunCount) ?? runs.filter((row) => row.status === "failed").length,
      waitingApprovalRunCount: asNumber(summary.waitingApprovalRunCount) ?? runs.filter((row) => row.status === "waiting_approval").length,
      runningRunCount: asNumber(summary.runningRunCount) ?? runs.filter((row) => row.status === "running" || row.status === "thinking").length,
    } : undefined,
    health: health ? {
      status: asText(health.status) === "degraded"
        ? "degraded"
        : asText(health.status) === "attention"
          ? "attention"
          : "ready",
      issues: asArray<string>(health.issues).map((entry) => asText(entry)).filter(Boolean),
      nextSafeAction: asText(health.nextSafeAction, "Filtrar runs sem executar tools."),
      receiptsAvailable: health.receiptsAvailable === true,
      replayAvailable: health.replayAvailable === true,
      staleRunCount: asNumber(health.staleRunCount) ?? 0,
    } : undefined,
    indexes: {
      runIds: asArray<string>(raw?.indexes?.runIds).map((entry) => asText(entry)).filter(Boolean),
      traceIds: asArray<string>(raw?.indexes?.traceIds).map((entry) => asText(entry)).filter(Boolean),
      sessionIds: asArray<string>(raw?.indexes?.sessionIds).map((entry) => asText(entry)).filter(Boolean),
      statuses: asArray<LooseRecord>(raw?.indexes?.statuses).map((entry) => ({
        status: normalizeStatus(entry.status),
        count: asNumber(entry.count) ?? 0,
      })),
    },
    runSummaries: asArray<LooseRecord>(raw?.runSummaries).map((entry) => ({
      id: asText(entry.id, "run:unknown"),
      traceId: asText(entry.traceId) || undefined,
      requestId: asText(entry.requestId) || undefined,
      sessionId: asText(entry.sessionId) || undefined,
      title: asText(entry.title, "Run do runtime"),
      status: normalizeStatus(entry.status),
      channel: asText(entry.channel) || undefined,
      providerLabel: asText(entry.providerLabel) || undefined,
      modelLabel: asText(entry.modelLabel) || undefined,
      eventCount: asNumber(entry.eventCount) ?? 0,
      artifactCount: asNumber(entry.artifactCount) ?? 0,
      approvalCount: asNumber(entry.approvalCount) ?? 0,
      pendingApprovalCount: asNumber(entry.pendingApprovalCount) ?? 0,
      memorySignalCount: asNumber(entry.memorySignalCount) ?? 0,
      receiptCount: asNumber(entry.receiptCount) ?? 0,
      replayable: entry.replayable === true,
      hasError: entry.hasError === true,
      firstEventAt: asText(entry.firstEventAt) || null,
      lastEventAt: asText(entry.lastEventAt, asText(entry.updatedAt, "agora")),
    })),
    runs,
    timeline,
    receipts,
    diffPreviews: mapDiffPreviews(raw?.diffPreviews),
    intelligenceFabricHealth: mapFabricHealth(raw?.intelligenceFabricHealth),
    llmTelemetry: mapLlmTelemetry(raw?.llmTelemetry),
    sidecars,
    replay: replay ? {
      available: replay.available === true,
      runCount: asNumber(replay.runCount) ?? runs.length,
      eventCount: asNumber(replay.eventCount) ?? runs.reduce((total, row) => total + row.eventCount, 0),
      artifactCount: asNumber(replay.artifactCount) ?? runs.reduce((total, row) => total + row.artifactCount, 0),
      receiptCount: asNumber(replay.receiptCount) ?? receipts.length,
      anchors: asArray<LooseRecord>(replay.anchors).map((anchor) => ({
        id: asText(anchor.id, "receipt:anchor"),
        runId: asText(anchor.runId, "run:unknown"),
        traceId: asText(anchor.traceId) || undefined,
        label: asText(anchor.label ?? anchor.title, "Anchor"),
        kind: normalizeReceiptKind(anchor.kind),
        status: asText(anchor.status, "done"),
        createdAt: asText(anchor.createdAt, "agora"),
      })),
      commandHints: asArray<string>(replay.commandHints).map((entry) => asText(entry)).filter(Boolean),
      summary: asText(replay.summary, "Replay do Run Observatory."),
    } : undefined,
    surface: surface ? {
      commandCenterPath: asText(surface.commandCenterPath, "/control"),
      cliCommand: asText(surface.cliCommand, "zavorth observatory --json"),
      filterHints: asArray<string>(surface.filterHints).map((entry) => asText(entry)).filter(Boolean),
    } : undefined,
  };
}
