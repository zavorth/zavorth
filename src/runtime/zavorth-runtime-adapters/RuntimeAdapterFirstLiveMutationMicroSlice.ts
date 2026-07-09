import {
  GOVERNED_EXECUTOR_BOUNDARY,
} from '../agent/executors/GovernedExecutorAdapter.js';
import {
  normalizeApprovedMutationExecutionHarnessFixture,
} from './RuntimeAdapterApprovedMutationExecutionHarness.js';

import type {
  GovernedExecutorBoundary,
} from '../agent/executors/GovernedExecutorAdapter.js';
import type {
  ZavorthMutableExternalActionKind,
} from './RuntimeAdapterApprovalRequiredMutationRehearsal.js';
import type {
  ZavorthApprovedMutationExecutionHarnessNormalization,
} from './RuntimeAdapterApprovedMutationExecutionHarness.js';

export const RUNTIME_ADAPTER_FIRST_LIVE_MUTATION_MICRO_SLICE_NOW = '2026-04-29T00:00:00.000Z' as const;
export const RUNTIME_ADAPTER_FIRST_LIVE_MUTATION_MICRO_SLICE_RUNTIME_ID = 'runtime-adapter-first-live-mutation-micro-slice' as const;

export type ZavorthFirstLiveMutationMicroSliceDecision =
  | 'first-live-mutation-micro-slice-ready'
  | 'no-safe-live-mutation-target';

export type ZavorthFirstLiveMutationTargetKind =
  | 'ephemeral-test-setting'
  | 'gateway-noop-ping-mutation'
  | 'scheduler-cron-mutation'
  | 'temporary-diagnostic-marker'
  | 'unknown';

export type ZavorthFirstLiveMutationFixtureCase =
  | 'no-approval-live-mutation-blocked'
  | 'policy-invalidated-live-mutation-blocked'
  | 'nonreversible-target-blocked'
  | 'unknown-target-no-safe-live-mutation-target'
  | 'dangerous-command-tool-blocked'
  | 'safe-target-governed-harness-path';

export type ZavorthFirstLiveMutationReceiptStatus =
  | 'blocked-dangerous-action'
  | 'blocked-no-approval'
  | 'blocked-nonreversible-target'
  | 'live-mutation-minimal-success'
  | 'no-safe-live-mutation-target'
  | 'policy-invalidated';

export type ZavorthFirstLiveMutationDiscoveryDecision =
  | 'no-safe-live-mutation-target'
  | 'safe-live-mutation-target-found';

export type ZavorthFirstLiveMutationSourceRecord = {
  fixtureCase: ZavorthFirstLiveMutationFixtureCase;
  targetKind: ZavorthFirstLiveMutationTargetKind;
  actionKind: ZavorthMutableExternalActionKind;
  discoveredReadOnly: true;
  approvalGrantValid: boolean;
  policyRecheckPasses: boolean;
  idempotencyKey: string;
  rollbackOrCompensationPlanAvailable: boolean;
  cleanupRequired: boolean;
  cleanupConfirmed: boolean;
  targetKnown: boolean;
  targetReversible: boolean;
  targetEphemeral: boolean;
  targetSideEffectZero: boolean;
  dangerousToolOrCommand: boolean;
  liveMutationAttempted: boolean;
  liveMutationSucceeded: boolean;
  redacted: true;
};

export type ZavorthFirstLiveMutationReadOnlyDiscoveryEvidence = {
  nativeContract: 'ZavorthFirstLiveMutationReadOnlyDiscoveryEvidence/v1';
  tokenStatus: 'present-redacted';
  commandArgTokenUsed: false;
  gatewayBind: 'loopback';
  gatewayPort: 18789;
  preListenerCount: 0;
  preProcessCount: 0;
  listenerObserved: true;
  listenerObservedAtMs: number;
  gatewayHelpExitCode: 0;
  gatewayCallHelpExitCode: 0;
  documentedGatewayCallMethods: string[];
  statusExitCode: number;
  probeExitCode: number;
  callStatusExitCode: number;
  callHealthExitCode: number;
  callSystemPresenceExitCode: number;
  firstCleanupListenerCount: number;
  firstCleanupProcessCount: number;
  finalCleanupListenerCount: 0;
  finalCleanupProcessCount: 0;
  safeTargetDecision: ZavorthFirstLiveMutationDiscoveryDecision;
  noSafeTargetReason: string;
  rawSecretSerialized: false;
};

