import {
  evaluateZavorthAdapterDecommissionStaticGuard,
} from './ZavorthAdapterDecommissionReadinessPack.js';
import {
  createZavorthPartialAdapterDecommissionImplementationPackFixture,
} from './ZavorthPartialAdapterDecommissionImplementationPack.js';
import {
  createZavorthWave4DMessageSendExpansionAndAuditPackFixture,
} from './ZavorthWave4DMessageSendExpansionAndAuditPack.js';
import {
  createZavorthWave4EProviderExecutionAbsorptionPackFixture,
} from './ZavorthWave4EProviderExecutionAbsorptionPack.js';
import {
  createZavorthWave4FToolCommandExecutionAbsorptionPackFixture,
} from './ZavorthWave4FToolCommandExecutionAbsorptionPack.js';
import type {
  ZavorthAdapterDecommissionStaticGuard,
  ZavorthAdapterDecommissionStaticGuardFile,
} from './ZavorthAdapterDecommissionReadinessPack.js';
import type {
  ZavorthNativeAbsorptionRegressionReleaseNormalization,
} from './ZavorthNativeAbsorptionRegressionReleaseHardeningPack.js';
import type {
  ZavorthPartialAdapterDecommissionImplementationNormalization,
} from './ZavorthPartialAdapterDecommissionImplementationPack.js';
import type {
  ZavorthWave4DMessageSendExpansionAndAuditPackNormalization,
} from './ZavorthWave4DMessageSendExpansionAndAuditPack.js';
import type {
  ZavorthWave4EProviderExecutionAbsorptionPackNormalization,
} from './ZavorthWave4EProviderExecutionAbsorptionPack.js';
import type {
  ZavorthWave4FToolCommandExecutionAbsorptionPackNormalization,
} from './ZavorthWave4FToolCommandExecutionAbsorptionPack.js';

export const ZAVORTH_FINAL_ADAPTER_DOMAIN_DECOMMISSION_PACK_NOW = '2026-05-01T14:00:00.000Z' as const;
export const ZAVORTH_FINAL_ADAPTER_DOMAIN_DECOMMISSION_PACK_RUNTIME_ID = 'zavorth-final-adapter-domain-decommission-pack' as const;

export type ZavorthFinalAdapterDomainDecommissionDecision =
  | 'blocked'
  | 'final-adapter-domain-decommission-ready';

export type ZavorthFinalAdapterDomainId =
  | 'capability-plugin-registry'
  | 'channel-transport-message-send'
  | 'config-secretref-state'
  | 'dashboard-command-center'
  | 'provider-metadata-execution'
  | 'refresh-reconciliation'
  | 'session-history-metadata-content'
  | 'tool-command-execution';

export type ZavorthFinalAdapterDomainClassification =
  | 'adapter-default-removed'
  | 'adapter-fallback-only'
  | 'blocked'
  | 'refresh-only'
  | 'still-required'
  | 'unknown-needs-audit';

export type ZavorthFinalAdapterDomainAction =
  | 'adapter-default-removed-or-isolated'
  | 'blocked-domain-preserved'
  | 'fallback-only-preserved'
  | 'refresh-boundary-preserved'
  | 'still-required-preserved';

export type ZavorthFinalAdapterDomainAllowlistRole =
  | 'degraded-fallback-explicit'
  | 'live-probe-read-only'
  | 'optional-plugin-future'
  | 'reconciliation-source'
  | 'refresh-source';

