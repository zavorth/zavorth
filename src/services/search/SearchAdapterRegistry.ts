import type {
  ISearchAdapterRegistry,
  ISearchAdapter,
  SearchAdapterCapability,
  SearchAdapterRegistryConfig,
  CapabilitySelectionInput,
  CapabilitySelection,
} from '../../contracts/search/SearchAdapterContract.js';
import { SEARCH_ADAPTER_REGISTRY_CONTRACT_VERSION } from '../../contracts/search/SearchAdapterContract.js';
import type { SearchQueryRequest } from '../../contracts/core/SearchQueryContract.js';
import type { SemanticIntent } from '../../contracts/search/SemanticIntentContract.js';

export interface SearchAdapterRegistryOptions {
  readonly config: SearchAdapterRegistryConfig;
  readonly defaultCapabilities?: ReadonlyArray<SearchAdapterCapability>;
}

export class SearchAdapterRegistry implements ISearchAdapterRegistry {
  public readonly registryId = SEARCH_ADAPTER_REGISTRY_CONTRACT_VERSION;

  private readonly adapters: Map<string, ISearchAdapter> = new Map();
  private readonly config: SearchAdapterRegistryConfig;

  constructor(options: SearchAdapterRegistryOptions) {
    this.config = options.config;
  }

  public register(adapter: ISearchAdapter): void {
    if (!adapter || typeof adapter.adapterId !== 'string' || adapter.adapterId.length === 0) {
      throw new Error('SearchAdapterRegistry: adapter.adapterId must be a non-empty string');
    }
    this.adapters.set(adapter.adapterId, adapter);
  }

  public list(): ReadonlyArray<ISearchAdapter> {
    return Array.from(this.adapters.values());
  }

  public resolveById(adapterId: string): ISearchAdapter | null {
    return this.adapters.get(adapterId) ?? null;
  }

  public async resolveAvailable(
    capability: SearchAdapterCapability,
    request: SearchQueryRequest,
    intent: SemanticIntent,
    config?: SearchAdapterRegistryConfig,
  ): Promise<ReadonlyArray<ISearchAdapter>> {
    const cfg = config ?? this.config;
    const allowedIds = this.computeAllowedIds(cfg);
    const out: ISearchAdapter[] = [];
    for (const id of allowedIds) {
      const adapter = this.adapters.get(id);
      if (!adapter) continue;
      if (!adapter.capabilities.includes(capability)) continue;
      if (!adapter.supportedModes.includes(request.mode ?? 'deep')) continue;
      try {
        const available = await adapter.isAvailable();
        if (available) out.push(adapter);
      } catch {
        continue;
      }
    }
    return out;
  }

  public async selectForCapability(input: CapabilitySelectionInput): Promise<CapabilitySelection | null> {
    const cfg = input.config;
    const primaryList = this.computePriorityList(cfg, input.capability);
    const available = await this.resolveAvailable(input.capability, input.request, input.intent, cfg);
    const availableIds = new Set(available.map((a) => a.adapterId));

    for (const id of primaryList) {
      if (availableIds.has(id)) {
        return { adapterId: id, reason: 'priority_match' };
      }
    }
    for (const adapter of available) {
      return { adapterId: adapter.adapterId, reason: 'first_available' };
    }
    return null;
  }

  private computeAllowedIds(cfg: SearchAdapterRegistryConfig): string[] {
    const enabled = new Set(cfg.enabled);
    const disabled = new Set(cfg.disabled);
    const candidates = [cfg.primary, ...cfg.fallback];
    const out: string[] = [];
    for (const id of candidates) {
      if (disabled.has(id)) continue;
      if (enabled.size > 0 && !enabled.has(id)) continue;
      out.push(id);
    }
    return out;
  }

  private computePriorityList(
    cfg: SearchAdapterRegistryConfig,
    capability: SearchAdapterCapability,
  ): string[] {
    const list: string[] = [];
    if (capability === 'news_rss') {
      list.push(...cfg.newsRssPreferred);
    }
    list.push(cfg.primary);
    for (const id of cfg.fallback) {
      if (!list.includes(id)) list.push(id);
    }
    return list;
  }
}
