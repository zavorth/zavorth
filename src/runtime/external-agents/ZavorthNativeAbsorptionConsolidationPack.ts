import {
  normalizeZavorthNativeRegistryRefreshReconciliationFixture,
} from './ZavorthNativeRegistryRefreshReconciliation.js';
import {
  normalizeZavorthPartialAdapterDeprecationGateFixture,
} from './ZavorthPartialAdapterDeprecationGate.js';
import type {
  ZavorthNativeRegistryPersistenceKind,
} from './ZavorthNativeRegistryPersistenceDryRun.js';
import type {
  ZavorthNativeRegistryProductionCommandCenterRestoreReceipt,
} from './ZavorthNativeRegistryProductionRestoreLoadCommandCenter.js';
import type {
  ZavorthNativeRegistryRefreshMode,
  ZavorthNativeRegistryRefreshPolicy,
  ZavorthNativeRegistryRefreshReconciliationNormalization,
} from './ZavorthNativeRegistryRefreshReconciliation.js';
import type {
  ZavorthPartialAdapterDeprecationNormalization,
} from './ZavorthPartialAdapterDeprecationGate.js';

export const ZAVORTH_NATIVE_ABSORPTION_CONSOLIDATION_PACK_NOW = '2026-04-29T08:00:00.000Z' as const;
export const ZAVORTH_NATIVE_ABSORPTION_CONSOLIDATION_PACK_RUNTIME_ID = 'zavorth-native-absorption-consolidation-pack' as const;

export type ZavorthNativeAbsorptionConsolidationDecision =
  | 'blocked'
  | 'native-absorption-consolidation-ready';

export type ZavorthNativeAbsorptionSurfaceClassification =
  | 'absorbed-native'
  | 'adapter-required'
  | 'blocked'
  | 'future-native-replacement'
  | 'native-first-refreshable';

export type ZavorthNativeAbsorptionConsolidationSurfaceId =
  | 'action-dispatch'
  | 'capabilities-plugins'
  | 'command-tool-execution'
  | 'config-secretref-state-metadata'
  | 'dashboard-command-center-view-models'
  | 'message-send'
  | 'message-transports'
  | 'migration-import'
  | 'provider-execution'
  | 'providers'
  | 'refresh-reconciliation'
  | 'sessions-history-metadata'
  | 'channels';

export type ZavorthNativeAbsorptionDefaultSource =
  | 'blocked'
  | 'explicit-refresh-adapter'
  | 'in-memory-native-registry'
  | 'none'
  | 'production-loaded-native-registry';

export type ZavorthNativeAbsorptionFallbackSource =
  | 'degraded-native-fallback'
  | 'explicit-refresh-only'
  | 'in-memory-native-registry'
  | 'none';

export type ZavorthNativeAbsorptionProductionDefaultStatus =
  | 'fallback-in-memory-native'
  | 'production-load-degraded'
  | 'production-loaded-ready';

