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
  DashboardProviderCockpitAction,
  DashboardProviderCockpitCard,
  DashboardProviderCockpitSnapshot,
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

function normalizeSkillMcpKind(value: unknown): DashboardSkillMcpQuarantineSnapshot["entries"][number]["kind"] {
  return asText(value).toLowerCase() === "mcp" ? "mcp" : "skill";
}

function normalizeSkillMcpTrustState(value: unknown): DashboardSkillMcpQuarantineSnapshot["entries"][number]["trustState"] {
  const raw = asText(value).toLowerCase();
  if (raw === "trusted" || raw === "safe" || raw === "quarantined") {
    return raw;
  }
  return "safe";
}

function normalizeSkillMcpRiskLevel(value: unknown): DashboardSkillMcpQuarantineSnapshot["entries"][number]["riskLevel"] {
  const raw = asText(value).toLowerCase();
  if (raw === "low" || raw === "medium" || raw === "high") {
    return raw;
  }
  return "medium";
}

function mapSkillMcpQuarantineEntry(entry: LooseRecord, index: number): DashboardSkillMcpQuarantineSnapshot["entries"][number] {
  const origin = asRecord(entry.origin) || {};
  const actions = asRecord(entry.actions) || {};
  return {
    id: asText(entry.id, `imported-capability-${index + 1}`),
    kind: normalizeSkillMcpKind(entry.kind),
    trustState: normalizeSkillMcpTrustState(entry.trustState),
    riskLevel: normalizeSkillMcpRiskLevel(entry.riskLevel),
    quarantined: entry.quarantined === true,
    requiresReview: entry.requiresReview === true,
    canExposeToModel: entry.canExposeToModel !== false,
    canExposeTools: entry.canExposeTools !== false,
    toolNames: asTextArray(entry.toolNames),
    reasons: asTextArray(entry.reasons),
    origin: {
      source: asText(origin.source, "runtime"),
      ref: asText(origin.ref) || null,
    },
    actions: {
      inspectCommand: asText(actions.inspectCommand, "zavorth quarantine inspect <id>"),
      reviewCommand: asText(actions.reviewCommand, "zavorth quarantine review <id>"),
      promoteCommand: asText(actions.promoteCommand, "zavorth quarantine promote <id> --confirm"),
      keepQuarantinedCommand: asText(actions.keepQuarantinedCommand, "zavorth quarantine keep <id>"),
    },
  };
}

export function buildSkillMcpQuarantine(
  input: DashboardCommandCenterAdapterInput,
): DashboardSkillMcpQuarantineSnapshot | null {
  const metadata = resolveAgentRunMetadata(input);
  const raw = asRecord(input.skillMcpQuarantine)
    || asRecord(input.runtime?.skillMcpQuarantine)
    || asRecord(input.state?.skillMcpQuarantine)
    || asRecord(metadata?.skillMcpQuarantine);
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
    summary: {
      total: asNumber(summary.total) ?? 0,
      trusted: asNumber(summary.trusted) ?? 0,
      safe: asNumber(summary.safe) ?? 0,
      quarantined: asNumber(summary.quarantined) ?? 0,
      reviewRequired: asNumber(summary.reviewRequired) ?? 0,
      blockedToolCount: asNumber(summary.blockedToolCount) ?? 0,
    },
    entries: asArray<LooseRecord>(raw.entries).map(mapSkillMcpQuarantineEntry).slice(0, 12),
    receipts: asArray<LooseRecord>(raw.receipts).map((receipt, index) => ({
      id: asText(receipt.id, `quarantine-receipt-${index + 1}`),
      kind: normalizeSkillMcpKind(receipt.kind) === "mcp" ? "mcp" : asText(receipt.kind) === "policy" ? "policy" : "skill",
      detail: asText(receipt.detail, "Receipt de quarentena."),
    })),
    policy: {
      externalImportsNeverTrustedAutomatically: policy.externalImportsNeverTrustedAutomatically === true,
      quarantinedToolsHidden: policy.quarantinedToolsHidden === true,
      toolExposureGatedByImportedCapabilityTrust: policy.toolExposureGatedByImportedCapabilityTrust === true,
      noMarketplaceInstallPerformed: policy.noMarketplaceInstallPerformed === true,
      promotionsRequireExplicitOperatorAction: policy.promotionsRequireExplicitOperatorAction === true,
      naturalLanguageDoesNotBypassQuarantine: policy.naturalLanguageDoesNotBypassQuarantine === true,
    },
    surface: {
      cliCommand: asText(surface.cliCommand, "zavorth quarantine --json"),
      commandCenterPath: asText(surface.commandCenterPath, "/control?sector=skills"),
      reviewHint: asText(surface.reviewHint, "Revisar origem e risco antes de promover."),
    },
    nextSafeAction: asText(raw.nextSafeAction, "Manter quarantine ate review explicito."),
  };
}

