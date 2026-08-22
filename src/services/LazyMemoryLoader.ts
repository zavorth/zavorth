export interface MemoryEntry {
  id: string;
  content: string;
  category: string;
  createdAt: string;
  tags: string[];
}

export interface LazyMemoryLoaderOptions {
  maxTokens?: number;
  recencyWindowMs?: number;
}

const DEFAULT_MAX_TOKENS = 2000;
const DEFAULT_RECENCY_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const CHARS_PER_TOKEN = 4;

export class LazyMemoryLoader {
  private maxTokens: number;
  private recencyWindowMs: number;

  constructor(options?: LazyMemoryLoaderOptions) {
    this.maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.recencyWindowMs = options?.recencyWindowMs ?? DEFAULT_RECENCY_WINDOW_MS;
  }

  /**
   * Estimate token count for text using rough heuristic: 1 token per 4 chars.
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }

  /**
   * Sort memories by relevance score descending.
   */
  sortByRelevance(memories: MemoryEntry[], query: string): MemoryEntry[] {
    const scored = memories.map((m) => ({
      entry: m,
      score: this.scoreRelevance(m, query, ''),
    }));
    scored.sort((a, b) => b.score - a.score || this.recencyCompare(a.entry, b.entry));
    return scored.map((s) => s.entry);
  }

  /**
   * Filter and return memories relevant to the given intent and query,
   * respecting the token budget.
   */
  getRelevantMemories(
    memories: MemoryEntry[],
    intent: string,
    query: string,
    maxTokens?: number,
  ): MemoryEntry[] {
    const budget = maxTokens ?? this.maxTokens;
    if (memories.length === 0) return [];
    if (budget <= 0) return [];

    const hasFilter = query.length > 0 || intent.length > 0;
    const scored = memories
      .map((m) => ({
        entry: m,
        score: this.scoreRelevance(m, query, intent),
      }))
      .filter((s) => !hasFilter || s.score > 0)
      .sort((a, b) => b.score - a.score || this.recencyCompare(a.entry, b.entry));

    const result: MemoryEntry[] = [];
    let usedTokens = 0;

    for (const item of scored) {
      const tokens = this.estimateTokens(item.entry.content);
      if (usedTokens + tokens <= budget) {
        result.push(item.entry);
        usedTokens += tokens;
      }
    }

    return result;
  }

  /**
   * Score a single memory against a query and intent.
   *
   * Points:
   *   Exact keyword match in content:  +3
   *   Partial keyword match in content: +1
   *   Intent category match:           +2
   *   Recency bonus (within window):   +1
   */
  private scoreRelevance(memory: MemoryEntry, query: string, intent: string): number {
    let score = 0;
    const contentLower = memory.content.toLowerCase();
    const tagsLower = memory.tags.map((t) => t.toLowerCase());

    // Keyword matching against query
    if (query) {
      const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);
      for (const keyword of keywords) {
        // Exact keyword match in content (with word boundaries) or tags
        const escaped = keyword.replace(/[-/\\^$*+....()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`);
        if (regex.test(contentLower) || tagsLower.includes(keyword)) {
          score += 3;
        } else if (contentLower.includes(keyword)) {
          // Partial match
          score += 1;
        }
      }
    }

    // Intent category match
    if (intent) {
      const intentLower = intent.toLowerCase();
      const categoryLower = memory.category.toLowerCase();
      if (categoryLower === intentLower) {
        score += 2;
      }
    }

    // Recency bonus
    if (memory.createdAt) {
      const createdTime = new Date(memory.createdAt).getTime();
      const now = Date.now();
      if (now - createdTime <= this.recencyWindowMs) {
        score += 1;
      }
    }

    return score;
  }

  /**
   * Secondary sort: newer entries first.
   */
  private recencyCompare(a: MemoryEntry, b: MemoryEntry): number {
    const timeA = new Date(a.createdAt).getTime() || 0;
    const timeB = new Date(b.createdAt).getTime() || 0;
    return timeB - timeA;
  }
}
