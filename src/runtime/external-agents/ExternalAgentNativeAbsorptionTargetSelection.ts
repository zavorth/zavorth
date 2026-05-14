import {
  normalizeExternalAgentCommandCenterLiveAssimilationFixture,
} from './ExternalAgentCommandCenterLiveAssimilation.js';
import {
  normalizeMessageTransportCapabilityDiscoveryFixture,
} from './ExternalAgentRealMessageTransportCapabilityDiscovery.js';
import {
  normalizeExternalExecutorLiveReadOnlyBridgeBoundaryFixture,
} from './ExternalAgentExternalExecutorLiveReadOnlyBridgeBoundary.js';
import {
  normalizeExternalExecutorRealCapabilitySnapshotReadOnlyFixture,
} from './ExternalAgentExternalExecutorRealCapabilitySnapshotReadOnly.js';
import type {
  ExternalAgentCommandCenterLiveAssimilationNormalization,
} from './ExternalAgentCommandCenterLiveAssimilation.js';
import type {
  ZavorthMessageTransportCapabilityDiscoveryNormalization,
} from './ExternalAgentRealMessageTransportCapabilityDiscovery.js';
import type {
  ExternalExecutorLiveReadOnlyBridgeBoundaryNormalization,
} from './ExternalAgentExternalExecutorLiveReadOnlyBridgeBoundary.js';
import type {
  ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization,
} from './ExternalAgentExternalExecutorRealCapabilitySnapshotReadOnly.js';

export const EXTERNAL_AGENT_NATIVE_ABSORPTION_TARGET_SELECTION_NOW = '2026-04-29T00:00:00.000Z' as const;
export const EXTERNAL_AGENT_NATIVE_ABSORPTION_TARGET_SELECTION_RUNTIME_ID = 'external-agent-native-absorption-target-selection' as const;

export type ZavorthNativeAbsorptionTargetSelectionDecision =
  | 'native-absorption-target-selected'
  | 'blocked';

export type ZavorthNativeAbsorptionCandidateId =
  | 'capability-plugin-registry'
  | 'channel-metadata-registry'
  | 'command-http-surfaces'
  | 'config-secrets-mapping'
  | 'dashboard-view-models'
  | 'message-transport-registry'
  | 'provider-metadata-registry'
  | 'session-history-metadata-registry';

export type ZavorthNativeAbsorptionCandidateDecision =
  | 'defer'
  | 'first-target'
  | 'second-target';

export type ZavorthNativeAbsorptionRisk =
  | 'high'
  | 'low'
  | 'medium';

export type ZavorthNativeAbsorptionCandidate = {
  nativeContract: 'ZavorthNativeAbsorptionCandidate/v1';
  id: ZavorthNativeAbsorptionCandidateId;
  label: string;
  score: number;
  risk: ZavorthNativeAbsorptionRisk;
  decision: ZavorthNativeAbsorptionCandidateDecision;
  reducesExternalRuntimeDependency: boolean;
  sideEffectRiskLow: boolean;
  usesNormalizedRealEvidence: boolean;
  canBecomeZavorthOwnedWithoutModuleCopy: boolean;
  testsClear: boolean;
  requiresRealMutation: boolean;
  requiresProviderExecution: boolean;
  requiresMessageExecution: boolean;
  preparesAdapterRemoval: boolean;
  evidenceDocs: string[];
  reason: string;
};

export type ZavorthNativeReplacementInitialSlice = {
  nativeContract: 'ZavorthNativeReplacementInitialSlice/v1';
  id: 'dashboard-view-model-registry-native-slice';
  selectedTarget: 'dashboard-view-models';
  secondLikelyTarget: 'capability-plugin-registry';
  scope: string[];
  zavorthOwnedContracts: string[];
  sourceRuntimeNoLongerRequiredFor: string[];
  dependencyReductionProof: string[];
  adapterRemovalBlockedUntilParity: true;
  sourceModulesCopied: false;
  realMutationRequired: false;
  providerExecutionRequired: false;
  messageExecutionRequired: false;
  publicIdentityZavorthNative: true;
};

