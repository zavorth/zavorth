import type {
  NodeInvocationCompletion,
  NodeInvocationPolicyDecision,
  NodeInvocationRecord,
  NodeInvocationRequest,
  NodeInvocationResult,
  NodeMeshCapabilityId,
  NodeMeshRegistryEntry,
} from '../contracts/NodeMeshContract.js';
import { DeviceCapabilityPolicy } from '../nodes/policy/DeviceCapabilityPolicy.js';

import { NodeCapabilityService } from './NodeCapabilityService.js';
import { NodeInvocationStoreService } from './NodeInvocationStoreService.js';
import { NodeRegistryService } from './NodeRegistryService.js';
import { CanonicalExecutionPipelineService } from './CanonicalExecutionPipelineService.js';
import { globalLiveNodeRegistry, LiveNodeRegistryService } from './LiveNodeRegistryService.js';

type NodeInvokeDevicePolicy = Pick<DeviceCapabilityPolicy, 'readPolicy'>;

type NodeInvokeRuntime = {
  now?: () => Date;
  registryService?: NodeRegistryService;
  capabilityService?: NodeCapabilityService;
  invocationStoreService?: NodeInvocationStoreService;
  canonicalExecutionPipeline?: CanonicalExecutionPipelineService;
  deviceCapabilityPolicy?: NodeInvokeDevicePolicy | null;
  liveNodeRegistry?: LiveNodeRegistryService;
};

export class NodeInvokeService {
  private readonly now: () => Date;
  private readonly registryService: NodeRegistryService;
  private readonly capabilityService: NodeCapabilityService;
  private readonly invocationStoreService: NodeInvocationStoreService;
  private readonly canonicalExecution: CanonicalExecutionPipelineService;
  private readonly deviceCapabilityPolicy: NodeInvokeDevicePolicy | null;
  private readonly liveNodeRegistry: LiveNodeRegistryService;

  constructor(runtime: NodeInvokeRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.registryService = runtime.registryService || new NodeRegistryService();
    this.capabilityService = runtime.capabilityService || new NodeCapabilityService();
    this.invocationStoreService =
      runtime.invocationStoreService ||
      new NodeInvocationStoreService({
        now: this.now,
      });
    this.canonicalExecution = runtime.canonicalExecutionPipeline || new CanonicalExecutionPipelineService();
    this.deviceCapabilityPolicy =
      runtime.deviceCapabilityPolicy === null ? null : runtime.deviceCapabilityPolicy || new DeviceCapabilityPolicy();
    this.liveNodeRegistry = runtime.liveNodeRegistry || globalLiveNodeRegistry;
  }

  public preview(request: NodeInvocationRequest): NodeInvocationResult {
    return this.evaluate(request, false);
  }

  public invoke(request: NodeInvocationRequest): NodeInvocationResult {
    return this.evaluate(request, true);
  }

  public claimPendingForNode(nodeId: string | null | undefined, limit = 4): NodeInvocationRecord[] {
    const node = this.registryService.getNode(nodeId);
    if (!node || !node.paired || node.pairingStatus !== 'paired') {
      return [];
    }
    if (node.status !== 'online' && node.status !== 'idle' && node.status !== 'offline') {
      return [];
    }
    return this.invocationStoreService.claimPending(node.id, limit);
  }

  public completeInvocation(
    nodeId: string | null | undefined,
    completion: NodeInvocationCompletion,
  ): NodeInvocationRecord | null {
    return this.invocationStoreService.complete(nodeId, completion);
  }

  public listRecent(nodeId?: string | null, limit = 12): NodeInvocationRecord[] {
    return this.invocationStoreService.listRecent(nodeId, limit);
  }

  public listActive(nodeId?: string | null, limit = 12): NodeInvocationRecord[] {
    return this.invocationStoreService.listActive(nodeId, limit);
  }

  public requeueStaleClaimed(nodeId: string | null | undefined, limit = 10): NodeInvocationRecord[] {
    const node = this.registryService.getNode(nodeId);
    if (!node || !node.paired || node.pairingStatus !== 'paired') {
      return [];
    }
    return this.invocationStoreService.requeueStaleClaimed(node.id, limit);
  }

