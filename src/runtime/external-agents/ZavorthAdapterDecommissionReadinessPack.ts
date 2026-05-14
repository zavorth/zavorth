import type {
  ZavorthNativeAbsorptionConsolidationNormalization,
} from './ZavorthNativeAbsorptionConsolidationPack.js';
import type {
  ZavorthNativeRefreshCommitReceipt,
} from './ZavorthNativeRefreshCommitPack.js';
import type {
  ZavorthNativeRegistryConsumerExpansionNormalization,
} from './ZavorthNativeRegistryConsumerExpansionPack.js';
import type {
  ZavorthPartialAdapterDeprecationNormalization,
} from './ZavorthPartialAdapterDeprecationGate.js';
import type {
  ZavorthPartialAdapterRemovalImplementationNormalization,
} from './ZavorthPartialAdapterRemovalImplementationPack.js';

export const ZAVORTH_ADAPTER_DECOMMISSION_READINESS_PACK_NOW = '2026-04-29T13:00:00.000Z' as const;
export const ZAVORTH_ADAPTER_DECOMMISSION_READINESS_PACK_RUNTIME_ID = 'zavorth-adapter-decommission-readiness-pack' as const;

export type ZavorthAdapterDecommissionReadinessDecision =
  | 'adapter-decommission-readiness-ready'
  | 'blocked';

export type ZavorthAdapterUsageClassification =
  | 'adapter-required'
  | 'fallback-explicit'
  | 'legacy-default-usage-violation'
  | 'refresh-reconciliation-allowed'
  | 'safe-removal-candidate';

export type ZavorthAdapterDecommissionDisposition =
  | 'blocked'
  | 'can-remove-now'
  | 'isolate-behind-refresh-boundary'
  | 'keep-required'
  | 'unknown-needs-audit';

export type ZavorthAdapterUsageKind =
  | 'action-mutation-boundary'
  | 'fallback-boundary'
  | 'fixture-adapter'
  | 'live-probe-boundary'
  | 'native-ready-consumer'
  | 'read-only-bridge-boundary'
  | 'refresh-reconciliation-boundary';

export type ZavorthAdapterAllowlistRole =
  | 'adapter-contract-fixture'
  | 'degraded-fallback-explicit'
  | 'live-probe-read-only'
  | 'reconciliation-source'
  | 'refresh-source';

export type ZavorthAdapterUsageInventoryRow = {
  nativeContract: 'ZavorthAdapterUsageInventoryRow/v1';
  usageId: string;
  label: string;
  path: string;
  usageKind: ZavorthAdapterUsageKind;
  classification: ZavorthAdapterUsageClassification;
  decommissionDisposition: ZavorthAdapterDecommissionDisposition;
  nativeReadySurface: boolean;
  explicitAllowlist: boolean;
  allowlistRoles: ZavorthAdapterAllowlistRole[];
  safeRemovalCandidate: boolean;
  removalBlockedReason?: string;
  defaultAdapterPath: false;
  adapterCalledForDefaultPath: false;
  externalExecutorLiveCalledForDefaultPath: false;
  adapterRefreshAllowed: boolean;
  adapterRemovalGlobalAllowed: false;
  runtimeExternalExecutorRequiredForNativeReadyConsumers: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  externalMutationActuallyPerformed: false;
  stateMigrated: false;
  sourceModuleCopied: false;
  rawSecretSerialized: false;
};

export type ZavorthAdapterDecommissionMatrixRow = {
  nativeContract: 'ZavorthAdapterDecommissionMatrixRow/v1';
  disposition: ZavorthAdapterDecommissionDisposition;
  usageIds: string[];
  action: string;
  removalAuthorizedNow: false;
  requiresFutureGate: boolean;
  rawSecretSerialized: false;
};

export type ZavorthAdapterDecommissionStaticGuardFile = {
  path: string;
  content: string;
  defaultConsumer: boolean;
  allowlistRole?: ZavorthAdapterAllowlistRole;
};

