export const ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTABLE_SELECTION_NOW = '2026-05-01T02:00:00.000Z' as const;
export const ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTABLE_SELECTION_RUNTIME_ID = 'zavorth-wave4b3-message-send-dry-run-executable-selection' as const;
export const ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTE_FLAG = 'ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTE' as const;

export type ZavorthWave4B3MessageSendDryRunSelectionDecision =
  | 'blocked'
  | 'wave4b3-message-send-dry-run-executable-selection-ready';

export type ZavorthWave4B3MessageSendDryRunCandidateId =
  | 'command-envelope-build-dry-run'
  | 'message-send-dry-run-action'
  | 'provider-prompt-build-dry-run'
  | 'reply-context-assembly-dry-run'
  | 'transport-target-resolution-dry-run';

export type ZavorthWave4B3MessageSendDryRunCandidateRisk = 'blocked' | 'dry-run-medium' | 'medium-high-dry-run';

export type ZavorthWave4B3MessageSendDryRunCandidateClassification =
  | 'blocked-until-provider-or-command-dry-run-gate'
  | 'deferred-dry-run'
  | 'selected-first-target'
  | 'second-target-probable';

export type ZavorthWave4B3MessageSendDryRunSideEffectLevel =
  | 'dry-run-envelope-only'
  | 'dry-run-message-plan-only'
  | 'dry-run-provider-prompt-only'
  | 'dry-run-reply-context-only'
  | 'dry-run-target-resolution-only';

export type ZavorthWave4B3MessageSendDryRunPolicyApprovalRequirement = {
  nativeContract: 'ZavorthWave4B3MessageSendDryRunPolicyApprovalRequirement/v1';
  policyPreflightRequired: true;
  policyRecheckRequired: true;
  approvalRequirement: 'approval-required-for-any-future-live-send' | 'blocked' | 'not-required-for-dry-run-only';
  approvalEscalationRule: string;
  exactTargetSessionChannelScopeRequired: true;
  ttlRequired: true;
  idempotencyKeyRequired: true;
  migratedSessionChannelTransportMetadataRequired: true;
  redactedDerivedContentRequired: true;
};

export type ZavorthWave4B3MessageSendDryRunReceiptRollbackRequirement = {
  nativeContract: 'ZavorthWave4B3MessageSendDryRunReceiptRollbackRequirement/v1';
  receiptContract: 'ZavorthWave4B3MessageSendDryRunActionReceipt/v1';
  auditReceiptRequired: true;
  rollbackRequirement: 'dry-run-no-op-receipt' | 'not-executable-in-231';
  cleanupRequirement: 'controlled-test-cleanup-required' | 'not-applicable';
  compensationPlan: string;
  redactionRequired: true;
};

export type ZavorthWave4B3MessageSendDryRunCandidate = {
  nativeContract: 'ZavorthWave4B3MessageSendDryRunCandidate/v1';
  candidateId: ZavorthWave4B3MessageSendDryRunCandidateId;
  label: string;
  risk: ZavorthWave4B3MessageSendDryRunCandidateRisk;
  classification: ZavorthWave4B3MessageSendDryRunCandidateClassification;
  rationale: string;
  sideEffectLevel: ZavorthWave4B3MessageSendDryRunSideEffectLevel;
  executionAllowedIn231: boolean;
  idempotent: boolean;
  controllable: boolean;
  dryRunOnly: true;
  usesMigratedSessionMetadata: boolean;
  usesMigratedChannelTransportMetadata: boolean;
  usesRedactedDerivedContent: boolean;
  usesRawContent: false;
  usesZavorthOwnedRegistryOrStorage: boolean;
  preparesFutureRealSend: boolean;
  runtimeExternalExecutorRequiredForNativeReadyPaths: false;
  sourceCapabilityIsEvidenceOnly: true;
  featureFlag: typeof ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTE_FLAG | 'future-explicit-gate-required';
  policyApproval: ZavorthWave4B3MessageSendDryRunPolicyApprovalRequirement;
  receiptRollback: ZavorthWave4B3MessageSendDryRunReceiptRollbackRequirement;
  executionDefinedFor231: boolean;
  prohibitedExecution: string[];
  realMessageSendAllowed: false;
  providerRealExecutionAllowed: false;
  toolCommandRealExecutionAllowed: false;
  externalExecutorMutationAllowed: false;
  rawContentUsageAllowed: false;
  rawSecretSerialized: false;
  sourceModuleCopied: false;
  adapterRemovalGlobalAllowed: false;
};

