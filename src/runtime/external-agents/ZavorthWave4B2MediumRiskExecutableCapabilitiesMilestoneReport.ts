export const ZAVORTH_WAVE4B2_MEDIUM_RISK_EXECUTABLE_CAPABILITIES_MILESTONE_REPORT_NOW = '2026-04-30T21:00:00.000Z' as const;
export const ZAVORTH_WAVE4B2_MEDIUM_RISK_EXECUTABLE_CAPABILITIES_MILESTONE_REPORT_RUNTIME_ID = 'zavorth-wave4b2-medium-risk-executable-capabilities-milestone-report' as const;

export type ZavorthWave4B2MediumRiskExecutableMilestoneDecision =
  | 'blocked'
  | 'wave4b2-medium-risk-executable-capabilities-milestone-recorded';

export type ZavorthWave4B2MediumRiskExecutableCapabilityId =
  | 'target-session-channel-validation-action'
  | 'transport-readiness-check-action';

export type ZavorthWave4B2BlockedExecutableCapabilityId =
  | 'external-executor-mutation'
  | 'provider-execution'
  | 'raw-history-sqlite-migration'
  | 'real-message-send'
  | 'tool-command-execution'
  | 'transport-open-mutable';

export type ZavorthWave4B2MediumRiskExecutableMilestoneCapability = {
  nativeContract: 'ZavorthWave4B2MediumRiskExecutableMilestoneCapability/v1';
  capabilityId: ZavorthWave4B2MediumRiskExecutableCapabilityId;
  label: string;
  classification: 'absorbed-medium-risk-executable';
  ownership: 'Zavorth-owned';
  risk: 'medium-risk';
  scope: 'metadata-session-channel-scoped' | 'metadata-transport-channel-scoped';
  idempotent: true;
  runtimeExternalExecutorRequired: false;
  externalSideEffects: false;
  externalExecutorTouched: false;
  featureFlag: string;
  safetyGate: 'feature-flag';
  policyRecheckRequired: true;
  approvalRequired: false;
  receiptContract: string;
  auditReceiptSupported: true;
  rollbackCleanupEvidence: true;
  redactionScanPassed: true;
  tests: string[];
  evidenceGates: string[];
  highImpactExecutionBlocked: true;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  toolCommandActuallyExecuted: false;
  transportActuallyOpened: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4B2BlockedExecutableCapability = {
  nativeContract: 'ZavorthWave4B2BlockedExecutableCapability/v1';
  capabilityId: ZavorthWave4B2BlockedExecutableCapabilityId;
  label: string;
  classification: 'blocked';
  reason: string;
  futureGateRequired: true;
  highImpactExecutionStillBlocked: true;
  runtimeExternalExecutorRequiredForMediumRiskExecutables: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4B2MediumRiskExecutableMilestoneEvidence = {
  nativeContract: 'ZavorthWave4B2MediumRiskExecutableMilestoneEvidence/v1';
  selectionBy222: true;
  targetSessionChannelValidationBy223: true;
  transportReadinessCheckBy224: true;
  lowRiskExecutableMilestoneBy217: true;
  wave4cSessionHistoryMetadataMigrationBy218To221: true;
  actionGovernancePipelineReady: true;
  featureFlagsSafetyGatesReady: true;
  policyRechecksReady: true;
  idempotencyVerified: true;
  receiptsAuditReady: true;
  rollbackCleanupVerified: true;
  redactionScansPassed: true;
  runtimeExternalExecutorRequiredForMilestone: false;
  rawMessageContentSerialized: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4B2MediumRiskExecutableNextRecommendation = {
  nativeContract: 'ZavorthWave4B2MediumRiskExecutableNextRecommendation/v1';
  primaryRecommendation:
    | 'wave-4b.3-transport-readiness-follow-up-by-explicit-gate'
    | 'wave-4c.2-raw-history-sqlite-planning-by-explicit-gate';
  alternateRecommendation:
    | 'wave-4b.3-transport-readiness-follow-up-by-explicit-gate'
    | 'wave-4c.2-raw-history-sqlite-planning-by-explicit-gate';
  rationale: string;
  prerequisites: string[];
  stillBlocked: ZavorthWave4B2BlockedExecutableCapabilityId[];
  highImpactExecutionStillBlocked: true;
  adapterRemovalGlobalAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4B2MediumRiskExecutableMilestoneGate = {
  wave4b2MediumRiskExecutableMilestoneCreated: true;
  mediumRiskExecutablesAbsorbedAsZavorthOwned: true;
  highImpactExecutionStillBlocked: true;
  realMessageSendAllowed: false;
  providerExecutionRealAllowed: false;
  toolCommandExecutionRealAllowed: false;
  mutableTransportOpenAllowed: false;
  externalExecutorMutationAllowed: false;
  runtimeExternalExecutorRequiredForMediumRiskExecutables: false;
  rawHistoryMigrationAllowed: false;
  rawSqliteMigrationAllowed: false;
  stateMigrated: false;
  sourceModuleCopied: false;
  adapterRemovalGlobalAllowed: false;
  rawSecretSerialized: false;
  newExecutableCapabilityExecutedByReport: false;
};

export type ZavorthWave4B2MediumRiskExecutableMilestoneSource = {
  mediumRiskSelectionReady: true;
  targetSessionChannelValidationReady: true;
  transportReadinessCheckReady: true;
  lowRiskExecutableMilestoneReady: true;
  wave4cSessionHistoryMetadataMigrationReady: true;
  actionGovernancePipelineReady: true;
  externalExecutorLiveRequiredForMilestone: false;
  newCapabilityExecutionAttempted: false;
  messageSendAttempted: false;
  transportOpenAttempted: false;
  providerExecutionAttempted: false;
  toolCommandExecutionAttempted: false;
  externalExecutorMutationAttempted: false;
  rawHistoryMigrationAttempted: false;
  rawSqliteMigrationAttempted: false;
  sourceModuleCopyAttempted: false;
  adapterRemovalAttempted: false;
  publicExternalExecutorIdentityExposed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4B2MediumRiskExecutableCapabilitiesMilestoneReportNormalization = {
  nativeContract: 'ZavorthWave4B2MediumRiskExecutableCapabilitiesMilestoneReport/v1';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4B2_MEDIUM_RISK_EXECUTABLE_CAPABILITIES_MILESTONE_REPORT_RUNTIME_ID;
  decision: ZavorthWave4B2MediumRiskExecutableMilestoneDecision;
  status: 'blocked' | 'wave4b2-medium-risk-executable-capabilities-milestone-recorded';
  sourceReadiness: ZavorthWave4B2MediumRiskExecutableMilestoneSource;
  absorbedCapabilities: ZavorthWave4B2MediumRiskExecutableMilestoneCapability[];
  blockedCapabilities: ZavorthWave4B2BlockedExecutableCapability[];
  evidence: ZavorthWave4B2MediumRiskExecutableMilestoneEvidence;
  nextRecommendation: ZavorthWave4B2MediumRiskExecutableNextRecommendation;
  executionGate: ZavorthWave4B2MediumRiskExecutableMilestoneGate;
  redaction: {
    rawSecretSerialized: false;
    rawMessageContentSerialized: false;
    sourceIdentityPublic: false;
    provenanceInternalOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'future-wave-4b3-or-wave-4c2-by-explicit-follow-up-only';
};

export type ZavorthWave4B2MediumRiskExecutableCapabilitiesMilestoneReportOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4B2_MEDIUM_RISK_EXECUTABLE_CAPABILITIES_MILESTONE_REPORT_RUNTIME_ID;
  source: ZavorthWave4B2MediumRiskExecutableMilestoneSource;
};

function absorbedCapabilities(): ZavorthWave4B2MediumRiskExecutableMilestoneCapability[] {
  return [
    {
      nativeContract: 'ZavorthWave4B2MediumRiskExecutableMilestoneCapability/v1',
      capabilityId: 'target-session-channel-validation-action',
      label: 'Target/session/channel validation action',
      classification: 'absorbed-medium-risk-executable',
      ownership: 'Zavorth-owned',
      risk: 'medium-risk',
      scope: 'metadata-session-channel-scoped',
      idempotent: true,
      runtimeExternalExecutorRequired: false,
      externalSideEffects: false,
      externalExecutorTouched: false,
      featureFlag: 'ZAVORTH_WAVE4B2_TARGET_SESSION_CHANNEL_VALIDATION_EXECUTE',
      safetyGate: 'feature-flag',
      policyRecheckRequired: true,
      approvalRequired: false,
      receiptContract: 'ZavorthWave4B2TargetSessionChannelValidationExecutableReceipt/v1',
      auditReceiptSupported: true,
      rollbackCleanupEvidence: true,
      redactionScanPassed: true,
      tests: ['ZavorthWave4B2TargetSessionChannelValidationExecutable.test.ts'],
      evidenceGates: ['222', '223', '172', '187', '188', '218', '219', '220', '221', '174', '180'],
      highImpactExecutionBlocked: true,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      toolCommandActuallyExecuted: false,
      transportActuallyOpened: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthWave4B2MediumRiskExecutableMilestoneCapability/v1',
      capabilityId: 'transport-readiness-check-action',
      label: 'Transport readiness check action',
      classification: 'absorbed-medium-risk-executable',
      ownership: 'Zavorth-owned',
      risk: 'medium-risk',
      scope: 'metadata-transport-channel-scoped',
      idempotent: true,
      runtimeExternalExecutorRequired: false,
      externalSideEffects: false,
      externalExecutorTouched: false,
      featureFlag: 'ZAVORTH_WAVE4B2_TRANSPORT_READINESS_CHECK_EXECUTE',
      safetyGate: 'feature-flag',
      policyRecheckRequired: true,
      approvalRequired: false,
      receiptContract: 'ZavorthWave4B2TransportReadinessCheckExecutableReceipt/v1',
      auditReceiptSupported: true,
      rollbackCleanupEvidence: true,
      redactionScanPassed: true,
      tests: ['ZavorthWave4B2TransportReadinessCheckExecutable.test.ts'],
      evidenceGates: ['222', '224', '183', '182', '187', '218', '219', '220', '221', '174', '180'],
      highImpactExecutionBlocked: true,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      toolCommandActuallyExecuted: false,
      transportActuallyOpened: false,
      rawSecretSerialized: false,
    },
  ];
}

function blockedCapabilities(): ZavorthWave4B2BlockedExecutableCapability[] {
  return [
    {
      nativeContract: 'ZavorthWave4B2BlockedExecutableCapability/v1',
      capabilityId: 'real-message-send',
      label: 'Real message send',
      classification: 'blocked',
      reason: 'Wave 4B.2 validated metadata readiness only; real message send still requires a future explicit approval and transport gate.',
      futureGateRequired: true,
      highImpactExecutionStillBlocked: true,
      runtimeExternalExecutorRequiredForMediumRiskExecutables: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthWave4B2BlockedExecutableCapability/v1',
      capabilityId: 'transport-open-mutable',
      label: 'Mutable transport open',
      classification: 'blocked',
      reason: 'Transport readiness checks never open mutable external transports.',
      futureGateRequired: true,
      highImpactExecutionStillBlocked: true,
      runtimeExternalExecutorRequiredForMediumRiskExecutables: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthWave4B2BlockedExecutableCapability/v1',
      capabilityId: 'provider-execution',
      label: 'Provider execution',
      classification: 'blocked',
      reason: 'Provider execution remains outside Wave 4B.2 metadata/session/channel scoped executables.',
      futureGateRequired: true,
      highImpactExecutionStillBlocked: true,
      runtimeExternalExecutorRequiredForMediumRiskExecutables: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthWave4B2BlockedExecutableCapability/v1',
      capabilityId: 'tool-command-execution',
      label: 'Tool/command execution',
      classification: 'blocked',
      reason: 'Tool and command execution require separate policy, approval, sandbox, and receipt gates.',
      futureGateRequired: true,
      highImpactExecutionStillBlocked: true,
      runtimeExternalExecutorRequiredForMediumRiskExecutables: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthWave4B2BlockedExecutableCapability/v1',
      capabilityId: 'external-executor-mutation',
      label: 'ExternalExecutor mutation',
      classification: 'blocked',
      reason: 'Wave 4B.2 does not mutate ExternalExecutor and does not require ExternalExecutor live for default execution.',
      futureGateRequired: true,
      highImpactExecutionStillBlocked: true,
      runtimeExternalExecutorRequiredForMediumRiskExecutables: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthWave4B2BlockedExecutableCapability/v1',
      capabilityId: 'raw-history-sqlite-migration',
      label: 'Raw history/SQLite migration',
      classification: 'blocked',
      reason: 'Raw history and SQLite migration remain outside metadata-only Wave 4B.2 execution.',
      futureGateRequired: true,
      highImpactExecutionStillBlocked: true,
      runtimeExternalExecutorRequiredForMediumRiskExecutables: false,
      rawSecretSerialized: false,
    },
  ];
}

function evidence(): ZavorthWave4B2MediumRiskExecutableMilestoneEvidence {
  return {
    nativeContract: 'ZavorthWave4B2MediumRiskExecutableMilestoneEvidence/v1',
    selectionBy222: true,
    targetSessionChannelValidationBy223: true,
    transportReadinessCheckBy224: true,
    lowRiskExecutableMilestoneBy217: true,
    wave4cSessionHistoryMetadataMigrationBy218To221: true,
    actionGovernancePipelineReady: true,
    featureFlagsSafetyGatesReady: true,
    policyRechecksReady: true,
    idempotencyVerified: true,
    receiptsAuditReady: true,
    rollbackCleanupVerified: true,
    redactionScansPassed: true,
    runtimeExternalExecutorRequiredForMilestone: false,
    rawMessageContentSerialized: false,
    rawSecretSerialized: false,
  };
}

function nextRecommendation(
  blocked: ZavorthWave4B2BlockedExecutableCapability[],
): ZavorthWave4B2MediumRiskExecutableNextRecommendation {
  return {
    nativeContract: 'ZavorthWave4B2MediumRiskExecutableNextRecommendation/v1',
    primaryRecommendation: 'wave-4b.3-transport-readiness-follow-up-by-explicit-gate',
    alternateRecommendation: 'wave-4c.2-raw-history-sqlite-planning-by-explicit-gate',
    rationale: 'Wave 4B.2 proved medium-risk Zavorth-owned metadata/session/channel executable checks without side effects. A future explicit gate may either deepen transport readiness or return to raw history/SQLite planning, while high-impact execution remains blocked.',
    prerequisites: [
      'keep real message send blocked until explicit approval and transport gates exist',
      'keep mutable external transport opens blocked until a future gate',
      'preserve feature flags and policy recheck before medium-risk executable checks',
      'preserve idempotent receipts and cleanup evidence',
      'keep ExternalExecutor out of default execution paths',
    ],
    stillBlocked: blocked.map((item) => item.capabilityId),
    highImpactExecutionStillBlocked: true,
    adapterRemovalGlobalAllowed: false,
    rawSecretSerialized: false,
  };
}

function executionGate(): ZavorthWave4B2MediumRiskExecutableMilestoneGate {
  return {
    wave4b2MediumRiskExecutableMilestoneCreated: true,
    mediumRiskExecutablesAbsorbedAsZavorthOwned: true,
    highImpactExecutionStillBlocked: true,
    realMessageSendAllowed: false,
    providerExecutionRealAllowed: false,
    toolCommandExecutionRealAllowed: false,
    mutableTransportOpenAllowed: false,
    externalExecutorMutationAllowed: false,
    runtimeExternalExecutorRequiredForMediumRiskExecutables: false,
    rawHistoryMigrationAllowed: false,
    rawSqliteMigrationAllowed: false,
    stateMigrated: false,
    sourceModuleCopied: false,
    adapterRemovalGlobalAllowed: false,
    rawSecretSerialized: false,
    newExecutableCapabilityExecutedByReport: false,
  };
}

function sourceReady(source: ZavorthWave4B2MediumRiskExecutableMilestoneSource): boolean {
  return (
    source.mediumRiskSelectionReady &&
    source.targetSessionChannelValidationReady &&
    source.transportReadinessCheckReady &&
    source.lowRiskExecutableMilestoneReady &&
    source.wave4cSessionHistoryMetadataMigrationReady &&
    source.actionGovernancePipelineReady &&
    !source.externalExecutorLiveRequiredForMilestone &&
    !source.newCapabilityExecutionAttempted &&
    !source.messageSendAttempted &&
    !source.transportOpenAttempted &&
    !source.providerExecutionAttempted &&
    !source.toolCommandExecutionAttempted &&
    !source.externalExecutorMutationAttempted &&
    !source.rawHistoryMigrationAttempted &&
    !source.rawSqliteMigrationAttempted &&
    !source.sourceModuleCopyAttempted &&
    !source.adapterRemovalAttempted &&
    !source.publicExternalExecutorIdentityExposed &&
    !source.rawSecretSerialized
  );
}

export class ZavorthWave4B2MediumRiskExecutableCapabilitiesMilestoneReport {
  public constructor(public readonly normalization: ZavorthWave4B2MediumRiskExecutableCapabilitiesMilestoneReportNormalization) {}

  public absorbedCapabilityIds(): ZavorthWave4B2MediumRiskExecutableCapabilityId[] {
    return this.normalization.absorbedCapabilities.map((capability) => capability.capabilityId);
  }

  public blockedCapabilityIds(): ZavorthWave4B2BlockedExecutableCapabilityId[] {
    return this.normalization.blockedCapabilities.map((capability) => capability.capabilityId);
  }
}

export function createZavorthWave4B2MediumRiskExecutableCapabilitiesMilestoneReportFixtureSource(
  overrides: Partial<ZavorthWave4B2MediumRiskExecutableMilestoneSource> = {},
): ZavorthWave4B2MediumRiskExecutableMilestoneSource {
  return {
    mediumRiskSelectionReady: true,
    targetSessionChannelValidationReady: true,
    transportReadinessCheckReady: true,
    lowRiskExecutableMilestoneReady: true,
    wave4cSessionHistoryMetadataMigrationReady: true,
    actionGovernancePipelineReady: true,
    externalExecutorLiveRequiredForMilestone: false,
    newCapabilityExecutionAttempted: false,
    messageSendAttempted: false,
    transportOpenAttempted: false,
    providerExecutionAttempted: false,
    toolCommandExecutionAttempted: false,
    externalExecutorMutationAttempted: false,
    rawHistoryMigrationAttempted: false,
    rawSqliteMigrationAttempted: false,
    sourceModuleCopyAttempted: false,
    adapterRemovalAttempted: false,
    publicExternalExecutorIdentityExposed: false,
    rawSecretSerialized: false,
    ...overrides,
  };
}

export function normalizeZavorthWave4B2MediumRiskExecutableCapabilitiesMilestoneReport(
  options: ZavorthWave4B2MediumRiskExecutableCapabilitiesMilestoneReportOptions,
): ZavorthWave4B2MediumRiskExecutableCapabilitiesMilestoneReportNormalization {
  const absorbed = absorbedCapabilities();
  const blocked = blockedCapabilities();
  const milestoneEvidence = evidence();
  const recommendation = nextRecommendation(blocked);
  const gate = executionGate();
  const ready = sourceReady(options.source) &&
    absorbed.length === 2 &&
    blocked.length === 6 &&
    absorbed.every((capability) => (
      capability.ownership === 'Zavorth-owned' &&
      capability.risk === 'medium-risk' &&
      capability.idempotent &&
      !capability.runtimeExternalExecutorRequired &&
      !capability.externalSideEffects &&
      !capability.externalExecutorTouched &&
      capability.policyRecheckRequired &&
      !capability.approvalRequired &&
      capability.auditReceiptSupported &&
      capability.rollbackCleanupEvidence &&
      capability.redactionScanPassed &&
      !capability.messageActuallySent &&
      !capability.providerActuallyExecuted &&
      !capability.toolCommandActuallyExecuted &&
      !capability.transportActuallyOpened
    ));

  return {
    nativeContract: 'ZavorthWave4B2MediumRiskExecutableCapabilitiesMilestoneReport/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'wave4b2-medium-risk-executable-capabilities-milestone-recorded' : 'blocked',
    status: ready ? 'wave4b2-medium-risk-executable-capabilities-milestone-recorded' : 'blocked',
    sourceReadiness: options.source,
    absorbedCapabilities: absorbed,
    blockedCapabilities: blocked,
    evidence: milestoneEvidence,
    nextRecommendation: recommendation,
    executionGate: gate,
    redaction: {
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      sourceIdentityPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'future-wave-4b3-or-wave-4c2-by-explicit-follow-up-only',
  };
}

export function normalizeZavorthWave4B2MediumRiskExecutableCapabilitiesMilestoneReportFixture(
  overrides: Partial<ZavorthWave4B2MediumRiskExecutableMilestoneSource> = {},
): ZavorthWave4B2MediumRiskExecutableCapabilitiesMilestoneReportNormalization {
  return normalizeZavorthWave4B2MediumRiskExecutableCapabilitiesMilestoneReport({
    generatedAt: ZAVORTH_WAVE4B2_MEDIUM_RISK_EXECUTABLE_CAPABILITIES_MILESTONE_REPORT_NOW,
    runtimeId: ZAVORTH_WAVE4B2_MEDIUM_RISK_EXECUTABLE_CAPABILITIES_MILESTONE_REPORT_RUNTIME_ID,
    source: createZavorthWave4B2MediumRiskExecutableCapabilitiesMilestoneReportFixtureSource(overrides),
  });
}

export function createZavorthWave4B2MediumRiskExecutableCapabilitiesMilestoneReportFixture(
  overrides: Partial<ZavorthWave4B2MediumRiskExecutableMilestoneSource> = {},
): ZavorthWave4B2MediumRiskExecutableCapabilitiesMilestoneReport {
  return new ZavorthWave4B2MediumRiskExecutableCapabilitiesMilestoneReport(
    normalizeZavorthWave4B2MediumRiskExecutableCapabilitiesMilestoneReportFixture(overrides),
  );
}
