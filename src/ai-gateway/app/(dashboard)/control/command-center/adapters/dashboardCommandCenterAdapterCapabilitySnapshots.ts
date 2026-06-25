import type {
  DashboardAgentTeamCompilerSnapshot,
  DashboardAskBeforeAssumptionPolicySnapshot,
  DashboardArtifactMemorySnapshot,
  DashboardCapabilityNegotiationSnapshot,
  DashboardCrossChannelContinuitySnapshot,
  DashboardMemoryWithReceiptsSnapshot,
  DashboardNaturalCapabilityDiscoveryRecommendation,
  DashboardNaturalCapabilityDiscoverySnapshot,
  DashboardToolExposureProfile,
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
  normalizeToolRisk,
  type DashboardCommandCenterAdapterInput,
  type LooseRecord,
} from "./dashboardCommandCenterAdapterShared";

function mapNaturalCapabilityDiscoveryRecommendation(
  entry: LooseRecord,
  index: number,
): DashboardNaturalCapabilityDiscoveryRecommendation {
  const risk = normalizeToolRisk(entry);
  return {
    id: asText(entry.id ?? entry.capabilityId ?? entry.toolId, `capability-discovery-${index + 1}`),
    label: asText(entry.label ?? entry.title ?? entry.capabilityId ?? entry.toolId, "Capability recomendada"),
    capabilityId: asText(entry.capabilityId ?? entry.capability) || undefined,
    toolIds: asTextArray(entry.toolIds ?? entry.tools ?? entry.toolNames) ?? [],
    groups: asTextArray(entry.groups) ?? [],
    confidence: asNumber(entry.confidence ?? entry.score) ?? 0,
    risk,
    requiresApproval: entry.requiresApproval === true || entry.approvalRequired === true || risk === "danger",
    previewRequired: entry.previewRequired === true || entry.requiresPreview === true,
    reason: asText(entry.reason ?? entry.summary, "Inferida a partir do pedido em linguagem natural."),
    nextSafeAction: asText(entry.nextSafeAction, "Aplicar policy antes de executar qualquer tool."),
  };
}

export function buildNaturalCapabilityDiscovery(
  input: DashboardCommandCenterAdapterInput,
): DashboardNaturalCapabilityDiscoverySnapshot | null {
  const metadata = resolveAgentRunMetadata(input);
  const raw = asRecord(input.capabilityDiscovery)
    || asRecord(input.runtime?.capabilityDiscovery)
    || asRecord(input.state?.capabilityDiscovery)
    || asRecord(metadata?.naturalCapabilityDiscovery);
  if (!raw) {
    return null;
  }

  const safety = asRecord(raw.safety) || {};
  const quarantine = asRecord(raw.quarantine) || {};
  const highestRisk = normalizeToolRisk({ risk: safety.highestRisk });
  const recommendations = asArray<LooseRecord>(raw.recommendations)
    .map(mapNaturalCapabilityDiscoveryRecommendation)
    .slice(0, 12);

  return {
    contractVersion: asText(raw.contractVersion, "unknown"),
    generatedAt: formatTimestamp(raw.generatedAt),
    intentCategory: asText(raw.intentCategory, "unknown"),
    confidence: asNumber(raw.confidence) ?? 0,
    recommendedToolNames: asTextArray(raw.recommendedToolNames) ?? [],
    groups: asTextArray(raw.groups) ?? [],
    recommendations,
    safety: {
      noExecutionPerformed: safety.noExecutionPerformed === true,
      naturalLanguageDoesNotBypassPolicy: safety.naturalLanguageDoesNotBypassPolicy === true,
      highestRisk,
      requiresApproval: safety.requiresApproval === true || recommendations.some((entry) => entry.requiresApproval),
      previewRequired: safety.previewRequired === true || recommendations.some((entry) => entry.previewRequired),
      approvalRequiredToolIds: asTextArray(safety.approvalRequiredToolIds) ?? [],
      previewRequiredToolIds: asTextArray(safety.previewRequiredToolIds) ?? [],
    },
    quarantine: {
      importedCapabilityTrustPresent: quarantine.importedCapabilityTrustPresent === true,
      quarantinedCount: asNumber(quarantine.quarantinedCount) ?? 0,
      blockedToolIds: asTextArray(quarantine.blockedToolIds) ?? [],
      warning: asText(quarantine.warning) || null,
    },
    nextSafeAction: asText(raw.nextSafeAction, "Responder diretamente ou pedir clarificacao."),
  };
}

