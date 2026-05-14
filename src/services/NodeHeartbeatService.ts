import { config } from '../config/index.js';
import type {
  NodeInvocationCompletion,
  NodeMeshHeartbeatResult,
  NodeMeshHostHints,
  NodeMeshPairingClaim,
  NodeMeshStatus,
} from '../contracts/NodeMeshContract.js';
import { NodeInvokeService } from './NodeInvokeService.js';
import { NodePairingService } from './NodePairingService.js';
import { NodeRegistryService } from './NodeRegistryService.js';

type NodeHeartbeatRuntime = {
  now?: () => Date;
  registryService?: NodeRegistryService;
  pairingService?: NodePairingService;
  invokeService?: NodeInvokeService;
  heartbeatIntervalMs?: number;
};

export class NodeHeartbeatService {
  private readonly now: () => Date;
  private readonly registryService: NodeRegistryService;
  private readonly pairingService: NodePairingService;
  private readonly invokeService: NodeInvokeService;
  private readonly heartbeatIntervalMs: number;

  constructor(runtime: NodeHeartbeatRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.registryService = runtime.registryService || new NodeRegistryService();
    this.pairingService = runtime.pairingService || new NodePairingService({
      now: this.now,
      registryService: this.registryService,
    });
    this.invokeService = runtime.invokeService || new NodeInvokeService({
      now: this.now,
      registryService: this.registryService,
    });
    this.heartbeatIntervalMs = Math.max(
      5000,
      Number(runtime.heartbeatIntervalMs || config.nodeMeshHeartbeatIntervalMs || 15000),
    );
  }

  public claimPairing(input: {
    nodeId: string | null | undefined;
    pairingCode?: string | null;
    capabilityIds?: string[] | null;
    hostHints?: Partial<NodeMeshHostHints> | null;
    operatorSummary?: string | null;
  }): NodeMeshPairingClaim | null {
    const claim = this.pairingService.claimPairing(input.nodeId, {
      pairingCode: input.pairingCode,
      capabilityIds: input.capabilityIds || null,
      hostHints: input.hostHints || null,
      operatorSummary: input.operatorSummary
        || 'Node host autenticado. O proximo heartbeat ja pode buscar a fila remota.',
      heartbeatIntervalMs: this.heartbeatIntervalMs,
    });
    if (!claim) {
      return null;
    }

    const node = this.registryService.recordHeartbeat(claim.node.id, {
      status: 'online',
      capabilityIds: input.capabilityIds || claim.node.capabilityIds,
      hostHints: input.hostHints || null,
    });
    if (!node) {
      return null;
    }

    return {
      ...claim,
      node,
      assignments: this.invokeService.claimPendingForNode(node.id),
      operatorSummary: node.operatorSummary || claim.operatorSummary,
      actionHint: 'Node host pareado e online. Continue publicando heartbeat para consumir a fila.',
    };
  }

  public receiveHeartbeat(input: {
    nodeId: string | null | undefined;
    sharedSecret?: string | null;
    status?: NodeMeshStatus | null;
    capabilityIds?: string[] | null;
    hostHints?: Partial<NodeMeshHostHints> | null;
    results?: NodeInvocationCompletion[] | null;
  }): NodeMeshHeartbeatResult | null {
    if (!this.pairingService.validateSharedSecret(input.nodeId, input.sharedSecret)) {
      return null;
    }

    let acceptedResults = 0;
    for (const result of input.results || []) {
      const completed = this.invokeService.completeInvocation(input.nodeId, result);
      if (completed) {
        acceptedResults += 1;
      }
    }

    const node = this.registryService.recordHeartbeat(input.nodeId, {
      status: input.status || 'online',
      capabilityIds: input.capabilityIds || null,
      hostHints: input.hostHints || null,
    });
    if (!node) {
      return null;
    }

    const assignments = this.invokeService.claimPendingForNode(node.id);
    return {
      receivedAt: this.now().toISOString(),
      node,
      heartbeatIntervalMs: this.heartbeatIntervalMs,
      operatorSummary: acceptedResults > 0
        ? `Heartbeat recebido. ${acceptedResults} resultado(s) incorporado(s) e ${assignments.length} atribuicao(oes) entregue(s).`
        : `Heartbeat recebido. ${assignments.length} atribuicao(oes) disponivel(is) na fila remota.`,
      acceptedResults,
      assignments,
    };
  }
}
