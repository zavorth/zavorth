import type { PermissionRequest } from '../../../../../contracts/PermissionRequest.js';
import type { ZavorthMutationPlan } from '../../../../../contracts/ZavorthMutationPlaneContract.js';
import type { WebAppRuntimeRouteDeps } from '../WebAppRuntimeRouteService.js';

export type GatewayApprovalScope = 'once' | 'session' | 'host';

export function normalizeGatewayApprovalScope(value: unknown): GatewayApprovalScope {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'session' || normalized === 'host') {
    return normalized;
  }
  return 'once';
}

export function resolveMutationPlanIdFromPermission(permission: PermissionRequest | null | undefined): string | null {
  const metadataPlanId = String(permission?.metadata?.plan_id || '').trim();
  if (metadataPlanId) {
    return metadataPlanId;
  }
  const taskId = String(permission?.task_id || '').trim();
  if (taskId.toLowerCase().startsWith('mutation:')) {
    return taskId.slice('mutation:'.length).trim() || null;
  }
  return null;
}

export function planTouchesSession(plan: ZavorthMutationPlan | null | undefined, sessionId: string): boolean {
  const normalizedSessionId = String(sessionId || '').trim();
  if (!normalizedSessionId || !plan || typeof plan !== 'object') {
    return false;
  }
  const payloadSessionId = String(plan.payload?.sessionId || '').trim();
  if (payloadSessionId && payloadSessionId === normalizedSessionId) {
    return true;
  }
  const payloadChatId = String(plan.payload?.chatId || '').trim();
  return payloadChatId === `web:${normalizedSessionId}`;
}

export function findLatestPlanByPayload(
  deps: WebAppRuntimeRouteDeps,
  domain: string,
  actionId: string,
  payloadMatch: Record<string, unknown>,
): ZavorthMutationPlan | null {
  if (!deps.mutationPlane) {
    return null;
  }
  const plans = deps.mutationPlane.listPlans({ limit: 40, includeExpired: false });
  for (const plan of plans) {
    if (String(plan.domain || '').trim() !== domain || String(plan.actionId || '').trim() !== actionId) {
      continue;
    }
    const payload = plan.payload && typeof plan.payload === 'object'
      ? plan.payload as Record<string, unknown>
      : {};
    const matches = Object.entries(payloadMatch).every(([key, value]) => {
      const expected = value === undefined ? null : value;
      return String(payload[key] ?? '').trim() === String(expected ?? '').trim();
    });
    if (matches) {
      return plan;
    }
  }
  return null;
}

