import type {
  RemoteTransportSnapshotPort,
  TransportsDomainPort,
  TransportsDomainReadModel,
} from '../domain/TransportsDomainTypes.js';

type RemoteTransportAdapterRuntime = {
  now?: () => Date;
  remoteTransportService?: RemoteTransportSnapshotPort | null;
};

export class RemoteTransportAdapter implements TransportsDomainPort {
  private readonly now: () => Date;
  private readonly remoteTransportService: RemoteTransportSnapshotPort | null;

  constructor(runtime: RemoteTransportAdapterRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.remoteTransportService = runtime.remoteTransportService || null;
  }

  public readTransportState(): TransportsDomainReadModel {
    if (!this.remoteTransportService) {
      return {
        generatedAt: this.now().toISOString(),
        total: 0,
        ready: 0,
        partial: 0,
        attentionRequired: 0,
        pendingWork: 0,
        headline: 'Transports domain waiting for the canonical remote transport plane.',
        operatorSummary: 'No remote transport service was injected into this context.',
        selectedSummary: 'No remote transport was selected in this slice.',
        source: 'empty',
      };
    }

    const snapshot = this.remoteTransportService.buildSnapshot();
    return {
      generatedAt: snapshot.generatedAt,
      total: snapshot.summary.total,
      ready: snapshot.summary.ready,
      partial: snapshot.summary.partial,
      attentionRequired: snapshot.summary.attentionRequired,
      pendingWork: snapshot.summary.pendingWork,
      headline: snapshot.narrative.headline,
      operatorSummary: snapshot.narrative.operatorSummary,
      selectedSummary: snapshot.selected?.operatorSummary || 'No remote transport was selected in this slice.',
      source: 'remote-transport-plane',
    };
  }
}
