/**
 * SessionPersistenceStore — Session persistence in SQLite (better-sqlite3).
 *
 * Phase 3: real SQLite with WAL, schema versioning, and one-time JSON migration.
 * Public API remains async for callers that already await.
 *
 * Usage:
 *   const store = new SessionPersistenceStore({ dbPath: '.zavorth/sessions' });
 *   // or: { dbPath: '.zavorth/sessions.db' }
 *   await store.initialize();
 *   await store.saveSession({ id: 'ses_123', ... });
 */

import fs from 'fs';
import path from 'path';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';

export interface SessionState {
  id: string;
  status: 'active' | 'idle' | 'completed' | 'error';
  createdAt: string;
  updatedAt: string;
  workspace: string;
  model: string;
  messageCount: number;
  tokenUsage: { input: number; output: number };
  metadata: Record<string, unknown>;
}

export interface CompressedMemoryChunk {
  id: string;
  sessionId: string;
  content: string;
  keywords: string[];
  timestamp: string;
  tokenCount: number;
}

export interface SessionPersistenceOptions {
  /**
   * Directory (legacy JSON layout) or path ending in .db/.sqlite.
   * Directory → `<dir>/sessions.sqlite` (+ optional JSON import from sessions/ memory/).
   */
  dbPath: string;
  maxSessions?: number;
  maxMemoryChunks?: number;
}

const SCHEMA_VERSION = 1;

type SqliteConstructor = new (
  filename: string,
  options?: { readonly?: boolean },
) => BetterSqliteDatabase;

export class SessionPersistenceStore {
  private readonly rootPath: string;
  private readonly dbFilePath: string;
  private readonly legacySessionsDir: string;
  private readonly legacyMemoryDir: string;
  private readonly maxSessions: number;
  private readonly maxMemoryChunks: number;
  private initialized = false;
  private db: BetterSqliteDatabase | null = null;

  constructor(options: SessionPersistenceOptions) {
    this.rootPath = options.dbPath;
    this.maxSessions = options.maxSessions ?? 1000;
    this.maxMemoryChunks = options.maxMemoryChunks ?? 10_000;

    const isFile = /\.(db|sqlite|sqlite3)$/i.test(options.dbPath);
    if (isFile) {
      this.dbFilePath = options.dbPath;
      this.legacySessionsDir = path.join(path.dirname(options.dbPath), 'sessions');
      this.legacyMemoryDir = path.join(path.dirname(options.dbPath), 'memory');
    } else {
      this.dbFilePath = path.join(options.dbPath, 'sessions.sqlite');
      this.legacySessionsDir = path.join(options.dbPath, 'sessions');
      this.legacyMemoryDir = path.join(options.dbPath, 'memory');
    }
  }

  /**
   * Opens SQLite (WAL), applies schema, migrates legacy JSON if present.
   */
  async initialize(): Promise<void> {
    if (this.initialized && this.db) return;

    const dir = path.dirname(this.dbFilePath);
    fs.mkdirSync(dir, { recursive: true });
    // Keep legacy dirs for migration / backward tooling
    fs.mkdirSync(this.legacySessionsDir, { recursive: true });
    fs.mkdirSync(this.legacyMemoryDir, { recursive: true });

    const Database = loadBetterSqlite3();
    this.db = new Database(this.dbFilePath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');

    this.applySchema(this.db);
    this.migrateJsonIfNeeded(this.db);

    this.initialized = true;
  }

  /**
   * Optional explicit close (tests / shutdown).
   */
  close(): void {
    if (this.db) {
      try {
        this.db.close();
      } catch {
        // ignore
      }
      this.db = null;
    }
    this.initialized = false;
  }

  async saveSession(state: SessionState): Promise<void> {
    const db = await this.requireDb();
    const updatedAt = new Date().toISOString();
    const tokenIn = Number(state.tokenUsage?.input || 0) || 0;
    const tokenOut = Number(state.tokenUsage?.output || 0) || 0;
    const metadataJson = JSON.stringify(state.metadata || {});

    db.prepare(`
      INSERT INTO sessions (
        id, status, created_at, updated_at, workspace, model,
        message_count, token_input, token_output, metadata_json
      ) VALUES (
        @id, @status, @created_at, @updated_at, @workspace, @model,
        @message_count, @token_input, @token_output, @metadata_json
      )
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        updated_at = excluded.updated_at,
        workspace = excluded.workspace,
        model = excluded.model,
        message_count = excluded.message_count,
        token_input = excluded.token_input,
        token_output = excluded.token_output,
        metadata_json = excluded.metadata_json
    `).run({
      id: state.id,
      status: state.status,
      created_at: state.createdAt || updatedAt,
      updated_at: updatedAt,
      workspace: state.workspace || '',
      model: state.model || '',
      message_count: state.messageCount || 0,
      token_input: tokenIn,
      token_output: tokenOut,
      metadata_json: metadataJson,
    });

    await this.pruneOldSessions();
  }

  async loadSession(id: string): Promise<SessionState | null> {
    const db = await this.requireDb();
    const row = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id) as SessionRow | undefined;
    return row ? rowToSession(row) : null;
  }

