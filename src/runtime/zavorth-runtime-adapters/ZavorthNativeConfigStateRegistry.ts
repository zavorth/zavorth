import {
  createZavorthNativeCapabilityRegistryFixture,
  normalizeZavorthNativeCapabilityRegistryReplacementFixture,
} from './ZavorthNativeCapabilityRegistry.js';
import {
  createZavorthNativeDashboardViewModelRegistryFixture,
  normalizeZavorthNativeDashboardViewModelRegistryFixture,
} from './ZavorthNativeDashboardViewModelRegistry.js';
import {
  createZavorthNativeIntegrationRegistryFixture,
  normalizeZavorthNativeIntegrationRegistryFixture,
} from './ZavorthNativeIntegrationRegistry.js';
import {
  createZavorthNativeSessionHistoryRegistryFixture,
  normalizeZavorthNativeSessionHistoryRegistryFixture,
} from './ZavorthNativeSessionHistoryRegistry.js';
import {
  normalizeRuntimeAdapterSecretRefResolverBoundaryFixture,
} from './RuntimeAdapterSecretRefResolverBoundary.js';
import type {
  ZavorthNativeCapabilityRegistry,
  ZavorthNativeCapabilityRegistryReplacementNormalization,
} from './ZavorthNativeCapabilityRegistry.js';
import type {
  ZavorthNativeDashboardViewModelRegistry,
  ZavorthNativeDashboardViewModelRegistryNormalization,
} from './ZavorthNativeDashboardViewModelRegistry.js';
import type {
  ZavorthNativeIntegrationRegistry,
  ZavorthNativeIntegrationRegistryNormalization,
} from './ZavorthNativeIntegrationRegistry.js';
import type {
  ZavorthNativeSessionHistoryRegistry,
  ZavorthNativeSessionHistoryRegistryNormalization,
} from './ZavorthNativeSessionHistoryRegistry.js';
import type {
  RuntimeAdapterSecretResolutionEnvelope,
} from './RuntimeAdapterSecretRefResolverBoundary.js';

export const ZAVORTH_NATIVE_CONFIG_STATE_REGISTRY_NOW = '2026-04-29T02:30:00.000Z' as const;
export const ZAVORTH_NATIVE_CONFIG_STATE_REGISTRY_RUNTIME_ID = 'zavorth-native-config-state-registry' as const;

export type ZavorthNativeConfigStateRegistryDecision =
  | 'blocked'
  | 'native-config-state-registry-ready';

export type ZavorthNativeConfigStateCategory =
  | 'backup-rollback'
  | 'cache'
  | 'channel-credentials'
  | 'config-file'
  | 'device-node-identity'
  | 'logs'
  | 'plugin-config'
  | 'provider-credentials'
  | 'secret-ref'
  | 'sqlite-store'
  | 'state-metadata'
  | 'workspace';

export type ZavorthNativeConfigStateRisk =
  | 'critical'
  | 'high'
  | 'low'
  | 'medium';

export type ZavorthNativeConfigStateDecisionType =
  | 'zavorth-owned'
  | 'compatibility-read-only'
  | 'defer'
  | 'externalize'
  | 'import-with-redaction'
  | 'reject';

export type ZavorthNativeConfigStateMigrationEligibility =
  | 'blocked'
  | 'deferred'
  | 'dry-run-only'
  | 'metadata-only'
  | 'rejected';

export type ZavorthNativeConfigStateRollbackAvailability =
  | 'available-metadata-only'
  | 'deferred'
  | 'not-applicable'
  | 'required';

export type ZavorthNativeConfigStateStatus =
  | 'blocked'
  | 'degraded'
  | 'ready'
  | 'unavailable';

export type ZavorthNativeConfigStateSecretRefMetadata = {
  nativeContract: 'ZavorthNativeConfigStateSecretRefMetadata/v1';
  name: string;
  purpose:
    | 'channel-credential'
    | 'device-node-credential'
    | 'gateway-token'
    | 'plugin-service-credential'
    | 'provider-api-key';
  status: 'candidate' | 'defined' | 'metadata-only';
  rawValueRead: false;
  rawValueSerialized: false;
};

export type ZavorthNativeConfigStateProvenance = {
  nativeContract: 'ZavorthNativeConfigStateProvenance/v1';
  sourceRuntimeNameInternal: 'ExternalExecutor';
  sourceRuntimePublicIdentity: false;
  sourceStructuresPublic: false;
  sourceIdsEvidenceOnly: true;
  sourcePathsEvidenceOnly: true;
  redacted: true;
  evidenceDocs: string[];
};

export type ZavorthNativeConfigStateRecord = {
  nativeContract: 'ZavorthNativeConfigStateRecord/v1';
  id: string;
  category: ZavorthNativeConfigStateCategory;
  publicLabel: string;
  status: ZavorthNativeConfigStateStatus;
  dataClasses: string[];
  decision: ZavorthNativeConfigStateDecisionType;
  risk: ZavorthNativeConfigStateRisk;
  migrationEligibility: ZavorthNativeConfigStateMigrationEligibility;
  rollbackAvailability: ZavorthNativeConfigStateRollbackAvailability;
  importEligibility: 'eligible-after-future-gate' | 'metadata-only' | 'not-eligible';
  safeMetadataFields: string[];
  forbiddenOutputs: string[];
  secretRefs: ZavorthNativeConfigStateSecretRefMetadata[];
  backupRequiredBeforeMutation: boolean;
  rollbackRequiredBeforeMutation: boolean;
  degradedOrUnavailableReason?: string;
  capabilityRegistryEntryIds: string[];
  dashboardViewModelIds: string[];
  integrationRegistryRecordIds: string[];
  sessionRegistryRecordIds: string[];
  provenance: ZavorthNativeConfigStateProvenance;
  runtimeExternalExecutorRequiredForConfigLookup: false;
  runtimeExternalExecutorRequiredForSecretMetadataLookup: false;
  sourceRuntimeAuthority: false;
  secretRawValueRead: false;
  secretRawValueSerialized: false;
  configMigrated: false;
  stateMigrated: false;
  sourceFileCopied: false;
  sourceDbCopied: false;
  sourceDbOpenedForWrite: false;
  writeBackAllowed: false;
  migrationAllowed: false;
  sourceModuleCopied: false;
  adapterRemovalAllowed: false;
};

