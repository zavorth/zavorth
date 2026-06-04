import type {
  ToolExposurePolicyInput,
} from '../agent/ToolExposurePolicy.js';
import type {
  UniversalToolRiskLevel,
} from '../agent/UniversalAgentRuntimeTypes.js';

export type ExternalAgentPluginServiceSurfaceKind =
  | 'background'
  | 'hook';

export type ExternalAgentPluginServiceSurfaceFixtureCase =
  | 'service-surface-descriptor'
  | 'service-launch-blocked';

export type ExternalAgentPluginServiceSurfaceExecutionGate = {
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

export type ExternalAgentPluginServiceSurfaceSourceRecord = {
  fixtureCase: ExternalAgentPluginServiceSurfaceFixtureCase;
  publicServiceIdSeed: string;
  sourceHooks: string[];
  sourceLifecycleHints: string[];
  kind: ExternalAgentPluginServiceSurfaceKind;
  risk: UniversalToolRiskLevel;
  requestedTools: string[];
};

export type ExternalAgentZavorthServiceSurface = {
  id: string;
  label: string;
  kind: ExternalAgentPluginServiceSurfaceKind;
  hooks: Array<{
    id: string;
    sourceHookStoredAsEvidenceOnly: true;
  }>;
  lifecycleHints: Array<{
    id: string;
    sourceLifecycleHintStoredAsEvidenceOnly: true;
  }>;
  activationHintId: string;
  risk: UniversalToolRiskLevel;
  requestedTools: string[];
  workerPolicy: {
    worker: 'zavorth-worker-policy';
    sourceServiceLaunchAllowed: false;
    sourceLifecycleMutationAllowed: false;
    sourceServiceStoredAsEvidenceOnly: true;
  };
  sourceServiceIdStoredAsEvidenceOnly: true;
  sourceHooksStoredAsEvidenceOnly: true;
  sourceLifecycleHintsStoredAsEvidenceOnly: true;
  sourceActivationHintStoredAsEvidenceOnly: true;
  sourceLifecycleReferenceStoredAsEvidenceOnly: true;
  sourceServiceLaunchAllowed: false;
  sourceServiceLaunched: false;
  sourceLifecycleMutated: false;
  nativeContract: 'ZavorthServiceSurface/v1';
};

export type ExternalAgentServiceCatalogRow = {
  id: string;
  serviceId: string;
  label: string;
  status: 'available' | 'blocked';
  policy: 'metadata-only' | 'blocked';
};

export type ExternalAgentPluginServiceSurfaceBoundaryOptions<TRuntimeId extends string = string> = {
  records: ExternalAgentPluginServiceSurfaceSourceRecord[];
  generatedAt: string;
  runtimeId: TRuntimeId;
  idPrefix: string;
  executionGate: ExternalAgentPluginServiceSurfaceExecutionGate;
};

export type ExternalAgentPluginServiceSurfaceBoundaryNormalization<TRuntimeId extends string = string> = {
  nativeContract: 'ZavorthPluginServiceSurfaceConsistency/v1';
  generatedAt: string;
  runtimeId: TRuntimeId;
  services: ExternalAgentZavorthServiceSurface[];
  serviceRegistry: {
    serviceRows: ExternalAgentServiceCatalogRow[];
  };
  toolExposurePolicyInput: ToolExposurePolicyInput;
  sourceServiceIdsStoredAsEvidenceOnly: true;
  sourceHooksStoredAsEvidenceOnly: true;
  sourceLifecycleHintsStoredAsEvidenceOnly: true;
  sourceActivationHintsStoredAsEvidenceOnly: true;
  sourceLifecycleReferencesStoredAsEvidenceOnly: true;
  sourceServicesLaunched: false;
  sourceServiceAuthority: false;
  serviceRuntimeIntroduced: false;
  executionGate: ExternalAgentPluginServiceSurfaceExecutionGate;
};

function publicServiceId(idPrefix: string, seed: string, index: number): string {
  return `${idPrefix}-${index + 1}-${seed}`;
}

function serviceLabel(index: number, fixtureCase: ExternalAgentPluginServiceSurfaceFixtureCase): string {
  if (fixtureCase === 'service-launch-blocked') {
    return `Service surface ${index + 1} blocked`;
  }
  return `Service surface ${index + 1}`;
}

function serviceStatus(risk: UniversalToolRiskLevel): ExternalAgentServiceCatalogRow['status'] {
  return risk === 'danger' ? 'blocked' : 'available';
}

export function normalizeExternalAgentPluginServiceSurfaces<TRuntimeId extends string>(
  options: ExternalAgentPluginServiceSurfaceBoundaryOptions<TRuntimeId>,
): ExternalAgentPluginServiceSurfaceBoundaryNormalization<TRuntimeId> {
  const services = options.records.map((record, index): ExternalAgentZavorthServiceSurface => ({
    id: publicServiceId(options.idPrefix, record.publicServiceIdSeed, index),
    label: serviceLabel(index, record.fixtureCase),
    kind: record.kind,
    hooks: record.sourceHooks.map((hook, hookIndex) => ({
      id: `hook-${hookIndex + 1}`,
      sourceHookStoredAsEvidenceOnly: true,
    })),
    lifecycleHints: record.sourceLifecycleHints.map((hint, hintIndex) => ({
      id: `lifecycle-hint-${hintIndex + 1}`,
      sourceLifecycleHintStoredAsEvidenceOnly: true,
    })),
    activationHintId: `activation-hint-${index + 1}`,
    risk: record.risk,
    requestedTools: record.requestedTools,
    workerPolicy: {
      worker: 'zavorth-worker-policy',
      sourceServiceLaunchAllowed: false,
      sourceLifecycleMutationAllowed: false,
      sourceServiceStoredAsEvidenceOnly: true,
    },
    sourceServiceIdStoredAsEvidenceOnly: true,
    sourceHooksStoredAsEvidenceOnly: true,
    sourceLifecycleHintsStoredAsEvidenceOnly: true,
    sourceActivationHintStoredAsEvidenceOnly: true,
    sourceLifecycleReferenceStoredAsEvidenceOnly: true,
    sourceServiceLaunchAllowed: false,
    sourceServiceLaunched: false,
    sourceLifecycleMutated: false,
    nativeContract: 'ZavorthServiceSurface/v1',
  }));
  const blockedTools = services
    .filter((service) => service.risk === 'danger')
    .flatMap((service) => service.requestedTools);
  const allowedTools = services
    .filter((service) => service.risk !== 'danger')
    .flatMap((service) => service.requestedTools);

  return {
    nativeContract: 'ZavorthPluginServiceSurfaceConsistency/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    services,
    serviceRegistry: {
      serviceRows: services.map((service) => ({
        id: `${service.id}:service-row`,
        serviceId: service.id,
        label: service.label,
        status: serviceStatus(service.risk),
        policy: service.risk === 'danger' ? 'blocked' : 'metadata-only',
      })),
    },
    toolExposurePolicyInput: {
      requestedTools: Array.from(new Set(services.flatMap((service) => service.requestedTools))),
      allowedTools: Array.from(new Set(allowedTools)),
      blockedTools: Array.from(new Set(blockedTools)),
      blockedToolReason: 'source-service-launch-not-authorized',
    },
    sourceServiceIdsStoredAsEvidenceOnly: true,
    sourceHooksStoredAsEvidenceOnly: true,
    sourceLifecycleHintsStoredAsEvidenceOnly: true,
    sourceActivationHintsStoredAsEvidenceOnly: true,
    sourceLifecycleReferencesStoredAsEvidenceOnly: true,
    sourceServicesLaunched: false,
    sourceServiceAuthority: false,
    serviceRuntimeIntroduced: false,
    executionGate: options.executionGate,
  };
}