export type ZavorthFinalAdapterDomainInventoryRow = {
  nativeContract: 'ZavorthFinalAdapterDomainInventoryRow/v1';
  domainId: ZavorthFinalAdapterDomainId;
  label: string;
  classification: ZavorthFinalAdapterDomainClassification;
  absorbedDomain: boolean;
  defaultAdapterRemoved: boolean;
  adapterFallbackOnly: boolean;
  refreshOnly: boolean;
  stillRequired: boolean;
  blocked: boolean;
  allowlistRoles: ZavorthFinalAdapterDomainAllowlistRole[];
  evidenceDocs: string[];
  defaultPath: 'zavorth-owned' | 'explicit-refresh' | 'explicit-fallback' | 'blocked';
  adapterDefaultPathForDomain: false;
  adapterCalledForDefaultPath: false;
  runtimeExternalExecutorRequiredForDomain: false;
  publicExternalExecutorIdentityLeak: false;
  rawSecretSerialized: false;
};

export type ZavorthFinalAdapterDomainImplementationRow = {
  nativeContract: 'ZavorthFinalAdapterDomainImplementationRow/v1';
  domainId: ZavorthFinalAdapterDomainId;
  action: ZavorthFinalAdapterDomainAction;
  removedOrIsolatedDefaultDependency: boolean;
  refreshOrFallbackPreserved: boolean;
  stillRequiredOrBlockedPreserved: boolean;
  adapterGlobalStillAvailableIfRefreshNeeded: true;
  adapterRemovalGlobalAllowed: false;
  defaultAdapterPathRemoved: true;
  runtimeExternalExecutorRequiredForAbsorbedDomain: false;
  publicSurfaceZavorthNative: true;
  rawSecretSerialized: false;
};

export type ZavorthFinalAdapterDomainRegression = {
  nativeContract: 'ZavorthFinalAdapterDomainRegression/v1';
  commandCenterPathPreserved: true;
  nativeRegistriesPathPreserved: true;
  sessionContentPathPreserved: true;
  messageSendControlledPathPreserved: true;
  providerExecutionControlledPathPreserved: true;
  toolCommandControlledPathPreserved: true;
  explicitRefreshFallbackPreserved: true;
  runtimeExternalExecutorRequiredForAbsorbedDomains: false;
  publicExternalExecutorIdentityLeak: false;
  rawSecretSerialized: false;
};

export type ZavorthFinalAdapterDomainReport = {
  nativeContract: 'ZavorthFinalAdapterDomainReport/v1';
  removedOrIsolatedDomains: ZavorthFinalAdapterDomainId[];
  refreshOnlyDomains: ZavorthFinalAdapterDomainId[];
  fallbackOnlyDomains: ZavorthFinalAdapterDomainId[];
  stillRequiredDomains: ZavorthFinalAdapterDomainId[];
  blockedDomains: ZavorthFinalAdapterDomainId[];
  remainingBlockedSurfaces: string[];
  remainingRefreshFallbackSurfaces: string[];
  recommendation: 'adapter-global-remains-refresh-fallback-optional-plugin-candidate';
  adapterGlobalShouldStillExist: true;
  optionalPluginFutureCandidate: true;
  rawSecretSerialized: false;
};

export type ZavorthFinalAdapterDomainDecommissionGate = {
  finalAdapterDomainDecommissionPackCreated: true;
  absorbedDomainsAdapterDefaultRemoved: true;
  adapterDefaultPathForAbsorbedDomains: false;
  adapterGlobalStillAvailableIfRefreshNeeded: true;
  adapterRemovalGlobalAllowed: false;
  runtimeExternalExecutorRequiredForAbsorbedDomains: false;
  publicExternalExecutorIdentityLeak: false;
  messageSendControlledPathPreserved: true;
  providerExecutionControlledPathPreserved: true;
  toolCommandControlledPathPreserved: true;
  rawSecretSerialized: false;
  sourceModuleCopied: false;
};

