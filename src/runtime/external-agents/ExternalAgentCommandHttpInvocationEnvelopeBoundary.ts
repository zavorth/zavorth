import type {
  UniversalToolRiskLevel,
} from '../agent/UniversalAgentRuntimeTypes.js';

export type ExternalAgentCommandHttpInvocationIntentKind =
  | 'command'
  | 'gateway-method'
  | 'http-route'
  | 'service-action';

export type ExternalAgentCommandHttpInvocationFixtureCase =
  | 'external-command-intent'
  | 'external-gateway-method-intent'
  | 'external-http-route-intent'
  | 'external-service-action-intent';

export type ExternalAgentCommandHttpInvocationBoundaryContract =
  | 'ZavorthCommandDescriptor/v1'
  | 'ZavorthGatewayMethodSurface/v1'
  | 'ZavorthHttpRouteSurface/v1'
  | 'ZavorthServiceSurface/v1';

export type ExternalAgentCommandHttpInvocationExecutionGate = {
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

export type ExternalAgentCommandHttpInvocationSourceRecord = {
  fixtureCase: ExternalAgentCommandHttpInvocationFixtureCase;
  intentKind: ExternalAgentCommandHttpInvocationIntentKind;
  publicInvocationIdSeed: string;
  sourceIntentId: string;
  targetBoundaryId: string;
  targetBoundaryContract: ExternalAgentCommandHttpInvocationBoundaryContract;
  sourceMetadataKeys: string[];
  risk: UniversalToolRiskLevel;
  requestedTools: string[];
};

export type ExternalAgentCommandHttpInvocationEnvelope = {
  id: string;
  label: string;
  intentKind: ExternalAgentCommandHttpInvocationIntentKind;
  target: {
    boundaryId: string;
    boundaryContract: ExternalAgentCommandHttpInvocationBoundaryContract;
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

export type ExternalAgentCommandHttpInvocationEnvelopeBoundaryOptions<TRuntimeId extends string = string> = {
  records: ExternalAgentCommandHttpInvocationSourceRecord[];
  generatedAt: string;
  runtimeId: TRuntimeId;
  idPrefix: string;
  executionGate: ExternalAgentCommandHttpInvocationExecutionGate;
};

export type ExternalAgentCommandHttpInvocationEnvelopeBoundaryNormalization<TRuntimeId extends string = string> = {
  nativeContract: 'ZavorthCommandHttpInvocationEnvelopeBoundary/v1';
  generatedAt: string;
  runtimeId: TRuntimeId;
  envelopes: ExternalAgentCommandHttpInvocationEnvelope[];
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
  executionGate: ExternalAgentCommandHttpInvocationExecutionGate;
};

function publicInvocationId(idPrefix: string, seed: string, index: number): string {
  return `${idPrefix}-${index + 1}-${seed}`;
}

function invocationLabel(index: number, intentKind: ExternalAgentCommandHttpInvocationIntentKind): string {
  return `Invocation envelope ${index + 1} ${intentKind}`;
}

export function normalizeExternalAgentCommandHttpInvocationEnvelopes<TRuntimeId extends string>(
  options: ExternalAgentCommandHttpInvocationEnvelopeBoundaryOptions<TRuntimeId>,
): ExternalAgentCommandHttpInvocationEnvelopeBoundaryNormalization<TRuntimeId> {
  const envelopes = options.records.map((record, index): ExternalAgentCommandHttpInvocationEnvelope => ({
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
