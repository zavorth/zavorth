import type {
  ToolExposurePolicyInput,
} from '../agent/ToolExposurePolicy.js';
import type {
  UniversalToolRiskLevel,
} from '../agent/UniversalAgentRuntimeTypes.js';

export type RuntimeAdapterPluginGatewayMethodKind =
  | 'session'
  | 'approval';

export type RuntimeAdapterPluginGatewayMethodFixtureCase =
  | 'gateway-method-metadata'
  | 'gateway-method-dispatch-blocked';

export type RuntimeAdapterPluginGatewayMethodExecutionGate = {
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

export type RuntimeAdapterPluginGatewayMethodSurfaceSourceRecord = {
  fixtureCase: RuntimeAdapterPluginGatewayMethodFixtureCase;
  publicGatewayMethodIdSeed: string;
  sourceRequestFields: string[];
  sourceResponseFields: string[];
  kind: RuntimeAdapterPluginGatewayMethodKind;
  risk: UniversalToolRiskLevel;
  requestedTools: string[];
};

export type RuntimeAdapterZavorthGatewayMethodSurface = {
  id: string;
  label: string;
  kind: RuntimeAdapterPluginGatewayMethodKind;
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

export type RuntimeAdapterGatewayMethodCatalogRow = {
  id: string;
  methodId: string;
  label: string;
  status: 'available' | 'blocked';
  policy: 'metadata-only' | 'blocked';
};

export type RuntimeAdapterPluginGatewayMethodSurfaceBoundaryOptions<TRuntimeId extends string = string> = {
  records: RuntimeAdapterPluginGatewayMethodSurfaceSourceRecord[];
  generatedAt: string;
  runtimeId: TRuntimeId;
  idPrefix: string;
  executionGate: RuntimeAdapterPluginGatewayMethodExecutionGate;
};

export type RuntimeAdapterPluginGatewayMethodSurfaceBoundaryNormalization<TRuntimeId extends string = string> = {
  nativeContract: 'ZavorthPluginGatewayMethodSurfaceConsistency/v1';
  generatedAt: string;
  runtimeId: TRuntimeId;
  gatewayMethods: RuntimeAdapterZavorthGatewayMethodSurface[];
  gateway: {
    methodRows: RuntimeAdapterGatewayMethodCatalogRow[];
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
  executionGate: RuntimeAdapterPluginGatewayMethodExecutionGate;
};

function publicGatewayMethodId(idPrefix: string, seed: string, index: number): string {
  return `${idPrefix}-${index + 1}-${seed}`;
}

function gatewayMethodLabel(index: number, fixtureCase: RuntimeAdapterPluginGatewayMethodFixtureCase): string {
  if (fixtureCase === 'gateway-method-dispatch-blocked') {
    return `Gateway method surface ${index + 1} blocked`;
  }
  return `Gateway method surface ${index + 1}`;
}

function gatewayMethodStatus(risk: UniversalToolRiskLevel): RuntimeAdapterGatewayMethodCatalogRow['status'] {
  return risk === 'danger' ? 'blocked' : 'available';
}

export function normalizeRuntimeAdapterPluginGatewayMethodSurfaces<TRuntimeId extends string>(
  options: RuntimeAdapterPluginGatewayMethodSurfaceBoundaryOptions<TRuntimeId>,
): RuntimeAdapterPluginGatewayMethodSurfaceBoundaryNormalization<TRuntimeId> {
  const gatewayMethods = options.records.map((record, index): RuntimeAdapterZavorthGatewayMethodSurface => ({
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