  public summarizeNodeQueue(
    nodeId: string | null | undefined,
  ): ReturnType<NodeInvocationStoreService['summarizeNode']> {
    return this.invocationStoreService.summarizeNode(nodeId);
  }

  private evaluate(request: NodeInvocationRequest, persist: boolean): NodeInvocationResult {
    const node = this.registryService.getNode(request.nodeId);
    if (!node) {
      return this.withResultLifecycle(
        {
          ok: false,
          status: 'unavailable',
          nodeId: null,
          capabilityId: request.capabilityId,
          action: request.action,
          reason: 'Node not found in the current registry.',
          transport: null,
          commandHint: 'Register or pair the node before invoking a remote capability.',
          queuedAt: null,
        },
        request,
        null,
      );
    }

    if (!node.paired || node.pairingStatus !== 'paired') {
      return this.withResultLifecycle(
        {
          ok: false,
          status: 'blocked',
          nodeId: node.id,
          capabilityId: request.capabilityId,
          action: request.action,
          reason: 'The node has not finished pairing and remains outside the remote plane.',
          transport: node.transport,
          commandHint: 'Finish node pairing before allowing remote invocations.',
          queuedAt: null,
        },
        request,
        null,
      );
    }

    const policyDecision = this.resolvePolicyDecision(node, request.capabilityId);
    if (!policyDecision.capabilityDeclared) {
      const capability = this.capabilityService.describeCapability(request.capabilityId);
      return this.withResultLifecycle(
        {
          ok: false,
          status: 'blocked',
          nodeId: node.id,
          capabilityId: request.capabilityId,
          action: request.action,
          reason: `The paired node did not declare the ${capability.label} capability.`,
          transport: node.transport,
          commandHint: 'Update the node capability catalog before invocation.',
          queuedAt: null,
          policyDecision,
        },
        request,
        null,
      );
    }

    if (!policyDecision.capabilityAllowed) {
      const capability = this.capabilityService.describeCapability(request.capabilityId);
      return this.withResultLifecycle(
        {
          ok: false,
          status: 'blocked',
          nodeId: node.id,
          capabilityId: request.capabilityId,
          action: request.action,
          reason: this.buildPolicyBlockedReason(policyDecision, capability.label),
          transport: node.transport,
          commandHint: this.buildPolicyBlockedHint(policyDecision),
          queuedAt: null,
          policyDecision,
        },
        request,
        null,
      );
    }

    const queuedAt = this.now().toISOString();
    const record = persist
      ? this.invocationStoreService.enqueue({
          nodeId: node.id,
          capabilityId: request.capabilityId,
          action: request.action,
          payload: request.payload || null,
          requestedBy: request.requestedBy || null,
          transport: node.transport,
          surface: request.surface || 'node-mesh',
          sessionId: request.sessionId || request.correlation?.sessionId || null,
          traceId: request.correlation?.traceId || null,
          runId: request.correlation?.runId || null,
          approvalId: request.correlation?.approvalId || null,
          artifactId: request.correlation?.artifactId || null,
        })
      : null;

    const result = this.withResultLifecycle(
      {
        ok: true,
        status: 'queued',
        nodeId: node.id,
        capabilityId: request.capabilityId,
        action: request.action,
        reason: persist
          ? node.status === 'online' || node.status === 'idle'
            ? 'Invocation queued on the Node Mesh. The node host will receive it on the next heartbeat.'
            : 'Invocation queued on the Node Mesh. It will be delivered when the node publishes heartbeat again.'
          : node.status === 'online' || node.status === 'idle'
            ? 'The node is online and ready to accept remote invocations.'
            : 'The node accepts a remote queue, but must resume heartbeat to consume the invocation.',
        transport: node.transport,
        commandHint: persist
          ? node.status === 'online' || node.status === 'idle'
            ? 'Watch the next node heartbeat for the result of this invocation.'
            : 'Bring the node host back online to drain the pending queue and return the result.'
          : 'Use invoke() to actually enqueue the remote invocation.',
        queuedAt: record?.queuedAt || queuedAt,
        invocationId: record?.id || null,
        policyDecision,
      },
      request,
      record,
    );
    if (persist) {
      this.liveNodeRegistry.recordInvocationQueued({
        nodeId: result.nodeId,
        invocationId: result.invocationId,
        capabilityId: result.capabilityId,
        action: result.action,
        status: result.status,
      });
    }
    return result;
  }