export type ZavorthNativeConfigStateLookupResult = {
  nativeContract: 'ZavorthNativeConfigStateLookupResult/v1';
  lookupId: string;
  found: boolean;
  record?: ZavorthNativeConfigStateRecord;
  runtimeExternalExecutorRequiredForConfigLookup: false;
  runtimeExternalExecutorRequiredForSecretMetadataLookup: false;
  sourceRuntimeAuthority: false;
};

export type ZavorthNativeConfigStateDashboardProjection = {
  nativeContract: 'ZavorthNativeConfigStateDashboardProjection/v1';
  id: string;
  configStateRecordId: string;
  label: string;
  category: ZavorthNativeConfigStateCategory;
  status: ZavorthNativeConfigStateStatus;
  risk: ZavorthNativeConfigStateRisk;
  migrationEligibility: ZavorthNativeConfigStateMigrationEligibility;
  secretRefCount: number;
  dashboardConsumable: true;
  sourceIdentityPublic: false;
  secretRawValueSerialized: false;
  executionAuthority: false;
};

export type ZavorthNativeConfigStateRegistrySnapshot = {
  nativeContract: 'ZavorthNativeConfigStateRegistry/v1';
  id: string;
  generatedAt: string;
  records: ZavorthNativeConfigStateRecord[];
  indexes: {
    byCategory: Record<ZavorthNativeConfigStateCategory, number>;
    byRisk: Record<ZavorthNativeConfigStateRisk, number>;
    byMigrationEligibility: Record<ZavorthNativeConfigStateMigrationEligibility, number>;
    byRollbackAvailability: Record<ZavorthNativeConfigStateRollbackAvailability, number>;
    degradedOrUnavailableIds: string[];
    secretRefRecordIds: string[];
  };
  sourceArtifactsConsumed: {
    secretRefResolverBoundary: 'docs/runtime-adapter-secret-ref-resolver-injection-boundary.md';
    configStateMigrationStrategy: 'docs/runtime-adapter-config-state-migration-strategy.md';
    configStateReadOnlyInventory: 'docs/runtime-adapter-config-state-read-only-inventory.md';
    redactionSecretRefMapping: 'docs/redaction-and-secretref-mapping.md';
    dryRunMigrationPlan: 'docs/dry-run-migration-plan.md';
    rollbackRestoreRehearsal: 'docs/rollback-restore-rehearsal.md';
    nativeCapabilityRegistry: 'docs/first-native-capability-registry-replacement-slice.md';
    dashboardViewModelRegistry: 'docs/dashboard-view-model-registry-native-slice.md';
    integrationRegistry: 'docs/provider-channel-transport-native-registry.md';
    sessionHistoryRegistry: 'docs/session-history-native-registry.md';
  };
  runtimeExternalExecutorRequiredForConfigLookup: false;
  runtimeExternalExecutorRequiredForSecretMetadataLookup: false;
  sourceRuntimeAuthority: false;
  secretRawValueRead: false;
  secretRawValueSerialized: false;
  configMigrated: false;
  stateMigrated: false;
  sourceFileCopied: false;
  sourceDbCopied: false;
  sourceDbOpenedForWrite: false;
  writeBackAllowed: false;
  migrationAllowed: false;
  sourceModuleCopied: false;
  nativeReplacementAuthorizedForConfigStateMetadata: true;
  adapterRemovalAllowed: false;
};

export type ZavorthNativeConfigStateRegistryFilter = {
  category?: ZavorthNativeConfigStateCategory;
  risk?: ZavorthNativeConfigStateRisk;
  migrationEligibility?: ZavorthNativeConfigStateMigrationEligibility;
  rollbackAvailability?: ZavorthNativeConfigStateRollbackAvailability;
  degradedOrUnavailable?: boolean;
  requiresSecretRef?: boolean;
};

export type ZavorthNativeConfigStateRegistryExecutionGate = {
  runtimeExternalExecutorRequiredForConfigLookup: false;
  runtimeExternalExecutorRequiredForSecretMetadataLookup: false;
  sourceRuntimeAuthority: false;
  secretRawValueRead: false;
  secretRawValueSerialized: false;
  configMigrated: false;
  stateMigrated: false;
  sourceFileCopied: false;
  sourceDbCopied: false;
  sourceDbOpenedForWrite: false;
  writeBackAllowed: false;
  migrationAllowed: false;
  sourceModuleCopied: false;
  nativeReplacementAuthorizedForConfigStateMetadata: true;
  adapterRemovalAllowed: false;
};

export type ZavorthNativeConfigStateRegistryIntegration = {
  nativeContract: 'ZavorthNativeConfigStateRegistryIntegration/v1';
  capabilityRegistryCrossReferenceReady: true;
  integrationRegistryCrossReferenceReady: true;
  sessionRegistryCrossReferenceReady: true;
  dashboardProjectionReady: true;
  migrationDryRunOnly: true;
  rollbackMetadataPreserved: true;
  secretRefsMetadataOnly: true;
  liveExternalExecutorOptionalForRefreshOnly: true;
  runtimeExternalExecutorRequiredForConfigLookup: false;
  runtimeExternalExecutorRequiredForSecretMetadataLookup: false;
  publicSourceIdentityExposed: false;
};

export type ZavorthNativeConfigStateRegistrySource = {
  secretRefResolverBoundary: RuntimeAdapterSecretResolutionEnvelope;
  nativeCapabilityRegistry: ZavorthNativeCapabilityRegistryReplacementNormalization;
  capabilityRegistry: ZavorthNativeCapabilityRegistry;
  dashboardViewModelRegistry: ZavorthNativeDashboardViewModelRegistryNormalization;
  dashboardRegistry: ZavorthNativeDashboardViewModelRegistry;
  nativeIntegrationRegistry: ZavorthNativeIntegrationRegistryNormalization;
  integrationRegistry: ZavorthNativeIntegrationRegistry;
  nativeSessionHistoryRegistry: ZavorthNativeSessionHistoryRegistryNormalization;
  sessionHistoryRegistry: ZavorthNativeSessionHistoryRegistry;
  strategyStatus: 'design-only-no-migration';
  inventoryStatus: 'read-only-inventory-no-migration';
  mappingStatus: 'redaction-secretref-mapping-no-migration';
  dryRunPlanStatus: 'dry-run-plan-no-migration';
  rollbackRehearsalStatus: 'rollback-restore-rehearsal-no-mutation';
  gatewayLiveCalledDuringLookup: false;
  secretRawValueRead: false;
  sourceFileCopied: false;
  sourceDbCopied: false;
  sourceDbOpenedForWrite: false;
  configMigrated: false;
  stateMigrated: false;
  writeBackAttempted: false;
};

