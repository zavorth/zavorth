import type { ZavorthNodeMeshService } from '../../services/ZavorthNodeMeshService.js';
import { DomainFacadeBase, type DomainSnapshot } from '../DomainFacadeBase.js';
import { NodeMeshUseCases } from './application/NodeMeshUseCases.js';
import type {
  NodeCatalogPort,
  NodeInvocationPort,
  NodeMeshPort,
  NodePairingPort,
} from './domain/NodesDomainTypes.js';
import { NodesDomainPresenter } from './presentation/NodesDomainPresenter.js';

type NodesFacadeRuntime = {
  now?: () => Date;
  nodeMeshService?: Pick<ZavorthNodeMeshService, 'buildSnapshot'> | NodeMeshPort;
  nodePairingService?: NodePairingPort | null;
  nodeInvokeService?: NodeInvocationPort | null;
  nodeCatalogService?: NodeCatalogPort | null;
};

export type NodesDomainSnapshot = DomainSnapshot & {
  metrics: {
    total: number;
    paired: number;
    online: number;
    invokable: number;
    queued: number;
    capabilities: number;
  };
};

export class NodesFacade extends DomainFacadeBase<NodesDomainSnapshot> {
  private readonly useCases: NodeMeshUseCases;
  private readonly presenter = new NodesDomainPresenter();

  constructor(runtime: NodesFacadeRuntime = {}) {
    super('nodes', 'Nodes', runtime.now);
    this.useCases = new NodeMeshUseCases({
      now: runtime.now,
      nodeMesh: runtime.nodeMeshService || null,
      nodePairing: runtime.nodePairingService || null,
      nodeInvoke: runtime.nodeInvokeService || null,
      nodeCatalog: runtime.nodeCatalogService || null,
    });
  }

  public buildSnapshot(): NodesDomainSnapshot {
    return this.composeSnapshot(this.presenter.present(this.useCases.buildReadModel())) as NodesDomainSnapshot;
  }
}