  async deleteSession(id: string): Promise<void> {
    const db = await this.requireDb();
    const tx = db.transaction(() => {
      db.prepare(`DELETE FROM memory_chunks WHERE session_id = ?`).run(id);
      db.prepare(`DELETE FROM sessions WHERE id = ?`).run(id);
    });
    tx();

    // Clean legacy files if any
    const sessionFile = path.join(this.legacySessionsDir, `${id}.json`);
    const memFile = path.join(this.legacyMemoryDir, `${id}.json`);
    if (fs.existsSync(sessionFile)) fs.unlinkSync(sessionFile);
    if (fs.existsSync(memFile)) fs.unlinkSync(memFile);
  }

  async listSessions(): Promise<SessionState[]> {
    const db = await this.requireDb();
    const rows = db.prepare(`
      SELECT * FROM sessions ORDER BY datetime(updated_at) DESC
    `).all() as SessionRow[];
    return rows.map(rowToSession);
  }

  async saveMemoryChunks(sessionId: string, chunks: CompressedMemoryChunk[]): Promise<void> {
    const db = await this.requireDb();
    const limited = chunks.slice(-this.maxMemoryChunks);
    const tx = db.transaction(() => {
      db.prepare(`DELETE FROM memory_chunks WHERE session_id = ?`).run(sessionId);
      const insert = db.prepare(`
        INSERT INTO memory_chunks (
          id, session_id, content, keywords_json, timestamp, token_count
        ) VALUES (
          @id, @session_id, @content, @keywords_json, @timestamp, @token_count
        )
      `);
      for (const chunk of limited) {
        insert.run({
          id: chunk.id,
          session_id: sessionId,
          content: chunk.content || '',
          keywords_json: JSON.stringify(chunk.keywords || []),
          timestamp: chunk.timestamp || new Date().toISOString(),
          token_count: chunk.tokenCount || 0,
        });
      }
    });
    tx();
  }

  async loadMemoryChunks(sessionId: string): Promise<CompressedMemoryChunk[]> {
    const db = await this.requireDb();
    const rows = db.prepare(`
      SELECT * FROM memory_chunks
      WHERE session_id = ?
      ORDER BY rowid ASC
    `).all(sessionId) as MemoryRow[];
    return rows.map(rowToChunk);
  }

  async appendMemoryChunk(sessionId: string, chunk: CompressedMemoryChunk): Promise<void> {
    const existing = await this.loadMemoryChunks(sessionId);
    existing.push(chunk);
    await this.saveMemoryChunks(sessionId, existing);
  }

  /**
   * Full-text search over memory chunk content (FTS5).
   */
  async searchMemory(query: string, limit = 20): Promise<CompressedMemoryChunk[]> {
    const db = await this.requireDb();
    const q = String(query || '').trim();
    if (!q) return [];
    try {
      const rows = db.prepare(`
        SELECT c.*
        FROM memory_chunks_fts f
        JOIN memory_chunks c ON c.rowid = f.rowid
        WHERE memory_chunks_fts MATCH ?
        LIMIT ?
      `).all(q, Math.max(1, Math.min(200, limit))) as MemoryRow[];
      return rows.map(rowToChunk);
    } catch {
      // Fallback LIKE if FTS query invalid
      const rows = db.prepare(`
        SELECT * FROM memory_chunks
        WHERE content LIKE ?
        ORDER BY rowid DESC
        LIMIT ?
      `).all(`%${q.replace(/%/g, '')}%`, Math.max(1, Math.min(200, limit))) as MemoryRow[];
      return rows.map(rowToChunk);
    }
  }