export type ZavorthNativeConfigStateRegistryNormalization = {
  nativeContract: 'ZavorthNativeConfigStateRegistrySlice/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ZavorthNativeConfigStateRegistryDecision;
  status: 'blocked' | 'native-config-state-registry-ready';
  sourceReadiness: {
    secretRefResolverBoundary: RuntimeAdapterSecretResolutionEnvelope['nativeContract'];
    configStateMigrationStrategy: ZavorthNativeConfigStateRegistrySource['strategyStatus'];
    configStateReadOnlyInventory: ZavorthNativeConfigStateRegistrySource['inventoryStatus'];
    redactionSecretRefMapping: ZavorthNativeConfigStateRegistrySource['mappingStatus'];
    dryRunMigrationPlan: ZavorthNativeConfigStateRegistrySource['dryRunPlanStatus'];
    rollbackRestoreRehearsal: ZavorthNativeConfigStateRegistrySource['rollbackRehearsalStatus'];
    nativeCapabilityRegistry: ZavorthNativeCapabilityRegistryReplacementNormalization['decision'];
    dashboardViewModelRegistry: ZavorthNativeDashboardViewModelRegistryNormalization['decision'];
    nativeIntegrationRegistry: ZavorthNativeIntegrationRegistryNormalization['decision'];
    nativeSessionHistoryRegistry: ZavorthNativeSessionHistoryRegistryNormalization['decision'];
  };
  registry: ZavorthNativeConfigStateRegistrySnapshot;
  dashboardProjection: ZavorthNativeConfigStateDashboardProjection[];
  integration: ZavorthNativeConfigStateRegistryIntegration;
  dependencyReductionProof: {
    lookupWorksWithoutLiveExternalExecutor: true;
    listWorksWithoutLiveExternalExecutor: true;
    filterWorksWithoutLiveExternalExecutor: true;
    secretMetadataLookupWorksWithoutRawSecret: true;
    capabilityRegistryCrossReferenceWorks: true;
    integrationRegistryCrossReferenceWorks: true;
    sessionRegistryCrossReferenceWorks: true;
  };
  executionGate: ZavorthNativeConfigStateRegistryExecutionGate;
  redaction: {
    secretRawValueRead: false;
    secretRawValueSerialized: false;
    rawSecretSerialized: false;
    sourceIdentityPublic: false;
    sourceStructuresPublic: false;
    sourcePathsEvidenceOnly: true;
    provenanceInternalOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'future-config-state-native-refresh-or-controlled-migration-dry-run-gate';
};

export type ZavorthNativeConfigStateRegistryOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  idPrefix: string;
  runtimeId: TRuntimeId;
  source: ZavorthNativeConfigStateRegistrySource;
};

type ConfigStateFixtureRecord = {
  slug: string;
  category: ZavorthNativeConfigStateCategory;
  publicLabel: string;
  status: ZavorthNativeConfigStateStatus;
  dataClasses: string[];
  decision: ZavorthNativeConfigStateDecisionType;
  risk: ZavorthNativeConfigStateRisk;
  migrationEligibility: ZavorthNativeConfigStateMigrationEligibility;
  rollbackAvailability: ZavorthNativeConfigStateRollbackAvailability;
  importEligibility: ZavorthNativeConfigStateRecord['importEligibility'];
  secretRefs: ZavorthNativeConfigStateSecretRefMetadata[];
  backupRequiredBeforeMutation: boolean;
  rollbackRequiredBeforeMutation: boolean;
  safeMetadataFields: string[];
  forbiddenOutputs: string[];
  evidenceDocs: string[];
  degradedOrUnavailableReason?: string;
};

function secretRef(
  name: string,
  purpose: ZavorthNativeConfigStateSecretRefMetadata['purpose'],
  status: ZavorthNativeConfigStateSecretRefMetadata['status'],
): ZavorthNativeConfigStateSecretRefMetadata {
  return {
    nativeContract: 'ZavorthNativeConfigStateSecretRefMetadata/v1',
    name,
    purpose,
    status,
    rawValueRead: false,
    rawValueSerialized: false,
  };
}

function defaultSafeMetadataFields(): string[] {
  return [
    'path-alias',
    'exists',
    'kind',
    'size',
    'mode',
    'mtime',
    'child-count',
    'status',
    'risk',
    'decision',
  ];
}

function defaultForbiddenOutputs(): string[] {
  return [
    'raw-token',
    'raw-api-key',
    'raw-password',
    'raw-bearer-credential',
    'raw-webhook-secret',
    'credentialed-url',
    'authorization-header',
    'secret-hash',
    'secret-length',
    'raw-transcript',
    'source-module-content',
  ];
}