export type ZavorthFirstLiveMutationCandidateClassification = {
  nativeContract: 'ZavorthFirstLiveMutationCandidateClassification/v1';
  targetKind: ZavorthFirstLiveMutationTargetKind;
  preferenceRank: 1 | 2 | 3 | 4;
  available: boolean;
  safe: boolean;
  reversible: boolean;
  ephemeral: boolean;
  sideEffectZero: boolean;
  risk: 'dangerous' | 'safe' | 'unknown';
  decision: 'blocked' | 'eligible' | 'no-safe-target';
  reason: string;
  sourceEvidenceOnly: true;
  sourceAuthorityGranted: false;
  rawSecretSerialized: false;
};

export type ZavorthFirstLiveMutationPreflight = {
  nativeContract: 'ZavorthFirstLiveMutationPreflight/v1';
  id: string;
  fixtureCase: ZavorthFirstLiveMutationFixtureCase;
  targetKind: ZavorthFirstLiveMutationTargetKind;
  actionKind: ZavorthMutableExternalActionKind;
  approvalGrantValid: boolean;
  policyRevalidated: true;
  policyRecheckPasses: boolean;
  idempotencyKey: string;
  idempotencyRevalidated: true;
  rollbackOrCompensationPlanAvailable: boolean;
  targetReversibilityChecked: true;
  cleanupRequired: boolean;
  cleanupConfirmed: boolean;
  governedExecutorBoundary: GovernedExecutorBoundary;
  sourceCapabilityEvidenceOnly: true;
  sourceAuthorityGranted: false;
  rawSecretSerialized: false;
};

export type ZavorthFirstLiveMutationExecutionReceipt = {
  nativeContract: 'ZavorthFirstLiveMutationExecutionReceipt/v1';
  id: string;
  preflightId: string;
  fixtureCase: ZavorthFirstLiveMutationFixtureCase;
  targetKind: ZavorthFirstLiveMutationTargetKind;
  actionKind: ZavorthMutableExternalActionKind;
  status: ZavorthFirstLiveMutationReceiptStatus;
  auditAuthority: 'zavorth-audit-receipt';
  redacted: true;
  liveReceipt: true;
  governedHarnessPathUsed: boolean;
  rollbackOrCleanupConfirmed: boolean;
  liveMutationActuallyPerformed: boolean;
  mutationActuallyPerformed: boolean;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  dangerousToolOrCommandExecuted: false;
  gatewayMutationActuallyCalled: boolean;
  sessionMutationActuallyPerformed: false;
  externalAdapterInvokedForMutation: boolean;
  sourceAuthorityGranted: false;
  sourceModuleCopied: false;
  nativeReplacementAuthorized: false;
  rawSecretSerialized: false;
};

export type ZavorthFirstLiveMutationMicroSliceRow = {
  nativeContract: 'ZavorthFirstLiveMutationMicroSliceRow/v1';
  id: string;
  fixtureCase: ZavorthFirstLiveMutationFixtureCase;
  targetKind: ZavorthFirstLiveMutationTargetKind;
  receiptStatus: ZavorthFirstLiveMutationReceiptStatus;
  preflightId: string;
  receiptId: string;
  liveMutationActuallyPerformed: boolean;
  zeroDangerousSideEffects: true;
};

export type ZavorthFirstLiveMutationMicroSliceGate = {
  firstLiveMutationMicroSliceCreated: true;
  safeLiveMutationTargetFound: boolean;
  approvalGrantRequired: true;
  policyRecheckRequired: true;
  idempotencyKeyRequired: true;
  rollbackOrCompensationPlanRequired: true;
  redactionRequired: true;
  cleanupRequired: true;
  liveMutationActuallyPerformed: boolean;
  mutationActuallyPerformed: boolean;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  dangerousToolOrCommandExecuted: false;
  gatewayMutationActuallyCalled: boolean;
  sessionMutationActuallyPerformed: false;
  externalAdapterInvokedForMutation: boolean;
  sourceAuthorityGranted: false;
  sourceModuleCopied: false;
  nativeReplacementAuthorized: false;
  rawSecretSerialized: false;
};

