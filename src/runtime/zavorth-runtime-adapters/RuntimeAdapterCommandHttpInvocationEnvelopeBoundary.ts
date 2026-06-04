import type {
  UniversalToolRiskLevel,
} from '../agent/UniversalAgentRuntimeTypes.js';

export type RuntimeAdapterCommandHttpInvocationIntentKind =
  | 'command'
  | 'gateway-method'
  | 'http-route'
  | 'service-action';

export type RuntimeAdapterCommandHttpInvocationFixtureCase =
  | 'external-command-intent'
  | 'external-gateway-method-intent'
  | 'external-http-route-intent'
  | 'external-service-action-intent';

export type RuntimeAdapterCommandHttpInvocationBoundaryContract =
  | 'ZavorthCommandDescriptor/v1'
  | 'ZavorthGatewayMethodSurface/v1'
  | 'ZavorthHttpRouteSurface/v1'
  | 'ZavorthServiceSurface/v1';

export type RuntimeAdapterCommandHttpInvocationExecutionGate = {
  sourceCommandsExecuted: false;
  sourceCliProcessesSpawned: false;
  sourceHttpRoutesRegistered: false;
  sourceGatewayMethodsDispatched: false;
  sourceServicesLaunched: false;
  sourceToolsExecuted: false;
  sourceSetupCommandsExecuted: false;
  sourceQaRunnersExecuted: false;
  sourceHandlerLoaded: false;
  sourceRuntimeConnected: false;
  sourceModulesCopied: false;
  sourceStateMigrated: false;
  sourceCredentialsMigrated: false;
  executionAuthority: false;
  realAdapterCreated: false;
};

export type RuntimeAdapterCommandHttpInvocationSourceRecord = {
  fixtureCase: RuntimeAdapterCommandHttpInvocationFixtureCase;
  intentKind: RuntimeAdapterCommandHttpInvocationIntentKind;
  publicInvocationIdSeed: string;
  sourceIntentId: string;
  targetBoundaryId: string;
  targetBoundaryContract: RuntimeAdapterCommandHttpInvocationBoundaryContract;
  sourceMetadataKeys: string[];
  risk: UniversalToolRiskLevel;
  requestedTools: string[];
};

export type RuntimeAdapterCommandHttpInvocationEnvelope = {
  id: string;
  label: string;
  intentKind: RuntimeAdapterCommandHttpInvocationIntentKind;
  target: {
    boundaryId: string;
    boundaryContract: RuntimeAdapterCommandHttpInvocationBoundaryContract;
    boundaryIdAuthority: 'zavorth-closed-boundary';
    sourceTargetStoredAsEvidenceOnly: true;
  };
  sourceEvidence: {
    evidenceId: string;
    sourceIntentIdStoredAsEvidenceOnly: true;
    sourceMetadataStoredAsEvidenceOnly: true;
  };
  metadata: Array<{
    id: string;
    sourceMetadataStoredAsEvidenceOnly: true;
  }>;
  risk: UniversalToolRiskLevel;
  requestedTools: string[];
  executionPolicy: {
    authority: 'zavorth-invocation-envelope';
    executionAuthority: false;
    sourceHandlerLoadAllowed: false;
    sourceRuntimeConnectionAllowed: false;
    sideEffectsAllowed: false;
  };
  sourceIdsStoredAsEvidenceOnly: true;
  sourceHandlerLoaded: false;
  sourceRuntimeConnected: false;
  sourceCommandExecuted: false;
  sourceCliProcessSpawned: false;
  sourceHttpRouteRegistered: false;
  sourceGatewayMethodDispatched: false;
  sourceServiceLaunched: false;
  sourceToolExecuted: false;
  executionAuthority: false;
  sideEffectsBlocked: true;
  nativeContract: 'ZavorthCommandHttpInvocationEnvelope/v1';
};

export type RuntimeAdapterCommandHttpInvocationEnvelopeBoundaryOptions<TRuntimeId extends string = string> = {
  records: RuntimeAdapterCommandHttpInvocationSourceRecord[];
  generatedAt: string;
  runtimeId: TRuntimeId;
  idPrefix: string;
  executionGate: RuntimeAdapterCommandHttpInvocationExecutionGate;
};

