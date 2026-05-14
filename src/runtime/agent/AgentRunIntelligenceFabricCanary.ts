import type { IntelligenceFabricInput, IntelligenceFabricSnapshot, IntelligenceTrustMode } from '../../contracts/IntelligenceFabricContract.js';
import type { ZavorthIntelligenceFabricLearningService } from '../../services/ZavorthIntelligenceFabricLearningService.js';
import { ZavorthIntelligenceFabricService } from '../../services/ZavorthIntelligenceFabricService.js';
import { AgentRunIntelligenceFabricDraftMutation } from './AgentRunIntelligenceFabricDraftMutation.js';
import type { AgentRunIntelligenceFabricDraftApplyResult, AgentRunIntelligenceFabricDraftMutationRuntime } from './AgentRunIntelligenceFabricDraftMutation.js';
import type { UniversalAgentRequest, UniversalAgentRun } from './UniversalAgentRuntimeTypes.js';
export type { AgentRunIntelligenceFabricDraftApplyResult, AgentRunIntelligenceFabricDraftGuidance } from './AgentRunIntelligenceFabricDraftMutation.js';
export type AgentRunIntelligenceFabricMode = 'disabled' | 'shadow' | 'canary' | 'default';
export type AgentRunIntelligenceFabricCanaryMetadata = {
  source: 'AgentRunIntelligenceFabricCanary';
  phase: 1;
  mode: AgentRunIntelligenceFabricMode;
  status: 'observed' | 'disabled' | 'fallback-current-runtime';
  generatedAt: string;
  selectedPath: 'intelligence-fabric-canary' | 'intelligence-fabric-default' | 'current-runtime-fallback';
  dispatchTarget: 'current-runtime';
  fallback: {
    available: true;
    route: 'current-runtime';
    reason: string;
  };
  rollback: {
    available: true;
    runtimeChanged: false;
    stateChanged: false;
    strategy: string;
  };
  safety: {
    rawSecretsSerialized: false;
    liveActionApplied: false;
    defaultRuntimeChanged: false;
    currentRuntimeFallbackRetained: true;
  };
  orientation: AgentRunIntelligenceFabricOrientation;
  fabric: AgentRunIntelligenceFabricCompactSnapshot | null;
  learning: {
    recorded: boolean;
    source: 'shadow' | 'canary' | null;
  };
  metrics: {
    snapshotLatencyMs: number;
    orientationLatencyMs: number;
    totalLatencyMs: number;
    modelRoutingReady: boolean | null;
    modelRoutingSource: string | null;
    modelFallbackReason: string | null;
  };
  receipts: string[];
  error: string | null;
};
export type AgentRunIntelligenceFabricOrientation = {
  applied: boolean;
  scope: 'risk-0-2-safe' | 'risk-3-draft-guidance' | 'not-eligible' | 'disabled' | 'fallback';
  reason: string;
  modelSelectionApplied: boolean;
  contextPackAttached: boolean;
  draftGuidanceAttached: boolean;
  executorDispatchChanged: false;
  toolExecutionChanged: false;
  fallbackAvailable: true;
  targetModelId: string | null;
  targetProviderId: string | null;
  contextTokenBudget: number | null;
  modelRoutingReady: boolean | null;
  modelRoutingSource: string | null;
  modelFallbackReason: string | null;
};
export type AgentRunIntelligenceFabricCompactSnapshot = {
  contractVersion: string;
  generatedAt: string;
  sourceMode: IntelligenceFabricSnapshot['mode'];
  taskKind: IntelligenceFabricSnapshot['classification']['taskKind'];
  complexity: IntelligenceFabricSnapshot['classification']['complexity'];
  riskLevel: IntelligenceFabricSnapshot['classification']['riskLevel'];
  recommendedMode: IntelligenceFabricSnapshot['classification']['recommendedMode'];
  trustMode: IntelligenceFabricSnapshot['trust']['requested'];
  legacyTrustMode: IntelligenceFabricSnapshot['trust']['legacy'];
  trustSource: IntelligenceFabricSnapshot['trust']['source'];
  trustOwnerLocalDefault: boolean;
  trustSurfacePolicy: IntelligenceFabricSnapshot['trust']['surfacePolicy'];
  model: {
    source: IntelligenceFabricSnapshot['modelRouting']['source'];
    selectedModelId: string | null;
    selectedProviderId: string | null;
    ready: boolean;
    overrideUsed: boolean;
  };
  proposal: {
    id: string;
    mode: IntelligenceFabricSnapshot['executionProposal']['mode'];
    riskLevel: IntelligenceFabricSnapshot['executionProposal']['riskLevel'];
    actionCount: number;
    requiresApproval: boolean;
    requiresSandbox: boolean;
    liveActionApplied: false;
  };
  riskGate: {
    decision: IntelligenceFabricSnapshot['riskGate']['overallDecision'];
    canExecuteNow: boolean;
    requiresApproval: boolean;
    requiresSandbox: boolean;
  };
  verifier: IntelligenceFabricSnapshot['verifier'];
  capabilityBuilder: {
    status: IntelligenceFabricSnapshot['capabilityBuilder']['status'];
    requestedCapability: string | null;
    matchedCapabilityId: string | null;
    manifestId: string | null;
    manifestRiskLevel: number | null;
    defaultEnabled: false | null;
    liveAllowedByDefault: false | null;
  };
  taskEval: IntelligenceFabricSnapshot['taskEval'];
  receipts: string[];
};

