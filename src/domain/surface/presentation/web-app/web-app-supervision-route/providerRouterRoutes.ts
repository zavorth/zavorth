import type { WebAppRuntimeRouteDeps } from '../WebAppRuntimeRouteService.js';
import type { WebAppSupervisionRouteHandler } from './types.js';
import { getRequestedBy } from './helpers.js';

interface ProviderRouterService {
  buildSnapshot(): Record<string, unknown>;
  getLastReceipt(): Record<string, unknown> | null;
  route(params: {
    prompt: string;
    model: string | null;
    preferredProvider: string | null;
    maxTokens: number | null;
    temperature: number | null;
    systemPrompt: string | null;
    conversationHistory: unknown;
    requestedBy: string | null;
    budgetPreference: string;
  }): Promise<Record<string, unknown>>;
  buildRouterCatalog(): Record<string, unknown>;
}

type ProviderRouterDeps = WebAppRuntimeRouteDeps & { providerRouter?: ProviderRouterService };

export const handleProviderRouterRoutes: WebAppSupervisionRouteHandler = async (ctx) => {
  const { req, res, pathname, deps } = ctx;
  const service = (deps as ProviderRouterDeps).providerRouter;

  if (pathname === '/api/web/provider-router/snapshot' && req.method === 'GET') {
    if (!service) {
      deps.writeJson(res, { ok: false, error: 'Provider Router indisponivel.' }, 503);
      return true;
    }
    deps.writeJson(res, { ok: true, snapshot: service.buildSnapshot() }, 200);
    return true;
  }

  if (pathname === '/api/web/provider-router/receipt' && req.method === 'GET') {
    if (!service) {
      deps.writeJson(res, { ok: false, error: 'Provider Router indisponivel.' }, 503);
      return true;
    }
    const receipt = service.getLastReceipt();
    if (!receipt) {
      deps.writeJson(res, { ok: false, error: 'Nenhum receipt de roteamento disponivel.' }, 404);
      return true;
    }
    deps.writeJson(res, { ok: true, receipt }, 200);
    return true;
  }

  if (pathname === '/api/web/provider-router/route' && req.method === 'POST') {
    if (!service) {
      deps.writeJson(res, { ok: false, error: 'Provider Router indisponivel.' }, 503);
      return true;
    }
    try {
      const body = await deps.readJsonBody(req);
      const prompt = String(body.prompt || '').trim();
      if (!prompt) {
        deps.writeJson(res, { ok: false, error: 'Campo "prompt" obrigatorio.' }, 400);
        return true;
      }
      const receipt = await service.route({
        prompt,
        model: body.model || null,
        preferredProvider: body.preferredProvider || null,
        maxTokens: body.maxTokens ? Number(body.maxTokens) : null,
        temperature: body.temperature != null ? Number(body.temperature) : null,
        systemPrompt: body.systemPrompt || null,
        conversationHistory: body.conversationHistory || null,
        requestedBy: body.requestedBy || getRequestedBy(ctx),
        budgetPreference: body.budgetPreference || 'auto',
      });
      deps.writeJson(res, { ok: true, receipt }, 200);
    } catch (error: unknown) {
      deps.writeJson(
        res,
        { ok: false, error: error instanceof Error ? error.message : 'Falha ao rotear a requisicao.' },
        400,
      );
    }
    return true;
  }

  if (pathname === '/api/web/provider-router/catalog' && req.method === 'GET') {
    if (!service) {
      deps.writeJson(res, { ok: false, error: 'Provider Router indisponivel.' }, 503);
      return true;
    }
    deps.writeJson(res, { ok: true, catalog: service.buildRouterCatalog() }, 200);
    return true;
  }

  return false;
};