export type ZavorthFirstLiveMutationMicroSliceNormalization = {
  nativeContract: 'ZavorthFirstLiveMutationMicroSlice/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ZavorthFirstLiveMutationMicroSliceDecision;
  sourceHarnessDecision: ZavorthApprovedMutationExecutionHarnessNormalization['decision'];
  discoveryEvidence: ZavorthFirstLiveMutationReadOnlyDiscoveryEvidence;
  candidateClassifications: ZavorthFirstLiveMutationCandidateClassification[];
  preflights: ZavorthFirstLiveMutationPreflight[];
  receipts: ZavorthFirstLiveMutationExecutionReceipt[];
  rows: ZavorthFirstLiveMutationMicroSliceRow[];
  executionGate: ZavorthFirstLiveMutationMicroSliceGate;
  redaction: {
    rawSecretSerialized: false;
    receiptRedacted: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'future-live-mutation-target-selection';
};

export type ZavorthFirstLiveMutationMicroSliceOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  idPrefix: string;
  runtimeId: TRuntimeId;
  sourceHarness: ZavorthApprovedMutationExecutionHarnessNormalization;
  discoveryEvidence: ZavorthFirstLiveMutationReadOnlyDiscoveryEvidence;
  candidateClassifications: ZavorthFirstLiveMutationCandidateClassification[];
  records: ZavorthFirstLiveMutationSourceRecord[];
};

export function createFirstLiveMutationReadOnlyDiscoveryEvidence(): ZavorthFirstLiveMutationReadOnlyDiscoveryEvidence {
  return {
    nativeContract: 'ZavorthFirstLiveMutationReadOnlyDiscoveryEvidence/v1',
    tokenStatus: 'present-redacted',
    commandArgTokenUsed: false,
    gatewayBind: 'loopback',
    gatewayPort: 18789,
    preListenerCount: 0,
    preProcessCount: 0,
    listenerObserved: true,
    listenerObservedAtMs: 21000,
    gatewayHelpExitCode: 0,
    gatewayCallHelpExitCode: 0,
    documentedGatewayCallMethods: ['health', 'status', 'system-presence', 'cron.*'],
    statusExitCode: 0,
    probeExitCode: 1,
    callStatusExitCode: 1,
    callHealthExitCode: 1,
    callSystemPresenceExitCode: 1,
    firstCleanupListenerCount: 2,
    firstCleanupProcessCount: 1,
    finalCleanupListenerCount: 0,
    finalCleanupProcessCount: 0,
    safeTargetDecision: 'no-safe-live-mutation-target',
    noSafeTargetReason: 'Read-only discovery found no gateway no-op/ping mutation, no temporary diagnostic marker, and no ephemeral test setting with immediate rollback. cron.* was classified as scheduler mutation and blocked.',
    rawSecretSerialized: false,
  };
}

export function createFirstLiveMutationCandidateClassifications(): ZavorthFirstLiveMutationCandidateClassification[] {
  return [
    {
      nativeContract: 'ZavorthFirstLiveMutationCandidateClassification/v1',
      targetKind: 'gateway-noop-ping-mutation',
      preferenceRank: 1,
      available: false,
      safe: false,
      reversible: false,
      ephemeral: false,
      sideEffectZero: false,
      risk: 'unknown',
      decision: 'no-safe-target',
      reason: 'No documented no-op/ping mutation method was exposed by gateway help, status, probe, or read-only call evidence.',
      sourceEvidenceOnly: true,
      sourceAuthorityGranted: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthFirstLiveMutationCandidateClassification/v1',
      targetKind: 'temporary-diagnostic-marker',
      preferenceRank: 2,
      available: false,
      safe: false,
      reversible: false,
      ephemeral: false,
      sideEffectZero: false,
      risk: 'unknown',
      decision: 'no-safe-target',
      reason: 'No read-only evidence identified a temporary diagnostic marker API with immediate rollback.',
      sourceEvidenceOnly: true,
      sourceAuthorityGranted: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthFirstLiveMutationCandidateClassification/v1',
      targetKind: 'ephemeral-test-setting',
      preferenceRank: 3,
      available: false,
      safe: false,
      reversible: false,
      ephemeral: false,
      sideEffectZero: false,
      risk: 'unknown',
      decision: 'no-safe-target',
      reason: 'No workspace-temporary setting was exposed without config/state mutation risk.',
      sourceEvidenceOnly: true,
      sourceAuthorityGranted: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthFirstLiveMutationCandidateClassification/v1',
      targetKind: 'scheduler-cron-mutation',
      preferenceRank: 4,
      available: true,
      safe: false,
      reversible: false,
      ephemeral: false,
      sideEffectZero: false,
      risk: 'dangerous',
      decision: 'blocked',
      reason: 'gateway call help documents cron.* as a callable family, but scheduler mutation is not side-effect-zero and no rollback-safe target was proven.',
      sourceEvidenceOnly: true,
      sourceAuthorityGranted: false,
      rawSecretSerialized: false,
    },
  ];
}