function normalizeProviderArenaHealth(value: unknown): DashboardProviderArenaSnapshot["candidates"][number]["healthStatus"] {
  const raw = asText(value).toLowerCase();
  if (raw === "healthy" || raw === "unhealthy" || raw === "not_applicable") {
    return raw;
  }
  return "unknown";
}

function normalizeProviderArenaReceiptKind(
  value: unknown,
): DashboardProviderArenaSnapshot["receipts"][number]["kind"] {
  const raw = asText(value).toLowerCase();
  if (raw === "run-observatory" || raw === "route" || raw === "budget" || raw === "model-picker" || raw === "policy") {
    return raw;
  }
  return "policy";
}

function normalizeProviderArenaReceiptStatus(
  value: unknown,
): DashboardProviderArenaSnapshot["receipts"][number]["status"] {
  const raw = asText(value).toLowerCase();
  if (raw === "pending" || raw === "failed") {
    return raw;
  }
  return "done";
}

export function buildProviderArena(
  input: DashboardCommandCenterAdapterInput,
): DashboardProviderArenaSnapshot | null {
  const metadata = resolveAgentRunMetadata(input);
  const raw = asRecord(input.providerArena)
    || asRecord(input.runtime?.providerArena)
    || asRecord(input.state?.providerArena)
    || asRecord(metadata?.providerArena);
  if (!raw) {
    return null;
  }

  const identifiers = asRecord(raw.identifiers) || {};
  const summary = asRecord(raw.summary) || {};
  const selected = asRecord(raw.selected) || {};
  const comparison = asRecord(raw.comparison) || {};
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
    summary: {
      candidateCount: asNumber(summary.candidateCount) ?? 0,
      readyCandidateCount: asNumber(summary.readyCandidateCount) ?? 0,
      fallbackUsed: summary.fallbackUsed === true,
      routeObserved: summary.routeObserved === true,
      budgetObserved: summary.budgetObserved === true,
      observatoryReceiptCount: asNumber(summary.observatoryReceiptCount) ?? 0,
      hasProviderEvidence: summary.hasProviderEvidence === true,
      recommendedProviderLabel: asText(summary.recommendedProviderLabel, "provider nao informado"),
      recommendedModelLabel: asText(summary.recommendedModelLabel, "modelo nao informado"),
      recommendedFamilyId: asText(summary.recommendedFamilyId, "unknown"),
      decisionSource: asText(summary.decisionSource, "unknown"),
    },
    selected: {
      candidateId: asText(selected.candidateId) || null,
      providerLabel: asText(selected.providerLabel, "provider nao informado"),
      modelLabel: asText(selected.modelLabel, "modelo nao informado"),
      routeId: asText(selected.routeId) || null,
      source: asText(selected.source, "unknown"),
      explanation: asTextArray(selected.explanation) || [],
    },
    candidates: asArray<LooseRecord>(raw.candidates).map((candidate, index) => ({
      id: asText(candidate.id, `provider-candidate-${index + 1}`),
      routeId: asText(candidate.routeId, asText(candidate.id, `provider-candidate-${index + 1}`)),
      providerId: asText(candidate.providerId, asText(candidate.providerLabel, "provider")),
      providerLabel: asText(candidate.providerLabel, "provider nao informado"),
      modelLabel: asText(candidate.modelLabel, "modelo nao informado"),
      familyId: asText(candidate.familyId, "unknown"),
      routeKind: asText(candidate.routeKind, "unknown"),
      readiness: asText(candidate.readiness, "unknown"),
      ready: candidate.ready === true,
      healthStatus: normalizeProviderArenaHealth(candidate.healthStatus),
      capabilityScore: asNumber(candidate.capabilityScore) ?? 0,
      costScore: asNumber(candidate.costScore) ?? 0,
      latencyScore: asNumber(candidate.latencyScore) ?? 0,
      reliabilityScore: asNumber(candidate.reliabilityScore) ?? 0,
      healthScore: asNumber(candidate.healthScore) ?? 0,
      overallScore: asNumber(candidate.overallScore) ?? 0,
      source: asText(candidate.source, "unknown"),
      explanation: asTextArray(candidate.explanation) || [],
      fallbackRouteIds: asTextArray(candidate.fallbackRouteIds) || [],
      receipts: asTextArray(candidate.receipts) || [],
    })).slice(0, 16),
    comparison: {
      recommendedCandidateId: asText(comparison.recommendedCandidateId) || null,
      configuredCandidateId: asText(comparison.configuredCandidateId) || null,
      learnedCandidateId: asText(comparison.learnedCandidateId) || null,
      fallbackCandidateIds: asTextArray(comparison.fallbackCandidateIds) || [],
      decisionSource: asText(comparison.decisionSource, "unknown"),
      explanation: asTextArray(comparison.explanation) || [],
    },
    receipts: asArray<LooseRecord>(raw.receipts).map((receipt, index) => ({
      id: asText(receipt.id, `provider-arena-receipt-${index + 1}`),
      kind: normalizeProviderArenaReceiptKind(receipt.kind),
      source: asText(receipt.source, "ProviderArenaService"),
      detail: asText(receipt.detail, "Receipt da Provider Arena."),
      status: normalizeProviderArenaReceiptStatus(receipt.status),
      observatoryReceiptId: asText(receipt.observatoryReceiptId) || undefined,
    })).slice(0, 12),
    policy: {
      noProviderExecutionPerformed: policy.noProviderExecutionPerformed === true,
      usesRunObservatoryReceipts: policy.usesRunObservatoryReceipts === true,
      comparesConfiguredAndObservedRoute: policy.comparesConfiguredAndObservedRoute === true,
      doesNotOverrideModelPicker: policy.doesNotOverrideModelPicker === true,
      fallbackVisible: policy.fallbackVisible === true,
      secretsSerialized: policy.secretsSerialized === true,
    },
    surface: {
      cliCommand: asText(surface.cliCommand, "zavorth arena --json"),
      commandCenterPath: asText(surface.commandCenterPath, "/control?sector=config"),
      arenaHint: asText(surface.arenaHint, "Comparar provider/model antes de trocar rota."),
    },
    nextSafeAction: asText(raw.nextSafeAction, "Continuar coletando receipts de provider."),
  };
}