export type ZavorthAdapterDecommissionStaticGuardFinding = {
  nativeContract: 'ZavorthAdapterDecommissionStaticGuardFinding/v1';
  path: string;
  pattern: string;
  reason: string;
  defaultPathRegression: true;
};

export type ZavorthAdapterDecommissionStaticGuard = {
  nativeContract: 'ZavorthAdapterDecommissionStaticGuard/v1';
  checkedPaths: string[];
  allowlistedPaths: Array<{
    path: string;
    role: ZavorthAdapterAllowlistRole;
  }>;
  findings: ZavorthAdapterDecommissionStaticGuardFinding[];
  passed: boolean;
  defaultAdapterUsageViolationsDetected: boolean;
  allowlistExplicit: true;
  rawSecretSerialized: false;
};

export type ZavorthAdapterDecommissionRemovalPlanStep = {
  nativeContract: 'ZavorthAdapterDecommissionRemovalPlanStep/v1';
  order: number;
  label: string;
  scope: string;
  currentPackAction: 'plan-only';
  removalAuthorizedNow: false;
  requiredFutureGate: string;
};

export type ZavorthAdapterDecommissionRiskReport = {
  nativeContract: 'ZavorthAdapterDecommissionRiskReport/v1';
  refreshStillNeedsExternalSource: true;
  actionDispatchStillBlocked: true;
  messageSendStillBlocked: true;
  providerExecutionStillBlocked: true;
  commandToolExecutionStillBlocked: true;
  migrationImportStillBlocked: true;
  liveProbeBoundaryStillRequired: true;
  globalAdapterRemovalRisk: 'blocked-until-full-parity-and-replacement';
  rawSecretSerialized: false;
};

export type ZavorthAdapterDecommissionReadinessExecutionGate = {
  adapterDecommissionReadinessPackCreated: true;
  adapterUsageInventoryComplete: true;
  defaultAdapterUsageViolationsDetected: boolean;
  safeRemovalCandidatesListed: true;
  adapterRemovalGlobalAllowed: false;
  runtimeExternalExecutorRequiredForNativeReadyConsumers: false;
  adapterRefreshAllowed: true;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  externalMutationActuallyPerformed: false;
  stateMigrated: false;
  sourceModuleCopied: false;
  rawSecretSerialized: false;
};

export type ZavorthAdapterDecommissionReadinessSource = {
  partialAdapterDeprecation: Pick<ZavorthPartialAdapterDeprecationNormalization, 'decision'>;
  partialAdapterRemoval: Pick<ZavorthPartialAdapterRemovalImplementationNormalization, 'decision'>;
  consolidation: Pick<ZavorthNativeAbsorptionConsolidationNormalization, 'decision'>;
  refreshCommit: Pick<ZavorthNativeRefreshCommitReceipt, 'decision'>;
  consumerExpansion: Pick<ZavorthNativeRegistryConsumerExpansionNormalization, 'decision'>;
  staticGuardFiles: ZavorthAdapterDecommissionStaticGuardFile[];
  adapterRemovalAttempted: false;
  bridgeOrLiveProbeDeleted: false;
  externalExecutorLiveCalled: false;
  executionAttempted: false;
  externalMutationAttempted: false;
  stateMigrationAttempted: false;
  sourceModuleCopyAttempted: false;
  publicExternalExecutorIdentityExposed: false;
  rawSecretSerialized: false;
};

