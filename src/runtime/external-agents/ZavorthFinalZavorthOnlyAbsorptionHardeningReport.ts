import {
  createZavorthFinalAdapterDomainDecommissionPackFixture,
} from './ZavorthFinalAdapterDomainDecommissionPack.js';
import {
  evaluateZavorthAdapterDecommissionStaticGuard,
} from './ZavorthAdapterDecommissionReadinessPack.js';
import type {
  ZavorthAdapterDecommissionStaticGuard,
  ZavorthAdapterDecommissionStaticGuardFile,
} from './ZavorthAdapterDecommissionReadinessPack.js';
import type {
  ZavorthFinalAdapterDomainDecommissionNormalization,
} from './ZavorthFinalAdapterDomainDecommissionPack.js';

export const ZAVORTH_FINAL_ZAVORTH_ONLY_ABSORPTION_HARDENING_REPORT_NOW = '2026-05-01T15:00:00.000Z' as const;
export const ZAVORTH_FINAL_ZAVORTH_ONLY_ABSORPTION_HARDENING_REPORT_RUNTIME_ID = 'zavorth-final-zavorth-only-absorption-hardening-report' as const;

export type ZavorthFinalZavorthOnlyAbsorptionDecision =
  | 'blocked'
  | 'final-zavorth-only-absorption-hardened';

export type ZavorthFinalAbsorptionDomainId =
  | 'blocked-explicitly-out-of-scope'
  | 'capability-plugin-registry'
  | 'channel-transport-message-send'
  | 'config-secretref-state'
  | 'dashboard-command-center'
  | 'optional-future-adapter'
  | 'provider-metadata-execution'
  | 'refresh-reconciliation'
  | 'session-history-metadata-content'
  | 'tool-command-execution';

export type ZavorthFinalAbsorptionClassification =
  | 'absorbed-native'
  | 'zavorth-owned-execution'
  | 'blocked-explicitly-out-of-scope'
  | 'optional-future-adapter'
  | 'refresh-fallback-only';

export type ZavorthFinalAbsorptionMatrixRow = {
  nativeContract: 'ZavorthFinalAbsorptionMatrixRow/v1';
  domainId: ZavorthFinalAbsorptionDomainId;
  label: string;
  classification: ZavorthFinalAbsorptionClassification;
  evidenceDocs: string[];
  absorbedDomain: boolean;
  zavorthOwnedExecution: boolean;
  refreshFallbackOnly: boolean;
  optionalFutureAdapter: boolean;
  blockedOrOutOfScope: boolean;
  defaultRuntime: 'zavorth-owned' | 'blocked' | 'explicit-refresh-fallback' | 'optional-future-plugin';
  adapterDefaultPathForDomain: false;
  externalExecutorNotRequiredForDomain: boolean;
  publicExternalExecutorIdentityLeak: false;
  rawSecretSerialized: false;
  rawContentLeak: false;
  sourceModuleCopied: false;
};

export type ZavorthOnlyPublicHardening = {
  nativeContract: 'ZavorthOnlyPublicHardening/v1';
  docsApiDashboardLogsViewModelsZavorthNative: true;
  externalExecutorAllowedOnlyInInternalAuditDocs: true;
  publicExternalExecutorIdentityAllowed: false;
  publicExternalExecutorIdentityLeak: false;
  receiptsLogsViewModelsRedacted: true;
  provenanceInternalOnly: true;
  allowlistedInternalSurfaces: string[];
  rawSecretSerialized: false;
  rawContentLeak: false;
};

export type ZavorthOnlyInstallRuntimeVerification = {
  nativeContract: 'ZavorthOnlyInstallRuntimeVerification/v1';
  defaultRuntimeZavorthOwned: true;
  commandCenterDefaultZavorthOwned: true;
  nativeRegistryLookupDefault: true;
  messageSendControlledPathZavorthOwned: true;
  providerExecutionControlledPathZavorthOwned: true;
  toolCommandControlledPathZavorthOwned: true;
  adapterDefaultPathForAbsorbedDomains: false;
  externalExecutorNotRequiredForAbsorbedDomains: true;
  externalExecutorRequiredForInstallOfAbsorbedDomains: false;
  refreshFallbackExplicitOnly: true;
  adapterGlobalStillAvailableForExplicitRefreshFallback: true;
};

