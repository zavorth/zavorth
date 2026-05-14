import {
  createZavorthFinalAdapterDomainDecommissionPackFixture,
} from './ZavorthFinalAdapterDomainDecommissionPack.js';
import type {
  ZavorthFinalAdapterDomainDecommissionNormalization,
  ZavorthFinalAdapterDomainId,
  ZavorthFinalAdapterDomainInventoryRow,
} from './ZavorthFinalAdapterDomainDecommissionPack.js';

export const ZAVORTH_FALLBACK_ADAPTER_DOMAIN_RETIREMENT_PACK_NOW = '2026-05-01T19:00:00.000Z' as const;
export const ZAVORTH_FALLBACK_ADAPTER_DOMAIN_RETIREMENT_PACK_RUNTIME_ID = 'zavorth-fallback-adapter-domain-retirement-pack' as const;

export type ZavorthFallbackAdapterDomainRetirementDecision =
  | 'blocked'
  | 'fallback-adapter-domain-retirement-ready'
  | 'no-safe-domain-retirement-target';

export type ZavorthFallbackAdapterDomainRetirementClassification =
  | 'blocked'
  | 'can-retire-next'
  | 'keep-fallback-only'
  | 'keep-refresh-only';

export type ZavorthFallbackAdapterDomainRetirementDomainId =
  | ZavorthFinalAdapterDomainId
  | 'optional-future-adapter'
  | 'raw-history-sqlite-import'
  | 'unrestricted-production-send';

export type ZavorthFallbackAdapterDomainRetirementAllowlistRole =
  | 'degraded-fallback-explicit'
  | 'live-probe-read-only'
  | 'optional-plugin-future'
  | 'reconciliation-source'
  | 'refresh-source';

export type ZavorthFallbackAdapterDomainRetirementMatrixRow = {
  nativeContract: 'ZavorthFallbackAdapterDomainRetirementMatrixRow/v1';
  domainId: ZavorthFallbackAdapterDomainRetirementDomainId;
  label: string;
  classification: ZavorthFallbackAdapterDomainRetirementClassification;
  selectedForRetirement: boolean;
  touchedByPack: boolean;
  fallbackAdapterRetired: boolean;
  fallbackAdapterPreserved: boolean;
  refreshAdapterPreserved: boolean;
  blockedDomainPreserved: boolean;
  adapterGlobalStillAvailable: true;
  adapterRemovalGlobalAllowed: false;
  runtimeExternalExecutorRequiredForDomain: false;
  publicExternalExecutorIdentityLeak: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  toolCommandActuallyExecuted: false;
  rawMigrationPerformed: false;
  rawSecretSerialized: false;
  evidenceDocs: string[];
};

export type ZavorthFallbackAdapterDomainRetirementImplementationRow = {
  nativeContract: 'ZavorthFallbackAdapterDomainRetirementImplementationRow/v1';
  domainId: ZavorthFallbackAdapterDomainRetirementDomainId;
  classification: ZavorthFallbackAdapterDomainRetirementClassification;
  implementationAction:
    | 'blocked-domain-preserved'
    | 'fallback-adapter-retired'
    | 'fallback-only-preserved'
    | 'refresh-only-preserved';
  onlyCanRetireNextDomainTouched: boolean;
  retiredDomainsNoAdapterFallback: boolean;
  keepRefreshOrFallbackPreserved: boolean;
  blockedDomainPreserved: boolean;
  actualFileDeleted: false;
  adapterGlobalStillAvailable: true;
  adapterRemovalGlobalAllowed: false;
  runtimeExternalExecutorRequiredForRetiredDomain: false;
  publicSurfaceZavorthNative: true;
  rawSecretSerialized: false;
};

export type ZavorthFallbackAdapterDomainRetirementStaticGuardFile = {
  path: string;
  content: string;
  domainId: ZavorthFallbackAdapterDomainRetirementDomainId;
  allowlistRole?: ZavorthFallbackAdapterDomainRetirementAllowlistRole;
};

export type ZavorthFallbackAdapterDomainRetirementStaticGuardFinding = {
  nativeContract: 'ZavorthFallbackAdapterDomainRetirementStaticGuardFinding/v1';
  path: string;
  domainId: ZavorthFallbackAdapterDomainRetirementDomainId;
  pattern: string;
  reason: string;
  retiredDomainFallbackRegression: true;
};