function normalizePreviewMode(value: unknown): DashboardUniversalPreviewModeSnapshot["mode"] {
  const raw = asText(value).toLowerCase();
  if (raw === "runtime-preview" || raw === "preview-only") {
    return raw;
  }
  return "unknown";
}

function mapUniversalPreviewPlanStep(entry: LooseRecord, index: number): DashboardUniversalPreviewModeSnapshot["planSteps"][number] {
  const risk = normalizeToolRisk(entry);
  return {
    id: asText(entry.id ?? entry.toolId, `universal-preview-step-${index + 1}`),
    kind: asText(entry.kind, "unknown"),
    label: asText(entry.label ?? entry.toolId, "Etapa de preview"),
    toolId: asText(entry.toolId) || undefined,
    risk,
    requiresApproval: entry.requiresApproval === true || entry.approvalRequired === true || risk === "danger",
    previewRequired: entry.previewRequired === true,
    action: asText(entry.action, "Aplicar policy antes de executar."),
    impact: asText(entry.impact, "Impacto nao informado."),
  };
}

export function buildUniversalPreviewMode(
  input: DashboardCommandCenterAdapterInput,
): DashboardUniversalPreviewModeSnapshot | null {
  const metadata = resolveAgentRunMetadata(input);
  const raw = asRecord(input.universalPreviewMode)
    || asRecord(input.runtime?.universalPreviewMode)
    || asRecord(input.state?.universalPreviewMode)
    || asRecord(metadata?.universalPreviewMode);
  if (!raw) {
    return null;
  }

  const risk = asRecord(raw.risk) || {};
  const safety = asRecord(raw.safety) || {};
  const toolExposure = asRecord(raw.toolExposure) || {};
  const toolExposureMode = asText(toolExposure.mode).toLowerCase();
  const mode: DashboardToolExposureProfile["mode"] =
    toolExposureMode === "safe" || toolExposureMode === "confirm" || toolExposureMode === "restricted" || toolExposureMode === "unknown"
      ? toolExposureMode
      : "unknown";

  return {
    contractVersion: asText(raw.contractVersion, "unknown"),
    generatedAt: formatTimestamp(raw.generatedAt),
    mode: normalizePreviewMode(raw.mode),
    planSteps: asArray<LooseRecord>(raw.planSteps).map(mapUniversalPreviewPlanStep).slice(0, 12),
    toolExposure: {
      mode,
      exposedToolIds: asTextArray(toolExposure.exposedToolIds) || [],
      blockedToolIds: asTextArray(toolExposure.blockedToolIds) || [],
    },
    risk: {
      highestRisk: normalizeToolRisk({ risk: risk.highestRisk }),
      requiresApproval: risk.requiresApproval === true,
      previewRequired: risk.previewRequired === true,
      approvalRequiredToolIds: asTextArray(risk.approvalRequiredToolIds) || [],
      previewRequiredToolIds: asTextArray(risk.previewRequiredToolIds) || [],
    },
    safety: {
      noExecutionPerformed: safety.noExecutionPerformed === true,
      naturalLanguageDoesNotBypassPolicy: safety.naturalLanguageDoesNotBypassPolicy === true,
      workspacePolicyApplies: safety.workspacePolicyApplies === true,
      approvalsStillRequired: safety.approvalsStillRequired === true,
      selfmodApplyBlocked: safety.selfmodApplyBlocked === true,
      computerUseBlockedUntilApproval: safety.computerUseBlockedUntilApproval === true,
      executorBlockedInPreviewMode: safety.executorBlockedInPreviewMode === true,
      toolsActuallyCalled: asTextArray(safety.toolsActuallyCalled) || [],
    },
    nextSafeAction: asText(raw.nextSafeAction, "Confirmar escopo antes de executar."),
  };
}

function normalizeCapabilityNegotiationStatus(value: unknown): DashboardCapabilityNegotiationSnapshot["status"] {
  const raw = asText(value).toLowerCase();
  if (raw === "not-needed" || raw === "proposal" || raw === "waiting-approval" || raw === "approved" || raw === "blocked") {
    return raw;
  }
  return "unknown";
}

