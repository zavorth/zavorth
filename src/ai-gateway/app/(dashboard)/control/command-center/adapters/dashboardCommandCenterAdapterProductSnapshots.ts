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
  DashboardBlueprintCompletionGateSnapshot,
  DashboardIntegrationShowcasePartnerSurfaceSnapshot,
  DashboardReleaseAdoptionReadinessSnapshot,
  DashboardReleaseCandidatePreCanaryGateSnapshot,
  DashboardFeedbackTelemetryProductLoopSnapshot,
  DashboardProductEntryRuntimeSnapshot,
  DashboardProductizationEvidenceSnapshot,
  DashboardPublicAdoptionPilotLoopSnapshot,
  DashboardPublicSiteDocsDemoSyncSnapshot,
  DashboardReleaseInstallerRollbackPathSnapshot,
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

function normalizeUniversalIntentTrustStatus(value: unknown): DashboardUniversalIntentTrustEnforcementSnapshot["status"] {
  const raw = asText(value).toLowerCase();
  if (raw === "allow" || raw === "requires-clarification" || raw === "requires-permission" || raw === "blocked") {
    return raw;
  }
  return "unknown";
}

function normalizeUniversalIntentTrustRisk(value: unknown): DashboardUniversalIntentTrustEnforcementSnapshot["summary"]["risk"] {
  const raw = asText(value).toLowerCase();
  if (raw === "safe" || raw === "attention" || raw === "danger") {
    return raw;
  }
  return "unknown";
}

function normalizeUniversalIntentTrustLevel(value: unknown): DashboardUniversalIntentTrustEnforcementSnapshot["summary"]["trustLevel"] {
  const raw = asText(value).toLowerCase();
  if (raw === "protected" || raw === "collaborator" || raw === "overlord") {
    return raw;
  }
  return "unknown";
}

function normalizeUniversalIntentTrustDecision(value: unknown): DashboardUniversalIntentTrustEnforcementSnapshot["summary"]["trustDecision"] {
  const raw = asText(value).toLowerCase();
  if (raw === "allow" || raw === "requires_permission" || raw === "block") {
    return raw;
  }
  return "unknown";
}

function normalizeUniversalIntentGateStatus(value: unknown): DashboardUniversalIntentTrustEnforcementSnapshot["gates"][number]["status"] {
  const raw = asText(value).toLowerCase();
  if (raw === "requires-action" || raw === "blocked") {
    return raw;
  }
  return "passed";
}

function normalizeUniversalIntentReceiptStatus(value: unknown): DashboardUniversalIntentTrustEnforcementSnapshot["receipts"][number]["status"] {
  const raw = asText(value).toLowerCase();
  if (raw === "requires-action" || raw === "blocked") {
    return raw;
  }
  return "ready";
}

