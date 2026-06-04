import type {
  ToolExposurePolicyInput,
} from '../agent/ToolExposurePolicy.js';
import type {
  UniversalToolRiskLevel,
} from '../agent/UniversalAgentRuntimeTypes.js';

export type RuntimeAdapterPluginCommandDescriptorCategory =
  | 'session'
  | 'workspace';

export type RuntimeAdapterPluginCommandDescriptorFixtureCase =
  | 'command-descriptor-safe-action'
  | 'command-descriptor-handler-blocked';

export type RuntimeAdapterPluginCommandDescriptorExecutionGate = {
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

export type RuntimeAdapterPluginCommandDescriptorSourceRecord = {
  fixtureCase: RuntimeAdapterPluginCommandDescriptorFixtureCase;
  publicCommandIdSeed: string;
  sourceArguments: string[];
  category: RuntimeAdapterPluginCommandDescriptorCategory;
  risk: UniversalToolRiskLevel;
  requestedTools: string[];
};

export type RuntimeAdapterZavorthCommandDescriptor = {
  id: string;
  label: string;
  category: RuntimeAdapterPluginCommandDescriptorCategory;
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

export type RuntimeAdapterCommandDescriptorCatalogRow = {
  id: string;
  commandId: string;
  label: string;
  status: 'available' | 'blocked';
  policy: 'metadata-only' | 'blocked';
};

export type RuntimeAdapterPluginCommandDescriptorBoundaryOptions<TRuntimeId extends string = string> = {
  records: RuntimeAdapterPluginCommandDescriptorSourceRecord[];
  generatedAt: string;
  runtimeId: TRuntimeId;
  idPrefix: string;
  executionGate: RuntimeAdapterPluginCommandDescriptorExecutionGate;
};

export type RuntimeAdapterPluginCommandDescriptorBoundaryNormalization<TRuntimeId extends string = string> = {
  nativeContract: 'ZavorthPluginCommandDescriptorConsistency/v1';
  generatedAt: string;
  runtimeId: TRuntimeId;
  descriptors: RuntimeAdapterZavorthCommandDescriptor[];
  dashboard: {
    catalogRows: RuntimeAdapterCommandDescriptorCatalogRow[];
  };
  toolExposurePolicyInput: ToolExposurePolicyInput;
  sourceCommandNamesStoredAsEvidenceOnly: true;
  sourceAliasesStoredAsEvidenceOnly: true;
  sourceHandlerReferencesStoredAsEvidenceOnly: true;
  sourceCommandHandlersLoaded: false;
  sourceCommandExecutionAuthority: false;
  commandRuntimeIntroduced: false;
  executionGate: RuntimeAdapterPluginCommandDescriptorExecutionGate;
};

function publicCommandId(idPrefix: string, seed: string, index: number): string {
  return `${idPrefix}-${index + 1}-${seed}`;
}

function commandLabel(index: number, fixtureCase: RuntimeAdapterPluginCommandDescriptorFixtureCase): string {
  if (fixtureCase === 'command-descriptor-handler-blocked') {
    return `Command descriptor ${index + 1} blocked`;
  }
  return `Command descriptor ${index + 1}`;
}

function dashboardStatus(risk: UniversalToolRiskLevel): RuntimeAdapterCommandDescriptorCatalogRow['status'] {
  return risk === 'danger' ? 'blocked' : 'available';
}

export function normalizeRuntimeAdapterPluginCommandDescriptors<TRuntimeId extends string>(
  options: RuntimeAdapterPluginCommandDescriptorBoundaryOptions<TRuntimeId>,
): RuntimeAdapterPluginCommandDescriptorBoundaryNormalization<TRuntimeId> {
  const descriptors = options.records.map((record, index): RuntimeAdapterZavorthCommandDescriptor => ({
    id: publicCommandId(options.idPrefix, record.publicCommandIdSeed, index),
    label: commandLabel(index, record.fixtureCase),
    category: record.category,
    arguments: record.sourceArguments.map((argument, argumentIndex) => ({
      id: `argument-${argumentIndex + 1}`,
      required: !argument.startsWith('--'),
      sourceArgumentStoredAsEvidenceOnly: true,
    })),
    risk: record.risk,
    requestedTools: record.requestedTools,
    sourceCommandStoredAsEvidenceOnly: true,
    sourceAliasesStoredAsEvidenceOnly: true,
    sourceHandlerReferenceStoredAsEvidenceOnly: true,
    handlerAvailable: false,
    sourceCommandHandlerLoaded: false,
    sourceCommandExecutionAllowed: false,
    nativeContract: 'ZavorthCommandDescriptor/v1',
  }));
  const blockedTools = descriptors
    .filter((descriptor) => descriptor.risk === 'danger')
    .flatMap((descriptor) => descriptor.requestedTools);
  const safeTools = descriptors
    .filter((descriptor) => descriptor.risk !== 'danger')
    .flatMap((descriptor) => descriptor.requestedTools);

  return {
    nativeContract: 'ZavorthPluginCommandDescriptorConsistency/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    descriptors,
    dashboard: {
      catalogRows: descriptors.map((descriptor) => ({
        id: `${descriptor.id}:catalog-row`,
        commandId: descriptor.id,
        label: descriptor.label,
        status: dashboardStatus(descriptor.risk),
        policy: descriptor.risk === 'danger' ? 'blocked' : 'metadata-only',
      })),
    },
    toolExposurePolicyInput: {
      requestedTools: Array.from(new Set(descriptors.flatMap((descriptor) => descriptor.requestedTools))),
      allowedTools: Array.from(new Set(safeTools)),
      blockedTools: Array.from(new Set(blockedTools)),
      blockedToolReason: 'source-command-handler-not-authorized',
    },
    sourceCommandNamesStoredAsEvidenceOnly: true,
    sourceAliasesStoredAsEvidenceOnly: true,
    sourceHandlerReferencesStoredAsEvidenceOnly: true,
    sourceCommandHandlersLoaded: false,
    sourceCommandExecutionAuthority: false,
    commandRuntimeIntroduced: false,
    executionGate: options.executionGate,
  };
}