function fixtureRecords(): ConfigStateFixtureRecord[] {
  const configSecretRefs = [
    secretRef('external-executor-gateway-token', 'gateway-token', 'defined'),
    secretRef('external-executor-provider-api-key', 'provider-api-key', 'candidate'),
  ];
  const channelSecretRefs = [
    secretRef('external-executor-channel-telegram-token', 'channel-credential', 'candidate'),
    secretRef('external-executor-channel-discord-token', 'channel-credential', 'candidate'),
  ];
  const deviceSecretRef = secretRef('external-executor-device-node-token', 'device-node-credential', 'candidate');
  const pluginSecretRef = secretRef('external-executor-plugin-service-credential', 'plugin-service-credential', 'candidate');

  return [
    {
      slug: 'runtime-config-file',
      category: 'config-file',
      publicLabel: 'Runtime config metadata',
      status: 'degraded',
      dataClasses: ['runtime config', 'gateway connection config', 'provider config', 'auth/secrets'],
      decision: 'compatibility-read-only',
      risk: 'critical',
      migrationEligibility: 'dry-run-only',
      rollbackAvailability: 'required',
      importEligibility: 'metadata-only',
      secretRefs: configSecretRefs,
      backupRequiredBeforeMutation: true,
      rollbackRequiredBeforeMutation: true,
      safeMetadataFields: [...defaultSafeMetadataFields(), 'gateway-port', 'gateway-bind', 'auth-mode'],
      forbiddenOutputs: defaultForbiddenOutputs(),
      evidenceDocs: [
        'docs/runtime-adapter-config-state-read-only-inventory.md',
        'docs/redaction-and-secretref-mapping.md',
      ],
      degradedOrUnavailableReason: 'secret-bearing-source-config-metadata-only',
    },
    {
      slug: 'gateway-secret-ref',
      category: 'secret-ref',
      publicLabel: 'Gateway SecretRef metadata',
      status: 'ready',
      dataClasses: ['auth/secrets', 'gateway connection config'],
      decision: 'defer',
      risk: 'critical',
      migrationEligibility: 'deferred',
      rollbackAvailability: 'deferred',
      importEligibility: 'not-eligible',
      secretRefs: [secretRef('external-executor-gateway-token', 'gateway-token', 'defined')],
      backupRequiredBeforeMutation: true,
      rollbackRequiredBeforeMutation: true,
      safeMetadataFields: ['SecretRef id', 'purpose', 'status', 'allowed-injection-channel'],
      forbiddenOutputs: defaultForbiddenOutputs(),
      evidenceDocs: [
        'docs/runtime-adapter-secret-ref-resolver-injection-boundary.md',
        'docs/redaction-and-secretref-mapping.md',
      ],
    },
    {
      slug: 'provider-credentials',
      category: 'provider-credentials',
      publicLabel: 'Provider credential metadata',
      status: 'degraded',
      dataClasses: ['provider config', 'auth/secrets'],
      decision: 'defer',
      risk: 'critical',
      migrationEligibility: 'deferred',
      rollbackAvailability: 'required',
      importEligibility: 'not-eligible',
      secretRefs: [secretRef('external-executor-provider-api-key', 'provider-api-key', 'candidate')],
      backupRequiredBeforeMutation: true,
      rollbackRequiredBeforeMutation: true,
      safeMetadataFields: ['provider-family', 'configured-boolean', 'SecretRef id', 'status'],
      forbiddenOutputs: defaultForbiddenOutputs(),
      evidenceDocs: [
        'docs/redaction-and-secretref-mapping.md',
        'docs/provider-channel-transport-native-registry.md',
      ],
      degradedOrUnavailableReason: 'provider-credential-values-not-read',
    },
    {
      slug: 'channel-credentials',
      category: 'channel-credentials',
      publicLabel: 'Channel credential metadata',
      status: 'degraded',
      dataClasses: ['channel credentials', 'auth/secrets'],
      decision: 'defer',
      risk: 'critical',
      migrationEligibility: 'deferred',
      rollbackAvailability: 'required',
      importEligibility: 'not-eligible',
      secretRefs: channelSecretRefs,
      backupRequiredBeforeMutation: true,
      rollbackRequiredBeforeMutation: true,
      safeMetadataFields: ['channel-family', 'configured-boolean', 'SecretRef id', 'status'],
      forbiddenOutputs: defaultForbiddenOutputs(),
      evidenceDocs: [
        'docs/redaction-and-secretref-mapping.md',
        'docs/provider-channel-transport-native-registry.md',
      ],
      degradedOrUnavailableReason: 'channel-credential-values-not-read',
    },
    {
      slug: 'device-node-identity',
      category: 'device-node-identity',
      publicLabel: 'Device and node identity metadata',
      status: 'degraded',
      dataClasses: ['node/worker registry', 'auth/secrets'],
      decision: 'externalize',
      risk: 'high',
      migrationEligibility: 'deferred',
      rollbackAvailability: 'required',
      importEligibility: 'metadata-only',
      secretRefs: [deviceSecretRef],
      backupRequiredBeforeMutation: true,
      rollbackRequiredBeforeMutation: true,
      safeMetadataFields: ['device-presence-boolean', 'pairing-count', 'status'],
      forbiddenOutputs: defaultForbiddenOutputs(),
      evidenceDocs: [
        'docs/runtime-adapter-config-state-read-only-inventory.md',
        'docs/rollback-restore-rehearsal.md',
      ],
      degradedOrUnavailableReason: 'device-trust-material-externalized',
    },
    {
      slug: 'plugin-config-cache',
      category: 'plugin-config',
      publicLabel: 'Plugin config and runtime metadata',
      status: 'ready',
      dataClasses: ['plugin manifest/cache', 'plugin runtime state'],
      decision: 'compatibility-read-only',
      risk: 'medium',
      migrationEligibility: 'metadata-only',
      rollbackAvailability: 'required',
      importEligibility: 'metadata-only',
      secretRefs: [pluginSecretRef],
      backupRequiredBeforeMutation: true,
      rollbackRequiredBeforeMutation: true,
      safeMetadataFields: ['plugin-family', 'path-alias', 'configured-boolean', 'status'],
      forbiddenOutputs: defaultForbiddenOutputs(),
      evidenceDocs: [
        'docs/runtime-adapter-config-state-migration-strategy.md',
        'docs/first-native-capability-registry-replacement-slice.md',
      ],
    },
    {
      slug: 'cache-metadata',
      category: 'cache',
      publicLabel: 'Runtime cache metadata',
      status: 'degraded',
      dataClasses: ['plugin runtime state', 'telemetry/diagnostics'],
      decision: 'externalize',
      risk: 'high',
      migrationEligibility: 'deferred',
      rollbackAvailability: 'deferred',
      importEligibility: 'not-eligible',
      secretRefs: [],
      backupRequiredBeforeMutation: true,
      rollbackRequiredBeforeMutation: true,
      safeMetadataFields: ['store-type', 'size', 'mtime', 'status'],
      forbiddenOutputs: defaultForbiddenOutputs(),
      evidenceDocs: [
        'docs/runtime-adapter-config-state-read-only-inventory.md',
        'docs/dry-run-migration-plan.md',
      ],
      degradedOrUnavailableReason: 'runtime-cache-content-not-imported',
    },
    {
      slug: 'logs-diagnostics',
      category: 'logs',
      publicLabel: 'Logs and diagnostics metadata',
      status: 'ready',
      dataClasses: ['artifacts/logs', 'telemetry/diagnostics'],
      decision: 'import-with-redaction',
      risk: 'high',
      migrationEligibility: 'dry-run-only',
      rollbackAvailability: 'available-metadata-only',
      importEligibility: 'eligible-after-future-gate',
      secretRefs: [],
      backupRequiredBeforeMutation: true,
      rollbackRequiredBeforeMutation: true,
      safeMetadataFields: ['log-kind', 'error-class', 'status', 'size', 'mtime'],
      forbiddenOutputs: defaultForbiddenOutputs(),
      evidenceDocs: [
        'docs/redaction-and-secretref-mapping.md',
        'docs/rollback-restore-rehearsal.md',
      ],
    },
    {
      slug: 'workspace-metadata',
      category: 'workspace',
      publicLabel: 'Workspace metadata',
      status: 'degraded',
      dataClasses: ['artifacts/logs', 'plugin runtime state', 'user preferences'],
      decision: 'compatibility-read-only',
      risk: 'high',
      migrationEligibility: 'deferred',
      rollbackAvailability: 'deferred',
      importEligibility: 'not-eligible',
      secretRefs: [],
      backupRequiredBeforeMutation: true,
      rollbackRequiredBeforeMutation: true,
      safeMetadataFields: ['path-alias', 'file-type-class', 'count', 'status'],
      forbiddenOutputs: defaultForbiddenOutputs(),
      evidenceDocs: [
        'docs/runtime-adapter-config-state-read-only-inventory.md',
        'docs/dry-run-migration-plan.md',
      ],
      degradedOrUnavailableReason: 'workspace-content-privacy-gate-required',
    },
    {
      slug: 'sqlite-store-metadata',
      category: 'sqlite-store',
      publicLabel: 'SQLite and store metadata',
      status: 'degraded',
      dataClasses: ['session/history store', 'plugin runtime state', 'telemetry/diagnostics'],
      decision: 'compatibility-read-only',
      risk: 'high',
      migrationEligibility: 'deferred',
      rollbackAvailability: 'deferred',
      importEligibility: 'not-eligible',
      secretRefs: [],
      backupRequiredBeforeMutation: true,
      rollbackRequiredBeforeMutation: true,
      safeMetadataFields: ['store-type', 'size', 'mtime', 'row-count-future-only', 'status'],
      forbiddenOutputs: [...defaultForbiddenOutputs(), 'raw-row-content', 'sqlite-page-content'],
      evidenceDocs: [
        'docs/sqlite-session-store-dry-run-design.md',
        'docs/session-history-native-registry.md',
      ],
      degradedOrUnavailableReason: 'real-sqlite-db-not-opened',
    },
    {
      slug: 'backup-rollback-metadata',
      category: 'backup-rollback',
      publicLabel: 'Backup and rollback metadata',
      status: 'ready',
      dataClasses: ['backup/rollback metadata', 'telemetry/diagnostics'],
      decision: 'zavorth-owned',
      risk: 'medium',
      migrationEligibility: 'metadata-only',
      rollbackAvailability: 'available-metadata-only',
      importEligibility: 'metadata-only',
      secretRefs: [],
      backupRequiredBeforeMutation: true,
      rollbackRequiredBeforeMutation: true,
      safeMetadataFields: ['manifest-id', 'receipt-id', 'status', 'restore-target-safety'],
      forbiddenOutputs: defaultForbiddenOutputs(),
      evidenceDocs: [
        'docs/dry-run-migration-plan.md',
        'docs/rollback-restore-rehearsal.md',
      ],
    },
    {
      slug: 'source-module-copy-reject',
      category: 'state-metadata',
      publicLabel: 'Source module copy rejection metadata',
      status: 'blocked',
      dataClasses: ['source checkout', 'runtime executable'],
      decision: 'reject',
      risk: 'medium',
      migrationEligibility: 'rejected',
      rollbackAvailability: 'not-applicable',
      importEligibility: 'not-eligible',
      secretRefs: [],
      backupRequiredBeforeMutation: false,
      rollbackRequiredBeforeMutation: false,
      safeMetadataFields: ['source-evidence-kind', 'rejection-reason', 'status'],
      forbiddenOutputs: [...defaultForbiddenOutputs(), 'source-implementation-content'],
      evidenceDocs: [
        'docs/runtime-adapter-config-state-read-only-inventory.md',
        'docs/dry-run-migration-plan.md',
      ],
      degradedOrUnavailableReason: 'source-module-copy-rejected',
    },
  ];
}