type AgentRunIntelligenceFabricCanaryRuntime = {
  now?: () => Date;
  fabric?: Pick<ZavorthIntelligenceFabricService, 'buildShadowSnapshot'> | null;
  learning?: Pick<ZavorthIntelligenceFabricLearningService, 'recordSnapshot'> | null;
  mutationPlane?: AgentRunIntelligenceFabricDraftMutationRuntime['mutationPlane'];
  defaultMode?: AgentRunIntelligenceFabricMode | null;
};

export class AgentRunIntelligenceFabricCanary {
  private readonly now: () => Date;
  private readonly fabric: Pick<ZavorthIntelligenceFabricService, 'buildShadowSnapshot'>;
  private readonly learning: Pick<ZavorthIntelligenceFabricLearningService, 'recordSnapshot'> | null;
  private readonly draftMutation: AgentRunIntelligenceFabricDraftMutation;
  private readonly defaultMode: AgentRunIntelligenceFabricMode;

  constructor(runtime: AgentRunIntelligenceFabricCanaryRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.fabric = runtime.fabric || new ZavorthIntelligenceFabricService({ now: this.now });
    this.learning = runtime.learning || null;
    this.draftMutation = new AgentRunIntelligenceFabricDraftMutation({
      now: this.now,
      mutationPlane: runtime.mutationPlane || null,
    });
    this.defaultMode = normalizeMode(runtime.defaultMode, 'default');
  }

  public apply(input: {
    run: UniversalAgentRun;
    request: UniversalAgentRequest;
    canOrientModel?: boolean;
  }): AgentRunIntelligenceFabricCanaryMetadata {
    const mode = this.resolveMode(input.request);
    if (mode === 'disabled') {
      const disabled = this.disabledMetadata();
      this.writeMetadata(input.run, disabled);
      return disabled;
    }

    try {
      const startedAt = Date.now();
      const snapshot = this.fabric.buildShadowSnapshot(this.toFabricInput(input.request));
      const snapshotLatencyMs = Math.max(0, Date.now() - startedAt);
      const learningSource = mode === 'canary' ? 'canary' : 'shadow';
      let learningRecorded = false;
      if (this.learning) {
        this.learning.recordSnapshot({ snapshot, source: learningSource });
        learningRecorded = true;
      }
      const orientationStartedAt = Date.now();
      const orientation = this.applyOrientationIfEligible({
        run: input.run,
        mode,
        snapshot,
        canOrientModel: input.canOrientModel !== false,
      });
      const orientationLatencyMs = Math.max(0, Date.now() - orientationStartedAt);
      const metadata = this.observedMetadata({
        mode,
        snapshot,
        learningRecorded,
        learningSource,
        orientation,
        metrics: {
          snapshotLatencyMs,
          orientationLatencyMs,
          totalLatencyMs: Math.max(0, Date.now() - startedAt),
          modelRoutingReady: snapshot.modelRouting.ready,
          modelRoutingSource: snapshot.modelRouting.source,
          modelFallbackReason: orientation.modelFallbackReason,
        },
      });
      this.writeMetadata(input.run, metadata);
      return metadata;
    } catch (error) {
      const metadata = this.fallbackMetadata(error);
      this.writeMetadata(input.run, metadata);
      return metadata;
    }
  }