function normalizeCapabilityNegotiationPermission(
  value: unknown,
): DashboardCapabilityNegotiationSnapshot["capabilities"][number]["permission"] {
  const raw = asText(value).toLowerCase();
  if (raw === "none" || raw === "preview" || raw === "approval" || raw === "operator") {
    return raw;
  }
  return "unknown";
}

function mapCapabilityNegotiationCapability(
  entry: LooseRecord,
  index: number,
): DashboardCapabilityNegotiationSnapshot["capabilities"][number] {
  return {
    id: asText(entry.id, `capability-negotiation-${index + 1}`),
    label: asText(entry.label, "Capability negociada"),
    source: asText(entry.source, "unknown"),
    toolIds: asTextArray(entry.toolIds) || [],
    groups: asTextArray(entry.groups) || [],
    risk: normalizeToolRisk(entry),
    permission: normalizeCapabilityNegotiationPermission(entry.permission),
    requiresApproval: entry.requiresApproval === true,
    previewRequired: entry.previewRequired === true,
    available: entry.available !== false,
    blocked: entry.blocked === true,
    reason: asText(entry.reason, "Capability inferida pelo runtime."),
    nextSafeAction: asText(entry.nextSafeAction, "Confirmar policy antes de executar."),
  };
}

export function buildCapabilityNegotiation(
  input: DashboardCommandCenterAdapterInput,
): DashboardCapabilityNegotiationSnapshot | null {
  const metadata = resolveAgentRunMetadata(input);
  const raw = asRecord(input.capabilityNegotiation)
    || asRecord(input.runtime?.capabilityNegotiation)
    || asRecord(input.state?.capabilityNegotiation)
    || asRecord(metadata?.capabilityNegotiation);
  if (!raw) {
    return null;
  }

  const identifiers = asRecord(raw.identifiers) || {};
  const summary = asRecord(raw.summary) || {};
  const scope = asRecord(raw.scope) || {};
  const proposal = asRecord(raw.proposal);
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
    status: normalizeCapabilityNegotiationStatus(raw.status),
    decisionSource: asText(raw.decisionSource, "unknown"),
    summary: {
      capabilityCount: asNumber(summary.capabilityCount) ?? 0,
      allowedToolCount: asNumber(summary.allowedToolCount) ?? 0,
      blockedToolCount: asNumber(summary.blockedToolCount) ?? 0,
      approvalRequired: summary.approvalRequired === true,
      previewRequired: summary.previewRequired === true,
      highestRisk: normalizeToolRisk({ risk: summary.highestRisk }),
      sensitiveTask: summary.sensitiveTask === true,
      approvedScope: summary.approvedScope === true,
      pathScoped: summary.pathScoped === true,
    },
    capabilities: asArray<LooseRecord>(raw.capabilities).map(mapCapabilityNegotiationCapability).slice(0, 12),
    scope: {
      id: asText(scope.id, "capability-scope"),
      summary: asText(scope.summary, "Escopo de capability."),
      allowedToolIds: asTextArray(scope.allowedToolIds) || [],
      blockedToolIds: asTextArray(scope.blockedToolIds) || [],
      pathHints: asTextArray(scope.pathHints) || [],
      surfaces: asTextArray(scope.surfaces) || [],
      approvalRequired: scope.approvalRequired === true,
      previewRequired: scope.previewRequired === true,
      constraints: asTextArray(scope.constraints) || [],
      approved: scope.approved === true,
    },
    proposal: proposal
      ? {
        title: asText(proposal.title, "Negociar escopo de capabilities"),
        summary: asText(proposal.summary, "Escopo aguardando confirmacao."),
        userQuestion: asText(proposal.userQuestion, "Posso seguir com esse escopo?"),
        approvalId: asText(proposal.approvalId) || null,
        requestedCapabilityIds: asTextArray(proposal.requestedCapabilityIds) || [],
      }
      : null,
    policy: {
      noExecutionPerformed: policy.noExecutionPerformed === true,
      naturalLanguageDoesNotBypassPolicy: policy.naturalLanguageDoesNotBypassPolicy === true,
      approvedScopeLimitsTools: policy.approvedScopeLimitsTools === true,
      approvedScopeLimitsPaths: policy.approvedScopeLimitsPaths === true,
      approvalsStillRequired: policy.approvalsStillRequired === true,
      previewStillRequired: policy.previewStillRequired === true,
      quarantineStillRequired: policy.quarantineStillRequired === true,
      secretsSerialized: policy.secretsSerialized === true,
    },
    surface: {
      cliCommand: asText(surface.cliCommand, "zavorth negotiate --json"),
      commandCenterPath: asText(surface.commandCenterPath, "/control?sector=skills"),
      approvalHint: asText(surface.approvalHint, "Aprovar apenas escopo entendido."),
    },
    nextSafeAction: asText(raw.nextSafeAction, "Confirmar escopo antes de executar."),
  };
}

