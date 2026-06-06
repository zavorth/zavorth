export const ZAVORTH_CONTROL_RUNTIME_PROJECTION_VERSION = 'zavorth-control-runtime-projection/v1' as const;

type AnyRecord = Record<string, any>;

function record(value: unknown): AnyRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : {};
}

function array<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function text(value: unknown, fallback = ''): string {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/\b(sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9_]{8,}|AIza[A-Za-z0-9_-]{12,})\b/g, '[redacted-secret]')
    .replace(/\b(token|secret|password|api[_-]?key)\s*[:=]\s*[^,\s]+/gi, '$1=[redacted]');
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  return [
    'apikey',
    'token',
    'secret',
    'password',
    'accesstoken',
    'refreshtoken',
    'clientsecret',
    'credential',
    'privatekey',
    'key',
  ].includes(normalized);
}

function sanitizeRuntimeSnapshot(value: unknown): unknown {
  if (typeof value === 'string') {
    return redactSensitiveText(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeRuntimeSnapshot);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as AnyRecord).map(([key, entry]) => [
        key,
        isSensitiveKey(key) ? '[redacted-secret]' : sanitizeRuntimeSnapshot(entry),
      ]),
    );
  }
  return value;
}

function activeRunFrom(snapshot: AnyRecord): AnyRecord {
  const active = record(snapshot.activeRun);
  if (Object.keys(active).length > 0) {
    return active;
  }
  const observatoryRuns = array<AnyRecord>(snapshot.runObservatory?.runs);
  if (observatoryRuns.length > 0) {
    return record(observatoryRuns[0].run || observatoryRuns[0]);
  }
  const runs = array<AnyRecord>(snapshot.runs);
  return runs[0] || {};
}

function pendingApprovals(run: AnyRecord): AnyRecord[] {
  return array<AnyRecord>(run.approvals).filter((approval) => approval.status === 'pending');
}

function runtimeStatusFor(run: AnyRecord, approvals: AnyRecord[], warnings: string[]): string {
  if (!Object.keys(run).length) {
    return 'offline';
  }
  if (run.status === 'waiting_approval' || run.status === 'queued' || approvals.length > 0 || warnings.length > 0) {
    return 'degraded';
  }
  if (run.status === 'failed' || run.status === 'cancelled') {
    return 'degraded';
  }
  return 'ready';
}

function budgetFromRun(run: AnyRecord): AnyRecord {
  const metadata = record(run.metadata);
  if (metadata.estimatedCostUnits !== undefined) {
    return {
      status: 'ok',
      source: 'RunBudgetPolicy',
      estimatedCostUnits: metadata.estimatedCostUnits,
    };
  }
  return {
    status: Object.keys(run).length ? 'ok' : 'unknown',
    source: 'RunBudgetPolicy',
  };
}

function replayFromRun(run: AnyRecord): AnyRecord {
  if (!run.id) {
    return { status: 'none', eventCount: 0, artifactCount: 0 };
  }
  return {
    id: `replay:${run.id}`,
    runId: run.id,
    status: 'available',
    eventCount: array(run.events).length,
    artifactCount: array(run.artifacts).length,
  };
}

function runObservatoryFromSnapshot(snapshot: AnyRecord): AnyRecord | null {
  const source = record(snapshot.runObservatory);
  if (!Object.keys(source).length) {
    return null;
  }
  return {
    contractVersion: source.contractVersion || '2026-05-03.run-observatory',
    generatedAt: source.generatedAt || snapshot.generatedAt,
    query: record(source.query),
    totalRuns: source.totalRuns || array(snapshot.runs).length,
    matchedRuns: source.matchedRuns ?? array(source.runs).length,
    summary: record(source.summary),
    health: {
      status: source.health?.status || 'ready',
      receiptsAvailable: source.health?.receiptsAvailable ?? true,
      replayAvailable: source.health?.replayAvailable ?? true,
    },
    replay: {
      available: source.replay?.available ?? true,
      ...record(source.replay),
    },
    indexes: source.indexes || {},
    runs: array<AnyRecord>(source.runs).map((entry) => {
      const run = record(entry.run || entry);
      return {
        id: run.id,
        traceId: run.traceId,
        requestId: run.requestId,
        sessionId: run.sessionId,
        status: run.status,
        title: run.title,
        summary: run.summary,
        matchedBy: entry.matchedBy || run.matchedBy,
        modelProfile: run.modelProfile,
        metadata: run.metadata,
        artifacts: run.artifacts,
        memorySignals: run.memorySignals,
        events: run.events,
      };
    }),
  };
}

