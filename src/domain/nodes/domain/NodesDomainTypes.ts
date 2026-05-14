export type NodeMeshPort = {
  buildSnapshot(input?: { selectedNodeId?: string | null }): {
    generatedAt: string;
    summary: {
      total: number;
      paired: number;
      online: number;
      invokable: number;
      queued: number;
      capabilities: number;
      pending?: number;
    };
    selected?: { nextAction?: string | null } | null;
    narrative: {
      headline: string;
      operatorSummary: string;
    };
  };
  getNodeEntry?: (nodeId: string | null | undefined) => unknown;
  buildActivitySnapshot?: (nodeId: string | null | undefined) => unknown;
};

export type NodePairingPort = {
  createPairingDraft(input: unknown): unknown;
};

export type NodeInvocationPort = {
  invoke(input: unknown): unknown;
  preview?: (input: unknown) => unknown;
};

export type NodeCatalogPort = {
  listCatalog?: () => unknown[];
  listProfiles?: () => unknown[];
};

export type NodesDomainReadModel = {
  generatedAt: string;
  total: number;
  paired: number;
  online: number;
  invokable: number;
  queued: number;
  capabilities: number;
  headline: string;
  operatorSummary: string;
  nextAction: string;
  source: 'node-mesh' | 'empty';
};
