export const ZAVORTH_WAVE4B_LOW_RISK_EXECUTABLE_CAPABILITIES_MILESTONE_REPORT_NOW = '2026-04-30T13:00:00.000Z' as const;
export const ZAVORTH_WAVE4B_LOW_RISK_EXECUTABLE_CAPABILITIES_MILESTONE_REPORT_RUNTIME_ID = 'zavorth-wave4b-low-risk-executable-capabilities-milestone-report' as const;

export type ZavorthWave4BLowRiskExecutableMilestoneDecision =
  | 'blocked'
  | 'wave4b-low-risk-executable-capabilities-milestone-recorded';

export type ZavorthWave4BLowRiskExecutableCapabilityId =
  | 'metadata-validation-action'
  | 'native-registry-reconciliation-commit-action'
  | 'production-snapshot-verify-repair-action';

export type ZavorthWave4BBlockedExecutableCapabilityId =
  | 'external-executor-mutation'
  | 'provider-execution'
  | 'real-message-send'
  | 'sqlite-session-history-raw-migration'
  | 'tool-command-execution'
  | 'workspace-log-cache-raw-migration';

export type ZavorthWave4BLowRiskExecutableMilestoneCapability = {
  nativeContract: 'ZavorthWave4BLowRiskExecutableMilestoneCapability/v1';
  capabilityId: ZavorthWave4BLowRiskExecutableCapabilityId;
  label: string;
  classification: 'absorbed-low-risk-executable';
  ownership: 'Zavorth-owned';
  risk: 'low-risk';
  idempotent: true;
  storageNativeRegistryScoped: true;
  runtimeExternalExecutorRequired: false;
  externalSideEffects: false;
  featureFlag: string;
  safetyGate: 'feature-flag';
  policyRecheckRequired: true;
  receiptContract: string;
  rollbackCleanupEvidence: true;
  redactionScanPassed: true;
  tests: string[];
  evidenceGates: string[];
  highImpactExecutionBlocked: true;
  rawSecretSerialized: false;
};

