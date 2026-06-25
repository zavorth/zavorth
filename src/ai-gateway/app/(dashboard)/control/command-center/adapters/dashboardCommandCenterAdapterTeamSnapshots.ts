import type {
  DashboardAgentTeamCompilerSnapshot,
  DashboardAskBeforeAssumptionPolicySnapshot,
  DashboardArtifactMemorySnapshot,
  DashboardCapabilityNegotiationSnapshot,
  DashboardCrossChannelContinuitySnapshot,
  DashboardMemoryWithReceiptsSnapshot,
  DashboardNaturalCapabilityDiscoverySnapshot,
  DashboardPersonalOpsAutopilotSnapshot,
  DashboardProviderArenaSnapshot,
  DashboardProviderMeshConsolidationSnapshot,
  DashboardRunArtifactReceiptReplaySnapshot,
  DashboardSafetyNarrativeSnapshot,
  DashboardSelfingDashboardSnapshot,
  DashboardSkillMcpQuarantineSnapshot,
  DashboardToolRehearsalSnapshot,
  DashboardUniversalIntentTrustEnforcementSnapshot,
  DashboardUniversalPreviewModeSnapshot,
} from "../contracts";
import {
  asCommandCenterTextArray as asTextArray,
  resolveCommandCenterAgentRunMetadata as resolveAgentRunMetadata,
} from "./dashboardCommandCenterRunObservability";
import {
  asArray,
  asNumber,
  asRecord,
  asText,
  formatTimestamp,
  normalizeMemoryLayer,
  normalizeReplyPortStatus,
  normalizeToolRisk,
  type DashboardCommandCenterAdapterInput,
  type LooseRecord,
} from "./dashboardCommandCenterAdapterShared";

function normalizeAgentTeamCompilerStatus(value: unknown): DashboardAgentTeamCompilerSnapshot["status"] {
  const raw = asText(value).toLowerCase();
  if (raw === "not-needed" || raw === "compiled" || raw === "waiting-approval" || raw === "blocked") {
    return raw;
  }
  return "unknown";
}

function normalizeAgentTeamCompilerTopology(value: unknown): DashboardAgentTeamCompilerSnapshot["topology"]["mode"] {
  const raw = asText(value).toLowerCase();
  if (raw === "linear" || raw === "parallel" || raw === "review-gated") {
    return raw;
  }
  return "unknown";
}

function normalizeAgentTeamCompilerRoleKind(value: unknown): DashboardAgentTeamCompilerSnapshot["roles"][number]["kind"] {
  const raw = asText(value).toLowerCase();
  if (
    raw === "planner"
    || raw === "researcher"
    || raw === "implementer"
    || raw === "verifier"
    || raw === "provider-specialist"
    || raw === "safety-reviewer"
    || raw === "memory-curator"
    || raw === "operator-liaison"
  ) {
    return raw;
  }
  return "planner";
}

function normalizeAgentTeamCompilerRisk(value: unknown): DashboardAgentTeamCompilerSnapshot["roles"][number]["risk"] {
  const raw = asText(value).toLowerCase();
  if (raw === "safe" || raw === "attention" || raw === "danger" || raw === "unknown") {
    return raw;
  }
  return "unknown";
}

