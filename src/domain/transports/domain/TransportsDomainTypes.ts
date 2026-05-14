export type RemoteTransportSnapshotPort = {
  buildSnapshot: (input?: { selectedId?: string | null }) => {
    generatedAt: string;
    summary: {
      total: number;
      ready: number;
      partial: number;
      attentionRequired: number;
      pendingWork: number;
    };
    narrative: {
      headline: string;
      operatorSummary: string;
    };
    selected?: {
      operatorSummary?: string | null;
    } | null;
  };
};

export type TransportsDomainPort = {
  readTransportState(): TransportsDomainReadModel;
};

export type TransportsDomainReadModel = {
  generatedAt: string;
  total: number;
  ready: number;
  partial: number;
  attentionRequired: number;
  pendingWork: number;
  headline: string;
  operatorSummary: string;
  selectedSummary: string;
  source: 'remote-transport-plane' | 'empty';
};
