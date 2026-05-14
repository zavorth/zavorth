import {
  createZavorthWave4C3SessionStorageSchemaParityAbsorptionPackFixture,
} from './ZavorthWave4C3SessionStorageSchemaParityAbsorptionPack.js';
import type {
  ZavorthWave4C3SessionStorageSchemaParityAbsorptionPackNormalization,
} from './ZavorthWave4C3SessionStorageSchemaParityAbsorptionPack.js';

export const ZAVORTH_OPTIONAL_RAW_HISTORY_SQLITE_IMPORTER_DESIGN_PACK_NOW = '2026-05-01T20:00:00.000Z' as const;
export const ZAVORTH_OPTIONAL_RAW_HISTORY_SQLITE_IMPORTER_DESIGN_PACK_RUNTIME_ID = 'zavorth-optional-raw-history-sqlite-importer-design-pack' as const;

export type OptionalRawHistorySqliteImporterMode =
  | 'blocked'
  | 'disabled'
  | 'preview-only'
  | 'raw-import-future-explicit-consent'
  | 'redacted-import-future';

export type OptionalRawHistorySqliteImporterDecision =
  | 'blocked'
  | 'optional-raw-history-sqlite-importer-design-ready';

export type OptionalRawHistorySqliteSourceDbState =
  | 'compatible-for-preview'
  | 'corrupt'
  | 'incompatible'
  | 'known-empty-or-test-only'
  | 'not-provided'
  | 'unknown';

export type OptionalRawHistorySqliteSourceDbOutcome =
  | 'blocked-corrupt-db'
  | 'blocked-incompatible-db'
  | 'blocked-unknown-db'
  | 'disabled-no-source'
  | 'preview-compatible'
  | 'read-only-reference-only';

export type OptionalRawHistorySqliteImporterModePolicy = {
  nativeContract: 'OptionalRawHistorySqliteImporterModePolicy/v1';
  mode: OptionalRawHistorySqliteImporterMode;
  defaultMode: boolean;
  importMayRunInThisGate: false;
  explicitOperatorConsentRequiredForFutureRawImport: boolean;
  previewRequiredBeforeImport: boolean;
  rawContentSerializedByDefault: false;
  rawSecretSerialized: false;
};

export type OptionalRawHistorySqliteConsentPolicy = {
  nativeContract: 'OptionalRawHistorySqliteConsentPolicy/v1';
  explicitOperatorConsentRequired: true;
  consentScopeRequired: [
    'exact-source-db',
    'target-namespace',
    'data-classes',
    'redaction-policy',
    'time-window',
  ];
  consentProvidedForThisGate: boolean;
  consentAllowsImportInThisGate: false;
  previewRequiredBeforeImport: true;
  rawImportActuallyPerformed: false;
  rawSecretSerialized: false;
};

export type OptionalRawHistorySqliteSourceDbSafety = {
  nativeContract: 'OptionalRawHistorySqliteSourceDbSafety/v1';
  sourceDbState: OptionalRawHistorySqliteSourceDbState;
  outcome: OptionalRawHistorySqliteSourceDbOutcome;
  sourceDbReadOnlyRequired: true;
  sourceDbReadOnlyMode: boolean;
  sqliteWriteAllowed: false;
  sqliteWriteAttempted: false;
  rawDbCopyAllowed: false;
  rawDbCopied: false;
  schemaValidationRequired: true;
  checksumRequired: true;
  idempotencyRequired: true;
  unknownDbBlocked: boolean;
  corruptDbBlocked: boolean;
  incompatibleDbBlocked: boolean;
  rawSecretSerialized: false;
};

export type OptionalRawHistorySqlitePreviewReceipt = {
  nativeContract: 'OptionalRawHistorySqlitePreviewReceipt/v1';
  previewMode: 'metadata-redacted-stats-only';
  previewRequiredBeforeImport: true;
  previewCompleted: boolean;
  tableStatsOnly: true;
  schemaFingerprintIncluded: true;
  checksumPlanned: true;
  idempotencyKeyPlanned: true;
  redactedStatsIncluded: true;
  rawRowsRead: false;
  rawMessageContentSerialized: false;
  rawDbCopied: false;
  attachmentPayloadSerialized: false;
  rawSecretSerialized: false;
};

