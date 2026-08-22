import { getSearchProvider } from "../config/searchRegistry";
import type { HandlerCredentials, HandlerLogger, HandlerResult } from "./types";

export interface SearchFilters {
  include_domains?: string[];
  exclude_domains?: string[];
}

export interface HandleSearchInput {
  query: string;
  provider: string;
  maxResults?: number;
  searchType?: string;
  country?: string;
  language?: string;
  timeRange?: string;
  offset?: number;
  domainFilter?: string[];
  contentOptions?: unknown;
  strictFilters?: boolean;
  providerOptions?: Record<string, unknown>;
  credentials?: HandlerCredentials | null;
  alternateProvider?: string;
  alternateCredentials?: HandlerCredentials | null;
  log?: HandlerLogger;
}

export interface SearchResultItem {
  title: string;
  url: string;
  snippet?: string;
  content?: string;
}

export interface SearchData {
  query: string;
  provider: string;
  results: SearchResultItem[];
  usage: { queries_used: number; search_cost_usd: number };
}

interface ProviderRequest {
  url: string;
  init: RequestInit;
  costPerQuery: number;
}

function buildRequest(provider: string, input: HandleSearchInput): ProviderRequest | null {
  const config = getSearchProvider(provider);
  const apiKey =
    input.credentials?.apiKey ||
    input.credentials?.accessToken ||
    (typeof input.credentials?.api_key === "string" ? input.credentials.api_key : "") ||
    "";
  const maxResults = input.maxResults ?? 10;
  const q = input.query;

  switch (provider) {
    case "serper-search": {
      if (!apiKey) return null;
      return {
        url: "https://google.serper.dev/search",
        init: {
          method: "POST",
          headers: { "content-type": "application/json", "X-API-Key": apiKey },
          body: JSON.stringify({
            q,
            num: maxResults,
            ...(input.language ? { hl: input.language } : {}),
            ...(input.country ? { gl: input.country } : {}),
          }),
        },
        costPerQuery: config?.costPerQuery ?? 0.0008,
      };
    }
    case "brave-search": {
      if (!apiKey) return null;
      const params = new URLSearchParams({ q, count: String(maxResults) });
      if (input.searchType) params.set("search_type", input.searchType);
      if (input.country) params.set("country", input.country);
      if (input.language) params.set("language", input.language);
      if (input.timeRange) params.set("time_range", input.timeRange);
      return {
        url: `https://api.search.brave.com/res/v1/web/search?${params.toString()}`,
        init: { method: "GET", headers: { Accept: "application/json", "X-Subscription-Token": apiKey } },
        costPerQuery: config?.costPerQuery ?? 0.0006,
      };
    }
    case "perplexity-search": {
      if (!apiKey) return null;
      return {
        url: "https://api.perplexity.ai/search",
        init: {
          method: "POST",
          headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ query: q, max_results: maxResults }),
        },
        costPerQuery: config?.costPerQuery ?? 0.001,
      };
    }
    case "exa-search": {
      if (!apiKey) return null;
      return {
        url: "https://api.exa.ai/search",
        init: {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": apiKey },
          body: JSON.stringify({ query: q, numResults: maxResults }),
        },
        costPerQuery: config?.costPerQuery ?? 0.0015,
      };
    }
    case "tavily-search": {
      if (!apiKey) return null;
      return {
        url: "https://api.tavily.com/search",
        init: {
          method: "POST",
          headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ query: q, max_results: maxResults }),
        },
        costPerQuery: config?.costPerQuery ?? 0.001,
      };
    }
    default:
      return null;
  }
}

function normalizeResponse(provider: string, raw: unknown, _query: string): SearchResultItem[] {
  const payload = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  let items: unknown[] = [];

  switch (provider) {
    case "serper-search": {
      const organic = payload.organic;
      items = Array.isArray(organic) ? organic : [];
      break;
    }
    case "brave-search": {
      const web = payload.web && typeof payload.web === "object" ? payload.web : {};
      const results = Array.isArray((web as Record<string, unknown>).results)
        ? (web as Record<string, unknown>).results
        : [];
      items = results as unknown[];
      break;
    }
    default: {
      const results = payload.results;
      items = Array.isArray(results) ? results : [];
      break;
    }
  }

  return items
    .map((item): SearchResultItem | null => {
      if (!item || typeof item !== "object") return null;
      const entry = item as Record<string, unknown>;
      const title = typeof entry.title === "string" ? entry.title : "";
      const url =
        (typeof entry.url === "string" && entry.url) ||
        (typeof entry.link === "string" && entry.link) ||
        "";
      const snippet =
        (typeof entry.snippet === "string" && entry.snippet) ||
        (typeof entry.description === "string" && entry.description) ||
        "";
      const content = typeof entry.content === "string" ? entry.content : snippet;
      if (!title && !url) return null;
      return { title, url, snippet, content };
    })
    .filter((item): item is SearchResultItem => item !== null);
}

async function runProvider(
  provider: string,
  input: HandleSearchInput
): Promise<{ success: true; data: SearchData } | { success: false; status: number; error: string }> {
  const request = buildRequest(provider, input);
  if (!request) {
    return { success: false, status: 400, error: `No credentials for search provider: ${provider}` };
  }

  const res = await fetch(request.url, request.init);
  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    return {
      success: false,
      status: res.status,
      error: bodyText || `Search provider returned HTTP ${res.status}`,
    };
  }

  const raw = (await res.json().catch(() => ({}))) as unknown;
  const results = normalizeResponse(provider, raw, input.query);
  return {
    success: true,
    data: {
      query: input.query,
      provider,
      results,
      usage: { queries_used: 1, search_cost_usd: request.costPerQuery },
    },
  };
}

export async function handleSearch(
  input: HandleSearchInput
): Promise<HandlerResult<SearchData>> {
  const primary = await runProvider(input.provider, input).catch((error: unknown) => ({
    success: false as const,
    status: 502,
    error: error instanceof Error ? error.message : String(error),
  }));
  if (primary.success) return { success: true, data: primary.data };

  if (input.alternateProvider && input.alternateCredentials) {
    const alternate = await runProvider(input.alternateProvider, {
      ...input,
      provider: input.alternateProvider,
      credentials: input.alternateCredentials,
    }).catch((error: unknown) => ({
      success: false as const,
      status: 502,
      error: error instanceof Error ? error.message : String(error),
    }));
    if (alternate.success) return { success: true, data: alternate.data };
    if (alternate.success === false) {
      input.log?.warn?.("SEARCH", `Primary failed, alternate also failed: ${alternate.error}`);
    }
  }

  if (primary.success === false) {
    input.log?.error?.("SEARCH", `Search failed: ${primary.error}`);
    return { success: false, error: primary.error, status: primary.status };
  }
  return { success: false, error: "Search failed", status: 502 };
}