  public applyDraftGuidancePlan(input: {
    run: UniversalAgentRun;
    planId: string;
    permissionId?: string | null;
    approvedBy?: string | null;
    approveNow?: boolean;
  }): AgentRunIntelligenceFabricDraftApplyResult {
    return this.draftMutation.applyDraftGuidancePlan(input);
  }

  public promoteDraftWorkspaceWrites(input: {
    run: UniversalAgentRun;
    writes: unknown;
    patches?: unknown;
  }): boolean {
    const guidance = this.draftMutation.promoteWorkspaceWrites(input);
    if (!guidance) {
      return false;
    }
    input.run.metadata = {
      ...input.run.metadata,
      intelligenceFabricDraftGuidance: guidance,
    };
    return true;
  }

  private toFabricInput(request: UniversalAgentRequest): IntelligenceFabricInput {
    const metadata = readRecord(request.metadata);
    return {
      text: request.text,
      surface: request.channel,
      trustMode: normalizeTrustModeOrNull(metadata.intelligenceFabricTrustMode || metadata.trustMode),
      userRole: stringOrNull(metadata.userRole) || request.userId,
      userForcedModel: stringOrNull(metadata.userForcedModel),
      workspaceRoot: request.workspace || null,
      requestedTools: request.requestedTools || [],
      capabilityIds: Array.isArray(metadata.capabilityIds)
        ? metadata.capabilityIds.map((entry) => String(entry)).filter(Boolean)
        : [],
    };
  }

  private observedMetadata(input: {
    mode: AgentRunIntelligenceFabricMode;
    snapshot: IntelligenceFabricSnapshot;
    learningRecorded: boolean;
    learningSource: 'shadow' | 'canary';
    orientation: AgentRunIntelligenceFabricOrientation;
    metrics: AgentRunIntelligenceFabricCanaryMetadata['metrics'];
  }): AgentRunIntelligenceFabricCanaryMetadata {
    const canaryWouldHandle = input.orientation.applied;
    return {
      source: 'AgentRunIntelligenceFabricCanary',
      phase: 1,
      mode: input.mode,
      status: 'observed',
      generatedAt: this.now().toISOString(),
      selectedPath: canaryWouldHandle ? selectedPathForMode(input.mode) : 'current-runtime-fallback',
      dispatchTarget: 'current-runtime',
      fallback: {
        available: true,
        route: 'current-runtime',
        reason: canaryWouldHandle
          ? fallbackReasonForMode(input.mode)
          : 'Fabric verifier or gate kept current runtime as the selected path.',
      },
      rollback: {
        available: true,
        runtimeChanged: false,
        stateChanged: false,
        strategy: 'Set intelligenceFabricMode to disabled or remove intelligenceFabricCanary metadata; current runtime was never replaced.',
      },
      safety: {
        rawSecretsSerialized: false,
        liveActionApplied: false,
        defaultRuntimeChanged: false,
        currentRuntimeFallbackRetained: true,
      },
      orientation: input.orientation,
      fabric: compactSnapshot(input.snapshot),
      learning: {
        recorded: input.learningRecorded,
        source: input.learningSource,
      },
      metrics: input.metrics,
      receipts: [
        input.mode === 'default' ? 'intelligence-fabric-default-active' : 'intelligence-fabric-canary-observed',
        ...(input.orientation.applied
          ? ['intelligence-fabric-safe-orientation-applied']
          : ['intelligence-fabric-orientation-not-applied']),
        'current-runtime-dispatch-retained',
        'fallback-and-rollback-ready',
      ],
      error: null,
    };
  }

