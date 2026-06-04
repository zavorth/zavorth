import type {
  ToolExposurePolicyContractInput,
} from '../agent/contracts/index.js';
import type {
  UniversalAgentChannel,
  UniversalToolRiskLevel,
} from '../agent/UniversalAgentRuntimeTypes.js';
import type {
  ImportedCapabilityTrustState,
} from '../agent/security/index.js';
import type {
  RuntimeAdapterCapabilityKind,
  RuntimeAdapterEventEnvelope,
  RuntimeAdapterHealthSnapshot,
} from './contracts.js';

export const RUNTIME_ADAPTER_LIVE_READINESS_ASSIMILATION_PACK_NOW = '2026-04-28T12:00:00.000Z' as const;
export const RUNTIME_ADAPTER_LIVE_READINESS_ASSIMILATION_PACK_RUNTIME_ID = 'runtime-adapter-live-readiness-external-executor-fixture' as const;

export type RuntimeAdapterLiveReadinessCapabilityRowKind =
  | 'channel-capabilities'
  | 'command-http-capabilities'
  | 'gateway-method-capabilities'
  | 'plugin-capabilities'
  | 'provider-capabilities'
  | 'session-history-capabilities'
  | 'worker-node-capabilities';

export type RuntimeAdapterLiveReadinessCapabilityAvailability =
  | 'available'
  | 'degraded'
  | 'unavailable';

export type RuntimeAdapterLiveReadinessImportClassification =
  | 'approval-required'
  | 'blocked'
  | 'degraded'
  | 'inventory-only'
  | 'unavailable';

export type RuntimeAdapterLiveReadinessSubgateName =
  | 'audit-receipt-model'
  | 'capability-import-classification'
  | 'capability-snapshot-normalizer'
  | 'dashboard-live-assimilation-projection'
  | 'degraded-unavailable-state-handling'
  | 'event-bridge-read-only-contract'
  | 'no-execution-policy-invariants'
  | 'read-only-adapter-interface';

export type RuntimeAdapterLiveReadinessNoExecutionPolicy = {
  externalExecutorLiveCalled: false;
  secretResolved: false;
  tokenRead: false;
  gatewayStarted: false;
  websocketConnected: false;
  httpConnected: false;
  liveEventStreamConnected: false;
  toolExecuted: false;
  providerExecuted: false;
  commandExecuted: false;
  actionDispatched: false;
  sessionImported: false;
  configMigrated: false;
  stateMigrated: false;
  sourceModulesCopied: false;
  realAdapterCreated: false;
  nativeReplacementAuthorized: false;
  executionAuthority: false;
  sourceIdsEvidenceOnly: true;
  nextLiveGatesBlockedUntil: {
    secretProvisioning: 'secret-present-redacted';
    authenticatedHealth: 'authenticated-health-ok';
  };
};

export type RuntimeAdapterLiveReadinessCapabilitySource = {
  availability: RuntimeAdapterLiveReadinessCapabilityAvailability;
  evidenceHints: string[];
  kind: RuntimeAdapterCapabilityKind;
  label: string;
  publicSourceIdSeed: string;
  requiresApprovalHint?: boolean;
  risk: UniversalToolRiskLevel;
  rowKind: RuntimeAdapterLiveReadinessCapabilityRowKind;
  sourceReportedState: string;
  toolNames: string[];
  trustState: ImportedCapabilityTrustState;
};

export type RuntimeAdapterLiveReadinessEventSource = {
  channel: UniversalAgentChannel;
  occurredAt: string;
  publicEventIdSeed: string;
  rowKind: RuntimeAdapterLiveReadinessCapabilityRowKind;
  sessionId: string;
  status: RuntimeAdapterLiveReadinessCapabilityAvailability;
  text: string;
};

export type RuntimeAdapterLiveReadinessSnapshotSource = {
  capabilities: RuntimeAdapterLiveReadinessCapabilitySource[];
  events: RuntimeAdapterLiveReadinessEventSource[];
  gatewayMode: 'read-only-simulated';
  healthStatus: RuntimeAdapterHealthSnapshot['status'];
  sourceRuntimeName: string;
  sourceRuntimeVersion: string;
};

