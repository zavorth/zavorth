import type {
  SystemOverlordAdapterResult,
  SystemOverlordRuntimeAdapter,
} from '../../contracts/SystemOverlordAdapterContract.js';
import type {
  SystemOverlordActionRequest,
  SystemOverlordCapabilityDecision,
} from '../../contracts/SystemOverlordContract.js';
import type { NodeInvocationRequest, NodeInvocationResult } from '../../contracts/NodeMeshContract.js';
import { NodeInvokeService } from '../../services/NodeInvokeService.js';
import {
  objectField,
  readStructuredInput,
  stringField,
} from './SupervisedAdapterInput.js';

type NodeInvokeServiceLike = Pick<NodeInvokeService, 'invoke' | 'preview'>;

export class SupervisedNodeInvokeAdapter implements SystemOverlordRuntimeAdapter {
  public readonly id = 'node-invoke-supervised';
  public readonly label = 'Node Invoke Supervision Adapter';
  private readonly service: NodeInvokeServiceLike;

  constructor(options: { nodeInvokeService?: NodeInvokeServiceLike } = {}) {
    this.service = options.nodeInvokeService || new NodeInvokeService();
  }

  public canHandle(
    request: SystemOverlordActionRequest,
    decision: SystemOverlordCapabilityDecision,
  ): boolean {
    return request.capability === 'node.invoke' && decision.runtimeTarget === 'node';
  }

  public async execute(
    request: SystemOverlordActionRequest,
    decision: SystemOverlordCapabilityDecision,
  ): Promise<SystemOverlordAdapterResult> {
    const input = readStructuredInput(request.command, request.metadata || null);
    const mode = stringField(input, 'mode', 'invokeMode') || 'invoke';
    const nodeId = stringField(input, 'nodeId');
    const capabilityId = stringField(input, 'capabilityId');
    const action = stringField(input, 'nodeAction', 'action');
    const payload = objectField(input, 'payload');

    if (!nodeId || !capabilityId || !action) {
      return {
        ok: false,
        errorCode: 'node_invoke_scope_required',
        errorMessage: 'node.invoke exige nodeId, capabilityId e action em payload estruturado.',
      };
    }

    const invocationRequest: NodeInvocationRequest = {
      nodeId,
      capabilityId,
      action,
      payload,
      requestedBy: request.requestedBy || null,
    };
    const result = mode === 'preview'
      ? this.service.preview(invocationRequest)
      : this.service.invoke(invocationRequest);

    return this.toAdapterResult(result, decision, mode);
  }

  private toAdapterResult(
    result: NodeInvocationResult,
    decision: SystemOverlordCapabilityDecision,
    mode: string,
  ): SystemOverlordAdapterResult {
    return {
      ok: result.ok,
      stdout: JSON.stringify(result, null, 2),
      stderr: result.ok ? null : result.reason,
      errorCode: result.ok ? null : 'node_invoke_failed',
      errorMessage: result.ok ? null : result.reason,
      rollbackAvailable: false,
      metadata: {
        adapterId: this.id,
        mode,
        runtimeTarget: decision.runtimeTarget,
        nodeId: result.nodeId,
        capabilityId: result.capabilityId,
        action: result.action,
        invocationId: result.invocationId || null,
        transport: result.transport,
      },
    };
  }
}
