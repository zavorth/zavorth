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

type NodeInvokeDevicePolicy = Pick<DeviceCapabilityPolicy, 'readPolicy'>;

type NodeInvokeRuntime = {
  now?: () => Date;
  registryService?: NodeRegistryService;
  capabilityService?: NodeCapabilityService;
  invocationStoreService?: NodeInvocationStoreService;
  canonicalExecutionPipeline?: CanonicalExecutionPipelineService;
  deviceCapabilityPolicy?: NodeInvokeDevicePolicy | null;
};

export class NodeInvokeService {
  private readonly now: () => Date;
  private readonly registryService: NodeRegistryService;
  private readonly capabilityService: NodeCapabilityService;
  private readonly invocationStoreService: NodeInvocationStoreService;
  private readonly canonicalExecution: CanonicalExecutionPipelineService;
  private readonly deviceCapabilityPolicy: NodeInvokeDevicePolicy | null;

  constructor(runtime: NodeInvokeRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.registryService = runtime.registryService || new NodeRegistryService();
    this.capabilityService = runtime.capabilityService || new NodeCapabilityService();
    this.invocationStoreService = runtime.invocationStoreService || new NodeInvocationStoreService({
      now: this.now,
    });
    this.canonicalExecution = runtime.canonicalExecutionPipeline || new CanonicalExecutionPipelineService();
    this.deviceCapabilityPolicy = runtime.deviceCapabilityPolicy === null
      ? null
      : runtime.deviceCapabilityPolicy || new DeviceCapabilityPolicy();
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

  public summarizeNodeQueue(nodeId: string | null | undefined): ReturnType<NodeInvocationStoreService['summarizeNode']> {
    return this.invocationStoreService.summarizeNode(nodeId);
  }

  private evaluate(request: NodeInvocationRequest, persist: boolean): NodeInvocationResult {
    const node = this.registryService.getNode(request.nodeId);
    if (!node) {
      return this.withResultLifecycle({
        ok: false,
        status: 'unavailable',
        nodeId: null,
        capabilityId: request.capabilityId,
        action: request.action,
        reason: 'Node nao encontrado no registry atual.',
        transport: null,
        commandHint: 'Registre ou pareie o node antes de tentar invocar uma capacidade remota.',
        queuedAt: null,
      }, request, null);
    }

    if (!node.paired || node.pairingStatus !== 'paired') {
      return this.withResultLifecycle({
        ok: false,
        status: 'blocked',
        nodeId: node.id,
        capabilityId: request.capabilityId,
        action: request.action,
        reason: 'O node ainda nao concluiu o pareamento e segue fora do plano remoto.',
        transport: node.transport,
        commandHint: 'Finalize o pairing do node antes de liberar invocacoes remotas.',
        queuedAt: null,
      }, request, null);
    }

    const policyDecision = this.resolvePolicyDecision(node, request.capabilityId);
    if (!policyDecision.capabilityDeclared) {
      const capability = this.capabilityService.describeCapability(request.capabilityId);
      return this.withResultLifecycle({
        ok: false,
        status: 'blocked',
        nodeId: node.id,
        capabilityId: request.capabilityId,
        action: request.action,
        reason: `O node pareado nao declarou a capability ${capability.label}.`,
        transport: node.transport,
        commandHint: 'Atualize o catalogo de capabilities do node antes da invocacao.',
        queuedAt: null,
        policyDecision,
      }, request, null);
    }

    if (!policyDecision.capabilityAllowed) {
      const capability = this.capabilityService.describeCapability(request.capabilityId);
      return this.withResultLifecycle({
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
      }, request, null);
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

    return this.withResultLifecycle({
      ok: true,
      status: 'queued',
      nodeId: node.id,
      capabilityId: request.capabilityId,
      action: request.action,
      reason: persist
        ? (node.status === 'online' || node.status === 'idle'
            ? 'Invocacao colocada na fila do Node Mesh. O node host vai recebe-la no proximo heartbeat.'
            : 'Invocacao colocada na fila do Node Mesh. Ela sera entregue quando o node voltar a publicar heartbeat.')
        : (node.status === 'online' || node.status === 'idle'
            ? 'O node esta online e pronto para aceitar invocacoes remotas.'
            : 'O node aceita fila remota, mas precisa religar o heartbeat para consumir a invocacao.'),
      transport: node.transport,
      commandHint: persist
        ? (node.status === 'online' || node.status === 'idle'
            ? 'Acompanhe o proximo heartbeat do node para ver o resultado desta invocacao.'
            : 'Religue o node host para consumir a fila pendente e devolver o resultado.')
        : 'Use invoke() para realmente enfileirar a invocacao remota.',
      queuedAt: record?.queuedAt || queuedAt,
      invocationId: record?.id || null,
      policyDecision,
    }, request, record);
  }

  private resolvePolicyDecision(
    node: NodeMeshRegistryEntry,
    capabilityId: NodeMeshCapabilityId,
  ): NodeInvocationPolicyDecision {
    const declaredCapabilityIds = this.capabilityService.normalizeCapabilityIds(node.capabilityIds);
    const registryApproved = this.capabilityService.normalizeCapabilityIds(node.approvedCapabilityIds || []);
    const devicePolicy = this.deviceCapabilityPolicy?.readPolicy(node.id) || null;
    const allowedCapabilityIds = registryApproved.length > 0
      ? registryApproved
      : devicePolicy
        ? this.capabilityService.normalizeCapabilityIds(devicePolicy.allowedCapabilities)
        : declaredCapabilityIds;
    const source = registryApproved.length > 0
      ? 'registry-approved-capabilities'
      : devicePolicy
        ? 'device-capability-policy'
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

  private buildPolicyBlockedReason(
    decision: NodeInvocationPolicyDecision,
    capabilityLabel: string,
  ): string {
    if (decision.source === 'device-capability-policy') {
      return `A DeviceCapabilityPolicy do node nao aprovou a capability ${capabilityLabel}.`;
    }
    return `A allowlist do node nao aprovou a capability ${capabilityLabel}.`;
  }

  private buildPolicyBlockedHint(decision: NodeInvocationPolicyDecision): string {
    if (decision.source === 'device-capability-policy') {
      return 'Atualize a DeviceCapabilityPolicy do node antes de liberar esta invocacao.';
    }
    return 'Atualize a allowlist aprovada do node antes de liberar esta invocacao.';
  }

  private withResultLifecycle(
    result: NodeInvocationResult,
    request: NodeInvocationRequest,
    record: NodeInvocationRecord | null,
  ): NodeInvocationResult {
    const link = record?.execution_lifecycle && record.traceId && record.runId
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
          id: record?.id || `node-invoke:${result.nodeId || request.nodeId}:${request.capabilityId}:${request.action}`,
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