export type RuntimeAdapterLiveReadinessExecutionMethod = {
  name:
    | 'getAuditReceipts'
    | 'getHealthSnapshot'
    | 'listCapabilitySnapshot'
    | 'pullReadOnlyEvents';
  readOnly: true;
  mutatesSource: false;
  liveTransportRequired: false;
  executionAuthority: false;
};

export type RuntimeAdapterLiveReadinessReadOnlyAdapterInterface = {
  nativeContract: 'ZavorthRuntimeAdapterReadOnlyAdapterInterface/v1';
  id: string;
  readOnly: true;
  adapterRealCreated: false;
  sourceRuntimeConnected: false;
  startGatewayAllowed: false;
  connectHttpAllowed: false;
  connectWebSocketAllowed: false;
  actionDispatchAllowed: false;
  providerExecutionAllowed: false;
  commandExecutionAllowed: false;
  sessionImportAllowed: false;
  methods: RuntimeAdapterLiveReadinessExecutionMethod[];
};

export type RuntimeAdapterLiveReadinessSourceEvidence = {
  evidenceId: string;
  sourceRuntimeName: string;
  sourceRowKind: RuntimeAdapterLiveReadinessCapabilityRowKind;
  sourceIdStoredAsEvidenceOnly: true;
  sourceHintsStoredAsEvidenceOnly: true;
  sourceHints: string[];
};

export type RuntimeAdapterLiveReadinessCapabilityInventoryRow = {
  nativeContract: 'ZavorthRuntimeAdapterCapabilityInventoryRow/v1';
  id: string;
  label: string;
  rowKind: RuntimeAdapterLiveReadinessCapabilityRowKind;
  kind: RuntimeAdapterCapabilityKind;
  risk: UniversalToolRiskLevel;
  trustState: ImportedCapabilityTrustState;
  availability: RuntimeAdapterLiveReadinessCapabilityAvailability;
  importClassification: RuntimeAdapterLiveReadinessImportClassification;
  policy: 'allowed' | 'approval-required' | 'blocked';
  toolNames: string[];
  executionAuthority: false;
  sourceIdsEvidenceOnly: true;
  sourceModuleCopied: false;
  sourceHandlerLoaded: false;
  providerSdkLoaded: false;
  sessionImportAuthorized: false;
  sourceEvidence: RuntimeAdapterLiveReadinessSourceEvidence;
};

export type RuntimeAdapterLiveReadinessCapabilitySnapshot = {
  nativeContract: 'ZavorthRuntimeAdapterCapabilitySnapshotNormalizer/v1';
  id: string;
  inventory: RuntimeAdapterLiveReadinessCapabilityInventoryRow[];
  toolExposurePolicyInput: ToolExposurePolicyContractInput;
  sourceSnapshotStoredAsEvidenceOnly: true;
  executionAuthority: false;
  sourceModuleCopied: false;
  realCapabilityImported: false;
};

export type RuntimeAdapterLiveReadinessEventBridgeEnvelope = {
  nativeContract: 'ZavorthRuntimeAdapterLiveReadinessEventBridgeEnvelope/v1';
  id: string;
  eventEnvelope: RuntimeAdapterEventEnvelope;
  sourceEventStoredAsEvidenceOnly: true;
  producesEnvelope: true;
  dispatchPerformed: false;
  liveStreamConnected: false;
  websocketConnected: false;
  httpConnected: false;
  noSecondEventBus: true;
};

export type RuntimeAdapterLiveReadinessEventBridge = {
  nativeContract: 'ZavorthRuntimeAdapterLiveReadinessEventBridge/v1';
  envelopes: RuntimeAdapterLiveReadinessEventBridgeEnvelope[];
  readOnly: true;
  producesEnvelopes: true;
  dispatchPerformed: false;
  liveEventStreamConnected: false;
  noSecondEventBus: true;
};