function emptyCategoryIndex(): Record<ZavorthNativeConfigStateCategory, number> {
  return {
    'backup-rollback': 0,
    cache: 0,
    'channel-credentials': 0,
    'config-file': 0,
    'device-node-identity': 0,
    logs: 0,
    'plugin-config': 0,
    'provider-credentials': 0,
    'secret-ref': 0,
    'sqlite-store': 0,
    'state-metadata': 0,
    workspace: 0,
  };
}

function emptyRiskIndex(): Record<ZavorthNativeConfigStateRisk, number> {
  return {
    critical: 0,
    high: 0,
    low: 0,
    medium: 0,
  };
}

function emptyMigrationEligibilityIndex(): Record<ZavorthNativeConfigStateMigrationEligibility, number> {
  return {
    blocked: 0,
    deferred: 0,
    'dry-run-only': 0,
    'metadata-only': 0,
    rejected: 0,
  };
}

function emptyRollbackAvailabilityIndex(): Record<ZavorthNativeConfigStateRollbackAvailability, number> {
  return {
    'available-metadata-only': 0,
    deferred: 0,
    'not-applicable': 0,
    required: 0,
  };
}

function provenance(evidenceDocs: string[]): ZavorthNativeConfigStateProvenance {
  return {
    nativeContract: 'ZavorthNativeConfigStateProvenance/v1',
    sourceRuntimeNameInternal: 'ExternalExecutor',
    sourceRuntimePublicIdentity: false,
    sourceStructuresPublic: false,
    sourceIdsEvidenceOnly: true,
    sourcePathsEvidenceOnly: true,
    redacted: true,
    evidenceDocs,
  };
}

function capabilityIds(source: ZavorthNativeConfigStateRegistrySource, category: ZavorthNativeConfigStateCategory): string[] {
  if (category === 'provider-credentials') {
    return source.capabilityRegistry.list({ kind: 'provider' }).map((entry) => entry.id);
  }
  if (category === 'channel-credentials') {
    return source.capabilityRegistry.list({ kind: 'channel' }).map((entry) => entry.id);
  }
  if (category === 'plugin-config' || category === 'cache') {
    return source.capabilityRegistry.list({ kind: 'plugin' }).map((entry) => entry.id);
  }
  if (category === 'sqlite-store') {
    return source.capabilityRegistry.list({ kind: 'session-history' }).map((entry) => entry.id);
  }
  if (category === 'device-node-identity') {
    return source.capabilityRegistry.list({ kind: 'worker-node' }).map((entry) => entry.id);
  }
  return source.capabilityRegistry.list({ kind: 'gateway-method' }).slice(0, 1).map((entry) => entry.id);
}