export function buildUniversalIntentTrustEnforcement(
  input: DashboardCommandCenterAdapterInput,
): DashboardUniversalIntentTrustEnforcementSnapshot | null {
  const metadata = resolveAgentRunMetadata(input);
  const raw = asRecord(input.universalIntentTrustEnforcement)
    || asRecord(input.runtime?.universalIntentTrustEnforcement)
    || asRecord(input.state?.universalIntentTrustEnforcement)
    || asRecord(metadata?.universalIntentTrustEnforcement);
  if (!raw) {
    return null;
  }

  const identifiers = asRecord(raw.identifiers) || {};
  const summary = asRecord(raw.summary) || {};
  const universalIntent = asRecord(raw.universalIntent) || {};
  const permission = asRecord(raw.permission) || {};
  const scopeBoundary = asRecord(permission.scopeBoundary) || {};
  const clarification = asRecord(raw.clarification) || {};
  const trustSlider = asRecord(raw.trustSlider) || {};
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
    status: normalizeUniversalIntentTrustStatus(raw.status),
    summary: {
      intent: asText(summary.intent, "conversation"),
      risk: normalizeUniversalIntentTrustRisk(summary.risk),
      trustLevel: normalizeUniversalIntentTrustLevel(summary.trustLevel),
      trustDecision: normalizeUniversalIntentTrustDecision(summary.trustDecision),
      posture: asText(summary.posture, "direct-answer"),
      requestedToolCount: asNumber(summary.requestedToolCount) ?? 0,
      capabilityCount: asNumber(summary.capabilityCount) ?? 0,
      matchedSignalCount: asNumber(summary.matchedSignalCount) ?? 0,
      requiresClarification: summary.requiresClarification === true,
      requiresPermission: summary.requiresPermission === true,
      previewRequired: summary.previewRequired === true,
      approvalRequired: summary.approvalRequired === true,
      blocked: summary.blocked === true,
      hostAllowed: summary.hostAllowed === true,
      workspaceRootPresent: summary.workspaceRootPresent === true,
    },
    universalIntent: {
      intent: asText(universalIntent.intent, asText(summary.intent, "conversation")),
      risk: normalizeUniversalIntentTrustRisk(universalIntent.risk ?? summary.risk),
      sideEffect: asText(universalIntent.sideEffect, "none"),
      confidence: asNumber(universalIntent.confidence) ?? 0,
      capabilityRequired: asTextArray(universalIntent.capabilityRequired) ?? [],
      matchedSignals: asTextArray(universalIntent.matchedSignals) ?? [],
      nextSafeAction: asText(universalIntent.nextSafeAction, asText(raw.nextSafeAction, "answer")),
    },
    permission: {
      required: permission.required === true,
      kind: asText(permission.kind, "none"),
      scope: asText(permission.scope, "none"),
      prompt: asText(permission.prompt) || null,
      reason: asText(permission.reason) || null,
      previewRequired: permission.previewRequired === true,
      approvalRequired: permission.approvalRequired === true,
      sideEffect: asText(permission.sideEffect, "none"),
      scopeBoundary: {
        sessionId: asText(scopeBoundary.sessionId) || null,
        workspaceRoot: asText(scopeBoundary.workspaceRoot) || null,
        targetPath: asText(scopeBoundary.targetPath) || null,
        hostAllowed: scopeBoundary.hostAllowed === true,
      },
    },
    clarification: {
      required: clarification.required === true,
      askBeforeAssumption: clarification.askBeforeAssumption === true,
      question: asText(clarification.question) || null,
      reason: asText(clarification.reason) || null,
      missing: asTextArray(clarification.missing) ?? [],
      sensitiveDomain: clarification.sensitiveDomain === true,
    },
    trustSlider: {
      level: normalizeUniversalIntentTrustLevel(trustSlider.level ?? summary.trustLevel),
      decision: normalizeUniversalIntentTrustDecision(trustSlider.decision ?? summary.trustDecision),
      sandboxTier: asText(trustSlider.sandboxTier, "unknown"),
      permissionBoundary: asText(trustSlider.permissionBoundary, "unknown"),
      permissionScope: asText(trustSlider.permissionScope, "none"),
      previewRequired: trustSlider.previewRequired === true,
      approvalRequired: trustSlider.approvalRequired === true,
      blocked: trustSlider.blocked === true,
      blockReason: asText(trustSlider.blockReason) || null,
    },
    gates: asArray<LooseRecord>(raw.gates).map((gate, index) => ({
      id: asText(gate.id, `uni-trust-gate-${index + 1}`),
      label: asText(gate.label, "UNI / Trust gate"),
      status: normalizeUniversalIntentGateStatus(gate.status),
      source: asText(gate.source, "UniversalIntentTrustEnforcementService"),
      detail: asText(gate.detail, "Gate sem detalhe."),
    })).slice(0, 12),
    receipts: asArray<LooseRecord>(raw.receipts).map((receipt, index) => ({
      id: asText(receipt.id, `uni-trust-receipt-${index + 1}`),
      kind: asText(receipt.kind, "policy"),
      source: asText(receipt.source, "UniversalIntentTrustEnforcementService"),
      detail: asText(receipt.detail, "Receipt UNI / Trust."),
      status: normalizeUniversalIntentReceiptStatus(receipt.status),
    })).slice(0, 12),
    policy: {
      universalIntentIsSourceOfTruth: policy.universalIntentIsSourceOfTruth !== false,
      trustSliderEnforcedBeforeExecutor: policy.trustSliderEnforcedBeforeExecutor !== false,
      naturalLanguageDoesNotBypassPolicy: policy.naturalLanguageDoesNotBypassPolicy !== false,
      permissionNarrativeRequired: policy.permissionNarrativeRequired !== false,
      previewBeforeMutation: policy.previewBeforeMutation === true,
      approvalRequiredForPermission: policy.approvalRequiredForPermission === true,
      hostScopeRequiresOverlord: policy.hostScopeRequiresOverlord !== false,
      workspaceBoundaryEnforced: policy.workspaceBoundaryEnforced !== false,
      noToolExecutedBySnapshot: policy.noToolExecutedBySnapshot !== false,
      secretsSerialized: policy.secretsSerialized === true,
    },
    surface: {
      cliCommand: asText(surface.cliCommand, "zavorth uni"),
      commandCenterPath: asText(surface.commandCenterPath, "/control?sector=config"),
      trustHint: asText(surface.trustHint, "Trust Slider aplicado."),
      permissionHint: asText(surface.permissionHint, "Permissao conversacional quando necessaria."),
    },
    nextSafeAction: asText(raw.nextSafeAction, "Aplicar UNI / Trust antes do executor."),
  };
}