export type ZavorthOnlySecurityRedactionAudit = {
  nativeContract: 'ZavorthOnlySecurityRedactionAudit/v1';
  redactionScanRequired: true;
  secretRefsMetadataOnly: true;
  receiptsLogsRedacted: true;
  redactedOrDerivedContentOnly: true;
  rawSecretSerialized: false;
  rawContentLeak: false;
  publicSourceIdentityExposed: false;
  serializedOutputContainsSensitiveFixture: false;
};

export type ZavorthOnlyRegressionSuitePlan = {
  nativeContract: 'ZavorthOnlyRegressionSuitePlan/v1';
  focusedTest: 'tests/runtime/external-agents/ZavorthFinalZavorthOnlyAbsorptionHardeningReport.test.ts';
  representativeSuites: string[];
  runtimeCheck: 'npm run runtime:check --silent';
  aiGatewayControlPolicy: 'run-only-if-dashboard-control-touched';
  fullExternalAgentsSuitePolicy: 'optional-skipped-known-timeout-todo';
  fullExternalAgentsSuiteBlocking: false;
};

export type ZavorthOnlyFinalReport = {
  nativeContract: 'ZavorthOnlyFinalReport/v1';
  absorbedNative: string[];
  zavorthOwnedExecution: string[];
  refreshFallbackOnly: string[];
  optionalFutureAdapter: string[];
  blockedOrOutOfScope: string[];
  remainingRisks: string[];
  nextSteps: string[];
  defaultRuntimeZavorthOwned: true;
  adapterDefaultPathForAbsorbedDomains: false;
  externalExecutorNotRequiredForAbsorbedDomains: true;
  publicExternalExecutorIdentityLeak: false;
  rawSecretSerialized: false;
  rawContentLeak: false;
};

export type ZavorthFinalZavorthOnlyAbsorptionGate = {
  finalZavorthOnlyAbsorptionHardeningComplete: true;
  defaultRuntimeZavorthOwned: true;
  externalExecutorNotRequiredForAbsorbedDomains: true;
  publicExternalExecutorIdentityLeak: false;
  adapterDefaultPathForAbsorbedDomains: false;
  rawSecretSerialized: false;
  rawContentLeak: false;
  sourceModuleCopied: false;
};

export type ZavorthFinalZavorthOnlyAbsorptionSource = {
  finalAdapterDomainDecommission: Pick<
    ZavorthFinalAdapterDomainDecommissionNormalization,
    'decision' | 'decommissionReport' | 'executionGate'
  >;
  staticGuardFiles: ZavorthAdapterDecommissionStaticGuardFile[];
  dashboardControlTouched: false;
  defaultRuntimeExternalExecutorReintroduced: false;
  adapterDefaultPathReintroduced: false;
  publicExternalExecutorIdentityExposed: false;
  rawSecretSerialized: false;
  rawContentLeak: false;
  sourceModuleCopyAttempted: false;
  newExecutionAttempted: false;
  newStateMigrationAttempted: false;
  globalAdapterRemovalAttempted: false;
};

export type ZavorthFinalZavorthOnlyAbsorptionNormalization = {
  nativeContract: 'ZavorthFinalZavorthOnlyAbsorptionHardeningReport/v1';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_FINAL_ZAVORTH_ONLY_ABSORPTION_HARDENING_REPORT_RUNTIME_ID;
  decision: ZavorthFinalZavorthOnlyAbsorptionDecision;
  status: ZavorthFinalZavorthOnlyAbsorptionDecision;
  sourceReadiness: {
    finalAdapterDomainDecommission: ZavorthFinalAdapterDomainDecommissionNormalization['decision'];
    dashboardControlTouched: false;
  };
  finalAbsorptionMatrix: ZavorthFinalAbsorptionMatrixRow[];
  publicHardening: ZavorthOnlyPublicHardening;
  installRuntimeVerification: ZavorthOnlyInstallRuntimeVerification;
  securityRedactionAudit: ZavorthOnlySecurityRedactionAudit;
  staticGuard: ZavorthAdapterDecommissionStaticGuard;
  regressionSuitePlan: ZavorthOnlyRegressionSuitePlan;
  finalReport: ZavorthOnlyFinalReport;
  executionGate: ZavorthFinalZavorthOnlyAbsorptionGate;
  redaction: {
    rawSecretSerialized: false;
    rawContentLeak: false;
    publicSourceIdentityExposed: false;
    provenanceInternalOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
};

export type ZavorthFinalZavorthOnlyAbsorptionOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_FINAL_ZAVORTH_ONLY_ABSORPTION_HARDENING_REPORT_RUNTIME_ID;
  source: ZavorthFinalZavorthOnlyAbsorptionSource;
};

