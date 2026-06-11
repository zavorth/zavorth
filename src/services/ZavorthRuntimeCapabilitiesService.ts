import {
  type ZavorthRuntimeCapabilitiesProjection,
  type ZavorthRuntimeMcpTrustServer,
  type ZavorthRuntimeModelSpec,
  type ZavorthRuntimePermissionsMatrix,
  type ZavorthRuntimePersonalConnector,
  type ZavorthRuntimeProviderConnection,
  type ZavorthRuntimeStateReceipt,
  type ZavorthRuntimeStateBusSnapshot,
  type ZavorthRuntimeWorkspaceKnowledge,
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
    configurable: ZavorthRuntimeProviderConnection[];
    blocked: ZavorthRuntimeProviderConnection[];
    all: ZavorthRuntimeProviderConnection[];
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
  workspaceKnowledge: ZavorthRuntimeWorkspaceKnowledge;
  personalOps: {
    connectors: Array<ZavorthRuntimePersonalConnector & {
      sendRequiresApproval: true;
      writeRequiresApproval: true;
      operations: Array<{
        id: string;
        label: string;
        requiresApproval: true;
        enabled: boolean;
      }>;
      profilePriority: 'primary-for-personal' | 'discreet-by-default';
    }>;
    policy: {
      primaryProfile: 'personal';
      defaultOutsidePersonal: 'discreet';
      liveAdaptersRequireCredentialRef: true;
      mcpAllowedAsAdapter: true;
    };
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
    const providerConnections = withBlockedProviderReceipts(
      projections.dynamicRouting.providerConnections,
      runtime.receipts,
    );
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
        connected: providerConnections.filter((provider) => provider.status === 'configured'),
        configurable: providerConnections.filter((provider) => provider.status === 'needs-setup'),
        blocked: providerConnections.filter((provider) => provider.status === 'blocked'),
        all: providerConnections,
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
      workspaceKnowledge: projections.workspaceKnowledge,
      personalOps: {
        connectors: projections.personalOps.connectors.map((connector) => ({
          ...connector,
          sendRequiresApproval: true,
          writeRequiresApproval: true,
          operations: personalConnectorOperations(connector),
          profilePriority: 'primary-for-personal',
        })),
        policy: {
          primaryProfile: 'personal',
          defaultOutsidePersonal: 'discreet',
          liveAdaptersRequireCredentialRef: true,
          mcpAllowedAsAdapter: true,
        },
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

function personalConnectorOperations(connector: ZavorthRuntimePersonalConnector): Array<{
  id: string;
  label: string;
  requiresApproval: true;
  enabled: boolean;
}> {
  if (connector.kind === 'calendar') {
    return [
      personalOperation('calendar.read', 'Read calendar', connector.enabled && connector.readAllowed),
      personalOperation('calendar.create-event', 'Create event', connector.enabled),
      personalOperation('calendar.update-event', 'Update event', connector.enabled),
    ];
  }
  if (connector.kind === 'task') {
    return [
      personalOperation('task.read', 'Read tasks', connector.enabled && connector.readAllowed),
      personalOperation('task.create', 'Create task', connector.enabled),
      personalOperation('task.update', 'Update task', connector.enabled),
    ];
  }
  return [
    personalOperation('email.read', 'Read email', connector.enabled && connector.readAllowed),
    personalOperation('email.draft', 'Create draft', connector.enabled && connector.draftAllowed),
    personalOperation('email.send', 'Send email', connector.enabled),
  ];
}

function withBlockedProviderReceipts(
  providers: ZavorthRuntimeProviderConnection[],
  receipts: ZavorthRuntimeStateReceipt[],
): ZavorthRuntimeProviderConnection[] {
  const byId = new Map(providers.map((provider) => [provider.id, provider]));
  for (const receipt of receipts) {
    if (receipt.action !== 'set-provider-connection' || receipt.status !== 'blocked') {
      continue;
    }
    const payload = record(record(receipt.metadata)?.payload);
    const provider = record(payload?.providerConnection);
    const id = safeId(provider?.providerId || provider?.id);
    if (!id || byId.has(id)) {
      continue;
    }
    byId.set(id, {
      id,
      label: clean(provider?.label) || id,
      status: 'blocked',
      targetHost: clean(provider?.targetHost),
      localLoopback: provider?.localLoopback === true,
      defaultRouteAllowed: false,
      blockReason: clean(receipt.metadata.error) || receipt.preview.reason || 'provider_blocked',
      updatedAt: receipt.createdAt,
    });
  }
  return Array.from(byId.values());
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function clean(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function safeId(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:/-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function personalOperation(id: string, label: string, enabled: boolean): {
  id: string;
  label: string;
  requiresApproval: true;
  enabled: boolean;
} {
  return {
    id,
    label,
    requiresApproval: true,
    enabled,
  };
}