function normalizeRunArtifactReceiptReplayStatus(value: unknown): DashboardRunArtifactReceiptReplaySnapshot["status"] {
  const raw = asText(value).toLowerCase();
  if (raw === "ready" || raw === "partial" || raw === "empty" || raw === "blocked") {
    return raw;
  }
  return "unknown";
}

export function buildRunArtifactReceiptReplay(
  input: DashboardCommandCenterAdapterInput,
): DashboardRunArtifactReceiptReplaySnapshot | null {
  const metadata = resolveAgentRunMetadata(input);
  const raw = asRecord(input.runArtifactReceiptReplay)
    || asRecord(input.runtime?.runArtifactReceiptReplay)
    || asRecord(input.state?.runArtifactReceiptReplay)
    || asRecord(metadata?.runArtifactReceiptReplay);
  if (!raw) {
    return null;
  }

  const identifiers = asRecord(raw.identifiers) || {};
  const summary = asRecord(raw.summary) || {};
  const observatory = asRecord(raw.observatory) || {};
  const replay = asRecord(raw.replay) || {};
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
    status: normalizeRunArtifactReceiptReplayStatus(raw.status),
    summary: {
      runCount: asNumber(summary.runCount) ?? 0,
      frameCount: asNumber(summary.frameCount) ?? 0,
      artifactCount: asNumber(summary.artifactCount) ?? 0,
      artifactLinkCount: asNumber(summary.artifactLinkCount) ?? 0,
      observatoryReceiptCount: asNumber(summary.observatoryReceiptCount) ?? 0,
      featureReceiptCount: asNumber(summary.featureReceiptCount) ?? 0,
      memoryReceiptCount: asNumber(summary.memoryReceiptCount) ?? 0,
      coveredFeatureCount: asNumber(summary.coveredFeatureCount) ?? 0,
      missingFeatureCount: asNumber(summary.missingFeatureCount) ?? 0,
      replayAnchorCount: asNumber(summary.replayAnchorCount) ?? 0,
      replayable: summary.replayable === true,
      runObservatoryLinked: summary.runObservatoryLinked === true,
      artifactMemoryLinked: summary.artifactMemoryLinked === true,
      memoryWithReceiptsLinked: summary.memoryWithReceiptsLinked === true,
    },
    observatory: {
      contractVersion: asText(observatory.contractVersion, "unknown"),
      replayAvailable: observatory.replayAvailable === true,
      receiptCount: asNumber(observatory.receiptCount) ?? 0,
      timelineCount: asNumber(observatory.timelineCount) ?? 0,
      healthStatus: asText(observatory.healthStatus, "unknown"),
      nextSafeAction: asText(observatory.nextSafeAction, "Abrir Run Observatory."),
    },
    features: asArray<LooseRecord>(raw.features).map((feature, index) => ({
      featureId: asText(feature.featureId, `feature-${index + 1}`),
      metadataKey: asText(feature.metadataKey, "metadata"),
      label: asText(feature.label, "Feature"),
      present: feature.present === true,
      contractVersion: asText(feature.contractVersion) || null,
      status: asText(feature.status) || null,
      receiptCount: asNumber(feature.receiptCount) ?? 0,
      frameCount: asNumber(feature.frameCount) ?? 0,
      source: asText(feature.source) || null,
    })).slice(0, 18),
    frames: asArray<LooseRecord>(raw.frames).map((frame, index) => ({
      id: asText(frame.id, `replay-frame-${index + 1}`),
      order: asNumber(frame.order) ?? index + 1,
      kind: asText(frame.kind, "event"),
      source: asText(frame.source, "runtime"),
      title: asText(frame.title, "Replay frame"),
      detail: asText(frame.detail, "Sem detalhe."),
      status: asText(frame.status, "unknown"),
      createdAt: formatTimestamp(frame.createdAt),
      receiptId: asText(frame.receiptId) || null,
      artifactId: asText(frame.artifactId) || null,
      featureId: asText(frame.featureId) || null,
    })).slice(0, 40),
    artifactLinks: asArray<LooseRecord>(raw.artifactLinks).map((artifact, index) => {
      const commands = asRecord(artifact.commands) || {};
      return {
        artifactId: asText(artifact.artifactId, `artifact-${index + 1}`),
        title: asText(artifact.title, "Artifact"),
        kind: asText(artifact.kind, "file"),
        status: asText(artifact.status, "ready"),
        createdAt: formatTimestamp(artifact.createdAt),
        category: asText(artifact.category, "artifact"),
        replayFrameId: asText(artifact.replayFrameId, "frame:artifact"),
        observatoryReceiptId: asText(artifact.observatoryReceiptId) || null,
        memoryReceiptId: asText(artifact.memoryReceiptId) || null,
        commands: {
          openCommand: asText(commands.openCommand, "zavorth artifact open <id>"),
          replayCommand: asText(commands.replayCommand, "zavorth replay artifact <id>"),
          citeCommand: asText(commands.citeCommand, "zavorth artifact cite <id>"),
        },
      };
    }).slice(0, 18),
    receiptLinks: asArray<LooseRecord>(raw.receiptLinks).map((receipt, index) => ({
      id: asText(receipt.id, `receipt-${index + 1}`),
      kind: asText(receipt.kind, "receipt"),
      source: asText(receipt.source, "runtime"),
      featureId: asText(receipt.featureId) || null,
      title: asText(receipt.title, "Receipt"),
      detail: asText(receipt.detail, "Sem detalhe."),
      status: asText(receipt.status, "unknown"),
      createdAt: formatTimestamp(receipt.createdAt),
      artifactId: asText(receipt.artifactId) || null,
      frameId: asText(receipt.frameId) || null,
    })).slice(0, 40),
    replay: {
      available: replay.available === true,
      anchors: asArray<LooseRecord>(replay.anchors).map((anchor, index) => ({
        id: asText(anchor.id, `replay-anchor-${index + 1}`),
        frameId: asText(anchor.frameId, "frame"),
        kind: asText(anchor.kind, "event"),
        label: asText(anchor.label, "Replay anchor"),
        status: asText(anchor.status, "unknown"),
        createdAt: formatTimestamp(anchor.createdAt),
      })).slice(0, 24),
      commandHints: asTextArray(replay.commandHints) ?? [],
      summary: asText(replay.summary, "Replay hardening."),
    },
    policy: {
      noToolExecutedByReplay: policy.noToolExecutedByReplay !== false,
      noFilesystemReadPerformed: policy.noFilesystemReadPerformed !== false,
      noArtifactContentInvented: policy.noArtifactContentInvented !== false,
      noArtifactMutation: policy.noArtifactMutation !== false,
      replayUsesReceiptsOnly: policy.replayUsesReceiptsOnly !== false,
      artifactsMustCiteOrigin: policy.artifactsMustCiteOrigin !== false,
      naturalLanguageDoesNotBypassPolicy: policy.naturalLanguageDoesNotBypassPolicy !== false,
      secretsSerialized: policy.secretsSerialized === true,
    },
    surface: {
      cliCommand: asText(surface.cliCommand, "zavorth replay"),
      commandCenterPath: asText(surface.commandCenterPath, "/control"),
      replayHint: asText(surface.replayHint, "Replay nao reexecuta tools."),
      receiptHint: asText(surface.receiptHint, "Receipts citam origem."),
    },
    nextSafeAction: asText(raw.nextSafeAction, "Usar replay auditavel antes de reutilizar artifact."),
  };
}

