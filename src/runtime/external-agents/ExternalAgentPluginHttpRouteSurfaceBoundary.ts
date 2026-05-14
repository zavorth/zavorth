import type {
  ToolExposurePolicyInput,
} from '../agent/ToolExposurePolicy.js';
import type {
  UniversalToolRiskLevel,
} from '../agent/UniversalAgentRuntimeTypes.js';

export type ExternalAgentPluginHttpRouteKind =
  | 'read'
  | 'mutation';

export type ExternalAgentPluginHttpMethod =
  | 'GET'
  | 'POST'
  | 'DELETE';

export type ExternalAgentPluginHttpRouteFixtureCase =
  | 'http-route-metadata'
  | 'http-route-registration-blocked';

export type ExternalAgentPluginHttpRouteExecutionGate = {
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

export type ExternalAgentPluginHttpRouteSurfaceSourceRecord = {
  fixtureCase: ExternalAgentPluginHttpRouteFixtureCase;
  publicRouteIdSeed: string;
  sourceHttpMethod: ExternalAgentPluginHttpMethod;
  kind: ExternalAgentPluginHttpRouteKind;
  risk: UniversalToolRiskLevel;
  requestedTools: string[];
};

export type ExternalAgentZavorthHttpRouteSurface = {
  id: string;
  label: string;
  kind: ExternalAgentPluginHttpRouteKind;
  httpMethod: ExternalAgentPluginHttpMethod;
  routePatternId: string;
  serviceRouteHintId: string;
  risk: UniversalToolRiskLevel;
  requestedTools: string[];
  routePolicy: {
    registry: 'zavorth-route-registry';
    sourceHttpRouteRegistrationAllowed: false;
    sourceRoutePathStoredAsEvidenceOnly: true;
    sourceAuthScopeAuthority: false;
  };
  sourceRoutePathStoredAsEvidenceOnly: true;
  sourceHttpMethodStoredAsEvidenceOnly: true;
  sourceServiceRouteHintStoredAsEvidenceOnly: true;
  sourceAuthScopeHintStoredAsEvidenceOnly: true;
  sourceRouteHandlerReferenceStoredAsEvidenceOnly: true;
  sourceHttpRouteRegistrationAllowed: false;
  sourceHttpRouteRegistered: false;
  nativeContract: 'ZavorthHttpRouteSurface/v1';
};

export type ExternalAgentHttpRouteCatalogRow = {
  id: string;
  routeId: string;
  label: string;
  status: 'available' | 'blocked';
  policy: 'metadata-only' | 'blocked';
};

export type ExternalAgentPluginHttpRouteSurfaceBoundaryOptions<TRuntimeId extends string = string> = {
  records: ExternalAgentPluginHttpRouteSurfaceSourceRecord[];
  generatedAt: string;
  runtimeId: TRuntimeId;
  idPrefix: string;
  executionGate: ExternalAgentPluginHttpRouteExecutionGate;
};

export type ExternalAgentPluginHttpRouteSurfaceBoundaryNormalization<TRuntimeId extends string = string> = {
  nativeContract: 'ZavorthPluginHttpRouteSurfaceParity/v1';
  generatedAt: string;
  runtimeId: TRuntimeId;
  httpRoutes: ExternalAgentZavorthHttpRouteSurface[];
  routeRegistry: {
    routeRows: ExternalAgentHttpRouteCatalogRow[];
  };
  toolExposurePolicyInput: ToolExposurePolicyInput;
  sourceHttpRoutePathsStoredAsEvidenceOnly: true;
  sourceHttpMethodsStoredAsEvidenceOnly: true;
  sourceServiceRouteHintsStoredAsEvidenceOnly: true;
  sourceAuthScopeHintsStoredAsEvidenceOnly: true;
  sourceRouteHandlerReferencesStoredAsEvidenceOnly: true;
  sourceHttpRoutesRegistered: false;
  sourceHttpRouteAuthority: false;
  httpRouteRuntimeIntroduced: false;
  executionGate: ExternalAgentPluginHttpRouteExecutionGate;
};

function publicHttpRouteId(idPrefix: string, seed: string, index: number): string {
  return `${idPrefix}-${index + 1}-${seed}`;
}

function httpRouteLabel(index: number, fixtureCase: ExternalAgentPluginHttpRouteFixtureCase): string {
  if (fixtureCase === 'http-route-registration-blocked') {
    return `HTTP route surface ${index + 1} blocked`;
  }
  return `HTTP route surface ${index + 1}`;
}

function httpRouteStatus(risk: UniversalToolRiskLevel): ExternalAgentHttpRouteCatalogRow['status'] {
  return risk === 'danger' ? 'blocked' : 'available';
}

export function normalizeExternalAgentPluginHttpRouteSurfaces<TRuntimeId extends string>(
  options: ExternalAgentPluginHttpRouteSurfaceBoundaryOptions<TRuntimeId>,
): ExternalAgentPluginHttpRouteSurfaceBoundaryNormalization<TRuntimeId> {
  const httpRoutes = options.records.map((record, index): ExternalAgentZavorthHttpRouteSurface => ({
    id: publicHttpRouteId(options.idPrefix, record.publicRouteIdSeed, index),
    label: httpRouteLabel(index, record.fixtureCase),
    kind: record.kind,
    httpMethod: record.sourceHttpMethod,
    routePatternId: `route-pattern-${index + 1}`,
    serviceRouteHintId: `service-route-hint-${index + 1}`,
    risk: record.risk,
    requestedTools: record.requestedTools,
    routePolicy: {
      registry: 'zavorth-route-registry',
      sourceHttpRouteRegistrationAllowed: false,
      sourceRoutePathStoredAsEvidenceOnly: true,
      sourceAuthScopeAuthority: false,
    },
    sourceRoutePathStoredAsEvidenceOnly: true,
    sourceHttpMethodStoredAsEvidenceOnly: true,
    sourceServiceRouteHintStoredAsEvidenceOnly: true,
    sourceAuthScopeHintStoredAsEvidenceOnly: true,
    sourceRouteHandlerReferenceStoredAsEvidenceOnly: true,
    sourceHttpRouteRegistrationAllowed: false,
    sourceHttpRouteRegistered: false,
    nativeContract: 'ZavorthHttpRouteSurface/v1',
  }));
  const blockedTools = httpRoutes
    .filter((route) => route.risk === 'danger')
    .flatMap((route) => route.requestedTools);
  const allowedTools = httpRoutes
    .filter((route) => route.risk !== 'danger')
    .flatMap((route) => route.requestedTools);

  return {
    nativeContract: 'ZavorthPluginHttpRouteSurfaceParity/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    httpRoutes,
    routeRegistry: {
      routeRows: httpRoutes.map((route) => ({
        id: `${route.id}:route-row`,
        routeId: route.id,
        label: route.label,
        status: httpRouteStatus(route.risk),
        policy: route.risk === 'danger' ? 'blocked' : 'metadata-only',
      })),
    },
    toolExposurePolicyInput: {
      requestedTools: Array.from(new Set(httpRoutes.flatMap((route) => route.requestedTools))),
      allowedTools: Array.from(new Set(allowedTools)),
      blockedTools: Array.from(new Set(blockedTools)),
      blockedToolReason: 'source-http-route-registration-not-authorized',
    },
    sourceHttpRoutePathsStoredAsEvidenceOnly: true,
    sourceHttpMethodsStoredAsEvidenceOnly: true,
    sourceServiceRouteHintsStoredAsEvidenceOnly: true,
    sourceAuthScopeHintsStoredAsEvidenceOnly: true,
    sourceRouteHandlerReferencesStoredAsEvidenceOnly: true,
    sourceHttpRoutesRegistered: false,
    sourceHttpRouteAuthority: false,
    httpRouteRuntimeIntroduced: false,
    executionGate: options.executionGate,
  };
}
