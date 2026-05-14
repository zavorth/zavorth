export type ChannelMeshPort = {
  buildSnapshot(input?: { selectedId?: string | null }): {
    generatedAt: string;
    summary: {
      total: number;
      ready: number;
      partial: number;
      planned: number;
      disabled: number;
      configured?: number;
      sessionSendReady?: number;
    };
    narrative: {
      headline: string;
      operatorSummary: string;
    };
  };
  renderReport?: (input?: { selectedId?: string | null }) => string;
};

export type ChannelRegistryPort = {
  listChannels(): Array<{
    id: string;
    readiness: string;
    configured: boolean;
  }>;
};

export type ChannelsDomainReadModel = {
  generatedAt: string;
  total: number;
  configuredChannels: number;
  remoteReady: number;
  partial: number;
  planned: number;
  disabled: number;
  sessionSendReady: number;
  headline: string;
  operatorSummary: string;
  source: 'channel-mesh' | 'channel-registry' | 'seed';
};