function matrixRow(
  row: Omit<
    ZavorthFinalAbsorptionMatrixRow,
    | 'adapterDefaultPathForDomain'
    | 'nativeContract'
    | 'publicExternalExecutorIdentityLeak'
    | 'rawContentLeak'
    | 'rawSecretSerialized'
    | 'sourceModuleCopied'
  >,
): ZavorthFinalAbsorptionMatrixRow {
  return {
    nativeContract: 'ZavorthFinalAbsorptionMatrixRow/v1',
    ...row,
    adapterDefaultPathForDomain: false,
    publicExternalExecutorIdentityLeak: false,
    rawSecretSerialized: false,
    rawContentLeak: false,
    sourceModuleCopied: false,
  };
}

function finalAbsorptionMatrix(): ZavorthFinalAbsorptionMatrixRow[] {
  return [
    matrixRow({
      domainId: 'capability-plugin-registry',
      label: 'Capability/plugin registry',
      classification: 'absorbed-native',
      evidenceDocs: ['docs/185-wave-3-first-native-capability-registry-replacement-slice.md', 'docs/200-wave-3-native-absorption-milestone-report.md', 'docs/243-wave-5-final-adapter-domain-decommission-pack.md'],
      absorbedDomain: true,
      zavorthOwnedExecution: false,
      refreshFallbackOnly: false,
      optionalFutureAdapter: false,
      blockedOrOutOfScope: false,
      defaultRuntime: 'zavorth-owned',
      externalExecutorNotRequiredForDomain: true,
    }),
    matrixRow({
      domainId: 'dashboard-command-center',
      label: 'Dashboard and Command Center',
      classification: 'absorbed-native',
      evidenceDocs: ['docs/192-wave-3-command-center-native-first-consumer-integration.md', 'docs/204-wave-3-native-absorption-public-surface-hardening-pack.md', 'docs/243-wave-5-final-adapter-domain-decommission-pack.md'],
      absorbedDomain: true,
      zavorthOwnedExecution: false,
      refreshFallbackOnly: false,
      optionalFutureAdapter: false,
      blockedOrOutOfScope: false,
      defaultRuntime: 'zavorth-owned',
      externalExecutorNotRequiredForDomain: true,
    }),
    matrixRow({
      domainId: 'channel-transport-message-send',
      label: 'Channel, transport, and controlled message send',
      classification: 'zavorth-owned-execution',
      evidenceDocs: ['docs/230-wave-4b3-message-send-dry-run-executables-milestone-report.md', 'docs/238-wave-4d-first-controlled-real-message-send.md', 'docs/240-wave-4d-message-send-expansion-and-audit-pack.md'],
      absorbedDomain: true,
      zavorthOwnedExecution: true,
      refreshFallbackOnly: false,
      optionalFutureAdapter: false,
      blockedOrOutOfScope: false,
      defaultRuntime: 'zavorth-owned',
      externalExecutorNotRequiredForDomain: true,
    }),
    matrixRow({
      domainId: 'provider-metadata-execution',
      label: 'Provider metadata and controlled execution',
      classification: 'zavorth-owned-execution',
      evidenceDocs: ['docs/187-wave-3-provider-channel-transport-native-registry.md', 'docs/241-wave-4e-provider-execution-absorption-pack.md', 'docs/243-wave-5-final-adapter-domain-decommission-pack.md'],
      absorbedDomain: true,
      zavorthOwnedExecution: true,
      refreshFallbackOnly: false,
      optionalFutureAdapter: false,
      blockedOrOutOfScope: false,
      defaultRuntime: 'zavorth-owned',
      externalExecutorNotRequiredForDomain: true,
    }),
    matrixRow({
      domainId: 'tool-command-execution',
      label: 'Tool/command execution',
      classification: 'zavorth-owned-execution',
      evidenceDocs: ['docs/143-wave-0-command-http-executable-runtime-matrix.md', 'docs/242-wave-4f-tool-command-execution-absorption-pack.md', 'docs/243-wave-5-final-adapter-domain-decommission-pack.md'],
      absorbedDomain: true,
      zavorthOwnedExecution: true,
      refreshFallbackOnly: false,
      optionalFutureAdapter: false,
      blockedOrOutOfScope: false,
      defaultRuntime: 'zavorth-owned',
      externalExecutorNotRequiredForDomain: true,
    }),
    matrixRow({
      domainId: 'session-history-metadata-content',
      label: 'Session/history metadata and redacted content',
      classification: 'absorbed-native',
      evidenceDocs: ['docs/218-wave-4c-controlled-session-history-migration-plan.md', 'docs/221-wave-4c-session-history-metadata-migration-milestone-report.md', 'docs/229-wave-4c2-redacted-session-content-migration-milestone-report.md'],
      absorbedDomain: true,
      zavorthOwnedExecution: false,
      refreshFallbackOnly: false,
      optionalFutureAdapter: false,
      blockedOrOutOfScope: false,
      defaultRuntime: 'zavorth-owned',
      externalExecutorNotRequiredForDomain: true,
    }),
    matrixRow({
      domainId: 'config-secretref-state',
      label: 'Config, SecretRef, and state metadata',
      classification: 'absorbed-native',
      evidenceDocs: ['docs/189-wave-3-config-secrets-state-native-registry.md', 'docs/209-wave-4a-controlled-metadata-config-registry-migration-plan.md', 'docs/212-wave-4a-controlled-metadata-migration-milestone-report.md'],
      absorbedDomain: true,
      zavorthOwnedExecution: false,
      refreshFallbackOnly: false,
      optionalFutureAdapter: false,
      blockedOrOutOfScope: false,
      defaultRuntime: 'zavorth-owned',
      externalExecutorNotRequiredForDomain: true,
    }),
    matrixRow({
      domainId: 'refresh-reconciliation',
      label: 'Refresh/reconciliation',
      classification: 'refresh-fallback-only',
      evidenceDocs: ['docs/193-wave-3-native-registry-refresh-reconciliation-design.md', 'docs/202-wave-3-native-refresh-commit-pack.md', 'docs/243-wave-5-final-adapter-domain-decommission-pack.md'],
      absorbedDomain: false,
      zavorthOwnedExecution: false,
      refreshFallbackOnly: true,
      optionalFutureAdapter: false,
      blockedOrOutOfScope: false,
      defaultRuntime: 'explicit-refresh-fallback',
      externalExecutorNotRequiredForDomain: true,
    }),
    matrixRow({
      domainId: 'optional-future-adapter',
      label: 'Optional future adapter/plugin',
      classification: 'optional-future-adapter',
      evidenceDocs: ['docs/243-wave-5-final-adapter-domain-decommission-pack.md'],
      absorbedDomain: false,
      zavorthOwnedExecution: false,
      refreshFallbackOnly: false,
      optionalFutureAdapter: true,
      blockedOrOutOfScope: false,
      defaultRuntime: 'optional-future-plugin',
      externalExecutorNotRequiredForDomain: true,
    }),
    matrixRow({
      domainId: 'blocked-explicitly-out-of-scope',
      label: 'Blocked and explicitly out-of-scope surfaces',
      classification: 'blocked-explicitly-out-of-scope',
      evidenceDocs: ['docs/217-wave-4b-low-risk-executable-capabilities-milestone-report.md', 'docs/221-wave-4c-session-history-metadata-migration-milestone-report.md', 'docs/241-wave-4e-provider-execution-absorption-pack.md', 'docs/242-wave-4f-tool-command-execution-absorption-pack.md'],
      absorbedDomain: false,
      zavorthOwnedExecution: false,
      refreshFallbackOnly: false,
      optionalFutureAdapter: false,
      blockedOrOutOfScope: true,
      defaultRuntime: 'blocked',
      externalExecutorNotRequiredForDomain: true,
    }),
  ];
}