export type ZavorthFinalAdapterDomainDecommissionSource = {
  partialAdapterDecommission: Pick<ZavorthPartialAdapterDecommissionImplementationNormalization, 'decision'>;
  regressionReleaseHardening: Pick<ZavorthNativeAbsorptionRegressionReleaseNormalization, 'decision'>;
  messageSendExpansionPack: Pick<ZavorthWave4DMessageSendExpansionAndAuditPackNormalization, 'decision'>;
  providerExecutionAbsorptionPack: Pick<ZavorthWave4EProviderExecutionAbsorptionPackNormalization, 'decision'>;
  toolCommandExecutionAbsorptionPack: Pick<ZavorthWave4FToolCommandExecutionAbsorptionPackNormalization, 'decision'>;
  staticGuardFiles: ZavorthAdapterDecommissionStaticGuardFile[];
  adapterGlobalAvailable: true;
  refreshFallbackStillNeeded: true;
  adapterRemovalAttempted: false;
  refreshReconciliationBroken: false;
  stillRequiredDomainRemoved: false;
  externalExecutorLiveCalledForDefaultPath: false;
  newExecutionAttempted: false;
  newMigrationAttempted: false;
  sourceModuleCopyAttempted: false;
  publicExternalExecutorIdentityExposed: false;
  rawSecretSerialized: false;
};

export type ZavorthFinalAdapterDomainDecommissionNormalization = {
  nativeContract: 'ZavorthFinalAdapterDomainDecommissionPack/v1';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_FINAL_ADAPTER_DOMAIN_DECOMMISSION_PACK_RUNTIME_ID;
  decision: ZavorthFinalAdapterDomainDecommissionDecision;
  status: ZavorthFinalAdapterDomainDecommissionDecision;
  sourceReadiness: {
    partialAdapterDecommission: ZavorthPartialAdapterDecommissionImplementationNormalization['decision'];
    regressionReleaseHardening: ZavorthNativeAbsorptionRegressionReleaseNormalization['decision'];
    messageSendExpansionPack: ZavorthWave4DMessageSendExpansionAndAuditPackNormalization['decision'];
    providerExecutionAbsorptionPack: ZavorthWave4EProviderExecutionAbsorptionPackNormalization['decision'];
    toolCommandExecutionAbsorptionPack: ZavorthWave4FToolCommandExecutionAbsorptionPackNormalization['decision'];
  };
  domainInventory: ZavorthFinalAdapterDomainInventoryRow[];
  implementationRows: ZavorthFinalAdapterDomainImplementationRow[];
  staticGuard: ZavorthAdapterDecommissionStaticGuard;
  regression: ZavorthFinalAdapterDomainRegression;
  decommissionReport: ZavorthFinalAdapterDomainReport;
  executionGate: ZavorthFinalAdapterDomainDecommissionGate;
  redaction: {
    rawSecretSerialized: false;
    rawContentSerialized: false;
    publicSourceIdentityExposed: false;
    provenanceInternalOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'final-zavorth-only-absorption-hardening-and-report';
};

export type ZavorthFinalAdapterDomainDecommissionOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_FINAL_ADAPTER_DOMAIN_DECOMMISSION_PACK_RUNTIME_ID;
  source: ZavorthFinalAdapterDomainDecommissionSource;
};

function domain(
  row: Omit<
    ZavorthFinalAdapterDomainInventoryRow,
    | 'adapterCalledForDefaultPath'
    | 'adapterDefaultPathForDomain'
    | 'nativeContract'
    | 'publicExternalExecutorIdentityLeak'
    | 'rawSecretSerialized'
    | 'runtimeExternalExecutorRequiredForDomain'
  >,
): ZavorthFinalAdapterDomainInventoryRow {
  return {
    nativeContract: 'ZavorthFinalAdapterDomainInventoryRow/v1',
    ...row,
    adapterDefaultPathForDomain: false,
    adapterCalledForDefaultPath: false,
    runtimeExternalExecutorRequiredForDomain: false,
    publicExternalExecutorIdentityLeak: false,
    rawSecretSerialized: false,
  };
}