function integrationIds(source: ZavorthNativeConfigStateRegistrySource, category: ZavorthNativeConfigStateCategory): string[] {
  if (category === 'provider-credentials') {
    return source.integrationRegistry.list({ integrationKind: 'provider' }).map((record) => record.id);
  }
  if (category === 'channel-credentials') {
    return source.integrationRegistry.list({ integrationKind: 'channel' }).map((record) => record.id);
  }
  if (category === 'config-file' || category === 'secret-ref' || category === 'logs') {
    return source.integrationRegistry.list({ integrationKind: 'message-transport', classification: 'read-only' }).map((record) => record.id);
  }
  return [];
}

function dashboardIds(source: ZavorthNativeConfigStateRegistrySource, category: ZavorthNativeConfigStateCategory): string[] {
  if (category === 'provider-credentials') {
    return source.dashboardRegistry.list({ viewType: 'provider' }).map((record) => record.id);
  }
  if (category === 'channel-credentials') {
    return source.dashboardRegistry.list({ viewType: 'channel' }).map((record) => record.id);
  }
  if (category === 'sqlite-store') {
    return source.dashboardRegistry.list({ viewType: 'session' }).map((record) => record.id);
  }
  if (category === 'logs' || category === 'cache') {
    return source.dashboardRegistry.list({ degradedOrUnavailable: true }).slice(0, 3).map((record) => record.id);
  }
  return source.dashboardRegistry.list({ viewType: 'health-status' }).map((record) => record.id);
}

function sessionIds(source: ZavorthNativeConfigStateRegistrySource, category: ZavorthNativeConfigStateCategory): string[] {
  if (category !== 'sqlite-store' && category !== 'workspace') {
    return [];
  }
  return source.sessionHistoryRegistry.listSessions().map((session) => session.id);
}

function buildRecords(
  idPrefix: string,
  source: ZavorthNativeConfigStateRegistrySource,
): ZavorthNativeConfigStateRecord[] {
  return fixtureRecords().map((fixture) => ({
    nativeContract: 'ZavorthNativeConfigStateRecord/v1',
    id: `${idPrefix}:${fixture.slug}`,
    category: fixture.category,
    publicLabel: fixture.publicLabel,
    status: fixture.status,
    dataClasses: fixture.dataClasses,
    decision: fixture.decision,
    risk: fixture.risk,
    migrationEligibility: fixture.migrationEligibility,
    rollbackAvailability: fixture.rollbackAvailability,
    importEligibility: fixture.importEligibility,
    safeMetadataFields: fixture.safeMetadataFields,
    forbiddenOutputs: fixture.forbiddenOutputs,
    secretRefs: fixture.secretRefs,
    backupRequiredBeforeMutation: fixture.backupRequiredBeforeMutation,
    rollbackRequiredBeforeMutation: fixture.rollbackRequiredBeforeMutation,
    ...(fixture.degradedOrUnavailableReason ? { degradedOrUnavailableReason: fixture.degradedOrUnavailableReason } : {}),
    capabilityRegistryEntryIds: capabilityIds(source, fixture.category),
    dashboardViewModelIds: dashboardIds(source, fixture.category),
    integrationRegistryRecordIds: integrationIds(source, fixture.category),
    sessionRegistryRecordIds: sessionIds(source, fixture.category),
    provenance: provenance(fixture.evidenceDocs),
    runtimeExternalExecutorRequiredForConfigLookup: false,
    runtimeExternalExecutorRequiredForSecretMetadataLookup: false,
    sourceRuntimeAuthority: false,
    secretRawValueRead: false,
    secretRawValueSerialized: false,
    configMigrated: false,
    stateMigrated: false,
    sourceFileCopied: false,
    sourceDbCopied: false,
    sourceDbOpenedForWrite: false,
    writeBackAllowed: false,
    migrationAllowed: false,
    sourceModuleCopied: false,
    adapterRemovalAllowed: false,
  }));
}

function byCategory(records: ZavorthNativeConfigStateRecord[]): Record<ZavorthNativeConfigStateCategory, number> {
  const index = emptyCategoryIndex();
  records.forEach((record) => {
    index[record.category] += 1;
  });
  return index;
}

function byRisk(records: ZavorthNativeConfigStateRecord[]): Record<ZavorthNativeConfigStateRisk, number> {
  const index = emptyRiskIndex();
  records.forEach((record) => {
    index[record.risk] += 1;
  });
  return index;
}

function byMigrationEligibility(
  records: ZavorthNativeConfigStateRecord[],
): Record<ZavorthNativeConfigStateMigrationEligibility, number> {
  const index = emptyMigrationEligibilityIndex();
  records.forEach((record) => {
    index[record.migrationEligibility] += 1;
  });
  return index;
}

function byRollbackAvailability(
  records: ZavorthNativeConfigStateRecord[],
): Record<ZavorthNativeConfigStateRollbackAvailability, number> {
  const index = emptyRollbackAvailabilityIndex();
  records.forEach((record) => {
    index[record.rollbackAvailability] += 1;
  });
  return index;
}

