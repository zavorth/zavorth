import type {
  RuntimeAdapterAdapterBoundaryPolicy,
  RuntimeAdapterOutboundActionDecision,
  RuntimeAdapterOutboundActionEnvelope,
} from './contracts.js';

function riskyActionRequiresApproval(action: RuntimeAdapterOutboundActionEnvelope): boolean {
  return action.risk === 'danger' || action.risk === 'attention' || action.risk === 'unknown';
}

export class RuntimeAdapterSidecarActionGate {
  public evaluate(
    action: RuntimeAdapterOutboundActionEnvelope,
    boundary: RuntimeAdapterAdapterBoundaryPolicy,
  ): RuntimeAdapterOutboundActionDecision {
    if (action.replyBoundary !== 'zavorth-reply-port-only') {
      return {
        ok: false,
        reason: 'reply-pipeline-required',
        requiresApproval: true,
        actionId: action.id,
      };
    }

    if (
      boundary.mayMutateFiles
      || boundary.mayExecuteTools
      || boundary.mayLaunchWorkers
      || boundary.maySendUserFacingMessages
    ) {
      return {
        ok: false,
        reason: 'blocked-by-boundary-policy',
        requiresApproval: true,
        actionId: action.id,
      };
    }

    const requiresApproval = riskyActionRequiresApproval(action);
    if (requiresApproval && action.approval?.status !== 'approved') {
      return {
        ok: false,
        reason: 'requires-zavorth-approval',
        requiresApproval,
        actionId: action.id,
      };
    }

    return {
      ok: true,
      reason: 'allowed',
      requiresApproval,
      actionId: action.id,
    };
  }
}