export type OptionalRawHistorySqliteRedactionSecurityPolicy = {
  nativeContract: 'OptionalRawHistorySqliteRedactionSecurityPolicy/v1';
  redactionPolicyRequired: true;
  redactionPolicyApprovedForFutureGate: boolean;
  rawSecretsBlocked: true;
  tokensCredentialsBlocked: true;
  attachmentsBinaryPayloadsBlockedByDefault: true;
  backupRollbackRequired: true;
  auditReceiptRequired: true;
  rawContentSerializationAllowedByDefault: false;
  rawSecretSerialized: false;
};

export type OptionalRawHistorySqliteFutureImportGateRequirement = {
  nativeContract: 'OptionalRawHistorySqliteFutureImportGateRequirement/v1';
  requirementId:
    | 'audit-receipt'
    | 'backup-rollback'
    | 'checksum-validation'
    | 'explicit-operator-consent'
    | 'idempotency-key'
    | 'preview-before-write'
    | 'redaction-policy'
    | 'source-db-read-only'
    | 'target-namespace'
    | 'write-feature-flag';
  requiredForFutureImport: true;
  satisfiedInThisDesignGate: boolean;
  importAuthorizedNow: false;
};

export type OptionalRawHistorySqliteImporterExecutionGate = {
  optionalRawHistorySqliteImporterDesignCreated: true;
  rawImportDefaultDisabled: true;
  explicitOperatorConsentRequired: true;
  previewRequiredBeforeImport: true;
  sourceDbReadOnlyRequired: true;
  sqliteWriteAllowed: false;
  rawImportActuallyPerformed: false;
  rawDbCopied: false;
  attachmentsImportAllowed: false;
  rawSecretSerialized: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  toolCommandActuallyExecuted: false;
  adapterRemovalGlobalAllowed: false;
};

export type OptionalRawHistorySqliteImporterDesignSource = {
  rawHistorySqliteImportDecisionRecorded: true;
  optionalRawImporterPlanRecorded: true;
  schemaParityAbsorption: Pick<
    ZavorthWave4C3SessionStorageSchemaParityAbsorptionPackNormalization,
    'decision' | 'schemaFingerprint'
  >;
  requestedMode: OptionalRawHistorySqliteImporterMode;
  explicitOperatorConsentProvided: boolean;
  previewCompleted: boolean;
  redactionPolicyApprovedForFutureGate: boolean;
  backupRollbackPlanned: boolean;
  sourceDbState: OptionalRawHistorySqliteSourceDbState;
  sourceDbReadOnlyMode: boolean;
  rawImportAttempted: false;
  sqliteWriteAttempted: false;
  rawDbCopyAttempted: false;
  rawContentSerialized: false;
  attachmentImportAttempted: false;
  secretMigrationAttempted: false;
  messageSendAttempted: false;
  providerExecutionAttempted: false;
  toolCommandExecutionAttempted: false;
  adapterRemovalAttempted: false;
  publicExternalExecutorIdentityExposed: false;
  rawSecretSerialized: false;
};

export type OptionalRawHistorySqliteImporterDesignNormalization = {
  nativeContract: 'OptionalRawHistorySqliteImporterDesignPack/v1';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_OPTIONAL_RAW_HISTORY_SQLITE_IMPORTER_DESIGN_PACK_RUNTIME_ID;
  decision: OptionalRawHistorySqliteImporterDecision;
  status: OptionalRawHistorySqliteImporterDecision;
  modePolicies: OptionalRawHistorySqliteImporterModePolicy[];
  requestedMode: OptionalRawHistorySqliteImporterMode;
  consentPolicy: OptionalRawHistorySqliteConsentPolicy;
  sourceDbSafety: OptionalRawHistorySqliteSourceDbSafety;
  previewReceipt: OptionalRawHistorySqlitePreviewReceipt;
  redactionSecurityPolicy: OptionalRawHistorySqliteRedactionSecurityPolicy;
  futureImportGateRequirements: OptionalRawHistorySqliteFutureImportGateRequirement[];
  executionGate: OptionalRawHistorySqliteImporterExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    rawMessageContentSerialized: false;
    rawHistoryDataSerialized: false;
    attachmentPayloadSerialized: false;
    sourceIdentityPublic: false;
    provenanceInternalOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'future-optional-raw-import-implementation-only-with-explicit-operator-consent';
};