export type ZavorthFallbackAdapterDomainRetirementStaticGuard = {
  nativeContract: 'ZavorthFallbackAdapterDomainRetirementStaticGuard/v1';
  checkedPaths: string[];
  retiredDomainIds: ZavorthFallbackAdapterDomainRetirementDomainId[];
  allowlistedPaths: Array<{
    path: string;
    domainId: ZavorthFallbackAdapterDomainRetirementDomainId;
    role: ZavorthFallbackAdapterDomainRetirementAllowlistRole;
  }>;
  findings: ZavorthFallbackAdapterDomainRetirementStaticGuardFinding[];
  passed: boolean;
  fallbackAdapterRegressionDetected: boolean;
  allowlistExplicit: true;
  rawSecretSerialized: false;
};

export type ZavorthFallbackAdapterDomainRetirementReport = {
  nativeContract: 'ZavorthFallbackAdapterDomainRetirementReport/v1';
  retiredDomains: ZavorthFallbackAdapterDomainRetirementDomainId[];
  keepFallbackOnlyDomains: ZavorthFallbackAdapterDomainRetirementDomainId[];
  keepRefreshOnlyDomains: ZavorthFallbackAdapterDomainRetirementDomainId[];
  blockedDomains: ZavorthFallbackAdapterDomainRetirementDomainId[];
  noSafeDomainRetirementTarget: boolean;
  recommendation:
    | 'fallback-retirement-complete-for-can-retire-next-domains'
    | 'no-safe-domain-retirement-target';
  adapterGlobalStillAvailable: true;
  adapterRemovalGlobalAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthFallbackAdapterDomainRetirementExecutionGate = {
  fallbackAdapterDomainRetirementPackCreated: true;
  onlyCanRetireNextDomainsTouched: true;
  adapterGlobalStillAvailable: true;
  adapterRemovalGlobalAllowed: false;
  retiredDomainsNoAdapterFallback: true;
  blockedDomainsPreserved: true;
  runtimeExternalExecutorRequiredForRetiredDomains: false;
  publicExternalExecutorIdentityLeak: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  toolCommandActuallyExecuted: false;
  rawMigrationPerformed: false;
  rawSecretSerialized: false;
};

export type ZavorthFallbackAdapterDomainRetirementSource = {
  finalAdapterDomainDecommission: Pick<
    ZavorthFinalAdapterDomainDecommissionNormalization,
    'decision' | 'domainInventory'
  >;
  staticGuardFiles: ZavorthFallbackAdapterDomainRetirementStaticGuardFile[];
  retirementCandidateOverride?: ZavorthFallbackAdapterDomainRetirementDomainId[];
  adapterGlobalAvailable: true;
  adapterRemovalAttempted: false;
  touchedNonCanRetireNextDomain: false;
  keepRefreshOrFallbackDomainTouched: false;
  blockedDomainTouched: false;
  externalExecutorLiveCalledForDefaultPath: false;
  messageSendAttempted: false;
  providerExecutionAttempted: false;
  toolCommandExecutionAttempted: false;
  rawMigrationAttempted: false;
  sourceModuleCopyAttempted: false;
  publicExternalExecutorIdentityExposed: false;
  rawSecretSerialized: false;
};

export type ZavorthFallbackAdapterDomainRetirementNormalization = {
  nativeContract: 'ZavorthFallbackAdapterDomainRetirementPack/v1';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_FALLBACK_ADAPTER_DOMAIN_RETIREMENT_PACK_RUNTIME_ID;
  decision: ZavorthFallbackAdapterDomainRetirementDecision;
  status: ZavorthFallbackAdapterDomainRetirementDecision;
  sourceReadiness: {
    finalAdapterDomainDecommission: ZavorthFinalAdapterDomainDecommissionNormalization['decision'];
  };
  retirementMatrix: ZavorthFallbackAdapterDomainRetirementMatrixRow[];
  implementationRows: ZavorthFallbackAdapterDomainRetirementImplementationRow[];
  staticGuard: ZavorthFallbackAdapterDomainRetirementStaticGuard;
  retirementReport: ZavorthFallbackAdapterDomainRetirementReport;
  executionGate: ZavorthFallbackAdapterDomainRetirementExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    rawContentSerialized: false;
    publicSourceIdentityExposed: false;
    provenanceInternalOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'post-absorption-final-optional-adapter-plugin-or-release-maintenance';
};

export type ZavorthFallbackAdapterDomainRetirementOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_FALLBACK_ADAPTER_DOMAIN_RETIREMENT_PACK_RUNTIME_ID;
  source: ZavorthFallbackAdapterDomainRetirementSource;
};

