import type {
  MemoryWikiPageRef,
  MemoryWikiSearchRequest,
  MemoryWikiSearchResult,
  MemoryWikiUpsertRequest,
  MemoryWikiUpsertResult,
} from '../contracts/HybridMemoryContract.js';
import { HYBRID_MEMORY_CONTRACT_VERSION } from '../contracts/HybridMemoryContract.js';

type MemoryWikiServiceRuntime = {
  now?: () => Date;
  pages?: MemoryWikiPageRecord[];
};

type MemoryWikiPageRecord = MemoryWikiPageRef & {
  body: string;
  tags: string[];
  sourceArtifactIds: string[];
};

export class MemoryWikiService {
  private readonly now: () => Date;
  private readonly pages: Map<string, MemoryWikiPageRecord>;

  constructor(runtime: MemoryWikiServiceRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.pages = new Map((runtime.pages || []).map((page) => [page.pageId, { ...page }]));
  }

  public upsertPage(request: MemoryWikiUpsertRequest): MemoryWikiUpsertResult {
    const title = String(request.title || '').trim();
    const body = String(request.body || '').trim();
    const processedAt = this.now().toISOString();
    if (!title || !body) {
      return {
        ok: false,
        contractVersion: HYBRID_MEMORY_CONTRACT_VERSION,
        page: null,
        receiptId: this.receiptId('upsert', 'invalid'),
        processedAt,
        error: 'title and body are required',
      };
    }
    const pageId = this.slugify(title);
    const page: MemoryWikiPageRecord = {
      pageId,
      title,
      slug: pageId,
      status: 'published',
      updatedAt: processedAt,
      body,
      tags: request.tags || [],
      sourceArtifactIds: request.sourceArtifactIds || [],
    };
    this.pages.set(pageId, page);
    return {
      ok: true,
      contractVersion: HYBRID_MEMORY_CONTRACT_VERSION,
      page: this.toRef(page),
      receiptId: this.receiptId('upsert', pageId),
      processedAt,
      error: null,
    };
  }

  public searchPages(request: MemoryWikiSearchRequest): MemoryWikiSearchResult {
    const query = String(request.query || '').trim().toLowerCase();
    const limit = Math.max(1, Math.min(Number(request.limit || 10), 25));
    const pages = Array.from(this.pages.values())
      .filter((page) =>
        !query
        || page.title.toLowerCase().includes(query)
        || page.body.toLowerCase().includes(query)
        || page.tags.some((tag) => tag.toLowerCase().includes(query)),
      )
      .slice(0, limit)
      .map((page) => this.toRef(page));
    return {
      ok: true,
      contractVersion: HYBRID_MEMORY_CONTRACT_VERSION,
      pages,
      receiptId: this.receiptId('search', this.slugify(query || 'all')),
      processedAt: this.now().toISOString(),
    };
  }

  private toRef(page: MemoryWikiPageRecord): MemoryWikiPageRef {
    return {
      pageId: page.pageId,
      title: page.title,
      slug: page.slug,
      status: page.status,
      updatedAt: page.updatedAt,
    };
  }

  private receiptId(action: string, value: string): string {
    return `memory.wiki.${action}.${value}.receipt`;
  }

  private slugify(value: string): string {
    return String(value || 'wiki')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      || 'wiki';
  }
}