export type OptionalRawHistorySqliteImporterDesignOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_OPTIONAL_RAW_HISTORY_SQLITE_IMPORTER_DESIGN_PACK_RUNTIME_ID;
  source: OptionalRawHistorySqliteImporterDesignSource;
};

const IMPORTER_MODES: OptionalRawHistorySqliteImporterMode[] = [
  'disabled',
  'preview-only',
  'redacted-import-future',
  'raw-import-future-explicit-consent',
  'blocked',
];

function modePolicies(): OptionalRawHistorySqliteImporterModePolicy[] {
  return IMPORTER_MODES.map((mode) => ({
    nativeContract: 'OptionalRawHistorySqliteImporterModePolicy/v1',
    mode,
    defaultMode: mode === 'disabled',
    importMayRunInThisGate: false,
    explicitOperatorConsentRequiredForFutureRawImport:
      mode === 'raw-import-future-explicit-consent' || mode === 'redacted-import-future',
    previewRequiredBeforeImport: mode !== 'disabled' && mode !== 'blocked',
    rawContentSerializedByDefault: false,
    rawSecretSerialized: false,
  }));
}

function sourceDbOutcome(state: OptionalRawHistorySqliteSourceDbState): OptionalRawHistorySqliteSourceDbOutcome {
  if (state === 'unknown') {
    return 'blocked-unknown-db';
  }
  if (state === 'corrupt') {
    return 'blocked-corrupt-db';
  }
  if (state === 'incompatible') {
    return 'blocked-incompatible-db';
  }
  if (state === 'compatible-for-preview') {
    return 'preview-compatible';
  }
  if (state === 'known-empty-or-test-only') {
    return 'read-only-reference-only';
  }
  return 'disabled-no-source';
}

function sourceDbSafety(source: OptionalRawHistorySqliteImporterDesignSource): OptionalRawHistorySqliteSourceDbSafety {
  const outcome = sourceDbOutcome(source.sourceDbState);

  return {
    nativeContract: 'OptionalRawHistorySqliteSourceDbSafety/v1',
    sourceDbState: source.sourceDbState,
    outcome,
    sourceDbReadOnlyRequired: true,
    sourceDbReadOnlyMode: source.sourceDbReadOnlyMode,
    sqliteWriteAllowed: false,
    sqliteWriteAttempted: false,
    rawDbCopyAllowed: false,
    rawDbCopied: false,
    schemaValidationRequired: true,
    checksumRequired: true,
    idempotencyRequired: true,
    unknownDbBlocked: outcome === 'blocked-unknown-db',
    corruptDbBlocked: outcome === 'blocked-corrupt-db',
    incompatibleDbBlocked: outcome === 'blocked-incompatible-db',
    rawSecretSerialized: false,
  };
}

function consentPolicy(source: OptionalRawHistorySqliteImporterDesignSource): OptionalRawHistorySqliteConsentPolicy {
  return {
    nativeContract: 'OptionalRawHistorySqliteConsentPolicy/v1',
    explicitOperatorConsentRequired: true,
    consentScopeRequired: [
      'exact-source-db',
      'target-namespace',
      'data-classes',
      'redaction-policy',
      'time-window',
    ],
    consentProvidedForThisGate: source.explicitOperatorConsentProvided,
    consentAllowsImportInThisGate: false,
    previewRequiredBeforeImport: true,
    rawImportActuallyPerformed: false,
    rawSecretSerialized: false,
  };
}

function previewReceipt(source: OptionalRawHistorySqliteImporterDesignSource): OptionalRawHistorySqlitePreviewReceipt {
  return {
    nativeContract: 'OptionalRawHistorySqlitePreviewReceipt/v1',
    previewMode: 'metadata-redacted-stats-only',
    previewRequiredBeforeImport: true,
    previewCompleted: source.previewCompleted,
    tableStatsOnly: true,
    schemaFingerprintIncluded: true,
    checksumPlanned: true,
    idempotencyKeyPlanned: true,
    redactedStatsIncluded: true,
    rawRowsRead: false,
    rawMessageContentSerialized: false,
    rawDbCopied: false,
    attachmentPayloadSerialized: false,
    rawSecretSerialized: false,
  };
}

