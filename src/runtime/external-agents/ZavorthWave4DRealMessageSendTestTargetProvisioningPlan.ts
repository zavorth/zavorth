export const ZAVORTH_WAVE4D_REAL_MESSAGE_SEND_TEST_TARGET_PROVISIONING_PLAN_NOW = '2026-05-01T08:00:00.000Z' as const;
export const ZAVORTH_WAVE4D_REAL_MESSAGE_SEND_TEST_TARGET_PROVISIONING_PLAN_RUNTIME_ID = 'zavorth-wave4d-real-message-send-test-target-provisioning-plan' as const;

export type ZavorthWave4DTestTargetProvisioningDecision =
  | 'blocked'
  | 'wave4d-real-message-send-test-target-provisioning-plan-ready';

export type ZavorthWave4DTestTargetType =
  | 'dry-run-to-live-test-sink'
  | 'local-test-harness'
  | 'operator-marked-external-test-target';

export type ZavorthWave4DTestTargetRequirementId =
  | 'approval-grant-required'
  | 'audit-receipt'
  | 'content-redacted-derived-only'
  | 'dry-run-before-live'
  | 'explicit-test-sandbox-marking'
  | 'idempotency-key'
  | 'native-target-session-channel-transport-resolution'
  | 'policy-test-send-allowed'
  | 'rate-limit'
  | 'rollback-compensation-recall'
  | 'secretref-secure-resolver';

export type ZavorthWave4DTestTargetBlockerId =
  | 'missing-approval-grant'
  | 'missing-dry-run-evidence'
  | 'missing-secretref'
  | 'policy-rejected'
  | 'rate-limit-missing'
  | 'rollback-compensation-missing'
  | 'target-not-marked-test-sandbox'
  | 'target-not-resolvable';

export type ZavorthWave4DTestTargetAcceptableType = {
  nativeContract: 'ZavorthWave4DTestTargetAcceptableType/v1';
  targetType: ZavorthWave4DTestTargetType;
  availableNow: boolean;
  explicitOperatorTestMarkRequired: boolean;
  explicitOperatorTestMarkPresent: boolean;
  acceptableForFutureLiveGate: boolean;
  notes: string;
  realMessageSendActuallyPerformed: false;
  transportActuallyOpened: false;
};

export type ZavorthWave4DTestTargetRequirement = {
  nativeContract: 'ZavorthWave4DTestTargetRequirement/v1';
  requirementId: ZavorthWave4DTestTargetRequirementId;
  label: string;
  currentDisposition:
    | 'available-by-metadata'
    | 'blocked-until-approval'
    | 'blocked-until-dry-run'
    | 'blocked-until-policy'
    | 'blocked-until-secretref'
    | 'blocked-until-test-target'
    | 'planned-required-before-live'
    | 'ready';
  evidenceGates: string[];
  requiredForFutureSend: true;
  rawSecretSerialized: false;
  rawContentUsageAllowed: false;
};

export type ZavorthWave4DTestTargetGoNoGoCriterion = {
  nativeContract: 'ZavorthWave4DTestTargetGoNoGoCriterion/v1';
  criterionId:
    | 'approval-grant-present'
    | 'audit-receipt-ready'
    | 'content-redacted-derived'
    | 'dry-run-passed'
    | 'idempotency-ready'
    | 'policy-test-send-allowed'
    | 'rate-limit-ready'
    | 'rollback-compensation-ready'
    | 'secretref-present-redacted'
    | 'target-marked-test-sandbox'
    | 'target-session-channel-transport-resolved';
  required: true;
  satisfiedNow: boolean;
  decision: 'go-ready-for-future-live-gate' | 'no-go-blocked';
  blockerId?: ZavorthWave4DTestTargetBlockerId;
  notes: string;
};

