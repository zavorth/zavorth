import type { ModelCatalogProviderInput } from '../ModelCatalogAggregationService.js';
import { assertProviderRequestTargetAllowed } from '../../../../ai-gateway/lib/security/egressGuard.js';

export type AnthropicCompatibleModelDiscoveryInput = {
  providerId: string;
  alias?: string | null;
  label?: string | null;
  baseUrl: string;
  apiKey?: string | null;
  accessToken?: string | null;
  fetchImpl?: typeof fetch;
  egressGuard?: (rawUrl: string) => Promise<unknown>;
};

export type AnthropicCompatibleModelDiscoveryResult = {
  providerCatalog: ModelCatalogProviderInput;
  source: 'live_api' | 'fallback_catalog';
  warning: string | null;
  status: number | null;
};

function normalizeBaseUrl(baseUrl: string): string {
  let base = String(baseUrl || '').trim().replace(/\/$/, '');
  if (base.endsWith('/messages')) {
    base = base.slice(0, -9);
  }
  return base;
}

export class AnthropicCompatibleModelDiscoveryAdapter {
  public async discover(input: AnthropicCompatibleModelDiscoveryInput): Promise<AnthropicCompatibleModelDiscoveryResult> {
    const fetchImpl = input.fetchImpl || fetch;
    const egressGuard = input.egressGuard || assertProviderRequestTargetAllowed;
    const token = input.accessToken || input.apiKey || '';
    const modelsUrl = `${normalizeBaseUrl(input.baseUrl)}/models`;
    let response: Response;
    try {
      await egressGuard(modelsUrl);
      response = await fetchImpl(modelsUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(input.apiKey ? { 'x-api-key': input.apiKey } : {}),
          'anthropic-version': '2023-06-01',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } catch (error) {
      return {
        source: 'fallback_catalog',
        status: null,
        warning: error instanceof Error ? error.message : 'Anthropic-compatible discovery blocked by egress policy.',
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

    if (!response.ok) {
      return {
        source: 'fallback_catalog',
        status: response.status,
        warning: `Anthropic-compatible discovery failed with ${response.status}.`,
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
}