function redactionSecurityPolicy(
  source: OptionalRawHistorySqliteImporterDesignSource,
): OptionalRawHistorySqliteRedactionSecurityPolicy {
  return {
    nativeContract: 'OptionalRawHistorySqliteRedactionSecurityPolicy/v1',
    redactionPolicyRequired: true,
    redactionPolicyApprovedForFutureGate: source.redactionPolicyApprovedForFutureGate,
    rawSecretsBlocked: true,
    tokensCredentialsBlocked: true,
    attachmentsBinaryPayloadsBlockedByDefault: true,
    backupRollbackRequired: true,
    auditReceiptRequired: true,
    rawContentSerializationAllowedByDefault: false,
    rawSecretSerialized: false,
  };
}

function futureGateRequirements(
  source: OptionalRawHistorySqliteImporterDesignSource,
): OptionalRawHistorySqliteFutureImportGateRequirement[] {
  return [
    ['explicit-operator-consent', source.explicitOperatorConsentProvided],
    ['preview-before-write', source.previewCompleted],
    ['redaction-policy', source.redactionPolicyApprovedForFutureGate],
    ['backup-rollback', source.backupRollbackPlanned],
    ['idempotency-key', true],
    ['checksum-validation', true],
    ['source-db-read-only', source.sourceDbReadOnlyMode],
    ['target-namespace', false],
    ['write-feature-flag', false],
    ['audit-receipt', true],
  ].map(([requirementId, satisfiedInThisDesignGate]) => ({
    nativeContract: 'OptionalRawHistorySqliteFutureImportGateRequirement/v1',
    requirementId: requirementId as OptionalRawHistorySqliteFutureImportGateRequirement['requirementId'],
    requiredForFutureImport: true,
    satisfiedInThisDesignGate: Boolean(satisfiedInThisDesignGate),
    importAuthorizedNow: false,
  }));
}

function executionGate(): OptionalRawHistorySqliteImporterExecutionGate {
  return {
    optionalRawHistorySqliteImporterDesignCreated: true,
    rawImportDefaultDisabled: true,
    explicitOperatorConsentRequired: true,
    previewRequiredBeforeImport: true,
    sourceDbReadOnlyRequired: true,
    sqliteWriteAllowed: false,
    rawImportActuallyPerformed: false,
    rawDbCopied: false,
    attachmentsImportAllowed: false,
    rawSecretSerialized: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    toolCommandActuallyExecuted: false,
    adapterRemovalGlobalAllowed: false,
  };
}

function futureModeConsentSatisfied(source: OptionalRawHistorySqliteImporterDesignSource): boolean {
  if (
    source.requestedMode !== 'raw-import-future-explicit-consent' &&
    source.requestedMode !== 'redacted-import-future'
  ) {
    return true;
  }

  return source.explicitOperatorConsentProvided &&
    source.previewCompleted &&
    source.redactionPolicyApprovedForFutureGate &&
    source.backupRollbackPlanned;
}

function sourceReady(source: OptionalRawHistorySqliteImporterDesignSource): boolean {
  return (
    source.rawHistorySqliteImportDecisionRecorded &&
    source.optionalRawImporterPlanRecorded &&
    source.schemaParityAbsorption.decision === 'wave4c3-session-storage-schema-parity-absorption-pack-ready' &&
    source.sourceDbReadOnlyMode &&
    sourceDbOutcome(source.sourceDbState) !== 'blocked-unknown-db' &&
    sourceDbOutcome(source.sourceDbState) !== 'blocked-corrupt-db' &&
    sourceDbOutcome(source.sourceDbState) !== 'blocked-incompatible-db' &&
    futureModeConsentSatisfied(source) &&
    !source.rawImportAttempted &&
    !source.sqliteWriteAttempted &&
    !source.rawDbCopyAttempted &&
    !source.rawContentSerialized &&
    !source.attachmentImportAttempted &&
    !source.secretMigrationAttempted &&
    !source.messageSendAttempted &&
    !source.providerExecutionAttempted &&
    !source.toolCommandExecutionAttempted &&
    !source.adapterRemovalAttempted &&
    !source.publicExternalExecutorIdentityExposed &&
    !source.rawSecretSerialized
  );
}