export function createFirstLiveMutationMicroSliceGate(
  receipts: ZavorthFirstLiveMutationExecutionReceipt[],
): ZavorthFirstLiveMutationMicroSliceGate {
  const liveSuccess = receipts.some((receipt) => receipt.status === 'live-mutation-minimal-success');

  return {
    firstLiveMutationMicroSliceCreated: true,
    safeLiveMutationTargetFound: liveSuccess,
    approvalGrantRequired: true,
    policyRecheckRequired: true,
    idempotencyKeyRequired: true,
    rollbackOrCompensationPlanRequired: true,
    redactionRequired: true,
    cleanupRequired: true,
    liveMutationActuallyPerformed: liveSuccess,
    mutationActuallyPerformed: liveSuccess,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    dangerousToolOrCommandExecuted: false,
    gatewayMutationActuallyCalled: receipts.some((receipt) => receipt.gatewayMutationActuallyCalled),
    sessionMutationActuallyPerformed: false,
    externalAdapterInvokedForMutation: receipts.some((receipt) => receipt.externalAdapterInvokedForMutation),
    sourceAuthorityGranted: false,
    sourceModuleCopied: false,
    nativeReplacementAuthorized: false,
    rawSecretSerialized: false,
  };
}

function receiptStatusFor(record: ZavorthFirstLiveMutationSourceRecord): ZavorthFirstLiveMutationReceiptStatus {
  if (!record.approvalGrantValid) {
    return 'blocked-no-approval';
  }

  if (!record.policyRecheckPasses) {
    return 'policy-invalidated';
  }

  if (record.dangerousToolOrCommand) {
    return 'blocked-dangerous-action';
  }

  if (!record.targetKnown) {
    return 'no-safe-live-mutation-target';
  }

  if (!record.targetReversible || !record.rollbackOrCompensationPlanAvailable) {
    return 'blocked-nonreversible-target';
  }

  if (record.liveMutationAttempted && record.liveMutationSucceeded) {
    return 'live-mutation-minimal-success';
  }

  return 'no-safe-live-mutation-target';
}

function buildPreflight(
  idPrefix: string,
  record: ZavorthFirstLiveMutationSourceRecord,
  index: number,
): ZavorthFirstLiveMutationPreflight {
  return {
    nativeContract: 'ZavorthFirstLiveMutationPreflight/v1',
    id: `${idPrefix}:preflight-${index + 1}`,
    fixtureCase: record.fixtureCase,
    targetKind: record.targetKind,
    actionKind: record.actionKind,
    approvalGrantValid: record.approvalGrantValid,
    policyRevalidated: true,
    policyRecheckPasses: record.policyRecheckPasses,
    idempotencyKey: record.idempotencyKey,
    idempotencyRevalidated: true,
    rollbackOrCompensationPlanAvailable: record.rollbackOrCompensationPlanAvailable,
    targetReversibilityChecked: true,
    cleanupRequired: record.cleanupRequired,
    cleanupConfirmed: record.cleanupConfirmed,
    governedExecutorBoundary: GOVERNED_EXECUTOR_BOUNDARY,
    sourceCapabilityEvidenceOnly: true,
    sourceAuthorityGranted: false,
    rawSecretSerialized: false,
  };
}

