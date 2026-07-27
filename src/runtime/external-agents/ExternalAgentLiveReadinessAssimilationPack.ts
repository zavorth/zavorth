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
  ExternalAgentCapabilityKind,
  ExternalAgentEventEnvelope,
  ExternalAgentHealthSnapshot,
} from './contracts.js';

export const EXTERNAL_AGENT_LIVE_READINESS_ASSIMILATION_PACK_NOW = '2026-04-28T12:00:00.000Z' as const;
export const EXTERNAL_AGENT_LIVE_READINESS_ASSIMILATION_PACK_RUNTIME_ID = 'external-agent-live-readiness-external-executor-fixture' as const;

export type ExternalAgentLiveReadinessCapabilityRowKind =
  | 'channel-capabilities'
  | 'command-http-capabilities'
  | 'gateway-method-capabilities'
  | 'plugin-capabilities'
  | 'provider-capabilities'
  | 'session-history-capabilities'
  | 'worker-node-capabilities';

export type ExternalAgentLiveReadinessCapabilityAvailability =
  | 'available'
  | 'degraded'
  | 'unavailable';

export type ExternalAgentLiveReadinessImportClassification =
  | 'approval-required'
  | 'blocked'
  | 'degraded'
  | 'inventory-only'
  | 'unavailable';

export type ExternalAgentLiveReadinessSubgateName =
  | 'audit-receipt-model'
  | 'capability-import-classification'
  | 'capability-snapshot-normalizer'
  | 'zavorthControl-live-assimilation-projection'
  | 'degraded-unavailable-state-handling'
  | 'event-bridge-read-only-contract'
  | 'no-execution-policy-invariants'
  | 'read-only-adapter-interface';