  private disabledMetadata(): AgentRunIntelligenceFabricCanaryMetadata {
    return {
      source: 'AgentRunIntelligenceFabricCanary',
      phase: 1,
      mode: 'disabled',
      status: 'disabled',
      generatedAt: this.now().toISOString(),
      selectedPath: 'current-runtime-fallback',
      dispatchTarget: 'current-runtime',
      fallback: {
        available: true,
        route: 'current-runtime',
        reason: 'Intelligence Fabric canary was explicitly disabled for this run.',
      },
      rollback: {
        available: true,
        runtimeChanged: false,
        stateChanged: false,
        strategy: 'No rollback needed; canary did not run.',
      },
      safety: {
        rawSecretsSerialized: false,
        liveActionApplied: false,
        defaultRuntimeChanged: false,
        currentRuntimeFallbackRetained: true,
      },
      orientation: {
        applied: false,
        scope: 'disabled',
        reason: 'Intelligence Fabric canary was disabled before snapshot or orientation.',
        modelSelectionApplied: false,
        contextPackAttached: false,
        draftGuidanceAttached: false,
        executorDispatchChanged: false,
        toolExecutionChanged: false,
        fallbackAvailable: true,
        targetModelId: null,
        targetProviderId: null,
        contextTokenBudget: null,
        modelRoutingReady: null,
        modelRoutingSource: null,
        modelFallbackReason: 'Intelligence Fabric disabled for this run.',
      },
      fabric: null,
      learning: {
        recorded: false,
        source: null,
      },
      metrics: {
        snapshotLatencyMs: 0,
        orientationLatencyMs: 0,
        totalLatencyMs: 0,
        modelRoutingReady: null,
        modelRoutingSource: null,
        modelFallbackReason: 'Intelligence Fabric disabled for this run.',
      },
      receipts: ['intelligence-fabric-canary-disabled'],
      error: null,
    };
  }

  private fallbackMetadata(error: unknown): AgentRunIntelligenceFabricCanaryMetadata {
    return {
      source: 'AgentRunIntelligenceFabricCanary',
      phase: 1,
      mode: this.defaultMode,
      status: 'fallback-current-runtime',
      generatedAt: this.now().toISOString(),
      selectedPath: 'current-runtime-fallback',
      dispatchTarget: 'current-runtime',
      fallback: {
        available: true,
        route: 'current-runtime',
        reason: 'Intelligence Fabric canary failed closed into current runtime fallback.',
      },
      rollback: {
        available: true,
        runtimeChanged: false,
        stateChanged: false,
        strategy: 'No runtime rollback needed; only canary metadata was written.',
      },
      safety: {
        rawSecretsSerialized: false,
        liveActionApplied: false,
        defaultRuntimeChanged: false,
        currentRuntimeFallbackRetained: true,
      },
      orientation: {
        applied: false,
        scope: 'fallback',
        reason: 'Intelligence Fabric failed before any orientation could be applied.',
        modelSelectionApplied: false,
        contextPackAttached: false,
        draftGuidanceAttached: false,
        executorDispatchChanged: false,
        toolExecutionChanged: false,
        fallbackAvailable: true,
        targetModelId: null,
        targetProviderId: null,
        contextTokenBudget: null,
        modelRoutingReady: null,
        modelRoutingSource: null,
        modelFallbackReason: 'Intelligence Fabric failed before model routing could orient the runtime.',
      },
      fabric: null,
      learning: {
        recorded: false,
        source: null,
      },
      metrics: {
        snapshotLatencyMs: 0,
        orientationLatencyMs: 0,
        totalLatencyMs: 0,
        modelRoutingReady: null,
        modelRoutingSource: null,
        modelFallbackReason: 'Intelligence Fabric failed before model routing could orient the runtime.',
      },
      receipts: [
        'intelligence-fabric-canary-error',
        'current-runtime-fallback-used',
      ],
      error: error instanceof Error ? error.message : String(error),
    };
  }

