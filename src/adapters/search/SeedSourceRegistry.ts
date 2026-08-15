import { logger } from '../../logger.js';
import type {
  AdapterSearchItem,
  SearchQueryRequest,
} from '../../contracts/core/SearchQueryContract.js';
import type {
  SemanticIntent,
  SemanticTopic,
} from '../../contracts/search/SemanticIntentContract.js';
import { normalizeHost } from '../../agents/EvidenceDomainProfiles.js';

export type SeedSourceMatch = {
  topics: ReadonlyArray<SemanticTopic>;
  sources: ReadonlyArray<{ title: string; url: string; knownSource: string }>;
  description: string;
};

export const SEED_SOURCE_REGISTRY: ReadonlyArray<SeedSourceMatch> = [
  {
    topics: ['technical'],
    sources: [
      {
        title: 'Gemini API models - Google AI for Developers',
        url: 'https://ai.google.dev/gemini-api/docs/models',
        knownSource: 'Official Gemini API model documentation',
      },
    ],
    description: 'Official Gemini API model documentation',
  },
  {
    topics: ['ai_news'],
    sources: [
      {
        title: 'OpenAI news and product updates',
        url: 'https://openai.com/news/',
        knownSource: 'OpenAI official news',
      },
      {
        title: 'Anthropic news',
        url: 'https://www.anthropic.com/news',
        knownSource: 'Anthropic official news',
      },
      {
        title: 'Google DeepMind blog',
        url: 'https://deepmind.google/discover/blog/',
        knownSource: 'Google DeepMind official blog',
      },
      {
        title: 'Meta AI blog',
        url: 'https://ai.meta.com/blog/',
        knownSource: 'Meta AI blog',
      },
    ],
    description: 'Official AI company release sources',
  },
  {
    topics: ['sports'],
    sources: [
      {
        title: 'Flamengo - ge.globo',
        url: 'https://ge.globo.com/futebol/times/flamengo/',
        knownSource: 'ge.globo sports',
      },
      {
        title: 'Flamengo scores and fixtures - ESPN',
        url: 'https://www.espn.com/soccer/team/_/id/819/flamengo',
        knownSource: 'ESPN sports',
      },
    ],
    description: 'Sports reference sources',
  },
];

export function findSeedSourceMatches(intent: SemanticIntent): SeedSourceMatch[] {
  const matches: SeedSourceMatch[] = [];
  for (const entry of SEED_SOURCE_REGISTRY) {
    if (!entry.topics.includes(intent.topic)) continue;
    matches.push(entry);
  }
  return matches;
}

export function buildSeedSourceItems(
  request: SearchQueryRequest,
  intent: SemanticIntent,
): AdapterSearchItem[] {
  const matches = findSeedSourceMatches(intent);
  if (matches.length === 0) return [];

  const items: AdapterSearchItem[] = [];
  let rank = 1;
  for (const match of matches) {
    for (const source of match.sources) {
      items.push({
        title: source.title,
        url: source.url,
        description: match.description,
        originalRank: rank++,
        sourceQuery: request.query,
        metadata: {
          knownSource: source.knownSource,
          seedTopic: match.topics[0],
          sourceType: 'seed-source',
        },
      });
    }
  }
  return items;
}

export async function resolveSeedSourceRedirects(items: AdapterSearchItem[]): Promise<AdapterSearchItem[]> {
  const resolved: AdapterSearchItem[] = [];
  for (const item of items) {
    try {
      const host = normalizeHost(item.url);
      if (!host.endsWith('bing.com')) {
        resolved.push(item);
        continue;
      }
      const target = await followBingRedirect(item.url);
      resolved.push(target ? { ...item, url: target } : item);
    } catch (error: unknown) {
      logger.warn('[SeedSourceRegistry] redirect resolution failed', error);
      resolved.push(item);
    }
  }
  return resolved;
}

async function followBingRedirect(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4_000);
    if (typeof (timeout as unknown as { unref?: () => void }).unref === 'function') {
      (timeout as unknown as { unref: () => void }).unref();
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'HEAD',
        redirect: 'manual',
        headers: { 'user-agent': 'Zavorth/1.0 (+local assistant; redirect decoder)' },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const location = response.headers.get('location') || response.headers.get('Location');
    if (location && /^https?:\/\//i.test(location)) return location;

    const parsed = new URL(url);
    const uParam = parsed.searchParams.get('u');
    if (uParam) {
      const base64 = uParam.startsWith('a1') ? uParam.slice(2) : uParam;
      try {
        const decoded = Buffer.from(base64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
        if (/^https?:\/\//i.test(decoded)) return decoded;
      } catch (error: unknown) {
        logger.warn('[SeedSourceRegistry] base64 decode failed', error);
      }
    }
  } catch (error: unknown) {
    logger.warn('[SeedSourceRegistry] HEAD failed', error);
  }
  return null;
}