export type ExternalAgentLiveReadinessNoExecutionPolicy = {
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

export type ExternalAgentLiveReadinessCapabilitySource = {
  availability: ExternalAgentLiveReadinessCapabilityAvailability;
  evidenceHints: string[];
  kind: ExternalAgentCapabilityKind;
  label: string;
  publicSourceIdSeed: string;
  requiresApprovalHint?: boolean;
  risk: UniversalToolRiskLevel;
  rowKind: ExternalAgentLiveReadinessCapabilityRowKind;
  sourceReportedState: string;
  toolNames: string[];
  trustState: ImportedCapabilityTrustState;
};

export type ExternalAgentLiveReadinessEventSource = {
  channel: UniversalAgentChannel;
  occurredAt: string;
  publicEventIdSeed: string;
  rowKind: ExternalAgentLiveReadinessCapabilityRowKind;
  sessionId: string;
  status: ExternalAgentLiveReadinessCapabilityAvailability;
  text: string;
};

export type ExternalAgentLiveReadinessSnapshotSource = {
  capabilities: ExternalAgentLiveReadinessCapabilitySource[];
  events: ExternalAgentLiveReadinessEventSource[];
  gatewayMode: 'read-only-preview';
  healthStatus: ExternalAgentHealthSnapshot['status'];
  sourceRuntimeName: string;
  sourceRuntimeVersion: string;
};

export type ExternalAgentLiveReadinessExecutionMethod = {
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

export type ExternalAgentLiveReadinessReadOnlyAdapterInterface = {
  nativeContract: 'ZavorthExternalAgentReadOnlyAdapterInterface/v1';
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
  methods: ExternalAgentLiveReadinessExecutionMethod[];
};

export type ExternalAgentLiveReadinessSourceEvidence = {
  evidenceId: string;
  sourceRuntimeName: string;
  sourceRowKind: ExternalAgentLiveReadinessCapabilityRowKind;
  sourceIdStoredAsEvidenceOnly: true;
  sourceHintsStoredAsEvidenceOnly: true;
  sourceHints: string[];
};

export type ExternalAgentLiveReadinessCapabilityInventoryRow = {
  nativeContract: 'ZavorthExternalAgentCapabilityInventoryRow/v1';
  id: string;
  label: string;
  rowKind: ExternalAgentLiveReadinessCapabilityRowKind;
  kind: ExternalAgentCapabilityKind;
  risk: UniversalToolRiskLevel;
  trustState: ImportedCapabilityTrustState;
  availability: ExternalAgentLiveReadinessCapabilityAvailability;
  importClassification: ExternalAgentLiveReadinessImportClassification;
  policy: 'allowed' | 'approval-required' | 'blocked';
  toolNames: string[];
  executionAuthority: false;
  sourceIdsEvidenceOnly: true;
  sourceModuleCopied: false;
  sourceHandlerLoaded: false;
  providerSdkLoaded: false;
  sessionImportAuthorized: false;
  sourceEvidence: ExternalAgentLiveReadinessSourceEvidence;
};

export type ExternalAgentLiveReadinessCapabilitySnapshot = {
  nativeContract: 'ZavorthExternalAgentCapabilitySnapshotNormalizer/v1';
  id: string;
  inventory: ExternalAgentLiveReadinessCapabilityInventoryRow[];
  toolExposurePolicyInput: ToolExposurePolicyContractInput;
  sourceSnapshotStoredAsEvidenceOnly: true;
  executionAuthority: false;
  sourceModuleCopied: false;
  realCapabilityImported: false;
};

export type ExternalAgentLiveReadinessEventBridgeEnvelope = {
  nativeContract: 'ZavorthExternalAgentLiveReadinessEventBridgeEnvelope/v1';
  id: string;
  eventEnvelope: ExternalAgentEventEnvelope;
  sourceEventStoredAsEvidenceOnly: true;
  producesEnvelope: true;
  dispatchPerformed: false;
  liveStreamConnected: false;
  websocketConnected: false;
  httpConnected: false;
  noSecondEventBus: true;
};

export type ExternalAgentLiveReadinessEventBridge = {
  nativeContract: 'ZavorthExternalAgentLiveReadinessEventBridge/v1';
  envelopes: ExternalAgentLiveReadinessEventBridgeEnvelope[];
  readOnly: true;
  producesEnvelopes: true;
  dispatchPerformed: false;
  liveEventStreamConnected: false;
  noSecondEventBus: true;
};

export type ExternalAgentLiveReadinessZavorthControlRow = {
  nativeContract: 'ZavorthExternalAgentZavorthControlLiveAssimilationRow/v1';
  id: string;
  label: string;
  rowKind: ExternalAgentLiveReadinessCapabilityRowKind;
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

export type ExternalAgentLiveReadinessZavorthControlProjection = {
  nativeContract: 'ZavorthExternalAgentZavorthControlLiveAssimilationProjection/v1';
  id: string;
  readOnly: true;
  usesZavorthTerms: true;
  rows: ExternalAgentLiveReadinessZavorthControlRow[];
  executableControlsExposed: false;
  providerExecutionControlsExposed: false;
  commandExecutionControlsExposed: false;
  sessionImportControlsExposed: false;
};

export type ExternalAgentLiveReadinessClassification = {
  nativeContract: 'ZavorthExternalAgentCapabilityImportClassification/v1';
  rows: Array<{
    id: string;
    capabilityId: string;
    rowKind: ExternalAgentLiveReadinessCapabilityRowKind;
    classification: ExternalAgentLiveReadinessImportClassification;
    policy: 'allowed' | 'approval-required' | 'blocked';
    reason: string;
    executionAuthority: false;
    sourceIdsEvidenceOnly: true;
  }>;
  dangerousCapabilitiesBlockedOrApprovalGated: true;
  sourceIdsEvidenceOnly: true;
  importAuthorized: false;
};

export type ExternalAgentLiveReadinessDegradedUnavailableHandling = {
  nativeContract: 'ZavorthExternalAgentDegradedUnavailableStateHandling/v1';
  degradedRows: string[];
  unavailableRows: string[];
  preservedHonestly: true;
  unavailableNotPromotedToReady: true;
  degradedNotSilentlyIgnored: true;
};

export type ExternalAgentLiveReadinessAuditReceipt = {
  nativeContract: 'ZavorthExternalAgentLiveReadinessAuditReceipt/v1';
  id: string;
  subgate: ExternalAgentLiveReadinessSubgateName;
  status: 'ready';
  rawSecretObserved: false;
  rawSecretSerialized: false;
  redacted: true;
  sourceEvidenceOnly: true;
  executionAuthority: false;
};

export type ExternalAgentLiveReadinessSubgate = {
  name: ExternalAgentLiveReadinessSubgateName;
  ready: true;
  liveCallRequired: false;
  executionAuthority: false;
};

export type ExternalAgentLiveReadinessAssimilationPackOptions<TRuntimeId extends string = string> = {
  executionPolicy: ExternalAgentLiveReadinessNoExecutionPolicy;
  generatedAt: string;
  idPrefix: string;
  runtimeId: TRuntimeId;
  source: ExternalAgentLiveReadinessSnapshotSource;
};

export type ExternalAgentLiveReadinessAssimilationPackNormalization<TRuntimeId extends string = string> = {
  nativeContract: 'ZavorthExternalAgentLiveReadinessAssimilationPack/v1';
  generatedAt: string;
  runtimeId: TRuntimeId;
  subgates: ExternalAgentLiveReadinessSubgate[];
  health: ExternalAgentHealthSnapshot;
  snapshot: ExternalAgentLiveReadinessCapabilitySnapshot;
  adapterInterface: ExternalAgentLiveReadinessReadOnlyAdapterInterface;
  eventBridge: ExternalAgentLiveReadinessEventBridge;
  zavorthControlProjection: ExternalAgentLiveReadinessZavorthControlProjection;
  capabilityImportClassification: ExternalAgentLiveReadinessClassification;
  degradedUnavailableStateHandling: ExternalAgentLiveReadinessDegradedUnavailableHandling;
  auditReceipts: ExternalAgentLiveReadinessAuditReceipt[];
  noExecutionPolicy: ExternalAgentLiveReadinessNoExecutionPolicy;
  readOnlyDesignBoundary: true;
  liveExternalExecutorBlocked: true;
  nextLiveGatesBlockedUntil: ExternalAgentLiveReadinessNoExecutionPolicy['nextLiveGatesBlockedUntil'];
};

const SUBGATES: ExternalAgentLiveReadinessSubgateName[] = [
  'capability-snapshot-normalizer',
  'read-only-adapter-interface',
  'event-bridge-read-only-contract',
  'zavorthControl-live-assimilation-projection',
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
  capability: ExternalAgentLiveReadinessCapabilitySource,
): ExternalAgentLiveReadinessImportClassification {
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
  classification: ExternalAgentLiveReadinessImportClassification,
): 'allowed' | 'approval-required' | 'blocked' {
  if (classification === 'inventory-only') {
    return 'allowed';
  }
  if (classification === 'approval-required' || classification === 'degraded') {
    return 'approval-required';
  }
  return 'blocked';
}

function classificationReason(classification: ExternalAgentLiveReadinessImportClassification): string {
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

function zavorthControlStatus(
  classification: ExternalAgentLiveReadinessImportClassification,
): ExternalAgentLiveReadinessZavorthControlRow['status'] {
  if (classification === 'inventory-only') {
    return 'ready';
  }
  if (classification === 'approval-required') {
    return 'approval-required';
  }
  return classification;
}

function buildToolExposurePolicyInput(
  rows: ExternalAgentLiveReadinessCapabilityInventoryRow[],
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
  options: ExternalAgentLiveReadinessAssimilationPackOptions<TRuntimeId>,
): ExternalAgentHealthSnapshot {
  const capabilities = options.source.capabilities.reduce<ExternalAgentHealthSnapshot['capabilities']>((summary, capability) => {
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
        status: options.source.capabilities.some((capability) => capability.rowKind === 'channel-capabilities' && capability.availability === 'degraded') ? 'degraded'
          : 'available',
        inbound: true,
        outbound: false,
        replyBoundary: 'zavorth-reply-port-only',
      },
    ],
    diagnostics: {
      notes: ['live-readiness-assimilation-pack', 'dry-run-external-executor-output-only', 'no-live-call'],
    },
  };
}

function buildInventoryRows<TRuntimeId extends string>(
  options: ExternalAgentLiveReadinessAssimilationPackOptions<TRuntimeId>,
): ExternalAgentLiveReadinessCapabilityInventoryRow[] {
  return options.source.capabilities.map((capability, index) => {
    const id = publicId(options.idPrefix, 'capability', capability.publicSourceIdSeed, index);
    const importClassification = classifyCapability(capability);
    const policy = policyForClassification(importClassification);

    return {
      nativeContract: 'ZavorthExternalAgentCapabilityInventoryRow/v1',
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
  rows: ExternalAgentLiveReadinessCapabilityInventoryRow[],
): ExternalAgentLiveReadinessCapabilitySnapshot {
  return {
    nativeContract: 'ZavorthExternalAgentCapabilitySnapshotNormalizer/v1',
    id: `${idPrefix}:capability-snapshot-normalizer`,
    inventory: rows,
    toolExposurePolicyInput: buildToolExposurePolicyInput(rows),
    sourceSnapshotStoredAsEvidenceOnly: true,
    executionAuthority: false,
    sourceModuleCopied: false,
    realCapabilityImported: false,
  };
}

function buildReadOnlyAdapterInterface(idPrefix: string): ExternalAgentLiveReadinessReadOnlyAdapterInterface {
  return {
    nativeContract: 'ZavorthExternalAgentReadOnlyAdapterInterface/v1',
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
      name: name as ExternalAgentLiveReadinessExecutionMethod['name'],
      readOnly: true,
      mutatesSource: false,
      liveTransportRequired: false,
      executionAuthority: false,
    })),
  };
}

function buildEventBridge<TRuntimeId extends string>(
  options: ExternalAgentLiveReadinessAssimilationPackOptions<TRuntimeId>,
): ExternalAgentLiveReadinessEventBridge {
  const envelopes = options.source.events.map((event, index): ExternalAgentLiveReadinessEventBridgeEnvelope => {
    const id = publicId(options.idPrefix, 'event', event.publicEventIdSeed, index);
    const eventEnvelope: ExternalAgentEventEnvelope = {
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
      nativeContract: 'ZavorthExternalAgentLiveReadinessEventBridgeEnvelope/v1',
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
    nativeContract: 'ZavorthExternalAgentLiveReadinessEventBridge/v1',
    envelopes,
    readOnly: true,
    producesEnvelopes: true,
    dispatchPerformed: false,
    liveEventStreamConnected: false,
    noSecondEventBus: true,
  };
}

function buildZavorthControlProjection(
  idPrefix: string,
  rows: ExternalAgentLiveReadinessCapabilityInventoryRow[],
): ExternalAgentLiveReadinessZavorthControlProjection {
  const zavorthControlRows = rows.map((row, index): ExternalAgentLiveReadinessZavorthControlRow => ({
    nativeContract: 'ZavorthExternalAgentZavorthControlLiveAssimilationRow/v1',
    id: `${idPrefix}:zavorthControl-${index + 1}-${normalizeId(row.rowKind, 'row')}`,
    label: `Zavorth ${row.rowKind} ${zavorthControlStatus(row.importClassification)}`,
    rowKind: row.rowKind,
    status: zavorthControlStatus(row.importClassification),
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
    nativeContract: 'ZavorthExternalAgentZavorthControlLiveAssimilationProjection/v1',
    id: `${idPrefix}:zavorthControl-live-assimilation`,
    readOnly: true,
    usesZavorthTerms: true,
    rows: zavorthControlRows,
    executableControlsExposed: false,
    providerExecutionControlsExposed: false,
    commandExecutionControlsExposed: false,
    sessionImportControlsExposed: false,
  };
}

function buildCapabilityImportClassification(
  rows: ExternalAgentLiveReadinessCapabilityInventoryRow[],
): ExternalAgentLiveReadinessClassification {
  return {
    nativeContract: 'ZavorthExternalAgentCapabilityImportClassification/v1',
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
  rows: ExternalAgentLiveReadinessCapabilityInventoryRow[],
): ExternalAgentLiveReadinessDegradedUnavailableHandling {
  return {
    nativeContract: 'ZavorthExternalAgentDegradedUnavailableStateHandling/v1',
    degradedRows: rows.filter((row) => row.availability === 'degraded').map((row) => row.id),
    unavailableRows: rows.filter((row) => row.availability === 'unavailable').map((row) => row.id),
    preservedHonestly: true,
    unavailableNotPromotedToReady: true,
    degradedNotSilentlyIgnored: true,
  };
}

function buildAuditReceipts(idPrefix: string): ExternalAgentLiveReadinessAuditReceipt[] {
  return SUBGATES.map((subgate, index) => ({
    nativeContract: 'ZavorthExternalAgentLiveReadinessAuditReceipt/v1',
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

export function createExternalAgentLiveReadinessNoExecutionPolicy(): ExternalAgentLiveReadinessNoExecutionPolicy {
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

export function createExternalAgentLiveReadinessAssimilationPackFixtureSource(): ExternalAgentLiveReadinessSnapshotSource {
  return {
    sourceRuntimeName: 'ExternalExecutor',
    sourceRuntimeVersion: 'fixture-only',
    gatewayMode: 'read-only-preview',
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
        occurredAt: EXTERNAL_AGENT_LIVE_READINESS_ASSIMILATION_PACK_NOW,
        status: 'available',
        text: 'Readiness preview snapshot observed by Zavorth readiness pack.',
      },
      {
        publicEventIdSeed: 'channel-degraded-observed',
        rowKind: 'channel-capabilities',
        sessionId: 'readiness-snapshot',
        channel: 'api',
        occurredAt: EXTERNAL_AGENT_LIVE_READINESS_ASSIMILATION_PACK_NOW,
        status: 'degraded',
        text: 'Readiness degraded channel preserved as Zavorth metadata.',
      },
    ],
  };
}

export function normalizeExternalAgentLiveReadinessAssimilationPack<TRuntimeId extends string>(
  options: ExternalAgentLiveReadinessAssimilationPackOptions<TRuntimeId>,
): ExternalAgentLiveReadinessAssimilationPackNormalization<TRuntimeId> {
  const inventoryRows = buildInventoryRows(options);
  const health = buildHealth(options);
  const snapshot = buildSnapshot(options.idPrefix, inventoryRows);
  const adapterInterface = buildReadOnlyAdapterInterface(options.idPrefix);
  const eventBridge = buildEventBridge(options);
  const zavorthControlProjection = buildZavorthControlProjection(options.idPrefix, inventoryRows);
  const capabilityImportClassification = buildCapabilityImportClassification(inventoryRows);
  const degradedUnavailableStateHandling = buildDegradedUnavailableHandling(inventoryRows);
  const auditReceipts = buildAuditReceipts(options.idPrefix);
  const subgates = SUBGATES.map((name): ExternalAgentLiveReadinessSubgate => ({
    name,
    ready: true,
    liveCallRequired: false,
    executionAuthority: false,
  }));

  return {
    nativeContract: 'ZavorthExternalAgentLiveReadinessAssimilationPack/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    subgates,
    health,
    snapshot,
    adapterInterface,
    eventBridge,
    zavorthControlProjection,
    capabilityImportClassification,
    degradedUnavailableStateHandling,
    auditReceipts,
    noExecutionPolicy: options.executionPolicy,
    readOnlyDesignBoundary: true,
    liveExternalExecutorBlocked: true,
    nextLiveGatesBlockedUntil: options.executionPolicy.nextLiveGatesBlockedUntil,
  };
}

export function normalizeExternalAgentLiveReadinessAssimilationPackFixture(): ExternalAgentLiveReadinessAssimilationPackNormalization<typeof EXTERNAL_AGENT_LIVE_READINESS_ASSIMILATION_PACK_RUNTIME_ID> {
  return normalizeExternalAgentLiveReadinessAssimilationPack({
    source: createExternalAgentLiveReadinessAssimilationPackFixtureSource(),
    generatedAt: EXTERNAL_AGENT_LIVE_READINESS_ASSIMILATION_PACK_NOW,
    runtimeId: EXTERNAL_AGENT_LIVE_READINESS_ASSIMILATION_PACK_RUNTIME_ID,
    idPrefix: 'zavorth-live-readiness',
    executionPolicy: createExternalAgentLiveReadinessNoExecutionPolicy(),
  });
}
