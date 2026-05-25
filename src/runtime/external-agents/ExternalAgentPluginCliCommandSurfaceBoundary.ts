import type {
  ToolExposurePolicyInput,
} from '../agent/ToolExposurePolicy.js';
import type {
  UniversalToolRiskLevel,
} from '../agent/UniversalAgentRuntimeTypes.js';

export type ExternalAgentPluginCliCommandClassification =
  | 'keep'
  | 'map'
  | 'replace'
  | 'reject';

export type ExternalAgentPluginCliCommandKind =
  | 'status'
  | 'workspace';

export type ExternalAgentPluginCliCommandFixtureCase =
  | 'cli-command-classification'
  | 'cli-process-spawn-blocked';

export type ExternalAgentPluginCliCommandExecutionGate = {
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

export type ExternalAgentPluginCliCommandSurfaceSourceRecord = {
  fixtureCase: ExternalAgentPluginCliCommandFixtureCase;
  publicCliCommandIdSeed: string;
  sourceArguments: string[];
  classification: ExternalAgentPluginCliCommandClassification;
  kind: ExternalAgentPluginCliCommandKind;
  risk: UniversalToolRiskLevel;
  requestedTools: string[];
};

export type ExternalAgentZavorthCliCommandSurface = {
  id: string;
  label: string;
  kind: ExternalAgentPluginCliCommandKind;
  classification: ExternalAgentPluginCliCommandClassification;
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

export type ExternalAgentCliCommandCatalogRow = {
  id: string;
  commandId: string;
  label: string;
  status: 'available' | 'blocked';
  policy: 'metadata-only' | 'blocked';
};

export type ExternalAgentPluginCliCommandSurfaceBoundaryOptions<TRuntimeId extends string = string> = {
  records: ExternalAgentPluginCliCommandSurfaceSourceRecord[];
  generatedAt: string;
  runtimeId: TRuntimeId;
  idPrefix: string;
  executionGate: ExternalAgentPluginCliCommandExecutionGate;
};

export type ExternalAgentPluginCliCommandSurfaceBoundaryNormalization<TRuntimeId extends string = string> = {
  nativeContract: 'ZavorthPluginCliCommandSurfaceParity/v1';
  generatedAt: string;
  runtimeId: TRuntimeId;
  cliCommands: ExternalAgentZavorthCliCommandSurface[];
  dashboard: {
    catalogRows: ExternalAgentCliCommandCatalogRow[];
  };
  toolExposurePolicyInput: ToolExposurePolicyInput;
  sourceCliBinariesStoredAsEvidenceOnly: true;
  sourceCliAliasesStoredAsEvidenceOnly: true;
  sourceProcessEntrypointsStoredAsEvidenceOnly: true;
  sourceCliProcessesSpawned: false;
  sourceCliProcessAuthority: false;
  cliCommandRuntimeIntroduced: false;
  executionGate: ExternalAgentPluginCliCommandExecutionGate;
};

function publicCliCommandId(idPrefix: string, seed: string, index: number): string {
  return `${idPrefix}-${index + 1}-${seed}`;
}

function cliCommandLabel(index: number, fixtureCase: ExternalAgentPluginCliCommandFixtureCase): string {
  if (fixtureCase === 'cli-process-spawn-blocked') {
    return `CLI command surface ${index + 1} blocked`;
  }
  return `CLI command surface ${index + 1}`;
}

function dashboardStatus(risk: UniversalToolRiskLevel): ExternalAgentCliCommandCatalogRow['status'] {
  return risk === 'danger' ? 'blocked' : 'available';
}

export function normalizeExternalAgentPluginCliCommandSurfaces<TRuntimeId extends string>(
  options: ExternalAgentPluginCliCommandSurfaceBoundaryOptions<TRuntimeId>,
): ExternalAgentPluginCliCommandSurfaceBoundaryNormalization<TRuntimeId> {
  const cliCommands = options.records.map((record, index): ExternalAgentZavorthCliCommandSurface => ({
    id: publicCliCommandId(options.idPrefix, record.publicCliCommandIdSeed, index),
    label: cliCommandLabel(index, record.fixtureCase),
    kind: record.kind,
    classification: record.classification,
    arguments: record.sourceArguments.map((argument, argumentIndex) => ({
      id: `argument-${argumentIndex + 1}`,
      required: !argument.startsWith('--'),
      sourceArgumentStoredAsEvidenceOnly: true,
    })),
    risk: record.risk,
    requestedTools: record.requestedTools,
    routingPolicy: {
      router: 'zavorth-command-router',
      sourceBinaryAllowed: false,
      sourceCliProcessSpawnAllowed: false,
      sourceCommandStoredAsEvidenceOnly: true,
    },
    sourceCliBinaryStoredAsEvidenceOnly: true,
    sourceAliasesStoredAsEvidenceOnly: true,
    sourceProcessEntrypointStoredAsEvidenceOnly: true,
    processSpawnAllowed: false,
    sourceCliProcessSpawned: false,
    nativeContract: 'ZavorthCliCommandSurface/v1',
  }));
  const blockedTools = cliCommands
    .filter((command) => command.risk === 'danger')
    .flatMap((command) => command.requestedTools);
  const allowedTools = cliCommands
    .filter((command) => command.risk !== 'danger')
    .flatMap((command) => command.requestedTools);

  return {
    nativeContract: 'ZavorthPluginCliCommandSurfaceParity/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    cliCommands,
    dashboard: {
      catalogRows: cliCommands.map((command) => ({
        id: `${command.id}:catalog-row`,
        commandId: command.id,
        label: command.label,
        status: dashboardStatus(command.risk),
        policy: command.risk === 'danger' ? 'blocked' : 'metadata-only',
      })),
    },
    toolExposurePolicyInput: {
      requestedTools: Array.from(new Set(cliCommands.flatMap((command) => command.requestedTools))),
      allowedTools: Array.from(new Set(allowedTools)),
      blockedTools: Array.from(new Set(blockedTools)),
      blockedToolReason: 'source-cli-process-spawn-not-authorized',
    },
    sourceCliBinariesStoredAsEvidenceOnly: true,
    sourceCliAliasesStoredAsEvidenceOnly: true,
    sourceProcessEntrypointsStoredAsEvidenceOnly: true,
    sourceCliProcessesSpawned: false,
    sourceCliProcessAuthority: false,
    cliCommandRuntimeIntroduced: false,
    executionGate: options.executionGate,
  };
}
