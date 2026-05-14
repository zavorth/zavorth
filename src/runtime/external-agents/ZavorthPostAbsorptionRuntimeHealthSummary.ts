import {
  createZavorthFinalZavorthOnlyAbsorptionHardeningReportFixture,
} from './ZavorthFinalZavorthOnlyAbsorptionHardeningReport.js';
import {
  createZavorthLimitedProductionMessageSendExpansionPackFixture,
} from './PostAbsorptionLimitedProductionMessageSendExpansionPack.js';
import type {
  ZavorthFinalAbsorptionDomainId,
  ZavorthFinalZavorthOnlyAbsorptionNormalization,
} from './ZavorthFinalZavorthOnlyAbsorptionHardeningReport.js';
import type {
  ZavorthLimitedProductionMessageSendNormalization,
} from './PostAbsorptionLimitedProductionMessageSendExpansionPack.js';

export const ZAVORTH_POST_ABSORPTION_RUNTIME_HEALTH_SUMMARY_NOW = '2026-05-01T22:00:00.000Z' as const;
export const ZAVORTH_POST_ABSORPTION_RUNTIME_HEALTH_SUMMARY_RUNTIME_ID = 'zavorth-post-absorption-runtime-health-summary' as const;

export type ZavorthPostAbsorptionRuntimeHealthStatus =
  | 'blocked'
  | 'degraded'
  | 'healthy'
  | 'needs-operator-action';

export type ZavorthPostAbsorptionObservabilitySignalId =
  | 'adapter-fallback-status'
  | 'message-send-receipts'
  | 'migration-import-disabled-status'
  | 'native-registry-health'
  | 'production-loaded-registry-status'
  | 'provider-tool-command-receipts'
  | 'redaction-public-surface-scan-status'
  | 'refresh-reconciliation-status';

export type ZavorthPostAbsorptionAlertId =
  | 'blocked-production-send-attempt'
  | 'failed-refresh-reconciliation'
  | 'fallback-adapter-invoked-unexpectedly'
  | 'missing-secretref'
  | 'redaction-violation'
  | 'registry-load-failure'
  | 'shard-regression';

export type ZavorthPostAbsorptionDomainHealth = {
  nativeContract: 'ZavorthPostAbsorptionDomainHealth/v1';
  domainId: ZavorthFinalAbsorptionDomainId;
  label: string;
  status: ZavorthPostAbsorptionRuntimeHealthStatus;
  absorbedOrOwned: boolean;
  fallbackRefreshStatus: 'blocked' | 'explicit-fallback' | 'explicit-refresh' | 'none' | 'optional-future';
  defaultRuntimeZavorthOwned: boolean;
  adapterDefaultPathForDomain: false;
  externalExecutorLiveRequiredForHealth: false;
  rawSecretSerialized: false;
};

export type ZavorthPostAbsorptionObservabilitySignal = {
  nativeContract: 'ZavorthPostAbsorptionObservabilitySignal/v1';
  signalId: ZavorthPostAbsorptionObservabilitySignalId;
  label: string;
  status: ZavorthPostAbsorptionRuntimeHealthStatus;
  evidenceDocs: string[];
  externalExecutorLiveRequiredForSignal: false;
  receiptRedacted: true;
  rawSecretSerialized: false;
};

export type ZavorthPostAbsorptionLightAlert = {
  nativeContract: 'ZavorthPostAbsorptionLightAlert/v1';
  alertId: ZavorthPostAbsorptionAlertId;
  status: 'active' | 'clear';
  severity: 'blocker' | 'operator-action' | 'warning';
  modeled: true;
  externalIntegrationCreated: false;
  rawSecretSerialized: false;
};

export type ZavorthPostAbsorptionOperatorDiagnostics = {
  nativeContract: 'ZavorthPostAbsorptionOperatorDiagnostics/v1';
  commands: [
    'npm run runtime:check --silent',
    'npm run test:external-agents:shard -- N/16 --testTimeout=30000',
    'npx jest tests/ai-gateway/control --runInBand',
    'redaction scan',
    'public surface scan',
    'process/listener cleanup',
  ];
  aiGatewayControlPolicy: 'run-only-if-dashboard-control-touched';
  fullExternalAgentsSuitePolicy: 'do-not-run-unsharded-by-default';
  diagnosticsRedacted: true;
  rawSecretSerialized: false;
};

export type ZavorthPostAbsorptionMonitoringPolishReport = {
  nativeContract: 'ZavorthPostAbsorptionMonitoringPolishReport/v1';
  finalMonitoringStatus: ZavorthPostAbsorptionRuntimeHealthStatus;
  remainingGaps: string[];
  recommendedPolishFixes: string[];
  externalHeavyMonitoringAdded: false;
  rawSecretSerialized: false;
};