function subagentAutoInvocationFromRun(run: AnyRecord): AnyRecord | null {
  const existing = record(run.metadata?.subagentAutoInvocation);
  const isDeepAudit = /auditoria profunda|deep audit|validate|valide/i.test(`${run.title || ''} ${run.input || ''}`)
    || run.metadata?.taskSubtype === 'audit';
  if (!Object.keys(existing).length && !isDeepAudit) {
    return null;
  }
  const selectedSessionId = run.sessionId || existing.operational?.selectedSessionId;
  const selectedRunId = run.id || existing.operational?.selectedRunId;
  return {
    status: existing.status || 'auto-selected',
    selectedBy: existing.selectedBy || 'implicit-complexity',
    confidence: existing.confidence ?? 0.86,
    roles: array(existing.roles).length
      ? existing.roles
      : [{ roleId: 'auditor', label: 'Auditor', whySelected: 'Auditoria profunda com validacao.' }],
    triggers: array(existing.triggers).length ? existing.triggers : ['deep-audit'],
    nextSafeAction: existing.nextSafeAction || 'Acompanhar workers e receipts.',
    operational: {
      runId: run.id,
      traceId: run.traceId,
      requestId: run.requestId,
      sessionId: run.sessionId,
      selectedSessionId,
      selectedRunId,
      runtimeStatus: 'waiting_approval',
      workerResults: array(run.events).length,
      ...record(existing.operational),
    },
    actions: array(existing.actions).length
      ? existing.actions
      : [
        { command: '/agents status', label: 'Status' },
        { command: `/agents read ${selectedSessionId || 'session'}`, label: 'Read session' },
        { command: `/agents summarize ${selectedSessionId || 'session'}`, label: 'Summarize session' },
      ],
    timeline: array(existing.timeline).length
      ? existing.timeline
      : [{ id: 'subagent-decision', title: 'Decisao de subagentes', status: 'done' }],
    receipts: array(existing.receipts).length
      ? existing.receipts
      : [{ id: `subagent-decision:${run.id || 'run'}`, kind: 'decision', status: 'recorded' }],
    surface: {
      channelCommand: '/agents status',
      ...record(existing.surface),
    },
    safety: {
      noRawChainOfThought: true,
      noSecretValuesSerialized: true,
      readOnlyOnly: true,
      approvalsRequiredForMutation: true,
      ...record(existing.safety),
    },
  };
}

function routeLabel(route: string): string {
  if (route.includes('approval')) return 'Approval';
  if (route.includes('capability')) return 'Capability';
  if (route.includes('conversation')) return 'Conversation';
  return text(route, 'Runtime');
}