  private resolveMode(request: UniversalAgentRequest): AgentRunIntelligenceFabricMode {
    const metadata = readRecord(request.metadata);
    return normalizeMode(metadata.intelligenceFabricMode, this.defaultMode);
  }

  private applyOrientationIfEligible(input: {
    run: UniversalAgentRun;
    mode: AgentRunIntelligenceFabricMode;
    snapshot: IntelligenceFabricSnapshot;
    canOrientModel: boolean;
  }): AgentRunIntelligenceFabricOrientation {
    const { snapshot } = input;
    if (input.mode === 'disabled') {
      return orientationResult({
        reason: 'Intelligence Fabric was disabled before live orientation.',
        scope: 'disabled',
        snapshot,
      });
    }
    if (input.mode === 'shadow') {
      return orientationResult({
        reason: 'Shadow mode records decisions only; it does not orient live runtime inputs.',
        scope: 'not-eligible',
        snapshot,
      });
    }
    if (snapshot.verifier.status === 'blocked') {
      return orientationResult({
        reason: 'Verifier blocked the Fabric proposal, so current runtime context and model remain untouched.',
        scope: 'not-eligible',
        snapshot,
      });
    }
    if (
      snapshot.classification.riskLevel > 3
      || snapshot.riskGate.requiresSandbox
      || (snapshot.classification.riskLevel !== 3 && snapshot.riskGate.requiresApproval)
    ) {
      return orientationResult({
        reason: 'Only risk 0-2 requests can receive canary orientation, and risk 3 can only receive draft guidance.',
        scope: 'not-eligible',
        snapshot,
      });
    }
    if (snapshot.classification.riskLevel === 3) {
      const contextPackAttached = this.attachContextPack(input.run, snapshot, input.mode);
      const draftGuidanceAttached = this.attachDraftGuidance(input.run, snapshot);
      return orientationResult({
        applied: contextPackAttached || draftGuidanceAttached,
        reason: 'Risk 3 request received draft guidance only; no patch, tool call or commit was applied.',
        scope: 'risk-3-draft-guidance',
        modelSelectionApplied: false,
        contextPackAttached,
        draftGuidanceAttached,
        snapshot,
      });
    }

    const modelSelectionApplied = input.canOrientModel
      ? this.applyModelOrientation(input.run, snapshot, input.mode)
      : false;
    const contextPackAttached = this.attachContextPack(input.run, snapshot, input.mode);
    return orientationResult({
      applied: modelSelectionApplied || contextPackAttached,
      reason: 'Risk 0-2 request received Fabric context/model orientation while execution stayed on current runtime.',
      scope: 'risk-0-2-safe',
      modelSelectionApplied,
      contextPackAttached,
      draftGuidanceAttached: false,
      snapshot,
      modelFallbackReason: resolveModelFallbackReason({
        snapshot,
        canOrientModel: input.canOrientModel,
        modelSelectionApplied,
        run: input.run,
      }),
    });
  }

