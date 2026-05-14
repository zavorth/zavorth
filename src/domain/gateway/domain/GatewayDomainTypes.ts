export type GatewayStatusInput = {
  userId: string;
  platform?: string | null;
  sessionId?: string | null;
  chatId?: string | null;
};

export type GatewayRuntimeSnapshotPort = {
  buildCoreSnapshot: () => {
    lifecycle?: {
      state?: string | null;
    };
    channels?: {
      total?: number | null;
    };
    sessions?: {
      total?: number | null;
    };
  } | null;
};

export type GatewayServiceSnapshotPort = {
  buildSnapshot: () => {
    summary?: {
      channelsTotal?: number | null;
      sessionTargets?: number | null;
      memoryArtifacts?: number | null;
      remoteTransportsReady?: number | null;
    };
    narrative?: {
      operatorSummary?: string | null;
    };
  } | null;
};

export type GatewayChannelRegistryPort = {
  listChannels: () => unknown[];
};

export type GatewaySessionPlanePort = {
  buildStatusSummaryFast: (input: GatewayStatusInput) => {
    summary?: {
      sessions?: number | null;
    };
  } | null;
};

export type GatewayMemoryPlanePort = {
  buildSnapshotFast: (input: GatewayStatusInput) => {
    summary?: {
      artifacts?: number | null;
    };
  } | null;
};

export type GatewayRemoteTransportPort = {
  buildSnapshot: () => {
    summary?: {
      ready?: number | null;
    };
  } | null;
};

export type GatewayDomainPort = {
  readGatewayState(input: GatewayStatusInput): GatewayDomainReadModel;
};

export type GatewayDomainReadModel = {
  generatedAt: string;
  state: string | null;
  channels: number;
  sessions: number;
  memoryArtifacts: number;
  remoteTransportsReady: number;
  summary: string;
  details: string[];
  source: 'gateway' | 'empty';
};
