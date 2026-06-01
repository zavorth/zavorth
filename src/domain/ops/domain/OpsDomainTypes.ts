export type OperationsHealthSnapshotPort = {
  sidecars: {
    AIGateway?: { enabled?: boolean; ready?: boolean } | null;
    ZavorthTerminal?: { enabled?: boolean; ready?: boolean } | null;
  };
  errors: {
    recent?: unknown[];
  };
  channels?: Record<string, {
    enabled?: boolean;
    ready?: boolean;
    started?: boolean;
    configured?: boolean;
  } | null | undefined>;
  security: {
    needsAttention?: boolean;
  };
  storage: {
    freePercent: number;
  };
  publish: {
    available?: boolean;
    publishedAt?: string | null;
  };
  remoteTransportDoctor?: {
    summary?: string | null;
  } | null;
  nodeMeshSmoke?: {
    status?: string | null;
  } | null;
};

export type OperationsHealthPort = {
  readSnapshotFast(): OperationsHealthSnapshotPort;
};
