import type {
  NodeCatalogPort,
  NodeInvocationPort,
  NodeMeshPort,
  NodePairingPort,
} from '../domain/NodesDomainTypes.js';

export class NodeMeshServiceAdapter {
  constructor(
    private readonly nodeMesh: NodeMeshPort | null = null,
    private readonly nodePairing: NodePairingPort | null = null,
    private readonly nodeInvoke: NodeInvocationPort | null = null,
    private readonly nodeCatalog: NodeCatalogPort | null = null,
  ) {}

  public buildSnapshot(): ReturnType<NodeMeshPort['buildSnapshot']> | null {
    return this.nodeMesh?.buildSnapshot() || null;
  }

  public createPairingDraft(input: unknown): unknown {
    if (!this.nodePairing) {
      throw new Error('Node pairing use case is not available in this domain adapter.');
    }
    return this.nodePairing.createPairingDraft(input);
  }

  public invoke(input: unknown): unknown {
    if (!this.nodeInvoke) {
      throw new Error('Node invoke use case is not available in this domain adapter.');
    }
    return this.nodeInvoke.invoke(input);
  }

  public listCatalog(): unknown[] {
    return this.nodeCatalog?.listCatalog?.() || [];
  }

  public listProfiles(): unknown[] {
    return this.nodeCatalog?.listProfiles?.() || [];
  }
}