  async getStats(): Promise<{
    totalSessions: number;
    totalMemoryChunks: number;
    dbSizeBytes: number;
  }> {
    const db = await this.requireDb();
    const sessions = db.prepare(`SELECT COUNT(*) AS c FROM sessions`).get() as { c: number };
    const chunks = db.prepare(`SELECT COUNT(*) AS c FROM memory_chunks`).get() as { c: number };
    let dbSize = 0;
    try {
      if (fs.existsSync(this.dbFilePath)) {
        dbSize = fs.statSync(this.dbFilePath).size;
        const wal = `${this.dbFilePath}-wal`;
        const shm = `${this.dbFilePath}-shm`;
        if (fs.existsSync(wal)) dbSize += fs.statSync(wal).size;
        if (fs.existsSync(shm)) dbSize += fs.statSync(shm).size;
      }
    } catch {
      // ignore
    }
    return {
      totalSessions: Number(sessions?.c || 0),
      totalMemoryChunks: Number(chunks?.c || 0),
      dbSizeBytes: dbSize,
    };
  }

  /** Path to the SQLite file (for diagnostics). */
  getDbFilePath(): string {
    return this.dbFilePath;
  }

  private async pruneOldSessions(): Promise<void> {
    const db = await this.requireDb();
    const countRow = db.prepare(`SELECT COUNT(*) AS c FROM sessions`).get() as { c: number };
    const count = Number(countRow?.c || 0);
    if (count <= this.maxSessions) return;

    const overflow = count - this.maxSessions;
    const old = db.prepare(`
      SELECT id FROM sessions
      ORDER BY datetime(updated_at) ASC
      LIMIT ?
    `).all(overflow) as Array<{ id: string }>;

    for (const row of old) {
      await this.deleteSession(row.id);
    }
  }

  private applySchema(db: BetterSqliteDatabase): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        workspace TEXT NOT NULL DEFAULT '',
        model TEXT NOT NULL DEFAULT '',
        message_count INTEGER NOT NULL DEFAULT 0,
        token_input INTEGER NOT NULL DEFAULT 0,
        token_output INTEGER NOT NULL DEFAULT 0,
        metadata_json TEXT NOT NULL DEFAULT '{}'
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_updated
        ON sessions(updated_at);

