import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { config } from '../config/index.js';
import { logger } from '../logger.js';

type WikiIndex = {
  pages?: Array<{ id: string; path: string; title?: string; tags?: string[] }>;
};

export type ZavorthMnemosFtsPage = {
  pageId: string;
  title: string;
  path: string;
  tags: string[];
  body: string;
};

export type ZavorthMnemosFtsHit = {
  pageId: string;
  rank: number;
};

export type ZavorthMnemosFtsIndexSnapshot = {
  version: 'zavorth-mnemos-fts-index-v1';
  generatedAt: string;
  status: 'indexed' | 'unavailable';
  dbPath: string;
  pagesIndexed: number;
  fts5Available: boolean;
  reason?: string;
  safety: {
    providerCall: false;
    networkCall: false;
    derivedIndexOnly: true;
    wikiMarkdownRemainsSourceOfTruth: true;
    secretsRedacted: true;
  };
};

const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/g,
  /\bhf_[A-Za-z0-9]{16,}\b/g,
  /\bAIza[0-9A-Za-z_-]{20,}\b/g,
  /\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*["']?[^"'\s]+/gi,
];

function redact(value: string): string {
  return SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, '[REDACTED_SECRET]'), String(value || ''));
}

export class ZavorthMnemosFtsIndexService {
  private readonly projectRoot: string;
  private readonly now: () => Date;
  private readonly require = createRequire(path.join(process.cwd(), 'package.json'));

  constructor(runtime: { projectRoot?: string; now?: () => Date } = {}) {
    this.projectRoot = path.resolve(runtime.projectRoot || config.projectRoot || process.cwd());
    this.now = runtime.now || (() => new Date());
  }

  public rebuild(): ZavorthMnemosFtsIndexSnapshot {
    const generatedAt = this.now().toISOString();
    const dbPath = this.dbPath();
    const pages = this.readPages();
    const Database = this.loadBetterSqlite();
    if (!Database) {
      return this.unavailable(generatedAt, dbPath, pages.length, 'better-sqlite3 unavailable');
    }

    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    let db: any = null;
    try {
      db = new Database(dbPath);
      db.pragma('journal_mode = WAL');
      db.exec(`
        CREATE TABLE IF NOT EXISTS mnemos_pages (
          page_id TEXT PRIMARY KEY,
          path TEXT NOT NULL,
          title TEXT NOT NULL,
          tags_json TEXT NOT NULL,
          body TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        DROP TABLE IF EXISTS mnemos_pages_fts;
        CREATE VIRTUAL TABLE IF NOT EXISTS mnemos_pages_fts
          USING fts5(page_id UNINDEXED, title, tags, body, tokenize='unicode61');
      `);
      const replacePage = db.prepare(`
        INSERT INTO mnemos_pages (page_id, path, title, tags_json, body, updated_at)
        VALUES (@pageId, @path, @title, @tagsJson, @body, @updatedAt)
        ON CONFLICT(page_id) DO UPDATE SET
          path=excluded.path,
          title=excluded.title,
          tags_json=excluded.tags_json,
          body=excluded.body,
          updated_at=excluded.updated_at
      `);
      const insertFts = db.prepare('INSERT INTO mnemos_pages_fts (page_id, title, tags, body) VALUES (?, ?, ?, ?)');
      const tx = db.transaction(() => {
        for (const page of pages) {
          replacePage.run({
            pageId: page.pageId,
            path: page.path,
            title: page.title,
            tagsJson: JSON.stringify(page.tags),
            body: page.body,
            updatedAt: generatedAt,
          });
          insertFts.run(page.pageId, page.title, page.tags.join(' '), page.body);
        }
      });
      tx();
      return {
        version: 'zavorth-mnemos-fts-index-v1',
        generatedAt,
        status: 'indexed',
        dbPath,
        pagesIndexed: pages.length,
        fts5Available: true,
        safety: this.safety(),
      };
    } catch (error: any) {
    logger.warn('[Zavorth Mnemos Fts] creation failed', error);
    return this.unavailable(generatedAt, dbPath, pages.length, String(error?.message || error || 'sqlite failed'));
  } finally {
      try {
        db?.close?.();
      } catch (error: any) {
      // ignored
      logger.warn('[Zavorth Mnemos Fts] resource cleanup failed', error);
    }
    }
  }

