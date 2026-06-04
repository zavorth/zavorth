import type {
  ToolExposurePolicyInput,
} from '../agent/ToolExposurePolicy.js';
import type {
  UniversalToolRiskLevel,
} from '../agent/UniversalAgentRuntimeTypes.js';

export type ExternalAgentPluginGatewayMethodKind =
  | 'session'
  | 'approval';

export type ExternalAgentPluginGatewayMethodFixtureCase =
  | 'gateway-method-metadata'
  | 'gateway-method-dispatch-blocked';

export type ExternalAgentPluginGatewayMethodExecutionGate = {
  sourceCommandsExecuted: false;
  sourceCliProcessesSpawned: false;
  sourceHttpRoutesRegistered: false;
  sourceGatewayMethodsDispatched: false;
  sourceServicesLaunched: false;
  sourceSetupCommandsExecuted: false;
  sourceQaRunnersExecuted: false;
  sourceModulesCopied: false;
  sourceStateMigrated: false;
  sourceCredentialsMigrated: false;
  liveSourceRuntimeConnected: false;
  realAdapterCreated: false;
};

export type ExternalAgentPluginGatewayMethodSurfaceSourceRecord = {
  fixtureCase: ExternalAgentPluginGatewayMethodFixtureCase;
  publicGatewayMethodIdSeed: string;
  sourceRequestFields: string[];
  sourceResponseFields: string[];
  kind: ExternalAgentPluginGatewayMethodKind;
  risk: UniversalToolRiskLevel;
  requestedTools: string[];
};

export type ExternalAgentZavorthGatewayMethodSurface = {
  id: string;
  label: string;
  kind: ExternalAgentPluginGatewayMethodKind;
  requestShape: Array<{
    id: string;
    required: boolean;
    sourceFieldStoredAsEvidenceOnly: true;
  }>;
  responseShape: Array<{
    id: string;
    sourceFieldStoredAsEvidenceOnly: true;
  }>;
  risk: UniversalToolRiskLevel;
  requestedTools: string[];
  requestPolicy: {
    gateway: 'zavorth-agent-gateway';
    sourceMethodDispatchAllowed: false;
    sourceMethodStoredAsEvidenceOnly: true;
    sourceAuthScopeAuthority: false;
  };
  sourceGatewayMethodStoredAsEvidenceOnly: true;
  sourceRequestShapeStoredAsEvidenceOnly: true;
  sourceResponseShapeStoredAsEvidenceOnly: true;
  sourceAuthScopeHintStoredAsEvidenceOnly: true;
  sourceDispatchReferenceStoredAsEvidenceOnly: true;
  sourceGatewayMethodDispatchAllowed: false;
  sourceGatewayMethodDispatched: false;
  nativeContract: 'ZavorthGatewayMethodSurface/v1';
};

export type ExternalAgentGatewayMethodCatalogRow = {
  id: string;
  methodId: string;
  label: string;
  status: 'available' | 'blocked';
  policy: 'metadata-only' | 'blocked';
};

export type ExternalAgentPluginGatewayMethodSurfaceBoundaryOptions<TRuntimeId extends string = string> = {
  records: ExternalAgentPluginGatewayMethodSurfaceSourceRecord[];
  generatedAt: string;
  runtimeId: TRuntimeId;
  idPrefix: string;
  executionGate: ExternalAgentPluginGatewayMethodExecutionGate;
};

export type ExternalAgentPluginGatewayMethodSurfaceBoundaryNormalization<TRuntimeId extends string = string> = {
  nativeContract: 'ZavorthPluginGatewayMethodSurfaceConsistency/v1';
  generatedAt: string;
  runtimeId: TRuntimeId;
  gatewayMethods: ExternalAgentZavorthGatewayMethodSurface[];
  gateway: {
    methodRows: ExternalAgentGatewayMethodCatalogRow[];
  };
  toolExposurePolicyInput: ToolExposurePolicyInput;
  sourceGatewayMethodNamesStoredAsEvidenceOnly: true;
  sourceRequestShapesStoredAsEvidenceOnly: true;
  sourceResponseShapesStoredAsEvidenceOnly: true;
  sourceAuthScopeHintsStoredAsEvidenceOnly: true;
  sourceDispatchReferencesStoredAsEvidenceOnly: true;
  sourceGatewayMethodsDispatched: false;
  sourceGatewayMethodAuthority: false;
  gatewayMethodRuntimeIntroduced: false;
  executionGate: ExternalAgentPluginGatewayMethodExecutionGate;
};

