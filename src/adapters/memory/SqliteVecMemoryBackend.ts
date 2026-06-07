import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {
  MemoryKnowledgeBackendId,
  MemoryKnowledgeQueryReceipt,
  MemoryKnowledgeQueryResult,
  MemoryKnowledgeRecord,
  MemoryKnowledgeWriteReceipt,
} from '../../contracts/SourceMemoryDocumentTerminalPackContract.js';

type SqliteStatement = {
  run(...params: unknown[]): { changes?: number };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
};

type SqliteDatabase = {
  prepare(sql: string): SqliteStatement;
  exec(sql: string): void;
  close(): void;
};

type SqliteConstructor = new (filePath: string) => SqliteDatabase;

type MemoryRow = {
  id: string;
  namespace: string;
  text: string;
  metadata_json: string;
  keywords_json: string;
  vector_json: string;
  vector_hash: string;
  created_at: string;
};

type Runtime = {
  dbPath?: string;
  now?: () => Date;
  forceJsonFallback?: boolean;
  vectorDimensions?: number;
};

const DEFAULT_VECTOR_DIMENSIONS = 32;
const MEMORY_RECORDS_TABLE = 'zavorth_memory_records';

export class SqliteVecMemoryBackend {
  private readonly now: () => Date;
  private readonly vectorDimensions: number;
  private readonly dbPath: string;
  private readonly jsonFallbackPath: string;
  private readonly db: SqliteDatabase | null;
  private readonly sqliteVecExtensionLoaded = false;
  public readonly backendId: MemoryKnowledgeBackendId;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.vectorDimensions = runtime.vectorDimensions || DEFAULT_VECTOR_DIMENSIONS;
    this.dbPath = runtime.dbPath === ':memory:'
      ? ':memory:'
      : path.resolve(runtime.dbPath || path.join(process.cwd(), 'data', 'source-credential-vault', 'memory.sqlite'));
    this.jsonFallbackPath = this.dbPath === ':memory:'
      ? path.join(os.tmpdir(), 'zavorth-source-credential-vault-memory-fallback.json')
      : this.dbPath.replace(/\.sqlite$/i, '.json');
    this.db = runtime.forceJsonFallback ? null : this.openSqlite(this.dbPath);
    this.backendId = this.db ? 'sqlite-vector-concept-backend' : 'json-fallback-memory-backend';
    if (!this.db) {
      this.ensureJsonFallback();
    }
  }

  public write(input: {
    namespace?: string;
    text: string;
    metadata?: Record<string, unknown>;
    id?: string;
  }): { record: MemoryKnowledgeRecord; receipt: MemoryKnowledgeWriteReceipt } {
    const namespace = normalizeNamespace(input.namespace);
    const text = String(input.text || '').trim();
    const id = normalizeId(input.id || hashId(`${namespace}:${text}:${this.now().toISOString()}`));
    const vector = vectorize(text, this.vectorDimensions);
    const record: MemoryKnowledgeRecord = {
      id,
      namespace,
      text,
      metadata: sanitizeMetadata(input.metadata || {}),
      keywords: extractKeywords(text),
      vector,
      vectorHash: hashId(JSON.stringify(vector)),
      createdAt: this.now().toISOString(),
    };

    if (!text) {
      return {
        record,
        receipt: this.writeReceipt('blocked', null, namespace, 'Memory text is empty.'),
      };
    }

    if (this.db) {
      this.db.prepare(`
        INSERT OR REPLACE INTO ${MEMORY_RECORDS_TABLE}
          (id, namespace, text, metadata_json, keywords_json, vector_json, vector_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        record.id,
        record.namespace,
        record.text,
        JSON.stringify(record.metadata),
        JSON.stringify(record.keywords),
        JSON.stringify(record.vector),
        record.vectorHash,
        record.createdAt,
      );
    } else {
      const records = this.readJsonRecords().filter((entry) => entry.id !== record.id);
      records.push(record);
      this.writeJsonRecords(records);
    }

    return {
      record,
      receipt: this.writeReceipt('applied', record.id, namespace, 'Memory record persisted with deterministic vector metadata.'),
    };
  }

  public query(input: {
    namespace?: string;
    query: string;
    limit?: number;
  }): { results: MemoryKnowledgeQueryResult[]; receipt: MemoryKnowledgeQueryReceipt } {
    const namespace = normalizeNamespace(input.namespace);
    const query = String(input.query || '').trim();
    if (!query) {
      return {
        results: [],
        receipt: this.queryReceipt('blocked', namespace, query, [], 0, 'Memory query is empty.'),
      };
    }

    const queryVector = vectorize(query, this.vectorDimensions);
    const queryKeywords = extractKeywords(query);
    const records = this.loadRecords(namespace);
    const results = records
      .map((record) => {
        const semanticScore = cosineSimilarity(queryVector, record.vector);
        const keywordScore = keywordOverlap(queryKeywords, record.keywords);
        return {
          record,
          score: Number(((semanticScore * 0.82) + (keywordScore * 0.18)).toFixed(6)),
        };
      })
      .filter((entry) => entry.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return right.record.createdAt.localeCompare(left.record.createdAt);
      })
      .slice(0, Math.max(1, input.limit || 5))
      .map(({ record, score }) => ({
        recordId: record.id,
        namespace: record.namespace,
        text: record.text,
        score,
        keywords: record.keywords,
        metadata: record.metadata,
        createdAt: record.createdAt,
      }));

    return {
      results,
      receipt: this.queryReceipt(
        'applied',
        namespace,
        query,
        results.map((result) => result.recordId),
        results[0]?.score || 0,
        'Memory query replayed against persisted deterministic vectors.',
      ),
    };
  }

  public buildReplaySnapshot(namespace = 'credential-vault'): {
    backendId: MemoryKnowledgeBackendId;
    namespace: string;
    records: number;
    sqliteVecExtensionLoaded: boolean;
    vectorDimensions: number;
  } {
    return {
      backendId: this.backendId,
      namespace: normalizeNamespace(namespace),
      records: this.loadRecords(namespace).length,
      sqliteVecExtensionLoaded: this.sqliteVecExtensionLoaded,
      vectorDimensions: this.vectorDimensions,
    };
  }

  public close(): void {
    this.db?.close();
  }

  private openSqlite(dbPath: string): SqliteDatabase | null {
    try {
      if (dbPath !== ':memory:') {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      }
      const Database = require('better-sqlite3') as SqliteConstructor;
      const db = new Database(dbPath);
      db.exec(`
        CREATE TABLE IF NOT EXISTS ${MEMORY_RECORDS_TABLE} (
          id TEXT PRIMARY KEY,
          namespace TEXT NOT NULL,
          text TEXT NOT NULL,
          metadata_json TEXT NOT NULL,
          keywords_json TEXT NOT NULL,
          vector_json TEXT NOT NULL,
          vector_hash TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_zavorth_memory_namespace ON ${MEMORY_RECORDS_TABLE}(namespace);
        CREATE INDEX IF NOT EXISTS idx_zavorth_memory_created ON ${MEMORY_RECORDS_TABLE}(created_at);
      `);
      return db;
    } catch {
      return null;
    }
  }

  private loadRecords(namespace: string): MemoryKnowledgeRecord[] {
    if (this.db) {
      const rows = this.db.prepare(
        `SELECT * FROM ${MEMORY_RECORDS_TABLE} WHERE namespace = ? ORDER BY created_at DESC`,
      ).all(normalizeNamespace(namespace)) as MemoryRow[];
      return rows.map(rowToRecord);
    }
    return this.readJsonRecords().filter((record) => record.namespace === normalizeNamespace(namespace));
  }

  private writeReceipt(
    status: MemoryKnowledgeWriteReceipt['status'],
    recordId: string | null,
    namespace: string,
    reason: string,
  ): MemoryKnowledgeWriteReceipt {
    return {
      id: `credential-vault.memory.write.${hashId(`${namespace}:${recordId || reason}`)}`,
      status,
      backendId: this.backendId,
      recordId,
      namespace,
      vectorDimensions: this.vectorDimensions,
      sqliteVecExtensionLoaded: this.sqliteVecExtensionLoaded,
      artifactFirst: true,
      replayable: true,
      liveIoPerformed: false,
      secretValuesSerialized: false,
      reason,
    };
  }

  private queryReceipt(
    status: MemoryKnowledgeQueryReceipt['status'],
    namespace: string,
    query: string,
    resultRecordIds: string[],
    topScore: number,
    reason: string,
  ): MemoryKnowledgeQueryReceipt {
    return {
      id: `credential-vault.memory.query.${hashId(`${namespace}:${query}`)}`,
      status,
      backendId: this.backendId,
      namespace,
      query,
      resultRecordIds,
      topScore,
      artifactFirst: true,
      replayable: true,
      liveIoPerformed: false,
      secretValuesSerialized: false,
      reason,
    };
  }

  private ensureJsonFallback(): void {
    fs.mkdirSync(path.dirname(this.jsonFallbackPath), { recursive: true });
    if (!fs.existsSync(this.jsonFallbackPath)) {
      fs.writeFileSync(this.jsonFallbackPath, '[]', 'utf8');
    }
  }

  private readJsonRecords(): MemoryKnowledgeRecord[] {
    try {
      return (JSON.parse(fs.readFileSync(this.jsonFallbackPath, 'utf8')) as MemoryKnowledgeRecord[])
        .map(normalizeRecord)
        .filter((record): record is MemoryKnowledgeRecord => Boolean(record));
    } catch {
      return [];
    }
  }

  private writeJsonRecords(records: MemoryKnowledgeRecord[]): void {
    this.ensureJsonFallback();
    fs.writeFileSync(this.jsonFallbackPath, JSON.stringify(records, null, 2), 'utf8');
  }
}

function rowToRecord(row: MemoryRow): MemoryKnowledgeRecord {
  return {
    id: row.id,
    namespace: row.namespace,
    text: row.text,
    metadata: parseObject(row.metadata_json),
    keywords: parseStringArray(row.keywords_json),
    vector: parseNumberArray(row.vector_json),
    vectorHash: row.vector_hash,
    createdAt: row.created_at,
  };
}

function normalizeRecord(value: Partial<MemoryKnowledgeRecord> | null): MemoryKnowledgeRecord | null {
  if (!value?.id || !value.namespace || !value.text) return null;
  const vector = Array.isArray(value.vector) ? value.vector.map(Number).filter(Number.isFinite) : [];
  return {
    id: String(value.id),
    namespace: normalizeNamespace(value.namespace),
    text: String(value.text),
    metadata: sanitizeMetadata(value.metadata || {}),
    keywords: Array.isArray(value.keywords) ? value.keywords.map(String) : [],
    vector,
    vectorHash: String(value.vectorHash || hashId(JSON.stringify(vector))),
    createdAt: String(value.createdAt || new Date(0).toISOString()),
  };
}

function normalizeNamespace(value: unknown): string {
  return String(value || 'credential-vault')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'credential-vault';
}

function normalizeId(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || hashId('credential-vault-memory-record');
}

function sanitizeMetadata(value: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (/secret|token|password|api[_-]?key/i.test(key)) {
      output[key] = '[redacted]';
    } else if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean' || entry === null) {
      output[key] = entry;
    } else {
      output[key] = JSON.parse(JSON.stringify(entry));
    }
  }
  return output;
}

function extractKeywords(text: string): string[] {
  const stop = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'uma', 'com', 'para', 'por', 'que', 'dos', 'das']);
  return [...new Set(
    String(text || '')
      .toLowerCase()
      .match(/[a-z0-9_]{3,}/g) || [],
  )].filter((word) => !stop.has(word)).slice(0, 24);
}

function vectorize(text: string, dimensions: number): number[] {
  const vector = Array.from({ length: dimensions }, () => 0);
  for (const keyword of extractKeywords(text)) {
    const hash = crypto.createHash('sha256').update(keyword).digest();
    const slot = hash[0] % dimensions;
    const sign = hash[1] % 2 === 0 ? 1 : -1;
    vector[slot] += sign * (1 + (keyword.length / 12));
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + (value * value), 0));
  if (magnitude === 0) return vector;
  return vector.map((value) => Number((value / magnitude).toFixed(8)));
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || left.length !== right.length) return 0;
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] || 0;
    const rightValue = right[index] || 0;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }
  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;
  return Math.max(0, dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude)));
}

function keywordOverlap(queryKeywords: string[], recordKeywords: string[]): number {
  if (queryKeywords.length === 0 || recordKeywords.length === 0) return 0;
  const recordSet = new Set(recordKeywords.map((keyword) => keyword.toLowerCase()));
  const matches = queryKeywords.filter((keyword) => recordSet.has(keyword.toLowerCase())).length;
  return matches / Math.max(1, queryKeywords.length);
}

function hashId(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function parseObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseNumberArray(value: string): number[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
}
