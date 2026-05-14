export const ZAVORTH_WAVE4B2_MEDIUM_RISK_EXECUTABLE_CAPABILITY_SELECTION_NOW = '2026-04-30T18:00:00.000Z' as const;
export const ZAVORTH_WAVE4B2_MEDIUM_RISK_EXECUTABLE_CAPABILITY_SELECTION_RUNTIME_ID = 'zavorth-wave4b2-medium-risk-executable-capability-selection' as const;
export const ZAVORTH_WAVE4B2_TARGET_SESSION_CHANNEL_VALIDATION_EXECUTE_FLAG = 'ZAVORTH_WAVE4B2_TARGET_SESSION_CHANNEL_VALIDATION_EXECUTE' as const;

export type ZavorthWave4B2MediumRiskExecutableSelectionDecision =
  | 'blocked'
  | 'wave4b2-medium-risk-executable-selection-ready';

export type ZavorthWave4B2MediumRiskExecutableCandidateId =
  | 'channel-capability-refresh-action'
  | 'command-http-dry-run-envelope-validation'
  | 'message-send-dry-run-against-real-transport'
  | 'provider-dry-run-schema-validation'
  | 'scheduled-refresh-action-with-rollback'
  | 'session-threading-consistency-check'
  | 'target-session-channel-validation-action'
  | 'tool-dry-run-manifest-validation'
  | 'transport-readiness-check-action';

export type ZavorthWave4B2MediumRiskExecutableCandidateRisk = 'blocked' | 'high' | 'low' | 'medium';

export type ZavorthWave4B2MediumRiskExecutableCandidateClassification =
  | 'blocked-high-impact'
  | 'deferred-approval-required'
  | 'deferred-dry-run-only'
  | 'second-target-probable'
  | 'selected-first-target';

export type ZavorthWave4B2ExecutableSideEffectLevel =
  | 'zavorth-owned-metadata-validation'
  | 'external-mutation-blocked'
  | 'external-read-only-optional'
  | 'receipt-only'
  | 'scheduled-zavorth-owned-metadata-write';

export type ZavorthWave4B2PolicyApprovalRequirement = {
  nativeContract: 'ZavorthWave4B2PolicyApprovalRequirement/v1';
  policyPreflightRequired: true;
  approvalRequirement:
    | 'approval-required-before-any-external-read-or-commit'
    | 'blocked'
    | 'not-required-for-idempotent-metadata-validation';
  approvalEscalationRule: string;
  exactScopeRequired: true;
  ttlRequired: true;
  idempotencyKeyRequired: true;
  migratedSessionChannelTargetMetadataRequired: true;
};

export type ZavorthWave4B2ReceiptRollbackRequirement = {
  nativeContract: 'ZavorthWave4B2ReceiptRollbackRequirement/v1';
  receiptContract: 'ZavorthWave4B2MediumRiskExecutableActionReceipt/v1';
  auditReceiptRequired: true;
  rollbackRequirement:
    | 'backup-rollback-required-before-commit'
    | 'blocked'
    | 'no-op-validation-receipt';
  cleanupRequirement: 'controlled-test-cleanup-required' | 'not-applicable';
  compensationPlan: string;
  redactionRequired: true;
};

