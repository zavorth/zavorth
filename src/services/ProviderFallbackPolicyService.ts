import { ProviderInvocationService } from './ProviderInvocationService.js';
import { SecurityAuditLogger } from './SecurityAuditLogger.js';
import { ProviderConfigService } from './ProviderConfigService.js';
import { ErrorNormalizationService } from './ErrorNormalizationService.js';
import {
  ResilientRouteAttempt,
  ResilientRoutePolicy,
  ResilientRoutePolicyService,
  ResilientRouteTarget,
} from './ResilientRoutePolicyService.js';

export class ProviderFallbackPolicyService {
  private static instance: ProviderFallbackPolicyService;

  private constructor() {}

  public static getInstance(): ProviderFallbackPolicyService {
    if (!ProviderFallbackPolicyService.instance) {
      ProviderFallbackPolicyService.instance = new ProviderFallbackPolicyService();
    }
    return ProviderFallbackPolicyService.instance;
  }

  public async invokeWithFallback(request: any, messages: unknown[]): Promise<any> {
    const logger = new SecurityAuditLogger();
    const policyService = new ResilientRoutePolicyService();
    const policy = policyService.policyFromRequest(request);
    const workspaceId = request.workspaceId || 'system';
    const routingReceiptId = policyService.buildReceiptId(workspaceId);
    const attempts: ResilientRouteAttempt[] = [];
    const budget = policyService.evaluateBudget(policy);

    if (budget.decision === 'blocked') {
      await logger.logWorkspaceEvent({
        event: 'provider_route_budget_blocked',
        workspaceId,
        providerId: request.providerId || policy.primaryProviderId || 'unknown',
        metadata: {
          routingReceiptId,
          budgetDecision: budget.decision,
          reason: budget.reason,
          dailyBudgetCents: budget.dailyBudgetCents ?? undefined,
        },
      });
      throw new Error('budget_blocked');
    }

    const primaryRequest = policyService.applyPrimaryTarget(request, policy);
    try {
      const result = await this.invokeAttempt({
        request: primaryRequest,
        messages,
        attempts,
        logger,
        workspaceId,
        routingReceiptId,
        isFallback: false,
        timeoutMs: policy.timeoutMs,
      });
      return this.withRoutingMetadata(result, {
        routingReceiptId,
        attempts,
        fallbackUsed: false,
        budgetDecision: budget.decision,
      });
    } catch ($1: unknown) { const error = originalError; const err = originalError; const e = originalError;
      if (!request.allowFallback) {
        throw originalError;
      }

      // Check if the error is a definitive failure where fallback is unsafe/useless
      if (originalError instanceof Error && originalError.message === 'missing_key') {
        throw originalError;
      }

      const normalized = ErrorNormalizationService.getInstance().normalize(originalError);
      if (!policyService.isRetryableError(normalized.code, policy)) {
        throw originalError;
      }

      // Find another provider
      const configSvc = ProviderConfigService.getInstance();
      const allProviders = await configSvc.getProviders();
      // Use only enabled and configured (has key if required) providers as fallbacks
      const fallbackTargets = this.resolveFallbackTargets(policy, allProviders, primaryRequest.providerId);
      
      for (const target of fallbackTargets.slice(0, Math.max(0, policy.maxAttempts - attempts.length))) {
        try {
          await logger.logWorkspaceEvent({
            event: 'provider_runtime_fallback_attempted',
            workspaceId,
            metadata: {
              routingReceiptId,
              fallbackTo: target.providerId,
              fallbackModelId: target.modelId || undefined,
            },
          });
          
          const fallbackRequest: any = {
            ...request,
            providerId: target.providerId,
            modelId: target.modelId,
          };
          
          const result = await this.invokeAttempt({
            request: fallbackRequest,
            messages,
            attempts,
            logger,
            workspaceId,
            routingReceiptId,
            isFallback: true,
            timeoutMs: policy.timeoutMs,
          });
          
          await logger.logWorkspaceEvent({
            event: 'provider_runtime_fallback_succeeded',
            workspaceId,
            metadata: {
              routingReceiptId,
              fallbackUsed: target.providerId,
              fallbackModelId: target.modelId || undefined,
            },
          });

          await logger.logWorkspaceEvent({
            event: 'provider_route_fallback_succeeded',
            workspaceId,
            providerId: target.providerId,
            metadata: {
              routingReceiptId,
              attempts: attempts.length,
              originalErrorCode: normalized.code,
            },
          });
          
          return this.withRoutingMetadata(result, {
            routingReceiptId,
            attempts,
            fallbackUsed: true,
            budgetDecision: budget.decision,
          });
        } catch ($1: unknown) { const error = fallbackError; const err = fallbackError; const e = fallbackError;
          const fallbackNormalized = ErrorNormalizationService.getInstance().normalize(fallbackError);
          await logger.logWorkspaceEvent({
            event: 'provider_runtime_fallback_failed',
            workspaceId,
            metadata: {
              routingReceiptId,
              fallbackFailedOn: target.providerId,
              errorCode: fallbackNormalized.code,
            },
          });
          if (!policyService.isRetryableError(fallbackNormalized.code, policy)) {
            break;
          }
          continue;
        }
      }

      // Throw original error if all fallbacks fail or if there are no candidates
      throw originalError;
    }
  }