function publicGatewayMethodId(idPrefix: string, seed: string, index: number): string {
  return `${idPrefix}-${index + 1}-${seed}`;
}

function gatewayMethodLabel(index: number, fixtureCase: ExternalAgentPluginGatewayMethodFixtureCase): string {
  if (fixtureCase === 'gateway-method-dispatch-blocked') {
    return `Gateway method surface ${index + 1} blocked`;
  }
  return `Gateway method surface ${index + 1}`;
}

function gatewayMethodStatus(risk: UniversalToolRiskLevel): ExternalAgentGatewayMethodCatalogRow['status'] {
  return risk === 'danger' ? 'blocked' : 'available';
}

export function normalizeExternalAgentPluginGatewayMethodSurfaces<TRuntimeId extends string>(
  options: ExternalAgentPluginGatewayMethodSurfaceBoundaryOptions<TRuntimeId>,
): ExternalAgentPluginGatewayMethodSurfaceBoundaryNormalization<TRuntimeId> {
  const gatewayMethods = options.records.map((record, index): ExternalAgentZavorthGatewayMethodSurface => ({
    id: publicGatewayMethodId(options.idPrefix, record.publicGatewayMethodIdSeed, index),
    label: gatewayMethodLabel(index, record.fixtureCase),
    kind: record.kind,
    requestShape: record.sourceRequestFields.map((field, fieldIndex) => ({
      id: `request-field-${fieldIndex + 1}`,
      required: !field.endsWith('?'),
      sourceFieldStoredAsEvidenceOnly: true,
    })),
    responseShape: record.sourceResponseFields.map((field, fieldIndex) => ({
      id: `response-field-${fieldIndex + 1}`,
      sourceFieldStoredAsEvidenceOnly: true,
    })),
    risk: record.risk,
    requestedTools: record.requestedTools,
    requestPolicy: {
      gateway: 'zavorth-agent-gateway',
      sourceMethodDispatchAllowed: false,
      sourceMethodStoredAsEvidenceOnly: true,
      sourceAuthScopeAuthority: false,
    },
    sourceGatewayMethodStoredAsEvidenceOnly: true,
    sourceRequestShapeStoredAsEvidenceOnly: true,
    sourceResponseShapeStoredAsEvidenceOnly: true,
    sourceAuthScopeHintStoredAsEvidenceOnly: true,
    sourceDispatchReferenceStoredAsEvidenceOnly: true,
    sourceGatewayMethodDispatchAllowed: false,
    sourceGatewayMethodDispatched: false,
    nativeContract: 'ZavorthGatewayMethodSurface/v1',
  }));
  const blockedTools = gatewayMethods
    .filter((method) => method.risk === 'danger')
    .flatMap((method) => method.requestedTools);
  const allowedTools = gatewayMethods
    .filter((method) => method.risk !== 'danger')
    .flatMap((method) => method.requestedTools);

  return {
    nativeContract: 'ZavorthPluginGatewayMethodSurfaceConsistency/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    gatewayMethods,
    gateway: {
      methodRows: gatewayMethods.map((method) => ({
        id: `${method.id}:gateway-row`,
        methodId: method.id,
        label: method.label,
        status: gatewayMethodStatus(method.risk),
        policy: method.risk === 'danger' ? 'blocked' : 'metadata-only',
      })),
    },
    toolExposurePolicyInput: {
      requestedTools: Array.from(new Set(gatewayMethods.flatMap((method) => method.requestedTools))),
      allowedTools: Array.from(new Set(allowedTools)),
      blockedTools: Array.from(new Set(blockedTools)),
      blockedToolReason: 'source-gateway-method-dispatch-not-authorized',
    },
    sourceGatewayMethodNamesStoredAsEvidenceOnly: true,
    sourceRequestShapesStoredAsEvidenceOnly: true,
    sourceResponseShapesStoredAsEvidenceOnly: true,
    sourceAuthScopeHintsStoredAsEvidenceOnly: true,
    sourceDispatchReferencesStoredAsEvidenceOnly: true,
    sourceGatewayMethodsDispatched: false,
    sourceGatewayMethodAuthority: false,
    gatewayMethodRuntimeIntroduced: false,
    executionGate: options.executionGate,
  };
}