export type ZavorthPostAbsorptionRuntimeHealthGate = {
  releaseMonitoringObservabilityPolishPackCreated: true;
  postAbsorptionRuntimeHealthSummaryCreated: true;
  defaultRuntimeZavorthOwned: true;
  externalExecutorLiveRequiredForHealthSummary: false;
  adapterDefaultPathForAbsorbedDomains: false;
  rawSecretSerialized: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  toolCommandActuallyExecuted: false;
  rawMigrationPerformed: false;
  adapterRemovalGlobalAllowed: false;
};

export type ZavorthPostAbsorptionRuntimeHealthSource = {
  finalZavorthOnlyReport: Pick<
    ZavorthFinalZavorthOnlyAbsorptionNormalization,
    'decision' | 'executionGate' | 'finalAbsorptionMatrix'
  >;
  limitedProductionMessageSend: Pick<
    ZavorthLimitedProductionMessageSendNormalization,
    'decision' | 'executionGate' | 'receipt'
  >;
  nativeRegistryHealthOk: boolean;
  productionLoadedRegistryOk: boolean;
  refreshReconciliationOk: boolean;
  messageSendReceiptsRedacted: boolean;
  providerToolCommandReceiptsRedacted: boolean;
  migrationImportDisabled: boolean;
  adapterFallbackUnexpectedlyInvoked: boolean;
  redactionScanPassed: boolean;
  publicSurfaceScanPassed: boolean;
  registryLoadFailureDetected: boolean;
  failedRefreshReconciliationDetected: boolean;
  blockedProductionSendAttemptDetected: boolean;
  missingSecretRefDetected: boolean;
  shardRegressionDetected: boolean;
  externalExecutorLiveCalledForHealthDefault: false;
  messageSendAttempted: false;
  providerExecutionAttempted: false;
  toolCommandExecutionAttempted: false;
  rawMigrationAttempted: false;
  adapterRemovalAttempted: false;
  externalHeavyMonitoringIntegrationAttempted: false;
  publicExternalExecutorIdentityExposed: false;
  rawSecretSerialized: false;
};

export type ZavorthPostAbsorptionRuntimeHealthNormalization = {
  nativeContract: 'ZavorthPostAbsorptionRuntimeHealthSummary/v1';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_POST_ABSORPTION_RUNTIME_HEALTH_SUMMARY_RUNTIME_ID;
  status: ZavorthPostAbsorptionRuntimeHealthStatus;
  domainHealth: ZavorthPostAbsorptionDomainHealth[];
  observabilityInventory: ZavorthPostAbsorptionObservabilitySignal[];
  alerts: ZavorthPostAbsorptionLightAlert[];
  operatorDiagnostics: ZavorthPostAbsorptionOperatorDiagnostics;
  monitoringPolishReport: ZavorthPostAbsorptionMonitoringPolishReport;
  executionGate: ZavorthPostAbsorptionRuntimeHealthGate;
  redaction: {
    rawSecretSerialized: false;
    rawContentSerialized: false;
    publicSourceIdentityExposed: false;
    diagnosticsRedacted: true;
    receiptsRedacted: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'post-absorption-final-maintenance-backlog-and-roadmap-pack';
};

export type ZavorthPostAbsorptionRuntimeHealthOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_POST_ABSORPTION_RUNTIME_HEALTH_SUMMARY_RUNTIME_ID;
  source: ZavorthPostAbsorptionRuntimeHealthSource;
};

function domainStatus(source: ZavorthPostAbsorptionRuntimeHealthSource): ZavorthPostAbsorptionRuntimeHealthStatus {
  if (source.registryLoadFailureDetected || !source.redactionScanPassed || !source.publicSurfaceScanPassed) {
    return 'blocked';
  }
  if (source.adapterFallbackUnexpectedlyInvoked || source.missingSecretRefDetected || source.blockedProductionSendAttemptDetected) {
    return 'needs-operator-action';
  }
  if (source.failedRefreshReconciliationDetected || source.shardRegressionDetected) {
    return 'degraded';
  }
  return 'healthy';
}

function fallbackRefreshStatus(
  domainId: ZavorthFinalAbsorptionDomainId,
): ZavorthPostAbsorptionDomainHealth['fallbackRefreshStatus'] {
  if (domainId === 'channel-transport-message-send') {
    return 'explicit-fallback';
  }
  if (domainId === 'refresh-reconciliation') {
    return 'explicit-refresh';
  }
  if (domainId === 'optional-future-adapter') {
    return 'optional-future';
  }
  if (domainId === 'blocked-explicitly-out-of-scope') {
    return 'blocked';
  }
  return 'none';
}

