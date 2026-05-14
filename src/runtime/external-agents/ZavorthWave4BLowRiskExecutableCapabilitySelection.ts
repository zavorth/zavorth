export const ZAVORTH_WAVE4B_LOW_RISK_EXECUTABLE_CAPABILITY_SELECTION_NOW = '2026-04-30T09:00:00.000Z' as const;
export const ZAVORTH_WAVE4B_LOW_RISK_EXECUTABLE_CAPABILITY_SELECTION_RUNTIME_ID = 'zavorth-wave4b-low-risk-executable-capability-selection' as const;
export const ZAVORTH_WAVE4B_METADATA_VALIDATION_EXECUTE_FLAG = 'ZAVORTH_WAVE4B_METADATA_VALIDATION_EXECUTE' as const;

export type ZavorthWave4BLowRiskExecutableSelectionDecision =
  | 'blocked'
  | 'wave4b-low-risk-executable-selection-ready';

export type ZavorthWave4BLowRiskExecutableCandidateId =
  | 'capability-classification-reclassification'
  | 'controlled-refresh-reconciliation-commit'
  | 'message-send-dry-run-only'
  | 'metadata-validation-action'
  | 'native-registry-refresh-commit'
  | 'production-snapshot-verify-action'
  | 'provider-dry-run-only'
  | 'read-only-external-status-health-refresh';

export type ZavorthWave4BLowRiskExecutableCandidateRisk = 'blocked' | 'high' | 'low' | 'medium';

export type ZavorthWave4BLowRiskExecutableCandidateClassification =
  | 'blocked-high-impact'
  | 'deferred-dry-run-only'
  | 'deferred-external-executor-optional'
  | 'deferred-stateful-commit'
  | 'second-target-probable'
  | 'selected-first-target';

export type ZavorthWave4BExecutableSideEffectLevel =
  | 'zavorth-owned-metadata-write'
  | 'external-mutation-blocked'
  | 'external-read-only'
  | 'none'
  | 'receipt-only';

export type ZavorthWave4BPolicyApprovalRequirement = {
  nativeContract: 'ZavorthWave4BPolicyApprovalRequirement/v1';
  policyPreflightRequired: true;
  approvalRequirement:
    | 'approval-required-before-any-stateful-commit'
    | 'blocked'
    | 'not-required-for-idempotent-readonly-validation';
  approvalEscalationRule: string;
  exactScopeRequired: true;
  ttlRequired: true;
  idempotencyKeyRequired: true;
};

export type ZavorthWave4BReceiptRollbackRequirement = {
  nativeContract: 'ZavorthWave4BReceiptRollbackRequirement/v1';
  receiptContract: 'ZavorthWave4BLowRiskExecutableActionReceipt/v1';
  auditReceiptRequired: true;
  rollbackRequirement:
    | 'backup-rollback-required-before-commit'
    | 'blocked'
    | 'no-op-validation-receipt';
  compensationPlan: string;
  redactionRequired: true;
};

export type ZavorthWave4BLowRiskExecutableCandidate = {
  nativeContract: 'ZavorthWave4BLowRiskExecutableCandidate/v1';
  candidateId: ZavorthWave4BLowRiskExecutableCandidateId;
  label: string;
  risk: ZavorthWave4BLowRiskExecutableCandidateRisk;
  classification: ZavorthWave4BLowRiskExecutableCandidateClassification;
  rationale: string;
  sideEffectLevel: ZavorthWave4BExecutableSideEffectLevel;
  executionAllowedInFutureGate: boolean;
  idempotent: boolean;
  usesZavorthOwnedRegistryOrStorage: boolean;
  reducesExternalExecutorDependency: boolean;
  runtimeExternalExecutorRequiredForDefaultPath: false;
  sourceCapabilityIsEvidenceOnly: true;
  featureFlag: typeof ZAVORTH_WAVE4B_METADATA_VALIDATION_EXECUTE_FLAG | 'future-explicit-gate-required';
  policyApproval: ZavorthWave4BPolicyApprovalRequirement;
  receiptRollback: ZavorthWave4BReceiptRollbackRequirement;
  prohibitedExecution: string[];
  messageSendRealAllowed: false;
  providerExecutionRealAllowed: false;
  toolCommandExecutionRealAllowed: false;
  externalExecutorMutationAllowed: false;
  rawSecretSerialized: false;
  stateMigrated: false;
  sourceModuleCopied: false;
  adapterRemovalGlobalAllowed: false;
};