function mapAgentTeamCompilerRole(
  entry: LooseRecord,
  index: number,
): DashboardAgentTeamCompilerSnapshot["roles"][number] {
  const provider = asRecord(entry.provider) || {};
  const scope = asRecord(entry.scope) || {};
  const budget = asRecord(entry.budget) || {};
  const approval = asRecord(entry.approval) || {};
  const actions = asRecord(entry.actions) || {};
  return {
    id: asText(entry.id, `agent-team-role-${index + 1}`),
    roleId: asText(entry.roleId, `role-${index + 1}`),
    kind: normalizeAgentTeamCompilerRoleKind(entry.kind),
    label: asText(entry.label, "Agent role"),
    objective: asText(entry.objective, "Objetivo nao informado."),
    why: asText(entry.why, "Role compilado pelo Agent Team Compiler."),
    dependsOn: asTextArray(entry.dependsOn) || [],
    handoffTo: asTextArray(entry.handoffTo) || [],
    capabilityIds: asTextArray(entry.capabilityIds) || [],
    toolIds: asTextArray(entry.toolIds) || [],
    provider: {
      providerLabel: asText(provider.providerLabel, "unknown"),
      modelLabel: asText(provider.modelLabel, "unknown"),
      candidateId: asText(provider.candidateId) || null,
      source: asText(provider.source, "unknown"),
      advisoryOnly: provider.advisoryOnly !== false,
    },
    scope: {
      mode: asText(scope.mode, "blocked"),
      allowedTools: asTextArray(scope.allowedTools) || [],
      deniedPaths: asTextArray(scope.deniedPaths) || [],
      requiresApproval: scope.requiresApproval !== false,
      policyTags: asTextArray(scope.policyTags) || [],
    },
    budget: {
      maxToolCalls: asNumber(budget.maxToolCalls) ?? 0,
      maxWallClockMs: asNumber(budget.maxWallClockMs) ?? 0,
      maxOutputBytes: asNumber(budget.maxOutputBytes) ?? 0,
    },
    approval: {
      required: approval.required !== false,
      reason: asText(approval.reason, "Approval requerido antes do launch."),
      inheritedApprovalId: asText(approval.inheritedApprovalId) || null,
    },
    risk: normalizeAgentTeamCompilerRisk(entry.risk),
    actions: {
      previewCommand: asText(actions.previewCommand, "zavorth agent-team preview <role>"),
      approveCommand: asText(actions.approveCommand, "zavorth agent-team approve <role>"),
      launchCommand: asText(actions.launchCommand, "zavorth agent-team launch <role>"),
      inspectCommand: asText(actions.inspectCommand, "zavorth agent-team inspect <role>"),
    },
  };
}