  private applyModelOrientation(
    run: UniversalAgentRun,
    snapshot: IntelligenceFabricSnapshot,
    mode: AgentRunIntelligenceFabricMode,
  ): boolean {
    const providerName = stringOrNull(snapshot.modelRouting.selectedProviderId)
      || stringOrNull(snapshot.modelRouting.selectedRouteId);
    const modelName = stringOrNull(snapshot.modelRouting.selectedModelId);
    if (!providerName && !modelName) {
      return false;
    }

    const existingSelection = readRecord(run.metadata.modelPickerSelection);
    const existingProvider = stringOrNull(existingSelection.providerName)
      || stringOrNull(existingSelection.routeId);
    const existingModel = stringOrNull(existingSelection.modelName);
    const hasExistingRuntimeSelection = Boolean(existingProvider || existingModel);
    const hasConcreteRunModel = isConcreteProviderLabel(run.modelProfile.providerLabel)
      || isConcreteModelLabel(run.modelProfile.modelLabel);
    if (!snapshot.modelRouting.overrideUsed && (hasExistingRuntimeSelection || hasConcreteRunModel)) {
      return false;
    }
    if (!snapshot.modelRouting.ready && !snapshot.modelRouting.overrideUsed) {
      return false;
    }
    const fallbackOrder = uniqueStrings([
      providerName,
      ...arrayOfStrings(existingSelection.fallbackOrder),
    ]);
    run.metadata = {
      ...run.metadata,
      modelPickerSelection: {
        ...existingSelection,
        source: modelSelectionSourceForMode(mode),
        providerName: providerName || stringOrNull(existingSelection.providerName),
        modelName: modelName || stringOrNull(existingSelection.modelName),
        routeId: stringOrNull(snapshot.modelRouting.selectedRouteId)
          || providerName
          || stringOrNull(existingSelection.routeId),
        ready: snapshot.modelRouting.ready,
        overrideUsed: snapshot.modelRouting.overrideUsed,
        fallbackOrder,
        fabricTaskKind: snapshot.classification.taskKind,
        fabricRiskLevel: snapshot.classification.riskLevel,
        fabricModelRoutingSource: snapshot.modelRouting.source,
      },
    };
    run.modelProfile = {
      ...run.modelProfile,
      providerLabel: providerName || run.modelProfile.providerLabel,
      modelLabel: modelName || run.modelProfile.modelLabel,
      routeId: stringOrNull(snapshot.modelRouting.selectedRouteId) || run.modelProfile.routeId,
      familyId: snapshot.classification.taskKind,
      routingPolicy: 'gateway',
      ready: snapshot.modelRouting.ready,
      fallbackOrder,
      selectionExplanation: [
        ...(run.modelProfile.selectionExplanation || []),
        `Intelligence Fabric ${mode} selected route for ${snapshot.classification.taskKind} risk ${snapshot.classification.riskLevel}.`,
      ],
    };
    return true;
  }

  private attachContextPack(
    run: UniversalAgentRun,
    snapshot: IntelligenceFabricSnapshot,
    mode: AgentRunIntelligenceFabricMode = this.defaultMode,
  ): boolean {
    run.metadata = {
      ...run.metadata,
      intelligenceFabricContextPack: {
        source: mode === 'default' ? 'IntelligenceFabricDefault' : 'IntelligenceFabricCanary',
        contractVersion: snapshot.contractVersion,
        generatedAt: snapshot.generatedAt,
        taskKind: snapshot.classification.taskKind,
        complexity: snapshot.classification.complexity,
        riskLevel: snapshot.classification.riskLevel,
        recommendedMode: snapshot.classification.recommendedMode,
        trustMode: snapshot.trust.requested,
        trustSource: snapshot.trust.source,
        modelRoutingReady: snapshot.modelRouting.ready,
        modelRoutingSource: snapshot.modelRouting.source,
        modelFallbackReason: resolveModelFallbackReason({
          snapshot,
          canOrientModel: true,
          modelSelectionApplied: Boolean(readRecord(run.metadata.modelPickerSelection)?.source === modelSelectionSourceForMode(mode)),
          run,
        }),
        tokenBudget: snapshot.contextPack.tokenBudget,
        projectSummary: snapshot.contextPack.projectSummary,
        activeConstraints: snapshot.contextPack.activeConstraints.slice(0, 8),
        recentDecisions: snapshot.contextPack.recentDecisions.slice(0, 8),
        securityPolicy: snapshot.contextPack.securityPolicy,
        relevantFiles: snapshot.contextPack.relevantFiles.slice(0, 8).map((file) => ({
          path: file.path,
          reason: file.reason,
        })),
        receipts: snapshot.receipts.slice(0, 12),
      },
    };
    return true;
  }

  private attachDraftGuidance(
    run: UniversalAgentRun,
    snapshot: IntelligenceFabricSnapshot,
  ): boolean {
    const guidance = this.draftMutation.attachDraftGuidance({ run, snapshot });
    run.metadata = {
      ...run.metadata,
      intelligenceFabricDraftGuidance: guidance,
    };
    return true;
  }

