import { DomainFacadeBase, type DomainSnapshot } from '../DomainFacadeBase.js';
import { TransportsUseCases } from './application/TransportsUseCases.js';
import type { RemoteTransportSnapshotPort } from './domain/TransportsDomainTypes.js';
import { RemoteTransportAdapter } from './infrastructure/RemoteTransportAdapter.js';
import { TransportsDomainPresenter } from './presentation/TransportsDomainPresenter.js';

type TransportsFacadeRuntime = {
  now?: () => Date;
  remoteTransportService?: RemoteTransportSnapshotPort;
};

export type TransportsDomainSnapshot = DomainSnapshot & {
  metrics: {
    total: number;
    ready: number;
    partial: number;
    attentionRequired: number;
    pendingWork: number;
  };
};

export class TransportsFacade extends DomainFacadeBase<TransportsDomainSnapshot> {
  private readonly useCases: TransportsUseCases;
  private readonly presenter = new TransportsDomainPresenter();

  constructor(runtime: TransportsFacadeRuntime = {}) {
    super('transports', 'Transports', runtime.now);
    this.useCases = new TransportsUseCases({
      now: runtime.now,
      transports: new RemoteTransportAdapter({
        now: runtime.now,
        remoteTransportService: runtime.remoteTransportService || null,
      }),
    });
  }

  public buildSnapshot(): TransportsDomainSnapshot {
    return this.composeSnapshot(this.presenter.presentReadiness(this.useCases.buildReadiness())) as TransportsDomainSnapshot;
  }
}