export type ZavorthNativeAbsorptionMilestoneSurfaceRow = {
  nativeContract: 'ZavorthNativeAbsorptionMilestoneSurfaceRow/v1';
  surfaceId: ZavorthNativeAbsorptionConsolidationSurfaceId;
  label: string;
  classification: ZavorthNativeAbsorptionSurfaceClassification;
  evidenceGates: string[];
  nativeRegistryKinds: ZavorthNativeRegistryPersistenceKind[];
  currentDefaultPath: ZavorthNativeAbsorptionDefaultSource;
  adapterRequiredForDefaultPath: boolean;
  externalExecutorLiveRequiredForDefaultPath: false;
  gapSummary: string;
  partialRemovalCandidate: boolean;
  adapterRemovalGlobalAllowed: false;
  sourceRuntimeAuthority: false;
  executionAuthority: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeAbsorptionDefaultRoute = {
  nativeContract: 'ZavorthNativeAbsorptionDefaultRoute/v1';
  surfaceId: ZavorthNativeAbsorptionConsolidationSurfaceId;
  label: string;
  classification: ZavorthNativeAbsorptionSurfaceClassification;
  registryKinds: ZavorthNativeRegistryPersistenceKind[];
  defaultLookupPath: ZavorthNativeAbsorptionDefaultSource;
  defaultRenderPath: ZavorthNativeAbsorptionDefaultSource;
  fallbackPath: ZavorthNativeAbsorptionFallbackSource;
  adapterInvokedForDefaultLookup: false;
  adapterInvokedForDefaultRender: false;
  adapterMayBeCalledForExplicitRefresh: boolean;
  externalExecutorLiveCalledForDefaultPath: false;
  runtimeExternalExecutorRequiredForLookup: false;
  runtimeExternalExecutorRequiredForRender: false;
  sourceRuntimeAuthority: false;
  executionAuthority: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  stateMigrated: false;
  sourceModuleCopied: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeAbsorptionConsolidationProductionDefault = {
  nativeContract: 'ZavorthNativeAbsorptionProductionLoadedDefault/v1';
  status: ZavorthNativeAbsorptionProductionDefaultStatus;
  productionRestoreDecision?: ZavorthNativeRegistryProductionCommandCenterRestoreReceipt['decision'];
  productionLoadedViewCount: number;
  requiredRegistryKinds: ZavorthNativeRegistryPersistenceKind[];
  loadedRegistryKinds: ZavorthNativeRegistryPersistenceKind[];
  defaultWhenAvailable: 'production-loaded-native-registry';
  fallbackWhenMissingOrDegraded: 'in-memory-native-registry';
  productionLoadedNativeFirstDefaultPrepared: true;
  adapterInvokedForDefaultLookup: false;
  adapterInvokedForDefaultRender: false;
  runtimeExternalExecutorRequiredForProductionLoadedLookup: false;
  runtimeExternalExecutorRequiredForProductionLoadedRender: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeAbsorptionRefreshTighteningPolicy = {
  nativeContract: 'ZavorthNativeAbsorptionRefreshTighteningPolicy/v1';
  allowedModes: ZavorthNativeRegistryRefreshMode[];
  adapterAllowedOnlyFor: [
    'manual-refresh',
    'refresh-reconciliation',
    'degraded-fallback',
  ];
  adapterCallIsDefaultLookupPath: false;
  adapterCallIsDefaultRenderPath: false;
  refreshFailureBreaksNativeFirst: false;
  registryMutationCommitted: false;
  executionAuthority: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeAbsorptionDecommissionCandidate = {
  nativeContract: 'ZavorthNativeAbsorptionDecommissionCandidate/v1';
  id: string;
  label: string;
  affectedSurfaceIds: ZavorthNativeAbsorptionConsolidationSurfaceId[];
  proposedOrder: number;
  requiredFutureProof: string;
  removeInThisPack: false;
  adapterRemovalGlobalAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeAbsorptionConsolidationExecutionGate = {
  nativeAbsorptionConsolidationPackCreated: true;
  productionLoadedNativeFirstDefaultPrepared: true;
  adapterDefaultPathForNativeReadySurfaces: false;
  runtimeExternalExecutorRequiredForCommandCenterRender: false;
  runtimeExternalExecutorRequiredForNativeRegistryLookup: false;
  adapterRefreshAllowed: true;
  adapterRemovalGlobalAllowed: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  stateMigrated: false;
  sourceModuleCopied: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeAbsorptionConsolidationSource = {
  partialAdapterDeprecation: ZavorthPartialAdapterDeprecationNormalization;
  refreshReconciliation: ZavorthNativeRegistryRefreshReconciliationNormalization;
  productionRestore?: ZavorthNativeRegistryProductionCommandCenterRestoreReceipt;
  adapterCalledDuringDefaultLookup: false;
  adapterCalledDuringDefaultRender: false;
  externalExecutorLiveCalledDuringDefaultPath: false;
  executionAttempted: false;
  stateMigrationAttempted: false;
  sourceModuleCopyAttempted: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeAbsorptionConsolidationNormalization = {
  nativeContract: 'ZavorthNativeAbsorptionConsolidationPack/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ZavorthNativeAbsorptionConsolidationDecision;
  status: 'blocked' | 'native-absorption-consolidation-ready';
  sourceReadiness: {
    partialAdapterDeprecation: ZavorthPartialAdapterDeprecationNormalization['decision'];
    refreshReconciliation: ZavorthNativeRegistryRefreshReconciliationNormalization['decision'];
    productionRestore?: ZavorthNativeRegistryProductionCommandCenterRestoreReceipt['decision'];
  };
  milestoneMatrix: ZavorthNativeAbsorptionMilestoneSurfaceRow[];
  productionDefault: ZavorthNativeAbsorptionConsolidationProductionDefault;
  defaultRoutes: ZavorthNativeAbsorptionDefaultRoute[];
  refreshTighteningPolicy: ZavorthNativeAbsorptionRefreshTighteningPolicy;
  decommissionCandidates: ZavorthNativeAbsorptionDecommissionCandidate[];
  remainingGaps: string[];
  executionGate: ZavorthNativeAbsorptionConsolidationExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    rawMessageContentSerialized: false;
    sourceIdentityPublic: false;
    sourceStructuresPublic: false;
    provenanceInternalOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'future-partial-adapter-removal-candidate-or-refresh-reconciliation-commit-pack';
};

export type ZavorthNativeAbsorptionConsolidationOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  runtimeId: TRuntimeId;
  source: ZavorthNativeAbsorptionConsolidationSource;
};

const REQUIRED_REGISTRY_KINDS: ZavorthNativeRegistryPersistenceKind[] = [
  'capability-registry',
  'dashboard-view-model-registry',
  'integration-registry',
  'session-history-registry',
  'config-state-registry',
];

function productionDefault(
  source: ZavorthNativeAbsorptionConsolidationSource,
): ZavorthNativeAbsorptionConsolidationProductionDefault {
  const loadedRegistryKinds = source.productionRestore?.views.map((view) => view.registryKind) ?? [];
  const hasAllRequired = REQUIRED_REGISTRY_KINDS.every((kind) => loadedRegistryKinds.includes(kind));
  const ready = source.productionRestore?.decision === 'production-restore-load-command-center-ready' && hasAllRequired;
  const status: ZavorthNativeAbsorptionProductionDefaultStatus = ready
    ? 'production-loaded-ready'
    : source.productionRestore
      ? 'production-load-degraded'
      : 'fallback-in-memory-native';

  return {
    nativeContract: 'ZavorthNativeAbsorptionProductionLoadedDefault/v1',
    status,
    ...(source.productionRestore ? { productionRestoreDecision: source.productionRestore.decision } : {}),
    productionLoadedViewCount: source.productionRestore?.views.length ?? 0,
    requiredRegistryKinds: REQUIRED_REGISTRY_KINDS,
    loadedRegistryKinds,
    defaultWhenAvailable: 'production-loaded-native-registry',
    fallbackWhenMissingOrDegraded: 'in-memory-native-registry',
    productionLoadedNativeFirstDefaultPrepared: true,
    adapterInvokedForDefaultLookup: false,
    adapterInvokedForDefaultRender: false,
    runtimeExternalExecutorRequiredForProductionLoadedLookup: false,
    runtimeExternalExecutorRequiredForProductionLoadedRender: false,
    rawSecretSerialized: false,
  };
}

function milestoneMatrix(defaultPath: ZavorthNativeAbsorptionDefaultSource): ZavorthNativeAbsorptionMilestoneSurfaceRow[] {
  return [
    surface('capabilities-plugins', 'capabilities/plugins', 'absorbed-native', ['161', '169', '173', '185', '190', '194-200'], ['capability-registry'], defaultPath, 'Registry lookup/list/classify is Zavorth-native.', true),
    surface('dashboard-command-center-view-models', 'dashboard/Command Center view models', 'absorbed-native', ['173', '186', '190', '192', '199', '200'], ['dashboard-view-model-registry'], defaultPath, 'Command Center render/view lookup is native-first.', true),
    surface('providers', 'providers', 'native-first-refreshable', ['161', '170', '173', '187', '190', '191', '200'], ['integration-registry'], defaultPath, 'Provider metadata is native-first; execution stays blocked.', true),
    surface('channels', 'channels', 'native-first-refreshable', ['169', '172', '173', '183', '187', '190', '191', '200'], ['integration-registry'], defaultPath, 'Channel metadata is native-first; opening/sending stays blocked.', true),
    surface('message-transports', 'message transports', 'native-first-refreshable', ['182', '183', '187', '190', '191', '200'], ['integration-registry'], defaultPath, 'Transport send capability is classified but not invoked.', true),
    surface('sessions-history-metadata', 'sessions/history metadata', 'absorbed-native', ['167', '172', '173', '188', '190', '194-200'], ['session-history-registry'], defaultPath, 'Session/history metadata views are native; raw import stays blocked.', true),
    surface('config-secretref-state-metadata', 'config/SecretRef/state metadata', 'absorbed-native', ['157', '162-166', '189', '190', '194-200'], ['config-state-registry'], defaultPath, 'Config/state metadata is native and SecretRef-only.', true),
    surface('refresh-reconciliation', 'refresh/reconciliation', 'adapter-required', ['191', '193', '197', '199', '200'], [], 'explicit-refresh-adapter', 'Adapter retained only for explicit refresh/reconciliation.', false),
    surface('action-dispatch', 'action dispatch', 'blocked', ['174-181', '200'], [], 'blocked', 'Mutable action dispatch is blocked by policy.', false),
    surface('message-send', 'message send', 'blocked', ['182', '183', '200'], [], 'blocked', 'Message transport flow is modeled but live send is blocked.', false),
    surface('provider-execution', 'provider execution', 'blocked', ['174', '175', '178', '180', '200'], [], 'blocked', 'Provider execution remains blocked.', false),
    surface('command-tool-execution', 'command/tool execution', 'blocked', ['143-147', '174', '175', '178', '180', '200'], [], 'blocked', 'Command/tool execution remains blocked.', false),
    surface('migration-import', 'migration/import', 'blocked', ['162-167', '188', '189', '194-200'], [], 'blocked', 'State/session/config migration remains blocked.', false),
  ];
}

function surface(
  surfaceId: ZavorthNativeAbsorptionConsolidationSurfaceId,
  label: string,
  classification: ZavorthNativeAbsorptionSurfaceClassification,
  evidenceGates: string[],
  nativeRegistryKinds: ZavorthNativeRegistryPersistenceKind[],
  currentDefaultPath: ZavorthNativeAbsorptionDefaultSource,
  gapSummary: string,
  partialRemovalCandidate: boolean,
): ZavorthNativeAbsorptionMilestoneSurfaceRow {
  const adapterRequiredForDefaultPath = currentDefaultPath === 'explicit-refresh-adapter';
  return {
    nativeContract: 'ZavorthNativeAbsorptionMilestoneSurfaceRow/v1',
    surfaceId,
    label,
    classification,
    evidenceGates,
    nativeRegistryKinds,
    currentDefaultPath,
    adapterRequiredForDefaultPath,
    externalExecutorLiveRequiredForDefaultPath: false,
    gapSummary,
    partialRemovalCandidate,
    adapterRemovalGlobalAllowed: false,
    sourceRuntimeAuthority: false,
    executionAuthority: false,
    rawSecretSerialized: false,
  };
}

function routeForSurface(
  row: ZavorthNativeAbsorptionMilestoneSurfaceRow,
  productionStatus: ZavorthNativeAbsorptionProductionDefaultStatus,
): ZavorthNativeAbsorptionDefaultRoute {
  const productionReady = productionStatus === 'production-loaded-ready';
  const isNativeDefault = row.classification === 'absorbed-native' || row.classification === 'native-first-refreshable';
  const defaultPath = isNativeDefault
    ? productionReady
      ? 'production-loaded-native-registry'
      : 'in-memory-native-registry'
    : row.classification === 'adapter-required'
      ? 'none'
      : 'blocked';
  const fallbackPath = isNativeDefault
    ? productionReady
      ? 'in-memory-native-registry'
      : 'degraded-native-fallback'
    : row.classification === 'adapter-required'
      ? 'explicit-refresh-only'
      : 'none';

  return {
    nativeContract: 'ZavorthNativeAbsorptionDefaultRoute/v1',
    surfaceId: row.surfaceId,
    label: row.label,
    classification: row.classification,
    registryKinds: row.nativeRegistryKinds,
    defaultLookupPath: defaultPath,
    defaultRenderPath: defaultPath,
    fallbackPath,
    adapterInvokedForDefaultLookup: false,
    adapterInvokedForDefaultRender: false,
    adapterMayBeCalledForExplicitRefresh: row.classification === 'adapter-required',
    externalExecutorLiveCalledForDefaultPath: false,
    runtimeExternalExecutorRequiredForLookup: false,
    runtimeExternalExecutorRequiredForRender: false,
    sourceRuntimeAuthority: false,
    executionAuthority: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    stateMigrated: false,
    sourceModuleCopied: false,
    rawSecretSerialized: false,
  };
}

function defaultRoutes(
  matrix: ZavorthNativeAbsorptionMilestoneSurfaceRow[],
  productionStatus: ZavorthNativeAbsorptionProductionDefaultStatus,
): ZavorthNativeAbsorptionDefaultRoute[] {
  return matrix.map((row) => routeForSurface(row, productionStatus));
}

function refreshTighteningPolicy(
  policies: ZavorthNativeRegistryRefreshPolicy[],
): ZavorthNativeAbsorptionRefreshTighteningPolicy {
  return {
    nativeContract: 'ZavorthNativeAbsorptionRefreshTighteningPolicy/v1',
    allowedModes: policies.map((policy) => policy.mode),
    adapterAllowedOnlyFor: [
      'manual-refresh',
      'refresh-reconciliation',
      'degraded-fallback',
    ],
    adapterCallIsDefaultLookupPath: false,
    adapterCallIsDefaultRenderPath: false,
    refreshFailureBreaksNativeFirst: false,
    registryMutationCommitted: false,
    executionAuthority: false,
    rawSecretSerialized: false,
  };
}

function decommissionCandidates(): ZavorthNativeAbsorptionDecommissionCandidate[] {
  return [
    candidate('capability-plugin-default-adapter-bypass', 'Remove capability/plugin lookup adapter fallback after production-loaded parity receipts stay stable.', ['capabilities-plugins'], 1, 'Production-loaded capability registry parity plus rollback receipt under refresh failure.'),
    candidate('command-center-default-adapter-bypass', 'Remove dashboard default adapter path for native-ready view models.', ['dashboard-command-center-view-models'], 2, 'Consumer rollout receipt proving Command Center imports only Zavorth-native view models by default.'),
    candidate('integration-metadata-discovery-fallback-bypass', 'Remove provider/channel/transport metadata discovery fallback from default lookup.', ['providers', 'channels', 'message-transports'], 3, 'Refresh reconciliation diff proving adapter is explicit update source only.'),
    candidate('session-config-metadata-fallback-bypass', 'Remove session/config metadata lookup fallback from default lookup.', ['sessions-history-metadata', 'config-secretref-state-metadata'], 4, 'Metadata-only restore/load proof with migration/import still blocked.'),
  ];
}

function candidate(
  id: string,
  label: string,
  affectedSurfaceIds: ZavorthNativeAbsorptionConsolidationSurfaceId[],
  proposedOrder: number,
  requiredFutureProof: string,
): ZavorthNativeAbsorptionDecommissionCandidate {
  return {
    nativeContract: 'ZavorthNativeAbsorptionDecommissionCandidate/v1',
    id,
    label,
    affectedSurfaceIds,
    proposedOrder,
    requiredFutureProof,
    removeInThisPack: false,
    adapterRemovalGlobalAllowed: false,
    rawSecretSerialized: false,
  };
}

function executionGate(): ZavorthNativeAbsorptionConsolidationExecutionGate {
  return {
    nativeAbsorptionConsolidationPackCreated: true,
    productionLoadedNativeFirstDefaultPrepared: true,
    adapterDefaultPathForNativeReadySurfaces: false,
    runtimeExternalExecutorRequiredForCommandCenterRender: false,
    runtimeExternalExecutorRequiredForNativeRegistryLookup: false,
    adapterRefreshAllowed: true,
    adapterRemovalGlobalAllowed: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    stateMigrated: false,
    sourceModuleCopied: false,
    rawSecretSerialized: false,
  };
}

function remainingGaps(): string[] {
  return [
    'global adapter removal remains blocked',
    'refresh/reconciliation still requires explicit adapter mode',
    'message send remains blocked',
    'provider execution remains blocked',
    'command/tool execution remains blocked',
    'migration/import remains blocked',
    'source module copy remains blocked',
  ];
}

function sourceReady(source: ZavorthNativeAbsorptionConsolidationSource): boolean {
  return (
    source.partialAdapterDeprecation.decision === 'partial-adapter-deprecation-ready' &&
    source.refreshReconciliation.decision === 'native-registry-refresh-reconciliation-ready' &&
    !source.adapterCalledDuringDefaultLookup &&
    !source.adapterCalledDuringDefaultRender &&
    !source.externalExecutorLiveCalledDuringDefaultPath &&
    !source.executionAttempted &&
    !source.stateMigrationAttempted &&
    !source.sourceModuleCopyAttempted &&
    !source.rawSecretSerialized
  );
}

export class ZavorthNativeAbsorptionConsolidationPack {
  private readonly routesBySurfaceId: Map<ZavorthNativeAbsorptionConsolidationSurfaceId, ZavorthNativeAbsorptionDefaultRoute>;

  public constructor(public readonly normalization: ZavorthNativeAbsorptionConsolidationNormalization) {
    this.routesBySurfaceId = new Map(normalization.defaultRoutes.map((route) => [route.surfaceId, route]));
  }

  public listDefaultRoutes(): ZavorthNativeAbsorptionDefaultRoute[] {
    return this.normalization.defaultRoutes;
  }

  public nativeReadyDefaultRoutes(): ZavorthNativeAbsorptionDefaultRoute[] {
    return this.normalization.defaultRoutes.filter((route) => (
      route.classification === 'absorbed-native' ||
      route.classification === 'native-first-refreshable'
    ));
  }

  public lookupDefaultRoute(surfaceId: ZavorthNativeAbsorptionConsolidationSurfaceId): ZavorthNativeAbsorptionDefaultRoute | undefined {
    return this.routesBySurfaceId.get(surfaceId);
  }

  public refreshModes(): ZavorthNativeRegistryRefreshMode[] {
    return this.normalization.refreshTighteningPolicy.allowedModes;
  }
}

export function createZavorthNativeAbsorptionConsolidationFixtureSource(
  productionRestore?: ZavorthNativeRegistryProductionCommandCenterRestoreReceipt,
): ZavorthNativeAbsorptionConsolidationSource {
  return {
    partialAdapterDeprecation: normalizeZavorthPartialAdapterDeprecationGateFixture(),
    refreshReconciliation: normalizeZavorthNativeRegistryRefreshReconciliationFixture(),
    ...(productionRestore ? { productionRestore } : {}),
    adapterCalledDuringDefaultLookup: false,
    adapterCalledDuringDefaultRender: false,
    externalExecutorLiveCalledDuringDefaultPath: false,
    executionAttempted: false,
    stateMigrationAttempted: false,
    sourceModuleCopyAttempted: false,
    rawSecretSerialized: false,
  };
}

export function normalizeZavorthNativeAbsorptionConsolidationPack<TRuntimeId extends string>(
  options: ZavorthNativeAbsorptionConsolidationOptions<TRuntimeId>,
): ZavorthNativeAbsorptionConsolidationNormalization {
  const production = productionDefault(options.source);
  const matrix = milestoneMatrix(
    production.status === 'production-loaded-ready'
      ? 'production-loaded-native-registry'
      : 'in-memory-native-registry',
  );
  const routes = defaultRoutes(matrix, production.status);
  const nativeRoutes = routes.filter((route) => (
    route.classification === 'absorbed-native' ||
    route.classification === 'native-first-refreshable'
  ));
  const refreshPolicy = refreshTighteningPolicy(options.source.refreshReconciliation.refreshPolicies);
  const gate = executionGate();
  const ready = sourceReady(options.source) &&
    matrix.length === 13 &&
    nativeRoutes.length === 7 &&
    nativeRoutes.every((route) => (
      !route.adapterInvokedForDefaultLookup &&
      !route.adapterInvokedForDefaultRender &&
      !route.externalExecutorLiveCalledForDefaultPath &&
      route.runtimeExternalExecutorRequiredForLookup === false &&
      route.runtimeExternalExecutorRequiredForRender === false
    )) &&
    routes.some((route) => route.surfaceId === 'refresh-reconciliation' && route.fallbackPath === 'explicit-refresh-only') &&
    routes.some((route) => route.surfaceId === 'message-send' && route.defaultLookupPath === 'blocked') &&
    refreshPolicy.allowedModes.includes('live-adapter-optional') &&
    !refreshPolicy.adapterCallIsDefaultLookupPath &&
    !refreshPolicy.refreshFailureBreaksNativeFirst;

  return {
    nativeContract: 'ZavorthNativeAbsorptionConsolidationPack/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'native-absorption-consolidation-ready' : 'blocked',
    status: ready ? 'native-absorption-consolidation-ready' : 'blocked',
    sourceReadiness: {
      partialAdapterDeprecation: options.source.partialAdapterDeprecation.decision,
      refreshReconciliation: options.source.refreshReconciliation.decision,
      ...(options.source.productionRestore ? { productionRestore: options.source.productionRestore.decision } : {}),
    },
    milestoneMatrix: matrix,
    productionDefault: production,
    defaultRoutes: routes,
    refreshTighteningPolicy: refreshPolicy,
    decommissionCandidates: decommissionCandidates(),
    remainingGaps: remainingGaps(),
    executionGate: gate,
    redaction: {
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      sourceIdentityPublic: false,
      sourceStructuresPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'future-partial-adapter-removal-candidate-or-refresh-reconciliation-commit-pack',
  };
}

export function normalizeZavorthNativeAbsorptionConsolidationPackFixture(): ZavorthNativeAbsorptionConsolidationNormalization {
  return normalizeZavorthNativeAbsorptionConsolidationPack({
    generatedAt: ZAVORTH_NATIVE_ABSORPTION_CONSOLIDATION_PACK_NOW,
    runtimeId: ZAVORTH_NATIVE_ABSORPTION_CONSOLIDATION_PACK_RUNTIME_ID,
    source: createZavorthNativeAbsorptionConsolidationFixtureSource(),
  });
}

export function createZavorthNativeAbsorptionConsolidationPackFixture(
  productionRestore?: ZavorthNativeRegistryProductionCommandCenterRestoreReceipt,
): ZavorthNativeAbsorptionConsolidationPack {
  return new ZavorthNativeAbsorptionConsolidationPack(
    normalizeZavorthNativeAbsorptionConsolidationPack({
      generatedAt: ZAVORTH_NATIVE_ABSORPTION_CONSOLIDATION_PACK_NOW,
      runtimeId: ZAVORTH_NATIVE_ABSORPTION_CONSOLIDATION_PACK_RUNTIME_ID,
      source: createZavorthNativeAbsorptionConsolidationFixtureSource(productionRestore),
    }),
  );
}