export type ZavorthWave4DTestTargetCandidate = {
  nativeContract: 'ZavorthWave4DTestTargetCandidate/v1';
  candidateId: 'wave4d-first-controlled-message-send-test-target-candidate';
  candidateStatus: 'prepared-not-executed';
  targetType: ZavorthWave4DTestTargetType;
  explicitlyMarkedTestSandbox: boolean;
  targetSessionChannelTransportResolvedByNativeMetadata: boolean;
  secretRefsAvailableAsResolver: boolean;
  policyAllowsTestSend: boolean;
  approvalGrantRequired: true;
  approvalGrantPresentNow: boolean;
  idempotencyKey: string;
  rateLimitRequired: true;
  rateLimitPlanAvailable: boolean;
  receiptAuditRequired: true;
  rollbackCompensationRecallRequired: true;
  rollbackCompensationPlanAvailable: boolean;
  dryRunRequiredBeforeFutureSend: true;
  dryRunEvidencePresent: boolean;
  contentPolicy: 'redacted-derived-approved-only';
  rawContentUsageAllowed: false;
  externalTransportExecutionDependency: 'explicit-execution-dependency-not-default-runtime';
  externalExecutorDefaultRuntimeRequired: false;
  realMessageSendActuallyPerformed: false;
  transportActuallyOpened: false;
  providerActuallyExecuted: false;
  toolCommandActuallyExecuted: false;
  externalExecutorMutationAllowed: false;
};

export type ZavorthWave4DTestTargetProvisioningEvidence = {
  nativeContract: 'ZavorthWave4DTestTargetProvisioningEvidence/v1';
  realMessageSendReadinessBy234: true;
  messageSendDryRunExecutablesBy230To233: true;
  targetSessionChannelTransportValidationBy222To225: true;
  sessionHistoryMetadataAndRedactedContentBy218To229: true;
  sessionStorageSchemaParityBy235: true;
  actionGovernancePipelineBy174To180: true;
  nativeIntegrationRegistryBy187: true;
  testTargetRequiredForFutureSend: true;
  approvalRequiredForFutureSend: true;
  dryRunRequiredBeforeFutureSend: true;
  runtimeExternalExecutorRequiredForNativeReadyPaths: false;
  rawSecretSerialized: false;
  rawMessageContentSerialized: false;
};

export type ZavorthWave4DTestTargetProvisioningGate = {
  wave4dTestTargetProvisioningPlanCreated: true;
  realMessageSendActuallyPerformed: false;
  transportActuallyOpened: false;
  testTargetRequiredForFutureSend: true;
  approvalRequiredForFutureSend: true;
  dryRunRequiredBeforeFutureSend: true;
  providerRealExecutionAllowed: false;
  toolCommandRealExecutionAllowed: false;
  externalExecutorMutationAllowed: false;
  rawContentUsageAllowed: false;
  rawSecretSerialized: false;
  sourceModuleCopied: false;
  adapterRemovalGlobalAllowed: false;
};