export type RuntimeAdapterLiveReadinessDashboardRow = {
  nativeContract: 'ZavorthRuntimeAdapterDashboardLiveAssimilationRow/v1';
  id: string;
  label: string;
  rowKind: RuntimeAdapterLiveReadinessCapabilityRowKind;
  status: 'approval-required' | 'blocked' | 'degraded' | 'ready' | 'unavailable';
  zavorthTerm: string;
  readOnly: true;
  usesZavorthTerms: true;
  sourceIdStoredAsEvidenceOnly: true;
  executionAuthority: false;
  executableControlExposed: false;
  providerExecutionControlExposed: false;
  commandExecutionControlExposed: false;
  sessionImportControlExposed: false;
};

export type RuntimeAdapterLiveReadinessDashboardProjection = {
  nativeContract: 'ZavorthRuntimeAdapterDashboardLiveAssimilationProjection/v1';
  id: string;
  readOnly: true;
  usesZavorthTerms: true;
  rows: RuntimeAdapterLiveReadinessDashboardRow[];
  executableControlsExposed: false;
  providerExecutionControlsExposed: false;
  commandExecutionControlsExposed: false;
  sessionImportControlsExposed: false;
};

export type RuntimeAdapterLiveReadinessClassification = {
  nativeContract: 'ZavorthRuntimeAdapterCapabilityImportClassification/v1';
  rows: Array<{
    id: string;
    capabilityId: string;
    rowKind: RuntimeAdapterLiveReadinessCapabilityRowKind;
    classification: RuntimeAdapterLiveReadinessImportClassification;
    policy: 'allowed' | 'approval-required' | 'blocked';
    reason: string;
    executionAuthority: false;
    sourceIdsEvidenceOnly: true;
  }>;
  dangerousCapabilitiesBlockedOrApprovalGated: true;
  sourceIdsEvidenceOnly: true;
  importAuthorized: false;
};

export type RuntimeAdapterLiveReadinessDegradedUnavailableHandling = {
  nativeContract: 'ZavorthRuntimeAdapterDegradedUnavailableStateHandling/v1';
  degradedRows: string[];
  unavailableRows: string[];
  preservedHonestly: true;
  unavailableNotPromotedToReady: true;
  degradedNotSilentlyIgnored: true;
};

export type RuntimeAdapterLiveReadinessAuditReceipt = {
  nativeContract: 'ZavorthRuntimeAdapterLiveReadinessAuditReceipt/v1';
  id: string;
  subgate: RuntimeAdapterLiveReadinessSubgateName;
  status: 'ready';
  rawSecretObserved: false;
  rawSecretSerialized: false;
  redacted: true;
  sourceEvidenceOnly: true;
  executionAuthority: false;
};

export type RuntimeAdapterLiveReadinessSubgate = {
  name: RuntimeAdapterLiveReadinessSubgateName;
  ready: true;
  liveCallRequired: false;
  executionAuthority: false;
};

export type RuntimeAdapterLiveReadinessAssimilationPackOptions<TRuntimeId extends string = string> = {
  executionPolicy: RuntimeAdapterLiveReadinessNoExecutionPolicy;
  generatedAt: string;
  idPrefix: string;
  runtimeId: TRuntimeId;
  source: RuntimeAdapterLiveReadinessSnapshotSource;
};

export type RuntimeAdapterLiveReadinessAssimilationPackNormalization<TRuntimeId extends string = string> = {
  nativeContract: 'ZavorthRuntimeAdapterLiveReadinessAssimilationPack/v1';
  generatedAt: string;
  runtimeId: TRuntimeId;
  subgates: RuntimeAdapterLiveReadinessSubgate[];
  health: RuntimeAdapterHealthSnapshot;
  snapshot: RuntimeAdapterLiveReadinessCapabilitySnapshot;
  adapterInterface: RuntimeAdapterLiveReadinessReadOnlyAdapterInterface;
  eventBridge: RuntimeAdapterLiveReadinessEventBridge;
  dashboardProjection: RuntimeAdapterLiveReadinessDashboardProjection;
  capabilityImportClassification: RuntimeAdapterLiveReadinessClassification;
  degradedUnavailableStateHandling: RuntimeAdapterLiveReadinessDegradedUnavailableHandling;
  auditReceipts: RuntimeAdapterLiveReadinessAuditReceipt[];
  noExecutionPolicy: RuntimeAdapterLiveReadinessNoExecutionPolicy;
  readOnlyDesignBoundary: true;
  liveExternalExecutorBlocked: true;
  nextLiveGatesBlockedUntil: RuntimeAdapterLiveReadinessNoExecutionPolicy['nextLiveGatesBlockedUntil'];
};