function buildReceipt(
  idPrefix: string,
  record: ZavorthFirstLiveMutationSourceRecord,
  preflight: ZavorthFirstLiveMutationPreflight,
  index: number,
): ZavorthFirstLiveMutationExecutionReceipt {
  const status = receiptStatusFor(record);
  const liveSuccess = status === 'live-mutation-minimal-success';

  return {
    nativeContract: 'ZavorthFirstLiveMutationExecutionReceipt/v1',
    id: `${idPrefix}:receipt-${index + 1}`,
    preflightId: preflight.id,
    fixtureCase: record.fixtureCase,
    targetKind: record.targetKind,
    actionKind: record.actionKind,
    status,
    auditAuthority: 'zavorth-audit-receipt',
    redacted: true,
    liveReceipt: true,
    governedHarnessPathUsed: liveSuccess,
    rollbackOrCleanupConfirmed: record.cleanupConfirmed,
    liveMutationActuallyPerformed: liveSuccess,
    mutationActuallyPerformed: liveSuccess,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    dangerousToolOrCommandExecuted: false,
    gatewayMutationActuallyCalled: liveSuccess && record.targetKind === 'gateway-noop-ping-mutation',
    sessionMutationActuallyPerformed: false,
    externalAdapterInvokedForMutation: liveSuccess,
    sourceAuthorityGranted: false,
    sourceModuleCopied: false,
    nativeReplacementAuthorized: false,
    rawSecretSerialized: false,
  };
}

export function createFirstLiveMutationMicroSliceActualRecords(): ZavorthFirstLiveMutationSourceRecord[] {
  return [
    {
      fixtureCase: 'no-approval-live-mutation-blocked',
      targetKind: 'gateway-noop-ping-mutation',
      actionKind: 'gateway-mutation-method',
      discoveredReadOnly: true,
      approvalGrantValid: false,
      policyRecheckPasses: true,
      idempotencyKey: 'first-live-mutation:no-approval:1',
      rollbackOrCompensationPlanAvailable: true,
      cleanupRequired: true,
      cleanupConfirmed: true,
      targetKnown: true,
      targetReversible: true,
      targetEphemeral: true,
      targetSideEffectZero: true,
      dangerousToolOrCommand: false,
      liveMutationAttempted: false,
      liveMutationSucceeded: false,
      redacted: true,
    },
    {
      fixtureCase: 'policy-invalidated-live-mutation-blocked',
      targetKind: 'gateway-noop-ping-mutation',
      actionKind: 'gateway-mutation-method',
      discoveredReadOnly: true,
      approvalGrantValid: true,
      policyRecheckPasses: false,
      idempotencyKey: 'first-live-mutation:policy-invalidated:1',
      rollbackOrCompensationPlanAvailable: true,
      cleanupRequired: true,
      cleanupConfirmed: true,
      targetKnown: true,
      targetReversible: true,
      targetEphemeral: true,
      targetSideEffectZero: true,
      dangerousToolOrCommand: false,
      liveMutationAttempted: false,
      liveMutationSucceeded: false,
      redacted: true,
    },
    {
      fixtureCase: 'nonreversible-target-blocked',
      targetKind: 'scheduler-cron-mutation',
      actionKind: 'gateway-mutation-method',
      discoveredReadOnly: true,
      approvalGrantValid: true,
      policyRecheckPasses: true,
      idempotencyKey: 'first-live-mutation:nonreversible:1',
      rollbackOrCompensationPlanAvailable: false,
      cleanupRequired: true,
      cleanupConfirmed: true,
      targetKnown: true,
      targetReversible: false,
      targetEphemeral: false,
      targetSideEffectZero: false,
      dangerousToolOrCommand: false,
      liveMutationAttempted: false,
      liveMutationSucceeded: false,
      redacted: true,
    },
    {
      fixtureCase: 'unknown-target-no-safe-live-mutation-target',
      targetKind: 'unknown',
      actionKind: 'gateway-mutation-method',
      discoveredReadOnly: true,
      approvalGrantValid: true,
      policyRecheckPasses: true,
      idempotencyKey: 'first-live-mutation:no-safe-target:1',
      rollbackOrCompensationPlanAvailable: false,
      cleanupRequired: true,
      cleanupConfirmed: true,
      targetKnown: false,
      targetReversible: false,
      targetEphemeral: false,
      targetSideEffectZero: false,
      dangerousToolOrCommand: false,
      liveMutationAttempted: false,
      liveMutationSucceeded: false,
      redacted: true,
    },
    {
      fixtureCase: 'dangerous-command-tool-blocked',
      targetKind: 'unknown',
      actionKind: 'command-tool-execution',
      discoveredReadOnly: true,
      approvalGrantValid: true,
      policyRecheckPasses: true,
      idempotencyKey: 'first-live-mutation:dangerous-command-tool:1',
      rollbackOrCompensationPlanAvailable: false,
      cleanupRequired: true,
      cleanupConfirmed: true,
      targetKnown: true,
      targetReversible: false,
      targetEphemeral: false,
      targetSideEffectZero: false,
      dangerousToolOrCommand: true,
      liveMutationAttempted: false,
      liveMutationSucceeded: false,
      redacted: true,
    },
  ];
}

