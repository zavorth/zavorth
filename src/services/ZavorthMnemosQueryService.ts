import fs from 'node:fs';
import path from 'node:path';
import {
  ZAVORTH_MNEMOS_QUERY_VERSION,
  type ZavorthMnemosQueryHit,
  type ZavorthMnemosQueryRankSource,
  type ZavorthMnemosQuerySnapshot,
} from '../contracts/ZavorthMnemosQueryContract.js';
import { ZavorthMnemosFtsIndexService } from './ZavorthMnemosFtsIndexService.js';

type ZavorthMnemosQueryRuntime = {
  now?: () => Date;
  projectRoot?: string;
  readFileSync?: typeof fs.readFileSync;
  ftsIndexService?: Pick<ZavorthMnemosFtsIndexService, 'rebuild' | 'search'>;
};

type ZavorthMnemosQueryInput = {
  query: string;
  topK?: number;
  contextTokenBudget?: number;
};

type WikiIndex = {
  pages: Array<{ id: string; path: string; title: string; tags: string[] }>;
  edges: Array<{ from: string; to: string; kind: string }>;
};

type WikiPage = {
  id: string;
  path: string;
  title: string;
  tags: string[];
  body: string;
};

const RRF_K = 60;
const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/g,
  /\bhf_[A-Za-z0-9]{16,}\b/g,
  /\bAIza[0-9A-Za-z_-]{20,}\b/g,
  /\b(?:api[_-]...key|token|secret|password)\s*[:=]\s*["']...[^"'\s]+/gi,
];

function redact(value: string): string {
  return SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, '[REDACTED_SECRET]'), String(value || ''));
}

function compact(value: string): string {
  return redact(value).replace(/\s+/g, ' ').trim();
}