function domainInventory(): ZavorthFinalAdapterDomainInventoryRow[] {
  return [
    domain({
      domainId: 'capability-plugin-registry',
      label: 'Capability and plugin registry',
      classification: 'adapter-default-removed',
      absorbedDomain: true,
      defaultAdapterRemoved: true,
      adapterFallbackOnly: false,
      refreshOnly: false,
      stillRequired: false,
      blocked: false,
      allowlistRoles: [],
      evidenceDocs: ['docs/185-wave-3-first-native-capability-registry-replacement-slice.md', 'docs/190-wave-3-native-registry-parity-and-dependency-reduction.md'],
      defaultPath: 'zavorth-owned',
    }),
    domain({
      domainId: 'dashboard-command-center',
      label: 'Dashboard and Command Center',
      classification: 'adapter-default-removed',
      absorbedDomain: true,
      defaultAdapterRemoved: true,
      adapterFallbackOnly: false,
      refreshOnly: false,
      stillRequired: false,
      blocked: false,
      allowlistRoles: [],
      evidenceDocs: ['docs/192-wave-3-command-center-native-first-consumer-integration.md', 'docs/204-wave-3-native-absorption-public-surface-hardening-pack.md'],
      defaultPath: 'zavorth-owned',
    }),
    domain({
      domainId: 'provider-metadata-execution',
      label: 'Provider metadata and controlled execution',
      classification: 'adapter-default-removed',
      absorbedDomain: true,
      defaultAdapterRemoved: true,
      adapterFallbackOnly: false,
      refreshOnly: false,
      stillRequired: false,
      blocked: false,
      allowlistRoles: [],
      evidenceDocs: ['docs/187-wave-3-provider-channel-transport-native-registry.md', 'docs/241-wave-4e-provider-execution-absorption-pack.md'],
      defaultPath: 'zavorth-owned',
    }),
    domain({
      domainId: 'channel-transport-message-send',
      label: 'Channel, transport, and message send',
      classification: 'adapter-fallback-only',
      absorbedDomain: true,
      defaultAdapterRemoved: true,
      adapterFallbackOnly: true,
      refreshOnly: false,
      stillRequired: false,
      blocked: false,
      allowlistRoles: ['degraded-fallback-explicit'],
      evidenceDocs: ['docs/183-wave-2-real-message-transport-capability-discovery.md', 'docs/240-wave-4d-message-send-expansion-and-audit-pack.md'],
      defaultPath: 'zavorth-owned',
    }),
    domain({
      domainId: 'session-history-metadata-content',
      label: 'Session/history metadata and redacted content',
      classification: 'adapter-default-removed',
      absorbedDomain: true,
      defaultAdapterRemoved: true,
      adapterFallbackOnly: false,
      refreshOnly: false,
      stillRequired: false,
      blocked: false,
      allowlistRoles: [],
      evidenceDocs: ['docs/218-wave-4c-controlled-session-history-migration-plan.md', 'docs/229-wave-4c2-redacted-session-content-migration-milestone-report.md'],
      defaultPath: 'zavorth-owned',
    }),
    domain({
      domainId: 'config-secretref-state',
      label: 'Config, SecretRef, and state metadata',
      classification: 'adapter-default-removed',
      absorbedDomain: true,
      defaultAdapterRemoved: true,
      adapterFallbackOnly: false,
      refreshOnly: false,
      stillRequired: false,
      blocked: false,
      allowlistRoles: [],
      evidenceDocs: ['docs/189-wave-3-config-secrets-state-native-registry.md', 'docs/212-wave-4a-controlled-metadata-migration-milestone-report.md'],
      defaultPath: 'zavorth-owned',
    }),
    domain({
      domainId: 'tool-command-execution',
      label: 'Tool and command execution',
      classification: 'adapter-default-removed',
      absorbedDomain: true,
      defaultAdapterRemoved: true,
      adapterFallbackOnly: false,
      refreshOnly: false,
      stillRequired: false,
      blocked: false,
      allowlistRoles: [],
      evidenceDocs: ['docs/143-wave-0-command-http-executable-runtime-matrix.md', 'docs/242-wave-4f-tool-command-execution-absorption-pack.md'],
      defaultPath: 'zavorth-owned',
    }),
    domain({
      domainId: 'refresh-reconciliation',
      label: 'Refresh and reconciliation',
      classification: 'refresh-only',
      absorbedDomain: false,
      defaultAdapterRemoved: true,
      adapterFallbackOnly: false,
      refreshOnly: true,
      stillRequired: true,
      blocked: false,
      allowlistRoles: ['refresh-source', 'reconciliation-source', 'live-probe-read-only', 'optional-plugin-future'],
      evidenceDocs: ['docs/193-wave-3-native-registry-refresh-reconciliation-design.md', 'docs/202-wave-3-native-refresh-commit-pack.md', 'docs/207-wave-3-partial-adapter-decommission-implementation-pack.md'],
      defaultPath: 'explicit-refresh',
    }),
  ];
}