export function buildProductizationEvidence(
  input: DashboardCommandCenterAdapterInput,
): DashboardProductizationEvidenceSnapshot | null {
  const metadata = resolveAgentRunMetadata(input);
  const raw = asRecord(input.productizationEvidence)
    || asRecord(input.runtime?.productizationEvidence)
    || asRecord(input.state?.productizationEvidence)
    || asRecord(metadata?.productizationEvidence);
  if (!raw) {
    return null;
  }
  return raw as unknown as DashboardProductizationEvidenceSnapshot;
}

export function buildProductEntryRuntime(
  input: DashboardCommandCenterAdapterInput,
): DashboardProductEntryRuntimeSnapshot | null {
  const metadata = resolveAgentRunMetadata(input);
  const raw = asRecord(input.productEntryRuntime)
    || asRecord(input.runtime?.productEntryRuntime)
    || asRecord(input.state?.productEntryRuntime)
    || asRecord(metadata?.productEntryRuntime);
  if (!raw) {
    return null;
  }
  return raw as unknown as DashboardProductEntryRuntimeSnapshot;
}

export function buildReleaseInstallerRollbackPath(
  input: DashboardCommandCenterAdapterInput,
): DashboardReleaseInstallerRollbackPathSnapshot | null {
  const metadata = resolveAgentRunMetadata(input);
  const raw = asRecord(input.releaseInstallerRollbackPath)
    || asRecord(input.runtime?.releaseInstallerRollbackPath)
    || asRecord(input.state?.releaseInstallerRollbackPath)
    || asRecord(metadata?.releaseInstallerRollbackPath);
  if (!raw) {
    return null;
  }
  return raw as unknown as DashboardReleaseInstallerRollbackPathSnapshot;
}