function normalizeToolRehearsalStatus(value: unknown): DashboardToolRehearsalSnapshot["status"] {
  const raw = asText(value).toLowerCase();
  if (raw === "not-needed" || raw === "waiting-scope" || raw === "proposal" || raw === "waiting-approval" || raw === "approved" || raw === "blocked") {
    return raw;
  }
  return "unknown";
}

function mapToolRehearsalCall(entry: LooseRecord, index: number): DashboardToolRehearsalSnapshot["calls"][number] {
  return {
    id: asText(entry.id, `tool-rehearsal-call-${index + 1}`),
    order: asNumber(entry.order) ?? index + 1,
    toolId: asText(entry.toolId, "unknown-tool"),
    label: asText(entry.label ?? entry.toolId, "Tool ensaiada"),
    risk: normalizeToolRisk(entry),
    requiresApproval: entry.requiresApproval === true,
    previewRequired: entry.previewRequired === true,
    allowedByScope: entry.allowedByScope === true,
    blockedByScope: entry.blockedByScope === true,
    dryRunSupported: entry.dryRunSupported !== false,
    externalSideEffect: entry.externalSideEffect === true,
    approximateArguments: asRecord(entry.approximateArguments) || {},
    expectedOutput: asText(entry.expectedOutput, "Output esperado nao informado."),
    refusalReason: asText(entry.refusalReason) || null,
    receipts: asTextArray(entry.receipts) || [],
  };
}

export function buildToolRehearsal(
  input: DashboardCommandCenterAdapterInput,
): DashboardToolRehearsalSnapshot | null {
  const metadata = resolveAgentRunMetadata(input);
  const raw = asRecord(input.toolRehearsal)
    || asRecord(input.runtime?.toolRehearsal)
    || asRecord(input.state?.toolRehearsal)
    || asRecord(metadata?.toolRehearsal);
  if (!raw) {
    return null;
  }

  const identifiers = asRecord(raw.identifiers) || {};
  const summary = asRecord(raw.summary) || {};
  const approval = asRecord(raw.approval) || {};
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
    status: normalizeToolRehearsalStatus(raw.status),
    summary: {
      callCount: asNumber(summary.callCount) ?? 0,
      dangerousCallCount: asNumber(summary.dangerousCallCount) ?? 0,
      blockedCallCount: asNumber(summary.blockedCallCount) ?? 0,
      approvalRequired: summary.approvalRequired === true,
      scopeApproved: summary.scopeApproved === true,
      scopeId: asText(summary.scopeId) || null,
      highestRisk: normalizeToolRisk({ risk: summary.highestRisk }),
      budgetAllowed: summary.budgetAllowed !== false,
      rehearsalRequired: summary.rehearsalRequired === true,
    },
    calls: asArray<LooseRecord>(raw.calls).map(mapToolRehearsalCall).slice(0, 12),
    adjustments: asArray<LooseRecord>(raw.adjustments).map((adjustment, index) => ({
      id: asText(adjustment.id, `tool-rehearsal-adjustment-${index + 1}`),
      label: asText(adjustment.label, "Ajuste sugerido"),
      detail: asText(adjustment.detail, "Detalhe nao informado."),
      commandHint: asText(adjustment.commandHint, "zavorth rehearse --json"),
    })).slice(0, 8),
    approval: {
      required: approval.required === true,
      approvalId: asText(approval.approvalId) || null,
      title: asText(approval.title, "Aprovar tool rehearsal"),
      question: asText(approval.question, "Quer executar este ensaio?"),
    },
    policy: {
      noToolExecuted: policy.noToolExecuted === true,
      noFilesystemMutation: policy.noFilesystemMutation === true,
      noShellSpawned: policy.noShellSpawned === true,
      noNetworkCall: policy.noNetworkCall === true,
      approximateArgumentsOnly: policy.approximateArgumentsOnly === true,
      realExecutionLimitedToRehearsedScope: policy.realExecutionLimitedToRehearsedScope === true,
      approvalsStillRequired: policy.approvalsStillRequired === true,
      previewStillRequired: policy.previewStillRequired === true,
      secretsSerialized: policy.secretsSerialized === true,
    },
    surface: {
      cliCommand: asText(surface.cliCommand, "zavorth rehearse --json"),
      commandCenterPath: asText(surface.commandCenterPath, "/control?sector=skills"),
      approvalHint: asText(surface.approvalHint, "Ajuste o ensaio antes de aprovar."),
    },
    nextSafeAction: asText(raw.nextSafeAction, "Confirmar ensaio antes da execucao real."),
  };
}

