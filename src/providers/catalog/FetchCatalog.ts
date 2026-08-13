import { ModelInfo } from './types.js';
import { StaticCatalog } from './StaticCatalog.js';
import { safeFetch } from '../../security/SafeFetchService.js';

const CACHE_TTL_MS = 5 * 60 * 1000;

interface FetchModelsResponse {
  data: Array<{
    id: string;
    object: string;
    created: number;
    owned_by: string;
  }>;
}

export class FetchCatalog extends StaticCatalog {
  private cachedModels: ModelInfo[] | null = null;
  private cacheTimestamp = 0;

  constructor(providerId: string, staticModels: ModelInfo[]) {
    super(providerId, staticModels);
  }

  async fetchModels(apiKey: string, baseUrl: string): Promise<ModelInfo[]> {
    const now = Date.now();
    if (this.cachedModels && now - this.cacheTimestamp < CACHE_TTL_MS) {
      return this.cachedModels;
    }

    try {
      const response = await safeFetch(`${baseUrl}/v1/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        return this.getStaticModels();
      }

      const data: FetchModelsResponse = await response.json();
      const models: ModelInfo[] = data.data.map((item) => ({
        id: item.id,
        name: item.id,
        contextWindow: 0,
        maxOutputTokens: 0,
        supportsThinking: false,
        supportsVision: false,
        supportsTools: false,
      }));

      this.cachedModels = models;
      this.cacheTimestamp = now;

      return models;
    } catch {
      return this.getStaticModels();
    }
  }
}