export function buildPublicSiteDocsDemoSync(
  input: DashboardCommandCenterAdapterInput,
): DashboardPublicSiteDocsDemoSyncSnapshot | null {
  const metadata = resolveAgentRunMetadata(input);
  const raw = asRecord(input.publicSiteDocsDemoSync)
    || asRecord(input.runtime?.publicSiteDocsDemoSync)
    || asRecord(input.state?.publicSiteDocsDemoSync)
    || asRecord(metadata?.publicSiteDocsDemoSync);
  if (!raw) {
    return null;
  }
  return raw as unknown as DashboardPublicSiteDocsDemoSyncSnapshot;
}

export function buildFeedbackTelemetryProductLoop(
  input: DashboardCommandCenterAdapterInput,
): DashboardFeedbackTelemetryProductLoopSnapshot | null {
  const metadata = resolveAgentRunMetadata(input);
  const raw = asRecord(input.feedbackTelemetryProductLoop)
    || asRecord(input.runtime?.feedbackTelemetryProductLoop)
    || asRecord(input.state?.feedbackTelemetryProductLoop)
    || asRecord(metadata?.feedbackTelemetryProductLoop);
  if (!raw) {
    return null;
  }
  return raw as unknown as DashboardFeedbackTelemetryProductLoopSnapshot;
}

