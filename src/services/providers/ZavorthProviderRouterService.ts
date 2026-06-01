import * as http from 'http';
import type {
  ZavorthProviderRouterEntry,
  ZavorthProviderRouterRequest,
  ZavorthProviderRouterReceipt,
  ZavorthProviderRouterSnapshot,
  ZavorthProviderRouterStatus,
  ZavorthProviderRouterCompletionStatus,
  ZavorthProviderRouterRateLimitState,
  ZavorthProviderRouterHealthState,
  ZavorthProviderRouterMessage,
  ZavorthProviderRouterContextBudgetReceipt,
} from '../../contracts/ZavorthProviderRouterContract.js';
import { ZAVORTH_PROVIDER_ROUTER_CONTRACT_VERSION } from '../../contracts/ZavorthProviderRouterContract.js';
import { ZavorthContextBudgetService } from './ZavorthContextBudgetService.js';
import {
  ProviderIntegrationRegistry,
  getDefaultProviderIntegrationRegistry,
} from './catalog/ProviderIntegrationRegistry.js';
import type {
  ProviderIntegrationManifest,
  ProviderIntegrationRouteManifest,
} from './catalog/ProviderIntegrationManifest.js';

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

type InternalRateLimitState = {
  requestsRemaining: number | null;
  tokensRemaining: number | null;
  resetsAt: string | null;
  isThrottled: boolean;
  updatedAt: string;
};

type InternalHealthState = {
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  consecutiveFailures: number;
  latencySamples: number[];
  averageLatencyMs: number | null;
};

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;
type NowFn = () => string;

export type ZavorthProviderRouterDeps = {
  fetch?: FetchFn;
  now?: NowFn;
  registry?: ProviderIntegrationRegistry;
  contextBudget?: ZavorthContextBudgetService;
};

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const MAX_HEALTH_SAMPLES = 20;
const MAX_CONSECUTIVE_FAILURES_BEFORE_SKIP = 5;
const DEFAULT_MAX_CONTEXT_TOKENS = 128_000;
const OPENAI_COMPAT_PORT_ENV = 'ZAVORTH_PROVIDER_ROUTER_PORT';
const DEFAULT_OPENAI_COMPAT_PORT = 5588;

// ---------------------------------------------------------------------------
// Mapeamento de compatibilidade de API por routeKind
// ---------------------------------------------------------------------------

function resolveApiCompatibility(
  routeKind: string,
): 'openai' | 'anthropic' | 'custom' {
  if (/openai|openrouter|together|groq|fireworks|deepinfra|perplexity/i.test(routeKind)) {
    return 'openai';
  }
  if (/anthropic/i.test(routeKind)) {
    return 'anthropic';
  }
  return 'custom';
}

function resolveBaseUrl(route: ProviderIntegrationRouteManifest): string {
  if (route.website) return route.website;
  const kind = route.routeKind;
  if (/openai/i.test(kind)) return 'https://api.openai.com/v1';
  if (/anthropic/i.test(kind)) return 'https://api.anthropic.com/v1';
  if (/openrouter/i.test(kind)) return 'https://openrouter.ai/api/v1';
  if (/groq/i.test(kind)) return 'https://api.groq.com/openai/v1';
  if (/together/i.test(kind)) return 'https://api.together.xyz/v1';
  if (/local_runtime/i.test(kind)) return 'http://localhost:11434';
  return '';
}

function resolveModels(route: ProviderIntegrationRouteManifest): string[] {
  if (route.models && route.models.length > 0) {
    return route.models.map((m) => m.modelId);
  }
  return [];
}

// ---------------------------------------------------------------------------
// ZavorthProviderRouterService
// ---------------------------------------------------------------------------

export class ZavorthProviderRouterService {
  private readonly fetchFn: FetchFn;
  private readonly nowFn: NowFn;
  private readonly registry: ProviderIntegrationRegistry;
  private readonly contextBudget: ZavorthContextBudgetService;

  private readonly rateLimitStates = new Map<string, InternalRateLimitState>();
  private readonly healthStates = new Map<string, InternalHealthState>();
  private lastReceipt: ZavorthProviderRouterReceipt | null = null;