export type RuntimeAdapterCommandHttpInvocationEnvelopeBoundaryNormalization<TRuntimeId extends string = string> = {
  nativeContract: 'ZavorthCommandHttpInvocationEnvelopeBoundary/v1';
  generatedAt: string;
  runtimeId: TRuntimeId;
  envelopes: RuntimeAdapterCommandHttpInvocationEnvelope[];
  sourceIdsStoredAsEvidenceOnly: true;
  sourceHandlersLoaded: false;
  sourceRuntimeConnected: false;
  sourceCommandsExecuted: false;
  sourceCliProcessesSpawned: false;
  sourceHttpRoutesRegistered: false;
  sourceGatewayMethodsDispatched: false;
  sourceServicesLaunched: false;
  sourceToolsExecuted: false;
  executionAuthority: false;
  sideEffectsBlocked: true;
  executionGate: RuntimeAdapterCommandHttpInvocationExecutionGate;
};

function publicInvocationId(idPrefix: string, seed: string, index: number): string {
  return `${idPrefix}-${index + 1}-${seed}`;
}

function invocationLabel(index: number, intentKind: RuntimeAdapterCommandHttpInvocationIntentKind): string {
  return `Invocation envelope ${index + 1} ${intentKind}`;
}

export function normalizeRuntimeAdapterCommandHttpInvocationEnvelopes<TRuntimeId extends string>(
  options: RuntimeAdapterCommandHttpInvocationEnvelopeBoundaryOptions<TRuntimeId>,
): RuntimeAdapterCommandHttpInvocationEnvelopeBoundaryNormalization<TRuntimeId> {
  const envelopes = options.records.map((record, index): RuntimeAdapterCommandHttpInvocationEnvelope => ({
    id: publicInvocationId(options.idPrefix, record.publicInvocationIdSeed, index),
    label: invocationLabel(index, record.intentKind),
    intentKind: record.intentKind,
    target: {
      boundaryId: record.targetBoundaryId,
      boundaryContract: record.targetBoundaryContract,
      boundaryIdAuthority: 'zavorth-closed-boundary',
      sourceTargetStoredAsEvidenceOnly: true,
    },
    sourceEvidence: {
      evidenceId: `source-intent-evidence-${index + 1}`,
      sourceIntentIdStoredAsEvidenceOnly: true,
      sourceMetadataStoredAsEvidenceOnly: true,
    },
    metadata: record.sourceMetadataKeys.map((_, metadataIndex) => ({
      id: `metadata-${metadataIndex + 1}`,
      sourceMetadataStoredAsEvidenceOnly: true,
    })),
    risk: record.risk,
    requestedTools: record.requestedTools,
    executionPolicy: {
      authority: 'zavorth-invocation-envelope',
      executionAuthority: false,
      sourceHandlerLoadAllowed: false,
      sourceRuntimeConnectionAllowed: false,
      sideEffectsAllowed: false,
    },
    sourceIdsStoredAsEvidenceOnly: true,
    sourceHandlerLoaded: false,
    sourceRuntimeConnected: false,
    sourceCommandExecuted: false,
    sourceCliProcessSpawned: false,
    sourceHttpRouteRegistered: false,
    sourceGatewayMethodDispatched: false,
    sourceServiceLaunched: false,
    sourceToolExecuted: false,
    executionAuthority: false,
    sideEffectsBlocked: true,
    nativeContract: 'ZavorthCommandHttpInvocationEnvelope/v1',
  }));

  return {
    nativeContract: 'ZavorthCommandHttpInvocationEnvelopeBoundary/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    envelopes,
    sourceIdsStoredAsEvidenceOnly: true,
    sourceHandlersLoaded: false,
    sourceRuntimeConnected: false,
    sourceCommandsExecuted: false,
    sourceCliProcessesSpawned: false,
    sourceHttpRoutesRegistered: false,
    sourceGatewayMethodsDispatched: false,
    sourceServicesLaunched: false,
    sourceToolsExecuted: false,
    executionAuthority: false,
    sideEffectsBlocked: true,
    executionGate: options.executionGate,
  };
}