export function buildPublicAdoptionPilotLoop(
  input: DashboardCommandCenterAdapterInput,
): DashboardPublicAdoptionPilotLoopSnapshot | null {
  const metadata = resolveAgentRunMetadata(input);
  const raw = asRecord(input.publicAdoptionPilotLoop)
    || asRecord(input.runtime?.publicAdoptionPilotLoop)
    || asRecord(input.state?.publicAdoptionPilotLoop)
    || asRecord(metadata?.publicAdoptionPilotLoop);
  if (!raw) {
    return null;
  }
  return raw as unknown as DashboardPublicAdoptionPilotLoopSnapshot;
}

export function buildIntegrationShowcasePartnerSurface(
  input: DashboardCommandCenterAdapterInput,
): DashboardIntegrationShowcasePartnerSurfaceSnapshot | null {
  const metadata = resolveAgentRunMetadata(input);
  const raw = asRecord(input.integrationShowcasePartnerSurface)
    || asRecord(input.runtime?.integrationShowcasePartnerSurface)
    || asRecord(input.state?.integrationShowcasePartnerSurface)
    || asRecord(metadata?.integrationShowcasePartnerSurface);
  if (!raw) {
    return null;
  }
  return raw as unknown as DashboardIntegrationShowcasePartnerSurfaceSnapshot;
}

export function buildReleaseAdoptionReadiness(
  input: DashboardCommandCenterAdapterInput,
): DashboardReleaseAdoptionReadinessSnapshot | null {
  const metadata = resolveAgentRunMetadata(input);
  const raw = asRecord(input.releaseAdoptionReadiness)
    || asRecord(input.runtime?.releaseAdoptionReadiness)
    || asRecord(input.state?.releaseAdoptionReadiness)
    || asRecord(metadata?.releaseAdoptionReadiness);
  if (!raw) {
    return null;
  }
  return raw as unknown as DashboardReleaseAdoptionReadinessSnapshot;
}

export function buildReleaseCandidatePreCanaryGate(
  input: DashboardCommandCenterAdapterInput,
): DashboardReleaseCandidatePreCanaryGateSnapshot | null {
  const metadata = resolveAgentRunMetadata(input);
  const raw = asRecord(input.releaseCandidatePreCanaryGate)
    || asRecord(input.runtime?.releaseCandidatePreCanaryGate)
    || asRecord(input.state?.releaseCandidatePreCanaryGate)
    || asRecord(metadata?.releaseCandidatePreCanaryGate);
  if (!raw) {
    return null;
  }
  return raw as unknown as DashboardReleaseCandidatePreCanaryGateSnapshot;
}

export function buildBlueprintCompletionGate(
  input: DashboardCommandCenterAdapterInput,
): DashboardBlueprintCompletionGateSnapshot | null {
  const metadata = resolveAgentRunMetadata(input);
  const raw = asRecord(input.blueprintCompletionGate)
    || asRecord(input.runtime?.blueprintCompletionGate)
    || asRecord(input.state?.blueprintCompletionGate)
    || asRecord(metadata?.blueprintCompletionGate);
  if (!raw) {
    return null;
  }
  return raw as unknown as DashboardBlueprintCompletionGateSnapshot;
}

function normalizeProviderMeshStatus(value: unknown): DashboardProviderMeshConsolidationSnapshot["status"] {
  const raw = asText(value).toLowerCase();
  if (raw === "ready" || raw === "partial" || raw === "blocked") {
    return raw;
  }
  return "unknown";
}

