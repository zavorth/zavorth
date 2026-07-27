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
import { globalLiveNodeRegistry, LiveNodeRegistryService } from './LiveNodeRegistryService.js';
import { NodeCapabilityReapprovalService } from './NodeCapabilityReapprovalService.js';

type NodeHeartbeatRuntime = {
  now?: () => Date;
  registryService?: NodeRegistryService;
  pairingService?: NodePairingService;
  invokeService?: NodeInvokeService;
  liveNodeRegistry?: LiveNodeRegistryService;
  capabilityReapprovalService?: NodeCapabilityReapprovalService;
  heartbeatIntervalMs?: number;
};

export class NodeHeartbeatService {
  private readonly now: () => Date;
  private readonly registryService: NodeRegistryService;
  private readonly pairingService: NodePairingService;
  private readonly invokeService: NodeInvokeService;
  private readonly liveNodeRegistry: LiveNodeRegistryService;
  private readonly capabilityReapprovalService: NodeCapabilityReapprovalService;
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
    this.liveNodeRegistry = runtime.liveNodeRegistry || globalLiveNodeRegistry;
    this.capabilityReapprovalService = runtime.capabilityReapprovalService || new NodeCapabilityReapprovalService({
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
        || 'Node host authenticated. The next heartbeat can now fetch the remote queue.',
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
    const assignments = this.invokeService.claimPendingForNode(node.id);
    this.liveNodeRegistry.recordClaim({
      node,
      assignmentsPending: assignments.length,
      transport: 'heartbeat',
    });

    return {
      ...claim,
      node,
      assignments,
      operatorSummary: node.operatorSummary || claim.operatorSummary,
      actionHint: 'Node host paired and online. Continue publishing heartbeats to consume the queue.',
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

    const reapproval = this.capabilityReapprovalService.reconcileHeartbeat({
      nodeId: input.nodeId,
      declaredCapabilityIds: input.capabilityIds || null,
    });
    if (reapproval && !reapproval.allowed) {
      this.liveNodeRegistry.recordReapprovalRequired({
        node: reapproval.node,
        delta: reapproval.delta,
        reason: reapproval.reason,
      });
      return {
        receivedAt: this.now().toISOString(),
        node: reapproval.node,
        heartbeatIntervalMs: this.heartbeatIntervalMs,
        operatorSummary: `${reapproval.reason} ${reapproval.commandHint}`,
        acceptedResults: 0,
        assignments: [],
      };
    }

    let acceptedResults = 0;
    for (const result of input.results || []) {
      const completed = this.invokeService.completeInvocation(input.nodeId, result);
      if (completed) {
        acceptedResults += 1;
        this.liveNodeRegistry.recordInvocationCompleted({
          nodeId: completed.nodeId,
          invocationId: completed.id,
          ok: completed.ok,
          resultSummary: completed.resultSummary,
        });
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
    this.liveNodeRegistry.recordHeartbeat({
      node,
      acceptedResults,
      assignmentsPending: assignments.length,
      transport: 'heartbeat',
    });
    return {
      receivedAt: this.now().toISOString(),
      node,
      heartbeatIntervalMs: this.heartbeatIntervalMs,
      operatorSummary: acceptedResults > 0
        ? `Heartbeat received. ${acceptedResults} result(s) incorporated and ${assignments.length} assignment(s) delivered.`
        : `Heartbeat received. ${assignments.length} assignment(s) available in the remote queue.`,
      acceptedResults,
      assignments,
    };
  }
}
