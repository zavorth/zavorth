import { NodeMeshServiceAdapter } from '../infrastructure/NodeMeshServiceAdapter.js';
import type {
  NodeCatalogPort,
  NodeInvocationPort,
  NodeMeshPort,
  NodePairingPort,
  NodesDomainReadModel,
} from '../domain/NodesDomainTypes.js';

type NodeMeshUseCasesRuntime = {
  now?: () => Date;
  nodeMesh?: NodeMeshPort | null;
  nodePairing?: NodePairingPort | null;
  nodeInvoke?: NodeInvocationPort | null;
  nodeCatalog?: NodeCatalogPort | null;
};

export class NodeMeshUseCases {
  private readonly now: () => Date;
  private readonly adapter: NodeMeshServiceAdapter;

  constructor(runtime: NodeMeshUseCasesRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.adapter = new NodeMeshServiceAdapter(
      runtime.nodeMesh || null,
      runtime.nodePairing || null,
      runtime.nodeInvoke || null,
      runtime.nodeCatalog || null,
    );
  }

  public buildReadModel(): NodesDomainReadModel {
    const snapshot = this.adapter.buildSnapshot();
    if (!snapshot) {
      return {
        generatedAt: this.now().toISOString(),
        total: 0,
        paired: 0,
        online: 0,
        invokable: 0,
        queued: 0,
        capabilities: 0,
        headline: 'Nodes domain waiting for Node Mesh injection.',
        operatorSummary: 'Sem node mesh injetado, o dominio nao cria registry/capability services por padrao.',
        nextAction: 'Injete o Node Mesh para habilitar pairing, invoke e activity snapshots.',
        source: 'empty',
      };
    }

    return {
      generatedAt: snapshot.generatedAt,
      total: snapshot.summary.total,
      paired: snapshot.summary.paired,
      online: snapshot.summary.online,
      invokable: snapshot.summary.invokable,
      queued: snapshot.summary.queued,
      capabilities: snapshot.summary.capabilities,
      headline: snapshot.narrative.headline,
      operatorSummary: snapshot.narrative.operatorSummary,
      nextAction: snapshot.selected?.nextAction || 'Crie o primeiro pairing para ligar um node ao mesh.',
      source: 'node-mesh',
    };
  }

  public createPairingDraft(input: unknown): unknown {
    return this.adapter.createPairingDraft(input);
  }

  public invoke(input: unknown): unknown {
    return this.adapter.invoke(input);
  }

  public listCatalog(): unknown[] {
    return this.adapter.listCatalog();
  }

  public listProfiles(): unknown[] {
    return this.adapter.listProfiles();
  }
}