function domainHealth(source: ZavorthPostAbsorptionRuntimeHealthSource): ZavorthPostAbsorptionDomainHealth[] {
  const status = domainStatus(source);

  return source.finalZavorthOnlyReport.finalAbsorptionMatrix.map((row) => ({
    nativeContract: 'ZavorthPostAbsorptionDomainHealth/v1',
    domainId: row.domainId,
    label: row.label,
    status: row.blockedOrOutOfScope ? 'blocked' : status,
    absorbedOrOwned: row.absorbedDomain || row.zavorthOwnedExecution,
    fallbackRefreshStatus: fallbackRefreshStatus(row.domainId),
    defaultRuntimeZavorthOwned: row.defaultRuntime === 'zavorth-owned',
    adapterDefaultPathForDomain: false,
    externalExecutorLiveRequiredForHealth: false,
    rawSecretSerialized: false,
  }));
}

function signal(
  signalId: ZavorthPostAbsorptionObservabilitySignalId,
  label: string,
  status: ZavorthPostAbsorptionRuntimeHealthStatus,
  evidenceDocs: string[],
): ZavorthPostAbsorptionObservabilitySignal {
  return {
    nativeContract: 'ZavorthPostAbsorptionObservabilitySignal/v1',
    signalId,
    label,
    status,
    evidenceDocs,
    externalExecutorLiveRequiredForSignal: false,
    receiptRedacted: true,
    rawSecretSerialized: false,
  };
}

function observabilityInventory(source: ZavorthPostAbsorptionRuntimeHealthSource): ZavorthPostAbsorptionObservabilitySignal[] {
  return [
    signal(
      'native-registry-health',
      'Native registry health',
      source.nativeRegistryHealthOk && !source.registryLoadFailureDetected ? 'healthy' : 'blocked',
      ['docs/185-wave-3-first-native-capability-registry-replacement-slice.md', 'docs/244-final-zavorth-only-absorption-hardening-and-report.md'],
    ),
    signal(
      'production-loaded-registry-status',
      'Production-loaded registry status',
      source.productionLoadedRegistryOk ? 'healthy' : 'degraded',
      ['docs/198-wave-3-native-registry-production-persistence-flagged.md', 'docs/244-final-zavorth-only-absorption-hardening-and-report.md'],
    ),
    signal(
      'refresh-reconciliation-status',
      'Refresh and reconciliation status',
      source.refreshReconciliationOk && !source.failedRefreshReconciliationDetected ? 'healthy' : 'degraded',
      ['docs/193-wave-3-native-registry-refresh-reconciliation-design.md', 'docs/202-wave-3-native-refresh-commit-pack.md'],
    ),
    signal(
      'message-send-receipts',
      'Message-send receipts',
      source.messageSendReceiptsRedacted && !source.blockedProductionSendAttemptDetected ? 'healthy' : 'needs-operator-action',
      ['docs/238-wave-4d-first-controlled-real-message-send.md', 'docs/255-post-absorption-limited-production-message-send-expansion-pack.md'],
    ),
    signal(
      'provider-tool-command-receipts',
      'Provider/tool/command receipts',
      source.providerToolCommandReceiptsRedacted ? 'healthy' : 'needs-operator-action',
      ['docs/241-wave-4e-provider-execution-absorption-pack.md', 'docs/242-wave-4f-tool-command-execution-absorption-pack.md'],
    ),
    signal(
      'migration-import-disabled-status',
      'Migration/import disabled status',
      source.migrationImportDisabled ? 'healthy' : 'blocked',
      ['docs/247-post-absorption-raw-history-sqlite-import-decision.md', 'docs/254-post-absorption-optional-raw-history-sqlite-importer-design-pack.md'],
    ),
    signal(
      'adapter-fallback-status',
      'Adapter fallback status',
      source.adapterFallbackUnexpectedlyInvoked ? 'needs-operator-action' : 'healthy',
      ['docs/253-post-absorption-fallback-adapter-retirement-domain-pack.md'],
    ),
    signal(
      'redaction-public-surface-scan-status',
      'Redaction and public surface scan status',
      source.redactionScanPassed && source.publicSurfaceScanPassed ? 'healthy' : 'blocked',
      ['docs/248-post-absorption-release-docs-install-cleanup.md', 'docs/249-post-absorption-release-candidate-report.md'],
    ),
  ];
}