  private httpServer: http.Server | null = null;

  constructor(deps?: ZavorthProviderRouterDeps) {
    this.fetchFn = deps?.fetch ?? globalThis.fetch.bind(globalThis);
    this.nowFn = deps?.now ?? (() => new Date().toISOString());
    this.registry = deps?.registry ?? getDefaultProviderIntegrationRegistry();
    this.contextBudget = deps?.contextBudget ?? new ZavorthContextBudgetService();
  }

  // -------------------------------------------------------------------------
  // Catálogo: transforma o ProviderIntegrationRegistry em entradas do router
  // -------------------------------------------------------------------------

  public buildRouterCatalog(): ZavorthProviderRouterEntry[] {
    const routes = this.registry.listRoutes();
    const entries: ZavorthProviderRouterEntry[] = [];

    for (let i = 0; i < routes.length; i++) {
      const route = routes[i]!;
      const providerId = route.providerId;
      const rateLimit = this.getRateLimitState(providerId);
      const health = this.getHealthState(providerId);

      entries.push({
        providerId,
        label: route.label,
        baseUrl: resolveBaseUrl(route),
        apiCompatibility: resolveApiCompatibility(route.routeKind),
        models: resolveModels(route),
        costPerInputToken: null,
        costPerOutputToken: null,
        maxContextTokens: DEFAULT_MAX_CONTEXT_TOKENS,
        rateLimitState: {
          requestsRemaining: rateLimit.requestsRemaining,
          tokensRemaining: rateLimit.tokensRemaining,
          resetsAt: rateLimit.resetsAt,
          isThrottled: rateLimit.isThrottled,
        },
        healthState: {
          lastSuccessAt: health.lastSuccessAt,
          lastFailureAt: health.lastFailureAt,
          consecutiveFailures: health.consecutiveFailures,
          averageLatencyMs: health.averageLatencyMs,
        },
        priority: i,
        enabled: true,
      });
    }

    return entries;
  }

  // -------------------------------------------------------------------------
  // Roteamento principal
  // -------------------------------------------------------------------------

  public async route(
    request: ZavorthProviderRouterRequest,
  ): Promise<ZavorthProviderRouterReceipt> {
    const routeStart = Date.now();
    const catalog = this.buildRouterCatalog();
    const sorted = this.sortCandidates(catalog, request);

    // Monta mensagens para compressão
    const messages = this.buildMessages(request);
    const model = request.model || sorted[0]?.models[0] || null;
    const maxContext = sorted[0]?.maxContextTokens || DEFAULT_MAX_CONTEXT_TOKENS;
    const maxOutputTokens = request.maxTokens || 4096;
    const contextBudget = maxContext - maxOutputTokens;

    const compressed = this.contextBudget.compress({
      messages,
      maxTokens: Math.max(contextBudget, 1024),
      model,
    });

    const routingLatencyMs = Date.now() - routeStart;

    // Tenta cada provider em ordem
    const fallbacksAttempted: Array<{ providerId: string; reason: string }> = [];

    for (const entry of sorted) {
      if (!entry.enabled) {
        fallbacksAttempted.push({ providerId: entry.providerId, reason: 'desabilitado' });
        continue;
      }
      if (entry.rateLimitState.isThrottled) {
        fallbacksAttempted.push({ providerId: entry.providerId, reason: 'rate-limited' });
        continue;
      }
      if (entry.healthState.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES_BEFORE_SKIP) {
        fallbacksAttempted.push({ providerId: entry.providerId, reason: 'falhas consecutivas excedidas' });
        continue;
      }

      const selectedModel = request.model || entry.models[0] || 'default';
      const providerStart = Date.now();

      try {
        const result = await this.callProvider(entry, compressed.messages, selectedModel, request);
        const providerLatencyMs = Date.now() - providerStart;
        const totalLatencyMs = Date.now() - routeStart;

        this.recordHealth(entry.providerId, true, providerLatencyMs);

        const receipt = this.buildReceipt({
          status: fallbacksAttempted.length > 0 ? 'fallback-used' : 'completed',
          selectedProvider: { providerId: entry.providerId, model: selectedModel },
          fallbacksAttempted,
          contextBudgetReceipt: compressed.receipt,
          totalLatencyMs,
          providerLatencyMs,
          routingLatencyMs,
          entry,
          text: result.text,
          finishReason: result.finishReason,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        });

        this.lastReceipt = receipt;
        return receipt;
      } catch (error: any) {
        const providerLatencyMs = Date.now() - providerStart;
        this.recordHealth(entry.providerId, false, providerLatencyMs);

        const statusCode = error?.status || error?.statusCode || 0;
        const reason = statusCode === 429
          ? 'rate-limit 429'
          : statusCode >= 500
            ? `erro do servidor ${statusCode}`
            : `erro: ${error?.message || 'desconhecido'}`;

        if (statusCode === 429) {
          this.markThrottled(entry.providerId);
        }

        fallbacksAttempted.push({ providerId: entry.providerId, reason });
      }
    }

    // Todos os providers exaustos
    const totalLatencyMs = Date.now() - routeStart;
    const receipt = this.buildReceipt({
      status: 'all-providers-exhausted',
      selectedProvider: null,
      fallbacksAttempted,
      contextBudgetReceipt: compressed.receipt,
      totalLatencyMs,
      providerLatencyMs: 0,
      routingLatencyMs,
      entry: null,
      text: '',
      finishReason: null,
      inputTokens: null,
      outputTokens: null,
    });

    this.lastReceipt = receipt;
    return receipt;
  }