function stableId(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

export class ZavorthMnemosQueryService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly readFileSyncImpl: typeof fs.readFileSync;
  private readonly ftsIndexService: Pick<ZavorthMnemosFtsIndexService, 'rebuild' | 'search'>;

  constructor(runtime: ZavorthMnemosQueryRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.ftsIndexService = runtime.ftsIndexService || new ZavorthMnemosFtsIndexService({ projectRoot: this.projectRoot, now: this.now });
  }

  public query(input: ZavorthMnemosQueryInput): ZavorthMnemosQuerySnapshot {
    const generatedAt = this.now().toISOString();
    const query = compact(input.query || '');
    const topK = Math.max(1, Math.min(Number(input.topK || 5), 20));
    const contextTokenBudget = Math.max(256, Math.min(Number(input.contextTokenBudget || 1800), 6000));
    const index = this.readIndex();
    const pages = index.pages.map((page) => this.readPage(page));
    const terms = this.extractTerms(query);
    const fts = this.queryFts(query, topK);
    const keywordRanks = this.rankByKeyword(pages, terms);
    const tagRanks = this.rankByTags(pages, terms);
    const graphRanks = this.rankByGraph(index, keywordRanks, tagRanks);
    const hits = this.fuseRanks(pages, [
      { source: 'sqlite-fts5', ranks: fts.ranks },
      { source: 'keyword', ranks: keywordRanks },
      { source: 'tag', ranks: tagRanks },
      { source: 'graph', ranks: graphRanks },
    ]).slice(0, topK);
    const context = this.buildContext(hits, contextTokenBudget);

    return {
      version: ZAVORTH_MNEMOS_QUERY_VERSION,
      generatedAt,
      status: hits.length ? 'ready' : 'empty',
      query,
      summary: {
        pagesScanned: pages.length,
        hits: hits.length,
        returned: hits.length,
        graphEdgesUsed: index.edges.length,
        sqliteFtsAvailable: fts.available,
      },
      ranking: {
        method: 'sqlite-fts5-keyword-tag-graph-rrf',
        topK,
        rrfK: RRF_K,
      },
      hits,
      context,
      safety: {
        wikiRootOnly: true,
        providerCall: false,
        networkCall: false,
        untrustedContextWrapped: true,
        topKOnly: true,
        secretsRedacted: true,
        sqliteIndexIsDerived: true,
      },
      receipt: {
        id: `mnemos-query-${stableId(`${generatedAt}:${query}:${hits.map((hit) => hit.pageId).join('|')}`)}`,
        providerCall: false,
        durableMutation: false,
      },
    };
  }

  private queryFts(query: string, topK: number): { available: boolean; ranks: Map<string, number> } {
    const rebuilt = this.ftsIndexService.rebuild();
    if (rebuilt.status !== 'indexed') {
      return { available: false, ranks: new Map() };
    }
    const hits = this.ftsIndexService.search(query, topK);
    return {
      available: hits.available,
      ranks: new Map(hits.hits.map((hit) => [hit.pageId, hit.rank])),
    };
  }

  private readIndex(): WikiIndex {
    const indexPath = this.resolveWikiPath('index.json');
    return JSON.parse(String(this.readFileSyncImpl(indexPath, 'utf8'))) as WikiIndex;
  }

  private readPage(page: { id: string; path: string; title: string; tags: string[] }): WikiPage {
    if (!page.path.startsWith('.zavorth/wiki/')) {
      throw new Error(`Mnemos query page outside wiki root: ${page.path}`);
    }
    const body = String(this.readFileSyncImpl(this.resolveWorkspacePath(page.path), 'utf8'));
    return {
      id: page.id,
      path: page.path,
      title: page.title,
      tags: page.tags || [],
      body: redact(body),
    };
  }

  private rankByKeyword(pages: WikiPage[], terms: string[]): Map<string, number> {
    const scored = pages
      .map((page) => {
        const haystack = `${page.title} ${page.body}`.toLowerCase();
        const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
        return { id: page.id, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);
    return this.toRanks(scored.map((entry) => entry.id));
  }

  private rankByTags(pages: WikiPage[], terms: string[]): Map<string, number> {
    const scored = pages
      .map((page) => {
        const tagText = page.tags.join(' ').toLowerCase();
        const score = terms.reduce((sum, term) => sum + (tagText.includes(term) ? 1 : 0), 0);
        return { id: page.id, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);
    return this.toRanks(scored.map((entry) => entry.id));
  }

  private rankByGraph(
    index: WikiIndex,
    keywordRanks: Map<string, number>,
    tagRanks: Map<string, number>,
  ): Map<string, number> {
    const seeds = new Set([...keywordRanks.keys(), ...tagRanks.keys()]);
    const connected = index.edges
      .filter((edge) => seeds.has(edge.from) || seeds.has(edge.to))
      .map((edge) => seeds.has(edge.from) ? edge.to : edge.from);
    return this.toRanks(Array.from(new Set(connected)));
  }

  private fuseRanks(
    pages: WikiPage[],
    inputs: Array<{ source: ZavorthMnemosQueryRankSource; ranks: Map<string, number> }>,
  ): ZavorthMnemosQueryHit[] {
    const pageById = new Map(pages.map((page) => [page.id, page]));
    const scores = new Map<string, { score: number; sources: Set<ZavorthMnemosQueryRankSource> }>();
    for (const input of inputs) {
      for (const [pageId, rank] of input.ranks.entries()) {
        const current = scores.get(pageId) || { score: 0, sources: new Set<ZavorthMnemosQueryRankSource>() };
        current.score += 1 / (RRF_K + rank);
        current.sources.add(input.source);
        scores.set(pageId, current);
      }
    }

    return Array.from(scores.entries())
      .map(([pageId, scored]) => {
        const page = pageById.get(pageId);
        if (!page) return null;
        return {
          pageId,
          title: page.title,
          path: page.path,
          tags: page.tags,
          score: Number(scored.score.toFixed(6)),
          rankSources: Array.from(scored.sources),
          excerpt: this.excerpt(page.body),
        };
      })
      .filter((entry): entry is ZavorthMnemosQueryHit => Boolean(entry))
      .sort((a, b) => b.score - a.score || a.pageId.localeCompare(b.pageId));
  }

  private buildContext(hits: ZavorthMnemosQueryHit[], contextTokenBudget: number): string {
    const blocks: string[] = [];
    let estimatedTokens = 0;
    for (const hit of hits) {
      const block = [
        `<untrusted_mnemos_wiki page="${hit.pageId}" path="${hit.path}" score="${hit.score}">`,
        `Title: ${hit.title}`,
        `Tags: ${hit.tags.join(', ')}`,
        `Rank sources: ${hit.rankSources.join(', ')}`,
        `Excerpt: ${hit.excerpt.replace(/<\/untrusted_mnemos_wiki>/g, '&lt;/untrusted_mnemos_wiki&gt;')}`,
        '</untrusted_mnemos_wiki>',
      ].join('\n');
      const blockTokens = Math.ceil(block.length / 4);
      if (estimatedTokens + blockTokens > contextTokenBudget && blocks.length > 0) {
        break;
      }
      blocks.push(block);
      estimatedTokens += blockTokens;
    }
    return blocks.join('\n\n');
  }

  private excerpt(body: string): string {
    return compact(body.replace(/^---[\s\S]*...---/m, '')).slice(0, 700);
  }

  private extractTerms(query: string): string[] {
    return Array.from(new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9_.-]+/i)
        .map((term) => term.trim())
        .filter((term) => term.length >= 3),
    )).slice(0, 20);
  }

  private toRanks(ids: string[]): Map<string, number> {
    const ranks = new Map<string, number>();
    ids.forEach((id, index) => ranks.set(id, index + 1));
    return ranks;
  }

  private resolveWikiPath(file: string): string {
    return this.resolveWorkspacePath(`.zavorth/wiki/${file}`);
  }

  private resolveWorkspacePath(inputPath: string): string {
    const absolute = path.resolve(this.projectRoot, inputPath);
    const relative = path.relative(this.projectRoot, absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Mnemos query path escapes workspace: ${inputPath}`);
    }
    return absolute;
  }
}