function alert(
  alertId: ZavorthPostAbsorptionAlertId,
  active: boolean,
  severity: ZavorthPostAbsorptionLightAlert['severity'],
): ZavorthPostAbsorptionLightAlert {
  return {
    nativeContract: 'ZavorthPostAbsorptionLightAlert/v1',
    alertId,
    status: active ? 'active' : 'clear',
    severity,
    modeled: true,
    externalIntegrationCreated: false,
    rawSecretSerialized: false,
  };
}

function alerts(source: ZavorthPostAbsorptionRuntimeHealthSource): ZavorthPostAbsorptionLightAlert[] {
  return [
    alert('registry-load-failure', source.registryLoadFailureDetected, 'blocker'),
    alert('redaction-violation', !source.redactionScanPassed || !source.publicSurfaceScanPassed, 'blocker'),
    alert('fallback-adapter-invoked-unexpectedly', source.adapterFallbackUnexpectedlyInvoked, 'operator-action'),
    alert('failed-refresh-reconciliation', source.failedRefreshReconciliationDetected, 'warning'),
    alert('blocked-production-send-attempt', source.blockedProductionSendAttemptDetected, 'operator-action'),
    alert('missing-secretref', source.missingSecretRefDetected, 'operator-action'),
    alert('shard-regression', source.shardRegressionDetected, 'warning'),
  ];
}

function operatorDiagnostics(): ZavorthPostAbsorptionOperatorDiagnostics {
  return {
    nativeContract: 'ZavorthPostAbsorptionOperatorDiagnostics/v1',
    commands: [
      'npm run runtime:check --silent',
      'npm run test:external-agents:shard -- N/16 --testTimeout=30000',
      'npx jest tests/ai-gateway/control --runInBand',
      'redaction scan',
      'public surface scan',
      'process/listener cleanup',
    ],
    aiGatewayControlPolicy: 'run-only-if-dashboard-control-touched',
    fullExternalAgentsSuitePolicy: 'do-not-run-unsharded-by-default',
    diagnosticsRedacted: true,
    rawSecretSerialized: false,
  };
}

function overallStatus(
  source: ZavorthPostAbsorptionRuntimeHealthSource,
  signals: ZavorthPostAbsorptionObservabilitySignal[],
): ZavorthPostAbsorptionRuntimeHealthStatus {
  if (
    source.finalZavorthOnlyReport.decision !== 'final-zavorth-only-absorption-hardened' ||
    source.externalExecutorLiveCalledForHealthDefault ||
    source.messageSendAttempted ||
    source.providerExecutionAttempted ||
    source.toolCommandExecutionAttempted ||
    source.rawMigrationAttempted ||
    source.adapterRemovalAttempted ||
    source.externalHeavyMonitoringIntegrationAttempted ||
    source.publicExternalExecutorIdentityExposed ||
    source.rawSecretSerialized ||
    signals.some((entry) => entry.status === 'blocked')
  ) {
    return 'blocked';
  }
  if (
    source.adapterFallbackUnexpectedlyInvoked ||
    source.blockedProductionSendAttemptDetected ||
    source.missingSecretRefDetected ||
    signals.some((entry) => entry.status === 'needs-operator-action')
  ) {
    return 'needs-operator-action';
  }
  if (
    source.failedRefreshReconciliationDetected ||
    source.shardRegressionDetected ||
    signals.some((entry) => entry.status === 'degraded')
  ) {
    return 'degraded';
  }
  return 'healthy';
}

function monitoringReport(
  status: ZavorthPostAbsorptionRuntimeHealthStatus,
): ZavorthPostAbsorptionMonitoringPolishReport {
  return {
    nativeContract: 'ZavorthPostAbsorptionMonitoringPolishReport/v1',
    finalMonitoringStatus: status,
    remainingGaps: [
      'external-agents heavy shard timing should continue to be tracked by shard',
      'optional raw history importer remains design-only and disabled by default',
      'limited production send remains policy-only unless explicitly flagged later',
      'fallback/refresh adapter retirement can continue per domain',
    ],
    recommendedPolishFixes: [
      'record shard timing trend in release receipts',
      'add lightweight registry restore failure receipt if a storage load fails',
      'add operator-facing missing SecretRef reason codes to receipts',
      'keep public surface and redaction scans in release checklist',
    ],
    externalHeavyMonitoringAdded: false,
    rawSecretSerialized: false,
  };
}

