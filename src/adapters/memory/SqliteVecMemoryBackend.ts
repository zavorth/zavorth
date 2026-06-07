import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
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

type FullFileEncryptionMode = 'off' | 'opportunistic' | 'required';
type FullFileEncryptionStatus = 'off' | 'active' | 'unavailable' | 'required-unavailable' | 'unverified';
type FullFileEncryptionConfig = {
  mode?: FullFileEncryptionMode;
  key?: string | Buffer;
  keyPath?: string;
  keyStore?: 'auto' | 'file' | 'os';
  driverPackages?: string[];
};

type FullFileEncryptionState = {
  mode: FullFileEncryptionMode;
  required: boolean;
  key: Buffer | null;
  keyStorage: 'none' | 'runtime' | 'env' | 'file' | 'os-protected-file';
  driverPackages: string[];
  driverPackage: string | null;
  status: FullFileEncryptionStatus;
  active: boolean;
  proof: {
    unkeyedOpenBlocked: boolean | null;
    reason: string;
  };
};

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
  atRestEncryptionKey?: string | Buffer;
  atRestEncryptionKeyPath?: string;
  fullFileEncryption?: boolean | FullFileEncryptionConfig;
};

const DEFAULT_VECTOR_DIMENSIONS = 32;
const MEMORY_RECORDS_TABLE = 'zavorth_memory_records';
const ENCRYPTED_VALUE_PREFIX = 'enc:v1:';
const MEMORY_ENCRYPTION_AAD = Buffer.from('zavorth.memory.records.v1', 'utf8');

export class SqliteVecMemoryBackend {
  private readonly now: () => Date;
  private readonly vectorDimensions: number;
  private readonly dbPath: string;
  private readonly jsonFallbackPath: string;
  private readonly atRestEncryptionKey: Buffer;
  private readonly fullFileEncryption: FullFileEncryptionState;
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
    this.atRestEncryptionKey = resolveAtRestEncryptionKey({
      dbPath: this.dbPath,
      keyPath: runtime.atRestEncryptionKeyPath,
      key: runtime.atRestEncryptionKey,
    });
    this.fullFileEncryption = resolveFullFileEncryptionState({
      dbPath: this.dbPath,
      config: runtime.fullFileEncryption,
    });
    this.db = runtime.forceJsonFallback ? null : this.openSqlite(this.dbPath);
    this.backendId = this.db ? 'sqlite-vector-concept-backend' : 'json-fallback-memory-backend';
    if (this.db) {
      this.migrateSqliteRows();
    } else {
      this.ensureJsonFallback();
      this.migrateJsonFallback();
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

    this.persistRecord(record);

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
    atRestEncrypted: true;
    atRestEncryptionMode: 'field' | 'field+file' | 'json-field';
    fullFileEncrypted: boolean;
    fullFileEncryptionStatus: FullFileEncryptionStatus;
    fullFileEncryptionRequired: boolean;
    fullFileEncryptionProof: FullFileEncryptionState['proof'];
    fullFileEncryptionKeyStorage: FullFileEncryptionState['keyStorage'];
    fullFileEncryptionDriverPackage: string | null;
    vectorDimensions: number;
  } {
    return {
      backendId: this.backendId,
      namespace: normalizeNamespace(namespace),
      records: this.loadRecords(namespace).length,
      sqliteVecExtensionLoaded: this.sqliteVecExtensionLoaded,
      atRestEncrypted: true,
      atRestEncryptionMode: this.atRestEncryptionMode(),
      fullFileEncrypted: this.fullFileEncryption.active,
      fullFileEncryptionStatus: this.fullFileEncryption.status,
      fullFileEncryptionRequired: this.fullFileEncryption.required,
      fullFileEncryptionProof: this.fullFileEncryption.proof,
      fullFileEncryptionKeyStorage: this.fullFileEncryption.keyStorage,
      fullFileEncryptionDriverPackage: this.fullFileEncryption.driverPackage,
      vectorDimensions: this.vectorDimensions,
    };
  }