export type ZavorthNativeAbsorptionRouteChange = {
  nativeContract: 'ZavorthNativeAbsorptionRouteChange/v1';
  stopLiveActionDispatchPriority: true;
  stopLiveMessageDispatchPriority: true;
  nextRoute: 'native-absorption';
  liveDispatchGatesRemainAsEvidence: true;
  adapterRemovalAuthorized: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeAbsorptionTargetSelectionExecutionGate = {
  nativeAbsorptionRouteSelected: true;
  liveActionDispatchPriorityStopped: true;
  liveMessageDispatchPriorityStopped: true;
  targetSelected: true;
  sourceModuleCopied: false;
  superficialRenameOnly: false;
  adapterRemovedBeforeReplacement: false;
  realStateMigrationAuthorized: false;
  providerExecutionAuthorized: false;
  messageExecutionAuthorized: false;
  rawSecretSerialized: false;
  sourceIdentityPublic: false;
};

export type ZavorthNativeAbsorptionTargetSelectionNormalization = {
  nativeContract: 'ZavorthNativeAbsorptionTargetSelection/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ZavorthNativeAbsorptionTargetSelectionDecision;
  evidenceReadiness: {
    authenticatedHealth: 'docs/156-wave-1-authenticated-ephemeral-external-executor-gateway-health-probe.md';
    realCapabilitySnapshot: ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization['decision'];
    liveReadOnlyBridge: ExternalExecutorLiveReadOnlyBridgeBoundaryNormalization['decision'];
    commandCenterAssimilation: ExternalAgentCommandCenterLiveAssimilationNormalization['decision'];
    transportDiscovery: ZavorthMessageTransportCapabilityDiscoveryNormalization['decision'];
    configStateStrategy: 'docs/162-167 design/dry-run gates closed';
  };
  routeChange: ZavorthNativeAbsorptionRouteChange;
  candidates: ZavorthNativeAbsorptionCandidate[];
  firstTarget: ZavorthNativeAbsorptionCandidate;
  secondLikelyTarget: ZavorthNativeAbsorptionCandidate;
  initialSlice: ZavorthNativeReplacementInitialSlice;
  executionGate: ZavorthNativeAbsorptionTargetSelectionExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    sourceIdentityPublic: false;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: '185-dashboard-view-model-registry-native-slice';
};

export type ZavorthNativeAbsorptionTargetSelectionOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  runtimeId: TRuntimeId;
  evidence: {
    realCapabilitySnapshot: ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization;
    liveReadOnlyBridge: ExternalExecutorLiveReadOnlyBridgeBoundaryNormalization;
    commandCenterAssimilation: ExternalAgentCommandCenterLiveAssimilationNormalization;
    transportDiscovery: ZavorthMessageTransportCapabilityDiscoveryNormalization;
  };
};

function candidate(
  id: ZavorthNativeAbsorptionCandidateId,
  label: string,
  score: number,
  risk: ZavorthNativeAbsorptionRisk,
  decision: ZavorthNativeAbsorptionCandidateDecision,
  flags: Omit<ZavorthNativeAbsorptionCandidate, 'decision' | 'id' | 'label' | 'nativeContract' | 'reason' | 'risk' | 'score'>,
  reason: string,
): ZavorthNativeAbsorptionCandidate {
  return {
    nativeContract: 'ZavorthNativeAbsorptionCandidate/v1',
    id,
    label,
    score,
    risk,
    decision,
    ...flags,
    reason,
  };
}

