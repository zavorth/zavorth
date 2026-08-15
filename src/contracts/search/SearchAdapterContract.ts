/**
 * Zavorth-native contract for the search adapter ABC and registry.
 *
 * The registry follows the pluggable-backend pattern: each adapter advertises
 * its capabilities (`supportsSearch`, `supportsExtract`, `supportsNewsRss`)
 * and the registry dispatches per capability based on user-configured priority.
 * No keyword/regex heuristics are used to decide which adapter to call.
 *
 * @module contracts/search/SearchAdapterContract
 * @since 2026-08-14
 * @author Zavorth Core Team
 */

import type {
  SearchQueryMode,
  SearchQueryRequest,
  AdapterSearchOutput,
} from '../core/SearchQueryContract.js';
import type { SemanticIntent } from './SemanticIntentContract.js';

export const SEARCH_ADAPTER_REGISTRY_CONTRACT_VERSION = 'zavorth-search-adapter-registry/v1' as const;

export type SearchAdapterCapability =
  | 'search'
  | 'extract'
  | 'news_rss';

export interface ISearchAdapter {
  readonly adapterId: string;
  readonly displayName: string;
  readonly supportedModes: ReadonlyArray<SearchQueryMode>;
  readonly capabilities: ReadonlyArray<SearchAdapterCapability>;
  isAvailable(): Promise<boolean>;
  search(request: SearchQueryRequest, intent: SemanticIntent): Promise<AdapterSearchOutput>;
}

export interface SearchAdapterRegistration {
  readonly adapterId: string;
  readonly priority: number;
  readonly capabilities: ReadonlyArray<SearchAdapterCapability>;
}

export interface SearchAdapterRegistryConfig {
  readonly primary: string;
  readonly fallback: ReadonlyArray<string>;
  readonly newsRssPreferred: ReadonlyArray<string>;
  readonly enabled: ReadonlyArray<string>;
  readonly disabled: ReadonlyArray<string>;
}

export interface CapabilitySelectionInput {
  readonly capability: SearchAdapterCapability;
  readonly request: SearchQueryRequest;
  readonly intent: SemanticIntent;
  readonly config: SearchAdapterRegistryConfig;
}

export interface CapabilitySelection {
  readonly adapterId: string;
  readonly reason: string;
}

export interface ISearchAdapterRegistry {
  readonly registryId: string;
  register(adapter: ISearchAdapter): void;
  list(): ReadonlyArray<ISearchAdapter>;
  resolveById(adapterId: string): ISearchAdapter | null;
  selectForCapability(input: CapabilitySelectionInput): Promise<CapabilitySelection | null>;
  resolveAvailable(
    capability: SearchAdapterCapability,
    request: SearchQueryRequest,
    intent: SemanticIntent,
    config: SearchAdapterRegistryConfig,
  ): Promise<ReadonlyArray<ISearchAdapter>>;
}