function executionGate(): ZavorthPostAbsorptionRuntimeHealthGate {
  return {
    releaseMonitoringObservabilityPolishPackCreated: true,
    postAbsorptionRuntimeHealthSummaryCreated: true,
    defaultRuntimeZavorthOwned: true,
    externalExecutorLiveRequiredForHealthSummary: false,
    adapterDefaultPathForAbsorbedDomains: false,
    rawSecretSerialized: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    toolCommandActuallyExecuted: false,
    rawMigrationPerformed: false,
    adapterRemovalGlobalAllowed: false,
  };
}

export class ZavorthPostAbsorptionRuntimeHealthSummary {
  public constructor(public readonly normalization: ZavorthPostAbsorptionRuntimeHealthNormalization) {}

  public signal(signalId: ZavorthPostAbsorptionObservabilitySignalId): ZavorthPostAbsorptionObservabilitySignal | undefined {
    return this.normalization.observabilityInventory.find((entry) => entry.signalId === signalId);
  }

  public alert(alertId: ZavorthPostAbsorptionAlertId): ZavorthPostAbsorptionLightAlert | undefined {
    return this.normalization.alerts.find((entry) => entry.alertId === alertId);
  }

  public domainsByStatus(status: ZavorthPostAbsorptionRuntimeHealthStatus): ZavorthPostAbsorptionDomainHealth[] {
    return this.normalization.domainHealth.filter((entry) => entry.status === status);
  }
}

export function createZavorthPostAbsorptionRuntimeHealthSource(
  overrides: Partial<ZavorthPostAbsorptionRuntimeHealthSource> = {},
): ZavorthPostAbsorptionRuntimeHealthSource {
  return {
    finalZavorthOnlyReport: createZavorthFinalZavorthOnlyAbsorptionHardeningReportFixture().normalization,
    limitedProductionMessageSend: createZavorthLimitedProductionMessageSendExpansionPackFixture().normalization,
    nativeRegistryHealthOk: true,
    productionLoadedRegistryOk: true,
    refreshReconciliationOk: true,
    messageSendReceiptsRedacted: true,
    providerToolCommandReceiptsRedacted: true,
    migrationImportDisabled: true,
    adapterFallbackUnexpectedlyInvoked: false,
    redactionScanPassed: true,
    publicSurfaceScanPassed: true,
    registryLoadFailureDetected: false,
    failedRefreshReconciliationDetected: false,
    blockedProductionSendAttemptDetected: false,
    missingSecretRefDetected: false,
    shardRegressionDetected: false,
    externalExecutorLiveCalledForHealthDefault: false,
    messageSendAttempted: false,
    providerExecutionAttempted: false,
    toolCommandExecutionAttempted: false,
    rawMigrationAttempted: false,
    adapterRemovalAttempted: false,
    externalHeavyMonitoringIntegrationAttempted: false,
    publicExternalExecutorIdentityExposed: false,
    rawSecretSerialized: false,
    ...overrides,
  };
}

export function normalizeZavorthPostAbsorptionRuntimeHealthSummary(
  options: ZavorthPostAbsorptionRuntimeHealthOptions,
): ZavorthPostAbsorptionRuntimeHealthNormalization {
  const inventory = observabilityInventory(options.source);
  const status = overallStatus(options.source, inventory);

  return {
    nativeContract: 'ZavorthPostAbsorptionRuntimeHealthSummary/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    status,
    domainHealth: domainHealth(options.source),
    observabilityInventory: inventory,
    alerts: alerts(options.source),
    operatorDiagnostics: operatorDiagnostics(),
    monitoringPolishReport: monitoringReport(status),
    executionGate: executionGate(),
    redaction: {
      rawSecretSerialized: false,
      rawContentSerialized: false,
      publicSourceIdentityExposed: false,
      diagnosticsRedacted: true,
      receiptsRedacted: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'post-absorption-final-maintenance-backlog-and-roadmap-pack',
  };
}

export function createZavorthPostAbsorptionRuntimeHealthSummaryFixture(
  overrides: Partial<ZavorthPostAbsorptionRuntimeHealthSource> = {},
): ZavorthPostAbsorptionRuntimeHealthSummary {
  return new ZavorthPostAbsorptionRuntimeHealthSummary(
    normalizeZavorthPostAbsorptionRuntimeHealthSummary({
      generatedAt: ZAVORTH_POST_ABSORPTION_RUNTIME_HEALTH_SUMMARY_NOW,
      runtimeId: ZAVORTH_POST_ABSORPTION_RUNTIME_HEALTH_SUMMARY_RUNTIME_ID,
      source: createZavorthPostAbsorptionRuntimeHealthSource(overrides),
    }),
  );
}