  private writeMetadata(
    run: UniversalAgentRun,
    metadata: AgentRunIntelligenceFabricCanaryMetadata,
  ): void {
    run.metadata = {
      ...run.metadata,
      intelligenceFabricCanary: metadata,
    };
  }
}

function orientationResult(input: {
  applied?: boolean;
  scope: AgentRunIntelligenceFabricOrientation['scope'];
  reason: string;
  modelSelectionApplied?: boolean;
  contextPackAttached?: boolean;
  draftGuidanceAttached?: boolean;
  modelFallbackReason?: string | null;
  snapshot: IntelligenceFabricSnapshot;
}): AgentRunIntelligenceFabricOrientation {
  return {
    applied: Boolean(input.applied),
    scope: input.scope,
    reason: input.reason,
    modelSelectionApplied: Boolean(input.modelSelectionApplied),
    contextPackAttached: Boolean(input.contextPackAttached),
    draftGuidanceAttached: Boolean(input.draftGuidanceAttached),
    executorDispatchChanged: false,
    toolExecutionChanged: false,
    fallbackAvailable: true,
    targetModelId: snapshotString(input.snapshot.modelRouting.selectedModelId),
    targetProviderId: snapshotString(input.snapshot.modelRouting.selectedProviderId)
      || snapshotString(input.snapshot.modelRouting.selectedRouteId),
    contextTokenBudget: Number.isFinite(input.snapshot.contextPack.tokenBudget)
      ? input.snapshot.contextPack.tokenBudget
      : null,
    modelRoutingReady: input.snapshot.modelRouting.ready,
    modelRoutingSource: input.snapshot.modelRouting.source,
    modelFallbackReason: input.modelFallbackReason || null,
  };
}

function resolveModelFallbackReason(input: {
  snapshot: IntelligenceFabricSnapshot;
  canOrientModel: boolean;
  modelSelectionApplied: boolean;
  run: UniversalAgentRun;
}): string | null {
  if (input.modelSelectionApplied) {
    return null;
  }
  if (!input.canOrientModel) {
    return 'Current executor path cannot receive model override; Fabric context remains attached.';
  }
  if (!input.snapshot.modelRouting.ready && !input.snapshot.modelRouting.overrideUsed) {
    return 'ModelPicker did not return a ready route; current runtime model selection remains the fallback.';
  }
  const existingSelection = readRecord(input.run.metadata.modelPickerSelection);
  const hasExistingRuntimeSelection = Boolean(
    stringOrNull(existingSelection.providerName)
    || stringOrNull(existingSelection.routeId)
    || stringOrNull(existingSelection.modelName),
  );
  const hasConcreteRunModel = isConcreteProviderLabel(input.run.modelProfile.providerLabel)
    || isConcreteModelLabel(input.run.modelProfile.modelLabel);
  if (!input.snapshot.modelRouting.overrideUsed && (hasExistingRuntimeSelection || hasConcreteRunModel)) {
    return 'Current runtime already has a concrete model selection; Fabric kept it as fallback.';
  }
  if (!input.snapshot.modelRouting.selectedModelId && !input.snapshot.modelRouting.selectedProviderId && !input.snapshot.modelRouting.selectedRouteId) {
    return 'Fabric did not receive a concrete model route; current runtime fallback remains active.';
  }
  return 'Fabric context orientation applied without changing the model route.';
}