export type ZavorthWave4B3MessageSendDryRunSelectionGate = {
  wave4b3DryRunExecutableSelectionCreated: true;
  realMessageSendAllowed: false;
  providerRealExecutionAllowed: false;
  toolCommandRealExecutionAllowed: false;
  externalExecutorMutationAllowed: false;
  rawContentUsageAllowed: false;
  runtimeExternalExecutorRequiredForNativeReadyPaths: false;
  rawSecretSerialized: false;
  sourceModuleCopied: false;
  adapterRemovalGlobalAllowed: false;
};

export type ZavorthWave4B3MessageSendDryRunSourceReadiness = {
  messageSendTransportBlockedRehearsalReady: true;
  realMessageTransportDiscoveryReady: true;
  wave4b2MediumRiskExecutablesReady: true;
  wave4c2RedactedContentMigrationReady: true;
  actionGovernancePipelineReady: true;
  integrationTransportRegistryReady: true;
  sessionHistoryRegistryReady: true;
  migratedSessionChannelTransportMetadataReady: true;
  redactedDerivedContentReady: true;
  runtimeExternalExecutorRequiredForNativeReadyPaths: false;
  realMessageSendAttempted: false;
  providerRealExecutionAttempted: false;
  toolCommandRealExecutionAttempted: false;
  externalExecutorMutationAttempted: false;
  rawContentUsageAttempted: false;
  rawSecretSerialized: false;
  sourceModuleCopyAttempted: false;
  adapterRemovalAttempted: false;
  publicExternalExecutorIdentityExposed: false;
};

