import type {
  ToolExposurePolicyInput,
} from '../agent/ToolExposurePolicy.js';
import type {
  UniversalToolRiskLevel,
} from '../agent/UniversalAgentRuntimeTypes.js';
import {
  normalizeExternalAgentPluginCliCommandSurfaces,
} from './ExternalAgentPluginCliCommandSurfaceBoundary.js';
import {
  normalizeExternalAgentPluginCommandDescriptors,
} from './ExternalAgentPluginCommandDescriptorBoundary.js';
import {
  normalizeExternalAgentPluginGatewayMethodSurfaces,
} from './ExternalAgentPluginGatewayMethodSurfaceBoundary.js';
import {
  normalizeExternalAgentPluginHttpRouteSurfaces,
} from './ExternalAgentPluginHttpRouteSurfaceBoundary.js';
import {
  normalizeExternalAgentPluginServiceSurfaces,
} from './ExternalAgentPluginServiceSurfaceBoundary.js';
import {
  normalizeExternalAgentPluginToolExposurePolicy as normalizeExternalAgentPluginToolExposurePolicyBoundary,
} from './ExternalAgentPluginToolExposurePolicyBoundary.js';

export const EXTERNAL_AGENT_WAVE1_COMMAND_HTTP_FIXTURE_NOW = '2026-04-28T12:00:00.000Z';
export const EXTERNAL_AGENT_WAVE1_COMMAND_HTTP_RUNTIME_ID = 'external-wave1-command-http-fixture-runtime';
export const EXTERNAL_AGENT_WAVE1_COMMAND_HTTP_SOURCE_RUNTIME_NAME = 'ExternalExecutor';

export type ExternalAgentWave1CommandHttpSourceEvidence = {
  sourceRuntimeName: typeof EXTERNAL_AGENT_WAVE1_COMMAND_HTTP_SOURCE_RUNTIME_NAME;
  sourcePaths: string[];
  observedAt: string;
  sourceCommandId?: string;
  sourceAliases?: string[];
  sourceHandlerReference?: string;
  sourceCliBinary?: string;
  sourceProcessEntrypoint?: string;
  sourceGatewayMethodName?: string;
  sourceGatewayDispatchReference?: string;
  sourceAuthScopeHint?: string;
  sourceHttpMethod?: string;
  sourceHttpRoutePath?: string;
  sourceRouteHandlerReference?: string;
  sourceServiceRouteHint?: string;
  sourceServiceId?: string;
  sourceServiceHook?: string;
  sourceLifecycleReference?: string;
  sourceActivationHint?: string;
  sourceToolName?: string;
  sourceApprovalHint?: string;
  sourceRiskLabel?: string;
  notes?: string[];
};