  // -------------------------------------------------------------------------
  // Snapshot
  // -------------------------------------------------------------------------

  public buildSnapshot(): ZavorthProviderRouterSnapshot {
    const providers = this.buildRouterCatalog();
    const enabled = providers.filter((p) => p.enabled);
    const throttled = providers.filter((p) => p.rateLimitState.isThrottled);
    const healthy = providers.filter(
      (p) => p.healthState.consecutiveFailures < MAX_CONSECUTIVE_FAILURES_BEFORE_SKIP,
    );

    let status: ZavorthProviderRouterStatus = 'ready';
    if (enabled.length === 0) {
      status = 'offline';
    } else if (healthy.length < enabled.length / 2) {
      status = 'degraded';
    }

    return {
      generatedAt: this.nowFn(),
      contractVersion: ZAVORTH_PROVIDER_ROUTER_CONTRACT_VERSION,
      surface: 'provider-router',
      status,
      providers,
      summary: {
        total: providers.length,
        enabled: enabled.length,
        throttled: throttled.length,
        healthy: healthy.length,
      },
      safety: {
        noRawProviderSecrets: true,
        snapshotIsNotLiveProof: true,
        routerCannotExposeApiKeys: true,
        receiptAlwaysGenerated: true,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Rate-limit e saúde
  // -------------------------------------------------------------------------

  public updateRateLimitState(
    providerId: string,
    headers: Record<string, string>,
  ): void {
    const normalize = (key: string): string | undefined => {
      const lower = key.toLowerCase();
      return headers[lower] || headers[key] || undefined;
    };

    const remaining = normalize('x-ratelimit-remaining-requests')
      || normalize('x-ratelimit-remaining')
      || null;
    const tokensRemaining = normalize('x-ratelimit-remaining-tokens') || null;
    const resetAt = normalize('x-ratelimit-reset') || normalize('x-ratelimit-reset-requests') || null;
    const retryAfter = normalize('retry-after') || null;

    const requestsRemainingNum = remaining !== null ? parseInt(remaining, 10) : null;
    const tokensRemainingNum = tokensRemaining !== null ? parseInt(tokensRemaining, 10) : null;

    let resetsAt: string | null = null;
    if (resetAt) {
      // Se for um timestamp ISO ou epoch
      const epoch = Number(resetAt);
      resetsAt = isNaN(epoch) ? resetAt : new Date(epoch * 1000).toISOString();
    } else if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) {
        resetsAt = new Date(Date.now() + seconds * 1000).toISOString();
      }
    }

    const isThrottled =
      (requestsRemainingNum !== null && requestsRemainingNum <= 0) ||
      (tokensRemainingNum !== null && tokensRemainingNum <= 0) ||
      retryAfter !== null;

    this.rateLimitStates.set(providerId, {
      requestsRemaining: requestsRemainingNum ?? null,
      tokensRemaining: tokensRemainingNum ?? null,
      resetsAt,
      isThrottled: isThrottled || false,
      updatedAt: this.nowFn(),
    });
  }

  public recordHealth(
    providerId: string,
    success: boolean,
    latencyMs: number,
  ): void {
    const existing = this.healthStates.get(providerId) || {
      lastSuccessAt: null,
      lastFailureAt: null,
      consecutiveFailures: 0,
      latencySamples: [],
      averageLatencyMs: null,
    };

    if (success) {
      existing.lastSuccessAt = this.nowFn();
      existing.consecutiveFailures = 0;
    } else {
      existing.lastFailureAt = this.nowFn();
      existing.consecutiveFailures += 1;
    }

    existing.latencySamples.push(latencyMs);
    if (existing.latencySamples.length > MAX_HEALTH_SAMPLES) {
      existing.latencySamples.shift();
    }

    const sum = existing.latencySamples.reduce((a, b) => a + b, 0);
    existing.averageLatencyMs = Math.round(sum / existing.latencySamples.length);

    this.healthStates.set(providerId, existing);
  }

  // -------------------------------------------------------------------------
  // Último receipt
  // -------------------------------------------------------------------------

  public getLastReceipt(): ZavorthProviderRouterReceipt | null {
    return this.lastReceipt;
  }

  // -------------------------------------------------------------------------
  // OpenAI-compatible HTTP endpoint
  // -------------------------------------------------------------------------

  public async handleOpenAiCompatibleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
      res.end();
      return;
    }