export class OptionalRawHistorySqliteImporter {
  public constructor(public readonly normalization: OptionalRawHistorySqliteImporterDesignNormalization) {}

  public defaultMode(): OptionalRawHistorySqliteImporterModePolicy {
    const disabled = this.normalization.modePolicies.find((mode) => mode.defaultMode);
    if (!disabled) {
      throw new Error('Optional raw history importer default mode is missing');
    }
    return disabled;
  }

  public futureGateRequirement(
    requirementId: OptionalRawHistorySqliteFutureImportGateRequirement['requirementId'],
  ): OptionalRawHistorySqliteFutureImportGateRequirement | undefined {
    return this.normalization.futureImportGateRequirements.find((requirement) => (
      requirement.requirementId === requirementId
    ));
  }

  public rawImportDisabledByDefault(): boolean {
    return this.defaultMode().mode === 'disabled' &&
      !this.defaultMode().importMayRunInThisGate &&
      !this.normalization.executionGate.rawImportActuallyPerformed;
  }
}

export function createOptionalRawHistorySqliteImporterDesignSource(
  overrides: Partial<OptionalRawHistorySqliteImporterDesignSource> = {},
): OptionalRawHistorySqliteImporterDesignSource {
  const schemaParity = createZavorthWave4C3SessionStorageSchemaParityAbsorptionPackFixture().normalization;

  return {
    rawHistorySqliteImportDecisionRecorded: true,
    optionalRawImporterPlanRecorded: true,
    schemaParityAbsorption: schemaParity,
    requestedMode: 'disabled',
    explicitOperatorConsentProvided: false,
    previewCompleted: false,
    redactionPolicyApprovedForFutureGate: false,
    backupRollbackPlanned: false,
    sourceDbState: 'known-empty-or-test-only',
    sourceDbReadOnlyMode: true,
    rawImportAttempted: false,
    sqliteWriteAttempted: false,
    rawDbCopyAttempted: false,
    rawContentSerialized: false,
    attachmentImportAttempted: false,
    secretMigrationAttempted: false,
    messageSendAttempted: false,
    providerExecutionAttempted: false,
    toolCommandExecutionAttempted: false,
    adapterRemovalAttempted: false,
    publicExternalExecutorIdentityExposed: false,
    rawSecretSerialized: false,
    ...overrides,
  };
}

export function normalizeOptionalRawHistorySqliteImporterDesignPack(
  options: OptionalRawHistorySqliteImporterDesignOptions,
): OptionalRawHistorySqliteImporterDesignNormalization {
  const safety = sourceDbSafety(options.source);
  const ready = sourceReady(options.source);

  return {
    nativeContract: 'OptionalRawHistorySqliteImporterDesignPack/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'optional-raw-history-sqlite-importer-design-ready' : 'blocked',
    status: ready ? 'optional-raw-history-sqlite-importer-design-ready' : 'blocked',
    modePolicies: modePolicies(),
    requestedMode: options.source.requestedMode,
    consentPolicy: consentPolicy(options.source),
    sourceDbSafety: safety,
    previewReceipt: previewReceipt(options.source),
    redactionSecurityPolicy: redactionSecurityPolicy(options.source),
    futureImportGateRequirements: futureGateRequirements(options.source),
    executionGate: executionGate(),
    redaction: {
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      rawHistoryDataSerialized: false,
      attachmentPayloadSerialized: false,
      sourceIdentityPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'future-optional-raw-import-implementation-only-with-explicit-operator-consent',
  };
}

export function createOptionalRawHistorySqliteImporterFixture(
  overrides: Partial<OptionalRawHistorySqliteImporterDesignSource> = {},
): OptionalRawHistorySqliteImporter {
  return new OptionalRawHistorySqliteImporter(
    normalizeOptionalRawHistorySqliteImporterDesignPack({
      generatedAt: ZAVORTH_OPTIONAL_RAW_HISTORY_SQLITE_IMPORTER_DESIGN_PACK_NOW,
      runtimeId: ZAVORTH_OPTIONAL_RAW_HISTORY_SQLITE_IMPORTER_DESIGN_PACK_RUNTIME_ID,
      source: createOptionalRawHistorySqliteImporterDesignSource(overrides),
    }),
  );
}
