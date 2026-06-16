import { ProviderInvocationService } from './ProviderInvocationService.js';
import { SecurityAuditLogger } from './SecurityAuditLogger.js';
import { ProviderRuntimeRequest } from './ModelSelectionService.js';
import { ProviderConfigService } from './ProviderConfigService.js';
import { ProviderInvocationResult } from './ProviderRuntimeClientFactory.js';
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

  public async invokeWithFallback(request: ProviderRuntimeRequest, messages: unknown[]): Promise<ProviderInvocationResult> {
    const logger = new SecurityAuditLogger();
    const policyService = new ResilientRoutePolicyService();
    const policy = policyService.policyFromRequest(request);
    const workspaceId = request.workspaceId || 'system';
    const routingReceiptId = policyService.buildReceiptId(workspaceId);
    const attempts: ResilientRouteAttempt[] = [];
    const budget = policyService.evaluateBudget(policy);

    if (budget.decision === 'blocked') {
      await logger.logWorkspaceEvent({
        event: 'provider_route_budget_blocked' as any,
        workspaceId,
        providerId: request.providerId || policy.primaryProviderId || 'unknown',
        metadata: {
          routingReceiptId,
          budgetDecision: budget.decision,
          reason: budget.reason,
          dailyBudgetCents: budget.dailyBudgetCents ?? null,
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
    } catch (originalError: any) {
      if (!request.allowFallback) {
        throw originalError;
      }

      // Check if the error is a definitive failure where fallback is unsafe/useless
      // Rule: fallback nunca pula missing_key para remoto sem key
      if (originalError.message === 'missing_key') {
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
            event: 'provider_runtime_fallback_attempted' as any,
            workspaceId,
            metadata: {
              routingReceiptId,
              fallbackTo: target.providerId,
              fallbackModelId: target.modelId || null,
            }
          });
          
          const fallbackRequest: ProviderRuntimeRequest = {
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
            event: 'provider_runtime_fallback_succeeded' as any,
            workspaceId,
            metadata: {
              routingReceiptId,
              fallbackUsed: target.providerId,
              fallbackModelId: target.modelId || null,
            }
          });

          await logger.logWorkspaceEvent({
            event: 'provider_route_fallback_succeeded' as any,
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
        } catch (fallbackError: any) {
          const fallbackNormalized = ErrorNormalizationService.getInstance().normalize(fallbackError);
          await logger.logWorkspaceEvent({
            event: 'provider_runtime_fallback_failed' as any,
            workspaceId,
            metadata: {
              routingReceiptId,
              fallbackFailedOn: target.providerId,
              errorCode: fallbackNormalized.code,
            }
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
    request: ProviderRuntimeRequest;
    messages: unknown[];
    attempts: ResilientRouteAttempt[];
    logger: SecurityAuditLogger;
    workspaceId: string;
    routingReceiptId: string;
    isFallback: boolean;
    timeoutMs: number;
  }): Promise<ProviderInvocationResult> {
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
      event: 'provider_route_attempt_started' as any,
      workspaceId: input.workspaceId,
      providerId,
      metadata: {
        routingReceiptId: input.routingReceiptId,
        modelId: input.request.modelId || null,
        isFallback: input.isFallback,
      },
    });

    try {
      const result = await this.invokeProviderWithTimeout(input.request, input.messages, input.timeoutMs);
      attempt.status = 'succeeded';
      attempt.durationMs = Date.now() - startedAt;
      await input.logger.logWorkspaceEvent({
        event: 'provider_route_attempt_succeeded' as any,
        workspaceId: input.workspaceId,
        providerId,
        durationMs: attempt.durationMs,
        metadata: {
          routingReceiptId: input.routingReceiptId,
          modelId: input.request.modelId || null,
          isFallback: input.isFallback,
        },
      });
      return result;
    } catch (error) {
      const normalized = ErrorNormalizationService.getInstance().normalize(error);
      attempt.status = 'failed';
      attempt.durationMs = Date.now() - startedAt;
      attempt.errorCode = normalized.code;
      attempt.errorMessage = normalized.message;
      await input.logger.logWorkspaceEvent({
        event: 'provider_route_attempt_failed' as any,
        workspaceId: input.workspaceId,
        providerId,
        durationMs: attempt.durationMs,
        metadata: {
          routingReceiptId: input.routingReceiptId,
          modelId: input.request.modelId || null,
          isFallback: input.isFallback,
          errorCode: normalized.code,
          errorMessage: normalized.message,
        },
      });
      throw error;
    }
  }

  private async invokeProviderWithTimeout(
    request: ProviderRuntimeRequest,
    messages: unknown[],
    timeoutMs: number,
  ): Promise<ProviderInvocationResult> {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return ProviderInvocationService.getInstance().invoke(request, messages);
    }

    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race([
        ProviderInvocationService.getInstance().invoke(request, messages),
        new Promise<ProviderInvocationResult>((_, reject) => {
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
    result: ProviderInvocationResult,
    metadata: {
      routingReceiptId: string;
      attempts: ResilientRouteAttempt[];
      fallbackUsed: boolean;
      budgetDecision: ProviderInvocationResult['budgetDecision'];
    },
  ): ProviderInvocationResult {
    return {
      ...result,
      routingReceiptId: metadata.routingReceiptId,
      routingAttempts: metadata.attempts.map((attempt) => ({ ...attempt })),
      fallbackUsed: metadata.fallbackUsed,
      budgetDecision: metadata.budgetDecision,
    };
  }
}