export function createFirstLiveMutationSafeTargetFixtureRecord(): ZavorthFirstLiveMutationSourceRecord {
  return {
    fixtureCase: 'safe-target-governed-harness-path',
    targetKind: 'gateway-noop-ping-mutation',
    actionKind: 'gateway-mutation-method',
    discoveredReadOnly: true,
    approvalGrantValid: true,
    policyRecheckPasses: true,
    idempotencyKey: 'first-live-mutation:safe-noop:1',
    rollbackOrCompensationPlanAvailable: true,
    cleanupRequired: true,
    cleanupConfirmed: true,
    targetKnown: true,
    targetReversible: true,
    targetEphemeral: true,
    targetSideEffectZero: true,
    dangerousToolOrCommand: false,
    liveMutationAttempted: true,
    liveMutationSucceeded: true,
    redacted: true,
  };
}

export function normalizeFirstLiveMutationMicroSlice<TRuntimeId extends string>(
  options: ZavorthFirstLiveMutationMicroSliceOptions<TRuntimeId>,
): ZavorthFirstLiveMutationMicroSliceNormalization {
  const preflights = options.records.map((record, index) => buildPreflight(options.idPrefix, record, index));
  const receipts = options.records.map((record, index) => buildReceipt(options.idPrefix, record, preflights[index], index));
  const rows = options.records.map((record, index): ZavorthFirstLiveMutationMicroSliceRow => ({
    nativeContract: 'ZavorthFirstLiveMutationMicroSliceRow/v1',
    id: `${options.idPrefix}:row-${index + 1}`,
    fixtureCase: record.fixtureCase,
    targetKind: record.targetKind,
    receiptStatus: receipts[index].status,
    preflightId: preflights[index].id,
    receiptId: receipts[index].id,
    liveMutationActuallyPerformed: receipts[index].liveMutationActuallyPerformed,
    zeroDangerousSideEffects: true,
  }));
  const executionGate = createFirstLiveMutationMicroSliceGate(receipts);
  const decision: ZavorthFirstLiveMutationMicroSliceDecision = executionGate.liveMutationActuallyPerformed
    ? 'first-live-mutation-micro-slice-ready'
    : 'no-safe-live-mutation-target';

  return {
    nativeContract: 'ZavorthFirstLiveMutationMicroSlice/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision,
    sourceHarnessDecision: options.sourceHarness.decision,
    discoveryEvidence: options.discoveryEvidence,
    candidateClassifications: options.candidateClassifications,
    preflights,
    receipts,
    rows,
    executionGate,
    redaction: {
      rawSecretSerialized: false,
      receiptRedacted: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'future-live-mutation-target-selection',
  };
}

export function normalizeFirstLiveMutationMicroSliceFixture(): ZavorthFirstLiveMutationMicroSliceNormalization {
  return normalizeFirstLiveMutationMicroSlice({
    generatedAt: RUNTIME_ADAPTER_FIRST_LIVE_MUTATION_MICRO_SLICE_NOW,
    runtimeId: RUNTIME_ADAPTER_FIRST_LIVE_MUTATION_MICRO_SLICE_RUNTIME_ID,
    idPrefix: 'runtime-adapter-first-live-mutation-micro-slice',
    sourceHarness: normalizeApprovedMutationExecutionHarnessFixture(),
    discoveryEvidence: createFirstLiveMutationReadOnlyDiscoveryEvidence(),
    candidateClassifications: createFirstLiveMutationCandidateClassifications(),
    records: createFirstLiveMutationMicroSliceActualRecords(),
  });
}