  public exportRecords(namespace?: string): MemoryKnowledgeRecord[] {
    if (this.db) {
      const rows = namespace
        ? this.db.prepare(`SELECT * FROM ${MEMORY_RECORDS_TABLE} WHERE namespace = ? ORDER BY created_at ASC`).all(normalizeNamespace(namespace)) as MemoryRow[]
        : this.db.prepare(`SELECT * FROM ${MEMORY_RECORDS_TABLE} ORDER BY created_at ASC`).all() as MemoryRow[];
      return rows.map((row) => rowToRecord(row, this.atRestEncryptionKey));
    }
    const records = this.readJsonRecords();
    return namespace ? records.filter((record) => record.namespace === normalizeNamespace(namespace)) : records;
  }

  public importRecords(records: MemoryKnowledgeRecord[]): { imported: number } {
    let imported = 0;
    for (const record of records) {
      const normalized = normalizeRecord(record);
      if (!normalized) continue;
      this.persistRecord(normalized);
      imported += 1;
    }
    return { imported };
  }

  public close(): void {
    this.db?.close();
  }

  private openSqlite(dbPath: string): SqliteDatabase | null {
    try {
      if (dbPath !== ':memory:') {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      }
      const sqlite = resolveSqliteConstructor(this.fullFileEncryption);
      if (!sqlite.constructorRef) {
        this.fullFileEncryption.status = this.fullFileEncryption.required ? 'required-unavailable' : 'unavailable';
        this.fullFileEncryption.proof = {
          unkeyedOpenBlocked: null,
          reason: sqlite.reason,
        };
        if (this.fullFileEncryption.required) {
          return null;
        }
      }

      const existedBefore = dbPath !== ':memory:' && fs.existsSync(dbPath);
      const Database = sqlite.constructorRef || (require('better-sqlite3') as SqliteConstructor);
      const db = new Database(dbPath);
      if (this.fullFileEncryption.mode !== 'off' && sqlite.constructorRef && this.fullFileEncryption.key) {
        this.fullFileEncryption.driverPackage = sqlite.driverPackage;
        applySqlCipherPragmas(db, this.fullFileEncryption.key);
      }
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

      if (this.fullFileEncryption.mode !== 'off' && sqlite.constructorRef && this.fullFileEncryption.key) {
        const proof = verifyFullFileEncryptionProof(dbPath);
        this.fullFileEncryption.proof = proof;
        if (proof.unkeyedOpenBlocked === true) {
          this.fullFileEncryption.status = 'active';
          this.fullFileEncryption.active = true;
        } else if (this.fullFileEncryption.required) {
          this.fullFileEncryption.status = 'required-unavailable';
          this.fullFileEncryption.active = false;
          db.close();
          if (!existedBefore && dbPath !== ':memory:' && fs.existsSync(dbPath)) {
            fs.rmSync(dbPath, { force: true });
          }
          return null;
        } else {
          this.fullFileEncryption.status = sqlite.driverPackage ? 'unverified' : 'unavailable';
          this.fullFileEncryption.active = false;
        }
      }
      return db;
    } catch {
      if (this.fullFileEncryption.mode !== 'off') {
        this.fullFileEncryption.status = this.fullFileEncryption.required ? 'required-unavailable' : 'unavailable';
        this.fullFileEncryption.active = false;
      }
      return null;
    }
  }

  private loadRecords(namespace: string): MemoryKnowledgeRecord[] {
    if (this.db) {
      const rows = this.db.prepare(
        `SELECT * FROM ${MEMORY_RECORDS_TABLE} WHERE namespace = ? ORDER BY created_at DESC`,
      ).all(normalizeNamespace(namespace)) as MemoryRow[];
      return rows.map((row) => rowToRecord(row, this.atRestEncryptionKey));
    }
    return this.readJsonRecords().filter((record) => record.namespace === normalizeNamespace(namespace));
  }

