import type { ModelCatalogProviderInput } from '../ModelCatalogAggregationService.js';
import { assertProviderRequestTargetAllowed } from '../../../../ai-gateway/lib/security/egressGuard.js';
import { logger } from '../../../../logger';

export type OpenAiCompatibleModelDiscoveryInput = {
  providerId: string;
  alias?: string | null;
  label?: string | null;
  baseUrl: string;
  apiKey?: string | null;
  fetchImpl?: typeof fetch;
  egressGuard?: (rawUrl: string) => Promise<unknown>;
  timeoutMs?: number;
};

export type OpenAiCompatibleModelDiscoveryResult = {
  providerCatalog: ModelCatalogProviderInput;
  source: 'live_api' | 'fallback_catalog';
  warning: string | null;
  status: number | null;
};

function normalizeBaseUrl(baseUrl: string): string {
  let base = String(baseUrl || '').trim().replace(/\/$/, '');
  if (base.endsWith('/chat/completions')) {
    base = base.slice(0, -17);
  } else if (base.endsWith('/completions')) {
    base = base.slice(0, -12);
  } else if (base.endsWith('/v1')) {
    base = base.slice(0, -3);
  }
  return base;
}

export class OpenAiCompatibleModelDiscoveryAdapter {
  public async discover(input: OpenAiCompatibleModelDiscoveryInput): Promise<OpenAiCompatibleModelDiscoveryResult> {
    const fetchImpl = input.fetchImpl || fetch;
    const egressGuard = input.egressGuard || assertProviderRequestTargetAllowed;
    const base = normalizeBaseUrl(input.baseUrl);
    const endpoints = [
      `${base}/v1/models`,
      `${base}/models`,
      `${String(input.baseUrl || '').trim().replace(/\/$/, '')}/models`,
    ];
    const uniqueEndpoints = Array.from(new Set(endpoints));
    let lastStatus: number | null = null;

    for (const endpoint of uniqueEndpoints) {
      try {
        await egressGuard(endpoint);
        const response = await fetchImpl(endpoint, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(input.apiKey ? { Authorization: `Bearer ${input.apiKey}` } : {}),
          },
          signal: AbortSignal.timeout(input.timeoutMs || 5000),
        });
        if (response.ok) {
          const data = await response.json();
          const rawModels = Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : [];
          return {
            source: 'live_api',
            status: response.status,
            warning: null,
            providerCatalog: {
              providerId: input.providerId,
              alias: input.alias,
              label: input.label,
              active: true,
              source: 'live_api',
              models: rawModels.map((model: any) => ({
                id: String(model.id || model.name || '').replace(/^models\//, ''),
                name: String(model.name || model.id || '').replace(/^models\//, ''),
                type: 'chat',
                source: 'live_api',
                raw: model,
              })),
            },
          };
        }
        lastStatus = response.status;
        if (response.status === 401 || response.status === 403) {
          break;
        }
      } catch (error: any) {
      // Try the next compatible endpoint.
      logger.warn('[Open Ai Compatible Model Discovery Adapter] operation failed', error);
    }
    }

    return {
      source: 'fallback_catalog',
      status: lastStatus,
      warning: lastStatus ? `OpenAI-compatible discovery failed with ${lastStatus}.` : 'OpenAI-compatible discovery failed.',
      providerCatalog: {
        providerId: input.providerId,
        alias: input.alias,
        label: input.label,
        active: false,
        source: 'fallback_catalog',
        models: [],
      },
    };
  }
}
