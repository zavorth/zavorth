/**
 * Memory backend contract.
 *
 * v1 — string add/search (required).
 * v2 — metadata, structured hits, filters, soft/hard delete (optional methods;
 *      use `supportsMemoryBackendV2` / `asMemoryBackendV2` for safe access).
 */

export const MEMORY_BACKEND_CONTRACT_VERSION = 2 as const;

export type MemoryBackendContractVersion = 1 | 2;

/** Free-form metadata attached to a memory write. */
export type MemoryMetadata = {
  /** Primary category (also used by local MemoryService). */
  category?: string;
  /** Stable key within a user scope. */
  key?: string;
  /** Origin surface / extractor (agent, user, mem0, …). */
  source?: string;
  /** Free tags for filter matching (any-of). */
  tags?: string[];
  [key: string]: unknown;
};

export type MemoryWriteOptions = {
  metadata?: MemoryMetadata;
  /** Explicit key; defaults from metadata.key or generated. */
  key?: string;
  /** Optional stable id when the backend supports client ids. */
  id?: string;
};

export type MemoryQueryFilter = {
  category?: string | string[];
  /** Match records that include any of these tags. */
  tags?: string[];
  source?: string;
  /** When true, include soft-deleted records. Default false. */
  includeDeleted?: boolean;
  /** ISO timestamps (inclusive bounds when present). */
  createdAfter?: string;
  createdBefore?: string;
  keys?: string[];
};

export type MemoryQueryOptions = {
  limit?: number;
  filter?: MemoryQueryFilter;
};

export type MemoryRecord = {
  id: string;
  userId: string;
  content: string;
  metadata: MemoryMetadata;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type MemoryHit = {
  /** Plain text (v1-compatible content line). */
  content: string;
  record: MemoryRecord;
  score?: number;
};

export type MemoryDeleteOptions = {
  /**
   * soft (default): mark deleted, hide from default search.
   * hard: permanently remove (and archive when backend supports history).
   */
  mode?: 'soft' | 'hard';
};

/**
 * Core memory backend surface.
 * All implementations must support v1 methods.
 * v2 methods are optional; missing ones are filled by MemoryBackendCompatAdapter.
 */
export interface IMemoryBackend {
  readonly name: string;
  /** Declared contract; omit or 1 = string-only v1. */
  readonly contractVersion?: MemoryBackendContractVersion;

  isAvailable(): Promise<boolean>;

  /**
   * v1 write. v2 backends may accept optional write options (3rd arg).
   * Return type stays void for backward compatibility.
   */
  addMemory(
    userId: string,
    content: string,
    options?: MemoryWriteOptions,
  ): Promise<void>;

  /**
   * v1 search returns plain strings.
   * Third arg may be a limit number (v1) or MemoryQueryOptions (v2).
   */
  searchMemory(
    userId: string,
    query: string,
    limitOrOptions?: number | MemoryQueryOptions,
  ): Promise<string[]>;

  // ── v2 optional ──────────────────────────────────────────────────

  /** Structured write returning the persisted record. */
  addMemoryRecord?(
    userId: string,
    content: string,
    options?: MemoryWriteOptions,
  ): Promise<MemoryRecord>;

  /** Structured search with filters / scores. */
  searchMemoryRecords?(
    userId: string,
    query: string,
    options?: MemoryQueryOptions,
  ): Promise<MemoryHit[]>;

  /** List records (no query ranking required). */
  listMemoryRecords?(
    userId: string,
    options?: MemoryQueryOptions,
  ): Promise<MemoryRecord[]>;

  /** Lookup by id or key. */
  getMemoryRecord?(
    userId: string,
    idOrKey: string,
  ): Promise<MemoryRecord | null>;

  /** Soft (default) or hard delete by id or key. */
  deleteMemory?(
    userId: string,
    idOrKey: string,
    options?: MemoryDeleteOptions,
  ): Promise<boolean>;

  /** Restore a soft-deleted record when supported. */
  restoreMemory?(
    userId: string,
    idOrKey: string,
  ): Promise<boolean>;
}

/** Normalize limit | options for callers. */
export function normalizeMemoryQueryOptions(
  limitOrOptions?: number | MemoryQueryOptions,
): MemoryQueryOptions {
  if (typeof limitOrOptions === 'number') {
    return { limit: limitOrOptions };
  }
  if (limitOrOptions && typeof limitOrOptions === 'object') {
    return {
      limit: limitOrOptions.limit,
      filter: limitOrOptions.filter,
    };
  }
  return {};
}

export function resolveMemoryQueryLimit(options: MemoryQueryOptions, fallback = 5): number {
  const limit = Number(options.limit);
  if (!Number.isFinite(limit) || limit <= 0) return fallback;
  return Math.min(Math.floor(limit), 100);
}

export function matchesMemoryFilter(
  record: MemoryRecord,
  filter?: MemoryQueryFilter,
): boolean {
  if (!filter) return !record.deletedAt;

  if (!filter.includeDeleted && record.deletedAt) {
    return false;
  }

  if (filter.category !== undefined) {
    const categories = Array.isArray(filter.category)
      ? filter.category.map((c) => String(c).toLowerCase())
      : [String(filter.category).toLowerCase()];
    const cat = String(record.metadata.category || 'general').toLowerCase();
    if (!categories.includes(cat)) return false;
  }

  if (filter.source !== undefined) {
    if (String(record.metadata.source || '').toLowerCase() !== String(filter.source).toLowerCase()) {
      return false;
    }
  }

  if (filter.tags && filter.tags.length > 0) {
    const tags = (record.metadata.tags || []).map((t) => String(t).toLowerCase());
    const wanted = filter.tags.map((t) => String(t).toLowerCase());
    if (!wanted.some((t) => tags.includes(t))) return false;
  }

  if (filter.keys && filter.keys.length > 0) {
    const key = String(record.metadata.key || record.id).toLowerCase();
    if (!filter.keys.map((k) => String(k).toLowerCase()).includes(key)) return false;
  }

  if (filter.createdAfter) {
    if (record.createdAt < filter.createdAfter) return false;
  }
  if (filter.createdBefore) {
    if (record.createdAt > filter.createdBefore) return false;
  }

  return true;
}

export function supportsMemoryBackendV2(backend: IMemoryBackend): boolean {
  return (
    backend.contractVersion === 2
    || typeof backend.addMemoryRecord === 'function'
    || typeof backend.searchMemoryRecords === 'function'
    || typeof backend.deleteMemory === 'function'
  );
}