const PSEUDO_BLOCKED_DOMAINS: Array<Pick<
  ZavorthFallbackAdapterDomainRetirementMatrixRow,
  'domainId' | 'evidenceDocs' | 'label'
>> = [
  {
    domainId: 'unrestricted-production-send',
    label: 'Unrestricted production send',
    evidenceDocs: ['docs/240-wave-4d-message-send-expansion-and-audit-pack.md', 'docs/251-post-absorption-parallel-hardening-pack.md'],
  },
  {
    domainId: 'raw-history-sqlite-import',
    label: 'Raw history/SQLite import',
    evidenceDocs: ['docs/247-post-absorption-raw-history-sqlite-import-decision.md', 'docs/251-post-absorption-parallel-hardening-pack.md'],
  },
  {
    domainId: 'optional-future-adapter',
    label: 'Optional future adapter',
    evidenceDocs: ['docs/243-wave-5-final-adapter-domain-decommission-pack.md', 'docs/251-post-absorption-parallel-hardening-pack.md'],
  },
];

const FORBIDDEN_RETIRED_FALLBACK_PATTERNS: Array<{
  label: string;
  pattern: RegExp;
  reason: string;
}> = [
  {
    label: 'FixtureExternalAgentAdapter fallback reference',
    pattern: /\bFixtureExternalAgentAdapter\b/,
    reason: 'Retired domains cannot reintroduce the fixture/global adapter as a fallback.',
  },
  {
    label: 'fallback adapter enabled',
    pattern: /\bfallbackAdapter(?:Allowed|Enabled|Available)?\s*[:=]\s*true\b/i,
    reason: 'Retired domains must not enable fallback adapter use.',
  },
  {
    label: 'degraded fallback role on retired domain',
    pattern: /\bdegraded-fallback-explicit\b/i,
    reason: 'The degraded fallback role is preserved only for domains explicitly classified keep-fallback-only.',
  },
  {
    label: 'adapter fallback role on retired domain',
    pattern: /\badapter-fallback-only\b/i,
    reason: 'Retired domains must remain Zavorth-owned without adapter fallback.',
  },
];

function classificationFor(
  row: ZavorthFinalAdapterDomainInventoryRow,
): ZavorthFallbackAdapterDomainRetirementClassification {
  if (row.classification === 'adapter-default-removed') {
    return 'can-retire-next';
  }
  if (row.classification === 'adapter-fallback-only') {
    return 'keep-fallback-only';
  }
  if (row.classification === 'refresh-only') {
    return 'keep-refresh-only';
  }
  return 'blocked';
}

function matrixRow(
  row: Omit<
    ZavorthFallbackAdapterDomainRetirementMatrixRow,
    | 'adapterGlobalStillAvailable'
    | 'adapterRemovalGlobalAllowed'
    | 'messageActuallySent'
    | 'providerActuallyExecuted'
    | 'publicExternalExecutorIdentityLeak'
    | 'rawMigrationPerformed'
    | 'rawSecretSerialized'
    | 'runtimeExternalExecutorRequiredForDomain'
    | 'toolCommandActuallyExecuted'
    | 'nativeContract'
  >,
): ZavorthFallbackAdapterDomainRetirementMatrixRow {
  return {
    nativeContract: 'ZavorthFallbackAdapterDomainRetirementMatrixRow/v1',
    ...row,
    adapterGlobalStillAvailable: true,
    adapterRemovalGlobalAllowed: false,
    runtimeExternalExecutorRequiredForDomain: false,
    publicExternalExecutorIdentityLeak: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    toolCommandActuallyExecuted: false,
    rawMigrationPerformed: false,
    rawSecretSerialized: false,
  };
}

