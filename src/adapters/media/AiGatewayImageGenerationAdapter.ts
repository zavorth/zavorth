/**
 * Zavorth-native adapter for image generation through AI Gateway.
 * via AI Gateway.
 *
 * This adapter is responsible for:
 * - Converter o MediaGenerationRequest Zavorth para o formato da AI Gateway.
 * - Executing the HTTP call to the generation endpoint.
 * - Converter a resposta da AI Gateway para AdapterGenerationOutput.
 * - Never exposing provider details to the domain.
 *
 * The adapter is the only component that knows how to talk to AI Gateway.
 * Todo o resto do stack (service, tool, capability) opera sobre contratos Zavorth.
 *
 * Architectural references:
 * - docs/native-absorption-execution-plan.md
 * - src/contracts/MediaGenerationContract.ts
 *
 * @module adapters/media/AiGatewayImageGenerationAdapter
 * @since 2026-05-03
 * @author Zavorth Core Team
 */

import type {
  IMediaGenerationAdapter,
  MediaGenerationModality,
  MediaGenerationRequest,
  AdapterGenerationOutput,
} from '../../contracts/MediaGenerationContract.js';
import { config } from '../../config/index.js';
import { logger } from '../../logger.js';
import { safeFetch } from '../../security/SafeFetchService.js';

// ---------------------------------------------------------------------------
// Internal adapter types; never exported to the domain.
// ---------------------------------------------------------------------------

interface AiGatewayImageRequestBody {
  prompt: string;
  n?: number;
  size?: string;
  response_format?: 'url' | 'b64_json';
  model?: string;
  style?: string;
}

interface AiGatewayImageResponseItem {
  url?: string;
  b64_json?: string;
  revised_prompt?: string;
}

interface AiGatewayImageResponse {
  created?: number;
  data?: AiGatewayImageResponseItem[];
  error?: {
    message?: string;
    code?: string;
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class AiGatewayImageGenerationAdapter implements IMediaGenerationAdapter {
  public readonly adapterId = 'ai-gateway-image';
  public readonly supportedModalities: MediaGenerationModality[] = ['image'];

  private readonly baseUrl: string;
  private readonly apiKey: string | null;

  constructor(options?: { baseUrl?: string; apiKey?: string | null }) {
    this.baseUrl = options?.baseUrl || config.AIGatewayBaseUrl || 'http://127.0.0.1:21128/v1';
    this.apiKey = options?.apiKey ?? config.AIGatewayApiKey ?? null;
  }

  public async generate(request: MediaGenerationRequest): Promise<AdapterGenerationOutput[]> {
    const body = this.buildRequestBody(request);
    const endpoint = this.buildEndpoint('images/generations');

    logger.info(`[AiGatewayImageGenerationAdapter] Requesting generation: model=${body.model || 'default'}, n=${body.n}, size=${body.size}`);

    let response: Response;
    try {
      response = await safeFetch(endpoint, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      }, {
        serviceName: 'AI Gateway image generation',
        allowLoopback: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`[AiGatewayImageGenerationAdapter] Network error: ${message}`);
      throw new MediaAdapterNetworkError(this.adapterId, message);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown');
      logger.error(`[AiGatewayImageGenerationAdapter] Provider HTTP ${response.status}: ${errorText}`);
      throw new MediaAdapterProviderError(this.adapterId, response.status, errorText);
    }

    const json = (await response.json()) as AiGatewayImageResponse;

    if (json.error) {
      throw new MediaAdapterProviderError(this.adapterId, response.status, json.error.message || 'unknown');
    }

    return this.convertResponse(json, request);
  }

  // -------------------------------------------------------------------------
  // Internal methods.
  // -------------------------------------------------------------------------

  private buildRequestBody(request: MediaGenerationRequest): AiGatewayImageRequestBody {
    const body: AiGatewayImageRequestBody = {
      prompt: request.prompt,
      n: Math.min(Math.max(request.count || 1, 1), 4),
      response_format: 'url',
    };

    if (request.sizeHint) {
      body.size = this.normalizeSizeHint(request.sizeHint);
    }

    if (request.styleHint) {
      body.style = request.styleHint;
    }

    if (request.providerHints?.model) {
      body.model = String(request.providerHints.model);
    }

    return body;
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  private buildEndpoint(route: string): string {
    return `${this.baseUrl.replace(/\/+$/, '')}/${route.replace(/^\/+/, '')}`;
  }

  private normalizeSizeHint(hint: string): string {
    const normalized = hint.toLowerCase().trim();
    const sizeMap: Record<string, string> = {
      'landscape': '1792x1024',
      'portrait': '1024x1792',
      'square': '1024x1024',
      '16:9': '1792x1024',
      '9:16': '1024x1792',
      '1:1': '1024x1024',
    };

    return sizeMap[normalized] || normalized;
  }

  private convertResponse(json: AiGatewayImageResponse, request: MediaGenerationRequest): AdapterGenerationOutput[] {
    const items = json.data || [];

    return items.map((item) => ({
      data: item.b64_json ? Buffer.from(item.b64_json, 'base64') : null,
      sourceUrl: item.url || null,
      contentType: 'image/png',
      sizeBytes: item.b64_json ? Buffer.from(item.b64_json, 'base64').length : null,
      providerEvidence: {
        providerId: this.adapterId,
        modelId: (request.providerHints?.model as string) || null,
        sourceUrl: item.url || null,
        metadata: {
          revisedPrompt: item.revised_prompt || null,
          created: json.created || null,
        },
      },
    }));
  }
}

// ---------------------------------------------------------------------------
// Erros tipados do adapter
// ---------------------------------------------------------------------------

export class MediaAdapterNetworkError extends Error {
  public readonly adapterId: string;

  constructor(adapterId: string, detail: string) {
    super(`[${adapterId}] Network error: ${detail}`);
    this.name = 'MediaAdapterNetworkError';
    this.adapterId = adapterId;
  }
}

export class MediaAdapterProviderError extends Error {
  public readonly adapterId: string;
  public readonly statusCode: number;

  constructor(adapterId: string, statusCode: number, detail: string) {
    super(`[${adapterId}] Provider error (HTTP ${statusCode}): ${detail}`);
    this.name = 'MediaAdapterProviderError';
    this.adapterId = adapterId;
    this.statusCode = statusCode;
  }
}