export type ZavorthWave4B2MediumRiskExecutableCandidate = {
  nativeContract: 'ZavorthWave4B2MediumRiskExecutableCandidate/v1';
  candidateId: ZavorthWave4B2MediumRiskExecutableCandidateId;
  label: string;
  risk: ZavorthWave4B2MediumRiskExecutableCandidateRisk;
  classification: ZavorthWave4B2MediumRiskExecutableCandidateClassification;
  rationale: string;
  sideEffectLevel: ZavorthWave4B2ExecutableSideEffectLevel;
  executionAllowedInFutureGate: boolean;
  idempotent: boolean;
  controllable: boolean;
  reversibleOrDryRun: boolean;
  usesMigratedSessionMetadata: boolean;
  usesMigratedChannelMetadata: boolean;
  usesMigratedTargetMetadata: boolean;
  usesZavorthOwnedRegistryOrStorage: boolean;
  reducesExternalExecutorDependency: boolean;
  runtimeExternalExecutorRequiredForNativeReadyPaths: false;
  sourceCapabilityIsEvidenceOnly: true;
  featureFlag: typeof ZAVORTH_WAVE4B2_TARGET_SESSION_CHANNEL_VALIDATION_EXECUTE_FLAG | 'future-explicit-gate-required';
  policyApproval: ZavorthWave4B2PolicyApprovalRequirement;
  receiptRollback: ZavorthWave4B2ReceiptRollbackRequirement;
  executionDefinedFor223: boolean;
  prohibitedExecution: string[];
  realMessageSendAllowed: false;
  providerRealExecutionAllowed: false;
  toolCommandRealExecutionAllowed: false;
  externalExecutorMutationAllowed: false;
  rawHistoryMigrationAllowed: false;
  rawSqliteMigrationAllowed: false;
  rawSecretSerialized: false;
  sourceModuleCopied: false;
  adapterRemovalGlobalAllowed: false;
};

export type ZavorthWave4B2MediumRiskExecutableSelectionGate = {
  wave4b2MediumRiskExecutableSelectionCreated: true;
  mediumRiskExecutionSelectionOnly: true;
  realMessageSendAllowed: false;
  providerRealExecutionAllowed: false;
  toolCommandRealExecutionAllowed: false;
  externalExecutorMutationAllowed: false;
  rawHistoryMigrationAllowed: false;
  rawSqliteMigrationAllowed: false;
  runtimeExternalExecutorRequiredForNativeReadyPaths: false;
  rawSecretSerialized: false;
  sourceModuleCopied: false;
  adapterRemovalGlobalAllowed: false;
};

export type ZavorthWave4B2MediumRiskExecutableSourceReadiness = {
  wave4bLowRiskExecutablesReady: true;
  wave4cSessionHistoryMetadataMigrationReady: true;
  actionGovernancePipelineReady: true;
  messageSendTransportBlockedRehearsalReady: true;
  realMessageTransportDiscoveryReady: true;
  nativeRegistriesReady: true;
  adapterDecommissionHardeningReady: true;
  metadataConfigMigrationMilestoneReady: true;
  migratedSessionChannelTargetMetadataReady: true;
  runtimeExternalExecutorRequiredForNativeReadyPaths: false;
  realMessageSendAttempted: false;
  providerRealExecutionAttempted: false;
  toolCommandRealExecutionAttempted: false;
  externalExecutorMutationAttempted: false;
  rawHistoryMigrationAttempted: false;
  rawSqliteMigrationAttempted: false;
  rawSecretSerialized: false;
  sourceModuleCopyAttempted: false;
  adapterRemovalAttempted: false;
  publicExternalExecutorIdentityExposed: false;
};

