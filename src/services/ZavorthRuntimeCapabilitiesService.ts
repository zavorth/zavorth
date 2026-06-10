import {
  type ZavorthRuntimeCapabilitiesProjection,
  type ZavorthRuntimeMcpTrustServer,
  type ZavorthRuntimeModelSpec,
  type ZavorthRuntimePermissionsMatrix,
  type ZavorthRuntimePersonalConnector,
  type ZavorthRuntimeProviderConnection,
  type ZavorthRuntimeStateBusSnapshot,
} from '../contracts/ZavorthRuntimeStateBusContract.js';
import { ZavorthRuntimeStateBusService } from './ZavorthRuntimeStateBusService.js';

export const ZAVORTH_RUNTIME_CAPABILITIES_CONTRACT_VERSION = 'zavorth-runtime-capabilities/1' as const;

export type ZavorthRuntimeCapabilitiesSnapshot = {
  contractVersion: typeof ZAVORTH_RUNTIME_CAPABILITIES_CONTRACT_VERSION;
  generatedAt: string;
  source: 'ZavorthRuntimeCapabilitiesService';
  capabilities: ZavorthRuntimeCapabilitiesProjection;
  permissions: ZavorthRuntimePermissionsMatrix;
  modelSpecs: {
    selectedSpecId: string;
    selectedEffort: string;
    specs: ZavorthRuntimeModelSpec[];
  };
  providers: {
    connected: ZavorthRuntimeProviderConnection[];
    selectableModelIds: string[];
    selectedModelId: string;
    routingReason: string;
  };
  workspace: {
    id: string;
    label: string;
    path: string | null;
    isolation: string;
    knowledgeSourceCount: number;
    untrustedContextWrapping: true;
  };
  personalOps: {
    connectors: Array<ZavorthRuntimePersonalConnector & {
      sendRequiresApproval: true;
      writeRequiresApproval: true;
    }>;
  };
  mcpTrust: {
    servers: ZavorthRuntimeMcpTrustServer[];
    externalServersRequireTrust: true;
  };
  skillHistory: ZavorthRuntimeStateBusSnapshot['projections']['skillHistory'];
  streamSession: ZavorthRuntimeStateBusSnapshot['projections']['streamSession'];
  jobs: {
    status: string;
    summary: string;
    actionIds: string[];
  };
  safety: {
    sanitized: true;
    noHiddenLiveProbe: true;
    rawSecretsSerialized: false;
    privateNetworkBlockedByDefault: true;
    importedCapabilitiesQuarantinedByDefault: true;
  };
};

type Runtime = {
  now?: () => Date;
  runtimeStateBus?: Pick<ZavorthRuntimeStateBusService, 'buildSnapshot'> | null;
};

export class ZavorthRuntimeCapabilitiesService {
  private readonly now: () => Date;
  private readonly runtimeStateBus: Pick<ZavorthRuntimeStateBusService, 'buildSnapshot'>;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.runtimeStateBus = runtime.runtimeStateBus || new ZavorthRuntimeStateBusService({ now: this.now });
  }

  public buildSnapshot(): ZavorthRuntimeCapabilitiesSnapshot {
    const runtime = this.runtimeStateBus.buildSnapshot();
    const projections = runtime.projections;
    return {
      contractVersion: ZAVORTH_RUNTIME_CAPABILITIES_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      source: 'ZavorthRuntimeCapabilitiesService',
      capabilities: projections.capabilities,
      permissions: projections.permissionsMatrix,
      modelSpecs: {
        ...projections.modelSpecs,
        selectedEffort: projections.commandBar.selectedEffort,
      },
      providers: {
        connected: projections.dynamicRouting.providerConnections.filter((provider) => provider.status === 'configured'),
        selectableModelIds: projections.commandBar.connectedModelIds,
        selectedModelId: projections.commandBar.selectedModelId,
        routingReason: projections.dynamicRouting.selected.reason,
      },
      workspace: {
        id: projections.commandBar.workspace.id,
        label: projections.commandBar.workspace.label,
        path: projections.commandBar.workspace.path,
        isolation: projections.workspaceKnowledge.isolation,
        knowledgeSourceCount: projections.workspaceKnowledge.ragSources.length,
        untrustedContextWrapping: true,
      },
      personalOps: {
        connectors: projections.personalOps.connectors.map((connector) => ({
          ...connector,
          sendRequiresApproval: true,
          writeRequiresApproval: true,
        })),
      },
      mcpTrust: {
        servers: projections.mcpTrust.servers,
        externalServersRequireTrust: true,
      },
      skillHistory: projections.skillHistory,
      streamSession: projections.streamSession,
      jobs: {
        status: runtime.state.cron.status,
        summary: runtime.state.cron.summary,
        actionIds: runtime.state.cron.actionIds,
      },
      safety: {
        sanitized: true,
        noHiddenLiveProbe: true,
        rawSecretsSerialized: false,
        privateNetworkBlockedByDefault: true,
        importedCapabilitiesQuarantinedByDefault: true,
      },
    };
  }
}