export type ZavorthAdapterDecommissionReadinessNormalization = {
  nativeContract: 'ZavorthAdapterDecommissionReadinessPack/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ZavorthAdapterDecommissionReadinessDecision;
  status: 'adapter-decommission-readiness-ready' | 'blocked';
  sourceReadiness: {
    partialAdapterDeprecation: ZavorthPartialAdapterDeprecationNormalization['decision'];
    partialAdapterRemoval: ZavorthPartialAdapterRemovalImplementationNormalization['decision'];
    consolidation: ZavorthNativeAbsorptionConsolidationNormalization['decision'];
    refreshCommit: ZavorthNativeRefreshCommitReceipt['decision'];
    consumerExpansion: ZavorthNativeRegistryConsumerExpansionNormalization['decision'];
  };
  usageInventory: ZavorthAdapterUsageInventoryRow[];
  inventorySummary: {
    adapterUsageInventoryComplete: true;
    totalKnownUsages: number;
    refreshReconciliationAllowed: number;
    fallbackExplicit: number;
    adapterRequired: number;
    legacyDefaultUsageViolations: number;
    safeRemovalCandidates: number;
  };
  decommissionReadinessMatrix: ZavorthAdapterDecommissionMatrixRow[];
  staticGuard: ZavorthAdapterDecommissionStaticGuard;
  removalPlan: ZavorthAdapterDecommissionRemovalPlanStep[];
  riskReport: ZavorthAdapterDecommissionRiskReport;
  executionGate: ZavorthAdapterDecommissionReadinessExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    rawMessageContentSerialized: false;
    publicSourceIdentityExposed: false;
    provenanceInternalOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'future-partial-adapter-code-removal-or-refresh-boundary-hardening';
};

export type ZavorthAdapterDecommissionReadinessOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  runtimeId: TRuntimeId;
  source: ZavorthAdapterDecommissionReadinessSource;
};