  private resolvePolicyDecision(
    node: NodeMeshRegistryEntry,
    capabilityId: NodeMeshCapabilityId,
  ): NodeInvocationPolicyDecision {
    const declaredCapabilityIds = this.capabilityService.normalizeCapabilityIds(node.capabilityIds);
    const registryApproved = this.capabilityService.normalizeCapabilityIds(node.approvedCapabilityIds || []);
    const devicePolicy = this.deviceCapabilityPolicy?.readPolicy(node.id) || null;
    const allowedCapabilityIds =
      registryApproved.length > 0
        ? registryApproved
        : devicePolicy
          ? this.capabilityService.normalizeCapabilityIds(devicePolicy.allowedCapabilities)
          : declaredCapabilityIds;
    const source =
      registryApproved.length > 0
        ? 'registry-approved-capabilities'
        : devicePolicy ? 'device-capability-policy'
          : 'declared-capabilities-fallback';

    return {
      source,
      nodeId: node.id,
      capabilityId,
      declaredCapabilityIds,
      allowedCapabilityIds,
      capabilityDeclared: declaredCapabilityIds.includes(capabilityId),
      capabilityAllowed: allowedCapabilityIds.includes(capabilityId),
      policyRequired: source !== 'declared-capabilities-fallback',
      bypassed: false,
    };
  }

  private buildPolicyBlockedReason(decision: NodeInvocationPolicyDecision, capabilityLabel: string): string {
    if (decision.source === 'device-capability-policy') {
      return `The node DeviceCapabilityPolicy did not approve the ${capabilityLabel} capability.`;
    }
    return `The node allowlist did not approve the ${capabilityLabel} capability.`;
  }

  private buildPolicyBlockedHint(decision: NodeInvocationPolicyDecision): string {
    if (decision.source === 'device-capability-policy') {
      return 'Update the node DeviceCapabilityPolicy before allowing this invocation.';
    }
    return 'Update the approved node allowlist before allowing this invocation.';
  }

  private withResultLifecycle(
    result: NodeInvocationResult,
    request: NodeInvocationRequest,
    record: NodeInvocationRecord | null,
  ): NodeInvocationResult {
    const link =
      record?.execution_lifecycle && record.traceId && record.runId
        ? {
            traceId: record.traceId,
            runId: record.runId,
            sessionId: record.sessionId || null,
            approvalId: record.approvalId || null,
            artifactId: record.artifactId || null,
            lifecycle: record.execution_lifecycle,
          }
        : this.canonicalExecution.buildLink({
            engine: 'node-invoke',
            kind: 'execution',
            id:
              record?.id || `node-invoke:${result.nodeId || request.nodeId}:${request.capabilityId}:${request.action}`,
            status: this.canonicalExecution.mapNodeInvocationStatus(result.status),
            summary: result.reason,
            requestedBy: request.requestedBy || null,
            surface: request.surface || 'node-mesh',
            traceId: request.correlation?.traceId || null,
            runId: request.correlation?.runId || record?.id || null,
            sessionId: request.sessionId || request.correlation?.sessionId || null,
            approvalId: request.correlation?.approvalId || null,
            artifactId: request.correlation?.artifactId || null,
            metadata: {
              nodeId: result.nodeId || request.nodeId,
              capabilityId: request.capabilityId,
              action: request.action,
              transport: result.transport,
              policyDecision: result.policyDecision || null,
            },
          });
    return {
      ...result,
      traceId: link.traceId,
      runId: link.runId,
      sessionId: link.sessionId,
      approvalId: link.approvalId,
      artifactId: link.artifactId,
      execution_lifecycle: link.lifecycle,
    };
  }
}
