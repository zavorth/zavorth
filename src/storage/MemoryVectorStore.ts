import fs from 'fs';
import path from 'path';
import type { MemoryChunk } from '../runtime/sessions/v2/InfiniteMemoryCompressor.js';
import type { VectorEmbeddingService } from '../services/VectorEmbeddingService.js';

/**
 * MemoryVectorStore — SQLite-backed persistent storage for compressed memory chunks.
 *
 * This provides durable, indexed storage for the InfiniteMemoryCompressor's
 * compressed memory chunks. When a PTY session produces long-running output
 * that gets compressed by the LLM, the resulting summary and keywords are
 * persisted here so they survive process restarts.
 *
 * Architecture decisions:
 *  - Uses better-sqlite3 for synchronous, zero-config SQLite access
 *  - Falls back to a JSON file store if better-sqlite3 is not installed
 *  - Keywords are stored as JSON array and searched via LIKE patterns
 *  - FTS5 could be layered on top for production-grade search
 */

type SqliteDatabase = {
  prepare(sql: string): {
    run(...params: unknown[]): any;
    get(...params: unknown[]): any;
    all(...params: unknown[]): any[];
  };
  exec(sql: string): void;
  close(): void;
};

type MemoryVectorStoreOptions = {
  forceFallback?: boolean;
  embeddingService?: Pick<VectorEmbeddingService, 'generate'> | null;
};

export class MemoryVectorStore {
  private db: SqliteDatabase | null = null;
  private readonly dbPath: string;
  private readonly fallbackPath: string;
  private useFallback = false;

  constructor(dbDir?: string, private readonly options: MemoryVectorStoreOptions = {}) {
    const dir = dbDir || path.join(process.cwd(), 'data', 'memory');
    fs.mkdirSync(dir, { recursive: true });
    this.dbPath = path.join(dir, 'memory_vectors.sqlite');
    this.fallbackPath = path.join(dir, 'memory_vectors.json');
    this.initialize();
  }

  private initialize(): void {
    if (this.options.forceFallback) {
      this.initializeFallback();
      return;
    }

    try {
      // Try to load better-sqlite3 dynamically
      const Database = require('better-sqlite3');
      this.db = new Database(this.dbPath) as SqliteDatabase;
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS memory_chunks (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          original_token_count INTEGER NOT NULL,
          compressed_summary TEXT NOT NULL,
          keywords_json TEXT NOT NULL DEFAULT '[]',
          embedding_json TEXT,
          relevance_score REAL NOT NULL DEFAULT 1.0
        );
        CREATE INDEX IF NOT EXISTS idx_memory_session ON memory_chunks(session_id);
        CREATE INDEX IF NOT EXISTS idx_memory_created ON memory_chunks(created_at);
      `);
      try {
        this.db.exec('ALTER TABLE memory_chunks ADD COLUMN embedding_json TEXT');
      } catch (error: unknown) {// Existing databases may already contain the column.
      }
    } catch (error: unknown) {// better-sqlite3 not available — use JSON file fallback
      this.initializeFallback();
    }
  }

  private initializeFallback(): void {
    this.useFallback = true;
    this.db = null;
    if (!fs.existsSync(this.fallbackPath)) {
      fs.writeFileSync(this.fallbackPath, '[]', 'utf8');
    }
  }

  /**
   * Save a compressed memory chunk to persistent storage.
   */
  public async save(chunk: MemoryChunk): Promise<void> {
    const normalizedChunk = await this.ensureEmbedding(chunk);

    if (this.db && !this.useFallback) {
      this.db.prepare(`
        INSERT OR REPLACE INTO memory_chunks
        (id, session_id, created_at, original_token_count, compressed_summary, keywords_json, embedding_json, relevance_score)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        normalizedChunk.id,
        normalizedChunk.sessionId,
        normalizedChunk.createdAt,
        normalizedChunk.originalTokenCount,
        normalizedChunk.compressedSummary,
        JSON.stringify(normalizedChunk.keywords),
        JSON.stringify(normalizedChunk.embedding || null),
        normalizedChunk.relevanceScore,
      );
      return;
    }