function normalizeProviderCockpitStatus(
  value: unknown,
): DashboardProviderCockpitSnapshot["status"] {
  const raw = asText(value).toLowerCase();
  if (raw === "ready" || raw === "blocked") {
    return raw;
  }
  return "attention";
}

function normalizeProviderCockpitReadiness(
  value: unknown,
): DashboardProviderCockpitSnapshot["cards"][number]["status"] {
  const raw = asText(value).toLowerCase();
  if (
    raw === "ready"
    || raw === "missing_auth"
    || raw === "missing_base_url"
    || raw === "needs_probe"
    || raw === "degraded"
    || raw === "unsupported"
    || raw === "blocked"
  ) {
    return raw;
  }
  return "needs_probe";
}

function normalizeProviderCockpitLiveStatus(
  value: unknown,
): DashboardProviderCockpitSnapshot["cards"][number]["liveStatus"] {
  const raw = asText(value).toLowerCase();
  if (raw === "passed" || raw === "failed" || raw === "blocked") {
    return raw;
  }
  return "not_run";
}

function normalizeProviderCockpitPriority(
  value: unknown,
): DashboardProviderCockpitSnapshot["cards"][number]["priority"] {
  const raw = asText(value).toLowerCase();
  if (raw === "primary" || raw === "blocked") {
    return raw;
  }
  return "normal";
}

function normalizeProviderCockpitActionKind(
  value: unknown,
): DashboardProviderCockpitAction["kind"] {
  const raw = asText(value).toLowerCase();
  if (raw === "read" || raw === "probe_packet" || raw === "live_probe" || raw === "configure" || raw === "select") {
    return raw;
  }
  return "read";
}

function mapProviderCockpitAction(
  action: LooseRecord,
  index: number,
): DashboardProviderCockpitAction {
  const kind = normalizeProviderCockpitActionKind(action.kind);
  return {
    id: asText(action.id, `provider-cockpit-action-${index + 1}`),
    label: asText(action.label, "Provider action"),
    command: asText(action.command, "zavorth providers"),
    kind,
    providerId: asText(action.providerId) || null,
    risk: action.risk === "sensitive" || kind === "live_probe" ? "sensitive" : "read",
    requiresApproval: action.requiresApproval === true || kind === "live_probe",
    dashboardCanExecute: false,
    summary: asText(action.summary, "Projected command; dashboard does not execute provider calls."),
  };
}