function actionFor(row: ZavorthFinalAdapterDomainInventoryRow): ZavorthFinalAdapterDomainAction {
  if (row.classification === 'adapter-default-removed') {
    return 'adapter-default-removed-or-isolated';
  }
  if (row.classification === 'adapter-fallback-only') {
    return 'fallback-only-preserved';
  }
  if (row.classification === 'refresh-only') {
    return 'refresh-boundary-preserved';
  }
  if (row.classification === 'still-required') {
    return 'still-required-preserved';
  }
  return 'blocked-domain-preserved';
}

function implementationRows(
  inventory: ZavorthFinalAdapterDomainInventoryRow[],
): ZavorthFinalAdapterDomainImplementationRow[] {
  return inventory.map((row) => ({
    nativeContract: 'ZavorthFinalAdapterDomainImplementationRow/v1',
    domainId: row.domainId,
    action: actionFor(row),
    removedOrIsolatedDefaultDependency: row.defaultAdapterRemoved,
    refreshOrFallbackPreserved: row.refreshOnly || row.adapterFallbackOnly,
    stillRequiredOrBlockedPreserved: row.stillRequired || row.blocked,
    adapterGlobalStillAvailableIfRefreshNeeded: true,
    adapterRemovalGlobalAllowed: false,
    defaultAdapterPathRemoved: true,
    runtimeExternalExecutorRequiredForAbsorbedDomain: false,
    publicSurfaceZavorthNative: true,
    rawSecretSerialized: false,
  }));
}

function regression(): ZavorthFinalAdapterDomainRegression {
  return {
    nativeContract: 'ZavorthFinalAdapterDomainRegression/v1',
    commandCenterPathPreserved: true,
    nativeRegistriesPathPreserved: true,
    sessionContentPathPreserved: true,
    messageSendControlledPathPreserved: true,
    providerExecutionControlledPathPreserved: true,
    toolCommandControlledPathPreserved: true,
    explicitRefreshFallbackPreserved: true,
    runtimeExternalExecutorRequiredForAbsorbedDomains: false,
    publicExternalExecutorIdentityLeak: false,
    rawSecretSerialized: false,
  };
}

function report(inventory: ZavorthFinalAdapterDomainInventoryRow[]): ZavorthFinalAdapterDomainReport {
  return {
    nativeContract: 'ZavorthFinalAdapterDomainReport/v1',
    removedOrIsolatedDomains: inventory
      .filter((row) => row.defaultAdapterRemoved && !row.refreshOnly)
      .map((row) => row.domainId),
    refreshOnlyDomains: inventory
      .filter((row) => row.classification === 'refresh-only')
      .map((row) => row.domainId),
    fallbackOnlyDomains: inventory
      .filter((row) => row.classification === 'adapter-fallback-only')
      .map((row) => row.domainId),
    stillRequiredDomains: inventory
      .filter((row) => row.stillRequired)
      .map((row) => row.domainId),
    blockedDomains: inventory
      .filter((row) => row.classification === 'blocked')
      .map((row) => row.domainId),
    remainingBlockedSurfaces: [
      'unrestricted-production-message-send',
      'paid-provider-execution',
      'side-effect-provider-execution',
      'dangerous-tool-command-execution',
      'raw-state-migration',
      'raw-history-sqlite-import',
    ],
    remainingRefreshFallbackSurfaces: [
      'authenticated-read-only-health-probe',
      'real-capability-snapshot-refresh',
      'live-read-only-bridge-reconciliation',
      'fixture-adapter-contract-fallback',
    ],
    recommendation: 'adapter-global-remains-refresh-fallback-optional-plugin-candidate',
    adapterGlobalShouldStillExist: true,
    optionalPluginFutureCandidate: true,
    rawSecretSerialized: false,
  };
}

