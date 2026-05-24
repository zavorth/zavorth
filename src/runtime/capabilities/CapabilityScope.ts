import type { EffectPolicyAction } from '../effects/EffectDecision.js';
import type { EffectResourceKind, ResourceRef } from '../effects/EffectScope.js';

export type CapabilityOperation =
  | 'read'
  | 'write'
  | 'delete'
  | 'network_egress'
  | 'secret_access'
  | 'process_spawn'
  | 'persist'
  | 'send'
  | 'observe';

export type CapabilityScope = {
  resourceKind: EffectResourceKind;
  operations: CapabilityOperation[];
  uriPrefix?: string;
};

export function capabilityAllowsResource(
  scope: CapabilityScope,
  operation: CapabilityOperation,
  resource: ResourceRef,
): boolean {
  if (scope.resourceKind !== resource.kind) {
    return false;
  }
  if (!scope.operations.includes(operation)) {
    return false;
  }
  if (!scope.uriPrefix) {
    return true;
  }
  return resource.uri.replace(/\\/g, '/').startsWith(scope.uriPrefix.replace(/\\/g, '/'));
}

export function actionToCapabilityOperation(action: EffectPolicyAction): CapabilityOperation | null {
  if (action === 'allow' || action === 'allow_with_redaction') {
    return 'observe';
  }
  if (action === 'sandbox_only' || action === 'draft_only') {
    return 'write';
  }
  return null;
}