      CREATE TABLE IF NOT EXISTS memory_chunks (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        keywords_json TEXT NOT NULL DEFAULT '[]',
        timestamp TEXT NOT NULL,
        token_count INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_memory_session
        ON memory_chunks(session_id);
    `);

    // FTS5 for content search (optional if unavailable)
    try {
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS memory_chunks_fts
        USING fts5(
          content,
          keywords_json,
          content='memory_chunks',
          content_rowid='rowid'
        );

        CREATE TRIGGER IF NOT EXISTS memory_chunks_ai AFTER INSERT ON memory_chunks BEGIN
          INSERT INTO memory_chunks_fts(rowid, content, keywords_json)
          VALUES (new.rowid, new.content, new.keywords_json);
        END;

        CREATE TRIGGER IF NOT EXISTS memory_chunks_ad AFTER DELETE ON memory_chunks BEGIN
          INSERT INTO memory_chunks_fts(memory_chunks_fts, rowid, content, keywords_json)
          VALUES ('delete', old.rowid, old.content, old.keywords_json);
        END;

        CREATE TRIGGER IF NOT EXISTS memory_chunks_au AFTER UPDATE ON memory_chunks BEGIN
          INSERT INTO memory_chunks_fts(memory_chunks_fts, rowid, content, keywords_json)
          VALUES ('delete', old.rowid, old.content, old.keywords_json);
          INSERT INTO memory_chunks_fts(rowid, content, keywords_json)
          VALUES (new.rowid, new.content, new.keywords_json);
        END;
      `);
    } catch {
      // FTS5 may be unavailable on some builds; LIKE fallback remains.
    }

    const ver = db.prepare(`SELECT version FROM schema_version LIMIT 1`).get() as { version: number } | undefined;
    if (!ver) {
      db.prepare(`INSERT INTO schema_version (version) VALUES (?)`).run(SCHEMA_VERSION);
    } else if (ver.version < SCHEMA_VERSION) {
      // Future migrations go here
      db.prepare(`UPDATE schema_version SET version = ?`).run(SCHEMA_VERSION);
    }
  }

  private migrateJsonIfNeeded(db: BetterSqliteDatabase): void {
    const flag = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='_migration_flags'
    `).get();
    if (!flag) {
      db.exec(`CREATE TABLE IF NOT EXISTS _migration_flags (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`);
    }
    const done = db.prepare(`SELECT value FROM _migration_flags WHERE key = 'json_v1'`).get() as
      | { value: string }
      | undefined;
    if (done?.value === '1') return;

    if (!fs.existsSync(this.legacySessionsDir)) {
      db.prepare(`
        INSERT INTO _migration_flags (key, value) VALUES ('json_v1', '1')
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run();
      return;
    }

    const sessionFiles = fs.readdirSync(this.legacySessionsDir).filter((f) => f.endsWith('.json'));
    const insertSession = db.prepare(`
      INSERT OR IGNORE INTO sessions (
        id, status, created_at, updated_at, workspace, model,
        message_count, token_input, token_output, metadata_json
      ) VALUES (
        @id, @status, @created_at, @updated_at, @workspace, @model,
        @message_count, @token_input, @token_output, @metadata_json
      )
    `);
    const insertChunk = db.prepare(`
      INSERT OR IGNORE INTO memory_chunks (
        id, session_id, content, keywords_json, timestamp, token_count
      ) VALUES (
        @id, @session_id, @content, @keywords_json, @timestamp, @token_count
      )
    `);

    const migrate = db.transaction(() => {
      for (const file of sessionFiles) {
        try {
          const raw = JSON.parse(
            fs.readFileSync(path.join(this.legacySessionsDir, file), 'utf-8'),
          ) as SessionState;
          if (!raw?.id) continue;
          insertSession.run({
            id: raw.id,
            status: raw.status || 'idle',
            created_at: raw.createdAt || new Date().toISOString(),
            updated_at: raw.updatedAt || new Date().toISOString(),
            workspace: raw.workspace || '',
            model: raw.model || '',
            message_count: raw.messageCount || 0,
            token_input: raw.tokenUsage?.input || 0,
            token_output: raw.tokenUsage?.output || 0,
            metadata_json: JSON.stringify(raw.metadata || {}),
          });
        } catch {
          // skip corrupt
        }
      }

      if (fs.existsSync(this.legacyMemoryDir)) {
        const memFiles = fs.readdirSync(this.legacyMemoryDir).filter((f) => f.endsWith('.json'));
        for (const file of memFiles) {
          try {
            const chunks = JSON.parse(
              fs.readFileSync(path.join(this.legacyMemoryDir, file), 'utf-8'),
            ) as CompressedMemoryChunk[];
            if (!Array.isArray(chunks)) continue;
            for (const chunk of chunks) {
              if (!chunk?.id || !chunk.sessionId) continue;
              insertChunk.run({
                id: chunk.id,
                session_id: chunk.sessionId,
                content: chunk.content || '',
                keywords_json: JSON.stringify(chunk.keywords || []),
                timestamp: chunk.timestamp || new Date().toISOString(),
                token_count: chunk.tokenCount || 0,
              });
            }
          } catch {
            // skip
          }
        }
      }

      db.prepare(`
        INSERT INTO _migration_flags (key, value) VALUES ('json_v1', '1')
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run();
    });

    migrate();
  }

  private async requireDb(): Promise<BetterSqliteDatabase> {
    await this.initialize();
    if (!this.db) {
      throw new Error('SessionPersistenceStore database is not open.');
    }
    return this.db;
  }
}

// ── helpers ──────────────────────────────────────────────────────────

type SessionRow = {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  workspace: string;
  model: string;
  message_count: number;
  token_input: number;
  token_output: number;
  metadata_json: string;
};

type MemoryRow = {
  id: string;
  session_id: string;
  content: string;
  keywords_json: string;
  timestamp: string;
  token_count: number;
};

function rowToSession(row: SessionRow): SessionState {
  let metadata: Record<string, unknown> = {};
  try {
    metadata = JSON.parse(row.metadata_json || '{}') as Record<string, unknown>;
  } catch {
    metadata = {};
  }
  return {
    id: row.id,
    status: (row.status as SessionState['status']) || 'idle',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    workspace: row.workspace || '',
    model: row.model || '',
    messageCount: Number(row.message_count || 0),
    tokenUsage: {
      input: Number(row.token_input || 0),
      output: Number(row.token_output || 0),
    },
    metadata,
  };
}

function rowToChunk(row: MemoryRow): CompressedMemoryChunk {
  let keywords: string[] = [];
  try {
    keywords = JSON.parse(row.keywords_json || '[]') as string[];
    if (!Array.isArray(keywords)) keywords = [];
  } catch {
    keywords = [];
  }
  return {
    id: row.id,
    sessionId: row.session_id,
    content: row.content || '',
    keywords,
    timestamp: row.timestamp,
    tokenCount: Number(row.token_count || 0),
  };
}

function loadBetterSqlite3(): SqliteConstructor {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('better-sqlite3') as SqliteConstructor;
}