function normalizeProviderMeshReadiness(
  value: unknown,
): DashboardProviderMeshConsolidationSnapshot["routes"][number]["readiness"] {
  const raw = asText(value).toLowerCase();
  if (raw === "ready" || raw === "needs_config" || raw === "needs_probe") {
    return raw;
  }
  return "unknown";
}

function mapProviderMeshRoute(
  entry: LooseRecord,
  index: number,
): DashboardProviderMeshConsolidationSnapshot["routes"][number] {
  const runtime = asRecord(entry.runtime) || {};
  return {
    id: asText(entry.id, `provider-mesh-route-${index + 1}`),
    label: asText(entry.label, "Provider route"),
    providerId: asText(entry.providerId),
    providerName: asText(entry.providerName),
    routeKind: asText(entry.routeKind, "unknown"),
    routeClass: asText(entry.routeClass, "unknown"),
    readiness: normalizeProviderMeshReadiness(entry.readiness),
    ready: entry.ready === true,
    issue: asText(entry.issue) || null,
    familyIds: asTextArray(entry.familyIds),
    modelCount: asNumber(entry.modelCount) ?? 0,
    catalogSource: asText(entry.catalogSource, "unknown"),
    fallbackRouteIds: asTextArray(entry.fallbackRouteIds),
    runtime: {
      adapterKind: asText(runtime.adapterKind, "unknown"),
      runtimeSupported: runtime.runtimeSupported === true,
      firstClassProvider: runtime.firstClassProvider === true,
      genericCompatible: runtime.genericCompatible === true,
    },
  };
}

function mapProviderMeshFamily(
  entry: LooseRecord,
  index: number,
): DashboardProviderMeshConsolidationSnapshot["families"][number] {
  return {
    id: asText(entry.id, `provider-mesh-family-${index + 1}`),
    label: asText(entry.label, "Provider family"),
    ready: entry.ready === true,
    readiness: normalizeProviderMeshReadiness(entry.readiness),
    routeCount: asNumber(entry.routeCount) ?? 0,
    readyRouteCount: asNumber(entry.readyRouteCount) ?? 0,
    modelCount: asNumber(entry.modelCount) ?? 0,
    capabilities: asTextArray(entry.capabilities),
    selected: entry.selected === true,
  };
}