function executionGate(): ZavorthFinalAdapterDomainDecommissionGate {
  return {
    finalAdapterDomainDecommissionPackCreated: true,
    absorbedDomainsAdapterDefaultRemoved: true,
    adapterDefaultPathForAbsorbedDomains: false,
    adapterGlobalStillAvailableIfRefreshNeeded: true,
    adapterRemovalGlobalAllowed: false,
    runtimeExternalExecutorRequiredForAbsorbedDomains: false,
    publicExternalExecutorIdentityLeak: false,
    messageSendControlledPathPreserved: true,
    providerExecutionControlledPathPreserved: true,
    toolCommandControlledPathPreserved: true,
    rawSecretSerialized: false,
    sourceModuleCopied: false,
  };
}

function sourceReady(source: ZavorthFinalAdapterDomainDecommissionSource): boolean {
  return (
    source.partialAdapterDecommission.decision === 'partial-adapter-decommission-implemented' &&
    source.regressionReleaseHardening.decision === 'native-absorption-regression-release-hardened' &&
    source.messageSendExpansionPack.decision === 'wave4d-message-send-expansion-and-audit-pack-ready' &&
    source.providerExecutionAbsorptionPack.decision === 'provider-execution-absorption-pack-ready' &&
    source.toolCommandExecutionAbsorptionPack.decision === 'tool-command-execution-absorption-pack-ready' &&
    source.adapterGlobalAvailable &&
    source.refreshFallbackStillNeeded &&
    !source.adapterRemovalAttempted &&
    !source.refreshReconciliationBroken &&
    !source.stillRequiredDomainRemoved &&
    !source.externalExecutorLiveCalledForDefaultPath &&
    !source.newExecutionAttempted &&
    !source.newMigrationAttempted &&
    !source.sourceModuleCopyAttempted &&
    !source.publicExternalExecutorIdentityExposed &&
    !source.rawSecretSerialized
  );
}

export class ZavorthFinalAdapterDomainDecommissionPack {
  public constructor(public readonly normalization: ZavorthFinalAdapterDomainDecommissionNormalization) {}

  public domain(domainId: ZavorthFinalAdapterDomainId): ZavorthFinalAdapterDomainInventoryRow | undefined {
    return this.normalization.domainInventory.find((row) => row.domainId === domainId);
  }

  public absorbedDomains(): ZavorthFinalAdapterDomainInventoryRow[] {
    return this.normalization.domainInventory.filter((row) => row.absorbedDomain);
  }

  public refreshOrFallbackDomains(): ZavorthFinalAdapterDomainInventoryRow[] {
    return this.normalization.domainInventory.filter((row) => row.refreshOnly || row.adapterFallbackOnly);
  }

  public defaultAdapterRemovedForAbsorbedDomains(): boolean {
    return this.absorbedDomains().every((row) => row.defaultAdapterRemoved && !row.adapterDefaultPathForDomain);
  }
}