function buildSnapshot(
  options: ZavorthNativeConfigStateRegistryOptions,
): ZavorthNativeConfigStateRegistrySnapshot {
  const records = buildRecords(options.idPrefix, options.source);

  return {
    nativeContract: 'ZavorthNativeConfigStateRegistry/v1',
    id: `${options.idPrefix}:registry`,
    generatedAt: options.generatedAt,
    records,
    indexes: {
      byCategory: byCategory(records),
      byRisk: byRisk(records),
      byMigrationEligibility: byMigrationEligibility(records),
      byRollbackAvailability: byRollbackAvailability(records),
      degradedOrUnavailableIds: records
        .filter((record) => record.status === 'degraded' || record.status === 'unavailable')
        .map((record) => record.id),
      secretRefRecordIds: records
        .filter((record) => record.secretRefs.length > 0)
        .map((record) => record.id),
    },
    sourceArtifactsConsumed: {
      secretRefResolverBoundary: 'docs/runtime-adapter-secret-ref-resolver-injection-boundary.md',
      configStateMigrationStrategy: 'docs/runtime-adapter-config-state-migration-strategy.md',
      configStateReadOnlyInventory: 'docs/runtime-adapter-config-state-read-only-inventory.md',
      redactionSecretRefMapping: 'docs/redaction-and-secretref-mapping.md',
      dryRunMigrationPlan: 'docs/dry-run-migration-plan.md',
      rollbackRestoreRehearsal: 'docs/rollback-restore-rehearsal.md',
      nativeCapabilityRegistry: 'docs/first-native-capability-registry-replacement-slice.md',
      dashboardViewModelRegistry: 'docs/dashboard-view-model-registry-native-slice.md',
      integrationRegistry: 'docs/provider-channel-transport-native-registry.md',
      sessionHistoryRegistry: 'docs/session-history-native-registry.md',
    },
    runtimeExternalExecutorRequiredForConfigLookup: false,
    runtimeExternalExecutorRequiredForSecretMetadataLookup: false,
    sourceRuntimeAuthority: false,
    secretRawValueRead: false,
    secretRawValueSerialized: false,
    configMigrated: false,
    stateMigrated: false,
    sourceFileCopied: false,
    sourceDbCopied: false,
    sourceDbOpenedForWrite: false,
    writeBackAllowed: false,
    migrationAllowed: false,
    sourceModuleCopied: false,
    nativeReplacementAuthorizedForConfigStateMetadata: true,
    adapterRemovalAllowed: false,
  };
}

function dashboardProjection(records: ZavorthNativeConfigStateRecord[]): ZavorthNativeConfigStateDashboardProjection[] {
  return records.map((record) => ({
    nativeContract: 'ZavorthNativeConfigStateDashboardProjection/v1',
    id: `${record.id}:dashboard-projection`,
    configStateRecordId: record.id,
    label: record.publicLabel,
    category: record.category,
    status: record.status,
    risk: record.risk,
    migrationEligibility: record.migrationEligibility,
    secretRefCount: record.secretRefs.length,
    dashboardConsumable: true,
    sourceIdentityPublic: false,
    secretRawValueSerialized: false,
    executionAuthority: false,
  }));
}

function sourceReady(source: ZavorthNativeConfigStateRegistrySource): boolean {
  return (
    source.secretRefResolverBoundary.nativeContract === 'RuntimeAdapterSecretResolutionEnvelope/v1' &&
    source.secretRefResolverBoundary.redaction.rawSecretValuePresentInEnvelope === false &&
    source.strategyStatus === 'design-only-no-migration' &&
    source.inventoryStatus === 'read-only-inventory-no-migration' &&
    source.mappingStatus === 'redaction-secretref-mapping-no-migration' &&
    source.dryRunPlanStatus === 'dry-run-plan-no-migration' &&
    source.rollbackRehearsalStatus === 'rollback-restore-rehearsal-no-mutation' &&
    source.nativeCapabilityRegistry.decision === 'native-capability-registry-replacement-ready' &&
    source.dashboardViewModelRegistry.decision === 'native-dashboard-view-model-registry-ready' &&
    source.nativeIntegrationRegistry.decision === 'native-integration-registry-ready' &&
    source.nativeSessionHistoryRegistry.decision === 'native-session-history-registry-ready' &&
    !source.gatewayLiveCalledDuringLookup &&
    !source.secretRawValueRead &&
    !source.sourceFileCopied &&
    !source.sourceDbCopied &&
    !source.sourceDbOpenedForWrite &&
    !source.configMigrated &&
    !source.stateMigrated &&
    !source.writeBackAttempted
  );
}

function executionGate(): ZavorthNativeConfigStateRegistryExecutionGate {
  return {
    runtimeExternalExecutorRequiredForConfigLookup: false,
    runtimeExternalExecutorRequiredForSecretMetadataLookup: false,
    sourceRuntimeAuthority: false,
    secretRawValueRead: false,
    secretRawValueSerialized: false,
    configMigrated: false,
    stateMigrated: false,
    sourceFileCopied: false,
    sourceDbCopied: false,
    sourceDbOpenedForWrite: false,
    writeBackAllowed: false,
    migrationAllowed: false,
    sourceModuleCopied: false,
    nativeReplacementAuthorizedForConfigStateMetadata: true,
    adapterRemovalAllowed: false,
  };
}

function matchesFilter(
  record: ZavorthNativeConfigStateRecord,
  filter: ZavorthNativeConfigStateRegistryFilter,
): boolean {
  if (filter.category && record.category !== filter.category) {
    return false;
  }
  if (filter.risk && record.risk !== filter.risk) {
    return false;
  }
  if (filter.migrationEligibility && record.migrationEligibility !== filter.migrationEligibility) {
    return false;
  }
  if (filter.rollbackAvailability && record.rollbackAvailability !== filter.rollbackAvailability) {
    return false;
  }
  if (filter.degradedOrUnavailable && record.status !== 'degraded' && record.status !== 'unavailable') {
    return false;
  }
  if (filter.requiresSecretRef !== undefined && (record.secretRefs.length > 0) !== filter.requiresSecretRef) {
    return false;
  }
  return true;
}

export class ZavorthNativeConfigStateRegistry {
  private readonly recordsById: Map<string, ZavorthNativeConfigStateRecord>;

  public constructor(public readonly snapshot: ZavorthNativeConfigStateRegistrySnapshot) {
    this.recordsById = new Map(snapshot.records.map((record) => [record.id, record]));
  }

  public list(filter: ZavorthNativeConfigStateRegistryFilter = {}): ZavorthNativeConfigStateRecord[] {
    return this.snapshot.records.filter((record) => matchesFilter(record, filter));
  }

  public lookup(id: string): ZavorthNativeConfigStateLookupResult {
    const record = this.recordsById.get(id);

    return {
      nativeContract: 'ZavorthNativeConfigStateLookupResult/v1',
      lookupId: id,
      found: Boolean(record),
      ...(record ? { record } : {}),
      runtimeExternalExecutorRequiredForConfigLookup: false,
      runtimeExternalExecutorRequiredForSecretMetadataLookup: false,
      sourceRuntimeAuthority: false,
    };
  }

  public toDashboardProjection(): ZavorthNativeConfigStateDashboardProjection[] {
    return dashboardProjection(this.snapshot.records);
  }
}