export function buildProviderMeshConsolidation(
  input: DashboardCommandCenterAdapterInput,
): DashboardProviderMeshConsolidationSnapshot | null {
  const metadata = resolveAgentRunMetadata(input);
  const raw = asRecord(input.providerMeshConsolidation)
    || asRecord(input.runtime?.providerMeshConsolidation)
    || asRecord(input.state?.providerMeshConsolidation)
    || asRecord(metadata?.providerMeshConsolidation);
  if (!raw) {
    return null;
  }

  const identifiers = asRecord(raw.identifiers) || {};
  const summary = asRecord(raw.summary) || {};
  const selected = asRecord(raw.selected) || {};
  const runtimeFactory = asRecord(selected.runtimeFactory) || {};
  const onboarding = asRecord(raw.onboarding) || {};
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
    status: normalizeProviderMeshStatus(raw.status),
    summary: {
      manifestCount: asNumber(summary.manifestCount) ?? 0,
      familyCount: asNumber(summary.familyCount) ?? 0,
      routeCount: asNumber(summary.routeCount) ?? 0,
      readyRouteCount: asNumber(summary.readyRouteCount) ?? 0,
      modelCount: asNumber(summary.modelCount) ?? 0,
      customModelCount: asNumber(summary.customModelCount) ?? 0,
      importedModelCount: asNumber(summary.importedModelCount) ?? 0,
      incompleteProviderCount: asNumber(summary.incompleteProviderCount) ?? 0,
      selectedReady: summary.selectedReady === true,
      providerArenaLinked: summary.providerArenaLinked === true,
      p0ExtraComplete: summary.p0ExtraComplete === true,
    },
    p0ExtraCoverage: Object.entries(asRecord(raw.p0ExtraCoverage) || {})
      .reduce<Record<string, boolean>>((acc, [key, value]) => {
        acc[key] = value === true;
        return acc;
      }, {}),
    selected: {
      familyId: asText(selected.familyId) || null,
      routeId: asText(selected.routeId) || null,
      modelId: asText(selected.modelId) || null,
      providerName: asText(selected.providerName) || null,
      providerLabel: asText(selected.providerLabel) || null,
      modelName: asText(selected.modelName) || null,
      modelLabel: asText(selected.modelLabel) || null,
      ready: selected.ready === true,
      source: asText(selected.source, "unknown"),
      fallbackRouteIds: asTextArray(selected.fallbackRouteIds) ?? [],
      fallbackOrder: asTextArray(selected.fallbackOrder) ?? [],
      runtimeFactory: {
        adapterKind: asText(runtimeFactory.adapterKind, "unknown"),
        runtimeSupported: runtimeFactory.runtimeSupported === true,
        firstClassProvider: runtimeFactory.firstClassProvider === true,
        genericCompatible: runtimeFactory.genericCompatible === true,
        explanation: (asTextArray(runtimeFactory.explanation) ?? []).slice(0, 8),
      },
    },
    families: asArray<LooseRecord>(raw.families).map(mapProviderMeshFamily).slice(0, 14),
    routes: asArray<LooseRecord>(raw.routes).map(mapProviderMeshRoute).slice(0, 18),
    modelSources: Object.entries(asRecord(raw.modelSources) || {})
      .reduce<Record<string, number>>((acc, [key, value]) => {
        acc[key] = asNumber(value) ?? 0;
        return acc;
      }, {}),
    onboarding: {
      status: normalizeProviderMeshStatus(onboarding.status),
      requestedCapability: asText(onboarding.requestedCapability) || null,
      firstQuestionId: asText(onboarding.firstQuestionId, "capability"),
      capabilityCount: asNumber(onboarding.capabilityCount) ?? 0,
      selectedCapability: asText(onboarding.selectedCapability) || null,
      sameContractAcrossSurfaces: onboarding.sameContractAcrossSurfaces === true,
      consumers: asTextArray(onboarding.consumers) ?? [],
    },
    receipts: asArray<LooseRecord>(raw.receipts).map((receipt, index) => {
      const status = asText(receipt.status).toLowerCase();
      return {
        id: asText(receipt.id, `provider-mesh-receipt-${index + 1}`),
        kind: asText(receipt.kind, "policy"),
        source: asText(receipt.source, "ProviderMeshConsolidationService"),
        detail: asText(receipt.detail, "Receipt de provider mesh."),
        status: (status === "partial" || status === "missing" ? status : "ready") as "missing" | "ready" | "partial",
      };
    }).slice(0, 12),
    policy: {
      noProviderExecutionPerformed: policy.noProviderExecutionPerformed !== false,
      modelPickerContractIsSourceOfTruth: policy.modelPickerContractIsSourceOfTruth !== false,
      providerFactoryUsesSelectedProfile: policy.providerFactoryUsesSelectedProfile !== false,
      catalogDoesNotCreateRuntimeAdapter: policy.catalogDoesNotCreateRuntimeAdapter !== false,
      noLegacyProviderSwitch: policy.noLegacyProviderSwitch !== false,
      onboardingAsksCapabilityFirst: policy.onboardingAsksCapabilityFirst !== false,
      secretsSerialized: policy.secretsSerialized === true,
    },
    surface: {
      cliCommand: asText(surface.cliCommand, "zavorth provider-mesh"),
      commandCenterPath: asText(surface.commandCenterPath, "/control?sector=config"),
      pickerHint: asText(surface.pickerHint, "Model Picker como fonte canonica."),
      onboardingHint: asText(surface.onboardingHint, "Onboarding por capability."),
    },
    nextSafeAction: asText(raw.nextSafeAction, "Usar provider mesh como fonte canonica."),
  };
}