export function createNativeAbsorptionTargetCandidates(): ZavorthNativeAbsorptionCandidate[] {
  return [
    candidate('dashboard-view-models', 'Dashboard view models', 96, 'low', 'first-target', {
      reducesExternalRuntimeDependency: true,
      sideEffectRiskLow: true,
      usesNormalizedRealEvidence: true,
      canBecomeZavorthOwnedWithoutModuleCopy: true,
      testsClear: true,
      requiresRealMutation: false,
      requiresProviderExecution: false,
      requiresMessageExecution: false,
      preparesAdapterRemoval: true,
      evidenceDocs: [
        'docs/169-wave-1-external-executor-live-read-only-bridge-boundary.md',
        'docs/170-wave-1-external-executor-live-observability-projection.md',
        'docs/173-wave-1-command-center-live-assimilation.md',
        'docs/183-wave-2-real-message-transport-capability-discovery.md',
      ],
    }, 'Public/runtime-facing views are already Zavorth-native and can be registered natively without starting ExternalExecutor.'),
    candidate('capability-plugin-registry', 'Capability/plugin registry', 91, 'low', 'second-target', {
      reducesExternalRuntimeDependency: true,
      sideEffectRiskLow: true,
      usesNormalizedRealEvidence: true,
      canBecomeZavorthOwnedWithoutModuleCopy: true,
      testsClear: true,
      requiresRealMutation: false,
      requiresProviderExecution: false,
      requiresMessageExecution: false,
      preparesAdapterRemoval: true,
      evidenceDocs: [
        'docs/161-wave-1-real-capability-snapshot-read-only.md',
        'docs/168-wave-1-external-agent-live-readiness-assimilation-pack.md',
        'docs/169-wave-1-external-executor-live-read-only-bridge-boundary.md',
      ],
    }, 'Real snapshot and bridge evidence are normalized; plugin/capability rows can become a Zavorth registry next.'),
    candidate('provider-metadata-registry', 'Provider metadata registry', 84, 'medium', 'defer', {
      reducesExternalRuntimeDependency: true,
      sideEffectRiskLow: true,
      usesNormalizedRealEvidence: true,
      canBecomeZavorthOwnedWithoutModuleCopy: true,
      testsClear: true,
      requiresRealMutation: false,
      requiresProviderExecution: false,
      requiresMessageExecution: false,
      preparesAdapterRemoval: true,
      evidenceDocs: [
        'docs/125-wave-0-provider-capability-contracts-matrix.md',
        'docs/161-wave-1-real-capability-snapshot-read-only.md',
      ],
    }, 'Provider metadata is safe, but provider capability rows were degraded by read-only skip guards.'),
    candidate('channel-metadata-registry', 'Channel metadata registry', 82, 'medium', 'defer', {
      reducesExternalRuntimeDependency: true,
      sideEffectRiskLow: true,
      usesNormalizedRealEvidence: true,
      canBecomeZavorthOwnedWithoutModuleCopy: true,
      testsClear: true,
      requiresRealMutation: false,
      requiresProviderExecution: false,
      requiresMessageExecution: false,
      preparesAdapterRemoval: true,
      evidenceDocs: [
        'docs/183-wave-2-real-message-transport-capability-discovery.md',
      ],
    }, 'Channel labels and credential requirements are known, but channel activation stayed skipped for safety.'),
    candidate('message-transport-registry', 'Message transport registry', 72, 'medium', 'defer', {
      reducesExternalRuntimeDependency: true,
      sideEffectRiskLow: true,
      usesNormalizedRealEvidence: true,
      canBecomeZavorthOwnedWithoutModuleCopy: true,
      testsClear: true,
      requiresRealMutation: false,
      requiresProviderExecution: false,
      requiresMessageExecution: false,
      preparesAdapterRemoval: true,
      evidenceDocs: [
        'docs/182-wave-2-message-send-live-rehearsal-transport-blocked.md',
        'docs/183-wave-2-real-message-transport-capability-discovery.md',
      ],
    }, 'Transport registry is important but should follow dashboard/capability registry because send remains blocked.'),
    candidate('session-history-metadata-registry', 'Session/history metadata registry', 70, 'medium', 'defer', {
      reducesExternalRuntimeDependency: true,
      sideEffectRiskLow: true,
      usesNormalizedRealEvidence: true,
      canBecomeZavorthOwnedWithoutModuleCopy: true,
      testsClear: true,
      requiresRealMutation: false,
      requiresProviderExecution: false,
      requiresMessageExecution: false,
      preparesAdapterRemoval: true,
      evidenceDocs: [
        'docs/172-wave-1-external-executor-session-history-read-only-bridge.md',
        'docs/167-wave-1-sqlite-session-store-dry-run-design.md',
      ],
    }, 'Session metadata is normalized, but real store import remains deferred behind SQLite dry-run gates.'),
    candidate('config-secrets-mapping', 'Config/secrets mapping', 68, 'medium', 'defer', {
      reducesExternalRuntimeDependency: true,
      sideEffectRiskLow: true,
      usesNormalizedRealEvidence: true,
      canBecomeZavorthOwnedWithoutModuleCopy: true,
      testsClear: true,
      requiresRealMutation: false,
      requiresProviderExecution: false,
      requiresMessageExecution: false,
      preparesAdapterRemoval: true,
      evidenceDocs: [
        'docs/157-wave-1-external-agent-secret-ref-resolver-injection-boundary.md',
        'docs/162-wave-0-external-agent-config-state-migration-strategy.md',
        'docs/164-wave-1-redaction-and-secretref-mapping.md',
      ],
    }, 'SecretRef mapping is ready but state/config migration remains dry-run only.'),
    candidate('command-http-surfaces', 'Command/http surfaces', 61, 'high', 'defer', {
      reducesExternalRuntimeDependency: true,
      sideEffectRiskLow: false,
      usesNormalizedRealEvidence: true,
      canBecomeZavorthOwnedWithoutModuleCopy: true,
      testsClear: true,
      requiresRealMutation: false,
      requiresProviderExecution: false,
      requiresMessageExecution: false,
      preparesAdapterRemoval: true,
      evidenceDocs: [
        'docs/143-wave-0-command-http-executable-runtime-matrix.md',
        'docs/147-wave-1-command-http-observability-projection-boundary-slice.md',
      ],
    }, 'Command/http surfaces are well classified but have higher execution/security blast radius.'),
  ];
}