  private migrateSqliteRows(): void {
    if (!this.db) return;
    const rows = this.db.prepare(`SELECT * FROM ${MEMORY_RECORDS_TABLE}`).all() as MemoryRow[];
    const plaintextRows = rows.filter((row) => [
      row.text,
      row.metadata_json,
      row.keywords_json,
      row.vector_json,
    ].some((value) => !isEncryptedAtRest(value)));
    if (plaintextRows.length === 0) return;

    const update = this.db.prepare(`
      UPDATE ${MEMORY_RECORDS_TABLE}
      SET text = ?, metadata_json = ?, keywords_json = ?, vector_json = ?
      WHERE id = ?
    `);
    for (const row of plaintextRows) {
      update.run(
        this.encryptAtRest(decryptAtRestIfNeeded(row.text, this.atRestEncryptionKey)),
        this.encryptAtRest(decryptAtRestIfNeeded(row.metadata_json, this.atRestEncryptionKey)),
        this.encryptAtRest(decryptAtRestIfNeeded(row.keywords_json, this.atRestEncryptionKey)),
        this.encryptAtRest(decryptAtRestIfNeeded(row.vector_json, this.atRestEncryptionKey)),
        row.id,
      );
    }
    this.db.exec('PRAGMA secure_delete = ON; VACUUM;');
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
      atRestEncrypted: true,
      atRestEncryptionMode: this.atRestEncryptionMode(),
      fullFileEncrypted: this.fullFileEncryption.active,
      fullFileEncryptionStatus: this.fullFileEncryption.status,
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
      atRestEncrypted: true,
      atRestEncryptionMode: this.atRestEncryptionMode(),
      fullFileEncrypted: this.fullFileEncryption.active,
      fullFileEncryptionStatus: this.fullFileEncryption.status,
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
      fs.writeFileSync(this.jsonFallbackPath, this.encryptAtRest('[]'), 'utf8');
    }
  }

  private readJsonRecords(): MemoryKnowledgeRecord[] {
    try {
      const raw = fs.readFileSync(this.jsonFallbackPath, 'utf8').trim();
      const payload = decryptAtRestIfNeeded(raw || '[]', this.atRestEncryptionKey);
      return (JSON.parse(payload) as MemoryKnowledgeRecord[])
        .map(normalizeRecord)
        .filter((record): record is MemoryKnowledgeRecord => Boolean(record));
    } catch {
      return [];
    }
  }

  private writeJsonRecords(records: MemoryKnowledgeRecord[]): void {
    this.ensureJsonFallback();
    fs.writeFileSync(this.jsonFallbackPath, this.encryptAtRest(JSON.stringify(records, null, 2)), 'utf8');
  }

  private migrateJsonFallback(): void {
    const records = this.readJsonRecords();
    this.writeJsonRecords(records);
  }

  private encryptAtRest(value: string): string {
    return encryptAtRest(value, this.atRestEncryptionKey);
  }

  private persistRecord(record: MemoryKnowledgeRecord): void {
    if (this.db) {
      this.db.prepare(`
        INSERT OR REPLACE INTO ${MEMORY_RECORDS_TABLE}
          (id, namespace, text, metadata_json, keywords_json, vector_json, vector_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        record.id,
        record.namespace,
        this.encryptAtRest(record.text),
        this.encryptAtRest(JSON.stringify(record.metadata)),
        this.encryptAtRest(JSON.stringify(record.keywords)),
        this.encryptAtRest(JSON.stringify(record.vector)),
        record.vectorHash,
        record.createdAt,
      );
      return;
    }

    const records = this.readJsonRecords().filter((entry) => entry.id !== record.id);
    records.push(record);
    this.writeJsonRecords(records);
  }

  private atRestEncryptionMode(): 'field' | 'field+file' | 'json-field' {
    if (!this.db) {
      return 'json-field';
    }
    return this.fullFileEncryption.active ? 'field+file' : 'field';
  }
}

function rowToRecord(row: MemoryRow, key: Buffer): MemoryKnowledgeRecord {
  return {
    id: row.id,
    namespace: row.namespace,
    text: decryptAtRestIfNeeded(row.text, key),
    metadata: parseObject(decryptAtRestIfNeeded(row.metadata_json, key)),
    keywords: parseStringArray(decryptAtRestIfNeeded(row.keywords_json, key)),
    vector: parseNumberArray(decryptAtRestIfNeeded(row.vector_json, key)),
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

function resolveAtRestEncryptionKey(input: {
  dbPath: string;
  keyPath?: string;
  key?: string | Buffer;
}): Buffer {
  if (input.key) {
    return normalizeAtRestKey(input.key);
  }

  const envKey = process.env.ZAVORTH_MEMORY_AT_REST_KEY || process.env.ZAVORTH_MEMORY_ENCRYPTION_KEY;
  if (envKey) {
    return normalizeAtRestKey(envKey);
  }

  if (input.dbPath === ':memory:') {
    return crypto.randomBytes(32);
  }

  const keyPath = path.resolve(input.keyPath || input.dbPath.replace(/\.sqlite$/i, '.key'));
  fs.mkdirSync(path.dirname(keyPath), { recursive: true });
  if (!fs.existsSync(keyPath)) {
    fs.writeFileSync(keyPath, crypto.randomBytes(32).toString('base64'), { encoding: 'utf8', mode: 0o600 });
    try {
      fs.chmodSync(keyPath, 0o600);
    } catch {
      // Windows does not consistently honor POSIX file modes.
    }
  }
  return normalizeAtRestKey(fs.readFileSync(keyPath, 'utf8').trim());
}

function resolveFullFileEncryptionState(input: {
  dbPath: string;
  config?: boolean | FullFileEncryptionConfig;
}): FullFileEncryptionState {
  const rawConfig = typeof input.config === 'object' && input.config !== null ? input.config : {};
  const envMode = normalizeFullFileEncryptionMode(
    process.env.ZAVORTH_MEMORY_SQLCIPHER_MODE
      || process.env.ZAVORTH_MEMORY_FULL_FILE_ENCRYPTION,
  );
  const mode = normalizeFullFileEncryptionMode(
    typeof input.config === 'boolean'
      ? (input.config ? 'opportunistic' : 'off')
      : rawConfig.mode,
  ) || envMode || 'off';

  const state: FullFileEncryptionState = {
    mode,
    required: mode === 'required',
    key: null,
    keyStorage: 'none',
    driverPackages: rawConfig.driverPackages && rawConfig.driverPackages.length > 0
      ? rawConfig.driverPackages
      : parseDriverPackages(process.env.ZAVORTH_MEMORY_SQLCIPHER_DRIVER_PACKAGES),
    driverPackage: null,
    status: mode === 'off' ? 'off' : 'unavailable',
    active: false,
    proof: {
      unkeyedOpenBlocked: null,
      reason: mode === 'off' ? 'full-file encryption is disabled' : 'full-file encryption has not been attempted',
    },
  };
  if (mode === 'off') {
    return state;
  }

  const key = resolveFullFileEncryptionKey({
    dbPath: input.dbPath,
    key: rawConfig.key,
    keyPath: rawConfig.keyPath,
    keyStore: rawConfig.keyStore,
  });
  state.key = key.key;
  state.keyStorage = key.storage;
  return state;
}

function normalizeFullFileEncryptionMode(value: unknown): FullFileEncryptionMode | null {
  const text = String(value || '').trim().toLowerCase();
  if (!text || text === '0' || text === 'false' || text === 'no' || text === 'off') {
    return text ? 'off' : null;
  }
  if (text === '1' || text === 'true' || text === 'yes' || text === 'on' || text === 'optional') {
    return 'opportunistic';
  }
  if (text === 'opportunistic' || text === 'required') {
    return text;
  }
  return null;
}

function parseDriverPackages(value: unknown): string[] {
  const configured = String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return configured.length > 0
    ? configured
    : ['better-sqlite3-multiple-ciphers', '@journeyapps/sqlcipher'];
}

function resolveFullFileEncryptionKey(input: {
  dbPath: string;
  key?: string | Buffer;
  keyPath?: string;
  keyStore?: 'auto' | 'file' | 'os';
}): { key: Buffer; storage: FullFileEncryptionState['keyStorage'] } {
  if (input.key) {
    return { key: normalizeAtRestKey(input.key), storage: 'runtime' };
  }

  const envKey = process.env.ZAVORTH_MEMORY_SQLCIPHER_KEY || process.env.ZAVORTH_MEMORY_FULL_FILE_ENCRYPTION_KEY;
  if (envKey) {
    return { key: normalizeAtRestKey(envKey), storage: 'env' };
  }

  if (input.dbPath === ':memory:') {
    return { key: crypto.randomBytes(32), storage: 'runtime' };
  }

  const requestedStore = input.keyStore || normalizeKeyStore(process.env.ZAVORTH_MEMORY_FULL_FILE_KEY_STORE) || 'auto';
  const keyPath = path.resolve(input.keyPath || input.dbPath.replace(/\.sqlite$/i, '.sqlcipher.key'));
  if (requestedStore !== 'file') {
    const protectedKey = resolveOsProtectedKey(keyPath, requestedStore === 'os');
    if (protectedKey) {
      return { key: protectedKey, storage: 'os-protected-file' };
    }
  }

  fs.mkdirSync(path.dirname(keyPath), { recursive: true });
  if (!fs.existsSync(keyPath)) {
    fs.writeFileSync(keyPath, crypto.randomBytes(32).toString('base64'), { encoding: 'utf8', mode: 0o600 });
    try {
      fs.chmodSync(keyPath, 0o600);
    } catch {
      // Windows does not consistently honor POSIX file modes.
    }
  }
  return { key: normalizeAtRestKey(fs.readFileSync(keyPath, 'utf8').trim()), storage: 'file' };
}

function normalizeKeyStore(value: unknown): 'auto' | 'file' | 'os' | null {
  const text = String(value || '').trim().toLowerCase();
  return text === 'auto' || text === 'file' || text === 'os' ? text : null;
}

function resolveOsProtectedKey(keyPath: string, required: boolean): Buffer | null {
  if (process.platform !== 'win32') {
    return required ? null : null;
  }
  const protectedPath = `${keyPath}.dpapi`;
  try {
    if (fs.existsSync(protectedPath)) {
      const encrypted = fs.readFileSync(protectedPath, 'utf8').trim();
      const decrypted = runPowerShell([
        '$encrypted = [Console]::In.ReadToEnd().Trim()',
        '$secure = $encrypted | ConvertTo-SecureString',
        '$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)',
        'try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }',
      ].join('; '), encrypted);
      return normalizeAtRestKey(decrypted.trim());
    }

    const key = crypto.randomBytes(32).toString('base64');
    const encrypted = runPowerShell([
      '$plain = [Console]::In.ReadToEnd().Trim()',
      '$secure = ConvertTo-SecureString $plain -AsPlainText -Force',
      '$secure | ConvertFrom-SecureString',
    ].join('; '), key);
    fs.mkdirSync(path.dirname(protectedPath), { recursive: true });
    fs.writeFileSync(protectedPath, encrypted.trim(), { encoding: 'utf8', mode: 0o600 });
    return normalizeAtRestKey(key);
  } catch {
    if (required) {
      return null;
    }
    return null;
  }
}

function runPowerShell(script: string, input: string): string {
  const result = spawnSync('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    script,
  ], {
    input,
    encoding: 'utf8',
    timeout: 5000,
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(String(result.stderr || result.error?.message || 'OS protected key command failed.'));
  }
  return String(result.stdout || '');
}

function resolveSqliteConstructor(state: FullFileEncryptionState): {
  constructorRef: SqliteConstructor | null;
  driverPackage: string | null;
  reason: string;
} {
  if (state.mode === 'off') {
    return {
      constructorRef: require('better-sqlite3') as SqliteConstructor,
      driverPackage: 'better-sqlite3',
      reason: 'field encryption only',
    };
  }

  for (const packageName of state.driverPackages) {
    try {
      const module = require(packageName) as unknown;
      return {
        constructorRef: normalizeSqliteConstructorModule(module),
        driverPackage: packageName,
        reason: `loaded ${packageName}`,
      };
    } catch {
      // Try the next optional driver.
    }
  }

  return {
    constructorRef: null,
    driverPackage: null,
    reason: `SQLCipher driver unavailable: ${state.driverPackages.join(', ')}`,
  };
}

function normalizeSqliteConstructorModule(module: unknown): SqliteConstructor {
  const record = module && typeof module === 'object' ? module as Record<string, unknown> : {};
  return (record.default || record.Database || module) as SqliteConstructor;
}

function applySqlCipherPragmas(db: SqliteDatabase, key: Buffer): void {
  const hex = key.toString('hex');
  db.exec(`
    PRAGMA key = "x'${hex}'";
    PRAGMA cipher_page_size = 4096;
    PRAGMA kdf_iter = 256000;
    PRAGMA cipher_memory_security = ON;
  `);
}

function verifyFullFileEncryptionProof(dbPath: string): FullFileEncryptionState['proof'] {
  if (dbPath === ':memory:') {
    return {
      unkeyedOpenBlocked: null,
      reason: 'in-memory databases cannot be probed for full-file encryption',
    };
  }
  try {
    const Database = require('better-sqlite3') as SqliteConstructor;
    const unkeyed = new Database(dbPath);
    unkeyed.prepare("SELECT name FROM sqlite_master WHERE type = 'table' LIMIT 1").all();
    unkeyed.close();
    return {
      unkeyedOpenBlocked: false,
      reason: 'unkeyed sqlite open succeeded',
    };
  } catch {
    return {
      unkeyedOpenBlocked: true,
      reason: 'unkeyed sqlite open was blocked',
    };
  }
}

function normalizeAtRestKey(value: string | Buffer): Buffer {
  const raw = Buffer.isBuffer(value) ? Buffer.from(value) : Buffer.from(String(value), 'utf8');
  if (raw.length === 32) {
    return raw;
  }

  if (typeof value === 'string') {
    try {
      const decoded = Buffer.from(value, 'base64');
      if (decoded.length === 32) {
        return decoded;
      }
    } catch {
      // Fall through to a stable key derivation hash.
    }
  }

  return crypto.createHash('sha256').update(raw).digest();
}

function encryptAtRest(value: string, key: Buffer): string {
  const text = String(value ?? '');
  if (isEncryptedAtRest(text)) {
    return text;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(MEMORY_ENCRYPTION_AAD);
  const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    'enc',
    'v1',
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

function decryptAtRestIfNeeded(value: string, key: Buffer): string {
  const text = String(value ?? '');
  if (!isEncryptedAtRest(text)) {
    return text;
  }
  const parts = text.split(':');
  if (parts.length !== 5 || parts[0] !== 'enc' || parts[1] !== 'v1') {
    throw new Error('Malformed encrypted memory payload.');
  }
  const iv = Buffer.from(parts[2], 'base64');
  const tag = Buffer.from(parts[3], 'base64');
  const ciphertext = Buffer.from(parts[4], 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(MEMORY_ENCRYPTION_AAD);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

function isEncryptedAtRest(value: string): boolean {
  return String(value || '').startsWith(ENCRYPTED_VALUE_PREFIX);
}