function buildRetirementMatrix(
  source: ZavorthFallbackAdapterDomainRetirementSource,
): ZavorthFallbackAdapterDomainRetirementMatrixRow[] {
  const candidateOverride = source.retirementCandidateOverride;
  const rows = source.finalAdapterDomainDecommission.domainInventory.map((domainRow) => {
    const classification = classificationFor(domainRow);
    const selectedForRetirement = classification === 'can-retire-next' &&
      (candidateOverride === undefined || candidateOverride.includes(domainRow.domainId));

    return matrixRow({
      domainId: domainRow.domainId,
      label: domainRow.label,
      classification,
      selectedForRetirement,
      touchedByPack: selectedForRetirement,
      fallbackAdapterRetired: selectedForRetirement,
      fallbackAdapterPreserved: classification === 'keep-fallback-only',
      refreshAdapterPreserved: classification === 'keep-refresh-only',
      blockedDomainPreserved: classification === 'blocked',
      evidenceDocs: [...domainRow.evidenceDocs, 'docs/251-post-absorption-parallel-hardening-pack.md'],
    });
  });

  return [
    ...rows,
    ...PSEUDO_BLOCKED_DOMAINS.map((blocked) => matrixRow({
      ...blocked,
      classification: 'blocked',
      selectedForRetirement: false,
      touchedByPack: false,
      fallbackAdapterRetired: false,
      fallbackAdapterPreserved: false,
      refreshAdapterPreserved: false,
      blockedDomainPreserved: true,
    })),
  ];
}

function implementationActionFor(
  row: ZavorthFallbackAdapterDomainRetirementMatrixRow,
): ZavorthFallbackAdapterDomainRetirementImplementationRow['implementationAction'] {
  if (row.classification === 'can-retire-next') {
    return row.selectedForRetirement ? 'fallback-adapter-retired' : 'blocked-domain-preserved';
  }
  if (row.classification === 'keep-fallback-only') {
    return 'fallback-only-preserved';
  }
  if (row.classification === 'keep-refresh-only') {
    return 'refresh-only-preserved';
  }
  return 'blocked-domain-preserved';
}

function implementationRows(
  matrix: ZavorthFallbackAdapterDomainRetirementMatrixRow[],
): ZavorthFallbackAdapterDomainRetirementImplementationRow[] {
  return matrix.map((row) => ({
    nativeContract: 'ZavorthFallbackAdapterDomainRetirementImplementationRow/v1',
    domainId: row.domainId,
    classification: row.classification,
    implementationAction: implementationActionFor(row),
    onlyCanRetireNextDomainTouched: !row.touchedByPack || row.classification === 'can-retire-next',
    retiredDomainsNoAdapterFallback: !row.selectedForRetirement || row.fallbackAdapterRetired,
    keepRefreshOrFallbackPreserved: row.classification === 'keep-fallback-only'
      ? row.fallbackAdapterPreserved
      : row.classification === 'keep-refresh-only'
        ? row.refreshAdapterPreserved
        : true,
    blockedDomainPreserved: row.classification !== 'blocked' || row.blockedDomainPreserved,
    actualFileDeleted: false,
    adapterGlobalStillAvailable: true,
    adapterRemovalGlobalAllowed: false,
    runtimeExternalExecutorRequiredForRetiredDomain: false,
    publicSurfaceZavorthNative: true,
    rawSecretSerialized: false,
  }));
}

export function evaluateZavorthFallbackAdapterDomainRetirementStaticGuard(
  files: ZavorthFallbackAdapterDomainRetirementStaticGuardFile[],
  retiredDomainIds: ZavorthFallbackAdapterDomainRetirementDomainId[],
): ZavorthFallbackAdapterDomainRetirementStaticGuard {
  const retiredSet = new Set(retiredDomainIds);
  const findings = files.flatMap((file): ZavorthFallbackAdapterDomainRetirementStaticGuardFinding[] => {
    if (!retiredSet.has(file.domainId)) {
      return [];
    }

    return FORBIDDEN_RETIRED_FALLBACK_PATTERNS
      .filter(({ pattern }) => pattern.test(file.content))
      .map(({ label, reason }) => ({
        nativeContract: 'ZavorthFallbackAdapterDomainRetirementStaticGuardFinding/v1',
        path: file.path,
        domainId: file.domainId,
        pattern: label,
        reason,
        retiredDomainFallbackRegression: true,
      }));
  });

  return {
    nativeContract: 'ZavorthFallbackAdapterDomainRetirementStaticGuard/v1',
    checkedPaths: files.map((file) => file.path),
    retiredDomainIds,
    allowlistedPaths: files
      .filter((file): file is ZavorthFallbackAdapterDomainRetirementStaticGuardFile & {
        allowlistRole: ZavorthFallbackAdapterDomainRetirementAllowlistRole;
      } => Boolean(file.allowlistRole))
      .map((file) => ({
        path: file.path,
        domainId: file.domainId,
        role: file.allowlistRole,
      })),
    findings,
    passed: findings.length === 0,
    fallbackAdapterRegressionDetected: findings.length > 0,
    allowlistExplicit: true,
    rawSecretSerialized: false,
  };
}