export type ExternalAgentWave1CommandHttpExecutionGate = {
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

export type ExternalAgentWave1PluginCommandDescriptorFixture = {
  fixtureCase: 'command-descriptor-safe-action' | 'command-descriptor-handler-blocked';
  sourceEvidence: ExternalAgentWave1CommandHttpSourceEvidence;
  publicCommandIdSeed: string;
  sourceCommandId: string;
  sourceAliases: string[];
  sourceArguments: string[];
  category: 'session' | 'workspace';
  risk: UniversalToolRiskLevel;
  requestedTools: string[];
  handlerReference?: string;
};

export type ExternalAgentWave1ZavorthCommandDescriptor = {
  id: string;
  label: string;
  category: 'session' | 'workspace';
  arguments: Array<{
    id: string;
    required: boolean;
    sourceArgumentStoredAsEvidenceOnly: true;
  }>;
  risk: UniversalToolRiskLevel;
  requestedTools: string[];
  sourceCommandStoredAsEvidenceOnly: true;
  sourceAliasesStoredAsEvidenceOnly: true;
  sourceHandlerReferenceStoredAsEvidenceOnly: true;
  handlerAvailable: false;
  sourceCommandHandlerLoaded: false;
  sourceCommandExecutionAllowed: false;
  nativeContract: 'ZavorthCommandDescriptor/v1';
};

export type ExternalAgentWave1CommandCenterCommandCatalogRow = {
  id: string;
  commandId: string;
  label: string;
  status: 'available' | 'blocked';
  policy: 'metadata-only' | 'blocked';
};

export type ExternalAgentWave1PluginCommandDescriptorNormalization = {
  nativeContract: 'ZavorthPluginCommandDescriptorParity/v1';
  generatedAt: string;
  runtimeId: typeof EXTERNAL_AGENT_WAVE1_COMMAND_HTTP_RUNTIME_ID;
  descriptors: ExternalAgentWave1ZavorthCommandDescriptor[];
  commandCenter: {
    catalogRows: ExternalAgentWave1CommandCenterCommandCatalogRow[];
  };
  toolExposurePolicyInput: ToolExposurePolicyInput;
  sourceCommandNamesStoredAsEvidenceOnly: true;
  sourceAliasesStoredAsEvidenceOnly: true;
  sourceHandlerReferencesStoredAsEvidenceOnly: true;
  sourceCommandHandlersLoaded: false;
  sourceCommandExecutionAuthority: false;
  commandRuntimeIntroduced: false;
  executionGate: ExternalAgentWave1CommandHttpExecutionGate;
};

export type ExternalAgentWave1PluginCliCommandClassification =
  | 'keep'
  | 'map'
  | 'replace'
  | 'reject';

export type ExternalAgentWave1PluginCliCommandKind =
  | 'status'
  | 'workspace';

export type ExternalAgentWave1PluginCliCommandSurfaceFixture = {
  fixtureCase: 'cli-command-classification' | 'cli-process-spawn-blocked';
  sourceEvidence: ExternalAgentWave1CommandHttpSourceEvidence;
  publicCliCommandIdSeed: string;
  sourceCliCommand: string;
  sourceCliBinary: string;
  sourceAliases: string[];
  sourceArguments: string[];
  classification: ExternalAgentWave1PluginCliCommandClassification;
  kind: ExternalAgentWave1PluginCliCommandKind;
  risk: UniversalToolRiskLevel;
  requestedTools: string[];
  processEntrypoint?: string;
};

export type ExternalAgentWave1ZavorthCliCommandSurface = {
  id: string;
  label: string;
  kind: ExternalAgentWave1PluginCliCommandKind;
  classification: ExternalAgentWave1PluginCliCommandClassification;
  arguments: Array<{
    id: string;
    required: boolean;
    sourceArgumentStoredAsEvidenceOnly: true;
  }>;
  risk: UniversalToolRiskLevel;
  requestedTools: string[];
  routingPolicy: {
    router: 'zavorth-command-router';
    sourceBinaryAllowed: false;
    sourceCliProcessSpawnAllowed: false;
    sourceCommandStoredAsEvidenceOnly: true;
  };
  sourceCliBinaryStoredAsEvidenceOnly: true;
  sourceAliasesStoredAsEvidenceOnly: true;
  sourceProcessEntrypointStoredAsEvidenceOnly: true;
  processSpawnAllowed: false;
  sourceCliProcessSpawned: false;
  nativeContract: 'ZavorthCliCommandSurface/v1';
};

export type ExternalAgentWave1PluginCliCommandSurfaceNormalization = {
  nativeContract: 'ZavorthPluginCliCommandSurfaceParity/v1';
  generatedAt: string;
  runtimeId: typeof EXTERNAL_AGENT_WAVE1_COMMAND_HTTP_RUNTIME_ID;
  cliCommands: ExternalAgentWave1ZavorthCliCommandSurface[];
  commandCenter: {
    catalogRows: ExternalAgentWave1CommandCenterCommandCatalogRow[];
  };
  toolExposurePolicyInput: ToolExposurePolicyInput;
  sourceCliBinariesStoredAsEvidenceOnly: true;
  sourceCliAliasesStoredAsEvidenceOnly: true;
  sourceProcessEntrypointsStoredAsEvidenceOnly: true;
  sourceCliProcessesSpawned: false;
  sourceCliProcessAuthority: false;
  cliCommandRuntimeIntroduced: false;
  executionGate: ExternalAgentWave1CommandHttpExecutionGate;
};

export type ExternalAgentWave1PluginGatewayMethodKind =
  | 'session'
  | 'approval';

export type ExternalAgentWave1PluginGatewayMethodSurfaceFixture = {
  fixtureCase: 'gateway-method-metadata' | 'gateway-method-dispatch-blocked';
  sourceEvidence: ExternalAgentWave1CommandHttpSourceEvidence;
  publicGatewayMethodIdSeed: string;
  sourceGatewayMethodName: string;
  sourceRequestFields: string[];
  sourceResponseFields: string[];
  sourceAuthScopeHint: string;
  kind: ExternalAgentWave1PluginGatewayMethodKind;
  risk: UniversalToolRiskLevel;
  requestedTools: string[];
  dispatchReference?: string;
};

export type ExternalAgentWave1ZavorthGatewayMethodSurface = {
  id: string;
  label: string;
  kind: ExternalAgentWave1PluginGatewayMethodKind;
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

export type ExternalAgentWave1GatewayMethodCatalogRow = {
  id: string;
  methodId: string;
  label: string;
  status: 'available' | 'blocked';
  policy: 'metadata-only' | 'blocked';
};

export type ExternalAgentWave1PluginGatewayMethodSurfaceNormalization = {
  nativeContract: 'ZavorthPluginGatewayMethodSurfaceParity/v1';
  generatedAt: string;
  runtimeId: typeof EXTERNAL_AGENT_WAVE1_COMMAND_HTTP_RUNTIME_ID;
  gatewayMethods: ExternalAgentWave1ZavorthGatewayMethodSurface[];
  gateway: {
    methodRows: ExternalAgentWave1GatewayMethodCatalogRow[];
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
  executionGate: ExternalAgentWave1CommandHttpExecutionGate;
};

export type ExternalAgentWave1PluginHttpRouteKind =
  | 'read'
  | 'mutation';

export type ExternalAgentWave1PluginHttpMethod =
  | 'GET'
  | 'POST'
  | 'DELETE';

export type ExternalAgentWave1PluginHttpRouteSurfaceFixture = {
  fixtureCase: 'http-route-metadata' | 'http-route-registration-blocked';
  sourceEvidence: ExternalAgentWave1CommandHttpSourceEvidence;
  publicRouteIdSeed: string;
  sourceHttpMethod: ExternalAgentWave1PluginHttpMethod;
  sourceHttpRoutePath: string;
  sourceServiceRouteHint: string;
  sourceAuthScopeHint: string;
  kind: ExternalAgentWave1PluginHttpRouteKind;
  risk: UniversalToolRiskLevel;
  requestedTools: string[];
  routeHandlerReference?: string;
};

export type ExternalAgentWave1ZavorthHttpRouteSurface = {
  id: string;
  label: string;
  kind: ExternalAgentWave1PluginHttpRouteKind;
  httpMethod: ExternalAgentWave1PluginHttpMethod;
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

export type ExternalAgentWave1HttpRouteCatalogRow = {
  id: string;
  routeId: string;
  label: string;
  status: 'available' | 'blocked';
  policy: 'metadata-only' | 'blocked';
};

export type ExternalAgentWave1PluginHttpRouteSurfaceNormalization = {
  nativeContract: 'ZavorthPluginHttpRouteSurfaceParity/v1';
  generatedAt: string;
  runtimeId: typeof EXTERNAL_AGENT_WAVE1_COMMAND_HTTP_RUNTIME_ID;
  httpRoutes: ExternalAgentWave1ZavorthHttpRouteSurface[];
  routeRegistry: {
    routeRows: ExternalAgentWave1HttpRouteCatalogRow[];
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
  executionGate: ExternalAgentWave1CommandHttpExecutionGate;
};

export type ExternalAgentWave1PluginServiceSurfaceKind =
  | 'background'
  | 'hook';

export type ExternalAgentWave1PluginServiceSurfaceFixture = {
  fixtureCase: 'service-surface-descriptor' | 'service-launch-blocked';
  sourceEvidence: ExternalAgentWave1CommandHttpSourceEvidence;
  publicServiceIdSeed: string;
  sourceServiceId: string;
  sourceHooks: string[];
  sourceLifecycleHints: string[];
  sourceActivationHint: string;
  kind: ExternalAgentWave1PluginServiceSurfaceKind;
  risk: UniversalToolRiskLevel;
  requestedTools: string[];
  lifecycleReference?: string;
};

export type ExternalAgentWave1ZavorthServiceSurface = {
  id: string;
  label: string;
  kind: ExternalAgentWave1PluginServiceSurfaceKind;
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

export type ExternalAgentWave1ServiceCatalogRow = {
  id: string;
  serviceId: string;
  label: string;
  status: 'available' | 'blocked';
  policy: 'metadata-only' | 'blocked';
};

export type ExternalAgentWave1PluginServiceSurfaceNormalization = {
  nativeContract: 'ZavorthPluginServiceSurfaceParity/v1';
  generatedAt: string;
  runtimeId: typeof EXTERNAL_AGENT_WAVE1_COMMAND_HTTP_RUNTIME_ID;
  services: ExternalAgentWave1ZavorthServiceSurface[];
  serviceRegistry: {
    serviceRows: ExternalAgentWave1ServiceCatalogRow[];
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
  executionGate: ExternalAgentWave1CommandHttpExecutionGate;
};

export type ExternalAgentWave1PluginToolExposureDisposition =
  | 'approval-required'
  | 'block';

export type ExternalAgentWave1PluginToolExposurePolicyFixture = {
  fixtureCase: 'tool-exposure-dangerous-command' | 'tool-exposure-source-approval-advisory';
  sourceEvidence: ExternalAgentWave1CommandHttpSourceEvidence;
  publicPolicyIdSeed: string;
  sourceToolName: string;
  sourceRiskLabel: string;
  sourceApprovalHint: string;
  sourceAuthScopeHint: string;
  disposition: ExternalAgentWave1PluginToolExposureDisposition;
  risk: UniversalToolRiskLevel;
  requestedTools: string[];
};

export type ExternalAgentWave1ZavorthToolExposurePolicySurface = {
  id: string;
  label: string;
  disposition: ExternalAgentWave1PluginToolExposureDisposition;
  risk: UniversalToolRiskLevel;
  requestedTools: string[];
  authScopeHints: Array<{
    id: string;
    sourceAuthScopeStoredAsEvidenceOnly: true;
  }>;
  policy: {
    authority: 'zavorth-tool-exposure-policy';
    sourceApprovalHintAuthority: false;
    sourceRiskLabelAuthority: false;
    sourceAuthScopeAuthority: false;
    sourceToolExecutionAllowed: false;
  };
  sourceToolNameStoredAsEvidenceOnly: true;
  sourceApprovalHintStoredAsEvidenceOnly: true;
  sourceRiskLabelStoredAsEvidenceOnly: true;
  sourceAuthScopeHintStoredAsEvidenceOnly: true;
  sourceApprovalHintGrantsAuthority: false;
  sourceToolExecutionAllowed: false;
  sourcePolicyAppliedDirectly: false;
  nativeContract: 'ZavorthToolExposurePolicySurface/v1';
};

export type ExternalAgentWave1ToolExposureCapabilityRow = {
  id: string;
  policyId: string;
  label: string;
  status: 'requires-approval' | 'blocked';
  policy: 'approval-required' | 'blocked';
};

export type ExternalAgentWave1PluginToolExposurePolicyNormalization = {
  nativeContract: 'ZavorthPluginToolExposurePolicyParity/v1';
  generatedAt: string;
  runtimeId: typeof EXTERNAL_AGENT_WAVE1_COMMAND_HTTP_RUNTIME_ID;
  policies: ExternalAgentWave1ZavorthToolExposurePolicySurface[];
  commandCenter: {
    capabilityRows: ExternalAgentWave1ToolExposureCapabilityRow[];
  };
  toolExposurePolicyInput: ToolExposurePolicyInput;
  sourceToolNamesStoredAsEvidenceOnly: true;
  sourceApprovalHintsStoredAsEvidenceOnly: true;
  sourceRiskLabelsStoredAsEvidenceOnly: true;
  sourceAuthScopeHintsStoredAsEvidenceOnly: true;
  sourceApprovalHintsGrantAuthority: false;
  sourceToolPolicyAuthority: false;
  sourceToolsExecuted: false;
  toolExposureRuntimeIntroduced: false;
  executionGate: ExternalAgentWave1CommandHttpExecutionGate;
};

function commandHttpSourceEvidence(input: {
  sourcePaths: string[];
  sourceCommandId?: string;
  sourceAliases?: string[];
  sourceHandlerReference?: string;
  sourceCliBinary?: string;
  sourceProcessEntrypoint?: string;
  sourceGatewayMethodName?: string;
  sourceGatewayDispatchReference?: string;
  sourceAuthScopeHint?: string;
  sourceHttpMethod?: string;
  sourceHttpRoutePath?: string;
  sourceRouteHandlerReference?: string;
  sourceServiceRouteHint?: string;
  sourceServiceId?: string;
  sourceServiceHook?: string;
  sourceLifecycleReference?: string;
  sourceActivationHint?: string;
  sourceToolName?: string;
  sourceApprovalHint?: string;
  sourceRiskLabel?: string;
  notes?: string[];
}): ExternalAgentWave1CommandHttpSourceEvidence {
  return {
    sourceRuntimeName: EXTERNAL_AGENT_WAVE1_COMMAND_HTTP_SOURCE_RUNTIME_NAME,
    observedAt: EXTERNAL_AGENT_WAVE1_COMMAND_HTTP_FIXTURE_NOW,
    ...input,
  };
}

export function createWave1CommandHttpExecutionGate(): ExternalAgentWave1CommandHttpExecutionGate {
  return {
    sourceCommandsExecuted: false,
    sourceCliProcessesSpawned: false,
    sourceHttpRoutesRegistered: false,
    sourceGatewayMethodsDispatched: false,
    sourceServicesLaunched: false,
    sourceSetupCommandsExecuted: false,
    sourceQaRunnersExecuted: false,
    sourceModulesCopied: false,
    sourceStateMigrated: false,
    sourceCredentialsMigrated: false,
    liveSourceRuntimeConnected: false,
    realAdapterCreated: false,
  };
}

export function createWave1PluginCommandDescriptorFixtures(): ExternalAgentWave1PluginCommandDescriptorFixture[] {
  return [
    {
      fixtureCase: 'command-descriptor-safe-action',
      publicCommandIdSeed: 'safe-action',
      sourceCommandId: 'external-executor.sessions.list',
      sourceAliases: ['external-executor sessions', 'external-executor session ls'],
      sourceArguments: ['--json'],
      category: 'session',
      risk: 'safe',
      requestedTools: ['sessions.list'],
      sourceEvidence: commandHttpSourceEvidence({
        sourcePaths: [
          'src/plugins/commands.ts',
          'src/plugins/registry-types.ts',
          'extensions/sessions/manifest.json',
        ],
        sourceCommandId: 'external-executor.sessions.list',
        sourceAliases: ['external-executor sessions', 'external-executor session ls'],
      }),
    },
    {
      fixtureCase: 'command-descriptor-handler-blocked',
      publicCommandIdSeed: 'handler-blocked',
      sourceCommandId: 'external-executor.workspace.delete',
      sourceAliases: ['external-executor workspace delete', 'external-executor rm-workspace'],
      sourceArguments: ['path'],
      category: 'workspace',
      risk: 'danger',
      requestedTools: ['workspace.delete'],
      handlerReference: 'extensions/workspace/delete.ts#run',
      sourceEvidence: commandHttpSourceEvidence({
        sourcePaths: [
          'src/plugins/commands.ts',
          'extensions/workspace/delete.ts',
        ],
        sourceCommandId: 'external-executor.workspace.delete',
        sourceAliases: ['external-executor workspace delete', 'external-executor rm-workspace'],
        sourceHandlerReference: 'extensions/workspace/delete.ts#run',
        notes: ['Handler reference is evidence only and must not be loaded.'],
      }),
    },
  ];
}

export function normalizeWave1PluginCommandDescriptors(
  fixtures: ExternalAgentWave1PluginCommandDescriptorFixture[] = createWave1PluginCommandDescriptorFixtures(),
): ExternalAgentWave1PluginCommandDescriptorNormalization {
  return normalizeExternalAgentPluginCommandDescriptors({
    records: fixtures,
    generatedAt: EXTERNAL_AGENT_WAVE1_COMMAND_HTTP_FIXTURE_NOW,
    runtimeId: EXTERNAL_AGENT_WAVE1_COMMAND_HTTP_RUNTIME_ID,
    idPrefix: 'zavorth-command:wave1-command-descriptors',
    executionGate: createWave1CommandHttpExecutionGate(),
  });
}

export function createWave1PluginCliCommandSurfaceFixtures(): ExternalAgentWave1PluginCliCommandSurfaceFixture[] {
  return [
    {
      fixtureCase: 'cli-command-classification',
      publicCliCommandIdSeed: 'status-map',
      sourceCliCommand: 'external-executor status --json',
      sourceCliBinary: 'external-executor.mjs',
      sourceAliases: ['external-executor status', 'external-executor doctor --json'],
      sourceArguments: ['--json'],
      classification: 'map',
      kind: 'status',
      risk: 'safe',
      requestedTools: ['workspace.read'],
      sourceEvidence: commandHttpSourceEvidence({
        sourcePaths: [
          'external-executor.mjs',
          'src/cli',
          'src/commands/status.ts',
        ],
        sourceCommandId: 'external-executor status',
        sourceAliases: ['external-executor status', 'external-executor doctor --json'],
        sourceCliBinary: 'external-executor.mjs',
      }),
    },
    {
      fixtureCase: 'cli-process-spawn-blocked',
      publicCliCommandIdSeed: 'daemon-spawn-blocked',
      sourceCliCommand: 'external-executor daemon start',
      sourceCliBinary: 'external-executor.mjs',
      sourceAliases: ['external-executor gateway start', 'external-executor daemon start'],
      sourceArguments: ['--port'],
      classification: 'reject',
      kind: 'workspace',
      risk: 'danger',
      requestedTools: ['shell.exec'],
      processEntrypoint: 'src/commands/daemon-start.ts#run',
      sourceEvidence: commandHttpSourceEvidence({
        sourcePaths: [
          'external-executor.mjs',
          'src/commands/daemon-start.ts',
          'src/terminal/process.ts',
        ],
        sourceCommandId: 'external-executor daemon start',
        sourceAliases: ['external-executor gateway start', 'external-executor daemon start'],
        sourceCliBinary: 'external-executor.mjs',
        sourceProcessEntrypoint: 'src/commands/daemon-start.ts#run',
        notes: ['CLI process spawn is evidence only and remains blocked.'],
      }),
    },
  ];
}

export function normalizeWave1PluginCliCommandSurfaces(
  fixtures: ExternalAgentWave1PluginCliCommandSurfaceFixture[] = createWave1PluginCliCommandSurfaceFixtures(),
): ExternalAgentWave1PluginCliCommandSurfaceNormalization {
  return normalizeExternalAgentPluginCliCommandSurfaces({
    records: fixtures,
    generatedAt: EXTERNAL_AGENT_WAVE1_COMMAND_HTTP_FIXTURE_NOW,
    runtimeId: EXTERNAL_AGENT_WAVE1_COMMAND_HTTP_RUNTIME_ID,
    idPrefix: 'zavorth-cli:wave1-cli-surfaces',
    executionGate: createWave1CommandHttpExecutionGate(),
  });
}

export function createWave1PluginGatewayMethodSurfaceFixtures(): ExternalAgentWave1PluginGatewayMethodSurfaceFixture[] {
  return [
    {
      fixtureCase: 'gateway-method-metadata',
      publicGatewayMethodIdSeed: 'session-list-metadata',
      sourceGatewayMethodName: 'external-executor.gateway.sessions.list',
      sourceRequestFields: ['workspaceId?', 'limit?'],
      sourceResponseFields: ['sessions[]', 'cursor?'],
      sourceAuthScopeHint: 'gateway:read',
      kind: 'session',
      risk: 'safe',
      requestedTools: ['sessions.list'],
      sourceEvidence: commandHttpSourceEvidence({
        sourcePaths: [
          'src/gateway/protocol',
          'src/gateway/server-methods/sessions-list.ts',
        ],
        sourceGatewayMethodName: 'external-executor.gateway.sessions.list',
        sourceAuthScopeHint: 'gateway:read',
      }),
    },
    {
      fixtureCase: 'gateway-method-dispatch-blocked',
      publicGatewayMethodIdSeed: 'approval-resolve-dispatch-blocked',
      sourceGatewayMethodName: 'external-executor.gateway.execApproval.resolve',
      sourceRequestFields: ['approvalId', 'decision'],
      sourceResponseFields: ['status', 'auditEventId'],
      sourceAuthScopeHint: 'gateway:admin',
      kind: 'approval',
      risk: 'danger',
      requestedTools: ['approval.resolve'],
      dispatchReference: 'src/gateway/server-methods/exec-approval-resolve.ts#handle',
      sourceEvidence: commandHttpSourceEvidence({
        sourcePaths: [
          'src/gateway/protocol',
          'src/gateway/server-methods/exec-approval-resolve.ts',
        ],
        sourceGatewayMethodName: 'external-executor.gateway.execApproval.resolve',
        sourceGatewayDispatchReference: 'src/gateway/server-methods/exec-approval-resolve.ts#handle',
        sourceAuthScopeHint: 'gateway:admin',
        notes: ['Gateway method dispatch is evidence only and remains blocked.'],
      }),
    },
  ];
}

export function normalizeWave1PluginGatewayMethodSurfaces(
  fixtures: ExternalAgentWave1PluginGatewayMethodSurfaceFixture[] = createWave1PluginGatewayMethodSurfaceFixtures(),
): ExternalAgentWave1PluginGatewayMethodSurfaceNormalization {
  return normalizeExternalAgentPluginGatewayMethodSurfaces({
    records: fixtures,
    generatedAt: EXTERNAL_AGENT_WAVE1_COMMAND_HTTP_FIXTURE_NOW,
    runtimeId: EXTERNAL_AGENT_WAVE1_COMMAND_HTTP_RUNTIME_ID,
    idPrefix: 'zavorth-gateway-method:wave1-gateway-method-surfaces',
    executionGate: createWave1CommandHttpExecutionGate(),
  });
}

export function createWave1PluginHttpRouteSurfaceFixtures(): ExternalAgentWave1PluginHttpRouteSurfaceFixture[] {
  return [
    {
      fixtureCase: 'http-route-metadata',
      publicRouteIdSeed: 'session-read-metadata',
      sourceHttpMethod: 'GET',
      sourceHttpRoutePath: '/external-executor/api/sessions/:sessionId',
      sourceServiceRouteHint: 'session-service',
      sourceAuthScopeHint: 'http:read',
      kind: 'read',
      risk: 'safe',
      requestedTools: ['sessions.read'],
      sourceEvidence: commandHttpSourceEvidence({
        sourcePaths: [
          'src/plugins/http-registry.ts',
          'src/gateway/server',
          'src/web/routes/sessions.ts',
        ],
        sourceHttpMethod: 'GET',
        sourceHttpRoutePath: '/external-executor/api/sessions/:sessionId',
        sourceServiceRouteHint: 'session-service',
        sourceAuthScopeHint: 'http:read',
      }),
    },
    {
      fixtureCase: 'http-route-registration-blocked',
      publicRouteIdSeed: 'workspace-delete-registration-blocked',
      sourceHttpMethod: 'DELETE',
      sourceHttpRoutePath: '/external-executor/api/workspace/:workspaceId',
      sourceServiceRouteHint: 'workspace-service',
      sourceAuthScopeHint: 'http:admin',
      kind: 'mutation',
      risk: 'danger',
      requestedTools: ['workspace.delete'],
      routeHandlerReference: 'src/web/routes/workspace-delete.ts#handler',
      sourceEvidence: commandHttpSourceEvidence({
        sourcePaths: [
          'src/plugins/http-registry.ts',
          'src/gateway/server',
          'src/web/routes/workspace-delete.ts',
        ],
        sourceHttpMethod: 'DELETE',
        sourceHttpRoutePath: '/external-executor/api/workspace/:workspaceId',
        sourceRouteHandlerReference: 'src/web/routes/workspace-delete.ts#handler',
        sourceServiceRouteHint: 'workspace-service',
        sourceAuthScopeHint: 'http:admin',
        notes: ['HTTP route registration is evidence only and remains blocked.'],
      }),
    },
  ];
}

export function normalizeWave1PluginHttpRouteSurfaces(
  fixtures: ExternalAgentWave1PluginHttpRouteSurfaceFixture[] = createWave1PluginHttpRouteSurfaceFixtures(),
): ExternalAgentWave1PluginHttpRouteSurfaceNormalization {
  return normalizeExternalAgentPluginHttpRouteSurfaces({
    records: fixtures,
    generatedAt: EXTERNAL_AGENT_WAVE1_COMMAND_HTTP_FIXTURE_NOW,
    runtimeId: EXTERNAL_AGENT_WAVE1_COMMAND_HTTP_RUNTIME_ID,
    idPrefix: 'zavorth-http-route:wave1-http-route-surfaces',
    executionGate: createWave1CommandHttpExecutionGate(),
  });
}

export function createWave1PluginServiceSurfaceFixtures(): ExternalAgentWave1PluginServiceSurfaceFixture[] {
  return [
    {
      fixtureCase: 'service-surface-descriptor',
      publicServiceIdSeed: 'notification-hook-descriptor',
      sourceServiceId: 'external-executor.service.notifications',
      sourceHooks: ['on-session-event', 'on-artifact-ready'],
      sourceLifecycleHints: ['lazy-start', 'idle-timeout'],
      sourceActivationHint: 'activate-on-session-event',
      kind: 'hook',
      risk: 'safe',
      requestedTools: ['notifications.describe'],
      sourceEvidence: commandHttpSourceEvidence({
        sourcePaths: [
          'src/plugins/registry-types.ts',
          'extensions/notifications/manifest.json',
          'src/plugins/loader.ts',
        ],
        sourceServiceId: 'external-executor.service.notifications',
        sourceServiceHook: 'on-session-event',
        sourceActivationHint: 'activate-on-session-event',
      }),
    },
    {
      fixtureCase: 'service-launch-blocked',
      publicServiceIdSeed: 'workspace-indexer-launch-blocked',
      sourceServiceId: 'external-executor.service.workspace-indexer',
      sourceHooks: ['on-workspace-open'],
      sourceLifecycleHints: ['daemon', 'restart-on-failure'],
      sourceActivationHint: 'activate-on-workspace-open',
      kind: 'background',
      risk: 'danger',
      requestedTools: ['workspace.index.write'],
      lifecycleReference: 'extensions/workspace-indexer/service.ts#start',
      sourceEvidence: commandHttpSourceEvidence({
        sourcePaths: [
          'src/plugins/registry-types.ts',
          'extensions/workspace-indexer/manifest.json',
          'extensions/workspace-indexer/service.ts',
        ],
        sourceServiceId: 'external-executor.service.workspace-indexer',
        sourceServiceHook: 'on-workspace-open',
        sourceLifecycleReference: 'extensions/workspace-indexer/service.ts#start',
        sourceActivationHint: 'activate-on-workspace-open',
        notes: ['Service launch and lifecycle mutation are evidence only and remain blocked.'],
      }),
    },
  ];
}

export function normalizeWave1PluginServiceSurfaces(
  fixtures: ExternalAgentWave1PluginServiceSurfaceFixture[] = createWave1PluginServiceSurfaceFixtures(),
): ExternalAgentWave1PluginServiceSurfaceNormalization {
  return normalizeExternalAgentPluginServiceSurfaces({
    records: fixtures,
    generatedAt: EXTERNAL_AGENT_WAVE1_COMMAND_HTTP_FIXTURE_NOW,
    runtimeId: EXTERNAL_AGENT_WAVE1_COMMAND_HTTP_RUNTIME_ID,
    idPrefix: 'zavorth-service:wave1-service-surfaces',
    executionGate: createWave1CommandHttpExecutionGate(),
  });
}

export function createWave1PluginToolExposurePolicyFixtures(): ExternalAgentWave1PluginToolExposurePolicyFixture[] {
  return [
    {
      fixtureCase: 'tool-exposure-dangerous-command',
      publicPolicyIdSeed: 'dangerous-command-blocked',
      sourceToolName: 'external-executor.workspace.forceDelete',
      sourceRiskLabel: 'dangerous',
      sourceApprovalHint: 'source-owner-approval-required',
      sourceAuthScopeHint: 'plugin:workspace:write',
      disposition: 'block',
      risk: 'danger',
      requestedTools: ['workspace.delete'],
      sourceEvidence: commandHttpSourceEvidence({
        sourcePaths: [
          'src/plugins/registry-types.ts',
          'src/security',
          'src/plugins/manifest-types.ts',
        ],
        sourceToolName: 'external-executor.workspace.forceDelete',
        sourceApprovalHint: 'source-owner-approval-required',
        sourceRiskLabel: 'dangerous',
        sourceAuthScopeHint: 'plugin:workspace:write',
        notes: ['Dangerous source tool metadata becomes Zavorth blocked policy input.'],
      }),
    },
    {
      fixtureCase: 'tool-exposure-source-approval-advisory',
      publicPolicyIdSeed: 'source-approval-advisory',
      sourceToolName: 'external-executor.web.fetch',
      sourceRiskLabel: 'network',
      sourceApprovalHint: 'preapproved-by-source-policy',
      sourceAuthScopeHint: 'network:egress',
      disposition: 'approval-required',
      risk: 'attention',
      requestedTools: ['network_fetch'],
      sourceEvidence: commandHttpSourceEvidence({
        sourcePaths: [
          'src/plugins/registry-types.ts',
          'src/security',
          'src/plugins/manifest-types.ts',
        ],
        sourceToolName: 'external-executor.web.fetch',
        sourceApprovalHint: 'preapproved-by-source-policy',
        sourceRiskLabel: 'network',
        sourceAuthScopeHint: 'network:egress',
        notes: ['Source approval hints are advisory and never grant Zavorth authority.'],
      }),
    },
  ];
}

export function normalizeWave1PluginToolExposurePolicy(
  fixtures: ExternalAgentWave1PluginToolExposurePolicyFixture[] = createWave1PluginToolExposurePolicyFixtures(),
): ExternalAgentWave1PluginToolExposurePolicyNormalization {
  return normalizeExternalAgentPluginToolExposurePolicyBoundary({
    records: fixtures,
    generatedAt: EXTERNAL_AGENT_WAVE1_COMMAND_HTTP_FIXTURE_NOW,
    runtimeId: EXTERNAL_AGENT_WAVE1_COMMAND_HTTP_RUNTIME_ID,
    idPrefix: 'zavorth-tool-policy:wave1-tool-exposure-policy',
    executionGate: createWave1CommandHttpExecutionGate(),
  });
}
