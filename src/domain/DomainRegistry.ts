import { ArtifactsFacade, type ArtifactsDomainSnapshot } from './artifacts';
import { ChannelsFacade, type ChannelsDomainSnapshot } from './channels';
import { ExecutionFacade, type ExecutionDomainSnapshot } from './execution';
import { GatewayFacade, type GatewayDomainSnapshot } from './gateway';
import { MemoryFacade, type MemoryDomainSnapshot } from './memory';
import { NodesFacade, type NodesDomainSnapshot } from './nodes';
import { OpsFacade, type OpsDomainSnapshot } from './ops';
import { PlatformFacade, type PlatformDomainSnapshot } from './platform';
import { ProvidersFacade, type ProvidersDomainSnapshot } from './providers';
import { SecurityFacade, type SecurityDomainSnapshot } from './security';
import { SessionsFacade, type SessionsDomainSnapshot } from './sessions';
import { TransportsFacade, type TransportsDomainSnapshot } from './transports';

type DomainRegistryRuntime = {
  now?: () => Date;
  gatewayFacade?: GatewayFacade;
  executionFacade?: ExecutionFacade;
  sessionsFacade?: SessionsFacade;
  memoryFacade?: MemoryFacade;
  artifactsFacade?: ArtifactsFacade;
  platformFacade?: PlatformFacade;
  channelsFacade?: ChannelsFacade;
  nodesFacade?: NodesFacade;
  transportsFacade?: TransportsFacade;
  securityFacade?: SecurityFacade;
  opsFacade?: OpsFacade;
  providersFacade?: ProvidersFacade;
};

export type DomainRegistrySnapshot = {
  generatedAt: string;
  summary: {
    total: number;
    initialized: number;
    pending: number;
  };
  domains: {
    gateway: GatewayDomainSnapshot;
    execution: ExecutionDomainSnapshot;
    sessions: SessionsDomainSnapshot;
    memory: MemoryDomainSnapshot;
    artifacts: ArtifactsDomainSnapshot;
    platform: PlatformDomainSnapshot;
    channels: ChannelsDomainSnapshot;
    nodes: NodesDomainSnapshot;
    transports: TransportsDomainSnapshot;
    security: SecurityDomainSnapshot;
    ops: OpsDomainSnapshot;
    providers: ProvidersDomainSnapshot;
  };
};

export type DomainRegistrySummarySnapshot = {
  generatedAt: string;
  summary: DomainRegistrySnapshot['summary'];
  domains: Array<{
    id: string;
    label: string;
    initialized: boolean;
    initializedAt: string | null;
  }>;
};

export class DomainRegistry {
  private readonly now: () => Date;
  public readonly gateway: GatewayFacade;
  public readonly execution: ExecutionFacade;
  public readonly sessions: SessionsFacade;
  public readonly memory: MemoryFacade;
  public readonly artifacts: ArtifactsFacade;
  public readonly platform: PlatformFacade;
  public readonly channels: ChannelsFacade;
  public readonly nodes: NodesFacade;
  public readonly transports: TransportsFacade;
  public readonly security: SecurityFacade;
  public readonly ops: OpsFacade;
  public readonly providers: ProvidersFacade;

  constructor(runtime: DomainRegistryRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.gateway = runtime.gatewayFacade || new GatewayFacade({ now: this.now });
    this.execution = runtime.executionFacade || new ExecutionFacade({ now: this.now });
    this.sessions = runtime.sessionsFacade || new SessionsFacade({ now: this.now });
    this.memory = runtime.memoryFacade || new MemoryFacade({ now: this.now });
    this.artifacts = runtime.artifactsFacade || new ArtifactsFacade({ now: this.now });
    this.platform = runtime.platformFacade || new PlatformFacade({ now: this.now });
    this.channels = runtime.channelsFacade || new ChannelsFacade({ now: this.now });
    this.nodes = runtime.nodesFacade || new NodesFacade({ now: this.now });
    this.transports = runtime.transportsFacade || new TransportsFacade({ now: this.now });
    this.security = runtime.securityFacade || new SecurityFacade({ now: this.now });
    this.ops = runtime.opsFacade || new OpsFacade({ now: this.now });
    this.providers = runtime.providersFacade || new ProvidersFacade({ now: this.now });
  }

  public async initializeAll(): Promise<void> {
    for (const domain of this.listFacades()) {
      await domain.initialize();
    }
  }

  public primeAll(): void {
    for (const domain of this.listFacades()) {
      domain.initializeSync();
    }
  }

  public buildSnapshot(): DomainRegistrySnapshot {
    const domains = {
      gateway: this.gateway.buildSnapshot(),
      execution: this.execution.buildSnapshot(),
      sessions: this.sessions.buildSnapshot(),
      memory: this.memory.buildSnapshot(),
      artifacts: this.artifacts.buildSnapshot(),
      platform: this.platform.buildSnapshot(),
      channels: this.channels.buildSnapshot(),
      nodes: this.nodes.buildSnapshot(),
      transports: this.transports.buildSnapshot(),
      security: this.security.buildSnapshot(),
      ops: this.ops.buildSnapshot(),
      providers: this.providers.buildSnapshot(),
    };
    const states = Object.values(domains).map((domain) => domain.initialized);

    return {
      generatedAt: this.now().toISOString(),
      summary: {
        total: states.length,
        initialized: states.filter(Boolean).length,
        pending: states.filter((state) => !state).length,
      },
      domains,
    };
  }

  public buildSummarySnapshot(): DomainRegistrySummarySnapshot {
    const domains = this.listFacades().map((domain) => domain.getInitializationState());
    const states = domains.map((domain) => domain.initialized);

    return {
      generatedAt: this.now().toISOString(),
      summary: {
        total: states.length,
        initialized: states.filter(Boolean).length,
        pending: states.filter((state) => !state).length,
      },
      domains,
    };
  }

  private listFacades(): Array<{
    initializeSync: () => void;
    initialize: () => Promise<void>;
    getInitializationState: () => {
      id: string;
      label: string;
      initialized: boolean;
      initializedAt: string | null;
    };
  }> {
    return [
      this.gateway,
      this.execution,
      this.sessions,
      this.memory,
      this.artifacts,
      this.platform,
      this.channels,
      this.nodes,
      this.transports,
      this.security,
      this.ops,
      this.providers,
    ];
  }
}

export const Domains = new DomainRegistry();
