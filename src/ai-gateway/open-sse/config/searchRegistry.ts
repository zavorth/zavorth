export interface SearchProviderConfig {
  id: string;
  name: string;
  searchTypes: string[];
  costPerQuery: number;
  maxMaxResults: number;
  cacheTTLMs: number;
}

export const SEARCH_PROVIDERS: Record<string, SearchProviderConfig> = {
  "serper-search": {
    id: "serper-search",
    name: "Serper (Google)",
    searchTypes: ["web", "news", "images"],
    costPerQuery: 0.0008,
    maxMaxResults: 100,
    cacheTTLMs: 5 * 60 * 1000,
  },
  "brave-search": {
    id: "brave-search",
    name: "Brave Search",
    searchTypes: ["web", "news"],
    costPerQuery: 0.0006,
    maxMaxResults: 50,
    cacheTTLMs: 5 * 60 * 1000,
  },
  "perplexity-search": {
    id: "perplexity-search",
    name: "Perplexity Search",
    searchTypes: ["web", "news"],
    costPerQuery: 0.001,
    maxMaxResults: 50,
    cacheTTLMs: 10 * 60 * 1000,
  },
  "exa-search": {
    id: "exa-search",
    name: "Exa Search",
    searchTypes: ["web", "news"],
    costPerQuery: 0.0015,
    maxMaxResults: 100,
    cacheTTLMs: 5 * 60 * 1000,
  },
  "tavily-search": {
    id: "tavily-search",
    name: "Tavily Search",
    searchTypes: ["web", "news"],
    costPerQuery: 0.001,
    maxMaxResults: 100,
    cacheTTLMs: 5 * 60 * 1000,
  },
};

export const SEARCH_CREDENTIAL_FALLBACKS: Record<string, string> = {
  "serper-search": "google",
  "brave-search": "brave",
  "perplexity-search": "perplexity",
  "exa-search": "exa",
  "tavily-search": "tavily",
};

const ALL_PROVIDERS = Object.values(SEARCH_PROVIDERS);

export function getAllSearchProviders(): SearchProviderConfig[] {
  return [...ALL_PROVIDERS];
}

export function getSearchProvider(id: string): SearchProviderConfig | undefined {
  return SEARCH_PROVIDERS[id];
}

export function selectProvider(provider?: string | null): SearchProviderConfig | null {
  if (provider) {
    return SEARCH_PROVIDERS[provider] ?? null;
  }
  const sorted = [...ALL_PROVIDERS].sort((a, b) => a.costPerQuery - b.costPerQuery);
  return sorted[0] ?? null;
}