function publicHardening(): ZavorthOnlyPublicHardening {
  return {
    nativeContract: 'ZavorthOnlyPublicHardening/v1',
    docsApiDashboardLogsViewModelsZavorthNative: true,
    externalExecutorAllowedOnlyInInternalAuditDocs: true,
    publicExternalExecutorIdentityAllowed: false,
    publicExternalExecutorIdentityLeak: false,
    receiptsLogsViewModelsRedacted: true,
    provenanceInternalOnly: true,
    allowlistedInternalSurfaces: [
      'internal-absorption-docs',
      'runtime/external-agents tests',
      'refresh-reconciliation-boundary',
      'redacted-provenance-metadata',
    ],
    rawSecretSerialized: false,
    rawContentLeak: false,
  };
}

function installRuntimeVerification(): ZavorthOnlyInstallRuntimeVerification {
  return {
    nativeContract: 'ZavorthOnlyInstallRuntimeVerification/v1',
    defaultRuntimeZavorthOwned: true,
    commandCenterDefaultZavorthOwned: true,
    nativeRegistryLookupDefault: true,
    messageSendControlledPathZavorthOwned: true,
    providerExecutionControlledPathZavorthOwned: true,
    toolCommandControlledPathZavorthOwned: true,
    adapterDefaultPathForAbsorbedDomains: false,
    externalExecutorNotRequiredForAbsorbedDomains: true,
    externalExecutorRequiredForInstallOfAbsorbedDomains: false,
    refreshFallbackExplicitOnly: true,
    adapterGlobalStillAvailableForExplicitRefreshFallback: true,
  };
}