function mapProviderCockpitCard(
  card: LooseRecord,
  index: number,
): DashboardProviderCockpitCard {
  const evidence = asRecord(card.evidence) || {};
  return {
    id: asText(card.id, `provider-cockpit-card-${index + 1}`),
    providerId: asText(card.providerId, `provider-${index + 1}`),
    title: asText(card.title, "Provider"),
    status: normalizeProviderCockpitReadiness(card.status),
    liveStatus: normalizeProviderCockpitLiveStatus(card.liveStatus),
    priority: normalizeProviderCockpitPriority(card.priority),
    model: asText(card.model) || null,
    summary: asText(card.summary, "Provider readiness projected by runtime."),
    evidence: {
      liveNetworkUsed: evidence.liveNetworkUsed === true,
      target: asText(evidence.target) || null,
      httpStatus: asNumber(evidence.httpStatus) ?? null,
      durationMs: asNumber(evidence.durationMs) ?? null,
      modelCount: asNumber(evidence.modelCount) ?? null,
      evidenceHash: asText(evidence.evidenceHash) || null,
    },
    actions: asArray<LooseRecord>(card.actions).map(mapProviderCockpitAction).slice(0, 5),
  };
}

export function buildProviderCockpit(
  input: DashboardCommandCenterAdapterInput,
): DashboardProviderCockpitSnapshot | null {
  const metadata = resolveAgentRunMetadata(input);
  const raw = asRecord(input.providerCockpit)
    || asRecord(input.runtime?.providerCockpit)
    || asRecord(input.state?.providerCockpit)
    || asRecord(metadata?.providerCockpit);
  if (!raw) {
    return null;
  }

  const summary = asRecord(raw.summary) || {};
  const commandCenterProjection = asRecord(raw.commandCenterProjection) || {};
  const safety = asRecord(raw.safety) || {};
  return {
    contractVersion: asText(raw.contractVersion, "unknown"),
    schemaVersion: 1,
    surface: "command-center-provider-cockpit",
    generatedAt: formatTimestamp(raw.generatedAt),
    status: normalizeProviderCockpitStatus(raw.status),
    visualMutationApplied: raw.visualMutationApplied === true,
    executionAuthority: raw.executionAuthority === true,
    selectedProviderId: asText(raw.selectedProviderId) || null,
    summary: {
      totalProviders: asNumber(summary.totalProviders) ?? 0,
      readyProviders: asNumber(summary.readyProviders) ?? 0,
      livePassed: asNumber(summary.livePassed) ?? 0,
      liveFailed: asNumber(summary.liveFailed) ?? 0,
      liveBlocked: asNumber(summary.liveBlocked) ?? 0,
      missingAuth: asNumber(summary.missingAuth) ?? 0,
      missingBaseUrl: asNumber(summary.missingBaseUrl) ?? 0,
      needsProbe: asNumber(summary.needsProbe) ?? 0,
    },
    cards: asArray<LooseRecord>(raw.cards).map(mapProviderCockpitCard).slice(0, 12),
    actions: asArray<LooseRecord>(raw.actions).map(mapProviderCockpitAction).slice(0, 12),
    healthChecks: asArray<LooseRecord>(raw.healthChecks).map((check, index) => ({
      id: asText(check.id, `provider-cockpit-health-${index + 1}`),
      label: asText(check.label, "Provider cockpit health"),
      status: normalizeProviderCockpitStatus(check.status),
      detail: asText(check.detail, "No detail provided."),
    })).slice(0, 8),
    receipts: asArray<LooseRecord>(raw.receipts).map((receipt, index) => {
      const rawKind = asText(receipt.kind).toLowerCase();
      const rawStatus = asText(receipt.status).toLowerCase();
      return {
        id: asText(receipt.id, `provider-cockpit-receipt-${index + 1}`),
        kind: rawKind === "live-evidence" || rawKind === "safety" ? rawKind : "matrix",
        status: rawStatus === "recorded" || rawStatus === "blocked" ? rawStatus : "not-run",
        providerId: asText(receipt.providerId) || null,
        detail: asText(receipt.detail, "Provider cockpit receipt."),
        evidenceHash: asText(receipt.evidenceHash) || null,
      };
    }).slice(0, 8),
    commandCenterProjection: {
      route: "/control",
      endpoint: asText(commandCenterProjection.endpoint, "/api/providers/readiness") as "/api/providers/readiness",
      renderMode: "projection-only",
      visualApprovalRequired: commandCenterProjection.visualApprovalRequired !== false,
      canRenderCardsAfterApproval: commandCenterProjection.canRenderCardsAfterApproval !== false,
    },
    safety: {
      noRawProviderSecrets: safety.noRawProviderSecrets !== false,
      normalRenderMakesNoNetworkCalls: safety.normalRenderMakesNoNetworkCalls !== false,
      liveProbeRequiresExplicitOperatorAction: safety.liveProbeRequiresExplicitOperatorAction !== false,
      commandCenterCannotExecuteProviderCalls: safety.commandCenterCannotExecuteProviderCalls !== false,
    },
    nextAction: asText(raw.nextAction, "Review provider readiness before switching models."),
  };
}