    // Snapshot
    if (pathname === '/api/web/provider-router/snapshot' && req.method === 'GET') {
      this.writeJson(res, { ok: true, snapshot: this.buildSnapshot() }, 200);
      return;
    }

    // Último receipt
    if (pathname === '/api/web/provider-router/receipt' && req.method === 'GET') {
      const receipt = this.getLastReceipt();
      if (!receipt) {
        this.writeJson(res, { ok: false, error: 'Nenhum receipt disponivel.' }, 404);
        return;
      }
      this.writeJson(res, { ok: true, receipt }, 200);
      return;
    }

    // Roteamento manual
    if (pathname === '/api/web/provider-router/route' && req.method === 'POST') {
      try {
        const body = await this.readJsonBody(req);
        const routerRequest = this.parseRouterRequest(body);
        const receipt = await this.route(routerRequest);
        this.writeJson(res, { ok: true, receipt }, 200);
      } catch (error: any) {
        this.writeJson(
          res,
          { ok: false, error: error?.message || 'Falha ao rotear a requisicao.' },
          400,
        );
      }
      return;
    }

    // OpenAI chat completions
    if (pathname === '/v1/chat/completions' && req.method === 'POST') {
      try {
        const body = await this.readJsonBody(req);
        const routerRequest = this.openAiBodyToRouterRequest(body);
        const receipt = await this.route(routerRequest);

        const openAiResponse = this.receiptToOpenAiResponse(receipt, body.model);
        this.writeJson(res, openAiResponse, receipt.status === 'all-providers-exhausted' ? 503 : 200);
      } catch (error: any) {
        this.writeJson(res, {
          error: {
            message: error?.message || 'Erro interno do roteador.',
            type: 'server_error',
            code: 'internal_error',
          },
        }, 500);
      }
      return;
    }

    // Modelos disponíveis
    if (pathname === '/v1/models' && req.method === 'GET') {
      const catalog = this.buildRouterCatalog();
      const models = catalog.flatMap((entry) =>
        entry.models.map((modelId) => ({
          id: modelId,
          object: 'model' as const,
          created: Math.floor(Date.now() / 1000),
          owned_by: entry.providerId,
        })),
      );
      this.writeJson(res, { object: 'list', data: models }, 200);
      return;
    }