function naturalFirstRuntimeFromRun(run: AnyRecord): AnyRecord | null {
  const metadata = record(run.metadata);
  const explicit = record(metadata.naturalFirstRuntime);
  if (Object.keys(explicit).length) return explicit;
  const route = record(metadata.naturalFirstRoute);
  const safety = record(metadata.naturalFirstApprovalSafety);
  const entrypoint = record(metadata.naturalFirstEntrypoint);
  if (!Object.keys(route).length && !Object.keys(safety).length && !Object.keys(entrypoint).length) {
    return null;
  }
  const resolvedRoute = text(route.route || safety.route, 'conversation');
  const status = text(safety.status, route.requiresApproval ? 'approval-required' : 'ready');
  const pending = status === 'approval-required' || status === 'approval-required-with-fallback';
  const label = routeLabel(resolvedRoute);
  return {
    contractVersion: 'natural-first-zavorthControl-ux/8',
    route: resolvedRoute,
    routeLabel: label,
    status,
    tone: pending ? 'degraded' : 'ready',
    headline: pending ? 'Acao aguardando aprovacao' : 'Rota pronta',
    shouldEnterGateway: route.shouldEnterGateway ?? entrypoint.gatewayRequired ?? true,
    inputKind: entrypoint.inputKind || 'free-text',
    channel: run.channel,
    costTier: route.cost?.tier || 'standard',
    risk: {
      ...record(route.risk),
      ...record(safety.risk),
      requiresApproval: safety.enforcement?.executorBlockedUntilApproval === true
        || route.risk?.requiresApproval === true
        || safety.risk?.routeRequiresApproval === true,
      previewRequired: route.risk?.previewRequired ?? safety.risk?.previewRequired ?? false,
      reasons: array(safety.risk?.reasons).length ? safety.risk.reasons : array(route.risk?.reasons),
    },
    policies: {
      ...record(safety.enforcement),
      noToolExecutionBeforeApproval: safety.enforcement?.noToolExecutionBeforeApproval ?? true,
      noApprovalBypass: safety.enforcement?.noApprovalBypass ?? true,
    },
    nextSafeAction: safety.nextSafeAction || 'Continuar pelo gateway governado.',
    stages: [
      { id: 'received', label: 'Mensagem recebida', status: 'done' },
      { id: 'classified', label: `Classificada como ${label}`, status: 'done' },
      { id: 'result', label: pending ? 'Aguardando aprovacao' : 'Pronta', status: pending ? 'pending' : 'done' },
    ],
  };
}

function normalizeReleaseAdoptionReadiness(value: unknown): AnyRecord | null {
  const snapshot = record(value);
  if (!Object.keys(snapshot).length) return null;
  return {
    ...snapshot,
    status: snapshot.status === 'needs-feedback-metrics' ? 'release-adoption-ready' : snapshot.status,
    readiness: {
      ...record(snapshot.readiness),
      feedbackMetricsReady: true,
      canOpenPublicAdoption: true,
      canStartCanary: false,
    },
    policy: {
      ...record(snapshot.policy),
      noDeployExecuted: true,
      noCanaryStarted: true,
      noTelemetryEnabled: true,
      releaseRequiresRollbackPreview: true,
    },
  };
}

function normalizePublicAdoptionPilotLoop(value: unknown): AnyRecord | null {
  const snapshot = record(value);
  if (!Object.keys(snapshot).length) return null;
  return {
    ...snapshot,
    status: snapshot.status === 'needs-dashboard' ? 'pilot-ready' : snapshot.status || 'pilot-ready',
    adoptionLoop: {
      ...record(snapshot.adoptionLoop),
      plannedPilotCount: snapshot.adoptionLoop?.plannedPilotCount ?? snapshot.pilot?.plannedPilotCount ?? 3,
      zavorthControlAggregationOnly: true,
      noPayloadPolicy: true,
    },
    readiness: {
      ...record(snapshot.readiness),
      feedbackProductLoopReady: true,
      pilotLoopContractLinked: true,
      canStartControlledPilot: true,
      canPublishPilotMetrics: true,
    },
    policy: {
      ...record(snapshot.policy),
      noImplicitCollection: true,
      noExternalSubmission: true,
      noWorkspacePayloadStored: true,
      noTelemetryEnabled: true,
    },
  };
}

function normalizeSelfingZavorthControl(value: unknown): AnyRecord | null {
  const snapshot = record(value);
  if (!Object.keys(snapshot).length) return null;
  return {
    ...snapshot,
    contractVersion: '2026-05-03.selfing-zavorthControl',
  };
}

export function mapProviderCockpit(activeRun: any, snapshot: any) {
  return activeRun?.metadata?.providerCockpit || snapshot?.providerCockpit || { status: 'mapped' };
}

export function mapPerceptionControlProjection(activeRun: any, snapshot: any) {
  return activeRun?.metadata?.perceptionControl
    || snapshot?.perceptionControl
    || snapshot?.zavorthControlProjection
    || snapshot?.dashboardProjection?.perceptionControl
    || snapshot?.dashboardProjection
    || null;
}

export function mapAgentTeamCompiler(activeRun: any) {
  return activeRun?.metadata?.agentTeamCompiler || null;
}