const FORBIDDEN_DEFAULT_PATTERNS: Array<{ pattern: RegExp; label: string; reason: string }> = [
  {
    pattern: /from\s+['"].*ExternalAgentExternalExecutor/i,
    label: 'ExternalAgentExternalExecutor default import',
    reason: 'native-ready default consumers must not import live source runtime modules',
  },
  {
    pattern: /from\s+['"].*FixtureExternalAgentAdapter/i,
    label: 'FixtureExternalAgentAdapter default import',
    reason: 'native-ready default consumers must not import adapter fixtures',
  },
  {
    pattern: /from\s+['"].*ExternalAgentSidecarAdapter/i,
    label: 'ExternalAgentSidecarAdapter default import',
    reason: 'native-ready default consumers must not import sidecar adapter modules',
  },
  {
    pattern: /adapterCalledForDefault(?:Lookup|Render|Path)\s*:\s*true/,
    label: 'default adapter call true',
    reason: 'default lookup/render/classification cannot call the adapter',
  },
  {
    pattern: /(?:externalExecutorLiveCalledForDefaultPath|externalSourceLiveCalledForDefaultPath)\s*:\s*true/i,
    label: 'live source runtime default path true',
    reason: 'default native-ready consumers cannot call live source runtime paths',
  },
  {
    pattern: /label\s*:\s*['"][^'"]*ExternalExecutor[^'"]*['"]/i,
    label: 'public ExternalExecutor label',
    reason: 'native-ready consumers must expose Zavorth-native labels',
  },
  {
    pattern: /source\s*:\s*['"][^'"]*external-executor[^'"]*['"]/i,
    label: 'public external-executor source',
    reason: 'native-ready consumers must not expose source runtime identity as public source',
  },
];

function usage(
  row: Omit<ZavorthAdapterUsageInventoryRow, 'nativeContract' | 'defaultAdapterPath' | 'adapterCalledForDefaultPath' | 'externalExecutorLiveCalledForDefaultPath' | 'adapterRemovalGlobalAllowed' | 'runtimeExternalExecutorRequiredForNativeReadyConsumers' | 'messageActuallySent' | 'providerActuallyExecuted' | 'commandActuallyExecuted' | 'toolActuallyExecuted' | 'externalMutationActuallyPerformed' | 'stateMigrated' | 'sourceModuleCopied' | 'rawSecretSerialized'>,
): ZavorthAdapterUsageInventoryRow {
  return {
    nativeContract: 'ZavorthAdapterUsageInventoryRow/v1',
    ...row,
    defaultAdapterPath: false,
    adapterCalledForDefaultPath: false,
    externalExecutorLiveCalledForDefaultPath: false,
    adapterRemovalGlobalAllowed: false,
    runtimeExternalExecutorRequiredForNativeReadyConsumers: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    externalMutationActuallyPerformed: false,
    stateMigrated: false,
    sourceModuleCopied: false,
    rawSecretSerialized: false,
  };
}

function buildUsageInventory(): ZavorthAdapterUsageInventoryRow[] {
  return [
    usage({
      usageId: 'command-center-runtime-projection-default-route',
      label: 'Command Center runtime projection default route',
      path: 'src/ai-gateway/app/(dashboard)/control/command-center/projections/commandCenterRuntimeProjection.ts',
      usageKind: 'native-ready-consumer',
      classification: 'safe-removal-candidate',
      decommissionDisposition: 'can-remove-now',
      nativeReadySurface: true,
      explicitAllowlist: false,
      allowlistRoles: [],
      safeRemovalCandidate: true,
      adapterRefreshAllowed: false,
    }),
    usage({
      usageId: 'controlled-dry-run-action-planner-default-route',
      label: 'Controlled dry-run action planner default route',
      path: 'src/runtime/external-agents/ExternalAgentControlledDryRunActionPlanner.ts',
      usageKind: 'native-ready-consumer',
      classification: 'safe-removal-candidate',
      decommissionDisposition: 'can-remove-now',
      nativeReadySurface: true,
      explicitAllowlist: false,
      allowlistRoles: [],
      safeRemovalCandidate: true,
      adapterRefreshAllowed: false,
    }),
    usage({
      usageId: 'command-http-policy-preflight-default-route',
      label: 'Command/http policy preflight default route',
      path: 'src/runtime/external-agents/ExternalAgentCommandHttpPolicyPreflightBoundary.ts',
      usageKind: 'native-ready-consumer',
      classification: 'safe-removal-candidate',
      decommissionDisposition: 'can-remove-now',
      nativeReadySurface: true,
      explicitAllowlist: false,
      allowlistRoles: [],
      safeRemovalCandidate: true,
      adapterRefreshAllowed: false,
    }),
    usage({
      usageId: 'command-http-observability-projection-default-route',
      label: 'Command/http observability projection default route',
      path: 'src/runtime/external-agents/ExternalAgentCommandHttpObservabilityProjectionBoundary.ts',
      usageKind: 'native-ready-consumer',
      classification: 'safe-removal-candidate',
      decommissionDisposition: 'can-remove-now',
      nativeReadySurface: true,
      explicitAllowlist: false,
      allowlistRoles: [],
      safeRemovalCandidate: true,
      adapterRefreshAllowed: false,
    }),
    usage({
      usageId: 'native-registry-refresh-reconciliation',
      label: 'Native registry refresh/reconciliation boundary',
      path: 'src/runtime/external-agents/ZavorthNativeRegistryRefreshReconciliation.ts',
      usageKind: 'refresh-reconciliation-boundary',
      classification: 'refresh-reconciliation-allowed',
      decommissionDisposition: 'isolate-behind-refresh-boundary',
      nativeReadySurface: false,
      explicitAllowlist: true,
      allowlistRoles: ['refresh-source', 'reconciliation-source'],
      safeRemovalCandidate: false,
      adapterRefreshAllowed: true,
    }),
    usage({
      usageId: 'native-refresh-commit-pack',
      label: 'Native refresh commit pack',
      path: 'src/runtime/external-agents/ZavorthNativeRefreshCommitPack.ts',
      usageKind: 'refresh-reconciliation-boundary',
      classification: 'refresh-reconciliation-allowed',
      decommissionDisposition: 'isolate-behind-refresh-boundary',
      nativeReadySurface: false,
      explicitAllowlist: true,
      allowlistRoles: ['refresh-source', 'reconciliation-source'],
      safeRemovalCandidate: false,
      adapterRefreshAllowed: true,
    }),
    usage({
      usageId: 'fixture-external-agent-adapter',
      label: 'Fixture external agent adapter',
      path: 'src/runtime/external-agents/FixtureExternalAgentAdapter.ts',
      usageKind: 'fixture-adapter',
      classification: 'fallback-explicit',
      decommissionDisposition: 'unknown-needs-audit',
      nativeReadySurface: false,
      explicitAllowlist: true,
      allowlistRoles: ['adapter-contract-fixture', 'degraded-fallback-explicit'],
      safeRemovalCandidate: false,
      removalBlockedReason: 'still referenced by contract and inbound conformance tests',
      adapterRefreshAllowed: false,
    }),
    usage({
      usageId: 'external-executor-live-read-only-probe',
      label: 'Live read-only probe boundary',
      path: 'src/runtime/external-agents/ExternalAgentExternalExecutorLiveReadOnlyProbe.ts',
      usageKind: 'live-probe-boundary',
      classification: 'adapter-required',
      decommissionDisposition: 'keep-required',
      nativeReadySurface: false,
      explicitAllowlist: true,
      allowlistRoles: ['live-probe-read-only'],
      safeRemovalCandidate: false,
      removalBlockedReason: 'read-only refresh and source health evidence still need this boundary',
      adapterRefreshAllowed: true,
    }),
    usage({
      usageId: 'external-executor-authenticated-health-probe',
      label: 'Authenticated gateway health probe boundary',
      path: 'src/runtime/external-agents/ExternalAgentExternalExecutorAuthenticatedEphemeralGatewayHealthProbe.ts',
      usageKind: 'live-probe-boundary',
      classification: 'adapter-required',
      decommissionDisposition: 'keep-required',
      nativeReadySurface: false,
      explicitAllowlist: true,
      allowlistRoles: ['live-probe-read-only'],
      safeRemovalCandidate: false,
      removalBlockedReason: 'authenticated health remains refresh/readiness evidence',
      adapterRefreshAllowed: true,
    }),
    usage({
      usageId: 'external-executor-real-capability-snapshot',
      label: 'Real capability snapshot read-only boundary',
      path: 'src/runtime/external-agents/ExternalAgentExternalExecutorRealCapabilitySnapshotReadOnly.ts',
      usageKind: 'live-probe-boundary',
      classification: 'adapter-required',
      decommissionDisposition: 'keep-required',
      nativeReadySurface: false,
      explicitAllowlist: true,
      allowlistRoles: ['live-probe-read-only'],
      safeRemovalCandidate: false,
      removalBlockedReason: 'future refresh can still reconcile against real read-only snapshot source',
      adapterRefreshAllowed: true,
    }),
    usage({
      usageId: 'external-executor-live-read-only-bridge',
      label: 'Live read-only bridge boundary',
      path: 'src/runtime/external-agents/ExternalAgentExternalExecutorLiveReadOnlyBridgeBoundary.ts',
      usageKind: 'read-only-bridge-boundary',
      classification: 'adapter-required',
      decommissionDisposition: 'keep-required',
      nativeReadySurface: false,
      explicitAllowlist: true,
      allowlistRoles: ['live-probe-read-only', 'reconciliation-source'],
      safeRemovalCandidate: false,
      removalBlockedReason: 'bridge remains source evidence for refresh and reconciliation',
      adapterRefreshAllowed: true,
    }),
    usage({
      usageId: 'approved-mutation-execution-harness',
      label: 'Approved mutation execution harness',
      path: 'src/runtime/external-agents/ExternalAgentApprovedMutationExecutionHarness.ts',
      usageKind: 'action-mutation-boundary',
      classification: 'adapter-required',
      decommissionDisposition: 'blocked',
      nativeReadySurface: false,
      explicitAllowlist: false,
      allowlistRoles: [],
      safeRemovalCandidate: false,
      removalBlockedReason: 'mutation/message/provider/command execution remains blocked and not decommissionable',
      adapterRefreshAllowed: false,
    }),
  ];
}

function buildMatrix(
  inventory: ZavorthAdapterUsageInventoryRow[],
): ZavorthAdapterDecommissionMatrixRow[] {
  const dispositions: ZavorthAdapterDecommissionDisposition[] = [
    'can-remove-now',
    'isolate-behind-refresh-boundary',
    'keep-required',
    'blocked',
    'unknown-needs-audit',
  ];

  return dispositions.map((disposition) => {
    const rows = inventory.filter((row) => row.decommissionDisposition === disposition);
    return {
      nativeContract: 'ZavorthAdapterDecommissionMatrixRow/v1',
      disposition,
      usageIds: rows.map((row) => row.usageId),
      action: actionForDisposition(disposition),
      removalAuthorizedNow: false,
      requiresFutureGate: disposition !== 'can-remove-now',
      rawSecretSerialized: false,
    };
  });
}

function actionForDisposition(disposition: ZavorthAdapterDecommissionDisposition): string {
  switch (disposition) {
    case 'can-remove-now':
      return 'Remove legacy/default adapter route references from native-ready consumers when present; none are removed in this pack.';
    case 'isolate-behind-refresh-boundary':
      return 'Keep behind explicit manual refresh/reconciliation mode only.';
    case 'keep-required':
      return 'Retain read-only live probe/bridge boundary until full parity and refresh replacement pass.';
    case 'blocked':
      return 'Do not remove or invoke while mutation/message/provider/command/import remains blocked.';
    case 'unknown-needs-audit':
      return 'Audit remaining tests/fixtures before considering removal.';
  }
}

export function evaluateZavorthAdapterDecommissionStaticGuard(
  files: ZavorthAdapterDecommissionStaticGuardFile[],
): ZavorthAdapterDecommissionStaticGuard {
  const findings = files.flatMap((file): ZavorthAdapterDecommissionStaticGuardFinding[] => {
    if (!file.defaultConsumer) {
      return [];
    }

    return FORBIDDEN_DEFAULT_PATTERNS
      .filter(({ pattern }) => pattern.test(file.content))
      .map(({ label, reason }) => ({
        nativeContract: 'ZavorthAdapterDecommissionStaticGuardFinding/v1',
        path: file.path,
        pattern: label,
        reason,
        defaultPathRegression: true,
      }));
  });

  return {
    nativeContract: 'ZavorthAdapterDecommissionStaticGuard/v1',
    checkedPaths: files.map((file) => file.path),
    allowlistedPaths: files
      .filter((file): file is ZavorthAdapterDecommissionStaticGuardFile & { allowlistRole: ZavorthAdapterAllowlistRole } => Boolean(file.allowlistRole))
      .map((file) => ({
        path: file.path,
        role: file.allowlistRole,
      })),
    findings,
    passed: findings.length === 0,
    defaultAdapterUsageViolationsDetected: findings.length > 0,
    allowlistExplicit: true,
    rawSecretSerialized: false,
  };
}

function removalPlan(): ZavorthAdapterDecommissionRemovalPlanStep[] {
  return [
    planStep(1, 'Remove default/legacy adapter imports', 'native-ready default consumers', '207-or-later-partial-default-import-cleanup'),
    planStep(2, 'Retire redundant wrappers after audit', 'fixture and compatibility wrappers', 'future-wrapper-fixture-decommission-gate'),
    planStep(3, 'Clean public docs/API legacy names', 'public docs and API labels', 'future-public-legacy-surface-cleanup-gate'),
    planStep(4, 'Retain live probe and refresh boundary', 'read-only live health/snapshot/reconciliation', 'full-refresh-parity-before-removal'),
  ];
}

function planStep(
  order: number,
  label: string,
  scope: string,
  requiredFutureGate: string,
): ZavorthAdapterDecommissionRemovalPlanStep {
  return {
    nativeContract: 'ZavorthAdapterDecommissionRemovalPlanStep/v1',
    order,
    label,
    scope,
    currentPackAction: 'plan-only',
    removalAuthorizedNow: false,
    requiredFutureGate,
  };
}

function riskReport(): ZavorthAdapterDecommissionRiskReport {
  return {
    nativeContract: 'ZavorthAdapterDecommissionRiskReport/v1',
    refreshStillNeedsExternalSource: true,
    actionDispatchStillBlocked: true,
    messageSendStillBlocked: true,
    providerExecutionStillBlocked: true,
    commandToolExecutionStillBlocked: true,
    migrationImportStillBlocked: true,
    liveProbeBoundaryStillRequired: true,
    globalAdapterRemovalRisk: 'blocked-until-full-parity-and-replacement',
    rawSecretSerialized: false,
  };
}

function executionGate(
  defaultAdapterUsageViolationsDetected: boolean,
): ZavorthAdapterDecommissionReadinessExecutionGate {
  return {
    adapterDecommissionReadinessPackCreated: true,
    adapterUsageInventoryComplete: true,
    defaultAdapterUsageViolationsDetected,
    safeRemovalCandidatesListed: true,
    adapterRemovalGlobalAllowed: false,
    runtimeExternalExecutorRequiredForNativeReadyConsumers: false,
    adapterRefreshAllowed: true,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    externalMutationActuallyPerformed: false,
    stateMigrated: false,
    sourceModuleCopied: false,
    rawSecretSerialized: false,
  };
}

function sourceReady(source: ZavorthAdapterDecommissionReadinessSource): boolean {
  return (
    source.partialAdapterDeprecation.decision === 'partial-adapter-deprecation-ready' &&
    source.partialAdapterRemoval.decision === 'partial-adapter-removal-implemented' &&
    source.consolidation.decision === 'native-absorption-consolidation-ready' &&
    source.refreshCommit.decision === 'native-refresh-commit-ready' &&
    source.consumerExpansion.decision === 'native-registry-consumer-expansion-ready' &&
    !source.adapterRemovalAttempted &&
    !source.bridgeOrLiveProbeDeleted &&
    !source.externalExecutorLiveCalled &&
    !source.executionAttempted &&
    !source.externalMutationAttempted &&
    !source.stateMigrationAttempted &&
    !source.sourceModuleCopyAttempted &&
    !source.publicExternalExecutorIdentityExposed &&
    !source.rawSecretSerialized
  );
}

function summary(
  inventory: ZavorthAdapterUsageInventoryRow[],
): ZavorthAdapterDecommissionReadinessNormalization['inventorySummary'] {
  return {
    adapterUsageInventoryComplete: true,
    totalKnownUsages: inventory.length,
    refreshReconciliationAllowed: inventory.filter((row) => row.classification === 'refresh-reconciliation-allowed').length,
    fallbackExplicit: inventory.filter((row) => row.classification === 'fallback-explicit').length,
    adapterRequired: inventory.filter((row) => row.classification === 'adapter-required').length,
    legacyDefaultUsageViolations: inventory.filter((row) => row.classification === 'legacy-default-usage-violation').length,
    safeRemovalCandidates: inventory.filter((row) => row.safeRemovalCandidate).length,
  };
}

export class ZavorthAdapterDecommissionReadinessPack {
  private readonly rowsById: Map<string, ZavorthAdapterUsageInventoryRow>;

  public constructor(public readonly normalization: ZavorthAdapterDecommissionReadinessNormalization) {
    this.rowsById = new Map(normalization.usageInventory.map((row) => [row.usageId, row]));
  }

  public lookupUsage(usageId: string): ZavorthAdapterUsageInventoryRow | undefined {
    return this.rowsById.get(usageId);
  }

  public usagesByDisposition(disposition: ZavorthAdapterDecommissionDisposition): ZavorthAdapterUsageInventoryRow[] {
    return this.normalization.usageInventory.filter((row) => row.decommissionDisposition === disposition);
  }

  public safeRemovalCandidates(): ZavorthAdapterUsageInventoryRow[] {
    return this.normalization.usageInventory.filter((row) => row.safeRemovalCandidate);
  }

  public adapterRequiredOrBlocked(): ZavorthAdapterUsageInventoryRow[] {
    return this.normalization.usageInventory.filter((row) => (
      row.decommissionDisposition === 'blocked' ||
      row.decommissionDisposition === 'keep-required'
    ));
  }
}

export function createZavorthAdapterDecommissionReadinessFixtureSource(
  staticGuardFiles: ZavorthAdapterDecommissionStaticGuardFile[] = [],
): ZavorthAdapterDecommissionReadinessSource {
  return {
    partialAdapterDeprecation: { decision: 'partial-adapter-deprecation-ready' },
    partialAdapterRemoval: { decision: 'partial-adapter-removal-implemented' },
    consolidation: { decision: 'native-absorption-consolidation-ready' },
    refreshCommit: { decision: 'native-refresh-commit-ready' },
    consumerExpansion: { decision: 'native-registry-consumer-expansion-ready' },
    staticGuardFiles,
    adapterRemovalAttempted: false,
    bridgeOrLiveProbeDeleted: false,
    externalExecutorLiveCalled: false,
    executionAttempted: false,
    externalMutationAttempted: false,
    stateMigrationAttempted: false,
    sourceModuleCopyAttempted: false,
    publicExternalExecutorIdentityExposed: false,
    rawSecretSerialized: false,
  };
}

export function normalizeZavorthAdapterDecommissionReadinessPack<TRuntimeId extends string>(
  options: ZavorthAdapterDecommissionReadinessOptions<TRuntimeId>,
): ZavorthAdapterDecommissionReadinessNormalization {
  const inventory = buildUsageInventory();
  const matrix = buildMatrix(inventory);
  const staticGuard = evaluateZavorthAdapterDecommissionStaticGuard(options.source.staticGuardFiles);
  const gate = executionGate(staticGuard.defaultAdapterUsageViolationsDetected);
  const ready = sourceReady(options.source) &&
    staticGuard.passed &&
    inventory.length >= 10 &&
    inventory.some((row) => row.safeRemovalCandidate) &&
    matrix.every((row) => row.usageIds.length > 0) &&
    inventory.every((row) => !row.defaultAdapterPath && !row.adapterCalledForDefaultPath && !row.rawSecretSerialized);

  return {
    nativeContract: 'ZavorthAdapterDecommissionReadinessPack/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'adapter-decommission-readiness-ready' : 'blocked',
    status: ready ? 'adapter-decommission-readiness-ready' : 'blocked',
    sourceReadiness: {
      partialAdapterDeprecation: options.source.partialAdapterDeprecation.decision,
      partialAdapterRemoval: options.source.partialAdapterRemoval.decision,
      consolidation: options.source.consolidation.decision,
      refreshCommit: options.source.refreshCommit.decision,
      consumerExpansion: options.source.consumerExpansion.decision,
    },
    usageInventory: inventory,
    inventorySummary: summary(inventory),
    decommissionReadinessMatrix: matrix,
    staticGuard,
    removalPlan: removalPlan(),
    riskReport: riskReport(),
    executionGate: gate,
    redaction: {
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      publicSourceIdentityExposed: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'future-partial-adapter-code-removal-or-refresh-boundary-hardening',
  };
}

export function normalizeZavorthAdapterDecommissionReadinessPackFixture(
  staticGuardFiles: ZavorthAdapterDecommissionStaticGuardFile[] = [],
): ZavorthAdapterDecommissionReadinessNormalization {
  return normalizeZavorthAdapterDecommissionReadinessPack({
    generatedAt: ZAVORTH_ADAPTER_DECOMMISSION_READINESS_PACK_NOW,
    runtimeId: ZAVORTH_ADAPTER_DECOMMISSION_READINESS_PACK_RUNTIME_ID,
    source: createZavorthAdapterDecommissionReadinessFixtureSource(staticGuardFiles),
  });
}

export function createZavorthAdapterDecommissionReadinessPackFixture(
  staticGuardFiles: ZavorthAdapterDecommissionStaticGuardFile[] = [],
): ZavorthAdapterDecommissionReadinessPack {
  return new ZavorthAdapterDecommissionReadinessPack(
    normalizeZavorthAdapterDecommissionReadinessPackFixture(staticGuardFiles),
  );
}