function securityRedactionAudit(): ZavorthOnlySecurityRedactionAudit {
  return {
    nativeContract: 'ZavorthOnlySecurityRedactionAudit/v1',
    redactionScanRequired: true,
    secretRefsMetadataOnly: true,
    receiptsLogsRedacted: true,
    redactedOrDerivedContentOnly: true,
    rawSecretSerialized: false,
    rawContentLeak: false,
    publicSourceIdentityExposed: false,
    serializedOutputContainsSensitiveFixture: false,
  };
}

function regressionSuitePlan(): ZavorthOnlyRegressionSuitePlan {
  return {
    nativeContract: 'ZavorthOnlyRegressionSuitePlan/v1',
    focusedTest: 'tests/runtime/external-agents/ZavorthFinalZavorthOnlyAbsorptionHardeningReport.test.ts',
    representativeSuites: [
      'tests/runtime/external-agents/ZavorthFinalAdapterDomainDecommissionPack.test.ts',
      'tests/runtime/external-agents/ZavorthWave4DMessageSendExpansionAndAuditPack.test.ts',
      'tests/runtime/external-agents/ZavorthWave4EProviderExecutionAbsorptionPack.test.ts',
      'tests/runtime/external-agents/ZavorthWave4FToolCommandExecutionAbsorptionPack.test.ts',
      'tests/runtime/external-agents/ZavorthNativeAbsorptionRegressionReleaseHardeningPack.test.ts',
    ],
    runtimeCheck: 'npm run runtime:check --silent',
    aiGatewayControlPolicy: 'run-only-if-dashboard-control-touched',
    fullExternalAgentsSuitePolicy: 'optional-skipped-known-timeout-todo',
    fullExternalAgentsSuiteBlocking: false,
  };
}