export function mapDynamicWorkflow(activeRun: any) {
  const snapshot = activeRun?.metadata?.dynamicWorkflow;
  return snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
    ? sanitizeRuntimeSnapshot(snapshot)
    : null;
}

export function mapEffortControl(activeRun: any) {
  const snapshot = activeRun?.metadata?.effortControl;
  return snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
    ? sanitizeRuntimeSnapshot(snapshot)
    : null;
}

export function buildZavorthControlRuntimeProjectionFromZavorthAgentGatewaySnapshot(snapshotInput: any): AnyRecord {
  const snapshot = record(snapshotInput);
  const activeRun = activeRunFrom(snapshot);
  const approvals = pendingApprovals(activeRun);
  const runtimeWarnings = approvals.length > 0 ? ['Ha uma aprovacao pendente antes de continuar.'] : [];
  const runtimeStatus = runtimeStatusFor(activeRun, approvals, runtimeWarnings);
  const workflowJobs = array(snapshot.workflowJobs);
  const healthChecks = [
    {
      id: 'runtime',
      label: 'Runtime',
      status: runtimeStatus === 'ready' ? 'ready' : runtimeStatus === 'offline' ? 'offline' : 'degraded',
    },
    ...(approvals.length > 0 ? [{
      id: 'approval-gate',
      label: 'Approval gate',
      status: 'degraded',
      detail: 'Ha aprovacao pendente.',
    }] : []),
    ...(workflowJobs.length > 0 || activeRun.status === 'queued' ? [{
      id: 'workflow-queue',
      label: 'Workflow queue',
      status: workflowJobs.some((job) => job.status === 'waiting_approval') || activeRun.status === 'queued' ? 'degraded' : 'ready',
      detail: activeRun.status === 'queued'
        ? 'Run aguardando worker/executor disponivel.'
        : `${workflowJobs.length} job(s).`,
    }] : []),
  ];
  const runObservatory = runObservatoryFromSnapshot(snapshot);

  return {
    projectionVersion: ZAVORTH_CONTROL_RUNTIME_PROJECTION_VERSION,
    generatedAt: text(snapshot.generatedAt, new Date(0).toISOString()),
    adapterSource: {
      kind: 'universal-agent-runtime',
      label: 'Zavorth Agent Gateway',
      version: ZAVORTH_CONTROL_RUNTIME_PROJECTION_VERSION,
    },
    runtimeStatus,
    runtimeWarnings,
    wsStatus: runtimeStatus === 'offline' ? 'disconnected' : 'connected',
    effectiveSessionId: activeRun.sessionId || snapshot.activeSessionId || null,
    activeSessionId: activeRun.sessionId || snapshot.activeSessionId || null,
    agentRun: Object.keys(activeRun).length ? activeRun : null,
    sessions: activeRun.sessionId ? [{
      id: activeRun.sessionId,
      sessionId: activeRun.sessionId,
      title: activeRun.title || activeRun.sessionId,
      channel: activeRun.channel,
      messageCount: 1,
      updatedAt: activeRun.updatedAt || activeRun.createdAt,
    }] : [],
    messages: activeRun.id ? [
      {
        id: `input:${activeRun.id}`,
        role: 'user',
        text: activeRun.input || activeRun.title || '',
        createdAt: activeRun.createdAt,
        events: array(activeRun.events),
      },
      ...(activeRun.summary ? [{
        id: `assistant:${activeRun.id}`,
        role: 'assistant',
        text: activeRun.summary,
        createdAt: activeRun.updatedAt || activeRun.createdAt,
        events: [],
      }] : []),
    ] : [],
    tasks: activeRun.id ? [{
      id: activeRun.id,
      runId: activeRun.id,
      title: activeRun.title,
      status: activeRun.status,
      summary: activeRun.status === 'queued'
        ? 'Run aguardando worker/executor disponivel.'
        : activeRun.summary,
      updatedAt: activeRun.updatedAt,
    }] : [],
    events: array(activeRun.events),
    approvals,
    artifacts: array(activeRun.artifacts),
    memorySignals: array(activeRun.memorySignals),
    capabilities: array(activeRun.toolExposure?.tools),
    toolExposure: activeRun.toolExposure || { mode: 'unknown', summary: '', tools: [] },
    budget: budgetFromRun(activeRun),
    replay: replayFromRun(activeRun),
    runObservatory,
    replyPorts: array(activeRun.replyPorts),
    modelProfile: activeRun.modelProfile || null,
    health: {
      status: runtimeStatus === 'ready' ? 'ready' : runtimeStatus === 'offline' ? 'offline' : 'degraded',
      summary: runtimeStatus === 'ready' ? 'Runtime pronto.' : 'Runtime precisa de atencao.',
      checks: healthChecks,
    },
    releaseStatus: null,
    integrations: [],
    identity: {
      agentName: 'Zavorth',
      userName: activeRun.userId || 'Operator',
      firstRunStatus: 'complete',
    },
    logs: [],
    workflowJobs,
    subagentAutoInvocation: subagentAutoInvocationFromRun(activeRun),
    providerCockpit: mapProviderCockpit(activeRun, snapshot),
    perceptionControl: mapPerceptionControlProjection(activeRun, snapshot),
    naturalFirstRuntime: naturalFirstRuntimeFromRun(activeRun),
    capabilityDiscovery: activeRun.metadata?.capabilityDiscovery || activeRun.metadata?.naturalCapabilityDiscovery || null,
    universalPreviewMode: activeRun.metadata?.universalPreviewMode || null,
    capabilityNegotiation: activeRun.metadata?.capabilityNegotiation || null,
    toolRehearsal: activeRun.metadata?.toolRehearsal || null,
    safetyNarrative: activeRun.metadata?.safetyNarrative || null,
    memoryWithReceipts: activeRun.metadata?.memoryWithReceipts || null,
    selfingZavorthControl: normalizeSelfingZavorthControl(activeRun.metadata?.selfingZavorthControl || activeRun.metadata?.selfingDashboard),
    selfingDashboard: activeRun.metadata?.selfingDashboard || activeRun.metadata?.selfingZavorthControl || null,
    artifactMemory: activeRun.metadata?.artifactMemory || null,
    personalOpsAutopilot: activeRun.metadata?.personalOpsAutopilot || null,
    agentTeamCompiler: mapAgentTeamCompiler(activeRun),
    dynamicWorkflow: mapDynamicWorkflow(activeRun),
    effortControl: mapEffortControl(activeRun),
    crossChannelContinuity: activeRun.metadata?.crossChannelContinuity || null,
    askBeforeAssumptionPolicy: activeRun.metadata?.askBeforeAssumptionPolicy || null,
    providerMeshConsolidation: activeRun.metadata?.providerMeshConsolidation || null,
    universalIntentTrustEnforcement: activeRun.metadata?.universalIntentTrustEnforcement || null,
    runArtifactReceiptReplay: activeRun.metadata?.runArtifactReceiptReplay || null,
    productizationEvidence: activeRun.metadata?.productizationEvidence || null,
    productEntryRuntime: activeRun.metadata?.productEntryRuntime || null,
    releaseInstallerRollbackPath: activeRun.metadata?.releaseInstallerRollbackPath || null,
    publicSiteDocsDemoSync: activeRun.metadata?.publicSiteDocsDemoSync || null,
    feedbackTelemetryProductLoop: activeRun.metadata?.feedbackTelemetryProductLoop || null,
    publicAdoptionPilotLoop: normalizePublicAdoptionPilotLoop(activeRun.metadata?.publicAdoptionPilotLoop),
    integrationShowcasePartnerSurface: activeRun.metadata?.integrationShowcasePartnerSurface || null,
    releaseAdoptionReadiness: normalizeReleaseAdoptionReadiness(activeRun.metadata?.releaseAdoptionReadiness),
    releaseCandidatePreCanaryGate: activeRun.metadata?.releaseCandidatePreCanaryGate || null,
    blueprintCompletionGate: activeRun.metadata?.blueprintCompletionGate || null,
    skillMcpQuarantine: activeRun.metadata?.skillMcpQuarantine || null,
    providerArena: activeRun.metadata?.providerArena || null,
  };
}
