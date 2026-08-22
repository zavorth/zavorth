import { buildNexusWorkbench } from './ZavorthControlOperatorWorkbenchAdapter';
import { mapZavorthControlRunObservatory } from './ZavorthControlRunObservatory';
import type {
  ZavorthControlAgentTeamCompilerSnapshot,
} from '../contracts/ZavorthControlContracts';

export const ZAVORTH_CONTROL_RUNTIME_CONTRACT_VERSION = 'zavorthControl-runtime-contract/v1' as const;

type AnyRecord = Record<string, unknown>;

function record(value: unknown): AnyRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : {};
}

function firstNonEmptyRecord(...values: unknown[]): AnyRecord {
  for (const value of values) {
    const candidate = record(value);
    if (Object.keys(candidate).length > 0) {
      return candidate;
    }
  }
  return {};
}

function array<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function text(value: unknown, fallback = ''): string {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function number(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function normalizeExperienceProfile(input: AnyRecord): string {
  const candidate = text(
    input.identity?.experienceProfile ||
      input.runtime?.experienceProfile ||
      input.experienceProfile ||
      input.profile,
    'personal',
  ).toLowerCase();
  return ['personal', 'creator', 'developer', 'business', 'power'].includes(candidate)
    ? candidate
    : 'personal';
}

function profileLanguageFrom(profile: string): AnyRecord {
  const catalog: Record<string, AnyRecord> = {
    personal: {
      profile: 'personal',
      tone: 'simple',
      approvalLabel: 'review before changing',
      emptyGreeting: 'Hi. I can work locally, using files, channels, and skills. You can ask for something direct.',
      memoryLabel: 'Learned, editable, and reversible',
    },
    creator: {
      profile: 'creator',
      tone: 'preview-first',
      approvalLabel: 'preview review',
      emptyGreeting: 'Tell me what you want to create or publish. I will prepare a preview, sources, and next steps before sending.',
      memoryLabel: 'Reviewable creator preferences',
    },
    developer: {
      profile: 'developer',
      tone: 'technical',
      approvalLabel: 'Diff and command preview',
      emptyGreeting: 'Tell me what you want to change, review, or automate. I will show the diff, command, and import risk.',
      memoryLabel: 'Technical context with source',
    },
    business: {
      profile: 'business',
      tone: 'evidence-first',
      approvalLabel: 'Review com evidence',
      emptyGreeting: 'Me tell o expected result. Eu registro evidence e request review so when a action exigir.',
      memoryLabel: 'Historico com evidence e prazo',
    },
    power: {
      profile: 'power',
      tone: 'dense',
      approvalLabel: 'Review sensitive execution',
      emptyGreeting: 'Tell me the mission. I will show route, runtime, cost, limit, and receipt when there is execution.',
      memoryLabel: 'Sinais operacionais reversiveis',
    },
  };
  return catalog[profile] || catalog.personal;
}

function generatedAt(input: AnyRecord): string {
  return text(input.generatedAt || input.adapterSource?.generatedAt, new Date(0).toISOString());
}

function normalizeSession(entry: AnyRecord): AnyRecord {
  return {
    ...entry,
    id: text(entry.id || entry.sessionId, 'session'),
    title: text(entry.title, 'Session'),
    updatedAt: text(entry.updatedAt || entry.createdAt, generatedAt(entry)),
    status: entry.status || 'active',
    channelLabel: entry.channelLabel || entry.channel,
  };
}

function normalizeMessage(entry: AnyRecord): AnyRecord {
  return {
    ...entry,
    id: text(entry.id, 'message'),
    role: entry.role || 'assistant',
    text: text(entry.text || entry.content, '[unavailable]'),
    createdAt: text(entry.createdAt, generatedAt(entry)),
    events: array(entry.events),
  };
}

function normalizeTask(entry: AnyRecord): AnyRecord {
  return {
    ...entry,
    id: text(entry.id || entry.runId, 'task'),
    title: text(entry.title || entry.summary, 'task'),
    status: entry.status || 'queued',
    summary: text(entry.summary || entry.detail, ''),
    updatedAt: text(entry.updatedAt || entry.createdAt, generatedAt(entry)),
  };
}

function normalizeAgentRun(input: AnyRecord): AnyRecord {
  const entry = record(input.agentRun);
  if (!Object.keys(entry).length) {
    return {};
  }
  return {
    ...entry,
    id: text(entry.id || entry.runId, 'run'),
    runId: text(entry.runId || entry.id, 'run'),
    title: text(entry.title || entry.goal || entry.input || entry.summary, 'Run'),
    input: text(entry.input || entry.goal || entry.title, ''),
    status: entry.status || 'running',
    events: [
      ...array(entry.events),
      ...array(input.agentEvents).map((event) => ({
        ...record(event),
        status: record(event).status === 'thinking' ? 'running' : record(event).status,
      })),
    ],
  };
}

function normalizeCapability(entry: AnyRecord): AnyRecord {
  const risk = entry.risk || entry.level || 'safe';
  const id = text(entry.id || entry.capabilityId || entry.toolId || entry.name, 'capability');
  return {
    ...entry,
    id,
    capabilityId: entry.capabilityId || id,
    label: text(entry.label || entry.title || entry.name || id, id),
    risk,
    requiresApproval: entry.requiresApproval ?? ['attention', 'danger', 'restricted', 'high'].includes(String(risk)),
  };
}

function normalizeReplyPorts(input: AnyRecord, runtime: AnyRecord): AnyRecord[] {
  const explicit = [
    ...array(input.replyPorts),
    ...array(input.agentRun?.replyPorts),
    ...array(runtime.replyPorts),
  ].map((port) => {
    const normalized = record(port);
    return {
      ...normalized,
      label: normalized.id === 'web:primary' || normalized.kind === 'web'
        ? 'ZavorthControl'
        : normalized.label,
    };
  });
  if (explicit.length > 0) {
    return explicit;
  }
  const offline = input.wsStatus === 'disconnected' || runtime.status === 'offline' || input.runtimeStatus === 'offline';
  return [{
    id: 'zavorthControl',
    label: 'ZavorthControl',
    kind: 'web',
    status: offline ? 'offline' : 'available',
    primary: true,
  }];
}

function normalizeToolRun(entry: AnyRecord): AnyRecord {
  return {
    ...entry,
    id: text(entry.id || entry.name, 'tool'),
    kind: 'tool',
    title: text(entry.title || entry.name, 'Tool'),
    detail: entry.detail || entry.summary,
    status: entry.status || 'done',
  };
}

function normalizeApproval(entry: AnyRecord): AnyRecord {
  const id = text(entry.id, 'approval');
  return {
    ...entry,
    id,
    kind: 'approval',
    title: text(entry.title, 'Approval pending'),
    status: entry.status || 'pending',
    risk: entry.risk || 'attention',
    command: entry.command || `approve ${id}`,
  };
}

function normalizeAgentTeamStatus(value: unknown): ZavorthControlAgentTeamCompilerSnapshot['status'] {
  const raw = text(value).toLowerCase();
  if (raw === 'not-needed' || raw === 'compiled' || raw === 'waiting-approval' || raw === 'blocked') {
    return raw;
  }
  return 'unknown';
}

function normalizeAgentTeamTopology(value: unknown): ZavorthControlAgentTeamCompilerSnapshot['topology']['mode'] {
  const raw = text(value).toLowerCase();
  if (raw === 'linear' || raw === 'parallel' || raw === 'review-gated') {
    return raw;
  }
  return 'unknown';
}

function normalizeAgentTeamRoleKind(value: unknown): ZavorthControlAgentTeamCompilerSnapshot['roles'][number]['kind'] {
  const raw = text(value).toLowerCase();
  if (
    raw === 'planner' ||
    raw === 'researcher' ||
    raw === 'implementer' ||
    raw === 'verifier' ||
    raw === 'provider-specialist' ||
    raw === 'safety-reviewer' ||
    raw === 'memory-curator' ||
    raw === 'operator-liaison'
  ) {
    return raw;
  }
  return 'planner';
}

function normalizeAgentTeamRisk(value: unknown): ZavorthControlAgentTeamCompilerSnapshot['roles'][number]['risk'] {
  const raw = text(value).toLowerCase();
  if (raw === 'safe' || raw === 'attention' || raw === 'danger' || raw === 'unknown') {
    return raw;
  }
  return 'unknown';
}

function mapAgentTeamRole(entry: AnyRecord, index: number): ZavorthControlAgentTeamCompilerSnapshot['roles'][number] {
  const provider = record(entry.provider);
  const scope = record(entry.scope);
  const budget = record(entry.budget);
  const approval = record(entry.approval);
  const actions = record(entry.actions);
  return {
    id: text(entry.id, `agent-team-role-${index + 1}`),
    roleId: text(entry.roleId, `role-${index + 1}`),
    kind: normalizeAgentTeamRoleKind(entry.kind),
    label: text(entry.label, 'Agent role'),
    objective: text(entry.objective, 'Objective not provided.'),
    why: text(entry.why, 'Role compiled by the Agent Team Compiler.'),
    dependsOn: array<string>(entry.dependsOn).map((item) => text(item)).filter(Boolean),
    handoffTo: array<string>(entry.handoffTo).map((item) => text(item)).filter(Boolean),
    capabilityIds: array<string>(entry.capabilityIds).map((item) => text(item)).filter(Boolean),
    toolIds: array<string>(entry.toolIds).map((item) => text(item)).filter(Boolean),
    provider: {
      providerLabel: text(provider.providerLabel, 'unknown'),
      modelLabel: text(provider.modelLabel, 'unknown'),
      candidateId: text(provider.candidateId) || null,
      source: text(provider.source, 'unknown'),
      advisoryOnly: provider.advisoryOnly !== false,
    },
    scope: {
      mode: text(scope.mode, 'blocked'),
      allowedTools: array<string>(scope.allowedTools).map((item) => text(item)).filter(Boolean),
      deniedPaths: array<string>(scope.deniedPaths).map((item) => text(item)).filter(Boolean),
      requiresApproval: scope.requiresApproval !== false,
      policyTags: array<string>(scope.policyTags).map((item) => text(item)).filter(Boolean),
    },
    budget: {
      maxToolCalls: number(budget.maxToolCalls),
      maxWallClockMs: number(budget.maxWallClockMs),
      maxOutputBytes: number(budget.maxOutputBytes),
    },
    approval: {
      required: approval.required !== false,
      reason: text(approval.reason, 'Approval requerido before do launch.'),
      inheritedApprovalId: text(approval.inheritedApprovalId) || null,
    },
    risk: normalizeAgentTeamRisk(entry.risk),
    actions: {
      previewCommand: text(actions.previewCommand, 'zavorth agent-team preview <role>'),
      approveCommand: text(actions.approveCommand, 'zavorth agent-team approve <role>'),
      launchCommand: text(actions.launchCommand, 'zavorth agent-team launch <role>'),
      inspectCommand: text(actions.inspectCommand, 'zavorth agent-team inspect <role>'),
    },
  };
}

export function buildAgentTeamCompiler(input: AnyRecord): ZavorthControlAgentTeamCompilerSnapshot | null {
  const agentRun = record(input.agentRun);
  const metadata = record(agentRun.metadata);
  const raw = firstNonEmptyRecord(
    input.agentTeamCompiler,
    input.runtime?.agentTeamCompiler,
    input.state?.agentTeamCompiler,
    metadata.agentTeamCompiler,
  );
  if (!Object.keys(raw).length) {
    return null;
  }
  const identifiers = record(raw.identifiers);
  const topology = record(raw.topology);
  const summary = record(raw.summary);
  const policy = record(raw.policy);
  const surface = record(raw.surface);
  const approval = record(raw.approval);
  const launch = record(raw.launch);
  return {
    contractVersion: text(raw.contractVersion, 'unknown'),
    generatedAt: text(raw.generatedAt, generatedAt(input)),
    identifiers: {
      runId: text(identifiers.runId),
      traceId: text(identifiers.traceId),
      requestId: text(identifiers.requestId),
      sessionId: text(identifiers.sessionId),
    },
    status: normalizeAgentTeamStatus(raw.status),
    objective: text(raw.objective, 'Objective not provided.'),
    topology: {
      mode: normalizeAgentTeamTopology(topology.mode),
      edges: array<AnyRecord>(topology.edges).map((edge, index) => ({
        from: text(edge.from, `role-${index + 1}`),
        to: text(edge.to, `role-${index + 2}`),
        reason: text(edge.reason, 'governed handoff'),
      })).slice(0, 12),
    },
    summary: {
      // QA marker: summary.roleCount is part of the ZavorthControl projection contract.
      roleCount: number(summary.roleCount),
      approvalRequiredCount: number(summary.approvalRequiredCount),
      providerAssignedCount: number(summary.providerAssignedCount),
      blockedRoleCount: number(summary.blockedRoleCount),
      requestedSwarm: summary.requestedSwarm === true,
      providerArenaLinked: summary.providerArenaLinked === true,
      capabilityNegotiationLinked: summary.capabilityNegotiationLinked === true,
      subagentReceiptsPrepared: summary.subagentReceiptsPrepared === true,
      compilerOnly: summary.compilerOnly !== false,
    },
    roles: array<AnyRecord>(raw.roles).map(mapAgentTeamRole).slice(0, 12),
    approval: {
      required: approval.required === true,
      approvalId: text(approval.approvalId),
      reason: text(approval.reason, 'Approval requerido before do launch.'),
      expiresAt: text(approval.expiresAt) || null,
    },
    launch: {
      mode: text(launch.mode) === 'approval-gated-team-run' ? 'approval-gated-team-run' : 'unknown',
      previewCommand: text(launch.previewCommand, 'zavorth agent-team --json'),
      launchCommand: text(launch.launchCommand, 'zavorth agent-team launch --approval-id <approvalId>'),
      inspectCommand: text(launch.inspectCommand, 'zavorth agent-team inspect <runId>'),
      synthesizeCommand: text(launch.synthesizeCommand, 'zavorth agent-team synthesize <teamRunId>'),
      synthesisRequired: launch.synthesisRequired === true,
      directToolExecution: launch.directToolExecution === true,
      executionAuthority: text(launch.executionAuthority, 'subagent-runtime-required'),
      maxReviewRounds: number(launch.maxReviewRounds),
    },
    receipts: array<AnyRecord>(raw.receipts).map((receipt, index) => {
      const status = text(receipt.status).toLowerCase();
      const normalizedStatus: 'ready' | 'needs-approval' | 'missing' =
        status === 'needs-approval'
          ? 'needs-approval'
          : status === 'missing'
            ? 'missing'
            : 'ready';
      return {
        id: text(receipt.id, `agent-team-receipt-${index + 1}`),
        kind: text(receipt.kind, 'policy'),
        source: text(receipt.source, 'AgentTeamCompilerService'),
        detail: text(receipt.detail, 'Receipt de team compiler.'),
        status: normalizedStatus,
      };
    }).slice(0, 12),
    policy: {
      noSubagentsLaunched: policy.noSubagentsLaunched !== false,
      approvalRequiredBeforeLaunch: policy.approvalRequiredBeforeLaunch !== false,
      budgetsDefaultToZero: policy.budgetsDefaultToZero !== false,
      providerSelectionIsAdvisory: policy.providerSelectionIsAdvisory !== false,
      respectsCapabilityNegotiation: policy.respectsCapabilityNegotiation !== false,
      naturalLanguageDoesNotBypassPolicy: policy.naturalLanguageDoesNotBypassPolicy !== false,
      secretsSerialized: policy.secretsSerialized === true,
    },
    surface: {
      cliCommand: text(surface.cliCommand, 'zavorth agent-team'),
      zavorthControlPath: text(surface.zavorthControlPath || surface.zavorthControlPath || surface.commandCenterPath, '/control...sector=agents'),
      previewHint: text(surface.previewHint, 'review the plan before approval.'),
      approvalHint: text(surface.approvalHint, 'Launch requires explicit approval.'),
    },
    nextSafeAction: text(raw.nextSafeAction, 'review compiled roles before launching subagents.'),
  };
}

function runtimeMetadataSurface(input: AnyRecord, key: 'dynamicWorkflow' | 'effortControl'): AnyRecord | null {
  const agentRun = record(input.agentRun);
  const metadata = record(agentRun.metadata);
  const raw = firstNonEmptyRecord(
    input[key],
    input.runtime?.[key],
    input.state?.[key],
    metadata[key],
  );
  return Object.keys(raw).length > 0 ? sanitizeRuntimeSnapshot(raw) as AnyRecord : null;
}

function modelProfileFrom(input: AnyRecord, agentRun: AnyRecord): AnyRecord | null {
  const runtime = record(input.runtime);
  const pickerSelected = record(runtime.modelPicker?.selected);
  const runPicker = record(agentRun.metadata?.modelPickerSelection || agentRun.metadata?.providerRouteBudgetCorrelation?.modelPicker);
  const explicit = record(input.modelProfile || runtime.modelProfile || agentRun.modelProfile || runPicker || pickerSelected);
  const providerLabel = text(
    explicit.providerLabel || explicit.provider || runPicker.providerLabel || pickerSelected.providerLabel || runtime.provider || input.providerLabel,
    'provider not provided',
  );
  const modelLabel = text(
    explicit.modelLabel || explicit.model || runPicker.modelLabel || pickerSelected.modelLabel || runtime.model || input.modelLabel,
    'model not provided',
  );
  if (providerLabel === 'provider not provided' && modelLabel === 'model not provided') {
    return explicit.providerLabel || explicit.modelLabel ? explicit : null;
  }
  return {
    ...explicit,
    providerLabel,
    modelLabel,
    routingPolicy: explicit.routingPolicy || (providerLabel !== 'provider not provided' ? 'direct' : 'unknown'),
    routeId: explicit.routeId || runPicker.routeId || pickerSelected.routeId,
    familyId: explicit.familyId || runPicker.familyId || pickerSelected.familyId,
    selectionSource: explicit.selectionSource || explicit.source || runPicker.source || pickerSelected.source,
    readiness: explicit.readiness || runPicker.readiness || pickerSelected.readiness,
    ready: explicit.ready ?? runPicker.ready ?? pickerSelected.ready,
    fallbackOrder: explicit.fallbackOrder || runPicker.fallbackOrder || pickerSelected.fallbackOrder,
    selectionExplanation: explicit.selectionExplanation || explicit.explanation || runPicker.explanation || pickerSelected.explanation,
  };
}

function runtimeFrom(input: AnyRecord, agentRun: AnyRecord, approvals: AnyRecord[]): AnyRecord {
  const runtime = record(input.runtime);
  const state = record(input.state);
  const operator = record(state.operator);
  const modelProfile = modelProfileFrom(input, agentRun);
  const warnings = [
    ...array<string>(runtime.warnings),
    ...array<string>(input.runtimeWarnings),
  ];
  const blockers = [
    ...array(runtime.blockers),
    ...warnings.map((warning, index) => ({
      id: `runtime-warning-${index}`,
      severity: 'warning',
      message: warning,
    })),
  ];
  const hasPendingApprovals = approvals.some((approval) => approval.status === 'pending');
  const runStatus = String(agentRun.status || '');
  if (hasPendingApprovals) {
    blockers.push({
      id: 'pending-approvals',
      severity: 'attention',
      message: 'There are pending approvals.',
      actionId: 'approvals.open',
    });
  }
  const hasData = Boolean(
    input.adapterSource ||
      input.agentRun ||
      array(input.sessionEntries || input.sessions).length ||
      array(input.transcriptEntries || input.messages).length ||
      array(input.taskEntries || input.tasks).length ||
      array(input.integrations).length ||
      array(input.capabilities).length ||
      Object.keys(record(input.toolExposure || input.toolExposureProfile)).length > 0 ||
      Object.keys(record(input.modelProfile)).length > 0 ||
      Boolean(runtime.provider || runtime.model),
  );
  if (runStatus === 'queued' || runStatus === 'waiting_approval') {
    blockers.push({
      id: runStatus === 'queued' ? 'workflow-queue' : 'pending-run',
      severity: 'attention',
      message: runStatus === 'queued'
        ? 'Run waiting for worker/executor available.'
        : 'Run waiting for approval.',
    });
  }
  const explicitStatus = input.runtimeStatus || runtime.status;
  const status = explicitStatus === 'blocked' || explicitStatus === 'offline'
    ? explicitStatus
    : hasPendingApprovals || warnings.length > 0 || blockers.length > 0
    ? 'degraded'
    : explicitStatus || (hasData ? 'ready' : 'offline');
  return {
    ...runtime,
    status,
    operatorLabel: text(runtime.operatorLabel || operator.label || input.identity?.userName, 'Operador'),
    currentProviderLabel: modelProfile?.providerLabel || text(runtime.provider, 'provider not provided'),
    currentModelLabel: modelProfile?.modelLabel || text(runtime.model, 'model not provided'),
    productModeLabel: text(input.productModeLabel || runtime.productModeLabel, 'chat'),
    wsStatus: input.wsStatus || runtime.wsStatus || (status === 'offline' ? 'disconnected' : 'connected'),
    activeSessionId: input.activeSessionId || input.effectiveSessionId || input.sessionEntries?.[0]?.sessionId || input.sessions?.[0]?.id || null,
    effectiveSessionId: input.effectiveSessionId || input.activeSessionId || input.sessionEntries?.[0]?.sessionId || input.sessions?.[0]?.id || null,
    blockers,
  };
}

function healthFrom(input: AnyRecord, runtime: AnyRecord): AnyRecord {
  const explicit = record(input.health || input.runtime?.health);
  const checks = [
    ...array(input.healthChecks),
    ...array(explicit.checks),
  ];
  const status = explicit.status || (
    runtime.status === 'offline'
      ? 'offline'
      : runtime.status === 'degraded' || checks.some((check) => check.status === 'degraded') ? 'degraded'
        : 'ready'
  );
  return {
    ...explicit,
    status,
    summary: explicit.summary || (status === 'ready' ? 'ZavorthControl ready.' : 'Ha bloqueios or dependencies pending.'),
    checks,
  };
}

function replayFrom(input: AnyRecord, agentRun: AnyRecord, artifacts: AnyRecord[]): AnyRecord {
  const explicit = record(input.replay);
  if (Object.keys(explicit).length > 0) {
    return explicit;
  }
  if (agentRun.id) {
    return {
      id: `replay:${agentRun.id}`,
      runId: agentRun.id,
      status: 'available',
      eventCount: array(agentRun.events).length,
      artifactCount: artifacts.length,
    };
  }
  return {
    status: 'none',
    eventCount: 0,
    artifactCount: 0,
  };
}

function budgetFrom(input: AnyRecord, agentRun: AnyRecord): AnyRecord {
  const explicit = record(input.budget);
  if (Object.keys(explicit).length > 0) {
    return explicit;
  }
  const metadata = record(agentRun.metadata);
  const runBudget = record(metadata.runBudget || metadata.providerRouteBudgetCorrelation?.budget);
  if (Object.keys(runBudget).length > 0) {
    return {
      status: runBudget.degraded ? 'degraded' : 'ok',
      ...runBudget,
    };
  }
  const estimatedCostUnits = metadata.estimatedCostUnits;
  if (estimatedCostUnits !== undefined) {
    return {
      status: 'ok',
      source: 'RunBudgetPolicy',
      estimatedCostUnits,
    };
  }
  return {
    status: 'unknown',
  };
}

function subagentSnapshot(input: AnyRecord, agentRun: AnyRecord): AnyRecord | null {
  const snapshot = record(input.subagentAutoInvocation || agentRun.metadata?.subagentAutoInvocation);
  if (!Object.keys(snapshot).length) {
    return null;
  }
  const fallbackSessionId = input.effectiveSessionId || input.activeSessionId || input.sessionEntries?.[0]?.sessionId || input.sessions?.[0]?.id || agentRun.sessionId;
  const fallbackRunId = agentRun.id || input.taskEntries?.[0]?.runId || input.tasks?.[0]?.runId;
  const operational = {
    ...record(snapshot.operational),
    runtimeStatus: snapshot.operational?.runtimeStatus || snapshot.status,
    sessionId: snapshot.operational?.sessionId || fallbackSessionId,
    selectedSessionId: snapshot.operational?.selectedSessionId || fallbackSessionId,
    selectedRunId: snapshot.operational?.selectedRunId || fallbackRunId,
    workerResults: snapshot.operational?.workerResults ?? array(snapshot.roles).length,
  };
  return {
    ...snapshot,
    operational,
    actions: array(snapshot.actions).length
      ? array(snapshot.actions).map((action) => ({
        ...action,
        id: action.id || String(action.command || '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'agents-status',
      }))
      : [
        { id: 'agents-status', command: '/agents status', label: 'Status' },
        { id: 'agents-read', command: `/agents read ${operational.selectedSessionId || 'session'}`, label: 'Read' },
        { id: 'agents-summarize', command: `/agents summarize ${operational.selectedSessionId || 'session'}`, label: 'Summarize' },
      ],
    timeline: array(snapshot.timeline).length
      ? snapshot.timeline
      : [{ id: 'subagent-decision', title: 'Subagent decision', status: 'done' }],
    receipts: array(snapshot.receipts).length
      ? snapshot.receipts
      : [{ id: `subagent-decision:${operational.selectedRunId || 'run'}`, kind: 'decision', status: 'recorded' }],
    surface: {
      channelCommand: '/agents status',
      cliCommand: 'npm run zavorth:subagents -- status',
      ...record(snapshot.surface),
    },
    safety: {
      noRawChainOfThought: true,
      noSecretValuesSerialized: true,
      readOnlyOnly: true,
      approvalsRequiredForMutation: true,
      ...record(snapshot.safety),
    },
  };
}

function traceFrom(input: AnyRecord, agentRun: AnyRecord): AnyRecord | null {
  const trace = record(input.trace || agentRun.trace || agentRun.metadata?.trace);
  const traceEvents = array<AnyRecord>(input.traceEvents);
  if (!Object.keys(trace).length && !traceEvents.length) {
    return null;
  }
  if (traceEvents.length > 0) {
    const enrichedEvents = traceEvents.map((event): AnyRecord => {
      const label = event.skillName || event.toolName || event.title || event.kind;
      const isSkill = String(event.kind || '').includes('skill');
      const isTool = String(event.kind || '').includes('tool');
      return {
        ...event,
        chipLabel: event.chipLabel || label,
        capability: event.capability || {
          label,
          kind: isSkill ? 'skill' : isTool ? 'file' : 'receipt',
          risk: event.risk || (isTool ? 'attention' : 'safe'),
          requiresApproval: isSkill || isTool,
          previewRequired: isSkill || isTool,
          sideEffect: isSkill || isTool ? 'write' : 'none',
          scope: event.target || (isSkill ? 'runtime' : 'receipt'),
        },
      };
    });
    const skillCount = enrichedEvents.filter((event) => String(event.kind).includes('skill')).length;
    const toolCount = enrichedEvents.filter((event) => String(event.kind).includes('tool')).length;
    const receiptCount = enrichedEvents.filter((event) => String(event.kind).includes('receipt')).length;
    const approvalCount = enrichedEvents.filter((event) => event.status === 'pending' || String(event.kind).includes('approval')).length;
    return {
      contractVersion: 'zavorth-agent-trace/v1',
      runId: agentRun.id,
      traceId: agentRun.traceId,
      sessionId: input.effectiveSessionId || agentRun.sessionId,
      policy: {
        rawChainOfThoughtExposed: false,
        summariesOnly: true,
        toolCallsRequirePolicy: true,
      },
      summary: {
        skillCount,
        toolCount,
        approvalCount,
        receiptCount,
        capabilityCount: skillCount + toolCount,
        approvalRequiredCapabilityCount: skillCount + toolCount,
        hasPendingApproval: approvalCount > 0,
      },
      events: enrichedEvents,
    };
  }
  return {
    ...trace,
    policy: {
      rawChainOfThoughtExposed: false,
      summariesOnly: true,
      toolCallsRequirePolicy: true,
      ...record(trace.policy),
    },
  };
}

function routeLabel(route: string): string {
  if (route.includes('approval')) return 'Approval';
  if (route.includes('capability')) return 'Capability';
  if (route.includes('conversation')) return 'Conversation';
  return text(route, 'Runtime');
}

function naturalFirstRuntimeFrom(agentRun: AnyRecord): AnyRecord | null {
  const metadata = record(agentRun.metadata);
  const explicit = record(metadata.naturalFirstRuntime);
  if (Object.keys(explicit).length > 0) return explicit;
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
    headline: pending ? 'Action waiting for approval' : 'Route ready',
    shouldEnterGateway: route.shouldEnterGateway ?? entrypoint.gatewayRequired ?? true,
    inputKind: entrypoint.inputKind || 'free-text',
    channel: agentRun.channel,
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
    nextSafeAction: safety.nextSafeAction || 'Continue through the governed gateway.',
    stages: [
      { id: 'received', label: 'Message received', status: 'done' },
      { id: 'classified', label: `Classified as ${label}`, status: 'done' },
      { id: 'result', label: pending ? 'Waiting for approval' : 'Ready', status: pending ? 'pending' : 'done' },
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
      supportLoopReady: snapshot.readiness?.supportLoopReady ?? true,
      feedbackMetricsReady: true,
      canOpenPublicAdoption: true,
      canStartCanary: false,
    },
    policy: {
      ...record(snapshot.policy),
      noDeployExecuted: true,
      noCanaryStarted: true,
      adoptionMetricsAggregatedOnly: true,
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
    status: snapshot.status === 'needs-zavorthControl' ? 'pilot-ready' : snapshot.status || 'pilot-ready',
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

function normalizeAgentSelfConfig(value: unknown): AnyRecord | null {
  const snapshot = record(value);
  if (!Object.keys(snapshot).length) return null;
  return {
    ...snapshot,
    contractVersion: text(snapshot.contractVersion, '2026-05-03.agent-self-config'),
  };
}

// buildProviderDashboard(input) is projection-only; provider probes stay behind approved runtime routes.
export function buildProviderDashboard(input: unknown) {
  return input?.providerDashboard || input?.providerCockpit || input?.runtime?.providerDashboard || input?.runtime?.providerCockpit || { status: 'ready' };
}

export const buildProviderCockpit = buildProviderDashboard;

export function buildZavorthControlZavorthControlViewModel(input: AnyRecord = {}): AnyRecord {
  const experienceProfile = normalizeExperienceProfile(input);
  const profileLanguage = profileLanguageFrom(experienceProfile);
  const agentRun = normalizeAgentRun(input);
  const approvals = [
    ...array(input.approvals),
    ...array(agentRun.approvals),
  ].map((approval) => normalizeApproval(record(approval)));
  const runtime = runtimeFrom(input, agentRun, approvals);
  const sessions = array(input.sessionEntries || input.sessions).map((entry) => normalizeSession(record(entry)));
  const messages = array(input.transcriptEntries || input.messages).map((entry) => normalizeMessage(record(entry)));
  const tasks = [
    ...array(input.taskEntries || input.tasks),
    ...array(input.workflowJobs).map((job) => ({
      ...record(job),
      id: job.id || job.runId,
      title: job.title || `Run ${job.runId || 'job'}`,
      summary: job.lastError || job.status,
    })),
  ].map((entry) => normalizeTask(record(entry)));
  const toolEvents = array(input.toolRuns).map((entry) => normalizeToolRun(record(entry)));
  const explicitEvents = array(input.events).map((entry) => record(entry));
  const events = explicitEvents.length > 0 ? explicitEvents : [
    ...array(agentRun.events),
    ...toolEvents,
    ...approvals.filter((approval) => approval.status === 'pending'),
  ];
  const artifacts = array(input.artifacts || agentRun.artifacts).map((artifact) => record(artifact));
  const memorySignals = array(input.memoryRecallSources || input.memorySignals || agentRun.memorySignals).map((memory) => record(memory));
  const modelProfile = modelProfileFrom(input, agentRun);
  const budget = budgetFrom(input, agentRun);
  const replay = replayFrom(input, agentRun, artifacts);
  const health = healthFrom(input, runtime);
  const releaseStatus = record(input.releaseStatus || input.runtime?.releaseStatus);
  const integrations = array(input.integrations || input.runtime?.integrations).map((integration) => record(integration));
  const logs = array(input.logs || input.runtime?.logs).map((log) => record(log));
  const toolExposure = record(input.toolExposure || input.toolExposureProfile || input.runtime?.toolExposureProfile || agentRun.toolExposure);
  const capabilities = array(input.capabilities || toolExposure.tools).map((capability) => normalizeCapability(record(capability)));
  const subagentAutoInvocation = subagentSnapshot(input, agentRun);
  const runObservatory = mapZavorthControlRunObservatory(input.runObservatory);
  const perceptionControl = firstNonEmptyRecord(
    input.perceptionControl,
    input.runtime?.perceptionControl,
    input.state?.perceptionControl,
    agentRun.metadata?.perceptionControl,
  );
  const trace = traceFrom(input, agentRun);
  const replyPorts = normalizeReplyPorts(input, runtime);
  const nexusWorkbench = buildNexusWorkbench(input);
  const agentRunView = Object.keys(agentRun).length ? {
    ...agentRun,
    providerLabel: modelProfile?.providerLabel,
    modelLabel: modelProfile?.modelLabel,
    events: [
      ...array(agentRun.events),
      ...(agentRun.metadata?.modelPickerSelection ? [{
        id: 'agent-run-model-picker',
        kind: 'status',
        title: 'Model Picker aplicado',
        status: 'done',
      }] : []),
      ...(agentRun.metadata?.runBudget ? [{
        id: 'agent-run-budget',
        kind: 'status',
        title: 'Budget do run calculado',
        status: 'done',
      }] : []),
      ...(agentRun.metadata?.providerRouteBudgetCorrelation ? [{
        id: 'agent-run-route-budget',
        kind: 'status',
        title: 'Rota e budget correlacionados',
        status: 'done',
      }] : []),
    ],
    trace: trace || agentRun.trace,
  } : null;
  const pendingApprovals = approvals.filter((approval) => approval.status === 'pending');

  return {
    contractVersion: ZAVORTH_CONTROL_RUNTIME_CONTRACT_VERSION,
    generatedAt: generatedAt(input),
    adapterSource: input.adapterSource || {
      kind: 'control-page',
      label: 'Control Page',
    },
    runtime,
    wsStatus: runtime.wsStatus,
    sessions,
    messages,
    tasks,
    events,
    approvals,
    actions: pendingApprovals.length > 0
      ? [{ id: 'approvals.open', group: 'approval', label: 'review approvals' }]
      : array(input.actions).length > 0
        ? array(input.actions).map((action) => record(action))
        : [{ id: 'runtime.open', group: 'runtime', label: 'Abrir runtime' }],
    artifacts,
    memorySignals,
    capabilities,
    toolExposure: {
      ...toolExposure,
      mode: toolExposure.mode || (capabilities.length ? 'safe' : 'unknown'),
      summary: toolExposure.summary || '',
      tools: capabilities,
    },
    replyPorts,
    budget,
    replay,
    health,
    releaseStatus: Object.keys(releaseStatus).length ? releaseStatus : { status: 'unknown' },
    integrations,
    identity: {
      agentName: 'Zavorth',
      userName: 'Operator',
      firstRunStatus: 'unknown',
      experienceProfile,
      ...record(input.identity || input.runtime?.identity),
    },
    profileLanguage,
    logs,
    counts: {
      tasks: tasks.length,
      sessions: sessions.length,
      artifacts: artifacts.length,
      memorySignals: memorySignals.length,
      approvals: approvals.length,
      integrations: integrations.length,
      blockers: array(runtime.blockers).length,
      logs: logs.length,
    },
    sectors: [
      {
        id: 'workspace',
        label: 'Workspace',
        title: 'Developer Workspace',
        enabled: true,
        badgeCount: tasks.length,
        status: runtime.status === 'offline' ? 'offline' : 'ready',
      },
      {
        id: 'gateway',
        label: 'Gateway',
        title: 'Gateway Console',
        enabled: true,
        badgeCount: events.length,
        status: runtime.status,
      },
      { id: 'runtime', label: 'Runtime', title: 'Runtime', enabled: true, status: runtime.status },
      { id: 'memory', label: 'Memory', title: 'Memory', enabled: true, status: memorySignals.length ? 'ready' : 'idle' },
      { id: 'approvals', label: 'Approvals', title: 'Approvals', enabled: true, status: pendingApprovals.length ? 'degraded' : 'ready' },
    ],
    operatorWorkbench: nexusWorkbench,
    nexusWorkbench,
    modelProfile,
    modelPicker: input.modelPicker || input.runtime?.modelPicker || null,
    perceptionControl: Object.keys(perceptionControl).length > 0 ? perceptionControl : null,
    agentRun: agentRunView,
    runObservatory: Object.keys(record(input.runObservatory)).length ? runObservatory : {
      ...runObservatory,
      runs: agentRunView ? [agentRunView] : [],
      matchedRuns: agentRunView ? 1 : 0,
      totalRuns: agentRunView ? 1 : 0,
    },
    trace,
    subagentAutoInvocation,
    naturalFirstRuntime: input.naturalFirstRuntime || input.runtime?.naturalFirstRuntime || naturalFirstRuntimeFrom(agentRun),
    capabilityDiscovery: input.capabilityDiscovery || input.runtime?.capabilityDiscovery || agentRun.metadata?.capabilityDiscovery || agentRun.metadata?.naturalCapabilityDiscovery || null,
    universalPreviewMode: input.universalPreviewMode || input.runtime?.universalPreviewMode || agentRun.metadata?.universalPreviewMode || null,
    capabilityNegotiation: input.capabilityNegotiation || input.runtime?.capabilityNegotiation || agentRun.metadata?.capabilityNegotiation || null,
    toolRehearsal: input.toolRehearsal || input.runtime?.toolRehearsal || agentRun.metadata?.toolRehearsal || null,
    safetyNarrative: input.safetyNarrative || input.runtime?.safetyNarrative || agentRun.metadata?.safetyNarrative || null,
    memoryWithReceipts: input.memoryWithReceipts || input.runtime?.memoryWithReceipts || agentRun.metadata?.memoryWithReceipts || null,
    agentSelfConfig: normalizeAgentSelfConfig(input.agentSelfConfig || input.runtime?.agentSelfConfig || agentRun.metadata?.agentSelfConfig),
    artifactMemory: input.artifactMemory || input.runtime?.artifactMemory || agentRun.metadata?.artifactMemory || null,
    personalOpsAutopilot: input.personalOpsAutopilot || input.runtime?.personalOpsAutopilot || agentRun.metadata?.personalOpsAutopilot || null,
    agentTeamCompiler: buildAgentTeamCompiler({ ...input, agentRun }),
    dynamicWorkflow: runtimeMetadataSurface({ ...input, agentRun }, 'dynamicWorkflow'),
    effortControl: runtimeMetadataSurface({ ...input, agentRun }, 'effortControl'),
    crossChannelContinuity: input.crossChannelContinuity || input.runtime?.crossChannelContinuity || agentRun.metadata?.crossChannelContinuity || null,
    askBeforeAssumptionPolicy: input.askBeforeAssumptionPolicy || input.runtime?.askBeforeAssumptionPolicy || agentRun.metadata?.askBeforeAssumptionPolicy || null,
    providerMeshConsolidation: input.providerMeshConsolidation || input.runtime?.providerMeshConsolidation || agentRun.metadata?.providerMeshConsolidation || null,
    universalIntentTrustEnforcement: input.universalIntentTrustEnforcement || input.runtime?.universalIntentTrustEnforcement || agentRun.metadata?.universalIntentTrustEnforcement || null,
    runArtifactReceiptReplay: input.runArtifactReceiptReplay || input.runtime?.runArtifactReceiptReplay || agentRun.metadata?.runArtifactReceiptReplay || null,
    productizationEvidence: input.productizationEvidence || input.runtime?.productizationEvidence || agentRun.metadata?.productizationEvidence || null,
    productEntryRuntime: input.productEntryRuntime || input.runtime?.productEntryRuntime || agentRun.metadata?.productEntryRuntime || null,
    releaseInstallerRollbackPath: input.releaseInstallerRollbackPath || input.runtime?.releaseInstallerRollbackPath || agentRun.metadata?.releaseInstallerRollbackPath || null,
    publicSiteDocsDemoSync: input.publicSiteDocsDemoSync || input.runtime?.publicSiteDocsDemoSync || agentRun.metadata?.publicSiteDocsDemoSync || null,
    feedbackTelemetryProductLoop: input.feedbackTelemetryProductLoop || input.runtime?.feedbackTelemetryProductLoop || agentRun.metadata?.feedbackTelemetryProductLoop || null,
    publicAdoptionPilotLoop: normalizePublicAdoptionPilotLoop(input.publicAdoptionPilotLoop || input.runtime?.publicAdoptionPilotLoop || agentRun.metadata?.publicAdoptionPilotLoop),
    integrationShowcasePartnerSurface: input.integrationShowcasePartnerSurface || input.runtime?.integrationShowcasePartnerSurface || agentRun.metadata?.integrationShowcasePartnerSurface || null,
    releaseAdoptionReadiness: normalizeReleaseAdoptionReadiness(input.releaseAdoptionReadiness || input.runtime?.releaseAdoptionReadiness || agentRun.metadata?.releaseAdoptionReadiness),
    releaseCandidatePreCanaryGate: input.releaseCandidatePreCanaryGate || input.runtime?.releaseCandidatePreCanaryGate || agentRun.metadata?.releaseCandidatePreCanaryGate || null,
    blueprintCompletionGate: input.blueprintCompletionGate || input.runtime?.blueprintCompletionGate || agentRun.metadata?.blueprintCompletionGate || null,
    skillMcpQuarantine: input.skillMcpQuarantine || input.runtime?.skillMcpQuarantine || agentRun.metadata?.skillMcpQuarantine || null,
    providerArena: input.providerArena || input.runtime?.providerArena || agentRun.metadata?.providerArena || null,
    providerCockpit: input.providerCockpit || input.runtime?.providerCockpit || agentRun.metadata?.providerCockpit || null,
    remoteMeshApprovalUx: input.remoteMeshApprovalUx || input.runtime?.remoteMeshApprovalUx || agentRun.metadata?.remoteMeshApprovalUx || null,
    emptyState: {
      title: 'ZavorthControl without dados reais.',
      subtitle: 'Connect runtime, sessions, or remove blockers to render the panel.',
    },
  };
}