export function createNativeReplacementInitialSlice(): ZavorthNativeReplacementInitialSlice {
  return {
    nativeContract: 'ZavorthNativeReplacementInitialSlice/v1',
    id: 'dashboard-view-model-registry-native-slice',
    selectedTarget: 'dashboard-view-models',
    secondLikelyTarget: 'capability-plugin-registry',
    scope: [
      'Zavorth-owned registry for Command Center runtime/capability/event/session/message/surface view models',
      'Snapshot-backed fixture ingestion from 169/170/172/173/183 normalized outputs',
      'Public dashboard model served from Zavorth registry without requiring ExternalExecutor live runtime',
    ],
    zavorthOwnedContracts: [
      'ZavorthCommandCenterLiveAssimilationViewModel/v1',
      'ZavorthCommandCenterRuntimeView/v1',
      'ZavorthCommandCenterCapabilityView/v1',
      'ZavorthCommandCenterEventView/v1',
      'ZavorthCommandCenterSessionView/v1',
      'ZavorthCommandCenterMessageMetadataView/v1',
      'ZavorthCommandCenterSurfaceView/v1',
      'ZavorthNativeAbsorptionDashboardViewRegistry/v1',
    ],
    sourceRuntimeNoLongerRequiredFor: [
      'Rendering Command Center public view models from latest normalized snapshot',
      'Classifying degraded/unavailable states for dashboard rows',
      'Showing transport capabilities as blocked/unconfigured metadata',
      'Proving public identity remains Zavorth-native',
    ],
    dependencyReductionProof: [
      'Unit test builds registry from existing normalized fixtures without starting ExternalExecutor',
      'No ExternalExecutor source term appears in public view model identity fields',
      'No adapter call is needed to render dashboard view model rows',
      'Parity check compares registry output to 173 public contracts',
    ],
    adapterRemovalBlockedUntilParity: true,
    sourceModulesCopied: false,
    realMutationRequired: false,
    providerExecutionRequired: false,
    messageExecutionRequired: false,
    publicIdentityZavorthNative: true,
  };
}