  public search(query: string, limit: number): { available: boolean; hits: ZavorthMnemosFtsHit[] } {
    const Database = this.loadBetterSqlite();
    const dbPath = this.dbPath();
    if (!Database || !fs.existsSync(dbPath)) {
      return { available: false, hits: [] };
    }
    const normalized = String(query || '').trim();
    if (!normalized) {
      return { available: true, hits: [] };
    }
    let db: any = null;
    try {
      db = new Database(dbPath, { readonly: true });
      const escaped = normalized
        .split(/[^a-z0-9_.-]+/i)
        .map((term) => term.trim())
        .filter((term) => term.length >= 3)
        .slice(0, 12)
        .map((term) => `"${term.replace(/"/g, '""')}"`)
        .join(' OR ');
      if (!escaped) return { available: true, hits: [] };
      const rows = db.prepare(`
        SELECT page_id as pageId, bm25(mnemos_pages_fts) as score
        FROM mnemos_pages_fts
        WHERE mnemos_pages_fts MATCH ?
        ORDER BY score ASC
        LIMIT ?
      `).all(escaped, Math.max(1, Math.min(limit, 20))) as Array<{ pageId: string; score: number }>;
      return {
        available: true,
        hits: rows.map((row, index) => ({ pageId: row.pageId, rank: index + 1 })),
      };
    } catch (error: any) {
    logger.warn('[Zavorth Mnemos Fts] array operation failed', error);
    return { available: false, hits: [] };
  } finally {
      try {
        db?.close?.();
      } catch (error: any) {
      // ignored
      logger.warn('[Zavorth Mnemos Fts] resource cleanup failed', error);
    }
    }
  }

  public dbPath(): string {
    return path.join(this.projectRoot, '.zavorth', 'memory', 'mnemos-index.sqlite');
  }

  private readPages(): ZavorthMnemosFtsPage[] {
    const indexPath = this.resolveWorkspacePath('.zavorth/wiki/index.json');
    const index = JSON.parse(String(fs.readFileSync(indexPath, 'utf8'))) as WikiIndex;
    return (index.pages || []).map((page) => {
      const pagePath = String(page.path || '');
      if (!pagePath.startsWith('.zavorth/wiki/')) {
        throw new Error(`Mnemos FTS page outside wiki root: ${pagePath}`);
      }
      return {
        pageId: String(page.id || path.basename(pagePath, '.md')),
        title: String(page.title || page.id || path.basename(pagePath, '.md')),
        path: pagePath,
        tags: page.tags || [],
        body: redact(String(fs.readFileSync(this.resolveWorkspacePath(pagePath), 'utf8'))),
      };
    });
  }

  private resolveWorkspacePath(inputPath: string): string {
    const absolute = path.resolve(this.projectRoot, inputPath);
    const relative = path.relative(this.projectRoot, absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Mnemos FTS path escapes workspace: ${inputPath}`);
    }
    return absolute;
  }

  private loadBetterSqlite(): any | null {
    try {
      return this.require('better-sqlite3');
    } catch (error: any) { logger.warn('[Zavorth Mnemos Fts] lifecycle operation failed', error); return null; }
  }

  private unavailable(
    generatedAt: string,
    dbPath: string,
    pagesIndexed: number,
    reason: string,
  ): ZavorthMnemosFtsIndexSnapshot {
    return {
      version: 'zavorth-mnemos-fts-index-v1',
      generatedAt,
      status: 'unavailable',
      dbPath,
      pagesIndexed,
      fts5Available: false,
      reason,
      safety: this.safety(),
    };
  }

  private safety(): ZavorthMnemosFtsIndexSnapshot['safety'] {
    return {
      providerCall: false,
      networkCall: false,
      derivedIndexOnly: true,
      wikiMarkdownRemainsSourceOfTruth: true,
      secretsRedacted: true,
    };
  }
}