function report(
  matrix: ZavorthFallbackAdapterDomainRetirementMatrixRow[],
): ZavorthFallbackAdapterDomainRetirementReport {
  const retiredDomains = matrix
    .filter((row) => row.selectedForRetirement)
    .map((row) => row.domainId);

  return {
    nativeContract: 'ZavorthFallbackAdapterDomainRetirementReport/v1',
    retiredDomains,
    keepFallbackOnlyDomains: matrix
      .filter((row) => row.classification === 'keep-fallback-only')
      .map((row) => row.domainId),
    keepRefreshOnlyDomains: matrix
      .filter((row) => row.classification === 'keep-refresh-only')
      .map((row) => row.domainId),
    blockedDomains: matrix
      .filter((row) => row.classification === 'blocked')
      .map((row) => row.domainId),
    noSafeDomainRetirementTarget: retiredDomains.length === 0,
    recommendation: retiredDomains.length > 0
      ? 'fallback-retirement-complete-for-can-retire-next-domains'
      : 'no-safe-domain-retirement-target',
    adapterGlobalStillAvailable: true,
    adapterRemovalGlobalAllowed: false,
    rawSecretSerialized: false,
  };
}

function executionGate(): ZavorthFallbackAdapterDomainRetirementExecutionGate {
  return {
    fallbackAdapterDomainRetirementPackCreated: true,
    onlyCanRetireNextDomainsTouched: true,
    adapterGlobalStillAvailable: true,
    adapterRemovalGlobalAllowed: false,
    retiredDomainsNoAdapterFallback: true,
    blockedDomainsPreserved: true,
    runtimeExternalExecutorRequiredForRetiredDomains: false,
    publicExternalExecutorIdentityLeak: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    toolCommandActuallyExecuted: false,
    rawMigrationPerformed: false,
    rawSecretSerialized: false,
  };
}

function sourceReady(source: ZavorthFallbackAdapterDomainRetirementSource): boolean {
  return (
    source.finalAdapterDomainDecommission.decision === 'final-adapter-domain-decommission-ready' &&
    source.adapterGlobalAvailable &&
    !source.adapterRemovalAttempted &&
    !source.touchedNonCanRetireNextDomain &&
    !source.keepRefreshOrFallbackDomainTouched &&
    !source.blockedDomainTouched &&
    !source.externalExecutorLiveCalledForDefaultPath &&
    !source.messageSendAttempted &&
    !source.providerExecutionAttempted &&
    !source.toolCommandExecutionAttempted &&
    !source.rawMigrationAttempted &&
    !source.sourceModuleCopyAttempted &&
    !source.publicExternalExecutorIdentityExposed &&
    !source.rawSecretSerialized
  );
}

export class ZavorthFallbackAdapterDomainRetirementPack {
  public constructor(public readonly normalization: ZavorthFallbackAdapterDomainRetirementNormalization) {}

  public retiredDomains(): ZavorthFallbackAdapterDomainRetirementMatrixRow[] {
    return this.normalization.retirementMatrix.filter((row) => row.selectedForRetirement);
  }

  public preservedDomains(): ZavorthFallbackAdapterDomainRetirementMatrixRow[] {
    return this.normalization.retirementMatrix.filter((row) => !row.touchedByPack);
  }

  public domain(
    domainId: ZavorthFallbackAdapterDomainRetirementDomainId,
  ): ZavorthFallbackAdapterDomainRetirementMatrixRow | undefined {
    return this.normalization.retirementMatrix.find((row) => row.domainId === domainId);
  }

  public onlyCanRetireNextDomainsTouched(): boolean {
    return this.normalization.implementationRows.every((row) => row.onlyCanRetireNextDomainTouched);
  }
}