export function normalizeNativeAbsorptionTargetSelection<TRuntimeId extends string>(
  options: ZavorthNativeAbsorptionTargetSelectionOptions<TRuntimeId>,
): ZavorthNativeAbsorptionTargetSelectionNormalization {
  const candidates = createNativeAbsorptionTargetCandidates();
  const firstTarget = candidates.find((entry) => entry.decision === 'first-target');
  const secondLikelyTarget = candidates.find((entry) => entry.decision === 'second-target');
  if (!firstTarget || !secondLikelyTarget) {
    throw new Error('Native absorption target selection requires first and second targets.');
  }

  return {
    nativeContract: 'ZavorthNativeAbsorptionTargetSelection/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: 'native-absorption-target-selected',
    evidenceReadiness: {
      authenticatedHealth: 'docs/156-wave-1-authenticated-ephemeral-external-executor-gateway-health-probe.md',
      realCapabilitySnapshot: options.evidence.realCapabilitySnapshot.decision,
      liveReadOnlyBridge: options.evidence.liveReadOnlyBridge.decision,
      commandCenterAssimilation: options.evidence.commandCenterAssimilation.decision,
      transportDiscovery: options.evidence.transportDiscovery.decision,
      configStateStrategy: 'docs/162-167 design/dry-run gates closed',
    },
    routeChange: {
      nativeContract: 'ZavorthNativeAbsorptionRouteChange/v1',
      stopLiveActionDispatchPriority: true,
      stopLiveMessageDispatchPriority: true,
      nextRoute: 'native-absorption',
      liveDispatchGatesRemainAsEvidence: true,
      adapterRemovalAuthorized: false,
      rawSecretSerialized: false,
    },
    candidates,
    firstTarget,
    secondLikelyTarget,
    initialSlice: createNativeReplacementInitialSlice(),
    executionGate: {
      nativeAbsorptionRouteSelected: true,
      liveActionDispatchPriorityStopped: true,
      liveMessageDispatchPriorityStopped: true,
      targetSelected: true,
      sourceModuleCopied: false,
      superficialRenameOnly: false,
      adapterRemovedBeforeReplacement: false,
      realStateMigrationAuthorized: false,
      providerExecutionAuthorized: false,
      messageExecutionAuthorized: false,
      rawSecretSerialized: false,
      sourceIdentityPublic: false,
    },
    redaction: {
      rawSecretSerialized: false,
      sourceIdentityPublic: false,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: '185-dashboard-view-model-registry-native-slice',
  };
}

export function normalizeNativeAbsorptionTargetSelectionFixture(): ZavorthNativeAbsorptionTargetSelectionNormalization {
  return normalizeNativeAbsorptionTargetSelection({
    generatedAt: EXTERNAL_AGENT_NATIVE_ABSORPTION_TARGET_SELECTION_NOW,
    runtimeId: EXTERNAL_AGENT_NATIVE_ABSORPTION_TARGET_SELECTION_RUNTIME_ID,
    evidence: {
      realCapabilitySnapshot: normalizeExternalExecutorRealCapabilitySnapshotReadOnlyFixture(),
      liveReadOnlyBridge: normalizeExternalExecutorLiveReadOnlyBridgeBoundaryFixture(),
      commandCenterAssimilation: normalizeExternalAgentCommandCenterLiveAssimilationFixture(),
      transportDiscovery: normalizeMessageTransportCapabilityDiscoveryFixture(),
    },
  });
}