export type ZavorthWave4BLowRiskExecutableSelectionGate = {
  wave4bLowRiskExecutableSelectionCreated: true;
  highImpactExecutionBlocked: true;
  messageSendRealAllowed: false;
  providerExecutionRealAllowed: false;
  toolCommandExecutionRealAllowed: false;
  externalExecutorMutationAllowed: false;
  rawSecretSerialized: false;
  stateMigrated: false;
  sourceModuleCopied: false;
  adapterRemovalGlobalAllowed: false;
};

export type ZavorthWave4BLowRiskExecutableSourceReadiness = {
  actionGovernancePipelineReady: true;
  governedReadOnlyActionsReady: true;
  noSafeLiveMutationDecisionHonored: true;
  nativeRegistriesReady: true;
  wave3NativeAbsorptionReady: true;
  wave4aMetadataMigrationMilestoneReady: true;
  refreshCommitPackReady: true;
  defaultPathRequiresExternalExecutor: false;
  messageSendAttempted: false;
  providerExecutionAttempted: false;
  toolCommandExecutionAttempted: false;
  externalExecutorMutationAttempted: false;
  rawSecretSerialized: false;
  stateMigrationAttempted: false;
  sourceModuleCopyAttempted: false;
  adapterRemovalAttempted: false;
  publicExternalExecutorIdentityExposed: false;
};