    // JSON fallback
    const chunks = this.loadFallbackChunks();
    const existing = chunks.findIndex((c) => c.id === normalizedChunk.id);
    if (existing >= 0) {
      chunks[existing] = normalizedChunk;
    } else {
      chunks.push(normalizedChunk);
    }
    this.saveFallbackChunks(chunks);
  }

  /**
   * Search for memory chunks by keyword overlap.
   * Returns the most relevant chunks matching any of the given keywords.
   */
  public search(keywords: string[], limit: number = 10): MemoryChunk[] {
    if (this.db && !this.useFallback) {
      if (keywords.length === 0) {
        return this.db.prepare(
          'SELECT * FROM memory_chunks ORDER BY created_at DESC LIMIT ?'
        ).all(limit).map((row) => this.rowToChunk(row));
      }

      // Build a scoring query: count matching keywords via LIKE
      const conditions = keywords.map(() => `keywords_json LIKE ?`).join(' OR ');
      const params = keywords.map((k) => `%${k}%`);
      params.push(String(limit));

      return this.db.prepare(
        `SELECT *, (${keywords.map(() => `(CASE WHEN keywords_json LIKE ? THEN 1 ELSE 0 END)`).join(' + ')}) as match_score
         FROM memory_chunks
         WHERE ${conditions}
         ORDER BY match_score DESC, created_at DESC
         LIMIT ?`
      ).all(...keywords.map((k) => `%${k}%`), ...params).map((row) => this.rowToChunk(row));
    }

    // JSON fallback
    const chunks = this.loadFallbackChunks();
    if (keywords.length === 0) {
      return chunks.slice(-limit);
    }

    return chunks
      .map((chunk) => {
        const score = keywords.filter((k) => chunk.keywords.includes(k)).length;
        return { chunk, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.chunk);
  }

  public searchSemantic(queryEmbedding: number[], limit: number = 10, keywords: string[] = []): MemoryChunk[] {
    const candidates = this.loadSearchCandidates(limit * 6 || 60);

    return candidates
      .map((chunk) => {
        const semanticScore = this.cosineSimilarity(queryEmbedding, chunk.embedding || null);
        const keywordScore = this.computeKeywordScore(keywords, chunk.keywords);
        const combinedScore = semanticScore > 0
          ? (semanticScore * 0.88) + (keywordScore * 0.12)
          : keywordScore;

        return {
          chunk: {
            ...chunk,
            relevanceScore: Number(combinedScore.toFixed(3)),
          },
          score: combinedScore,
        };
      })
      .filter((entry) => entry.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return String(right.chunk.createdAt).localeCompare(String(left.chunk.createdAt));
      })
      .slice(0, Math.max(1, limit))
      .map((entry) => entry.chunk);
  }

  /**
   * List all memory chunks for a specific session.
   */
  public listBySession(sessionId: string): MemoryChunk[] {
    if (this.db && !this.useFallback) {
      return this.db.prepare(
        'SELECT * FROM memory_chunks WHERE session_id = ? ORDER BY created_at ASC'
      ).all(sessionId).map((row) => this.rowToChunk(row));
    }

    return this.loadFallbackChunks().filter((c) => c.sessionId === sessionId);
  }

  /**
   * Delete all memory chunks for a session.
   */
  public deleteBySession(sessionId: string): number {
    if (this.db && !this.useFallback) {
      const result = this.db.prepare(
        'DELETE FROM memory_chunks WHERE session_id = ?'
      ).run(sessionId);
      return result.changes || 0;
    }

    const chunks = this.loadFallbackChunks();
    const filtered = chunks.filter((c) => c.sessionId !== sessionId);
    this.saveFallbackChunks(filtered);
    return chunks.length - filtered.length;
  }

  /**
   * Get total chunk count across all sessions.
   */
  public count(): number {
    if (this.db && !this.useFallback) {
      const row = this.db.prepare('SELECT COUNT(*) as cnt FROM memory_chunks').get() as { cnt: number };
      return row.cnt;
    }
    return this.loadFallbackChunks().length;
  }

  /**
   * Close the database connection.
   */
  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private rowToChunk(row: unknown): MemoryChunk {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id || ''),
      sessionId: String(r.session_id || ''),
      createdAt: String(r.created_at || ''),
      originalTokenCount: Number(r.original_token_count || 0),
      compressedSummary: String(r.compressed_summary || ''),
      keywords: JSON.parse(String(r.keywords_json || '[]')),
      embedding: this.parseEmbedding(String(r.embedding_json || '')),
      relevanceScore: Number(r.relevance_score || 0),
    };
  }

  private loadFallbackChunks(): MemoryChunk[] {
    try {
      const raw = fs.readFileSync(this.fallbackPath, 'utf8');
      return (JSON.parse(raw) as MemoryChunk[]).map((chunk) => this.normalizeChunk(chunk));
    } catch (error: unknown) {return [];
    }
  }

  private saveFallbackChunks(chunks: MemoryChunk[]): void {
    fs.writeFileSync(this.fallbackPath, JSON.stringify(chunks, null, 2), 'utf8');
  }

  private async ensureEmbedding(chunk: MemoryChunk): Promise<MemoryChunk> {
    if (Array.isArray(chunk.embedding) && chunk.embedding.length > 0) {
      return this.normalizeChunk(chunk);
    }

    const embeddingService = this.options.embeddingService;
    if (!embeddingService) {
      return this.normalizeChunk(chunk);
    }

    try {
      const embedding = await embeddingService.generate(this.embeddingPayload(chunk));
      return this.normalizeChunk({
        ...chunk,
        embedding,
      });
    } catch (error: unknown) {return this.normalizeChunk(chunk);
    }
  }

  private normalizeChunk(chunk: MemoryChunk): MemoryChunk {
    return {
      ...chunk,
      keywords: Array.isArray(chunk.keywords)
        ? chunk.keywords.map((keyword) => String(keyword || '').trim()).filter(Boolean)
        : [],
      embedding: Array.isArray(chunk.embedding)
        ? chunk.embedding.map((value) => Number(value)).filter((value) => Number.isFinite(value))
        : null,
    };
  }

  private loadSearchCandidates(limit: number): MemoryChunk[] {
    if (this.db && !this.useFallback) {
      return this.db.prepare(
        'SELECT * FROM memory_chunks ORDER BY created_at DESC LIMIT ?'
      ).all(Math.max(1, limit)).map((row) => this.rowToChunk(row));
    }

    return this.loadFallbackChunks()
      .slice()
      .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
      .slice(0, Math.max(1, limit));
  }

  private embeddingPayload(chunk: MemoryChunk): string {
    return [
      chunk.compressedSummary,
      ...(Array.isArray(chunk.keywords) ? chunk.keywords : []),
    ].filter(Boolean).join('\n');
  }

  private parseEmbedding(raw: unknown): number[] | null {
    if (Array.isArray(raw)) {
      const values = raw.map((value) => Number(value)).filter((value) => Number.isFinite(value));
      return values.length > 0 ? values : null;
    }

    if (typeof raw !== 'string' || !raw.trim()) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return null;
      }
      const values = parsed.map((value) => Number(value)).filter((value) => Number.isFinite(value));
      return values.length > 0 ? values : null;
    } catch (error: unknown) {return null;
    }
  }

  private computeKeywordScore(queryKeywords: string[], chunkKeywords: string[]): number {
    if (!Array.isArray(queryKeywords) || queryKeywords.length === 0) {
      return 0;
    }
    const normalizedChunkKeywords = new Set(
      Array.isArray(chunkKeywords)
        ? chunkKeywords.map((keyword) => String(keyword || '').trim().toLowerCase()).filter(Boolean)
        : [],
    );
    const matches = queryKeywords.filter((keyword) => normalizedChunkKeywords.has(String(keyword || '').trim().toLowerCase()));
    return matches.length / Math.max(1, queryKeywords.length);
  }

  private cosineSimilarity(left: number[], right: number[] | null): number {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length === 0 || right.length === 0 || left.length !== right.length) {
      return 0;
    }

    let dot = 0;
    let leftMagnitude = 0;
    let rightMagnitude = 0;
    for (let index = 0; index < left.length; index += 1) {
      const leftValue = Number(left[index]) || 0;
      const rightValue = Number(right[index]) || 0;
      dot += leftValue * rightValue;
      leftMagnitude += leftValue * leftValue;
      rightMagnitude += rightValue * rightValue;
    }

    if (leftMagnitude === 0 || rightMagnitude === 0) {
      return 0;
    }

    const similarity = dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
    return Number(Math.max(0, Math.min(similarity, 1)).toFixed(6));
  }
}