function finalReport(matrix: ZavorthFinalAbsorptionMatrixRow[]): ZavorthOnlyFinalReport {
  return {
    nativeContract: 'ZavorthOnlyFinalReport/v1',
    absorbedNative: matrix
      .filter((row) => row.classification === 'absorbed-native')
      .map((row) => row.domainId),
    zavorthOwnedExecution: matrix
      .filter((row) => row.classification === 'zavorth-owned-execution')
      .map((row) => row.domainId),
    refreshFallbackOnly: matrix
      .filter((row) => row.classification === 'refresh-fallback-only')
      .map((row) => row.domainId),
    optionalFutureAdapter: matrix
      .filter((row) => row.classification === 'optional-future-adapter')
      .map((row) => row.domainId),
    blockedOrOutOfScope: [
      'unrestricted-production-message-send',
      'paid-provider-execution',
      'side-effect-provider-execution',
      'dangerous-tool-command-execution',
      'raw-history-sqlite-import',
      'raw-secret-migration',
      'raw-workspace-log-cache-import',
    ],
    remainingRisks: [
      'refresh parity replacement still needed before adapter can become purely optional',
      'unrestricted production send remains blocked pending separate operator policy',
      'paid/side-effect providers remain blocked pending cost and side-effect governance',
      'dangerous commands remain blocked pending sandbox and filesystem/network policy',
      'raw history and SQLite import remain intentionally out of scope',
    ],
    nextSteps: [
      'keep adapter as explicit refresh/fallback only',
      'consider optional-plugin packaging after refresh parity replacement',
      'continue representative regression and redaction scans before release',
      'keep high-impact production actions behind separate explicit operator gates',
    ],
    defaultRuntimeZavorthOwned: true,
    adapterDefaultPathForAbsorbedDomains: false,
    externalExecutorNotRequiredForAbsorbedDomains: true,
    publicExternalExecutorIdentityLeak: false,
    rawSecretSerialized: false,
    rawContentLeak: false,
  };
}

function executionGate(): ZavorthFinalZavorthOnlyAbsorptionGate {
  return {
    finalZavorthOnlyAbsorptionHardeningComplete: true,
    defaultRuntimeZavorthOwned: true,
    externalExecutorNotRequiredForAbsorbedDomains: true,
    publicExternalExecutorIdentityLeak: false,
    adapterDefaultPathForAbsorbedDomains: false,
    rawSecretSerialized: false,
    rawContentLeak: false,
    sourceModuleCopied: false,
  };
}

function sourceReady(source: ZavorthFinalZavorthOnlyAbsorptionSource): boolean {
  return (
    source.finalAdapterDomainDecommission.decision === 'final-adapter-domain-decommission-ready' &&
    !source.dashboardControlTouched &&
    !source.defaultRuntimeExternalExecutorReintroduced &&
    !source.adapterDefaultPathReintroduced &&
    !source.publicExternalExecutorIdentityExposed &&
    !source.rawSecretSerialized &&
    !source.rawContentLeak &&
    !source.sourceModuleCopyAttempted &&
    !source.newExecutionAttempted &&
    !source.newStateMigrationAttempted &&
    !source.globalAdapterRemovalAttempted
  );
}

export class ZavorthFinalZavorthOnlyAbsorptionHardeningReport {
  public constructor(public readonly normalization: ZavorthFinalZavorthOnlyAbsorptionNormalization) {}

  public domainsByClassification(
    classification: ZavorthFinalAbsorptionClassification,
  ): ZavorthFinalAbsorptionMatrixRow[] {
    return this.normalization.finalAbsorptionMatrix.filter((row) => row.classification === classification);
  }

  public absorbedOrOwnedDomains(): ZavorthFinalAbsorptionMatrixRow[] {
    return this.normalization.finalAbsorptionMatrix.filter((row) => row.absorbedDomain || row.zavorthOwnedExecution);
  }

  public defaultRuntimeIsZavorthOwned(): boolean {
    return this.absorbedOrOwnedDomains().every((row) => (
      row.defaultRuntime === 'zavorth-owned' &&
      !row.adapterDefaultPathForDomain &&
      row.externalExecutorNotRequiredForDomain
    ));
  }
}