export function buildAgentTeamCompiler(
  input: DashboardCommandCenterAdapterInput,
): DashboardAgentTeamCompilerSnapshot | null {
  const metadata = resolveAgentRunMetadata(input);
  const raw = asRecord(input.agentTeamCompiler)
    || asRecord(input.runtime?.agentTeamCompiler)
    || asRecord(input.state?.agentTeamCompiler)
    || asRecord(metadata?.agentTeamCompiler);
  if (!raw) {
    return null;
  }

  const identifiers = asRecord(raw.identifiers) || {};
  const topology = asRecord(raw.topology) || {};
  const summary = asRecord(raw.summary) || {};
  const policy = asRecord(raw.policy) || {};
  const surface = asRecord(raw.surface) || {};
  return {
    contractVersion: asText(raw.contractVersion, "unknown"),
    generatedAt: formatTimestamp(raw.generatedAt),
    identifiers: {
      runId: asText(identifiers.runId),
      traceId: asText(identifiers.traceId),
      requestId: asText(identifiers.requestId),
      sessionId: asText(identifiers.sessionId),
    },
    status: normalizeAgentTeamCompilerStatus(raw.status),
    objective: asText(raw.objective, "Objetivo nao informado."),
    topology: {
      mode: normalizeAgentTeamCompilerTopology(topology.mode),
      edges: asArray<LooseRecord>(topology.edges).map((edge, index) => ({
        from: asText(edge.from, `role-${index + 1}`),
        to: asText(edge.to, `role-${index + 2}`),
        reason: asText(edge.reason, "handoff governado"),
      })).slice(0, 12),
    },
    summary: {
      // QA marker: summary.roleCount must stay projected for the Command Center.
      roleCount: asNumber(summary.roleCount) ?? 0,
      approvalRequiredCount: asNumber(summary.approvalRequiredCount) ?? 0,
      providerAssignedCount: asNumber(summary.providerAssignedCount) ?? 0,
      blockedRoleCount: asNumber(summary.blockedRoleCount) ?? 0,
      requestedSwarm: summary.requestedSwarm === true,
      providerArenaLinked: summary.providerArenaLinked === true,
      capabilityNegotiationLinked: summary.capabilityNegotiationLinked === true,
      subagentReceiptsPrepared: summary.subagentReceiptsPrepared === true,
      compilerOnly: summary.compilerOnly !== false,
    },
    roles: asArray<LooseRecord>(raw.roles).map(mapAgentTeamCompilerRole).slice(0, 12),
    receipts: asArray<LooseRecord>(raw.receipts).map((receipt, index) => {
      const status = asText(receipt.status).toLowerCase();
      return {
        id: asText(receipt.id, `agent-team-receipt-${index + 1}`),
        kind: asText(receipt.kind, "policy"),
        source: asText(receipt.source, "AgentTeamCompilerService"),
        detail: asText(receipt.detail, "Receipt de team compiler."),
        status: (status === "needs-approval" || status === "missing" ? status : "ready") as "missing" | "ready" | "needs-approval",
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
      cliCommand: asText(surface.cliCommand, "zavorth agent-team"),
      commandCenterPath: asText(surface.commandCenterPath, "/control?sector=agents"),
      previewHint: asText(surface.previewHint, "Revisar plano antes de aprovar."),
      approvalHint: asText(surface.approvalHint, "Launch exige approval explicito."),
    },
    nextSafeAction: asText(raw.nextSafeAction, "Revisar roles compilados antes de lancar subagentes."),
  };
}

function normalizeCrossChannelContinuityStatus(value: unknown): DashboardCrossChannelContinuitySnapshot["status"] {
  const raw = asText(value).toLowerCase();
  if (raw === "single-channel" || raw === "bridged" || raw === "handoff-ready" || raw === "blocked") {
    return raw;
  }
  return "unknown";
}

function normalizeCrossChannelKind(value: unknown): DashboardCrossChannelContinuitySnapshot["channels"][number]["kind"] {
  const raw = asText(value).toLowerCase();
  if (raw === "web" || raw === "cli" || raw === "telegram" || raw === "discord" || raw === "api") {
    return raw;
  }
  return "unknown";
}

function normalizeCrossChannelSource(value: unknown): DashboardCrossChannelContinuitySnapshot["channels"][number]["source"] {
  const raw = asText(value).toLowerCase();
  if (raw === "reply-port" || raw === "channel-mesh" || raw === "node-mesh" || raw === "metadata" || raw === "fallback") {
    return raw;
  }
  return "unknown";
}

function normalizeCrossChannelHandoffStatus(value: unknown): DashboardCrossChannelContinuitySnapshot["handoffs"][number]["status"] {
  const raw = asText(value).toLowerCase();
  if (raw === "available" || raw === "needs-approval" || raw === "blocked") {
    return raw;
  }
  return "needs-approval";
}

function mapCrossChannelContinuityChannel(
  entry: LooseRecord,
  index: number,
): DashboardCrossChannelContinuitySnapshot["channels"][number] {
  return {
    id: asText(entry.id, `continuity-channel-${index + 1}`),
    label: asText(entry.label, "Canal"),
    kind: normalizeCrossChannelKind(entry.kind),
    status: normalizeReplyPortStatus(entry.status, "available"),
    primary: entry.primary === true,
    source: normalizeCrossChannelSource(entry.source),
    canResume: entry.canResume !== false,
    canNotify: entry.canNotify === true,
    continuityKey: asText(entry.continuityKey, "session"),
    lastRunId: asText(entry.lastRunId) || null,
    description: asText(entry.description, "Canal de continuidade."),
  };
}

function mapCrossChannelContinuityHandoff(
  entry: LooseRecord,
  index: number,
): DashboardCrossChannelContinuitySnapshot["handoffs"][number] {
  return {
    id: asText(entry.id, `continuity-handoff-${index + 1}`),
    fromChannel: normalizeCrossChannelKind(entry.fromChannel),
    toChannel: normalizeCrossChannelKind(entry.toChannel),
    reason: asText(entry.reason, "Handoff de continuidade."),
    status: normalizeCrossChannelHandoffStatus(entry.status),
    requiresApproval: entry.requiresApproval !== false,
    previewRequired: entry.previewRequired !== false,
    command: asText(entry.command, "zavorth continuity handoff <channel>"),
    receiptIds: asTextArray(entry.receiptIds) || [],
  };
}

export function buildCrossChannelContinuity(
  input: DashboardCommandCenterAdapterInput,
): DashboardCrossChannelContinuitySnapshot | null {
  const metadata = resolveAgentRunMetadata(input);
  const raw = asRecord(input.crossChannelContinuity)
    || asRecord(input.runtime?.crossChannelContinuity)
    || asRecord(input.state?.crossChannelContinuity)
    || asRecord(metadata?.crossChannelContinuity);
  if (!raw) {
    return null;
  }

  const identifiers = asRecord(raw.identifiers) || {};
  const session = asRecord(raw.session) || {};
  const summary = asRecord(raw.summary) || {};
  const policy = asRecord(raw.policy) || {};
  const surface = asRecord(raw.surface) || {};
  return {
    contractVersion: asText(raw.contractVersion, "unknown"),
    generatedAt: formatTimestamp(raw.generatedAt),
    identifiers: {
      runId: asText(identifiers.runId),
      traceId: asText(identifiers.traceId),
      requestId: asText(identifiers.requestId),
      sessionId: asText(identifiers.sessionId),
      userId: asText(identifiers.userId),
    },
    status: normalizeCrossChannelContinuityStatus(raw.status),
    session: {
      continuityKey: asText(session.continuityKey, "session"),
      originChannel: normalizeCrossChannelKind(session.originChannel),
      activeChannel: normalizeCrossChannelKind(session.activeChannel),
      primaryReplyPortId: asText(session.primaryReplyPortId) || null,
      ownerUserId: asText(session.ownerUserId),
      workspace: asText(session.workspace) || null,
    },
    summary: {
      channelCount: asNumber(summary.channelCount) ?? 0,
      availableChannelCount: asNumber(summary.availableChannelCount) ?? 0,
      replyPortCount: asNumber(summary.replyPortCount) ?? 0,
      handoffCount: asNumber(summary.handoffCount) ?? 0,
      bridgeDetected: summary.bridgeDetected === true,
      nodeMeshLinked: summary.nodeMeshLinked === true,
      runObservatoryLinked: summary.runObservatoryLinked === true,
      continuityPromptPresent: summary.continuityPromptPresent === true,
      sameGateway: summary.sameGateway !== false,
    },
    channels: asArray<LooseRecord>(raw.channels).map(mapCrossChannelContinuityChannel).slice(0, 12),
    handoffs: asArray<LooseRecord>(raw.handoffs).map(mapCrossChannelContinuityHandoff).slice(0, 10),
    receipts: asArray<LooseRecord>(raw.receipts).map((receipt, index) => {
      const status = asText(receipt.status).toLowerCase();
      return {
        id: asText(receipt.id, `continuity-receipt-${index + 1}`),
        kind: asText(receipt.kind, "policy"),
        source: asText(receipt.source, "CrossChannelContinuityService"),
        detail: asText(receipt.detail, "Receipt de continuidade."),
        status: (status === "needs-approval" || status === "missing" ? status : "ready") as "missing" | "ready" | "needs-approval",
      };
    }).slice(0, 12),
    policy: {
      noCrossChannelMessageSent: policy.noCrossChannelMessageSent !== false,
      noSessionForkCreated: policy.noSessionForkCreated !== false,
      approvalRequiredForChannelSwitch: policy.approvalRequiredForChannelSwitch !== false,
      originalChannelPreserved: policy.originalChannelPreserved !== false,
      sameGatewayRequired: policy.sameGatewayRequired !== false,
      secretsSerialized: policy.secretsSerialized === true,
    },
    surface: {
      cliCommand: asText(surface.cliCommand, "zavorth continuity"),
      commandCenterPath: asText(surface.commandCenterPath, "/control?sector=channels"),
      resumeHint: asText(surface.resumeHint, "Retomar no mesmo gateway."),
      approvalHint: asText(surface.approvalHint, "Handoff exige approval."),
    },
    nextSafeAction: asText(raw.nextSafeAction, "Revisar continuidade antes de enviar handoff."),
  };
}

function normalizeAskBeforeAssumptionStatus(value: unknown): DashboardAskBeforeAssumptionPolicySnapshot["status"] {
  const raw = asText(value).toLowerCase();
  if (raw === "clear" || raw === "needs-question" || raw === "blocked") {
    return raw;
  }
  return "unknown";
}

function normalizeAskBeforeAssumptionCategory(
  value: unknown,
): DashboardAskBeforeAssumptionPolicySnapshot["assumptions"][number]["category"] {
  const raw = asText(value).toLowerCase();
  if (
    raw === "missing-scope"
    || raw === "missing-target"
    || raw === "missing-permission"
    || raw === "missing-data"
    || raw === "risky-tool"
    || raw === "channel-handoff"
    || raw === "provider-route"
    || raw === "memory-write"
    || raw === "selfmod"
    || raw === "workspace-mutation"
  ) {
    return raw;
  }
  return "unknown";
}

function normalizeAskBeforeAssumptionSeverity(
  value: unknown,
): DashboardAskBeforeAssumptionPolicySnapshot["assumptions"][number]["severity"] {
  const raw = asText(value).toLowerCase();
  if (raw === "danger" || raw === "warning" || raw === "info") {
    return raw;
  }
  return "warning";
}

function normalizeAskBeforeAssumptionPriority(
  value: unknown,
): DashboardAskBeforeAssumptionPolicySnapshot["questions"][number]["priority"] {
  const raw = asText(value).toLowerCase();
  if (raw === "high" || raw === "medium" || raw === "low") {
    return raw;
  }
  return "medium";
}

function normalizeAskBeforeAssumptionDefaultAction(
  value: unknown,
): DashboardAskBeforeAssumptionPolicySnapshot["questions"][number]["defaultAction"] {
  const raw = asText(value).toLowerCase();
  if (raw === "ask" || raw === "preview" || raw === "skip") {
    return raw;
  }
  return "ask";
}

function mapAskBeforeAssumption(
  entry: LooseRecord,
  index: number,
): DashboardAskBeforeAssumptionPolicySnapshot["assumptions"][number] {
  return {
    id: asText(entry.id, `ask-assumption-${index + 1}`),
    category: normalizeAskBeforeAssumptionCategory(entry.category),
    title: asText(entry.title, "Assuncao pendente"),
    detail: asText(entry.detail, "Confirmacao necessaria antes de assumir."),
    severity: normalizeAskBeforeAssumptionSeverity(entry.severity),
    confidence: asNumber(entry.confidence) ?? 0.5,
    missingInput: (asTextArray(entry.missingInput) ?? []).slice(0, 8),
    inferredFrom: (asTextArray(entry.inferredFrom) ?? []).slice(0, 8),
    affectedActions: (asTextArray(entry.affectedActions) ?? []).slice(0, 8),
    requiresAnswer: entry.requiresAnswer !== false,
    questionId: asText(entry.questionId, `ask-assumption-${index + 1}:question`),
  };
}

function mapAskBeforeAssumptionQuestion(
  entry: LooseRecord,
  index: number,
): DashboardAskBeforeAssumptionPolicySnapshot["questions"][number] {
  return {
    id: asText(entry.id, `ask-question-${index + 1}`),
    priority: normalizeAskBeforeAssumptionPriority(entry.priority),
    question: asText(entry.question, "Pode confirmar antes de seguir?"),
    reason: asText(entry.reason, "Evitar agir por suposicao."),
    options: (asTextArray(entry.options) ?? []).slice(0, 6),
    blocksMutation: entry.blocksMutation !== false,
    defaultAction: normalizeAskBeforeAssumptionDefaultAction(entry.defaultAction),
  };
}

export function buildAskBeforeAssumptionPolicy(
  input: DashboardCommandCenterAdapterInput,
): DashboardAskBeforeAssumptionPolicySnapshot | null {
  const metadata = resolveAgentRunMetadata(input);
  const raw = asRecord(input.askBeforeAssumptionPolicy)
    || asRecord(input.runtime?.askBeforeAssumptionPolicy)
    || asRecord(input.state?.askBeforeAssumptionPolicy)
    || asRecord(metadata?.askBeforeAssumptionPolicy);
  if (!raw) {
    return null;
  }

  const identifiers = asRecord(raw.identifiers) || {};
  const summary = asRecord(raw.summary) || {};
  const policy = asRecord(raw.policy) || {};
  const surface = asRecord(raw.surface) || {};
  return {
    contractVersion: asText(raw.contractVersion, "unknown"),
    generatedAt: formatTimestamp(raw.generatedAt),
    identifiers: {
      runId: asText(identifiers.runId),
      traceId: asText(identifiers.traceId),
      requestId: asText(identifiers.requestId),
      sessionId: asText(identifiers.sessionId),
    },
    status: normalizeAskBeforeAssumptionStatus(raw.status),
    summary: {
      assumptionCount: asNumber(summary.assumptionCount) ?? 0,
      questionCount: asNumber(summary.questionCount) ?? 0,
      blockerCount: asNumber(summary.blockerCount) ?? 0,
      mutableActionBlockedCount: asNumber(summary.mutableActionBlockedCount) ?? 0,
      highestSeverity: normalizeAskBeforeAssumptionSeverity(summary.highestSeverity),
      previewLinked: summary.previewLinked === true,
      capabilityNegotiationLinked: summary.capabilityNegotiationLinked === true,
      safetyNarrativeLinked: summary.safetyNarrativeLinked === true,
    },
    assumptions: asArray<LooseRecord>(raw.assumptions).map(mapAskBeforeAssumption).slice(0, 12),
    questions: asArray<LooseRecord>(raw.questions).map(mapAskBeforeAssumptionQuestion).slice(0, 12),
    receipts: asArray<LooseRecord>(raw.receipts).map((receipt, index) => {
      const status = asText(receipt.status).toLowerCase();
      return {
        id: asText(receipt.id, `ask-policy-receipt-${index + 1}`),
        kind: asText(receipt.kind, "policy"),
        source: asText(receipt.source, "AskBeforeAssumptionPolicyService"),
        detail: asText(receipt.detail, "Receipt da Ask Before Assumption Policy."),
        status: (status === "needs-answer" || status === "missing" ? status : "ready") as "missing" | "ready" | "needs-answer",
      };
    }).slice(0, 12),
    policy: {
      noAssumptionActedOn: policy.noAssumptionActedOn !== false,
      noMutationExecuted: policy.noMutationExecuted !== false,
      asksBeforeMutation: policy.asksBeforeMutation !== false,
      previewBeforeRiskyAction: policy.previewBeforeRiskyAction !== false,
      approvalStillRequired: policy.approvalStillRequired !== false,
      naturalLanguageDoesNotBypassPolicy: policy.naturalLanguageDoesNotBypassPolicy !== false,
      secretsSerialized: policy.secretsSerialized === true,
    },
    surface: {
      cliCommand: asText(surface.cliCommand, "zavorth assumptions"),
      commandCenterPath: asText(surface.commandCenterPath, "/control?sector=config"),
      askHint: asText(surface.askHint, "Perguntar antes de assumir."),
      previewHint: asText(surface.previewHint, "Preview antes de mutacao."),
    },
    nextSafeAction: asText(raw.nextSafeAction, "Perguntar antes de qualquer mutacao ou handoff."),
  };
}