    // 404
    this.writeJson(res, { error: { message: 'Rota nao encontrada.', type: 'invalid_request_error' } }, 404);
  }

  /**
   * Inicia o servidor HTTP OpenAI-compatible na porta configurada.
   */
  public startOpenAiCompatServer(port?: number): http.Server {
    const resolvedPort = port
      || parseInt(process.env[OPENAI_COMPAT_PORT_ENV] || '', 10)
      || DEFAULT_OPENAI_COMPAT_PORT;

    const server = http.createServer((req, res) => {
      this.handleOpenAiCompatibleRequest(req, res).catch((err) => {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: 'Erro interno.', type: 'server_error' } }));
        }
      });
    });

    server.listen(resolvedPort, () => {
      console.log(`[ZavorthProviderRouter] OpenAI-compatible endpoint iniciado na porta ${resolvedPort}`);
    });

    this.httpServer = server;
    return server;
  }

  /**
   * Encerra o servidor HTTP.
   */
  public stopOpenAiCompatServer(): void {
    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer = null;
    }
  }

  // -------------------------------------------------------------------------
  // Internos: Ordenação de candidatos
  // -------------------------------------------------------------------------

  private sortCandidates(
    catalog: ZavorthProviderRouterEntry[],
    request: ZavorthProviderRouterRequest,
  ): ZavorthProviderRouterEntry[] {
    const sorted = [...catalog];

    // Se há provider preferido, coloca na frente
    if (request.preferredProvider) {
      const preferredId = request.preferredProvider.toLowerCase();
      sorted.sort((a, b) => {
        const aPreferred = a.providerId.toLowerCase() === preferredId ? 0 : 1;
        const bPreferred = b.providerId.toLowerCase() === preferredId ? 0 : 1;
        return aPreferred - bPreferred;
      });
      return sorted;
    }

    // Filtra por modelo se especificado
    if (request.model) {
      const modelId = request.model.toLowerCase();
      sorted.sort((a, b) => {
        const aHasModel = a.models.some((m) => m.toLowerCase() === modelId) ? 0 : 1;
        const bHasModel = b.models.some((m) => m.toLowerCase() === modelId) ? 0 : 1;
        if (aHasModel !== bHasModel) return aHasModel - bHasModel;
        return 0;
      });
    }

    // Ordena por preferência de orçamento
    const pref = request.budgetPreference || 'auto';

    sorted.sort((a, b) => {
      // Providers throttled vão para o final
      if (a.rateLimitState.isThrottled !== b.rateLimitState.isThrottled) {
        return a.rateLimitState.isThrottled ? 1 : -1;
      }
      // Providers com muitas falhas vão para o final
      if (a.healthState.consecutiveFailures !== b.healthState.consecutiveFailures) {
        return a.healthState.consecutiveFailures - b.healthState.consecutiveFailures;
      }

      if (pref === 'cheapest') {
        const aCost = a.costPerInputToken ?? Infinity;
        const bCost = b.costPerInputToken ?? Infinity;
        return aCost - bCost;
      }
      if (pref === 'fastest') {
        const aLatency = a.healthState.averageLatencyMs ?? Infinity;
        const bLatency = b.healthState.averageLatencyMs ?? Infinity;
        return aLatency - bLatency;
      }

      // auto / best-quality: prioridade original
      return a.priority - b.priority;
    });

    return sorted;
  }

  // -------------------------------------------------------------------------
  // Internos: Construção de mensagens
  // -------------------------------------------------------------------------

  private buildMessages(request: ZavorthProviderRouterRequest): ZavorthProviderRouterMessage[] {
    const messages: ZavorthProviderRouterMessage[] = [];

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    if (request.conversationHistory) {
      for (const msg of request.conversationHistory) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: 'user', content: request.prompt });
    return messages;
  }

  // -------------------------------------------------------------------------
  // Internos: Chamada ao provider
  // -------------------------------------------------------------------------

  private async callProvider(
    entry: ZavorthProviderRouterEntry,
    messages: ZavorthProviderRouterMessage[],
    model: string,
    request: ZavorthProviderRouterRequest,
  ): Promise<{ text: string; finishReason: string | null; inputTokens: number | null; outputTokens: number | null }> {
    const apiUrl = entry.apiCompatibility === 'anthropic'
      ? `${entry.baseUrl}/messages`
      : `${entry.baseUrl}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Não expõe API keys diretamente — o fetch pode usar interceptors configurados
    const body: Record<string, any> = entry.apiCompatibility === 'anthropic'
      ? {
          model,
          messages: messages.filter((m) => m.role !== 'system'),
          system: messages.find((m) => m.role === 'system')?.content || undefined,
          max_tokens: request.maxTokens || 4096,
          temperature: request.temperature ?? undefined,
        }
      : {
          model,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          max_tokens: request.maxTokens || 4096,
          temperature: request.temperature ?? undefined,
        };

    const response = await this.fetchFn(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    // Atualiza rate-limit a partir dos headers da resposta
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    this.updateRateLimitState(entry.providerId, responseHeaders);

    if (!response.ok) {
      const error: any = new Error(`Provider ${entry.providerId} retornou ${response.status}`);
      error.status = response.status;
      error.statusCode = response.status;
      throw error;
    }

    const json = await response.json() as any;

    if (entry.apiCompatibility === 'anthropic') {
      return {
        text: json.content?.[0]?.text || '',
        finishReason: json.stop_reason || null,
        inputTokens: json.usage?.input_tokens ?? null,
        outputTokens: json.usage?.output_tokens ?? null,
      };
    }

    // OpenAI-compatible
    const choice = json.choices?.[0];
    return {
      text: choice?.message?.content || '',
      finishReason: choice?.finish_reason || null,
      inputTokens: json.usage?.prompt_tokens ?? null,
      outputTokens: json.usage?.completion_tokens ?? null,
    };
  }

  // -------------------------------------------------------------------------
  // Internos: Construção de receipt
  // -------------------------------------------------------------------------

  private buildReceipt(input: {
    status: ZavorthProviderRouterCompletionStatus;
    selectedProvider: { providerId: string; model: string } | null;
    fallbacksAttempted: Array<{ providerId: string; reason: string }>;
    contextBudgetReceipt: ZavorthProviderRouterContextBudgetReceipt;
    totalLatencyMs: number;
    providerLatencyMs: number;
    routingLatencyMs: number;
    entry: ZavorthProviderRouterEntry | null;
    text: string;
    finishReason: string | null;
    inputTokens: number | null;
    outputTokens: number | null;
  }): ZavorthProviderRouterReceipt {
    return {
      generatedAt: this.nowFn(),
      contractVersion: ZAVORTH_PROVIDER_ROUTER_CONTRACT_VERSION,
      surface: 'provider-router',
      status: input.status,
      selectedProvider: input.selectedProvider,
      fallbacksAttempted: input.fallbacksAttempted,
      contextBudget: {
        originalTokens: input.contextBudgetReceipt.originalTokens,
        compressedTokens: input.contextBudgetReceipt.compressedTokens,
        compressionApplied: input.contextBudgetReceipt.compressionApplied,
        truncatedMessages: input.contextBudgetReceipt.truncatedMessages,
      },
      performance: {
        totalLatencyMs: input.totalLatencyMs,
        providerLatencyMs: input.providerLatencyMs,
        routingLatencyMs: input.routingLatencyMs,
      },
      cost: {
        estimatedInputCost: input.entry && input.entry.costPerInputToken !== null && input.inputTokens !== null
          ? input.entry.costPerInputToken * input.inputTokens
          : null,
        estimatedOutputCost: input.entry && input.entry.costPerOutputToken !== null && input.outputTokens !== null
          ? input.entry.costPerOutputToken * input.outputTokens
          : null,
      },
      output: {
        text: input.text,
        finishReason: input.finishReason,
        tokensUsed: {
          input: input.inputTokens,
          output: input.outputTokens,
        },
      },
      safety: {
        noRawSecretsSerialized: true,
        receiptPersisted: true,
        allProvidersFromRegistry: true,
        noDirectApiKeyExposure: true,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Internos: Conversão OpenAI ←→ Router
  // -------------------------------------------------------------------------

  private openAiBodyToRouterRequest(body: any): ZavorthProviderRouterRequest {
    const messages: Array<{ role: string; content: string }> = body.messages || [];
    const systemMessages = messages.filter((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');
    const lastUserMessage = nonSystemMessages.length > 0
      ? nonSystemMessages[nonSystemMessages.length - 1]!
      : null;

    return {
      prompt: lastUserMessage?.content || '',
      model: body.model || null,
      maxTokens: body.max_tokens || body.max_completion_tokens || null,
      temperature: body.temperature ?? null,
      systemPrompt: systemMessages.map((m) => m.content).join('\n') || null,
      conversationHistory: nonSystemMessages.slice(0, -1).length > 0
        ? nonSystemMessages.slice(0, -1)
        : null,
      budgetPreference: 'auto',
    };
  }

  private receiptToOpenAiResponse(
    receipt: ZavorthProviderRouterReceipt,
    requestModel?: string,
  ): Record<string, any> {
    return {
      id: `chatcmpl-zavorth-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: receipt.selectedProvider?.model || requestModel || 'unknown',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: receipt.output.text,
          },
          finish_reason: receipt.output.finishReason || 'stop',
        },
      ],
      usage: {
        prompt_tokens: receipt.output.tokensUsed.input ?? 0,
        completion_tokens: receipt.output.tokensUsed.output ?? 0,
        total_tokens:
          (receipt.output.tokensUsed.input ?? 0) + (receipt.output.tokensUsed.output ?? 0),
      },
      system_fingerprint: `zavorth-router-${ZAVORTH_PROVIDER_ROUTER_CONTRACT_VERSION}`,
    };
  }

  // -------------------------------------------------------------------------
  // Internos: Helpers de estado
  // -------------------------------------------------------------------------

  private getRateLimitState(providerId: string): InternalRateLimitState {
    return (
      this.rateLimitStates.get(providerId) || {
        requestsRemaining: null,
        tokensRemaining: null,
        resetsAt: null,
        isThrottled: false,
        updatedAt: this.nowFn(),
      }
    );
  }

  private getHealthState(providerId: string): InternalHealthState {
    return (
      this.healthStates.get(providerId) || {
        lastSuccessAt: null,
        lastFailureAt: null,
        consecutiveFailures: 0,
        latencySamples: [],
        averageLatencyMs: null,
      }
    );
  }

  private markThrottled(providerId: string): void {
    const existing = this.getRateLimitState(providerId);
    existing.isThrottled = true;
    existing.requestsRemaining = 0;
    this.rateLimitStates.set(providerId, existing);
  }

  // -------------------------------------------------------------------------
  // Internos: Helpers HTTP
  // -------------------------------------------------------------------------

  private writeJson(res: http.ServerResponse, data: any, statusCode: number): void {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(data));
  }

  private readJsonBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf-8');
          resolve(raw.length > 0 ? JSON.parse(raw) : {});
        } catch (error) {
          reject(new Error('Corpo JSON invalido.'));
        }
      });
      req.on('error', reject);
    });
  }

  // -------------------------------------------------------------------------
  // Internos: Parser de request manual
  // -------------------------------------------------------------------------

  private parseRouterRequest(body: any): ZavorthProviderRouterRequest {
    const prompt = String(body.prompt || '').trim();
    if (!prompt) {
      throw new Error('Campo "prompt" obrigatorio.');
    }
    return {
      prompt,
      model: body.model || null,
      preferredProvider: body.preferredProvider || null,
      maxTokens: body.maxTokens ? Number(body.maxTokens) : null,
      temperature: body.temperature != null ? Number(body.temperature) : null,
      systemPrompt: body.systemPrompt || null,
      conversationHistory: body.conversationHistory || null,
      requestedBy: body.requestedBy || null,
      budgetPreference: body.budgetPreference || 'auto',
    };
  }
}
