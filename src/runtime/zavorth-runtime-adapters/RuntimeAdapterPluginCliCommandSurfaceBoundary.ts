import type {
  ToolExposurePolicyInput,
} from '../agent/ToolExposurePolicy.js';
import type {
  UniversalToolRiskLevel,
} from '../agent/UniversalAgentRuntimeTypes.js';

export type RuntimeAdapterPluginCliCommandClassification =
  | 'keep'
  | 'map'
  | 'replace'
  | 'reject';

export type RuntimeAdapterPluginCliCommandKind =
  | 'status'
  | 'workspace';

export type RuntimeAdapterPluginCliCommandFixtureCase =
  | 'cli-command-classification'
  | 'cli-process-spawn-blocked';

export type RuntimeAdapterPluginCliCommandExecutionGate = {
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

export type RuntimeAdapterPluginCliCommandSurfaceSourceRecord = {
  fixtureCase: RuntimeAdapterPluginCliCommandFixtureCase;
  publicCliCommandIdSeed: string;
  sourceArguments: string[];
  classification: RuntimeAdapterPluginCliCommandClassification;
  kind: RuntimeAdapterPluginCliCommandKind;
  risk: UniversalToolRiskLevel;
  requestedTools: string[];
};

export type RuntimeAdapterZavorthCliCommandSurface = {
  id: string;
  label: string;
  kind: RuntimeAdapterPluginCliCommandKind;
  classification: RuntimeAdapterPluginCliCommandClassification;
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

export type RuntimeAdapterCliCommandCatalogRow = {
  id: string;
  commandId: string;
  label: string;
  status: 'available' | 'blocked';
  policy: 'metadata-only' | 'blocked';
};

export type RuntimeAdapterPluginCliCommandSurfaceBoundaryOptions<TRuntimeId extends string = string> = {
  records: RuntimeAdapterPluginCliCommandSurfaceSourceRecord[];
  generatedAt: string;
  runtimeId: TRuntimeId;
  idPrefix: string;
  executionGate: RuntimeAdapterPluginCliCommandExecutionGate;
};

export type RuntimeAdapterPluginCliCommandSurfaceBoundaryNormalization<TRuntimeId extends string = string> = {
  nativeContract: 'ZavorthPluginCliCommandSurfaceConsistency/v1';
  generatedAt: string;
  runtimeId: TRuntimeId;
  cliCommands: RuntimeAdapterZavorthCliCommandSurface[];
  dashboard: {
    catalogRows: RuntimeAdapterCliCommandCatalogRow[];
  };
  toolExposurePolicyInput: ToolExposurePolicyInput;
  sourceCliBinariesStoredAsEvidenceOnly: true;
  sourceCliAliasesStoredAsEvidenceOnly: true;
  sourceProcessEntrypointsStoredAsEvidenceOnly: true;
  sourceCliProcessesSpawned: false;
  sourceCliProcessAuthority: false;
  cliCommandRuntimeIntroduced: false;
  executionGate: RuntimeAdapterPluginCliCommandExecutionGate;
};

function publicCliCommandId(idPrefix: string, seed: string, index: number): string {
  return `${idPrefix}-${index + 1}-${seed}`;
}

function cliCommandLabel(index: number, fixtureCase: RuntimeAdapterPluginCliCommandFixtureCase): string {
  if (fixtureCase === 'cli-process-spawn-blocked') {
    return `CLI command surface ${index + 1} blocked`;
  }
  return `CLI command surface ${index + 1}`;
}

function dashboardStatus(risk: UniversalToolRiskLevel): RuntimeAdapterCliCommandCatalogRow['status'] {
  return risk === 'danger' ? 'blocked' : 'available';
}

export function normalizeRuntimeAdapterPluginCliCommandSurfaces<TRuntimeId extends string>(
  options: RuntimeAdapterPluginCliCommandSurfaceBoundaryOptions<TRuntimeId>,
): RuntimeAdapterPluginCliCommandSurfaceBoundaryNormalization<TRuntimeId> {
  const cliCommands = options.records.map((record, index): RuntimeAdapterZavorthCliCommandSurface => ({
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
    nativeContract: 'ZavorthPluginCliCommandSurfaceConsistency/v1',
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