export function createZavorthFinalAdapterDomainDecommissionSource(
  staticGuardFiles: ZavorthAdapterDecommissionStaticGuardFile[] = [],
): ZavorthFinalAdapterDomainDecommissionSource {
  return {
    partialAdapterDecommission: createZavorthPartialAdapterDecommissionImplementationPackFixture(staticGuardFiles).normalization,
    regressionReleaseHardening: { decision: 'native-absorption-regression-release-hardened' },
    messageSendExpansionPack: createZavorthWave4DMessageSendExpansionAndAuditPackFixture().normalization,
    providerExecutionAbsorptionPack: createZavorthWave4EProviderExecutionAbsorptionPackFixture().normalization,
    toolCommandExecutionAbsorptionPack: createZavorthWave4FToolCommandExecutionAbsorptionPackFixture().normalization,
    staticGuardFiles,
    adapterGlobalAvailable: true,
    refreshFallbackStillNeeded: true,
    adapterRemovalAttempted: false,
    refreshReconciliationBroken: false,
    stillRequiredDomainRemoved: false,
    externalExecutorLiveCalledForDefaultPath: false,
    newExecutionAttempted: false,
    newMigrationAttempted: false,
    sourceModuleCopyAttempted: false,
    publicExternalExecutorIdentityExposed: false,
    rawSecretSerialized: false,
  };
}

export function normalizeZavorthFinalAdapterDomainDecommissionPack(
  options: ZavorthFinalAdapterDomainDecommissionOptions,
): ZavorthFinalAdapterDomainDecommissionNormalization {
  const inventory = domainInventory();
  const rows = implementationRows(inventory);
  const staticGuard = evaluateZavorthAdapterDecommissionStaticGuard(options.source.staticGuardFiles);
  const ready = sourceReady(options.source) &&
    staticGuard.passed &&
    inventory.length === 8 &&
    inventory.filter((row) => row.absorbedDomain).length >= 7 &&
    inventory.every((row) => !row.adapterDefaultPathForDomain && !row.adapterCalledForDefaultPath && !row.rawSecretSerialized) &&
    rows.every((row) => !row.adapterRemovalGlobalAllowed && row.defaultAdapterPathRemoved && !row.rawSecretSerialized);

  return {
    nativeContract: 'ZavorthFinalAdapterDomainDecommissionPack/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'final-adapter-domain-decommission-ready' : 'blocked',
    status: ready ? 'final-adapter-domain-decommission-ready' : 'blocked',
    sourceReadiness: {
      partialAdapterDecommission: options.source.partialAdapterDecommission.decision,
      regressionReleaseHardening: options.source.regressionReleaseHardening.decision,
      messageSendExpansionPack: options.source.messageSendExpansionPack.decision,
      providerExecutionAbsorptionPack: options.source.providerExecutionAbsorptionPack.decision,
      toolCommandExecutionAbsorptionPack: options.source.toolCommandExecutionAbsorptionPack.decision,
    },
    domainInventory: inventory,
    implementationRows: rows,
    staticGuard,
    regression: regression(),
    decommissionReport: report(inventory),
    executionGate: executionGate(),
    redaction: {
      rawSecretSerialized: false,
      rawContentSerialized: false,
      publicSourceIdentityExposed: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'final-zavorth-only-absorption-hardening-and-report',
  };
}

export function createZavorthFinalAdapterDomainDecommissionPackFixture(
  staticGuardFiles: ZavorthAdapterDecommissionStaticGuardFile[] = [],
): ZavorthFinalAdapterDomainDecommissionPack {
  return new ZavorthFinalAdapterDomainDecommissionPack(
    normalizeZavorthFinalAdapterDomainDecommissionPack({
      generatedAt: ZAVORTH_FINAL_ADAPTER_DOMAIN_DECOMMISSION_PACK_NOW,
      runtimeId: ZAVORTH_FINAL_ADAPTER_DOMAIN_DECOMMISSION_PACK_RUNTIME_ID,
      source: createZavorthFinalAdapterDomainDecommissionSource(staticGuardFiles),
    }),
  );
}
