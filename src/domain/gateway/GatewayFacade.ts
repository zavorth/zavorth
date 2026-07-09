import { DomainFacadeBase, type DomainSnapshot } from '../DomainFacadeBase.js';
import { GatewayUseCases } from './application/GatewayUseCases.js';
import type {
  GatewayChannelRegistryPort,
  GatewayMemoryPlanePort,
  GatewayRemoteTransportPort,
  GatewayRuntimeSnapshotPort,
  GatewayServiceSnapshotPort,
  GatewaySessionPlanePort,
} from './domain/GatewayDomainTypes.js';
import { GatewayRuntimeAdapter } from './infrastructure/GatewayRuntimeAdapter.js';

import { GatewayDomainPresenter } from './presentation/GatewayDomainPresenter.js';

type GatewayFacadeRuntime = {
  now?: () => Date;
  gatewayRuntime?: GatewayRuntimeSnapshotPort;
  gatewayService?: GatewayServiceSnapshotPort;
  channelRegistryService?: GatewayChannelRegistryPort;
  sessionPlaneService?: GatewaySessionPlanePort;
  memoryPlaneService?: GatewayMemoryPlanePort;
  remoteTransportService?: GatewayRemoteTransportPort;
  defaultUserId?: string | null;
  defaultPlatform?: string | null;
  defaultSessionId?: string | null;
  defaultChatId?: string | null;
};

export type GatewayDomainSnapshot = DomainSnapshot & {
  metrics: {
    state: string | null;
    channels: number;
    sessions: number;
    memoryArtifacts: number;
    remoteTransportsReady: number;
  };
};

export class GatewayFacade extends DomainFacadeBase<GatewayDomainSnapshot> {
  private readonly useCases: GatewayUseCases;
  private readonly presenter = new GatewayDomainPresenter();
  private readonly defaultUserId: string;
  private readonly defaultPlatform: string | null;
  private readonly defaultSessionId: string | null;
  private readonly defaultChatId: string | null;

  constructor(runtime: GatewayFacadeRuntime = {}) {
    super('gateway', 'Gateway', runtime.now);
    this.useCases = new GatewayUseCases({
      now: runtime.now,
      gateway: new GatewayRuntimeAdapter({
        now: runtime.now,
        gatewayRuntime: runtime.gatewayRuntime || null,
        gatewayService: runtime.gatewayService || null,
        channelRegistry: runtime.channelRegistryService || null,
        sessionPlane: runtime.sessionPlaneService || null,
        memoryPlane: runtime.memoryPlaneService || null,
        remoteTransports: runtime.remoteTransportService || null,
      }),
    });
    this.defaultUserId = String(runtime.defaultUserId || 'gateway-core').trim() || 'gateway-core';
    this.defaultPlatform = String(runtime.defaultPlatform || 'web').trim() || 'web';
    this.defaultSessionId = String(runtime.defaultSessionId || 'gateway-core').trim() || null;
    this.defaultChatId = String(runtime.defaultChatId || 'web:gateway-core').trim() || null;
  }

  public buildSnapshot(): GatewayDomainSnapshot {
    return this.composeSnapshot(this.presenter.presentReadiness(this.useCases.buildReadiness({
      userId: this.defaultUserId,
      platform: this.defaultPlatform,
      sessionId: this.defaultSessionId,
      chatId: this.defaultChatId,
    }))) as GatewayDomainSnapshot;
  }
}
