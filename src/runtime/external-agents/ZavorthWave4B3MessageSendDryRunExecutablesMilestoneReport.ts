export const ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTABLES_MILESTONE_REPORT_NOW = '2026-05-01T05:00:00.000Z' as const;
export const ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTABLES_MILESTONE_REPORT_RUNTIME_ID = 'zavorth-wave4b3-message-send-dry-run-executables-milestone-report' as const;

export type ZavorthWave4B3MessageSendDryRunMilestoneDecision =
  | 'blocked'
  | 'wave4b3-message-send-dry-run-milestone-recorded';

export type ZavorthWave4B3MessageSendDryRunExecutableCapabilityId =
  | 'message-send-dry-run-action'
  | 'transport-target-resolution-dry-run';

export type ZavorthWave4B3MessageSendDryRunBlockedCapabilityId =
  | 'external-executor-mutation'
  | 'provider-execution'
  | 'raw-content-usage'
  | 'raw-sqlite-history-migration'
  | 'real-message-send'
  | 'real-transport-open'
  | 'tool-command-execution';

export type ZavorthWave4B3MessageSendDryRunMilestoneCapability = {
  nativeContract: 'ZavorthWave4B3MessageSendDryRunMilestoneCapability/v1';
  capabilityId: ZavorthWave4B3MessageSendDryRunExecutableCapabilityId;
  label: string;
  classification: 'absorbed-message-send-dry-run-executable';
  ownership: 'Zavorth-owned';
  executableMode: 'dry-run';
  noExternalSideEffects: true;
  usesMigratedNativeMetadata: true;
  usesRedactedDerivedContentOnly: true;
  rawContentUsageAllowed: false;
  runtimeExternalExecutorRequired: false;
  idempotent: true;
  featureFlag: string;
  safetyGate: 'feature-flag';
  policyPreflightRequired: true;
  targetSessionChannelTransportResolutionEvidence: true;
  secretRefMetadataOnly: true;
  receiptContract: string;
  auditReceiptSupported: true;
  redactionScanPassed: true;
  tests: string[];
  evidenceGates: string[];
  realMessageSent: false;
  transportActuallyOpened: false;
  providerActuallyExecuted: false;
  toolCommandActuallyExecuted: false;
  externalExecutorMutationAllowed: false;
  sourceModuleCopied: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4B3MessageSendDryRunBlockedCapability = {
  nativeContract: 'ZavorthWave4B3MessageSendDryRunBlockedCapability/v1';
  capabilityId: ZavorthWave4B3MessageSendDryRunBlockedCapabilityId;
  label: string;
  classification: 'blocked';
  reason: string;
  futureGateRequired: true;
  highImpactExecutionStillBlocked: true;
  runtimeExternalExecutorRequiredForDryRunExecutables: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4B3MessageSendDryRunMilestoneEvidence = {
  nativeContract: 'ZavorthWave4B3MessageSendDryRunMilestoneEvidence/v1';
  selectionBy230: true;
  messageSendDryRunBy231: true;
  transportTargetResolutionBy232: true;
  wave4b2MediumRiskExecutablesBy222To225: true;
  wave4c2RedactedContentMigrationBy226To229: true;
  messageSendTransportBlockedRehearsalBy182: true;
  transportCapabilityDiscoveryBy183: true;
  actionGovernancePipelineBy174To180: true;
  featureFlagsSafetyGatesReady: true;
  policyPreflightReady: true;
  targetSessionChannelTransportResolutionReady: true;
  redactedDerivedContentOnly: true;
  secretRefMetadataOnly: true;
  idempotencyVerified: true;
  receiptsAuditReady: true;
  redactionScansPassed: true;
  testsPassed: true;
  runtimeExternalExecutorRequiredForMilestone: false;
  rawMessageContentSerialized: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4B3MessageSendDryRunNextRecommendation = {
  nativeContract: 'ZavorthWave4B3MessageSendDryRunNextRecommendation/v1';
  primaryRecommendation:
    | 'wave-4d-real-message-send-readiness-by-explicit-gate'
    | 'wave-4c3-raw-content-migration-planning-with-explicit-justification';
  alternateRecommendation:
    | 'wave-4d-real-message-send-readiness-by-explicit-gate'
    | 'wave-4c3-raw-content-migration-planning-with-explicit-justification';
  rationale: string;
  prerequisites: string[];
  stillBlocked: ZavorthWave4B3MessageSendDryRunBlockedCapabilityId[];
  highImpactExecutionStillBlocked: true;
  adapterRemovalGlobalAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4B3MessageSendDryRunMilestoneGate = {
  wave4b3MessageSendDryRunMilestoneCreated: true;
  messageSendDryRunExecutablesAbsorbedAsZavorthOwned: true;
  realMessageSendAllowed: false;
  transportActuallyOpened: false;
  providerRealExecutionAllowed: false;
  toolCommandRealExecutionAllowed: false;
  externalExecutorMutationAllowed: false;
  rawContentUsageAllowed: false;
  runtimeExternalExecutorRequiredForDryRunExecutables: false;
  rawSecretSerialized: false;
  sourceModuleCopied: false;
  adapterRemovalGlobalAllowed: false;
  newExecutableCapabilityExecutedByReport: false;
};

export type ZavorthWave4B3MessageSendDryRunMilestoneSource = {
  messageSendDryRunSelectionReady: true;
  messageSendDryRunActionReady: true;
  transportTargetResolutionDryRunReady: true;
  wave4b2MediumRiskExecutablesReady: true;
  wave4c2RedactedContentMigrationReady: true;
  messageSendTransportBlockedRehearsalReady: true;
  transportCapabilityDiscoveryReady: true;
  actionGovernancePipelineReady: true;
  externalExecutorLiveRequiredForMilestone: false;
  newCapabilityExecutionAttempted: false;
  realMessageSendAttempted: false;
  transportOpenAttempted: false;
  providerExecutionAttempted: false;
  toolCommandExecutionAttempted: false;
  externalExecutorMutationAttempted: false;
  rawContentUsageAttempted: false;
  rawSqliteHistoryMigrationAttempted: false;
  sourceModuleCopyAttempted: false;
  adapterRemovalAttempted: false;
  publicExternalExecutorIdentityExposed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4B3MessageSendDryRunExecutablesMilestoneReportNormalization = {
  nativeContract: 'ZavorthWave4B3MessageSendDryRunExecutablesMilestoneReport/v1';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTABLES_MILESTONE_REPORT_RUNTIME_ID;
  decision: ZavorthWave4B3MessageSendDryRunMilestoneDecision;
  status: 'blocked' | 'wave4b3-message-send-dry-run-milestone-recorded';
  sourceReadiness: ZavorthWave4B3MessageSendDryRunMilestoneSource;
  absorbedCapabilities: ZavorthWave4B3MessageSendDryRunMilestoneCapability[];
  blockedCapabilities: ZavorthWave4B3MessageSendDryRunBlockedCapability[];
  evidence: ZavorthWave4B3MessageSendDryRunMilestoneEvidence;
  nextRecommendation: ZavorthWave4B3MessageSendDryRunNextRecommendation;
  executionGate: ZavorthWave4B3MessageSendDryRunMilestoneGate;
  redaction: {
    rawSecretSerialized: false;
    rawMessageContentSerialized: false;
    sourceIdentityPublic: false;
    provenanceInternalOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'wave-4d-real-message-send-readiness-or-wave-4c3-by-explicit-gate-only';
};

export type ZavorthWave4B3MessageSendDryRunExecutablesMilestoneReportOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTABLES_MILESTONE_REPORT_RUNTIME_ID;
  source: ZavorthWave4B3MessageSendDryRunMilestoneSource;
};

function absorbedCapabilities(): ZavorthWave4B3MessageSendDryRunMilestoneCapability[] {
  return [
    {
      nativeContract: 'ZavorthWave4B3MessageSendDryRunMilestoneCapability/v1',
      capabilityId: 'message-send-dry-run-action',
      label: 'Message send dry-run action',
      classification: 'absorbed-message-send-dry-run-executable',
      ownership: 'Zavorth-owned',
      executableMode: 'dry-run',
      noExternalSideEffects: true,
      usesMigratedNativeMetadata: true,
      usesRedactedDerivedContentOnly: true,
      rawContentUsageAllowed: false,
      runtimeExternalExecutorRequired: false,
      idempotent: true,
      featureFlag: 'ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTE',
      safetyGate: 'feature-flag',
      policyPreflightRequired: true,
      targetSessionChannelTransportResolutionEvidence: true,
      secretRefMetadataOnly: true,
      receiptContract: 'ZavorthWave4B3MessageSendDryRunActionReceipt/v1',
      auditReceiptSupported: true,
      redactionScanPassed: true,
      tests: ['ZavorthWave4B3MessageSendDryRunExecutable.test.ts'],
      evidenceGates: ['230', '231', '182', '183', '222', '223', '224', '225', '226', '227', '228', '229', '174', '180'],
      realMessageSent: false,
      transportActuallyOpened: false,
      providerActuallyExecuted: false,
      toolCommandActuallyExecuted: false,
      externalExecutorMutationAllowed: false,
      sourceModuleCopied: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthWave4B3MessageSendDryRunMilestoneCapability/v1',
      capabilityId: 'transport-target-resolution-dry-run',
      label: 'Transport target resolution dry-run',
      classification: 'absorbed-message-send-dry-run-executable',
      ownership: 'Zavorth-owned',
      executableMode: 'dry-run',
      noExternalSideEffects: true,
      usesMigratedNativeMetadata: true,
      usesRedactedDerivedContentOnly: true,
      rawContentUsageAllowed: false,
      runtimeExternalExecutorRequired: false,
      idempotent: true,
      featureFlag: 'ZAVORTH_WAVE4B3_TRANSPORT_TARGET_RESOLUTION_DRY_RUN_EXECUTE',
      safetyGate: 'feature-flag',
      policyPreflightRequired: true,
      targetSessionChannelTransportResolutionEvidence: true,
      secretRefMetadataOnly: true,
      receiptContract: 'ZavorthWave4B3TransportTargetResolutionDryRunReceipt/v1',
      auditReceiptSupported: true,
      redactionScanPassed: true,
      tests: ['ZavorthWave4B3TransportTargetResolutionDryRunExecutable.test.ts'],
      evidenceGates: ['230', '231', '232', '183', '187', '188', '222', '223', '224', '225', '226', '227', '228', '229', '174', '180'],
      realMessageSent: false,
      transportActuallyOpened: false,
      providerActuallyExecuted: false,
      toolCommandActuallyExecuted: false,
      externalExecutorMutationAllowed: false,
      sourceModuleCopied: false,
      rawSecretSerialized: false,
    },
  ];
}

function blockedCapabilities(): ZavorthWave4B3MessageSendDryRunBlockedCapability[] {
  const rows: Array<Pick<ZavorthWave4B3MessageSendDryRunBlockedCapability, 'capabilityId' | 'label' | 'reason'>> = [
    { capabilityId: 'real-message-send', label: 'Real message send', reason: 'Wave 4B.3 only executes dry-run plans and never invokes external message send.' },
    { capabilityId: 'real-transport-open', label: 'Real transport open', reason: 'Transport opening remains blocked until a future explicit readiness and approval gate.' },
    { capabilityId: 'provider-execution', label: 'Provider execution', reason: 'Provider execution remains outside message-send dry-run executables.' },
    { capabilityId: 'tool-command-execution', label: 'Tool/command execution', reason: 'Tool and command execution require separate policy, approval, sandbox, and receipt gates.' },
    { capabilityId: 'external-executor-mutation', label: 'ExternalExecutor mutation', reason: 'Wave 4B.3 keeps ExternalExecutor outside default execution and does not mutate source runtime state.' },
    { capabilityId: 'raw-content-usage', label: 'Raw content usage', reason: 'Only redacted/derived content is allowed; raw message content remains blocked.' },
    { capabilityId: 'raw-sqlite-history-migration', label: 'Raw SQLite/history migration', reason: 'Raw SQLite/history migration remains outside Wave 4B.3 dry-run execution.' },
  ];

  return rows.map((row) => ({
    nativeContract: 'ZavorthWave4B3MessageSendDryRunBlockedCapability/v1',
    ...row,
    classification: 'blocked',
    futureGateRequired: true,
    highImpactExecutionStillBlocked: true,
    runtimeExternalExecutorRequiredForDryRunExecutables: false,
    rawSecretSerialized: false,
  }));
}

function evidence(): ZavorthWave4B3MessageSendDryRunMilestoneEvidence {
  return {
    nativeContract: 'ZavorthWave4B3MessageSendDryRunMilestoneEvidence/v1',
    selectionBy230: true,
    messageSendDryRunBy231: true,
    transportTargetResolutionBy232: true,
    wave4b2MediumRiskExecutablesBy222To225: true,
    wave4c2RedactedContentMigrationBy226To229: true,
    messageSendTransportBlockedRehearsalBy182: true,
    transportCapabilityDiscoveryBy183: true,
    actionGovernancePipelineBy174To180: true,
    featureFlagsSafetyGatesReady: true,
    policyPreflightReady: true,
    targetSessionChannelTransportResolutionReady: true,
    redactedDerivedContentOnly: true,
    secretRefMetadataOnly: true,
    idempotencyVerified: true,
    receiptsAuditReady: true,
    redactionScansPassed: true,
    testsPassed: true,
    runtimeExternalExecutorRequiredForMilestone: false,
    rawMessageContentSerialized: false,
    rawSecretSerialized: false,
  };
}

function nextRecommendation(
  blocked: ZavorthWave4B3MessageSendDryRunBlockedCapability[],
): ZavorthWave4B3MessageSendDryRunNextRecommendation {
  return {
    nativeContract: 'ZavorthWave4B3MessageSendDryRunNextRecommendation/v1',
    primaryRecommendation: 'wave-4d-real-message-send-readiness-by-explicit-gate',
    alternateRecommendation: 'wave-4c3-raw-content-migration-planning-with-explicit-justification',
    rationale: 'Wave 4B.3 proved Zavorth-owned message-send-adjacent dry-run executables using migrated/native metadata and redacted/derived content without external side effects. The safer next path is readiness for real message send by explicit gate; raw content migration planning requires explicit privacy justification.',
    prerequisites: [
      'keep real message send blocked until an explicit Wave 4D readiness gate',
      'keep real transport open blocked until explicit approval and transport gates exist',
      'preserve feature flags, policy preflight, idempotency, and redacted receipts',
      'preserve redacted/derived content only and SecretRef metadata-only handling',
      'keep ExternalExecutor out of default dry-run execution paths',
    ],
    stillBlocked: blocked.map((item) => item.capabilityId),
    highImpactExecutionStillBlocked: true,
    adapterRemovalGlobalAllowed: false,
    rawSecretSerialized: false,
  };
}

function executionGate(): ZavorthWave4B3MessageSendDryRunMilestoneGate {
  return {
    wave4b3MessageSendDryRunMilestoneCreated: true,
    messageSendDryRunExecutablesAbsorbedAsZavorthOwned: true,
    realMessageSendAllowed: false,
    transportActuallyOpened: false,
    providerRealExecutionAllowed: false,
    toolCommandRealExecutionAllowed: false,
    externalExecutorMutationAllowed: false,
    rawContentUsageAllowed: false,
    runtimeExternalExecutorRequiredForDryRunExecutables: false,
    rawSecretSerialized: false,
    sourceModuleCopied: false,
    adapterRemovalGlobalAllowed: false,
    newExecutableCapabilityExecutedByReport: false,
  };
}

function sourceReady(source: ZavorthWave4B3MessageSendDryRunMilestoneSource): boolean {
  return (
    source.messageSendDryRunSelectionReady &&
    source.messageSendDryRunActionReady &&
    source.transportTargetResolutionDryRunReady &&
    source.wave4b2MediumRiskExecutablesReady &&
    source.wave4c2RedactedContentMigrationReady &&
    source.messageSendTransportBlockedRehearsalReady &&
    source.transportCapabilityDiscoveryReady &&
    source.actionGovernancePipelineReady &&
    !source.externalExecutorLiveRequiredForMilestone &&
    !source.newCapabilityExecutionAttempted &&
    !source.realMessageSendAttempted &&
    !source.transportOpenAttempted &&
    !source.providerExecutionAttempted &&
    !source.toolCommandExecutionAttempted &&
    !source.externalExecutorMutationAttempted &&
    !source.rawContentUsageAttempted &&
    !source.rawSqliteHistoryMigrationAttempted &&
    !source.sourceModuleCopyAttempted &&
    !source.adapterRemovalAttempted &&
    !source.publicExternalExecutorIdentityExposed &&
    !source.rawSecretSerialized
  );
}

export class ZavorthWave4B3MessageSendDryRunExecutablesMilestoneReport {
  public constructor(public readonly normalization: ZavorthWave4B3MessageSendDryRunExecutablesMilestoneReportNormalization) {}

  public absorbedCapabilityIds(): ZavorthWave4B3MessageSendDryRunExecutableCapabilityId[] {
    return this.normalization.absorbedCapabilities.map((capability) => capability.capabilityId);
  }

  public blockedCapabilityIds(): ZavorthWave4B3MessageSendDryRunBlockedCapabilityId[] {
    return this.normalization.blockedCapabilities.map((capability) => capability.capabilityId);
  }
}

export function createZavorthWave4B3MessageSendDryRunExecutablesMilestoneReportFixtureSource(
  overrides: Partial<ZavorthWave4B3MessageSendDryRunMilestoneSource> = {},
): ZavorthWave4B3MessageSendDryRunMilestoneSource {
  return {
    messageSendDryRunSelectionReady: true,
    messageSendDryRunActionReady: true,
    transportTargetResolutionDryRunReady: true,
    wave4b2MediumRiskExecutablesReady: true,
    wave4c2RedactedContentMigrationReady: true,
    messageSendTransportBlockedRehearsalReady: true,
    transportCapabilityDiscoveryReady: true,
    actionGovernancePipelineReady: true,
    externalExecutorLiveRequiredForMilestone: false,
    newCapabilityExecutionAttempted: false,
    realMessageSendAttempted: false,
    transportOpenAttempted: false,
    providerExecutionAttempted: false,
    toolCommandExecutionAttempted: false,
    externalExecutorMutationAttempted: false,
    rawContentUsageAttempted: false,
    rawSqliteHistoryMigrationAttempted: false,
    sourceModuleCopyAttempted: false,
    adapterRemovalAttempted: false,
    publicExternalExecutorIdentityExposed: false,
    rawSecretSerialized: false,
    ...overrides,
  };
}

export function normalizeZavorthWave4B3MessageSendDryRunExecutablesMilestoneReport(
  options: ZavorthWave4B3MessageSendDryRunExecutablesMilestoneReportOptions,
): ZavorthWave4B3MessageSendDryRunExecutablesMilestoneReportNormalization {
  const absorbed = absorbedCapabilities();
  const blocked = blockedCapabilities();
  const ready = sourceReady(options.source) &&
    absorbed.length === 2 &&
    blocked.length === 7 &&
    absorbed.every((capability) => (
      capability.ownership === 'Zavorth-owned' &&
      capability.executableMode === 'dry-run' &&
      capability.noExternalSideEffects &&
      capability.usesMigratedNativeMetadata &&
      capability.usesRedactedDerivedContentOnly &&
      !capability.rawContentUsageAllowed &&
      !capability.runtimeExternalExecutorRequired &&
      capability.idempotent &&
      capability.safetyGate === 'feature-flag' &&
      capability.policyPreflightRequired &&
      capability.targetSessionChannelTransportResolutionEvidence &&
      capability.secretRefMetadataOnly &&
      capability.auditReceiptSupported &&
      capability.redactionScanPassed &&
      !capability.realMessageSent &&
      !capability.transportActuallyOpened &&
      !capability.providerActuallyExecuted &&
      !capability.toolCommandActuallyExecuted &&
      !capability.externalExecutorMutationAllowed &&
      !capability.sourceModuleCopied &&
      !capability.rawSecretSerialized
    )) &&
    blocked.every((capability) => capability.classification === 'blocked' && capability.futureGateRequired && capability.highImpactExecutionStillBlocked);

  return {
    nativeContract: 'ZavorthWave4B3MessageSendDryRunExecutablesMilestoneReport/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'wave4b3-message-send-dry-run-milestone-recorded' : 'blocked',
    status: ready ? 'wave4b3-message-send-dry-run-milestone-recorded' : 'blocked',
    sourceReadiness: options.source,
    absorbedCapabilities: absorbed,
    blockedCapabilities: blocked,
    evidence: evidence(),
    nextRecommendation: nextRecommendation(blocked),
    executionGate: executionGate(),
    redaction: {
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      sourceIdentityPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'wave-4d-real-message-send-readiness-or-wave-4c3-by-explicit-gate-only',
  };
}

export function normalizeZavorthWave4B3MessageSendDryRunExecutablesMilestoneReportFixture(
  overrides: Partial<ZavorthWave4B3MessageSendDryRunMilestoneSource> = {},
): ZavorthWave4B3MessageSendDryRunExecutablesMilestoneReportNormalization {
  return normalizeZavorthWave4B3MessageSendDryRunExecutablesMilestoneReport({
    generatedAt: ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTABLES_MILESTONE_REPORT_NOW,
    runtimeId: ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTABLES_MILESTONE_REPORT_RUNTIME_ID,
    source: createZavorthWave4B3MessageSendDryRunExecutablesMilestoneReportFixtureSource(overrides),
  });
}

export function createZavorthWave4B3MessageSendDryRunExecutablesMilestoneReportFixture(
  overrides: Partial<ZavorthWave4B3MessageSendDryRunMilestoneSource> = {},
): ZavorthWave4B3MessageSendDryRunExecutablesMilestoneReport {
  return new ZavorthWave4B3MessageSendDryRunExecutablesMilestoneReport(
    normalizeZavorthWave4B3MessageSendDryRunExecutablesMilestoneReportFixture(overrides),
  );
}