function compactSnapshot(snapshot: IntelligenceFabricSnapshot): AgentRunIntelligenceFabricCompactSnapshot {
  return {
    contractVersion: snapshot.contractVersion,
    generatedAt: snapshot.generatedAt,
    sourceMode: snapshot.mode,
    taskKind: snapshot.classification.taskKind,
    complexity: snapshot.classification.complexity,
    riskLevel: snapshot.classification.riskLevel,
    recommendedMode: snapshot.classification.recommendedMode,
    trustMode: snapshot.trust.requested,
    legacyTrustMode: snapshot.trust.legacy,
    trustSource: snapshot.trust.source,
    trustOwnerLocalDefault: snapshot.trust.ownerLocalDefault,
    trustSurfacePolicy: snapshot.trust.surfacePolicy,
    model: {
      source: snapshot.modelRouting.source,
      selectedModelId: snapshot.modelRouting.selectedModelId,
      selectedProviderId: snapshot.modelRouting.selectedProviderId,
      ready: snapshot.modelRouting.ready,
      overrideUsed: snapshot.modelRouting.overrideUsed,
    },
    proposal: {
      id: snapshot.executionProposal.id,
      mode: snapshot.executionProposal.mode,
      riskLevel: snapshot.executionProposal.riskLevel,
      actionCount: snapshot.executionProposal.actions.length,
      requiresApproval: snapshot.executionProposal.requiresApproval,
      requiresSandbox: snapshot.executionProposal.requiresSandbox,
      liveActionApplied: false,
    },
    riskGate: {
      decision: snapshot.riskGate.overallDecision,
      canExecuteNow: snapshot.riskGate.canExecuteNow,
      requiresApproval: snapshot.riskGate.requiresApproval,
      requiresSandbox: snapshot.riskGate.requiresSandbox,
    },
    verifier: snapshot.verifier,
    capabilityBuilder: {
      status: snapshot.capabilityBuilder.status,
      requestedCapability: snapshot.capabilityBuilder.requestedCapability,
      matchedCapabilityId: snapshot.capabilityBuilder.matchedCapabilityId,
      manifestId: snapshot.capabilityBuilder.manifest?.id || null,
      manifestRiskLevel: snapshot.capabilityBuilder.manifest?.riskLevel || null,
      defaultEnabled: snapshot.capabilityBuilder.manifest?.defaultEnabled ?? null,
      liveAllowedByDefault: snapshot.capabilityBuilder.manifest?.liveAllowedByDefault ?? null,
    },
    taskEval: snapshot.taskEval,
    receipts: snapshot.receipts,
  };
}

function normalizeMode(value: unknown, fallback: AgentRunIntelligenceFabricMode): AgentRunIntelligenceFabricMode {
  return value === 'disabled' || value === 'shadow' || value === 'canary' || value === 'default'
    ? value
    : fallback;
}

function selectedPathForMode(mode: AgentRunIntelligenceFabricMode): AgentRunIntelligenceFabricCanaryMetadata['selectedPath'] {
  return mode === 'default' ? 'intelligence-fabric-default' : 'intelligence-fabric-canary';
}

function fallbackReasonForMode(mode: AgentRunIntelligenceFabricMode): string {
  return mode === 'default'
    ? 'Intelligence Fabric is the default orchestrator; executor dispatch still uses current runtime with fallback retained.'
    : 'Canary observed the request, but dispatch remains on current runtime during canary.';
}

function modelSelectionSourceForMode(mode: AgentRunIntelligenceFabricMode): string {
  return mode === 'default' ? 'intelligence-fabric-default' : 'intelligence-fabric-canary';
}

function normalizeTrustModeOrNull(value: unknown): IntelligenceTrustMode | null {
  return value === 'locked_down' || value === 'balanced' || value === 'local_owner' || value === 'developer_fast' || value === 'enterprise'
    ? value
    : null;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringOrNull(value: unknown): string | null {
  const text = String(value || '').trim();
  return text || null;
}

function snapshotString(value: unknown): string | null {
  return stringOrNull(value);
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) => String(entry || '').trim()).filter(Boolean)
    : [];
}

function uniqueStrings(values: Array<string | null>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function isConcreteProviderLabel(value: unknown): boolean {
  const provider = String(value || '').trim().toLowerCase();
  return Boolean(provider && !['zavorth', 'provider nao informado', 'provider não informado'].includes(provider));
}

function isConcreteModelLabel(value: unknown): boolean {
  const model = String(value || '').trim().toLowerCase();
  return Boolean(model && !['modelo atual', 'modelo nao informado', 'modelo não informado'].includes(model));
}
