export type JsonRecord = Record<string, unknown>;

export interface CacheEntry<TValue> {
  timestamp: number;
  value: TValue;
}

export interface AccessSchedule {
  enabled: boolean;
  from: string;
  until: string;
  days: number[];
  tz: string;
}

export interface ApiKeyMetadata {
  id: string;
  name: string;
  machineId: string | null;
  allowedModels: string[];
  allowedConnections: string[];
  noLog: boolean;
  autoResolve: boolean;
  isActive: boolean;
  accessSchedule: AccessSchedule | null;
  maxRequestsPerDay: number | null;
  maxRequestsPerMinute: number | null;
  maxSessions: number;
}

export interface ApiKeyRow extends JsonRecord {
  id?: unknown;
  name?: unknown;
  key?: unknown;
  machine_id?: unknown;
  machineId?: unknown;
  allowed_models?: unknown;
  allowedModels?: unknown;
  allowed_connections?: unknown;
  allowedConnections?: unknown;
  no_log?: unknown;
  noLog?: unknown;
  auto_resolve?: unknown;
  autoResolve?: unknown;
  is_active?: unknown;
  isActive?: unknown;
  access_schedule?: unknown;
  accessSchedule?: unknown;
}

export interface StatementLike<TRow = unknown> {
  all: (...params: unknown[]) => TRow[];
  get: (...params: unknown[]) => TRow | undefined;
  run: (...params: unknown[]) => { changes?: number };
}

export interface ApiKeysDbLike {
  prepare: <TRow = unknown>(sql: string) => StatementLike<TRow>;
  exec: (sql: string) => void;
}

export interface ApiKeysStatements {
  getAllKeys: StatementLike<ApiKeyRow>;
  getKeyById: StatementLike<ApiKeyRow>;
  validateKey: StatementLike<JsonRecord>;
  getKeyMetadata: StatementLike<ApiKeyRow>;
  insertKey: StatementLike;
  deleteKey: StatementLike;
}

export interface ApiKeyView extends JsonRecord {
  id?: string;
  allowedModels: string[];
  allowedConnections: string[];
  noLog: boolean;
  autoResolve: boolean;
  isActive: boolean;
  accessSchedule: AccessSchedule | null;
}