export function createZavorthNativeConfigStateRegistryFixtureSource(): ZavorthNativeConfigStateRegistrySource {
  return {
    secretRefResolverBoundary: normalizeRuntimeAdapterSecretRefResolverBoundaryFixture(),
    nativeCapabilityRegistry: normalizeZavorthNativeCapabilityRegistryReplacementFixture(),
    capabilityRegistry: createZavorthNativeCapabilityRegistryFixture(),
    dashboardViewModelRegistry: normalizeZavorthNativeDashboardViewModelRegistryFixture(),
    dashboardRegistry: createZavorthNativeDashboardViewModelRegistryFixture(),
    nativeIntegrationRegistry: normalizeZavorthNativeIntegrationRegistryFixture(),
    integrationRegistry: createZavorthNativeIntegrationRegistryFixture(),
    nativeSessionHistoryRegistry: normalizeZavorthNativeSessionHistoryRegistryFixture(),
    sessionHistoryRegistry: createZavorthNativeSessionHistoryRegistryFixture(),
    strategyStatus: 'design-only-no-migration',
    inventoryStatus: 'read-only-inventory-no-migration',
    mappingStatus: 'redaction-secretref-mapping-no-migration',
    dryRunPlanStatus: 'dry-run-plan-no-migration',
    rollbackRehearsalStatus: 'rollback-restore-rehearsal-no-mutation',
    gatewayLiveCalledDuringLookup: false,
    secretRawValueRead: false,
    sourceFileCopied: false,
    sourceDbCopied: false,
    sourceDbOpenedForWrite: false,
    configMigrated: false,
    stateMigrated: false,
    writeBackAttempted: false,
  };
}

export function normalizeZavorthNativeConfigStateRegistry<TRuntimeId extends string>(
  options: ZavorthNativeConfigStateRegistryOptions<TRuntimeId>,
): ZavorthNativeConfigStateRegistryNormalization {
  const registry = buildSnapshot(options);
  const projection = dashboardProjection(registry.records);
  const gate = executionGate();
  const ready = sourceReady(options.source) &&
    registry.records.length >= 12 &&
    registry.indexes.byCategory['config-file'] > 0 &&
    registry.indexes.byCategory['secret-ref'] > 0 &&
    registry.indexes.byCategory['provider-credentials'] > 0 &&
    registry.indexes.byCategory['channel-credentials'] > 0 &&
    registry.indexes.byCategory['device-node-identity'] > 0 &&
    registry.indexes.byCategory['plugin-config'] > 0 &&
    registry.indexes.byCategory.cache > 0 &&
    registry.indexes.byCategory.logs > 0 &&
    registry.indexes.byCategory.workspace > 0 &&
    registry.indexes.byCategory['sqlite-store'] > 0 &&
    registry.indexes.byCategory['backup-rollback'] > 0 &&
    registry.indexes.secretRefRecordIds.length > 0 &&
    registry.indexes.byMigrationEligibility.deferred > 0 &&
    registry.indexes.byMigrationEligibility.rejected > 0 &&
    registry.indexes.byRollbackAvailability.required > 0;

  return {
    nativeContract: 'ZavorthNativeConfigStateRegistrySlice/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'native-config-state-registry-ready' : 'blocked',
    status: ready ? 'native-config-state-registry-ready' : 'blocked',
    sourceReadiness: {
      secretRefResolverBoundary: options.source.secretRefResolverBoundary.nativeContract,
      configStateMigrationStrategy: options.source.strategyStatus,
      configStateReadOnlyInventory: options.source.inventoryStatus,
      redactionSecretRefMapping: options.source.mappingStatus,
      dryRunMigrationPlan: options.source.dryRunPlanStatus,
      rollbackRestoreRehearsal: options.source.rollbackRehearsalStatus,
      nativeCapabilityRegistry: options.source.nativeCapabilityRegistry.decision,
      dashboardViewModelRegistry: options.source.dashboardViewModelRegistry.decision,
      nativeIntegrationRegistry: options.source.nativeIntegrationRegistry.decision,
      nativeSessionHistoryRegistry: options.source.nativeSessionHistoryRegistry.decision,
    },
    registry,
    dashboardProjection: projection,
    integration: {
      nativeContract: 'ZavorthNativeConfigStateRegistryIntegration/v1',
      capabilityRegistryCrossReferenceReady: true,
      integrationRegistryCrossReferenceReady: true,
      sessionRegistryCrossReferenceReady: true,
      dashboardProjectionReady: true,
      migrationDryRunOnly: true,
      rollbackMetadataPreserved: true,
      secretRefsMetadataOnly: true,
      liveExternalExecutorOptionalForRefreshOnly: true,
      runtimeExternalExecutorRequiredForConfigLookup: false,
      runtimeExternalExecutorRequiredForSecretMetadataLookup: false,
      publicSourceIdentityExposed: false,
    },
    dependencyReductionProof: {
      lookupWorksWithoutLiveExternalExecutor: true,
      listWorksWithoutLiveExternalExecutor: true,
      filterWorksWithoutLiveExternalExecutor: true,
      secretMetadataLookupWorksWithoutRawSecret: true,
      capabilityRegistryCrossReferenceWorks: true,
      integrationRegistryCrossReferenceWorks: true,
      sessionRegistryCrossReferenceWorks: true,
    },
    executionGate: gate,
    redaction: {
      secretRawValueRead: false,
      secretRawValueSerialized: false,
      rawSecretSerialized: false,
      sourceIdentityPublic: false,
      sourceStructuresPublic: false,
      sourcePathsEvidenceOnly: true,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'future-config-state-native-refresh-or-controlled-migration-dry-run-gate',
  };
}

export function normalizeZavorthNativeConfigStateRegistryFixture(): ZavorthNativeConfigStateRegistryNormalization {
  return normalizeZavorthNativeConfigStateRegistry({
    generatedAt: ZAVORTH_NATIVE_CONFIG_STATE_REGISTRY_NOW,
    runtimeId: ZAVORTH_NATIVE_CONFIG_STATE_REGISTRY_RUNTIME_ID,
    idPrefix: 'zavorth-native-config-state-registry',
    source: createZavorthNativeConfigStateRegistryFixtureSource(),
  });
}

export function createZavorthNativeConfigStateRegistryFixture(): ZavorthNativeConfigStateRegistry {
  return new ZavorthNativeConfigStateRegistry(
    normalizeZavorthNativeConfigStateRegistryFixture().registry,
  );
}
