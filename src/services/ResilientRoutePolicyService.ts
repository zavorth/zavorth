import type { ProviderRuntimeRequest } from './ModelSelectionService.js';
import { ZavorthModelCostGuardService } from './ZavorthModelCostGuardService.js';
import { logger } from '../logger.js';

export const DEFAULT_RESILIENT_ROUTE_TIMEOUT_MS = 30_000;
export const DEFAULT_RESILIENT_ROUTE_MAX_ATTEMPTS = 3;
export const DEFAULT_RESILIENT_RETRYABLE_ERROR_CODES = [
  'timeout',
  'rate_limited',
  'provider_unavailable',
  'server_error',
];

export type ResilientRouteBudgetDecision = 'allowed' | 'warned' | 'blocked';

export type ResilientRouteTarget = {
  providerId: string;
  modelId?: string;
};

export type ResilientRoutePolicy = {
  enabled: boolean;
  primaryProviderId?: string;
  primaryModelId?: string;
  fallbackOrder: ResilientRouteTarget[];
  timeoutMs: number;
  maxAttempts: number;
  dailyBudgetCents?: number;
  retryableErrorCodes: string[];
};

export type ResilientRouteAttempt = {
  providerId: string;
  modelId?: string;
  status: 'started' | 'succeeded' | 'failed' | 'blocked';
  durationMs: number;
  errorCode?: string;
  errorMessage?: string;
};

export type ResilientRouteBudgetEvaluation = {
  decision: ResilientRouteBudgetDecision;
  reason: string;
  dailyBudgetCents?: number;
  receiptLine?: string;
};

const NON_RETRYABLE_CODES = new Set([
  'missing_key',
  'invalid_key',
  'prompt_injection_detected',
  'injection_detected',
  'security_guard_unavailable',
  'policy_denied',
  'auth_denied',
  'approval_required',
  'critical_confirmation_required',
  'invalid_payload',
  'validation_error',
  'path_traversal',
  'cross_workspace_access',
]);

export class ResilientRoutePolicyService {
  public normalizePolicy(input?: Partial<ResilientRoutePolicy> | null): ResilientRoutePolicy {
    const timeoutMs = input?.timeoutMs ?? DEFAULT_RESILIENT_ROUTE_TIMEOUT_MS;
    const maxAttempts = input?.maxAttempts ?? DEFAULT_RESILIENT_ROUTE_MAX_ATTEMPTS;

    if (!Number.isFinite(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 300_000) {
      throw new Error('invalid_resilience_timeout');
    }
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) {
      throw new Error('invalid_resilience_attempts');
    }

    const policy: ResilientRoutePolicy = {
      enabled: input?.enabled === true,
      fallbackOrder: this.dedupeTargets(input?.fallbackOrder || []),
      timeoutMs,
      maxAttempts,
      retryableErrorCodes: this.normalizeRetryableCodes(input?.retryableErrorCodes),
    };

    if (clean(input?.primaryProviderId)) policy.primaryProviderId = clean(input?.primaryProviderId);
    if (clean(input?.primaryModelId)) policy.primaryModelId = clean(input?.primaryModelId);
    if (typeof input?.dailyBudgetCents === 'number' && Number.isFinite(input.dailyBudgetCents)) {
      policy.dailyBudgetCents = Math.max(0, Math.floor(input.dailyBudgetCents));
    }

    return policy;
  }

  public policyFromRequest(request: ProviderRuntimeRequest): ResilientRoutePolicy {
    return this.normalizePolicy(request.resiliencePolicy || {
      enabled: request.allowFallback === true,
    });
  }

  public evaluateBudget(policy: ResilientRoutePolicy): ResilientRouteBudgetEvaluation {
    const receiptLine = this.buildCostGuardReceiptLine(policy);
    if (typeof policy.dailyBudgetCents === 'number' && policy.dailyBudgetCents <= 0) {
      return {
        decision: 'blocked',
        reason: 'daily_budget_exhausted',
        dailyBudgetCents: policy.dailyBudgetCents,
        receiptLine,
      };
    }

    return {
      decision: 'allowed',
      reason: 'within_budget',
      dailyBudgetCents: policy.dailyBudgetCents,
      receiptLine,
    };
  }

  public isRetryableError(errorCode: string, policy: ResilientRoutePolicy): boolean {
    const code = clean(errorCode).toLowerCase();
    if (!code || NON_RETRYABLE_CODES.has(code)) {
      return false;
    }
    if (code.includes('security') || code.includes('auth') || code.includes('policy') || code.includes('payload')) {
      return false;
    }
    return policy.retryableErrorCodes.includes(code);
  }

  public buildReceiptId(workspaceId: string, startedAt = new Date()): string {
    return `provider-route:${workspaceId}:${startedAt.toISOString()}`;
  }

  public applyPrimaryTarget(request: ProviderRuntimeRequest, policy: ResilientRoutePolicy): ProviderRuntimeRequest {
    return {
      ...request,
      providerId: policy.primaryProviderId || request.providerId,
      modelId: policy.primaryModelId || request.modelId,
    };
  }

  private dedupeTargets(targets: ResilientRouteTarget[]): ResilientRouteTarget[] {
    const seen = new Set<string>();
    const result: ResilientRouteTarget[] = [];
    for (const target of targets) {
      const providerId = clean(target.providerId);
      if (!providerId) continue;
      const modelId = clean(target.modelId);
      const key = `${providerId}:${modelId || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(modelId ? { providerId, modelId } : { providerId });
    }
    return result;
  }

  private normalizeRetryableCodes(codes?: string[]): string[] {
    const source = Array.isArray(codes) && codes.length > 0
      ? codes
      : DEFAULT_RESILIENT_RETRYABLE_ERROR_CODES;
    return [...new Set(source.map((code) => clean(code).toLowerCase()).filter(Boolean))];
  }

  private buildCostGuardReceiptLine(policy: ResilientRoutePolicy): string {
    try {
      const provider = policy.primaryProviderId || policy.fallbackOrder[0]?.providerId || null;
      const contract = new ZavorthModelCostGuardService().buildContract({
        provider,
        maxCents: policy.dailyBudgetCents,
        request: 'resilient provider route',
      });
      return contract.userFacingCopy.receiptLine;
    } catch (error: unknown) {logger.warn('[Resilient] creation failed', error); return 'Cost guard: unavailable; deterministic resilience budget still applied.'; }
  }
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