export type ZavorthWave4DRealMessageSendTestTargetProvisioningSource = {
  realMessageSendReadinessPlanReady: true;
  messageSendDryRunExecutablesReady: true;
  targetSessionChannelTransportValidationReady: true;
  sessionHistoryMetadataAndRedactedContentReady: true;
  sessionStorageSchemaParityReady: true;
  actionGovernancePipelineReady: true;
  nativeIntegrationRegistryReady: true;
  localTestHarnessAvailable: boolean;
  dryRunToLiveTestSinkAvailable: boolean;
  externalRealChannelCandidateAvailable: boolean;
  externalRealChannelOperatorMarkedTest: boolean;
  targetMarkedTestSandbox: boolean;
  targetSessionChannelTransportResolvedByNativeMetadata: boolean;
  secretRefsAvailableAsResolver: boolean;
  policyAllowsTestSend: boolean;
  approvalGrantPresentNow: boolean;
  rateLimitPlanAvailable: boolean;
  rollbackCompensationPlanAvailable: boolean;
  dryRunEvidencePresent: boolean;
  contentRedactedDerivedApproved: boolean;
  rawContentRequired: boolean;
  externalExecutorLiveRequiredForNativeReadyPaths: false;
  realMessageSendAttempted: false;
  transportOpenAttempted: false;
  providerExecutionAttempted: false;
  toolCommandExecutionAttempted: false;
  externalExecutorMutationAttempted: false;
  newStateMigrationAttempted: false;
  sourceModuleCopyAttempted: false;
  adapterRemovalAttempted: false;
  publicExternalExecutorIdentityExposed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4DRealMessageSendTestTargetProvisioningPlanNormalization = {
  nativeContract: 'ZavorthWave4DRealMessageSendTestTargetProvisioningPlan/v1';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4D_REAL_MESSAGE_SEND_TEST_TARGET_PROVISIONING_PLAN_RUNTIME_ID;
  decision: ZavorthWave4DTestTargetProvisioningDecision;
  status: 'blocked' | 'wave4d-real-message-send-test-target-provisioning-plan-ready';
  sourceReadiness: ZavorthWave4DRealMessageSendTestTargetProvisioningSource;
  acceptableTargetTypes: ZavorthWave4DTestTargetAcceptableType[];
  requirements: ZavorthWave4DTestTargetRequirement[];
  goNoGoCriteria: ZavorthWave4DTestTargetGoNoGoCriterion[];
  blockers: ZavorthWave4DTestTargetBlockerId[];
  testTargetCandidate: ZavorthWave4DTestTargetCandidate;
  evidence: ZavorthWave4DTestTargetProvisioningEvidence;
  executionGate: ZavorthWave4DTestTargetProvisioningGate;
  redaction: {
    rawSecretSerialized: false;
    rawMessageContentSerialized: false;
    sourceIdentityPublic: false;
    provenanceInternalOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'future-wave-4d-first-controlled-real-message-send-by-explicit-gate-only';
};

export type ZavorthWave4DRealMessageSendTestTargetProvisioningPlanOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4D_REAL_MESSAGE_SEND_TEST_TARGET_PROVISIONING_PLAN_RUNTIME_ID;
  source: ZavorthWave4DRealMessageSendTestTargetProvisioningSource;
};

function targetType(source: ZavorthWave4DRealMessageSendTestTargetProvisioningSource): ZavorthWave4DTestTargetType {
  if (source.localTestHarnessAvailable) {
    return 'local-test-harness';
  }
  if (source.dryRunToLiveTestSinkAvailable) {
    return 'dry-run-to-live-test-sink';
  }
  return 'operator-marked-external-test-target';
}

function acceptableTargetTypes(
  source: ZavorthWave4DRealMessageSendTestTargetProvisioningSource,
): ZavorthWave4DTestTargetAcceptableType[] {
  return [
    {
      nativeContract: 'ZavorthWave4DTestTargetAcceptableType/v1',
      targetType: 'local-test-harness',
      availableNow: source.localTestHarnessAvailable,
      explicitOperatorTestMarkRequired: false,
      explicitOperatorTestMarkPresent: true,
      acceptableForFutureLiveGate: source.localTestHarnessAvailable,
      notes: 'Preferred target when available because it stays test/sandbox scoped.',
      realMessageSendActuallyPerformed: false,
      transportActuallyOpened: false,
    },
    {
      nativeContract: 'ZavorthWave4DTestTargetAcceptableType/v1',
      targetType: 'dry-run-to-live-test-sink',
      availableNow: source.dryRunToLiveTestSinkAvailable,
      explicitOperatorTestMarkRequired: false,
      explicitOperatorTestMarkPresent: true,
      acceptableForFutureLiveGate: source.dryRunToLiveTestSinkAvailable,
      notes: 'Acceptable only as a test sink that cannot reach normal users.',
      realMessageSendActuallyPerformed: false,
      transportActuallyOpened: false,
    },
    {
      nativeContract: 'ZavorthWave4DTestTargetAcceptableType/v1',
      targetType: 'operator-marked-external-test-target',
      availableNow: source.externalRealChannelCandidateAvailable,
      explicitOperatorTestMarkRequired: true,
      explicitOperatorTestMarkPresent: source.externalRealChannelOperatorMarkedTest,
      acceptableForFutureLiveGate: source.externalRealChannelCandidateAvailable && source.externalRealChannelOperatorMarkedTest,
      notes: 'A real external channel is only acceptable when the operator explicitly marks it as a test target.',
      realMessageSendActuallyPerformed: false,
      transportActuallyOpened: false,
    },
  ];
}

function requirements(source: ZavorthWave4DRealMessageSendTestTargetProvisioningSource): ZavorthWave4DTestTargetRequirement[] {
  const rows: Array<Pick<ZavorthWave4DTestTargetRequirement, 'requirementId' | 'label' | 'currentDisposition' | 'evidenceGates'>> = [
    {
      requirementId: 'explicit-test-sandbox-marking',
      label: 'Future live send requires a target explicitly marked test/sandbox.',
      currentDisposition: source.targetMarkedTestSandbox ? 'available-by-metadata' : 'blocked-until-test-target',
      evidenceGates: ['223', '224', '234'],
    },
    {
      requirementId: 'native-target-session-channel-transport-resolution',
      label: 'Target/session/channel/transport must resolve from native metadata.',
      currentDisposition: source.targetSessionChannelTransportResolvedByNativeMetadata ? 'available-by-metadata' : 'blocked-until-test-target',
      evidenceGates: ['222', '223', '224', '231', '232'],
    },
    {
      requirementId: 'secretref-secure-resolver',
      label: 'SecretRefs must be available through a safe resolver and never serialized as values.',
      currentDisposition: source.secretRefsAvailableAsResolver ? 'available-by-metadata' : 'blocked-until-secretref',
      evidenceGates: ['157', '164', '187', '224', '234'],
    },
    {
      requirementId: 'policy-test-send-allowed',
      label: 'Zavorth policy must explicitly allow a test send in a future execution gate.',
      currentDisposition: source.policyAllowsTestSend ? 'ready' : 'blocked-until-policy',
      evidenceGates: ['174', '175', '178', '179', '180', '234'],
    },
    {
      requirementId: 'approval-grant-required',
      label: 'A real approval grant is mandatory before a future send.',
      currentDisposition: source.approvalGrantPresentNow ? 'ready' : 'blocked-until-approval',
      evidenceGates: ['178', '179', '180', '234'],
    },
    {
      requirementId: 'idempotency-key',
      label: 'A deterministic idempotency key is mandatory.',
      currentDisposition: 'ready',
      evidenceGates: ['175', '179', '180', '231', '232', '234'],
    },
    {
      requirementId: 'rate-limit',
      label: 'A rate-limit and retry envelope is mandatory.',
      currentDisposition: source.rateLimitPlanAvailable ? 'ready' : 'planned-required-before-live',
      evidenceGates: ['183', '187', '224', '232', '234'],
    },
    {
      requirementId: 'audit-receipt',
      label: 'A redacted receipt/audit trail is mandatory.',
      currentDisposition: 'ready',
      evidenceGates: ['174', '175', '180', '231', '232', '234'],
    },
    {
      requirementId: 'rollback-compensation-recall',
      label: 'Rollback/compensation/recall must be planned when applicable.',
      currentDisposition: source.rollbackCompensationPlanAvailable ? 'ready' : 'planned-required-before-live',
      evidenceGates: ['165', '166', '180', '234'],
    },
    {
      requirementId: 'dry-run-before-live',
      label: 'Dry-run evidence is mandatory before any future live send.',
      currentDisposition: source.dryRunEvidencePresent ? 'ready' : 'blocked-until-dry-run',
      evidenceGates: ['230', '231', '232', '233', '234'],
    },
    {
      requirementId: 'content-redacted-derived-only',
      label: 'Only redacted/derived approved content may be used.',
      currentDisposition: source.contentRedactedDerivedApproved && !source.rawContentRequired ? 'available-by-metadata' : 'planned-required-before-live',
      evidenceGates: ['226', '227', '228', '229', '231', '234', '235'],
    },
  ];

  return rows.map((row) => ({
    nativeContract: 'ZavorthWave4DTestTargetRequirement/v1',
    ...row,
    requiredForFutureSend: true,
    rawSecretSerialized: false,
    rawContentUsageAllowed: false,
  }));
}

function criterion(
  criterionId: ZavorthWave4DTestTargetGoNoGoCriterion['criterionId'],
  satisfiedNow: boolean,
  blockerId: ZavorthWave4DTestTargetBlockerId | undefined,
  notes: string,
): ZavorthWave4DTestTargetGoNoGoCriterion {
  return {
    nativeContract: 'ZavorthWave4DTestTargetGoNoGoCriterion/v1',
    criterionId,
    required: true,
    satisfiedNow,
    decision: satisfiedNow ? 'go-ready-for-future-live-gate' : 'no-go-blocked',
    ...(blockerId && !satisfiedNow ? { blockerId } : {}),
    notes,
  };
}

function goNoGoCriteria(source: ZavorthWave4DRealMessageSendTestTargetProvisioningSource): ZavorthWave4DTestTargetGoNoGoCriterion[] {
  return [
    criterion('target-marked-test-sandbox', source.targetMarkedTestSandbox, 'target-not-marked-test-sandbox', 'The candidate target must be explicitly test/sandbox scoped.'),
    criterion('target-session-channel-transport-resolved', source.targetSessionChannelTransportResolvedByNativeMetadata, 'target-not-resolvable', 'Native metadata must resolve target/session/channel/transport.'),
    criterion('secretref-present-redacted', source.secretRefsAvailableAsResolver, 'missing-secretref', 'SecretRef must be available as resolver metadata only.'),
    criterion('policy-test-send-allowed', source.policyAllowsTestSend, 'policy-rejected', 'Policy must explicitly allow a future test send.'),
    criterion('approval-grant-present', source.approvalGrantPresentNow, 'missing-approval-grant', 'A real approval grant is required by the future send gate.'),
    criterion('idempotency-ready', true, undefined, 'The target provisioning plan produces a deterministic idempotency key.'),
    criterion('rate-limit-ready', source.rateLimitPlanAvailable, 'rate-limit-missing', 'Rate-limit envelope must be ready before future live send.'),
    criterion('audit-receipt-ready', true, undefined, 'The future live gate must produce a redacted audit receipt.'),
    criterion('rollback-compensation-ready', source.rollbackCompensationPlanAvailable, 'rollback-compensation-missing', 'Rollback/compensation/recall must be planned where applicable.'),
    criterion('dry-run-passed', source.dryRunEvidencePresent, 'missing-dry-run-evidence', 'Message-send dry-run and target resolution dry-run must pass before live.'),
    criterion('content-redacted-derived', source.contentRedactedDerivedApproved && !source.rawContentRequired, undefined, 'Only redacted/derived approved content may be used.'),
  ];
}

function blockers(criteria: ZavorthWave4DTestTargetGoNoGoCriterion[]): ZavorthWave4DTestTargetBlockerId[] {
  return Array.from(new Set(criteria.flatMap((item) => item.blockerId ? [item.blockerId] : [])));
}

function candidate(source: ZavorthWave4DRealMessageSendTestTargetProvisioningSource): ZavorthWave4DTestTargetCandidate {
  const selectedTargetType = targetType(source);
  return {
    nativeContract: 'ZavorthWave4DTestTargetCandidate/v1',
    candidateId: 'wave4d-first-controlled-message-send-test-target-candidate',
    candidateStatus: 'prepared-not-executed',
    targetType: selectedTargetType,
    explicitlyMarkedTestSandbox: source.targetMarkedTestSandbox &&
      (selectedTargetType !== 'operator-marked-external-test-target' || source.externalRealChannelOperatorMarkedTest),
    targetSessionChannelTransportResolvedByNativeMetadata: source.targetSessionChannelTransportResolvedByNativeMetadata,
    secretRefsAvailableAsResolver: source.secretRefsAvailableAsResolver,
    policyAllowsTestSend: source.policyAllowsTestSend,
    approvalGrantRequired: true,
    approvalGrantPresentNow: source.approvalGrantPresentNow,
    idempotencyKey: [
      'zavorth-wave4d-test-target-provisioning',
      selectedTargetType,
      source.targetMarkedTestSandbox ? 'test-marked' : 'test-unmarked',
      source.targetSessionChannelTransportResolvedByNativeMetadata ? 'resolved' : 'unresolved',
      source.secretRefsAvailableAsResolver ? 'secretref-ready' : 'secretref-missing',
    ].join(':'),
    rateLimitRequired: true,
    rateLimitPlanAvailable: source.rateLimitPlanAvailable,
    receiptAuditRequired: true,
    rollbackCompensationRecallRequired: true,
    rollbackCompensationPlanAvailable: source.rollbackCompensationPlanAvailable,
    dryRunRequiredBeforeFutureSend: true,
    dryRunEvidencePresent: source.dryRunEvidencePresent,
    contentPolicy: 'redacted-derived-approved-only',
    rawContentUsageAllowed: false,
    externalTransportExecutionDependency: 'explicit-execution-dependency-not-default-runtime',
    externalExecutorDefaultRuntimeRequired: false,
    realMessageSendActuallyPerformed: false,
    transportActuallyOpened: false,
    providerActuallyExecuted: false,
    toolCommandActuallyExecuted: false,
    externalExecutorMutationAllowed: false,
  };
}

function evidence(): ZavorthWave4DTestTargetProvisioningEvidence {
  return {
    nativeContract: 'ZavorthWave4DTestTargetProvisioningEvidence/v1',
    realMessageSendReadinessBy234: true,
    messageSendDryRunExecutablesBy230To233: true,
    targetSessionChannelTransportValidationBy222To225: true,
    sessionHistoryMetadataAndRedactedContentBy218To229: true,
    sessionStorageSchemaParityBy235: true,
    actionGovernancePipelineBy174To180: true,
    nativeIntegrationRegistryBy187: true,
    testTargetRequiredForFutureSend: true,
    approvalRequiredForFutureSend: true,
    dryRunRequiredBeforeFutureSend: true,
    runtimeExternalExecutorRequiredForNativeReadyPaths: false,
    rawSecretSerialized: false,
    rawMessageContentSerialized: false,
  };
}

function executionGate(): ZavorthWave4DTestTargetProvisioningGate {
  return {
    wave4dTestTargetProvisioningPlanCreated: true,
    realMessageSendActuallyPerformed: false,
    transportActuallyOpened: false,
    testTargetRequiredForFutureSend: true,
    approvalRequiredForFutureSend: true,
    dryRunRequiredBeforeFutureSend: true,
    providerRealExecutionAllowed: false,
    toolCommandRealExecutionAllowed: false,
    externalExecutorMutationAllowed: false,
    rawContentUsageAllowed: false,
    rawSecretSerialized: false,
    sourceModuleCopied: false,
    adapterRemovalGlobalAllowed: false,
  };
}

function sourceReady(source: ZavorthWave4DRealMessageSendTestTargetProvisioningSource): boolean {
  return (
    source.realMessageSendReadinessPlanReady &&
    source.messageSendDryRunExecutablesReady &&
    source.targetSessionChannelTransportValidationReady &&
    source.sessionHistoryMetadataAndRedactedContentReady &&
    source.sessionStorageSchemaParityReady &&
    source.actionGovernancePipelineReady &&
    source.nativeIntegrationRegistryReady &&
    !source.externalExecutorLiveRequiredForNativeReadyPaths &&
    !source.realMessageSendAttempted &&
    !source.transportOpenAttempted &&
    !source.providerExecutionAttempted &&
    !source.toolCommandExecutionAttempted &&
    !source.externalExecutorMutationAttempted &&
    !source.newStateMigrationAttempted &&
    !source.sourceModuleCopyAttempted &&
    !source.adapterRemovalAttempted &&
    !source.publicExternalExecutorIdentityExposed &&
    !source.rawSecretSerialized
  );
}

export class ZavorthWave4DRealMessageSendTestTargetProvisioningPlan {
  public constructor(public readonly normalization: ZavorthWave4DRealMessageSendTestTargetProvisioningPlanNormalization) {}

  public requirementIds(): ZavorthWave4DTestTargetRequirementId[] {
    return this.normalization.requirements.map((requirement) => requirement.requirementId);
  }

  public goNoGoBlockerIds(): ZavorthWave4DTestTargetBlockerId[] {
    return this.normalization.blockers;
  }

  public candidatePreparedNotExecuted(): boolean {
    return this.normalization.testTargetCandidate.candidateStatus === 'prepared-not-executed' &&
      !this.normalization.testTargetCandidate.realMessageSendActuallyPerformed &&
      !this.normalization.testTargetCandidate.transportActuallyOpened;
  }

  public acceptableTargetTypeIds(): ZavorthWave4DTestTargetType[] {
    return this.normalization.acceptableTargetTypes
      .filter((target) => target.acceptableForFutureLiveGate)
      .map((target) => target.targetType);
  }
}

export function createZavorthWave4DRealMessageSendTestTargetProvisioningPlanFixtureSource(
  overrides: Partial<ZavorthWave4DRealMessageSendTestTargetProvisioningSource> = {},
): ZavorthWave4DRealMessageSendTestTargetProvisioningSource {
  return {
    realMessageSendReadinessPlanReady: true,
    messageSendDryRunExecutablesReady: true,
    targetSessionChannelTransportValidationReady: true,
    sessionHistoryMetadataAndRedactedContentReady: true,
    sessionStorageSchemaParityReady: true,
    actionGovernancePipelineReady: true,
    nativeIntegrationRegistryReady: true,
    localTestHarnessAvailable: true,
    dryRunToLiveTestSinkAvailable: false,
    externalRealChannelCandidateAvailable: false,
    externalRealChannelOperatorMarkedTest: false,
    targetMarkedTestSandbox: true,
    targetSessionChannelTransportResolvedByNativeMetadata: true,
    secretRefsAvailableAsResolver: true,
    policyAllowsTestSend: true,
    approvalGrantPresentNow: false,
    rateLimitPlanAvailable: true,
    rollbackCompensationPlanAvailable: false,
    dryRunEvidencePresent: true,
    contentRedactedDerivedApproved: true,
    rawContentRequired: false,
    externalExecutorLiveRequiredForNativeReadyPaths: false,
    realMessageSendAttempted: false,
    transportOpenAttempted: false,
    providerExecutionAttempted: false,
    toolCommandExecutionAttempted: false,
    externalExecutorMutationAttempted: false,
    newStateMigrationAttempted: false,
    sourceModuleCopyAttempted: false,
    adapterRemovalAttempted: false,
    publicExternalExecutorIdentityExposed: false,
    rawSecretSerialized: false,
    ...overrides,
  };
}

export function normalizeZavorthWave4DRealMessageSendTestTargetProvisioningPlan(
  options: ZavorthWave4DRealMessageSendTestTargetProvisioningPlanOptions,
): ZavorthWave4DRealMessageSendTestTargetProvisioningPlanNormalization {
  const targetTypes = acceptableTargetTypes(options.source);
  const targetRequirements = requirements(options.source);
  const checklist = goNoGoCriteria(options.source);
  const targetBlockers = blockers(checklist);
  const testCandidate = candidate(options.source);
  const gate = executionGate();
  const ready = sourceReady(options.source) &&
    testCandidate.candidateStatus === 'prepared-not-executed' &&
    !testCandidate.realMessageSendActuallyPerformed &&
    !testCandidate.transportActuallyOpened &&
    !options.source.rawContentRequired &&
    !options.source.realMessageSendAttempted &&
    !options.source.transportOpenAttempted &&
    !options.source.providerExecutionAttempted &&
    !options.source.toolCommandExecutionAttempted &&
    !options.source.externalExecutorMutationAttempted &&
    !options.source.rawSecretSerialized;

  return {
    nativeContract: 'ZavorthWave4DRealMessageSendTestTargetProvisioningPlan/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'wave4d-real-message-send-test-target-provisioning-plan-ready' : 'blocked',
    status: ready ? 'wave4d-real-message-send-test-target-provisioning-plan-ready' : 'blocked',
    sourceReadiness: options.source,
    acceptableTargetTypes: targetTypes,
    requirements: targetRequirements,
    goNoGoCriteria: checklist,
    blockers: targetBlockers,
    testTargetCandidate: testCandidate,
    evidence: evidence(),
    executionGate: gate,
    redaction: {
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      sourceIdentityPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'future-wave-4d-first-controlled-real-message-send-by-explicit-gate-only',
  };
}

export function normalizeZavorthWave4DRealMessageSendTestTargetProvisioningPlanFixture(
  overrides: Partial<ZavorthWave4DRealMessageSendTestTargetProvisioningSource> = {},
): ZavorthWave4DRealMessageSendTestTargetProvisioningPlanNormalization {
  return normalizeZavorthWave4DRealMessageSendTestTargetProvisioningPlan({
    generatedAt: ZAVORTH_WAVE4D_REAL_MESSAGE_SEND_TEST_TARGET_PROVISIONING_PLAN_NOW,
    runtimeId: ZAVORTH_WAVE4D_REAL_MESSAGE_SEND_TEST_TARGET_PROVISIONING_PLAN_RUNTIME_ID,
    source: createZavorthWave4DRealMessageSendTestTargetProvisioningPlanFixtureSource(overrides),
  });
}

export function createZavorthWave4DRealMessageSendTestTargetProvisioningPlanFixture(
  overrides: Partial<ZavorthWave4DRealMessageSendTestTargetProvisioningSource> = {},
): ZavorthWave4DRealMessageSendTestTargetProvisioningPlan {
  return new ZavorthWave4DRealMessageSendTestTargetProvisioningPlan(
    normalizeZavorthWave4DRealMessageSendTestTargetProvisioningPlanFixture(overrides),
  );
}