  private async invokeAttempt(input: {
    request: any;
    messages: unknown[];
    attempts: ResilientRouteAttempt[];
    logger: SecurityAuditLogger;
    workspaceId: string;
    routingReceiptId: string;
    isFallback: boolean;
    timeoutMs: number;
  }): Promise<any> {
    const startedAt = Date.now();
    const providerId = input.request.providerId || 'auto';
    const attempt: ResilientRouteAttempt = {
      providerId,
      modelId: input.request.modelId,
      status: 'started',
      durationMs: 0,
    };
    input.attempts.push(attempt);

    await input.logger.logWorkspaceEvent({
      event: 'provider_route_attempt_started',
      workspaceId: input.workspaceId,
      providerId,
      metadata: {
        routingReceiptId: input.routingReceiptId,
        modelId: input.request.modelId || undefined,
        isFallback: input.isFallback,
      },
    });

    try {
      const result = await this.invokeProviderWithTimeout(input.request, input.messages, input.timeoutMs);
      attempt.status = 'succeeded';
      attempt.durationMs = Date.now() - startedAt;
      await input.logger.logWorkspaceEvent({
        event: 'provider_route_attempt_succeeded',
        workspaceId: input.workspaceId,
        providerId,
        durationMs: attempt.durationMs,
        metadata: {
          routingReceiptId: input.routingReceiptId,
          modelId: input.request.modelId || undefined,
          isFallback: input.isFallback,
        },
      });
      return result;
    } catch ($1: unknown) {
      const normalized = ErrorNormalizationService.getInstance().normalize(error);
      attempt.status = 'failed';
      attempt.durationMs = Date.now() - startedAt;
      attempt.errorCode = normalized.code;
      attempt.errorMessage = normalized.message;
      await input.logger.logWorkspaceEvent({
        event: 'provider_route_attempt_failed',
        workspaceId: input.workspaceId,
        providerId,
        durationMs: attempt.durationMs,
        metadata: {
          routingReceiptId: input.routingReceiptId,
          modelId: input.request.modelId || undefined,
          isFallback: input.isFallback,
          errorCode: normalized.code,
          errorMessage: normalized.message,
        },
      });
      throw error;
    }
  }

  private async invokeProviderWithTimeout(
    request: any,
    messages: unknown[],
    timeoutMs: number,
  ): Promise<any> {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return ProviderInvocationService.getInstance().invoke(request, messages);
    }

    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race([
        ProviderInvocationService.getInstance().invoke(request, messages),
        new Promise<any>((_, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error('timeout')), timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  private resolveFallbackTargets(
    policy: ResilientRoutePolicy,
    providers: Array<{ providerId: string; enabled: boolean; requiresApiKey: boolean; secretRef?: string }>,
    primaryProviderId?: string,
  ): ResilientRouteTarget[] {
    const configuredProviderIds = new Set(providers
      .filter((provider) =>
        provider.enabled
        && provider.providerId !== primaryProviderId
        && (provider.requiresApiKey ? !!provider.secretRef : true)
      )
      .map((provider) => provider.providerId));

    if (policy.enabled && policy.fallbackOrder.length > 0) {
      return policy.fallbackOrder.filter((target) => configuredProviderIds.has(target.providerId));
    }

    return providers
      .filter((provider) => configuredProviderIds.has(provider.providerId))
      .map((provider) => ({ providerId: provider.providerId }));
  }

  private withRoutingMetadata(
    result: any,
    metadata: {
      routingReceiptId: string;
      attempts: ResilientRouteAttempt[];
      fallbackUsed: boolean;
      budgetDecision: any;
    },
  ): any {
    return {
      ...result,
      routingReceiptId: metadata.routingReceiptId,
      routingAttempts: metadata.attempts.map((attempt) => ({ ...attempt })),
      fallbackUsed: metadata.fallbackUsed,
      budgetDecision: metadata.budgetDecision,
    };
  }
}