export function createZavorthFinalZavorthOnlyAbsorptionSource(
  staticGuardFiles: ZavorthAdapterDecommissionStaticGuardFile[] = [],
): ZavorthFinalZavorthOnlyAbsorptionSource {
  const finalAdapterDomainDecommission = createZavorthFinalAdapterDomainDecommissionPackFixture(staticGuardFiles).normalization;

  return {
    finalAdapterDomainDecommission,
    staticGuardFiles,
    dashboardControlTouched: false,
    defaultRuntimeExternalExecutorReintroduced: false,
    adapterDefaultPathReintroduced: false,
    publicExternalExecutorIdentityExposed: false,
    rawSecretSerialized: false,
    rawContentLeak: false,
    sourceModuleCopyAttempted: false,
    newExecutionAttempted: false,
    newStateMigrationAttempted: false,
    globalAdapterRemovalAttempted: false,
  };
}

export function normalizeZavorthFinalZavorthOnlyAbsorptionHardeningReport(
  options: ZavorthFinalZavorthOnlyAbsorptionOptions,
): ZavorthFinalZavorthOnlyAbsorptionNormalization {
  const matrix = finalAbsorptionMatrix();
  const staticGuard = evaluateZavorthAdapterDecommissionStaticGuard(options.source.staticGuardFiles);
  const report = finalReport(matrix);
  const gate = executionGate();
  const publicHardeningReport = publicHardening();
  const installRuntime = installRuntimeVerification();
  const redactionAudit = securityRedactionAudit();
  const ready = sourceReady(options.source) &&
    staticGuard.passed &&
    matrix.length >= 10 &&
    matrix.filter((row) => row.absorbedDomain || row.zavorthOwnedExecution).length >= 7 &&
    matrix.some((row) => row.refreshFallbackOnly) &&
    matrix.some((row) => row.optionalFutureAdapter) &&
    matrix.some((row) => row.blockedOrOutOfScope) &&
    matrix.every((row) => !row.adapterDefaultPathForDomain && !row.publicExternalExecutorIdentityLeak && !row.rawSecretSerialized && !row.rawContentLeak && !row.sourceModuleCopied) &&
    report.defaultRuntimeZavorthOwned &&
    !report.adapterDefaultPathForAbsorbedDomains &&
    report.externalExecutorNotRequiredForAbsorbedDomains &&
    !publicHardeningReport.publicExternalExecutorIdentityLeak &&
    installRuntime.defaultRuntimeZavorthOwned &&
    !installRuntime.adapterDefaultPathForAbsorbedDomains &&
    redactionAudit.secretRefsMetadataOnly &&
    !redactionAudit.rawSecretSerialized &&
    !redactionAudit.rawContentLeak;

  return {
    nativeContract: 'ZavorthFinalZavorthOnlyAbsorptionHardeningReport/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'final-zavorth-only-absorption-hardened' : 'blocked',
    status: ready ? 'final-zavorth-only-absorption-hardened' : 'blocked',
    sourceReadiness: {
      finalAdapterDomainDecommission: options.source.finalAdapterDomainDecommission.decision,
      dashboardControlTouched: options.source.dashboardControlTouched,
    },
    finalAbsorptionMatrix: matrix,
    publicHardening: publicHardeningReport,
    installRuntimeVerification: installRuntime,
    securityRedactionAudit: redactionAudit,
    staticGuard,
    regressionSuitePlan: regressionSuitePlan(),
    finalReport: report,
    executionGate: gate,
    redaction: {
      rawSecretSerialized: false,
      rawContentLeak: false,
      publicSourceIdentityExposed: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    },
  };
}

export function createZavorthFinalZavorthOnlyAbsorptionHardeningReportFixture(
  staticGuardFiles: ZavorthAdapterDecommissionStaticGuardFile[] = [],
): ZavorthFinalZavorthOnlyAbsorptionHardeningReport {
  return new ZavorthFinalZavorthOnlyAbsorptionHardeningReport(
    normalizeZavorthFinalZavorthOnlyAbsorptionHardeningReport({
      generatedAt: ZAVORTH_FINAL_ZAVORTH_ONLY_ABSORPTION_HARDENING_REPORT_NOW,
      runtimeId: ZAVORTH_FINAL_ZAVORTH_ONLY_ABSORPTION_HARDENING_REPORT_RUNTIME_ID,
      source: createZavorthFinalZavorthOnlyAbsorptionSource(staticGuardFiles),
    }),
  );
}