function normalizeSafetyNarrativeStatus(value: unknown): DashboardSafetyNarrativeSnapshot["status"] {
  const raw = asText(value).toLowerCase();
  if (raw === "clear" || raw === "explaining" || raw === "waiting-approval" || raw === "blocked" || raw === "failed") {
    return raw;
  }
  return "unknown";
}

function mapSafetyNarrativeReason(entry: LooseRecord, index: number): DashboardSafetyNarrativeSnapshot["reasons"][number] {
  return {
    id: asText(entry.id, `safety-reason-${index + 1}`),
    kind: asText(entry.kind, "unknown"),
    title: asText(entry.title, "Motivo de seguranca"),
    detail: asText(entry.detail, "Detalhe nao informado."),
    risk: normalizeToolRisk(entry),
    source: asText(entry.source, "SafetyNarrativeService"),
    toolIds: asTextArray(entry.toolIds) || [],
    redactionApplied: entry.redactionApplied === true,
  };
}

function mapSafetyNarrativeAlternative(entry: LooseRecord, index: number): DashboardSafetyNarrativeSnapshot["alternatives"][number] {
  return {
    id: asText(entry.id, `safety-alternative-${index + 1}`),
    label: asText(entry.label, "Alternativa segura"),
    detail: asText(entry.detail, "Detalhe nao informado."),
    commandHint: asText(entry.commandHint) || undefined,
    safe: entry.safe !== false,
    requiresApproval: entry.requiresApproval === true,
  };
}

export function buildSafetyNarrative(
  input: DashboardCommandCenterAdapterInput,
): DashboardSafetyNarrativeSnapshot | null {
  const metadata = resolveAgentRunMetadata(input);
  const raw = asRecord(input.safetyNarrative)
    || asRecord(input.runtime?.safetyNarrative)
    || asRecord(input.state?.safetyNarrative)
    || asRecord(metadata?.safetyNarrative);
  if (!raw) {
    return null;
  }

  const redaction = asRecord(raw.redaction) || {};
  const policy = asRecord(raw.policy) || {};
  return {
    contractVersion: asText(raw.contractVersion, "unknown"),
    generatedAt: formatTimestamp(raw.generatedAt),
    status: normalizeSafetyNarrativeStatus(raw.status),
    highRiskBlockPresent: raw.highRiskBlockPresent === true,
    summary: asText(raw.summary, "Safety Narrative disponivel."),
    userMessage: asText(raw.userMessage, raw.summary),
    reasons: asArray<LooseRecord>(raw.reasons).map(mapSafetyNarrativeReason).slice(0, 12),
    alternatives: asArray<LooseRecord>(raw.alternatives).map(mapSafetyNarrativeAlternative).slice(0, 8),
    redaction: {
      pathRedactionApplied: redaction.pathRedactionApplied === true,
      secretRedactionApplied: redaction.secretRedactionApplied === true,
      sensitivePathCount: asNumber(redaction.sensitivePathCount) ?? 0,
      secretCount: asNumber(redaction.secretCount) ?? 0,
      rawSecretSerialized: redaction.rawSecretSerialized === true,
    },
    policy: {
      naturalLanguageDoesNotBypassPolicy: policy.naturalLanguageDoesNotBypassPolicy === true,
      alternativesDoNotExecute: policy.alternativesDoNotExecute === true,
      workspaceBoundaryRespected: policy.workspaceBoundaryRespected === true,
      approvalsRemainRequired: policy.approvalsRemainRequired === true,
      previewRemainsRequired: policy.previewRemainsRequired === true,
      quarantineRemainsRequired: policy.quarantineRemainsRequired === true,
    },
    nextSafeAction: asText(raw.nextSafeAction, "Continuar pelo runtime governado."),
  };
}