export function createZavorthFallbackAdapterDomainRetirementSource(
  staticGuardFiles: ZavorthFallbackAdapterDomainRetirementStaticGuardFile[] = [],
  retirementCandidateOverride?: ZavorthFallbackAdapterDomainRetirementDomainId[],
): ZavorthFallbackAdapterDomainRetirementSource {
  const finalDecommission = createZavorthFinalAdapterDomainDecommissionPackFixture();

  return {
    finalAdapterDomainDecommission: finalDecommission.normalization,
    staticGuardFiles,
    retirementCandidateOverride,
    adapterGlobalAvailable: true,
    adapterRemovalAttempted: false,
    touchedNonCanRetireNextDomain: false,
    keepRefreshOrFallbackDomainTouched: false,
    blockedDomainTouched: false,
    externalExecutorLiveCalledForDefaultPath: false,
    messageSendAttempted: false,
    providerExecutionAttempted: false,
    toolCommandExecutionAttempted: false,
    rawMigrationAttempted: false,
    sourceModuleCopyAttempted: false,
    publicExternalExecutorIdentityExposed: false,
    rawSecretSerialized: false,
  };
}

export function normalizeZavorthFallbackAdapterDomainRetirementPack(
  options: ZavorthFallbackAdapterDomainRetirementOptions,
): ZavorthFallbackAdapterDomainRetirementNormalization {
  const matrix = buildRetirementMatrix(options.source);
  const rows = implementationRows(matrix);
  const retirementReport = report(matrix);
  const retiredDomainIds = retirementReport.retiredDomains;
  const staticGuard = evaluateZavorthFallbackAdapterDomainRetirementStaticGuard(
    options.source.staticGuardFiles,
    retiredDomainIds,
  );
  const safe = sourceReady(options.source) &&
    staticGuard.passed &&
    rows.every((row) => (
      row.onlyCanRetireNextDomainTouched &&
      row.retiredDomainsNoAdapterFallback &&
      row.keepRefreshOrFallbackPreserved &&
      row.blockedDomainPreserved &&
      !row.adapterRemovalGlobalAllowed &&
      !row.rawSecretSerialized
    )) &&
    matrix
      .filter((row) => row.touchedByPack)
      .every((row) => row.classification === 'can-retire-next' && row.fallbackAdapterRetired) &&
    matrix
      .filter((row) => row.classification === 'keep-fallback-only' || row.classification === 'keep-refresh-only')
      .every((row) => !row.touchedByPack && (row.fallbackAdapterPreserved || row.refreshAdapterPreserved)) &&
    matrix
      .filter((row) => row.classification === 'blocked')
      .every((row) => !row.touchedByPack && row.blockedDomainPreserved);
  const decision: ZavorthFallbackAdapterDomainRetirementDecision = safe
    ? retirementReport.noSafeDomainRetirementTarget
      ? 'no-safe-domain-retirement-target'
      : 'fallback-adapter-domain-retirement-ready'
    : 'blocked';

  return {
    nativeContract: 'ZavorthFallbackAdapterDomainRetirementPack/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision,
    status: decision,
    sourceReadiness: {
      finalAdapterDomainDecommission: options.source.finalAdapterDomainDecommission.decision,
    },
    retirementMatrix: matrix,
    implementationRows: rows,
    staticGuard,
    retirementReport,
    executionGate: executionGate(),
    redaction: {
      rawSecretSerialized: false,
      rawContentSerialized: false,
      publicSourceIdentityExposed: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'post-absorption-final-optional-adapter-plugin-or-release-maintenance',
  };
}

export function createZavorthFallbackAdapterDomainRetirementPackFixture(
  staticGuardFiles: ZavorthFallbackAdapterDomainRetirementStaticGuardFile[] = [],
  retirementCandidateOverride?: ZavorthFallbackAdapterDomainRetirementDomainId[],
): ZavorthFallbackAdapterDomainRetirementPack {
  return new ZavorthFallbackAdapterDomainRetirementPack(
    normalizeZavorthFallbackAdapterDomainRetirementPack({
      generatedAt: ZAVORTH_FALLBACK_ADAPTER_DOMAIN_RETIREMENT_PACK_NOW,
      runtimeId: ZAVORTH_FALLBACK_ADAPTER_DOMAIN_RETIREMENT_PACK_RUNTIME_ID,
      source: createZavorthFallbackAdapterDomainRetirementSource(
        staticGuardFiles,
        retirementCandidateOverride,
      ),
    }),
  );
}