const SUBGATES: RuntimeAdapterLiveReadinessSubgateName[] = [
  'capability-snapshot-normalizer',
  'read-only-adapter-interface',
  'event-bridge-read-only-contract',
  'dashboard-live-assimilation-projection',
  'capability-import-classification',
  'degraded-unavailable-state-handling',
  'audit-receipt-model',
  'no-execution-policy-invariants',
];

function normalizeId(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function publicId(idPrefix: string, kind: string, seed: string, index: number): string {
  return `${idPrefix}:${kind}-${index + 1}-${normalizeId(seed, kind)}`;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function classifyCapability(
  capability: RuntimeAdapterLiveReadinessCapabilitySource,
): RuntimeAdapterLiveReadinessImportClassification {
  if (capability.availability === 'unavailable') {
    return 'unavailable';
  }
  if (capability.risk === 'danger' || capability.trustState === 'quarantined') {
    return 'blocked';
  }
  if (capability.availability === 'degraded') {
    return 'degraded';
  }
  if (capability.requiresApprovalHint || capability.risk === 'attention' || capability.risk === 'unknown') {
    return 'approval-required';
  }
  return 'inventory-only';
}

function policyForClassification(
  classification: RuntimeAdapterLiveReadinessImportClassification,
): 'allowed' | 'approval-required' | 'blocked' {
  if (classification === 'inventory-only') {
    return 'allowed';
  }
  if (classification === 'approval-required' || classification === 'degraded') {
    return 'approval-required';
  }
  return 'blocked';
}

function classificationReason(classification: RuntimeAdapterLiveReadinessImportClassification): string {
  switch (classification) {
    case 'inventory-only':
      return 'safe-read-only-capability-inventory';
    case 'approval-required':
      return 'attention-risk-or-explicit-approval-required';
    case 'blocked':
      return 'dangerous-or-quarantined-capability';
    case 'degraded':
      return 'source-reported-degraded-state-preserved';
    case 'unavailable':
      return 'source-reported-unavailable-state-preserved';
  }
}

function dashboardStatus(
  classification: RuntimeAdapterLiveReadinessImportClassification,
): RuntimeAdapterLiveReadinessDashboardRow['status'] {
  if (classification === 'inventory-only') {
    return 'ready';
  }
  if (classification === 'approval-required') {
    return 'approval-required';
  }
  return classification;
}

function buildToolExposurePolicyInput(
  rows: RuntimeAdapterLiveReadinessCapabilityInventoryRow[],
): ToolExposurePolicyContractInput {
  return {
    requestedTools: uniqueStrings(rows.flatMap((row) => row.toolNames)),
    allowedTools: uniqueStrings(rows.filter((row) => row.policy === 'allowed').flatMap((row) => row.toolNames)),
    requireApprovalFor: uniqueStrings(rows.filter((row) => row.policy === 'approval-required').flatMap((row) => row.toolNames)),
    blockedTools: uniqueStrings(rows.filter((row) => row.policy === 'blocked').flatMap((row) => row.toolNames)),
    blockedToolReason: 'blocked-by-live-readiness-assimilation-pack',
  };
}

function buildHealth<TRuntimeId extends string>(
  options: RuntimeAdapterLiveReadinessAssimilationPackOptions<TRuntimeId>,
): RuntimeAdapterHealthSnapshot {
  const capabilities = options.source.capabilities.reduce<RuntimeAdapterHealthSnapshot['capabilities']>((summary, capability) => {
    summary.total += 1;
    summary[capability.trustState] += 1;
    return summary;
  }, {
    total: 0,
    trusted: 0,
    safe: 0,
    quarantined: 0,
  });

  return {
    runtimeId: options.runtimeId,
    status: options.source.healthStatus,
    generatedAt: options.generatedAt,
    capabilities,
    channels: [
      {
        id: `${options.idPrefix}:channel-readiness`,
        label: 'Zavorth live readiness channel projection',
        channel: 'api',
        status: options.source.capabilities.some((capability) => capability.rowKind === 'channel-capabilities' && capability.availability === 'degraded')
          ? 'degraded'
          : 'available',
        inbound: true,
        outbound: false,
        replyBoundary: 'zavorth-reply-port-only',
      },
    ],
    diagnostics: {
      notes: ['live-readiness-assimilation-pack', 'simulated-external-executor-output-only', 'no-live-call'],
    },
  };
}

function buildInventoryRows<TRuntimeId extends string>(
  options: RuntimeAdapterLiveReadinessAssimilationPackOptions<TRuntimeId>,
): RuntimeAdapterLiveReadinessCapabilityInventoryRow[] {
  return options.source.capabilities.map((capability, index) => {
    const id = publicId(options.idPrefix, 'capability', capability.publicSourceIdSeed, index);
    const importClassification = classifyCapability(capability);
    const policy = policyForClassification(importClassification);

    return {
      nativeContract: 'ZavorthRuntimeAdapterCapabilityInventoryRow/v1',
      id,
      label: capability.label,
      rowKind: capability.rowKind,
      kind: capability.kind,
      risk: capability.risk,
      trustState: capability.trustState,
      availability: capability.availability,
      importClassification,
      policy,
      toolNames: uniqueStrings(capability.toolNames),
      executionAuthority: false,
      sourceIdsEvidenceOnly: true,
      sourceModuleCopied: false,
      sourceHandlerLoaded: false,
      providerSdkLoaded: false,
      sessionImportAuthorized: false,
      sourceEvidence: {
        evidenceId: `${id}:source-evidence`,
        sourceRuntimeName: options.source.sourceRuntimeName,
        sourceRowKind: capability.rowKind,
        sourceIdStoredAsEvidenceOnly: true,
        sourceHintsStoredAsEvidenceOnly: true,
        sourceHints: capability.evidenceHints,
      },
    };
  });
}

function buildSnapshot(
  idPrefix: string,
  rows: RuntimeAdapterLiveReadinessCapabilityInventoryRow[],
): RuntimeAdapterLiveReadinessCapabilitySnapshot {
  return {
    nativeContract: 'ZavorthRuntimeAdapterCapabilitySnapshotNormalizer/v1',
    id: `${idPrefix}:capability-snapshot-normalizer`,
    inventory: rows,
    toolExposurePolicyInput: buildToolExposurePolicyInput(rows),
    sourceSnapshotStoredAsEvidenceOnly: true,
    executionAuthority: false,
    sourceModuleCopied: false,
    realCapabilityImported: false,
  };
}

function buildReadOnlyAdapterInterface(idPrefix: string): RuntimeAdapterLiveReadinessReadOnlyAdapterInterface {
  return {
    nativeContract: 'ZavorthRuntimeAdapterReadOnlyAdapterInterface/v1',
    id: `${idPrefix}:read-only-adapter-interface`,
    readOnly: true,
    adapterRealCreated: false,
    sourceRuntimeConnected: false,
    startGatewayAllowed: false,
    connectHttpAllowed: false,
    connectWebSocketAllowed: false,
    actionDispatchAllowed: false,
    providerExecutionAllowed: false,
    commandExecutionAllowed: false,
    sessionImportAllowed: false,
    methods: [
      'getHealthSnapshot',
      'listCapabilitySnapshot',
      'pullReadOnlyEvents',
      'getAuditReceipts',
    ].map((name) => ({
      name: name as RuntimeAdapterLiveReadinessExecutionMethod['name'],
      readOnly: true,
      mutatesSource: false,
      liveTransportRequired: false,
      executionAuthority: false,
    })),
  };
}

function buildEventBridge<TRuntimeId extends string>(
  options: RuntimeAdapterLiveReadinessAssimilationPackOptions<TRuntimeId>,
): RuntimeAdapterLiveReadinessEventBridge {
  const envelopes = options.source.events.map((event, index): RuntimeAdapterLiveReadinessEventBridgeEnvelope => {
    const id = publicId(options.idPrefix, 'event', event.publicEventIdSeed, index);
    const eventEnvelope: RuntimeAdapterEventEnvelope = {
      id,
      runtimeId: options.runtimeId,
      sessionId: `live-readiness-session-${normalizeId(event.sessionId, 'session')}`,
      kind: 'capability-event',
      occurredAt: event.occurredAt,
      actor: {
        id: 'zavorth-live-readiness-fixture',
        role: 'system',
      },
      payload: {
        channel: event.channel,
        rawType: event.rowKind,
        text: event.text,
        data: {
          status: event.status,
          readOnly: true,
          sourceIdsEvidenceOnly: true,
        },
      },
    };

    return {
      nativeContract: 'ZavorthRuntimeAdapterLiveReadinessEventBridgeEnvelope/v1',
      id,
      eventEnvelope,
      sourceEventStoredAsEvidenceOnly: true,
      producesEnvelope: true,
      dispatchPerformed: false,
      liveStreamConnected: false,
      websocketConnected: false,
      httpConnected: false,
      noSecondEventBus: true,
    };
  });

  return {
    nativeContract: 'ZavorthRuntimeAdapterLiveReadinessEventBridge/v1',
    envelopes,
    readOnly: true,
    producesEnvelopes: true,
    dispatchPerformed: false,
    liveEventStreamConnected: false,
    noSecondEventBus: true,
  };
}

function buildDashboardProjection(
  idPrefix: string,
  rows: RuntimeAdapterLiveReadinessCapabilityInventoryRow[],
): RuntimeAdapterLiveReadinessDashboardProjection {
  const dashboardRows = rows.map((row, index): RuntimeAdapterLiveReadinessDashboardRow => ({
    nativeContract: 'ZavorthRuntimeAdapterDashboardLiveAssimilationRow/v1',
    id: `${idPrefix}:dashboard-${index + 1}-${normalizeId(row.rowKind, 'row')}`,
    label: `Zavorth ${row.rowKind} ${dashboardStatus(row.importClassification)}`,
    rowKind: row.rowKind,
    status: dashboardStatus(row.importClassification),
    zavorthTerm: 'Zavorth capability inventory projection',
    readOnly: true,
    usesZavorthTerms: true,
    sourceIdStoredAsEvidenceOnly: true,
    executionAuthority: false,
    executableControlExposed: false,
    providerExecutionControlExposed: false,
    commandExecutionControlExposed: false,
    sessionImportControlExposed: false,
  }));

  return {
    nativeContract: 'ZavorthRuntimeAdapterDashboardLiveAssimilationProjection/v1',
    id: `${idPrefix}:dashboard-live-assimilation`,
    readOnly: true,
    usesZavorthTerms: true,
    rows: dashboardRows,
    executableControlsExposed: false,
    providerExecutionControlsExposed: false,
    commandExecutionControlsExposed: false,
    sessionImportControlsExposed: false,
  };
}

function buildCapabilityImportClassification(
  rows: RuntimeAdapterLiveReadinessCapabilityInventoryRow[],
): RuntimeAdapterLiveReadinessClassification {
  return {
    nativeContract: 'ZavorthRuntimeAdapterCapabilityImportClassification/v1',
    rows: rows.map((row) => ({
      id: `${row.id}:classification`,
      capabilityId: row.id,
      rowKind: row.rowKind,
      classification: row.importClassification,
      policy: row.policy,
      reason: classificationReason(row.importClassification),
      executionAuthority: false,
      sourceIdsEvidenceOnly: true,
    })),
    dangerousCapabilitiesBlockedOrApprovalGated: true,
    sourceIdsEvidenceOnly: true,
    importAuthorized: false,
  };
}

function buildDegradedUnavailableHandling(
  rows: RuntimeAdapterLiveReadinessCapabilityInventoryRow[],
): RuntimeAdapterLiveReadinessDegradedUnavailableHandling {
  return {
    nativeContract: 'ZavorthRuntimeAdapterDegradedUnavailableStateHandling/v1',
    degradedRows: rows.filter((row) => row.availability === 'degraded').map((row) => row.id),
    unavailableRows: rows.filter((row) => row.availability === 'unavailable').map((row) => row.id),
    preservedHonestly: true,
    unavailableNotPromotedToReady: true,
    degradedNotSilentlyIgnored: true,
  };
}

function buildAuditReceipts(idPrefix: string): RuntimeAdapterLiveReadinessAuditReceipt[] {
  return SUBGATES.map((subgate, index) => ({
    nativeContract: 'ZavorthRuntimeAdapterLiveReadinessAuditReceipt/v1',
    id: `${idPrefix}:audit-${index + 1}-${subgate}`,
    subgate,
    status: 'ready',
    rawSecretObserved: false,
    rawSecretSerialized: false,
    redacted: true,
    sourceEvidenceOnly: true,
    executionAuthority: false,
  }));
}

export function createRuntimeAdapterLiveReadinessNoExecutionPolicy(): RuntimeAdapterLiveReadinessNoExecutionPolicy {
  return {
    externalExecutorLiveCalled: false,
    secretResolved: false,
    tokenRead: false,
    gatewayStarted: false,
    websocketConnected: false,
    httpConnected: false,
    liveEventStreamConnected: false,
    toolExecuted: false,
    providerExecuted: false,
    commandExecuted: false,
    actionDispatched: false,
    sessionImported: false,
    configMigrated: false,
    stateMigrated: false,
    sourceModulesCopied: false,
    realAdapterCreated: false,
    nativeReplacementAuthorized: false,
    executionAuthority: false,
    sourceIdsEvidenceOnly: true,
    nextLiveGatesBlockedUntil: {
      secretProvisioning: 'secret-present-redacted',
      authenticatedHealth: 'authenticated-health-ok',
    },
  };
}

export function createRuntimeAdapterLiveReadinessAssimilationPackFixtureSource(): RuntimeAdapterLiveReadinessSnapshotSource {
  return {
    sourceRuntimeName: 'ExternalExecutor',
    sourceRuntimeVersion: 'fixture-only',
    gatewayMode: 'read-only-simulated',
    healthStatus: 'degraded',
    capabilities: [
      {
        rowKind: 'plugin-capabilities',
        publicSourceIdSeed: 'plugin-safe-status',
        label: 'Plugin status metadata',
        kind: 'tool',
        risk: 'safe',
        trustState: 'safe',
        availability: 'available',
        sourceReportedState: 'enabled-read-only',
        toolNames: ['plugin.status.read'],
        evidenceHints: ['source-plugin-id:status'],
      },
      {
        rowKind: 'provider-capabilities',
        publicSourceIdSeed: 'provider-embeddings-unavailable',
        label: 'Provider embeddings metadata',
        kind: 'skill',
        risk: 'attention',
        trustState: 'safe',
        availability: 'unavailable',
        sourceReportedState: 'missing-secret',
        toolNames: ['provider.embedding.snapshot'],
        evidenceHints: ['source-provider-family:embeddings'],
      },
      {
        rowKind: 'channel-capabilities',
        publicSourceIdSeed: 'channel-telegram-degraded',
        label: 'Channel Telegram availability',
        kind: 'channel',
        risk: 'attention',
        trustState: 'safe',
        availability: 'degraded',
        sourceReportedState: 'configured-but-offline',
        toolNames: ['channel.telegram.inspect'],
        evidenceHints: ['source-channel-family:telegram'],
      },
      {
        rowKind: 'command-http-capabilities',
        publicSourceIdSeed: 'command-danger-shell',
        label: 'Command shell execution metadata',
        kind: 'tool',
        risk: 'danger',
        trustState: 'quarantined',
        availability: 'available',
        sourceReportedState: 'dangerous-command',
        toolNames: ['shell.exec'],
        evidenceHints: ['source-command-id:shell.exec'],
      },
      {
        rowKind: 'gateway-method-capabilities',
        publicSourceIdSeed: 'gateway-rpc-attention',
        label: 'Gateway method metadata',
        kind: 'mcp',
        risk: 'attention',
        trustState: 'safe',
        availability: 'available',
        requiresApprovalHint: true,
        sourceReportedState: 'rpc-read-only-method',
        toolNames: ['gateway.rpc.read'],
        evidenceHints: ['source-gateway-method:rpc.read'],
      },
      {
        rowKind: 'worker-node-capabilities',
        publicSourceIdSeed: 'worker-node-offline',
        label: 'Worker node status',
        kind: 'worker',
        risk: 'unknown',
        trustState: 'safe',
        availability: 'unavailable',
        sourceReportedState: 'offline',
        toolNames: ['worker.node.inspect'],
        evidenceHints: ['source-worker-id:node-1'],
      },
      {
        rowKind: 'session-history-capabilities',
        publicSourceIdSeed: 'session-history-read-model',
        label: 'Session history availability',
        kind: 'session',
        risk: 'attention',
        trustState: 'safe',
        availability: 'available',
        requiresApprovalHint: true,
        sourceReportedState: 'history-present',
        toolNames: ['session.history.snapshot'],
        evidenceHints: ['source-session-cursor:history'],
      },
    ],
    events: [
      {
        publicEventIdSeed: 'capability-snapshot-observed',
        rowKind: 'plugin-capabilities',
        sessionId: 'readiness-snapshot',
        channel: 'api',
        occurredAt: RUNTIME_ADAPTER_LIVE_READINESS_ASSIMILATION_PACK_NOW,
        status: 'available',
        text: 'Simulated capability snapshot observed by Zavorth readiness pack.',
      },
      {
        publicEventIdSeed: 'channel-degraded-observed',
        rowKind: 'channel-capabilities',
        sessionId: 'readiness-snapshot',
        channel: 'api',
        occurredAt: RUNTIME_ADAPTER_LIVE_READINESS_ASSIMILATION_PACK_NOW,
        status: 'degraded',
        text: 'Simulated degraded channel preserved as Zavorth metadata.',
      },
    ],
  };
}

export function normalizeRuntimeAdapterLiveReadinessAssimilationPack<TRuntimeId extends string>(
  options: RuntimeAdapterLiveReadinessAssimilationPackOptions<TRuntimeId>,
): RuntimeAdapterLiveReadinessAssimilationPackNormalization<TRuntimeId> {
  const inventoryRows = buildInventoryRows(options);
  const health = buildHealth(options);
  const snapshot = buildSnapshot(options.idPrefix, inventoryRows);
  const adapterInterface = buildReadOnlyAdapterInterface(options.idPrefix);
  const eventBridge = buildEventBridge(options);
  const dashboardProjection = buildDashboardProjection(options.idPrefix, inventoryRows);
  const capabilityImportClassification = buildCapabilityImportClassification(inventoryRows);
  const degradedUnavailableStateHandling = buildDegradedUnavailableHandling(inventoryRows);
  const auditReceipts = buildAuditReceipts(options.idPrefix);
  const subgates = SUBGATES.map((name): RuntimeAdapterLiveReadinessSubgate => ({
    name,
    ready: true,
    liveCallRequired: false,
    executionAuthority: false,
  }));

  return {
    nativeContract: 'ZavorthRuntimeAdapterLiveReadinessAssimilationPack/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    subgates,
    health,
    snapshot,
    adapterInterface,
    eventBridge,
    dashboardProjection,
    capabilityImportClassification,
    degradedUnavailableStateHandling,
    auditReceipts,
    noExecutionPolicy: options.executionPolicy,
    readOnlyDesignBoundary: true,
    liveExternalExecutorBlocked: true,
    nextLiveGatesBlockedUntil: options.executionPolicy.nextLiveGatesBlockedUntil,
  };
}

export function normalizeRuntimeAdapterLiveReadinessAssimilationPackFixture(): RuntimeAdapterLiveReadinessAssimilationPackNormalization<typeof RUNTIME_ADAPTER_LIVE_READINESS_ASSIMILATION_PACK_RUNTIME_ID> {
  return normalizeRuntimeAdapterLiveReadinessAssimilationPack({
    source: createRuntimeAdapterLiveReadinessAssimilationPackFixtureSource(),
    generatedAt: RUNTIME_ADAPTER_LIVE_READINESS_ASSIMILATION_PACK_NOW,
    runtimeId: RUNTIME_ADAPTER_LIVE_READINESS_ASSIMILATION_PACK_RUNTIME_ID,
    idPrefix: 'zavorth-live-readiness',
    executionPolicy: createRuntimeAdapterLiveReadinessNoExecutionPolicy(),
  });
}