export type ZavorthWave4BBlockedExecutableCapability = {
  nativeContract: 'ZavorthWave4BBlockedExecutableCapability/v1';
  capabilityId: ZavorthWave4BBlockedExecutableCapabilityId;
  label: string;
  classification: 'blocked';
  reason: string;
  futureGateRequired: true;
  highImpactExecutionStillBlocked: true;
  runtimeExternalExecutorRequiredForLowRiskExecutables: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4BLowRiskExecutableMilestoneEvidence = {
  nativeContract: 'ZavorthWave4BLowRiskExecutableMilestoneEvidence/v1';
  selectionBy213: true;
  metadataValidationBy214: true;
  reconciliationCommitBy215: true;
  productionSnapshotVerifyRepairBy216: true;
  actionGovernancePipelineReady: true;
  nativeRegistriesReady: true;
  wave4aMigrationReady: true;
  wave3AbsorptionHardeningReady: true;
  receiptsAuditReady: true;
  rollbackCleanupVerified: true;
  redactionScansPassed: true;
  runtimeExternalExecutorRequiredForMilestone: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4BLowRiskExecutableNextRecommendation = {
  nativeContract: 'ZavorthWave4BLowRiskExecutableNextRecommendation/v1';
  primaryRecommendation: 'wave-4b.2-medium-risk-executable-capabilities';
  alternateRecommendation: 'wave-4c-controlled-session-history-migration';
  rationale: string;
  prerequisites: string[];
  stillBlocked: ZavorthWave4BBlockedExecutableCapabilityId[];
  highImpactExecutionStillBlocked: true;
  adapterRemovalGlobalAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4BLowRiskExecutableMilestoneGate = {
  wave4bLowRiskExecutableMilestoneCreated: true;
  lowRiskExecutablesAbsorbedAsZavorthOwned: true;
  highImpactExecutionStillBlocked: true;
  messageSendRealAllowed: false;
  providerExecutionRealAllowed: false;
  toolCommandExecutionRealAllowed: false;
  externalExecutorMutationAllowed: false;
  runtimeExternalExecutorRequiredForLowRiskExecutables: false;
  stateMigrated: false;
  sourceModuleCopied: false;
  adapterRemovalGlobalAllowed: false;
  rawSecretSerialized: false;
  newExecutableCapabilityExecutedByReport: false;
};

export type ZavorthWave4BLowRiskExecutableMilestoneSource = {
  lowRiskSelectionReady: true;
  metadataValidationReady: true;
  nativeRegistryReconciliationCommitReady: true;
  productionSnapshotVerifyRepairReady: true;
  actionGovernancePipelineReady: true;
  nativeRegistriesReady: true;
  wave4aMigrationReady: true;
  wave3AbsorptionHardeningReady: true;
  externalExecutorLiveRequiredForMilestone: false;
  newCapabilityExecutionAttempted: false;
  messageSendAttempted: false;
  providerExecutionAttempted: false;
  toolCommandExecutionAttempted: false;
  externalExecutorMutationAttempted: false;
  stateMigrationAttempted: false;
  sourceModuleCopyAttempted: false;
  adapterRemovalAttempted: false;
  publicExternalExecutorIdentityExposed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4BLowRiskExecutableCapabilitiesMilestoneReportNormalization = {
  nativeContract: 'ZavorthWave4BLowRiskExecutableCapabilitiesMilestoneReport/v1';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4B_LOW_RISK_EXECUTABLE_CAPABILITIES_MILESTONE_REPORT_RUNTIME_ID;
  decision: ZavorthWave4BLowRiskExecutableMilestoneDecision;
  status: 'blocked' | 'wave4b-low-risk-executable-capabilities-milestone-recorded';
  sourceReadiness: ZavorthWave4BLowRiskExecutableMilestoneSource;
  absorbedCapabilities: ZavorthWave4BLowRiskExecutableMilestoneCapability[];
  blockedCapabilities: ZavorthWave4BBlockedExecutableCapability[];
  evidence: ZavorthWave4BLowRiskExecutableMilestoneEvidence;
  nextRecommendation: ZavorthWave4BLowRiskExecutableNextRecommendation;
  executionGate: ZavorthWave4BLowRiskExecutableMilestoneGate;
  redaction: {
    rawSecretSerialized: false;
    rawMessageContentSerialized: false;
    sourceIdentityPublic: false;
    provenanceInternalOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'wave-4b.2-medium-risk-executable-capabilities-or-wave-4c-controlled-session-history-migration';
};

export type ZavorthWave4BLowRiskExecutableCapabilitiesMilestoneReportOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4B_LOW_RISK_EXECUTABLE_CAPABILITIES_MILESTONE_REPORT_RUNTIME_ID;
  source: ZavorthWave4BLowRiskExecutableMilestoneSource;
};

function absorbedCapabilities(): ZavorthWave4BLowRiskExecutableMilestoneCapability[] {
  return [
    {
      nativeContract: 'ZavorthWave4BLowRiskExecutableMilestoneCapability/v1',
      capabilityId: 'metadata-validation-action',
      label: 'Metadata validation action',
      classification: 'absorbed-low-risk-executable',
      ownership: 'Zavorth-owned',
      risk: 'low-risk',
      idempotent: true,
      storageNativeRegistryScoped: true,
      runtimeExternalExecutorRequired: false,
      externalSideEffects: false,
      featureFlag: 'ZAVORTH_WAVE4B_METADATA_VALIDATION_EXECUTE',
      safetyGate: 'feature-flag',
      policyRecheckRequired: true,
      receiptContract: 'ZavorthWave4BMetadataValidationReceipt/v1',
      rollbackCleanupEvidence: true,
      redactionScanPassed: true,
      tests: ['ZavorthWave4BFirstLowRiskMetadataValidationExecutable.test.ts'],
      evidenceGates: ['213', '214', '174', '175', '180', '210', '211'],
      highImpactExecutionBlocked: true,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthWave4BLowRiskExecutableMilestoneCapability/v1',
      capabilityId: 'native-registry-reconciliation-commit-action',
      label: 'Native registry reconciliation commit action',
      classification: 'absorbed-low-risk-executable',
      ownership: 'Zavorth-owned',
      risk: 'low-risk',
      idempotent: true,
      storageNativeRegistryScoped: true,
      runtimeExternalExecutorRequired: false,
      externalSideEffects: false,
      featureFlag: 'ZAVORTH_WAVE4B_REGISTRY_RECONCILIATION_COMMIT_EXECUTE',
      safetyGate: 'feature-flag',
      policyRecheckRequired: true,
      receiptContract: 'ZavorthWave4BRegistryReconciliationCommitReceipt/v1',
      rollbackCleanupEvidence: true,
      redactionScanPassed: true,
      tests: ['ZavorthWave4BLowRiskNativeRegistryReconciliationCommitExecutable.test.ts'],
      evidenceGates: ['213', '215', '202', '210', '211', '174', '180'],
      highImpactExecutionBlocked: true,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthWave4BLowRiskExecutableMilestoneCapability/v1',
      capabilityId: 'production-snapshot-verify-repair-action',
      label: 'Production snapshot verify/repair action',
      classification: 'absorbed-low-risk-executable',
      ownership: 'Zavorth-owned',
      risk: 'low-risk',
      idempotent: true,
      storageNativeRegistryScoped: true,
      runtimeExternalExecutorRequired: false,
      externalSideEffects: false,
      featureFlag: 'ZAVORTH_WAVE4B_PRODUCTION_SNAPSHOT_REPAIR_EXECUTE',
      safetyGate: 'feature-flag',
      policyRecheckRequired: true,
      receiptContract: 'ZavorthWave4BProductionSnapshotVerifyRepairReceipt/v1',
      rollbackCleanupEvidence: true,
      redactionScanPassed: true,
      tests: ['ZavorthWave4BLowRiskProductionSnapshotVerifyRepairExecutable.test.ts'],
      evidenceGates: ['213', '216', '194', '195', '196', '197', '198', '199', '214', '215'],
      highImpactExecutionBlocked: true,
      rawSecretSerialized: false,
    },
  ];
}

function blockedCapabilities(): ZavorthWave4BBlockedExecutableCapability[] {
  return [
    {
      nativeContract: 'ZavorthWave4BBlockedExecutableCapability/v1',
      capabilityId: 'real-message-send',
      label: 'Real message send',
      classification: 'blocked',
      reason: 'Message send requires a future explicit medium/high-risk approval and transport gate.',
      futureGateRequired: true,
      highImpactExecutionStillBlocked: true,
      runtimeExternalExecutorRequiredForLowRiskExecutables: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthWave4BBlockedExecutableCapability/v1',
      capabilityId: 'provider-execution',
      label: 'Provider execution',
      classification: 'blocked',
      reason: 'Provider execution remains outside low-risk registry/storage-scoped actions.',
      futureGateRequired: true,
      highImpactExecutionStillBlocked: true,
      runtimeExternalExecutorRequiredForLowRiskExecutables: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthWave4BBlockedExecutableCapability/v1',
      capabilityId: 'tool-command-execution',
      label: 'Tool/command execution',
      classification: 'blocked',
      reason: 'Tool and command execution require separate policy, approval, sandbox, and receipt gates.',
      futureGateRequired: true,
      highImpactExecutionStillBlocked: true,
      runtimeExternalExecutorRequiredForLowRiskExecutables: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthWave4BBlockedExecutableCapability/v1',
      capabilityId: 'external-executor-mutation',
      label: 'ExternalExecutor mutation',
      classification: 'blocked',
      reason: 'Mutating ExternalExecutor remains blocked by the low-risk milestone scope.',
      futureGateRequired: true,
      highImpactExecutionStillBlocked: true,
      runtimeExternalExecutorRequiredForLowRiskExecutables: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthWave4BBlockedExecutableCapability/v1',
      capabilityId: 'sqlite-session-history-raw-migration',
      label: 'SQLite/session history raw migration',
      classification: 'blocked',
      reason: 'Raw session/history migration requires a future Wave 4C-style migration gate.',
      futureGateRequired: true,
      highImpactExecutionStillBlocked: true,
      runtimeExternalExecutorRequiredForLowRiskExecutables: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthWave4BBlockedExecutableCapability/v1',
      capabilityId: 'workspace-log-cache-raw-migration',
      label: 'Workspace/log/cache raw migration',
      classification: 'blocked',
      reason: 'Raw workspace, log, and cache data remain outside low-risk executable capabilities.',
      futureGateRequired: true,
      highImpactExecutionStillBlocked: true,
      runtimeExternalExecutorRequiredForLowRiskExecutables: false,
      rawSecretSerialized: false,
    },
  ];
}

function evidence(): ZavorthWave4BLowRiskExecutableMilestoneEvidence {
  return {
    nativeContract: 'ZavorthWave4BLowRiskExecutableMilestoneEvidence/v1',
    selectionBy213: true,
    metadataValidationBy214: true,
    reconciliationCommitBy215: true,
    productionSnapshotVerifyRepairBy216: true,
    actionGovernancePipelineReady: true,
    nativeRegistriesReady: true,
    wave4aMigrationReady: true,
    wave3AbsorptionHardeningReady: true,
    receiptsAuditReady: true,
    rollbackCleanupVerified: true,
    redactionScansPassed: true,
    runtimeExternalExecutorRequiredForMilestone: false,
    rawSecretSerialized: false,
  };
}

function nextRecommendation(
  blocked: ZavorthWave4BBlockedExecutableCapability[],
): ZavorthWave4BLowRiskExecutableNextRecommendation {
  return {
    nativeContract: 'ZavorthWave4BLowRiskExecutableNextRecommendation/v1',
    primaryRecommendation: 'wave-4b.2-medium-risk-executable-capabilities',
    alternateRecommendation: 'wave-4c-controlled-session-history-migration',
    rationale: 'The low-risk executable block proved Zavorth-owned registry/storage scoped actions. The next useful step is either medium-risk executable capabilities or controlled session/history migration, while high-impact execution remains blocked.',
    prerequisites: [
      'keep ExternalExecutor out of the default execution path',
      'preserve feature flags and policy recheck before executable commits',
      'preserve rollback/cleanup receipts for every storage mutation',
      'keep message/provider/tool/command execution blocked until a future gate',
    ],
    stillBlocked: blocked.map((item) => item.capabilityId),
    highImpactExecutionStillBlocked: true,
    adapterRemovalGlobalAllowed: false,
    rawSecretSerialized: false,
  };
}

function executionGate(): ZavorthWave4BLowRiskExecutableMilestoneGate {
  return {
    wave4bLowRiskExecutableMilestoneCreated: true,
    lowRiskExecutablesAbsorbedAsZavorthOwned: true,
    highImpactExecutionStillBlocked: true,
    messageSendRealAllowed: false,
    providerExecutionRealAllowed: false,
    toolCommandExecutionRealAllowed: false,
    externalExecutorMutationAllowed: false,
    runtimeExternalExecutorRequiredForLowRiskExecutables: false,
    stateMigrated: false,
    sourceModuleCopied: false,
    adapterRemovalGlobalAllowed: false,
    rawSecretSerialized: false,
    newExecutableCapabilityExecutedByReport: false,
  };
}

function sourceReady(source: ZavorthWave4BLowRiskExecutableMilestoneSource): boolean {
  return (
    source.lowRiskSelectionReady &&
    source.metadataValidationReady &&
    source.nativeRegistryReconciliationCommitReady &&
    source.productionSnapshotVerifyRepairReady &&
    source.actionGovernancePipelineReady &&
    source.nativeRegistriesReady &&
    source.wave4aMigrationReady &&
    source.wave3AbsorptionHardeningReady &&
    !source.externalExecutorLiveRequiredForMilestone &&
    !source.newCapabilityExecutionAttempted &&
    !source.messageSendAttempted &&
    !source.providerExecutionAttempted &&
    !source.toolCommandExecutionAttempted &&
    !source.externalExecutorMutationAttempted &&
    !source.stateMigrationAttempted &&
    !source.sourceModuleCopyAttempted &&
    !source.adapterRemovalAttempted &&
    !source.publicExternalExecutorIdentityExposed &&
    !source.rawSecretSerialized
  );
}

export class ZavorthWave4BLowRiskExecutableCapabilitiesMilestoneReport {
  public constructor(public readonly normalization: ZavorthWave4BLowRiskExecutableCapabilitiesMilestoneReportNormalization) {}

  public absorbedCapabilityIds(): ZavorthWave4BLowRiskExecutableCapabilityId[] {
    return this.normalization.absorbedCapabilities.map((capability) => capability.capabilityId);
  }

  public blockedCapabilityIds(): ZavorthWave4BBlockedExecutableCapabilityId[] {
    return this.normalization.blockedCapabilities.map((capability) => capability.capabilityId);
  }
}

export function createZavorthWave4BLowRiskExecutableCapabilitiesMilestoneReportFixtureSource(
  overrides: Partial<ZavorthWave4BLowRiskExecutableMilestoneSource> = {},
): ZavorthWave4BLowRiskExecutableMilestoneSource {
  return {
    lowRiskSelectionReady: true,
    metadataValidationReady: true,
    nativeRegistryReconciliationCommitReady: true,
    productionSnapshotVerifyRepairReady: true,
    actionGovernancePipelineReady: true,
    nativeRegistriesReady: true,
    wave4aMigrationReady: true,
    wave3AbsorptionHardeningReady: true,
    externalExecutorLiveRequiredForMilestone: false,
    newCapabilityExecutionAttempted: false,
    messageSendAttempted: false,
    providerExecutionAttempted: false,
    toolCommandExecutionAttempted: false,
    externalExecutorMutationAttempted: false,
    stateMigrationAttempted: false,
    sourceModuleCopyAttempted: false,
    adapterRemovalAttempted: false,
    publicExternalExecutorIdentityExposed: false,
    rawSecretSerialized: false,
    ...overrides,
  };
}

export function normalizeZavorthWave4BLowRiskExecutableCapabilitiesMilestoneReport(
  options: ZavorthWave4BLowRiskExecutableCapabilitiesMilestoneReportOptions,
): ZavorthWave4BLowRiskExecutableCapabilitiesMilestoneReportNormalization {
  const absorbed = absorbedCapabilities();
  const blocked = blockedCapabilities();
  const milestoneEvidence = evidence();
  const recommendation = nextRecommendation(blocked);
  const gate = executionGate();
  const ready = sourceReady(options.source) &&
    absorbed.length === 3 &&
    blocked.length === 6 &&
    absorbed.every((capability) => (
      capability.ownership === 'Zavorth-owned' &&
      capability.risk === 'low-risk' &&
      capability.idempotent &&
      capability.storageNativeRegistryScoped &&
      !capability.runtimeExternalExecutorRequired &&
      !capability.externalSideEffects &&
      capability.policyRecheckRequired &&
      capability.rollbackCleanupEvidence &&
      capability.redactionScanPassed
    )) &&
    recommendation.primaryRecommendation === 'wave-4b.2-medium-risk-executable-capabilities' &&
    recommendation.alternateRecommendation === 'wave-4c-controlled-session-history-migration';

  return {
    nativeContract: 'ZavorthWave4BLowRiskExecutableCapabilitiesMilestoneReport/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'wave4b-low-risk-executable-capabilities-milestone-recorded' : 'blocked',
    status: ready ? 'wave4b-low-risk-executable-capabilities-milestone-recorded' : 'blocked',
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
    nextGateRecommended: 'wave-4b.2-medium-risk-executable-capabilities-or-wave-4c-controlled-session-history-migration',
  };
}

export function normalizeZavorthWave4BLowRiskExecutableCapabilitiesMilestoneReportFixture(
  overrides: Partial<ZavorthWave4BLowRiskExecutableMilestoneSource> = {},
): ZavorthWave4BLowRiskExecutableCapabilitiesMilestoneReportNormalization {
  return normalizeZavorthWave4BLowRiskExecutableCapabilitiesMilestoneReport({
    generatedAt: ZAVORTH_WAVE4B_LOW_RISK_EXECUTABLE_CAPABILITIES_MILESTONE_REPORT_NOW,
    runtimeId: ZAVORTH_WAVE4B_LOW_RISK_EXECUTABLE_CAPABILITIES_MILESTONE_REPORT_RUNTIME_ID,
    source: createZavorthWave4BLowRiskExecutableCapabilitiesMilestoneReportFixtureSource(overrides),
  });
}

export function createZavorthWave4BLowRiskExecutableCapabilitiesMilestoneReportFixture(
  overrides: Partial<ZavorthWave4BLowRiskExecutableMilestoneSource> = {},
): ZavorthWave4BLowRiskExecutableCapabilitiesMilestoneReport {
  return new ZavorthWave4BLowRiskExecutableCapabilitiesMilestoneReport(
    normalizeZavorthWave4BLowRiskExecutableCapabilitiesMilestoneReportFixture(overrides),
  );
}