export type ZavorthWave4B2MediumRiskExecutableSelectionSummary = {
  nativeContract: 'ZavorthWave4B2MediumRiskExecutableSelectionSummary/v1';
  selectedFirstTarget: 'target-session-channel-validation-action';
  secondLikelyTarget: 'transport-readiness-check-action';
  nextGateCandidate: '223-wave-4b2-target-session-channel-validation-executable';
  featureFlagRequired: typeof ZAVORTH_WAVE4B2_TARGET_SESSION_CHANNEL_VALIDATION_EXECUTE_FLAG;
  executionPermittedIn223: string[];
  executionProhibitedIn223: string[];
  policyPreflightRequired: true;
  approvalRequirement: 'not-required-for-idempotent-metadata-validation';
  receiptContract: 'ZavorthWave4B2MediumRiskExecutableActionReceipt/v1';
  rollbackRequirement: 'no-op-validation-receipt';
  migratedSessionChannelTargetMetadataUsed: true;
  runtimeExternalExecutorRequiredForNativeReadyPaths: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4B2MediumRiskExecutableCapabilitySelectionNormalization = {
  nativeContract: 'ZavorthWave4B2MediumRiskExecutableCapabilitySelection/v1';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4B2_MEDIUM_RISK_EXECUTABLE_CAPABILITY_SELECTION_RUNTIME_ID;
  decision: ZavorthWave4B2MediumRiskExecutableSelectionDecision;
  status: 'blocked' | 'wave4b2-medium-risk-executable-selection-ready';
  sourceReadiness: ZavorthWave4B2MediumRiskExecutableSourceReadiness;
  candidates: ZavorthWave4B2MediumRiskExecutableCandidate[];
  selectionSummary: ZavorthWave4B2MediumRiskExecutableSelectionSummary;
  executionGate: ZavorthWave4B2MediumRiskExecutableSelectionGate;
  redaction: {
    rawSecretSerialized: false;
    rawMessageContentSerialized: false;
    sourceIdentityPublic: false;
    provenanceInternalOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: '223-wave-4b2-target-session-channel-validation-executable-by-explicit-follow-up-only';
};

export type ZavorthWave4B2MediumRiskExecutableCapabilitySelectionOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4B2_MEDIUM_RISK_EXECUTABLE_CAPABILITY_SELECTION_RUNTIME_ID;
  source: ZavorthWave4B2MediumRiskExecutableSourceReadiness;
};

function policyApprovalRequirement(
  approvalRequirement: ZavorthWave4B2PolicyApprovalRequirement['approvalRequirement'],
): ZavorthWave4B2PolicyApprovalRequirement {
  return {
    nativeContract: 'ZavorthWave4B2PolicyApprovalRequirement/v1',
    policyPreflightRequired: true,
    approvalRequirement,
    approvalEscalationRule: approvalRequirement === 'not-required-for-idempotent-metadata-validation'
      ? 'Escalate to approval-required if validation proposes send, provider/tool/command execution, external read, external mutation, metadata commit, raw history migration, or risk-class change.'
      : approvalRequirement === 'approval-required-before-any-external-read-or-commit'
        ? 'Require explicit Zavorth approval grant, exact target/session/channel scope, TTL, idempotency key, and policy recheck before any future external read or metadata commit.'
        : 'Candidate remains blocked; approval cannot grant execution in this gate.',
    exactScopeRequired: true,
    ttlRequired: true,
    idempotencyKeyRequired: true,
    migratedSessionChannelTargetMetadataRequired: true,
  };
}

function receiptRollbackRequirement(
  rollbackRequirement: ZavorthWave4B2ReceiptRollbackRequirement['rollbackRequirement'],
): ZavorthWave4B2ReceiptRollbackRequirement {
  return {
    nativeContract: 'ZavorthWave4B2ReceiptRollbackRequirement/v1',
    receiptContract: 'ZavorthWave4B2MediumRiskExecutableActionReceipt/v1',
    auditReceiptRequired: true,
    rollbackRequirement,
    cleanupRequirement: rollbackRequirement === 'backup-rollback-required-before-commit'
      ? 'controlled-test-cleanup-required'
      : 'not-applicable',
    compensationPlan: rollbackRequirement === 'no-op-validation-receipt'
      ? 'Validation emits receipt-only evidence; compensation is no-op plus receipt invalidation if a later gate rejects it.'
      : rollbackRequirement === 'backup-rollback-required-before-commit'
        ? 'Future stateful commits require backup/rollback manifests and cleanup receipts before any Zavorth-owned write.'
        : 'No executable compensation is allowed because the candidate remains blocked.',
    redactionRequired: true,
  };
}

function candidate(
  input: Omit<
    ZavorthWave4B2MediumRiskExecutableCandidate,
    | 'adapterRemovalGlobalAllowed'
    | 'nativeContract'
    | 'externalExecutorMutationAllowed'
    | 'providerRealExecutionAllowed'
    | 'rawHistoryMigrationAllowed'
    | 'rawSecretSerialized'
    | 'rawSqliteMigrationAllowed'
    | 'realMessageSendAllowed'
    | 'runtimeExternalExecutorRequiredForNativeReadyPaths'
    | 'sourceCapabilityIsEvidenceOnly'
    | 'sourceModuleCopied'
    | 'toolCommandRealExecutionAllowed'
  >,
): ZavorthWave4B2MediumRiskExecutableCandidate {
  return {
    nativeContract: 'ZavorthWave4B2MediumRiskExecutableCandidate/v1',
    ...input,
    runtimeExternalExecutorRequiredForNativeReadyPaths: false,
    sourceCapabilityIsEvidenceOnly: true,
    realMessageSendAllowed: false,
    providerRealExecutionAllowed: false,
    toolCommandRealExecutionAllowed: false,
    externalExecutorMutationAllowed: false,
    rawHistoryMigrationAllowed: false,
    rawSqliteMigrationAllowed: false,
    rawSecretSerialized: false,
    sourceModuleCopied: false,
    adapterRemovalGlobalAllowed: false,
  };
}

function candidates(): ZavorthWave4B2MediumRiskExecutableCandidate[] {
  return [
    candidate({
      candidateId: 'message-send-dry-run-against-real-transport',
      label: 'Message send dry-run against real transport',
      risk: 'high',
      classification: 'deferred-dry-run-only',
      rationale: 'Even a transport-adjacent dry-run is too close to real send until target/session/channel validation is executable and audited.',
      sideEffectLevel: 'external-mutation-blocked',
      executionAllowedInFutureGate: false,
      idempotent: false,
      controllable: true,
      reversibleOrDryRun: true,
      usesMigratedSessionMetadata: true,
      usesMigratedChannelMetadata: true,
      usesMigratedTargetMetadata: true,
      usesZavorthOwnedRegistryOrStorage: true,
      reducesExternalExecutorDependency: false,
      featureFlag: 'future-explicit-gate-required',
      policyApproval: policyApprovalRequirement('blocked'),
      receiptRollback: receiptRollbackRequirement('blocked'),
      executionDefinedFor223: false,
      prohibitedExecution: ['real message send', 'transport invocation', 'external mutation'],
    }),
    candidate({
      candidateId: 'target-session-channel-validation-action',
      label: 'Target/session/channel validation action',
      risk: 'medium',
      classification: 'selected-first-target',
      rationale: 'Validates migrated target/session/channel metadata before any transport action, uses only Zavorth-owned registries, and emits an audit receipt with no external side effect.',
      sideEffectLevel: 'zavorth-owned-metadata-validation',
      executionAllowedInFutureGate: true,
      idempotent: true,
      controllable: true,
      reversibleOrDryRun: true,
      usesMigratedSessionMetadata: true,
      usesMigratedChannelMetadata: true,
      usesMigratedTargetMetadata: true,
      usesZavorthOwnedRegistryOrStorage: true,
      reducesExternalExecutorDependency: true,
      featureFlag: ZAVORTH_WAVE4B2_TARGET_SESSION_CHANNEL_VALIDATION_EXECUTE_FLAG,
      policyApproval: policyApprovalRequirement('not-required-for-idempotent-metadata-validation'),
      receiptRollback: receiptRollbackRequirement('no-op-validation-receipt'),
      executionDefinedFor223: true,
      prohibitedExecution: ['real message send', 'provider execution', 'tool/command execution', 'ExternalExecutor mutation', 'raw history migration'],
    }),
    candidate({
      candidateId: 'transport-readiness-check-action',
      label: 'Transport readiness check action',
      risk: 'medium',
      classification: 'second-target-probable',
      rationale: 'Checks transport metadata readiness after target/session/channel validation; any external read remains approval-gated and optional.',
      sideEffectLevel: 'external-read-only-optional',
      executionAllowedInFutureGate: true,
      idempotent: true,
      controllable: true,
      reversibleOrDryRun: true,
      usesMigratedSessionMetadata: true,
      usesMigratedChannelMetadata: true,
      usesMigratedTargetMetadata: true,
      usesZavorthOwnedRegistryOrStorage: true,
      reducesExternalExecutorDependency: true,
      featureFlag: 'future-explicit-gate-required',
      policyApproval: policyApprovalRequirement('approval-required-before-any-external-read-or-commit'),
      receiptRollback: receiptRollbackRequirement('no-op-validation-receipt'),
      executionDefinedFor223: false,
      prohibitedExecution: ['real message send', 'transport mutation', 'provider execution', 'tool/command execution'],
    }),
    candidate({
      candidateId: 'provider-dry-run-schema-validation',
      label: 'Provider dry-run/schema validation',
      risk: 'medium',
      classification: 'deferred-approval-required',
      rationale: 'Can validate provider schemas later, but must remain behind approval because provider surfaces may imply cost, data egress, or execution semantics.',
      sideEffectLevel: 'receipt-only',
      executionAllowedInFutureGate: true,
      idempotent: true,
      controllable: true,
      reversibleOrDryRun: true,
      usesMigratedSessionMetadata: false,
      usesMigratedChannelMetadata: false,
      usesMigratedTargetMetadata: false,
      usesZavorthOwnedRegistryOrStorage: true,
      reducesExternalExecutorDependency: true,
      featureFlag: 'future-explicit-gate-required',
      policyApproval: policyApprovalRequirement('approval-required-before-any-external-read-or-commit'),
      receiptRollback: receiptRollbackRequirement('no-op-validation-receipt'),
      executionDefinedFor223: false,
      prohibitedExecution: ['real provider call', 'provider cost', 'tool/command execution'],
    }),
    candidate({
      candidateId: 'tool-dry-run-manifest-validation',
      label: 'Tool dry-run/manifest validation',
      risk: 'medium',
      classification: 'deferred-approval-required',
      rationale: 'Tool manifests can be validated later, but tool execution remains blocked and manifest authority cannot bypass policy.',
      sideEffectLevel: 'receipt-only',
      executionAllowedInFutureGate: true,
      idempotent: true,
      controllable: true,
      reversibleOrDryRun: true,
      usesMigratedSessionMetadata: false,
      usesMigratedChannelMetadata: false,
      usesMigratedTargetMetadata: false,
      usesZavorthOwnedRegistryOrStorage: true,
      reducesExternalExecutorDependency: true,
      featureFlag: 'future-explicit-gate-required',
      policyApproval: policyApprovalRequirement('approval-required-before-any-external-read-or-commit'),
      receiptRollback: receiptRollbackRequirement('no-op-validation-receipt'),
      executionDefinedFor223: false,
      prohibitedExecution: ['real tool execution', 'real command execution', 'ExternalExecutor mutation'],
    }),
    candidate({
      candidateId: 'command-http-dry-run-envelope-validation',
      label: 'Command/http dry-run envelope validation',
      risk: 'medium',
      classification: 'deferred-approval-required',
      rationale: 'Dry-run envelope validation is useful, but should follow target/session/channel validation and remain unable to dispatch handlers.',
      sideEffectLevel: 'receipt-only',
      executionAllowedInFutureGate: true,
      idempotent: true,
      controllable: true,
      reversibleOrDryRun: true,
      usesMigratedSessionMetadata: true,
      usesMigratedChannelMetadata: true,
      usesMigratedTargetMetadata: true,
      usesZavorthOwnedRegistryOrStorage: true,
      reducesExternalExecutorDependency: true,
      featureFlag: 'future-explicit-gate-required',
      policyApproval: policyApprovalRequirement('approval-required-before-any-external-read-or-commit'),
      receiptRollback: receiptRollbackRequirement('no-op-validation-receipt'),
      executionDefinedFor223: false,
      prohibitedExecution: ['handler dispatch', 'HTTP route registration', 'gateway mutation'],
    }),
    candidate({
      candidateId: 'scheduled-refresh-action-with-rollback',
      label: 'Scheduled refresh action with rollback',
      risk: 'medium',
      classification: 'deferred-approval-required',
      rationale: 'Scheduled refresh mutates Zavorth-owned registry metadata and needs explicit schedule policy, rollback, and feature flag gates.',
      sideEffectLevel: 'scheduled-zavorth-owned-metadata-write',
      executionAllowedInFutureGate: true,
      idempotent: true,
      controllable: true,
      reversibleOrDryRun: true,
      usesMigratedSessionMetadata: true,
      usesMigratedChannelMetadata: true,
      usesMigratedTargetMetadata: true,
      usesZavorthOwnedRegistryOrStorage: true,
      reducesExternalExecutorDependency: true,
      featureFlag: 'future-explicit-gate-required',
      policyApproval: policyApprovalRequirement('approval-required-before-any-external-read-or-commit'),
      receiptRollback: receiptRollbackRequirement('backup-rollback-required-before-commit'),
      executionDefinedFor223: false,
      prohibitedExecution: ['external mutation', 'raw history migration', 'adapter default lookup'],
    }),
    candidate({
      candidateId: 'channel-capability-refresh-action',
      label: 'Channel capability refresh action',
      risk: 'medium',
      classification: 'deferred-approval-required',
      rationale: 'Refreshes channel capability metadata, but must not become a default ExternalExecutor dependency or open a live channel in this selection.',
      sideEffectLevel: 'external-read-only-optional',
      executionAllowedInFutureGate: true,
      idempotent: true,
      controllable: true,
      reversibleOrDryRun: true,
      usesMigratedSessionMetadata: true,
      usesMigratedChannelMetadata: true,
      usesMigratedTargetMetadata: false,
      usesZavorthOwnedRegistryOrStorage: true,
      reducesExternalExecutorDependency: true,
      featureFlag: 'future-explicit-gate-required',
      policyApproval: policyApprovalRequirement('approval-required-before-any-external-read-or-commit'),
      receiptRollback: receiptRollbackRequirement('backup-rollback-required-before-commit'),
      executionDefinedFor223: false,
      prohibitedExecution: ['channel open', 'message send', 'provider/tool/command execution'],
    }),
    candidate({
      candidateId: 'session-threading-consistency-check',
      label: 'Session threading consistency check',
      risk: 'medium',
      classification: 'deferred-approval-required',
      rationale: 'Checks migrated session/thread linkage and should follow the broader target/session/channel validation executable if a narrower follow-up is still needed.',
      sideEffectLevel: 'zavorth-owned-metadata-validation',
      executionAllowedInFutureGate: true,
      idempotent: true,
      controllable: true,
      reversibleOrDryRun: true,
      usesMigratedSessionMetadata: true,
      usesMigratedChannelMetadata: false,
      usesMigratedTargetMetadata: true,
      usesZavorthOwnedRegistryOrStorage: true,
      reducesExternalExecutorDependency: true,
      featureFlag: 'future-explicit-gate-required',
      policyApproval: policyApprovalRequirement('not-required-for-idempotent-metadata-validation'),
      receiptRollback: receiptRollbackRequirement('no-op-validation-receipt'),
      executionDefinedFor223: false,
      prohibitedExecution: ['raw history migration', 'SQLite copy/write', 'message send'],
    }),
  ];
}

function executionGate(): ZavorthWave4B2MediumRiskExecutableSelectionGate {
  return {
    wave4b2MediumRiskExecutableSelectionCreated: true,
    mediumRiskExecutionSelectionOnly: true,
    realMessageSendAllowed: false,
    providerRealExecutionAllowed: false,
    toolCommandRealExecutionAllowed: false,
    externalExecutorMutationAllowed: false,
    rawHistoryMigrationAllowed: false,
    rawSqliteMigrationAllowed: false,
    runtimeExternalExecutorRequiredForNativeReadyPaths: false,
    rawSecretSerialized: false,
    sourceModuleCopied: false,
    adapterRemovalGlobalAllowed: false,
  };
}

function selectionSummary(): ZavorthWave4B2MediumRiskExecutableSelectionSummary {
  return {
    nativeContract: 'ZavorthWave4B2MediumRiskExecutableSelectionSummary/v1',
    selectedFirstTarget: 'target-session-channel-validation-action',
    secondLikelyTarget: 'transport-readiness-check-action',
    nextGateCandidate: '223-wave-4b2-target-session-channel-validation-executable',
    featureFlagRequired: ZAVORTH_WAVE4B2_TARGET_SESSION_CHANNEL_VALIDATION_EXECUTE_FLAG,
    executionPermittedIn223: [
      'validate migrated session metadata',
      'validate migrated channel/transport linkage',
      'validate target/session/thread readiness',
      'emit redacted audit receipt',
      'record no-op rollback/compensation metadata',
    ],
    executionProhibitedIn223: [
      'real message send',
      'real provider execution',
      'real tool/command execution',
      'ExternalExecutor mutation',
      'raw history or SQLite migration',
      'raw secret serialization',
      'source module copy',
      'global adapter removal',
    ],
    policyPreflightRequired: true,
    approvalRequirement: 'not-required-for-idempotent-metadata-validation',
    receiptContract: 'ZavorthWave4B2MediumRiskExecutableActionReceipt/v1',
    rollbackRequirement: 'no-op-validation-receipt',
    migratedSessionChannelTargetMetadataUsed: true,
    runtimeExternalExecutorRequiredForNativeReadyPaths: false,
    rawSecretSerialized: false,
  };
}

function sourceReady(source: ZavorthWave4B2MediumRiskExecutableSourceReadiness): boolean {
  return (
    source.wave4bLowRiskExecutablesReady &&
    source.wave4cSessionHistoryMetadataMigrationReady &&
    source.actionGovernancePipelineReady &&
    source.messageSendTransportBlockedRehearsalReady &&
    source.realMessageTransportDiscoveryReady &&
    source.nativeRegistriesReady &&
    source.adapterDecommissionHardeningReady &&
    source.metadataConfigMigrationMilestoneReady &&
    source.migratedSessionChannelTargetMetadataReady &&
    !source.runtimeExternalExecutorRequiredForNativeReadyPaths &&
    !source.realMessageSendAttempted &&
    !source.providerRealExecutionAttempted &&
    !source.toolCommandRealExecutionAttempted &&
    !source.externalExecutorMutationAttempted &&
    !source.rawHistoryMigrationAttempted &&
    !source.rawSqliteMigrationAttempted &&
    !source.rawSecretSerialized &&
    !source.sourceModuleCopyAttempted &&
    !source.adapterRemovalAttempted &&
    !source.publicExternalExecutorIdentityExposed
  );
}

export class ZavorthWave4B2MediumRiskExecutableCapabilitySelection {
  public constructor(public readonly normalization: ZavorthWave4B2MediumRiskExecutableCapabilitySelectionNormalization) {}

  public selectedTarget(): ZavorthWave4B2MediumRiskExecutableCandidate | undefined {
    return this.normalization.candidates.find((candidate) => candidate.classification === 'selected-first-target');
  }

  public secondLikelyTarget(): ZavorthWave4B2MediumRiskExecutableCandidate | undefined {
    return this.normalization.candidates.find((candidate) => candidate.classification === 'second-target-probable');
  }

  public blockedHighImpactCandidates(): ZavorthWave4B2MediumRiskExecutableCandidate[] {
    return this.normalization.candidates.filter((candidate) => candidate.classification === 'blocked-high-impact' || candidate.risk === 'high');
  }
}

export function createZavorthWave4B2MediumRiskExecutableCapabilitySelectionFixtureSource(
  overrides: Partial<ZavorthWave4B2MediumRiskExecutableSourceReadiness> = {},
): ZavorthWave4B2MediumRiskExecutableSourceReadiness {
  return {
    wave4bLowRiskExecutablesReady: true,
    wave4cSessionHistoryMetadataMigrationReady: true,
    actionGovernancePipelineReady: true,
    messageSendTransportBlockedRehearsalReady: true,
    realMessageTransportDiscoveryReady: true,
    nativeRegistriesReady: true,
    adapterDecommissionHardeningReady: true,
    metadataConfigMigrationMilestoneReady: true,
    migratedSessionChannelTargetMetadataReady: true,
    runtimeExternalExecutorRequiredForNativeReadyPaths: false,
    realMessageSendAttempted: false,
    providerRealExecutionAttempted: false,
    toolCommandRealExecutionAttempted: false,
    externalExecutorMutationAttempted: false,
    rawHistoryMigrationAttempted: false,
    rawSqliteMigrationAttempted: false,
    rawSecretSerialized: false,
    sourceModuleCopyAttempted: false,
    adapterRemovalAttempted: false,
    publicExternalExecutorIdentityExposed: false,
    ...overrides,
  };
}

export function normalizeZavorthWave4B2MediumRiskExecutableCapabilitySelection(
  options: ZavorthWave4B2MediumRiskExecutableCapabilitySelectionOptions,
): ZavorthWave4B2MediumRiskExecutableCapabilitySelectionNormalization {
  const rows = candidates();
  const summary = selectionSummary();
  const gate = executionGate();
  const selected = rows.find((row) => row.candidateId === summary.selectedFirstTarget);
  const second = rows.find((row) => row.candidateId === summary.secondLikelyTarget);
  const ready = sourceReady(options.source) &&
    rows.length === 9 &&
    selected?.classification === 'selected-first-target' &&
    selected.risk === 'medium' &&
    selected.executionDefinedFor223 &&
    selected.usesMigratedSessionMetadata &&
    selected.usesMigratedChannelMetadata &&
    selected.usesMigratedTargetMetadata &&
    selected.policyApproval.policyPreflightRequired &&
    second?.classification === 'second-target-probable' &&
    rows.every((row) => (
      !row.realMessageSendAllowed &&
      !row.providerRealExecutionAllowed &&
      !row.toolCommandRealExecutionAllowed &&
      !row.externalExecutorMutationAllowed &&
      !row.rawHistoryMigrationAllowed &&
      !row.rawSqliteMigrationAllowed
    ));

  return {
    nativeContract: 'ZavorthWave4B2MediumRiskExecutableCapabilitySelection/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'wave4b2-medium-risk-executable-selection-ready' : 'blocked',
    status: ready ? 'wave4b2-medium-risk-executable-selection-ready' : 'blocked',
    sourceReadiness: options.source,
    candidates: rows,
    selectionSummary: summary,
    executionGate: gate,
    redaction: {
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      sourceIdentityPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: '223-wave-4b2-target-session-channel-validation-executable-by-explicit-follow-up-only',
  };
}

export function normalizeZavorthWave4B2MediumRiskExecutableCapabilitySelectionFixture(
  overrides: Partial<ZavorthWave4B2MediumRiskExecutableSourceReadiness> = {},
): ZavorthWave4B2MediumRiskExecutableCapabilitySelectionNormalization {
  return normalizeZavorthWave4B2MediumRiskExecutableCapabilitySelection({
    generatedAt: ZAVORTH_WAVE4B2_MEDIUM_RISK_EXECUTABLE_CAPABILITY_SELECTION_NOW,
    runtimeId: ZAVORTH_WAVE4B2_MEDIUM_RISK_EXECUTABLE_CAPABILITY_SELECTION_RUNTIME_ID,
    source: createZavorthWave4B2MediumRiskExecutableCapabilitySelectionFixtureSource(overrides),
  });
}

export function createZavorthWave4B2MediumRiskExecutableCapabilitySelectionFixture(
  overrides: Partial<ZavorthWave4B2MediumRiskExecutableSourceReadiness> = {},
): ZavorthWave4B2MediumRiskExecutableCapabilitySelection {
  return new ZavorthWave4B2MediumRiskExecutableCapabilitySelection(
    normalizeZavorthWave4B2MediumRiskExecutableCapabilitySelectionFixture(overrides),
  );
}
