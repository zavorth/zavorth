/**
 * LLMFallbackRouter — Integration between LLMRouterService and ModelFallbackChain.
 *
 * Combines intelligent routing from LLMRouterService with progressive
 * fallback from ModelFallbackChain. When a provider fails,
 * automatically tries the next candidate with cooldown.
 *
 * Usage:
 *   const router = new LLMFallbackRouter(llmRouter);
 *   const result = await router.executeWithFallback({
 *     taskType: 'code_generation',
 *     messages: [{ role: 'user', content: 'Write a sort function' }],
 *   });
 */

import { LLMRouterService, type RoutingDecision } from './plugins/LLMRouterService.js';
import { ModelFallbackChain, type ModelCandidate, type FailureReason } from '../agents/ModelFallbackChain.js';

export interface FallbackRouterOptions {
  cooldownMs?: number;
  probeIntervalMs?: number;
}

export interface ExecuteRequest {
  taskType: string;
  messages: Array<{ role: string; content: string }>;
  requiredCapabilities?: string[];
  maxCost?: number;
  preferSpeed?: boolean;
  preferQuality?: boolean;
  excludeProviders?: string[];
  contextTokensNeeded?: number;
}

export interface ExecuteResult {
  response: string;
  routing: RoutingDecision;
  attempts: number;
  fallbackUsed: boolean;
  totalLatencyMs: number;
}

export class LLMFallbackRouter {
  private readonly llmRouter: LLMRouterService;
  private readonly fallbackChain: ModelFallbackChain;

  constructor(llmRouter: LLMRouterService, options: FallbackRouterOptions = {}) {
    this.llmRouter = llmRouter;
    this.fallbackChain = new ModelFallbackChain({
      primary: { provider: '', model: '' }, // será definido dinamicamente
      fallbacks: [],
      cooldownMs: options.cooldownMs ?? 300_000,
      probeIntervalMs: options.probeIntervalMs ?? 60_000,
    });
  }

  /**
   * Executa com fallback automático.
   */
  async executeWithFallback(
    request: ExecuteRequest,
    executor: (candidate: ModelCandidate) => Promise<string>,
  ): Promise<ExecuteResult> {
    const startTime = Date.now();
    let attempts = 0;
    let fallbackUsed = false;

    // Obter decisão de routing
    const routing = this.llmRouter.route(request.taskType, {
      required_capabilities: request.requiredCapabilities,
      max_cost: request.maxCost,
      prefer_speed: request.preferSpeed,
      prefer_quality: request.preferQuality,
      exclude_providers: request.excludeProviders,
      context_tokens_needed: request.contextTokensNeeded,
    });

    // Construir cadeia de candidatos a partir do fallback_chain do routing
    const primary: ModelCandidate = {
      provider: routing.provider,
      model: routing.model,
    };

    const fallbacks: ModelCandidate[] = routing.fallback_chain.map((modelId) => {
      const profile = this.getProfileById(modelId);
      return {
        provider: profile?.provider ?? '',
        model: profile?.model ?? modelId,
      };
    });

    const chain = new ModelFallbackChain({
      primary,
      fallbacks,
      cooldownMs: this.fallbackChain['cooldownMs'],
      probeIntervalMs: this.fallbackChain['probeIntervalMs'],
    });

    // Tentar candidatos
    while (true) {
      const candidate = chain.selectCandidate();
      if (!candidate) {
        throw new Error('Todos os providers estão em cooldown. Tente novamente mais tarde.');
      }

      attempts++;

      try {
        const response = await executor(candidate);
        chain.recordSuccess(candidate);
        return {
          response,
          routing,
          attempts,
          fallbackUsed: fallbackUsed || attempts > 1,
          totalLatencyMs: Date.now() - startTime,
        };
      } catch (error: unknown) {const reason = this.classifyError(error);
        chain.recordFailure(candidate, reason);

        if (reason === 'auth_error' || reason === 'billing') {
          fallbackUsed = true;
          continue;
        }

        if (reason === 'rate_limit') {
          fallbackUsed = true;
          continue;
        }

        // Para outros erros, tentar o próximo se disponível
        const nextCandidate = chain.selectCandidate();
        if (nextCandidate) {
          fallbackUsed = true;
          continue;
        }

        throw error;
      }
    }
  }

  private getProfileById(id: string): { provider: string; model: string } | null {
    // Buscar perfil pelo ID no LLMRouterService
    const models = this.llmRouter.listModels();
    const match = models.match(new RegExp(`${id}: ([^/]+)/([^\s]+)`));
    if (match) {
      return { provider: match[1], model: match[2] };
    }
    return null;
  }

  private classifyError(error: unknown): FailureReason {
    const message = error instanceof Error ? error.message : String(error).toLowerCase();

    if (message.includes('rate_limit') || message.includes('429') || message.includes('too many requests')) {
      return 'rate_limit';
    }
    if (message.includes('401') || message.includes('403') || message.includes('unauthorized') || message.includes('invalid_api_key')) {
      return 'auth_error';
    }
    if (message.includes('billing') || message.includes('payment') || message.includes('quota')) {
      return 'billing';
    }
    if (message.includes('timeout') || message.includes('deadline')) {
      return 'timeout';
    }
    if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('server_error')) {
      return 'server_error';
    }
    return 'unknown';
  }

  /**
   * Returns fallback router statistics.
   */
  getStats(): {
    chainSummary: ReturnType<ModelFallbackChain['getSummary']>;
    routingStats: string;
  } {
    return {
      chainSummary: this.fallbackChain.getSummary(),
      routingStats: this.llmRouter.getUsageStats(),
    };
  }
}