export type ZavorthWave4BLowRiskExecutableSelectionSummary = {
  nativeContract: 'ZavorthWave4BLowRiskExecutableSelectionSummary/v1';
  selectedFirstTarget: 'metadata-validation-action';
  secondLikelyTarget: 'production-snapshot-verify-action';
  executionPermitted: string[];
  executionProhibited: string[];
  featureFlagRequired: typeof ZAVORTH_WAVE4B_METADATA_VALIDATION_EXECUTE_FLAG;
  nextGateCandidate: '214-wave-4b-first-controlled-metadata-validation-action';
  externalExecutorRuntimeRequiredForDefaultPath: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4BLowRiskExecutableCapabilitySelectionNormalization = {
  nativeContract: 'ZavorthWave4BLowRiskExecutableCapabilitySelection/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ZavorthWave4BLowRiskExecutableSelectionDecision;
  status: 'blocked' | 'wave4b-low-risk-executable-selection-ready';
  sourceReadiness: ZavorthWave4BLowRiskExecutableSourceReadiness;
  candidates: ZavorthWave4BLowRiskExecutableCandidate[];
  selectionSummary: ZavorthWave4BLowRiskExecutableSelectionSummary;
  executionGate: ZavorthWave4BLowRiskExecutableSelectionGate;
  redaction: {
    rawSecretSerialized: false;
    rawMessageContentSerialized: false;
    sourceIdentityPublic: false;
    provenanceInternalOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: '214-wave-4b-first-controlled-metadata-validation-action-by-explicit-follow-up-only';
};

export type ZavorthWave4BLowRiskExecutableCapabilitySelectionOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  runtimeId: TRuntimeId;
  source: ZavorthWave4BLowRiskExecutableSourceReadiness;
};

function policyApprovalRequirement(
  approvalRequirement: ZavorthWave4BPolicyApprovalRequirement['approvalRequirement'],
): ZavorthWave4BPolicyApprovalRequirement {
  return {
    nativeContract: 'ZavorthWave4BPolicyApprovalRequirement/v1',
    policyPreflightRequired: true,
    approvalRequirement,
    approvalEscalationRule: approvalRequirement === 'not-required-for-idempotent-readonly-validation'
      ? 'Escalate to approval-required if validation proposes write, repair, commit, external call, or risk-class change.'
      : 'Require explicit Zavorth approval grant, exact scope, TTL, idempotency key, and policy recheck before any future commit.',
    exactScopeRequired: true,
    ttlRequired: true,
    idempotencyKeyRequired: true,
  };
}

function receiptRollbackRequirement(
  rollbackRequirement: ZavorthWave4BReceiptRollbackRequirement['rollbackRequirement'],
): ZavorthWave4BReceiptRollbackRequirement {
  return {
    nativeContract: 'ZavorthWave4BReceiptRollbackRequirement/v1',
    receiptContract: 'ZavorthWave4BLowRiskExecutableActionReceipt/v1',
    auditReceiptRequired: true,
    rollbackRequirement,
    compensationPlan: rollbackRequirement === 'no-op-validation-receipt'
      ? 'Validation emits receipt-only evidence; compensation is no-op plus receipt invalidation if a later gate rejects it.'
      : rollbackRequirement === 'backup-rollback-required-before-commit'
        ? 'Future stateful commits require existing backup/rollback manifests from Wave 4A storage gates before write.'
        : 'No executable compensation is allowed because the candidate remains blocked.',
    redactionRequired: true,
  };
}

function candidate(
  input: Omit<
    ZavorthWave4BLowRiskExecutableCandidate,
    | 'adapterRemovalGlobalAllowed'
    | 'messageSendRealAllowed'
    | 'nativeContract'
    | 'externalExecutorMutationAllowed'
    | 'providerExecutionRealAllowed'
    | 'rawSecretSerialized'
    | 'runtimeExternalExecutorRequiredForDefaultPath'
    | 'sourceCapabilityIsEvidenceOnly'
    | 'sourceModuleCopied'
    | 'stateMigrated'
    | 'toolCommandExecutionRealAllowed'
  >,
): ZavorthWave4BLowRiskExecutableCandidate {
  return {
    nativeContract: 'ZavorthWave4BLowRiskExecutableCandidate/v1',
    ...input,
    runtimeExternalExecutorRequiredForDefaultPath: false,
    sourceCapabilityIsEvidenceOnly: true,
    messageSendRealAllowed: false,
    providerExecutionRealAllowed: false,
    toolCommandExecutionRealAllowed: false,
    externalExecutorMutationAllowed: false,
    rawSecretSerialized: false,
    stateMigrated: false,
    sourceModuleCopied: false,
    adapterRemovalGlobalAllowed: false,
  };
}

function candidates(): ZavorthWave4BLowRiskExecutableCandidate[] {
  return [
    candidate({
      candidateId: 'native-registry-refresh-commit',
      label: 'Native registry refresh commit',
      risk: 'medium',
      classification: 'deferred-stateful-commit',
      rationale: 'Commits Zavorth-owned registry updates, but mutates persisted metadata and therefore belongs after a validation-only action.',
      sideEffectLevel: 'zavorth-owned-metadata-write',
      executionAllowedInFutureGate: true,
      idempotent: true,
      usesZavorthOwnedRegistryOrStorage: true,
      reducesExternalExecutorDependency: true,
      featureFlag: 'future-explicit-gate-required',
      policyApproval: policyApprovalRequirement('approval-required-before-any-stateful-commit'),
      receiptRollback: receiptRollbackRequirement('backup-rollback-required-before-commit'),
      prohibitedExecution: ['external mutation', 'message send', 'provider execution', 'tool/command execution'],
    }),
    candidate({
      candidateId: 'capability-classification-reclassification',
      label: 'Capability classification/reclassification',
      risk: 'medium',
      classification: 'deferred-stateful-commit',
      rationale: 'Useful after validation, but classification changes can alter policy behavior and require approval before commit.',
      sideEffectLevel: 'zavorth-owned-metadata-write',
      executionAllowedInFutureGate: true,
      idempotent: true,
      usesZavorthOwnedRegistryOrStorage: true,
      reducesExternalExecutorDependency: true,
      featureFlag: 'future-explicit-gate-required',
      policyApproval: policyApprovalRequirement('approval-required-before-any-stateful-commit'),
      receiptRollback: receiptRollbackRequirement('backup-rollback-required-before-commit'),
      prohibitedExecution: ['external mutation', 'message send', 'provider execution', 'tool/command execution'],
    }),
    candidate({
      candidateId: 'metadata-validation-action',
      label: 'Metadata validation action',
      risk: 'low',
      classification: 'selected-first-target',
      rationale: 'Validates migrated/native registry metadata already stored by Zavorth, emits an audit receipt, and does not call ExternalExecutor or mutate external state.',
      sideEffectLevel: 'receipt-only',
      executionAllowedInFutureGate: true,
      idempotent: true,
      usesZavorthOwnedRegistryOrStorage: true,
      reducesExternalExecutorDependency: true,
      featureFlag: ZAVORTH_WAVE4B_METADATA_VALIDATION_EXECUTE_FLAG,
      policyApproval: policyApprovalRequirement('not-required-for-idempotent-readonly-validation'),
      receiptRollback: receiptRollbackRequirement('no-op-validation-receipt'),
      prohibitedExecution: [
        'message send',
        'provider execution',
        'tool/command execution',
        'ExternalExecutor mutation',
        'raw secret read',
        'state migration',
      ],
    }),
    candidate({
      candidateId: 'production-snapshot-verify-action',
      label: 'Production snapshot verify action',
      risk: 'low',
      classification: 'second-target-probable',
      rationale: 'Verifies existing Zavorth-owned production snapshots with checksum/redaction/idempotency and does not require ExternalExecutor live.',
      sideEffectLevel: 'none',
      executionAllowedInFutureGate: true,
      idempotent: true,
      usesZavorthOwnedRegistryOrStorage: true,
      reducesExternalExecutorDependency: true,
      featureFlag: 'future-explicit-gate-required',
      policyApproval: policyApprovalRequirement('not-required-for-idempotent-readonly-validation'),
      receiptRollback: receiptRollbackRequirement('no-op-validation-receipt'),
      prohibitedExecution: ['external mutation', 'message send', 'provider execution', 'tool/command execution'],
    }),
    candidate({
      candidateId: 'controlled-refresh-reconciliation-commit',
      label: 'Controlled refresh reconciliation commit',
      risk: 'medium',
      classification: 'deferred-stateful-commit',
      rationale: 'Already governed by Wave 3, but it commits reconciliation updates and should follow validation/verification.',
      sideEffectLevel: 'zavorth-owned-metadata-write',
      executionAllowedInFutureGate: true,
      idempotent: true,
      usesZavorthOwnedRegistryOrStorage: true,
      reducesExternalExecutorDependency: true,
      featureFlag: 'future-explicit-gate-required',
      policyApproval: policyApprovalRequirement('approval-required-before-any-stateful-commit'),
      receiptRollback: receiptRollbackRequirement('backup-rollback-required-before-commit'),
      prohibitedExecution: ['external mutation', 'message send', 'provider execution', 'tool/command execution'],
    }),
    candidate({
      candidateId: 'read-only-external-status-health-refresh',
      label: 'Read-only external status/health refresh',
      risk: 'medium',
      classification: 'deferred-external-executor-optional',
      rationale: 'Read-only but depends on optional ExternalExecutor live refresh, so it is not the first native executable target.',
      sideEffectLevel: 'external-read-only',
      executionAllowedInFutureGate: true,
      idempotent: true,
      usesZavorthOwnedRegistryOrStorage: false,
      reducesExternalExecutorDependency: false,
      featureFlag: 'future-explicit-gate-required',
      policyApproval: policyApprovalRequirement('approval-required-before-any-stateful-commit'),
      receiptRollback: receiptRollbackRequirement('no-op-validation-receipt'),
      prohibitedExecution: ['external mutation', 'message send', 'provider execution', 'tool/command execution'],
    }),
    candidate({
      candidateId: 'message-send-dry-run-only',
      label: 'Message send dry-run only',
      risk: 'high',
      classification: 'deferred-dry-run-only',
      rationale: 'Dry-run rehearsal can remain useful, but real message send is high-impact and remains blocked for Wave 4B selection.',
      sideEffectLevel: 'external-mutation-blocked',
      executionAllowedInFutureGate: false,
      idempotent: false,
      usesZavorthOwnedRegistryOrStorage: true,
      reducesExternalExecutorDependency: false,
      featureFlag: 'future-explicit-gate-required',
      policyApproval: policyApprovalRequirement('blocked'),
      receiptRollback: receiptRollbackRequirement('blocked'),
      prohibitedExecution: ['real message send', 'transport open', 'external mutation'],
    }),
    candidate({
      candidateId: 'provider-dry-run-only',
      label: 'Provider dry-run only',
      risk: 'high',
      classification: 'deferred-dry-run-only',
      rationale: 'Provider execution may incur cost, data egress, and safety risk; real provider execution remains blocked.',
      sideEffectLevel: 'external-mutation-blocked',
      executionAllowedInFutureGate: false,
      idempotent: false,
      usesZavorthOwnedRegistryOrStorage: true,
      reducesExternalExecutorDependency: false,
      featureFlag: 'future-explicit-gate-required',
      policyApproval: policyApprovalRequirement('blocked'),
      receiptRollback: receiptRollbackRequirement('blocked'),
      prohibitedExecution: ['real provider call', 'tool/command execution', 'external mutation'],
    }),
  ];
}

function executionGate(): ZavorthWave4BLowRiskExecutableSelectionGate {
  return {
    wave4bLowRiskExecutableSelectionCreated: true,
    highImpactExecutionBlocked: true,
    messageSendRealAllowed: false,
    providerExecutionRealAllowed: false,
    toolCommandExecutionRealAllowed: false,
    externalExecutorMutationAllowed: false,
    rawSecretSerialized: false,
    stateMigrated: false,
    sourceModuleCopied: false,
    adapterRemovalGlobalAllowed: false,
  };
}

function selectionSummary(): ZavorthWave4BLowRiskExecutableSelectionSummary {
  return {
    nativeContract: 'ZavorthWave4BLowRiskExecutableSelectionSummary/v1',
    selectedFirstTarget: 'metadata-validation-action',
    secondLikelyTarget: 'production-snapshot-verify-action',
    executionPermitted: [
      'validate Zavorth-owned migrated metadata',
      'validate native registry schema/checksum/idempotency/redaction metadata',
      'emit redacted audit receipt',
      'record no-op rollback/compensation metadata',
    ],
    executionProhibited: [
      'real message send',
      'real provider execution',
      'real tool/command execution',
      'ExternalExecutor mutation',
      'raw SQLite/session/history migration',
      'raw secret serialization',
      'source module copy',
      'global adapter removal',
    ],
    featureFlagRequired: ZAVORTH_WAVE4B_METADATA_VALIDATION_EXECUTE_FLAG,
    nextGateCandidate: '214-wave-4b-first-controlled-metadata-validation-action',
    externalExecutorRuntimeRequiredForDefaultPath: false,
    rawSecretSerialized: false,
  };
}

function sourceReady(source: ZavorthWave4BLowRiskExecutableSourceReadiness): boolean {
  return (
    source.actionGovernancePipelineReady &&
    source.governedReadOnlyActionsReady &&
    source.noSafeLiveMutationDecisionHonored &&
    source.nativeRegistriesReady &&
    source.wave3NativeAbsorptionReady &&
    source.wave4aMetadataMigrationMilestoneReady &&
    source.refreshCommitPackReady &&
    !source.defaultPathRequiresExternalExecutor &&
    !source.messageSendAttempted &&
    !source.providerExecutionAttempted &&
    !source.toolCommandExecutionAttempted &&
    !source.externalExecutorMutationAttempted &&
    !source.rawSecretSerialized &&
    !source.stateMigrationAttempted &&
    !source.sourceModuleCopyAttempted &&
    !source.adapterRemovalAttempted &&
    !source.publicExternalExecutorIdentityExposed
  );
}

export class ZavorthWave4BLowRiskExecutableCapabilitySelection {
  public constructor(public readonly normalization: ZavorthWave4BLowRiskExecutableCapabilitySelectionNormalization) {}

  public selectedTarget(): ZavorthWave4BLowRiskExecutableCandidate | undefined {
    return this.normalization.candidates.find((row) => row.classification === 'selected-first-target');
  }

  public secondLikelyTarget(): ZavorthWave4BLowRiskExecutableCandidate | undefined {
    return this.normalization.candidates.find((row) => row.classification === 'second-target-probable');
  }

  public highImpactBlockedCandidates(): ZavorthWave4BLowRiskExecutableCandidate[] {
    return this.normalization.candidates.filter((row) => row.risk === 'high' || row.classification === 'blocked-high-impact');
  }
}

export function createZavorthWave4BLowRiskExecutableCapabilitySelectionFixtureSource(
  overrides: Partial<ZavorthWave4BLowRiskExecutableSourceReadiness> = {},
): ZavorthWave4BLowRiskExecutableSourceReadiness {
  return {
    actionGovernancePipelineReady: true,
    governedReadOnlyActionsReady: true,
    noSafeLiveMutationDecisionHonored: true,
    nativeRegistriesReady: true,
    wave3NativeAbsorptionReady: true,
    wave4aMetadataMigrationMilestoneReady: true,
    refreshCommitPackReady: true,
    defaultPathRequiresExternalExecutor: false,
    messageSendAttempted: false,
    providerExecutionAttempted: false,
    toolCommandExecutionAttempted: false,
    externalExecutorMutationAttempted: false,
    rawSecretSerialized: false,
    stateMigrationAttempted: false,
    sourceModuleCopyAttempted: false,
    adapterRemovalAttempted: false,
    publicExternalExecutorIdentityExposed: false,
    ...overrides,
  };
}

export function normalizeZavorthWave4BLowRiskExecutableCapabilitySelection<TRuntimeId extends string>(
  options: ZavorthWave4BLowRiskExecutableCapabilitySelectionOptions<TRuntimeId>,
): ZavorthWave4BLowRiskExecutableCapabilitySelectionNormalization {
  const normalizedCandidates = candidates();
  const selected = normalizedCandidates.find((row) => row.classification === 'selected-first-target');
  const second = normalizedCandidates.find((row) => row.classification === 'second-target-probable');
  const ready = sourceReady(options.source) &&
    selected?.candidateId === 'metadata-validation-action' &&
    selected.risk === 'low' &&
    selected.idempotent &&
    selected.executionAllowedInFutureGate &&
    second?.candidateId === 'production-snapshot-verify-action' &&
    normalizedCandidates.every((row) => !row.messageSendRealAllowed &&
      !row.providerExecutionRealAllowed &&
      !row.toolCommandExecutionRealAllowed &&
      !row.externalExecutorMutationAllowed &&
      !row.rawSecretSerialized &&
      !row.stateMigrated &&
      !row.sourceModuleCopied &&
      !row.adapterRemovalGlobalAllowed);

  return {
    nativeContract: 'ZavorthWave4BLowRiskExecutableCapabilitySelection/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'wave4b-low-risk-executable-selection-ready' : 'blocked',
    status: ready ? 'wave4b-low-risk-executable-selection-ready' : 'blocked',
    sourceReadiness: options.source,
    candidates: normalizedCandidates,
    selectionSummary: selectionSummary(),
    executionGate: executionGate(),
    redaction: {
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      sourceIdentityPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: '214-wave-4b-first-controlled-metadata-validation-action-by-explicit-follow-up-only',
  };
}

export function normalizeZavorthWave4BLowRiskExecutableCapabilitySelectionFixture(
  overrides: Partial<ZavorthWave4BLowRiskExecutableSourceReadiness> = {},
): ZavorthWave4BLowRiskExecutableCapabilitySelectionNormalization {
  return normalizeZavorthWave4BLowRiskExecutableCapabilitySelection({
    generatedAt: ZAVORTH_WAVE4B_LOW_RISK_EXECUTABLE_CAPABILITY_SELECTION_NOW,
    runtimeId: ZAVORTH_WAVE4B_LOW_RISK_EXECUTABLE_CAPABILITY_SELECTION_RUNTIME_ID,
    source: createZavorthWave4BLowRiskExecutableCapabilitySelectionFixtureSource(overrides),
  });
}

export function createZavorthWave4BLowRiskExecutableCapabilitySelectionFixture(
  overrides: Partial<ZavorthWave4BLowRiskExecutableSourceReadiness> = {},
): ZavorthWave4BLowRiskExecutableCapabilitySelection {
  return new ZavorthWave4BLowRiskExecutableCapabilitySelection(
    normalizeZavorthWave4BLowRiskExecutableCapabilitySelectionFixture(overrides),
  );
}