export type ZavorthWave4B3MessageSendDryRunSelectionSummary = {
  nativeContract: 'ZavorthWave4B3MessageSendDryRunSelectionSummary/v1';
  selectedFirstTarget: 'message-send-dry-run-action';
  secondLikelyTarget: 'transport-target-resolution-dry-run';
  nextGateCandidate: '231-wave-4b3-message-send-dry-run-executable';
  featureFlagRequired: typeof ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTE_FLAG;
  executionPermittedIn231: string[];
  executionProhibitedIn231: string[];
  policyPreflightRequired: true;
  policyRecheckRequired: true;
  approvalRequirement: 'not-required-for-dry-run-only';
  receiptContract: 'ZavorthWave4B3MessageSendDryRunActionReceipt/v1';
  rollbackRequirement: 'dry-run-no-op-receipt';
  migratedSessionChannelTransportMetadataUsed: true;
  redactedDerivedContentUsed: true;
  rawContentUsageAllowed: false;
  runtimeExternalExecutorRequiredForNativeReadyPaths: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4B3MessageSendDryRunExecutableSelectionNormalization = {
  nativeContract: 'ZavorthWave4B3MessageSendDryRunExecutableSelection/v1';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTABLE_SELECTION_RUNTIME_ID;
  decision: ZavorthWave4B3MessageSendDryRunSelectionDecision;
  status: 'blocked' | 'wave4b3-message-send-dry-run-executable-selection-ready';
  sourceReadiness: ZavorthWave4B3MessageSendDryRunSourceReadiness;
  candidates: ZavorthWave4B3MessageSendDryRunCandidate[];
  selectionSummary: ZavorthWave4B3MessageSendDryRunSelectionSummary;
  executionGate: ZavorthWave4B3MessageSendDryRunSelectionGate;
  redaction: {
    rawSecretSerialized: false;
    rawMessageContentSerialized: false;
    sourceIdentityPublic: false;
    provenanceInternalOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: '231-wave-4b3-message-send-dry-run-executable-by-explicit-follow-up-only';
};

export type ZavorthWave4B3MessageSendDryRunExecutableSelectionOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTABLE_SELECTION_RUNTIME_ID;
  source: ZavorthWave4B3MessageSendDryRunSourceReadiness;
};

function policyApprovalRequirement(
  approvalRequirement: ZavorthWave4B3MessageSendDryRunPolicyApprovalRequirement['approvalRequirement'],
): ZavorthWave4B3MessageSendDryRunPolicyApprovalRequirement {
  return {
    nativeContract: 'ZavorthWave4B3MessageSendDryRunPolicyApprovalRequirement/v1',
    policyPreflightRequired: true,
    policyRecheckRequired: true,
    approvalRequirement,
    approvalEscalationRule: approvalRequirement === 'not-required-for-dry-run-only'
      ? 'Escalate to approval-required if the plan attempts live send, provider/tool/command execution, ExternalExecutor mutation, raw content access, transport open, or state migration.'
      : approvalRequirement === 'approval-required-for-any-future-live-send'
        ? 'Future live send requires explicit Zavorth approval grant, exact target/session/channel scope, TTL, idempotency key, redaction, and policy recheck.'
        : 'Candidate remains blocked; approval cannot grant execution in 231.',
    exactTargetSessionChannelScopeRequired: true,
    ttlRequired: true,
    idempotencyKeyRequired: true,
    migratedSessionChannelTransportMetadataRequired: true,
    redactedDerivedContentRequired: true,
  };
}

function receiptRollbackRequirement(
  rollbackRequirement: ZavorthWave4B3MessageSendDryRunReceiptRollbackRequirement['rollbackRequirement'],
): ZavorthWave4B3MessageSendDryRunReceiptRollbackRequirement {
  return {
    nativeContract: 'ZavorthWave4B3MessageSendDryRunReceiptRollbackRequirement/v1',
    receiptContract: 'ZavorthWave4B3MessageSendDryRunActionReceipt/v1',
    auditReceiptRequired: true,
    rollbackRequirement,
    cleanupRequirement: rollbackRequirement === 'dry-run-no-op-receipt'
      ? 'controlled-test-cleanup-required'
      : 'not-applicable',
    compensationPlan: rollbackRequirement === 'dry-run-no-op-receipt'
      ? 'Dry-run emits a redacted receipt only; compensation is no-op plus receipt invalidation if a future policy gate rejects the plan.'
      : 'No executable compensation is allowed because the candidate is not executable in 231.',
    redactionRequired: true,
  };
}

function candidate(
  input: Omit<
    ZavorthWave4B3MessageSendDryRunCandidate,
    | 'adapterRemovalGlobalAllowed'
    | 'dryRunOnly'
    | 'nativeContract'
    | 'externalExecutorMutationAllowed'
    | 'providerRealExecutionAllowed'
    | 'rawContentUsageAllowed'
    | 'rawSecretSerialized'
    | 'realMessageSendAllowed'
    | 'runtimeExternalExecutorRequiredForNativeReadyPaths'
    | 'sourceCapabilityIsEvidenceOnly'
    | 'sourceModuleCopied'
    | 'toolCommandRealExecutionAllowed'
    | 'usesRawContent'
  >,
): ZavorthWave4B3MessageSendDryRunCandidate {
  return {
    nativeContract: 'ZavorthWave4B3MessageSendDryRunCandidate/v1',
    ...input,
    dryRunOnly: true,
    usesRawContent: false,
    runtimeExternalExecutorRequiredForNativeReadyPaths: false,
    sourceCapabilityIsEvidenceOnly: true,
    realMessageSendAllowed: false,
    providerRealExecutionAllowed: false,
    toolCommandRealExecutionAllowed: false,
    externalExecutorMutationAllowed: false,
    rawContentUsageAllowed: false,
    rawSecretSerialized: false,
    sourceModuleCopied: false,
    adapterRemovalGlobalAllowed: false,
  };
}

function candidates(): ZavorthWave4B3MessageSendDryRunCandidate[] {
  return [
    candidate({
      candidateId: 'message-send-dry-run-action',
      label: 'Message send dry-run action',
      risk: 'dry-run-medium',
      classification: 'selected-first-target',
      rationale: 'Builds the Zavorth-owned send plan and receipt from migrated session/channel/transport metadata and redacted/derived content without opening transport or sending a message.',
      sideEffectLevel: 'dry-run-message-plan-only',
      executionAllowedIn231: true,
      idempotent: true,
      controllable: true,
      usesMigratedSessionMetadata: true,
      usesMigratedChannelTransportMetadata: true,
      usesRedactedDerivedContent: true,
      usesZavorthOwnedRegistryOrStorage: true,
      preparesFutureRealSend: true,
      featureFlag: ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTE_FLAG,
      policyApproval: policyApprovalRequirement('not-required-for-dry-run-only'),
      receiptRollback: receiptRollbackRequirement('dry-run-no-op-receipt'),
      executionDefinedFor231: true,
      prohibitedExecution: [
        'real message send',
        'transport open',
        'provider execution',
        'tool/command execution',
        'ExternalExecutor mutation',
        'raw content access',
      ],
    }),
    candidate({
      candidateId: 'transport-target-resolution-dry-run',
      label: 'Transport target resolution dry-run',
      risk: 'dry-run-medium',
      classification: 'second-target-probable',
      rationale: 'Resolves target/session/channel/transport metadata as a narrower follow-up, still without opening real transport.',
      sideEffectLevel: 'dry-run-target-resolution-only',
      executionAllowedIn231: false,
      idempotent: true,
      controllable: true,
      usesMigratedSessionMetadata: true,
      usesMigratedChannelTransportMetadata: true,
      usesRedactedDerivedContent: false,
      usesZavorthOwnedRegistryOrStorage: true,
      preparesFutureRealSend: true,
      featureFlag: 'future-explicit-gate-required',
      policyApproval: policyApprovalRequirement('not-required-for-dry-run-only'),
      receiptRollback: receiptRollbackRequirement('dry-run-no-op-receipt'),
      executionDefinedFor231: false,
      prohibitedExecution: ['real message send', 'transport open', 'ExternalExecutor mutation', 'raw content access'],
    }),
    candidate({
      candidateId: 'reply-context-assembly-dry-run',
      label: 'Reply context assembly dry-run',
      risk: 'dry-run-medium',
      classification: 'deferred-dry-run',
      rationale: 'Assembles a reply context from redacted/derived content, but should follow the message-send dry-run receipt shape.',
      sideEffectLevel: 'dry-run-reply-context-only',
      executionAllowedIn231: false,
      idempotent: true,
      controllable: true,
      usesMigratedSessionMetadata: true,
      usesMigratedChannelTransportMetadata: true,
      usesRedactedDerivedContent: true,
      usesZavorthOwnedRegistryOrStorage: true,
      preparesFutureRealSend: true,
      featureFlag: 'future-explicit-gate-required',
      policyApproval: policyApprovalRequirement('not-required-for-dry-run-only'),
      receiptRollback: receiptRollbackRequirement('dry-run-no-op-receipt'),
      executionDefinedFor231: false,
      prohibitedExecution: ['raw content access', 'provider execution', 'real message send'],
    }),
    candidate({
      candidateId: 'provider-prompt-build-dry-run',
      label: 'Provider prompt build dry-run',
      risk: 'medium-high-dry-run',
      classification: 'blocked-until-provider-or-command-dry-run-gate',
      rationale: 'Prompt construction can imply provider execution semantics and must wait for a provider-specific dry-run envelope gate.',
      sideEffectLevel: 'dry-run-provider-prompt-only',
      executionAllowedIn231: false,
      idempotent: true,
      controllable: true,
      usesMigratedSessionMetadata: true,
      usesMigratedChannelTransportMetadata: false,
      usesRedactedDerivedContent: true,
      usesZavorthOwnedRegistryOrStorage: true,
      preparesFutureRealSend: false,
      featureFlag: 'future-explicit-gate-required',
      policyApproval: policyApprovalRequirement('blocked'),
      receiptRollback: receiptRollbackRequirement('not-executable-in-231'),
      executionDefinedFor231: false,
      prohibitedExecution: ['provider prompt build for live call', 'provider execution', 'raw content access'],
    }),
    candidate({
      candidateId: 'command-envelope-build-dry-run',
      label: 'Command envelope build dry-run',
      risk: 'medium-high-dry-run',
      classification: 'blocked-until-provider-or-command-dry-run-gate',
      rationale: 'Command envelope construction is too close to tool/command dispatch and must wait for a command-specific dry-run gate.',
      sideEffectLevel: 'dry-run-envelope-only',
      executionAllowedIn231: false,
      idempotent: true,
      controllable: true,
      usesMigratedSessionMetadata: true,
      usesMigratedChannelTransportMetadata: false,
      usesRedactedDerivedContent: true,
      usesZavorthOwnedRegistryOrStorage: true,
      preparesFutureRealSend: false,
      featureFlag: 'future-explicit-gate-required',
      policyApproval: policyApprovalRequirement('blocked'),
      receiptRollback: receiptRollbackRequirement('not-executable-in-231'),
      executionDefinedFor231: false,
      prohibitedExecution: ['command dispatch', 'tool execution', 'ExternalExecutor mutation', 'raw content access'],
    }),
  ];
}

function executionGate(): ZavorthWave4B3MessageSendDryRunSelectionGate {
  return {
    wave4b3DryRunExecutableSelectionCreated: true,
    realMessageSendAllowed: false,
    providerRealExecutionAllowed: false,
    toolCommandRealExecutionAllowed: false,
    externalExecutorMutationAllowed: false,
    rawContentUsageAllowed: false,
    runtimeExternalExecutorRequiredForNativeReadyPaths: false,
    rawSecretSerialized: false,
    sourceModuleCopied: false,
    adapterRemovalGlobalAllowed: false,
  };
}

function selectionSummary(): ZavorthWave4B3MessageSendDryRunSelectionSummary {
  return {
    nativeContract: 'ZavorthWave4B3MessageSendDryRunSelectionSummary/v1',
    selectedFirstTarget: 'message-send-dry-run-action',
    secondLikelyTarget: 'transport-target-resolution-dry-run',
    nextGateCandidate: '231-wave-4b3-message-send-dry-run-executable',
    featureFlagRequired: ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTE_FLAG,
    executionPermittedIn231: [
      'load migrated session/channel/transport metadata',
      'load redacted/derived content views',
      'build Zavorth-owned message-send dry-run plan',
      'run policy preflight and recheck',
      'emit redacted dry-run audit receipt',
      'record no-op rollback/compensation metadata',
    ],
    executionProhibitedIn231: [
      'real message send',
      'transport open or invocation',
      'real provider execution',
      'real tool/command execution',
      'ExternalExecutor mutation',
      'raw content access',
      'new state migration',
      'raw secret serialization',
      'source module copy',
      'global adapter removal',
    ],
    policyPreflightRequired: true,
    policyRecheckRequired: true,
    approvalRequirement: 'not-required-for-dry-run-only',
    receiptContract: 'ZavorthWave4B3MessageSendDryRunActionReceipt/v1',
    rollbackRequirement: 'dry-run-no-op-receipt',
    migratedSessionChannelTransportMetadataUsed: true,
    redactedDerivedContentUsed: true,
    rawContentUsageAllowed: false,
    runtimeExternalExecutorRequiredForNativeReadyPaths: false,
    rawSecretSerialized: false,
  };
}

function sourceReady(source: ZavorthWave4B3MessageSendDryRunSourceReadiness): boolean {
  return (
    source.messageSendTransportBlockedRehearsalReady &&
    source.realMessageTransportDiscoveryReady &&
    source.wave4b2MediumRiskExecutablesReady &&
    source.wave4c2RedactedContentMigrationReady &&
    source.actionGovernancePipelineReady &&
    source.integrationTransportRegistryReady &&
    source.sessionHistoryRegistryReady &&
    source.migratedSessionChannelTransportMetadataReady &&
    source.redactedDerivedContentReady &&
    !source.runtimeExternalExecutorRequiredForNativeReadyPaths &&
    !source.realMessageSendAttempted &&
    !source.providerRealExecutionAttempted &&
    !source.toolCommandRealExecutionAttempted &&
    !source.externalExecutorMutationAttempted &&
    !source.rawContentUsageAttempted &&
    !source.rawSecretSerialized &&
    !source.sourceModuleCopyAttempted &&
    !source.adapterRemovalAttempted &&
    !source.publicExternalExecutorIdentityExposed
  );
}

export class ZavorthWave4B3MessageSendDryRunExecutableSelection {
  public constructor(public readonly normalization: ZavorthWave4B3MessageSendDryRunExecutableSelectionNormalization) {}

  public selectedTarget(): ZavorthWave4B3MessageSendDryRunCandidate | undefined {
    return this.normalization.candidates.find((candidate) => candidate.classification === 'selected-first-target');
  }

  public secondLikelyTarget(): ZavorthWave4B3MessageSendDryRunCandidate | undefined {
    return this.normalization.candidates.find((candidate) => candidate.classification === 'second-target-probable');
  }

  public blockedCandidates(): ZavorthWave4B3MessageSendDryRunCandidate[] {
    return this.normalization.candidates.filter((candidate) => candidate.classification === 'blocked-until-provider-or-command-dry-run-gate');
  }
}

export function createZavorthWave4B3MessageSendDryRunExecutableSelectionFixtureSource(
  overrides: Partial<ZavorthWave4B3MessageSendDryRunSourceReadiness> = {},
): ZavorthWave4B3MessageSendDryRunSourceReadiness {
  return {
    messageSendTransportBlockedRehearsalReady: true,
    realMessageTransportDiscoveryReady: true,
    wave4b2MediumRiskExecutablesReady: true,
    wave4c2RedactedContentMigrationReady: true,
    actionGovernancePipelineReady: true,
    integrationTransportRegistryReady: true,
    sessionHistoryRegistryReady: true,
    migratedSessionChannelTransportMetadataReady: true,
    redactedDerivedContentReady: true,
    runtimeExternalExecutorRequiredForNativeReadyPaths: false,
    realMessageSendAttempted: false,
    providerRealExecutionAttempted: false,
    toolCommandRealExecutionAttempted: false,
    externalExecutorMutationAttempted: false,
    rawContentUsageAttempted: false,
    rawSecretSerialized: false,
    sourceModuleCopyAttempted: false,
    adapterRemovalAttempted: false,
    publicExternalExecutorIdentityExposed: false,
    ...overrides,
  };
}

export function normalizeZavorthWave4B3MessageSendDryRunExecutableSelection(
  options: ZavorthWave4B3MessageSendDryRunExecutableSelectionOptions,
): ZavorthWave4B3MessageSendDryRunExecutableSelectionNormalization {
  const rows = candidates();
  const summary = selectionSummary();
  const selected = rows.find((row) => row.candidateId === summary.selectedFirstTarget);
  const second = rows.find((row) => row.candidateId === summary.secondLikelyTarget);
  const ready = sourceReady(options.source) &&
    rows.length === 5 &&
    selected?.classification === 'selected-first-target' &&
    selected.dryRunOnly &&
    selected.executionDefinedFor231 &&
    selected.usesMigratedSessionMetadata &&
    selected.usesMigratedChannelTransportMetadata &&
    selected.usesRedactedDerivedContent &&
    !selected.usesRawContent &&
    selected.policyApproval.policyPreflightRequired &&
    selected.policyApproval.policyRecheckRequired &&
    second?.classification === 'second-target-probable' &&
    rows.every((row) => (
      !row.realMessageSendAllowed &&
      !row.providerRealExecutionAllowed &&
      !row.toolCommandRealExecutionAllowed &&
      !row.externalExecutorMutationAllowed &&
      !row.rawContentUsageAllowed &&
      !row.rawSecretSerialized
    ));

  return {
    nativeContract: 'ZavorthWave4B3MessageSendDryRunExecutableSelection/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'wave4b3-message-send-dry-run-executable-selection-ready' : 'blocked',
    status: ready ? 'wave4b3-message-send-dry-run-executable-selection-ready' : 'blocked',
    sourceReadiness: options.source,
    candidates: rows,
    selectionSummary: summary,
    executionGate: executionGate(),
    redaction: {
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      sourceIdentityPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: '231-wave-4b3-message-send-dry-run-executable-by-explicit-follow-up-only',
  };
}

export function normalizeZavorthWave4B3MessageSendDryRunExecutableSelectionFixture(
  overrides: Partial<ZavorthWave4B3MessageSendDryRunSourceReadiness> = {},
): ZavorthWave4B3MessageSendDryRunExecutableSelectionNormalization {
  return normalizeZavorthWave4B3MessageSendDryRunExecutableSelection({
    generatedAt: ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTABLE_SELECTION_NOW,
    runtimeId: ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTABLE_SELECTION_RUNTIME_ID,
    source: createZavorthWave4B3MessageSendDryRunExecutableSelectionFixtureSource(overrides),
  });
}

export function createZavorthWave4B3MessageSendDryRunExecutableSelectionFixture(
  overrides: Partial<ZavorthWave4B3MessageSendDryRunSourceReadiness> = {},
): ZavorthWave4B3MessageSendDryRunExecutableSelection {
  return new ZavorthWave4B3MessageSendDryRunExecutableSelection(
    normalizeZavorthWave4B3MessageSendDryRunExecutableSelectionFixture(overrides),
  );
}
