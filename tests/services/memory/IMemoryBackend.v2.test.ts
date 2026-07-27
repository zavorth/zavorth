import {
  matchesMemoryFilter,
  normalizeMemoryQueryOptions,
  resolveMemoryQueryLimit,
  supportsMemoryBackendV2,
  type IMemoryBackend,
  type MemoryRecord,
} from '../../../src/services/memory/IMemoryBackend';
import {
  asMemoryBackendV2,
  MemoryBackendCompatAdapter,
} from '../../../src/services/memory/MemoryBackendCompat';
import { LocalMemoryBackend } from '../../../src/services/memory/LocalMemoryBackend';
import { Mem0MemoryBackend } from '../../../src/services/memory/Mem0MemoryBackend';

function sampleRecord(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: '1',
    userId: 'u1',
    content: 'prefers short answers',
    metadata: {
      category: 'preference',
      key: 'pref_short',
      source: 'local',
      tags: ['ux', 'style'],
    },
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-01T10:00:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

describe('IMemoryBackend v2 contract helpers', () => {
  it('normalizes limit number and options object', () => {
    expect(normalizeMemoryQueryOptions(7)).toEqual({ limit: 7 });
    expect(normalizeMemoryQueryOptions({ limit: 3, filter: { category: 'x' } })).toEqual({
      limit: 3,
      filter: { category: 'x' },
    });
    expect(resolveMemoryQueryLimit({}, 5)).toBe(5);
    expect(resolveMemoryQueryLimit({ limit: 200 })).toBe(100);
  });

  it('matches filters including soft-delete, tags, and category', () => {
    const active = sampleRecord();
    expect(matchesMemoryFilter(active)).toBe(true);
    expect(matchesMemoryFilter(active, { category: 'preference' })).toBe(true);
    expect(matchesMemoryFilter(active, { category: 'other' })).toBe(false);
    expect(matchesMemoryFilter(active, { tags: ['style'] })).toBe(true);
    expect(matchesMemoryFilter(active, { tags: ['missing'] })).toBe(false);

    const deleted = sampleRecord({ deletedAt: '2026-07-02T00:00:00.000Z' });
    expect(matchesMemoryFilter(deleted)).toBe(false);
    expect(matchesMemoryFilter(deleted, { includeDeleted: true })).toBe(true);
  });

  it('detects v2 support', () => {
    expect(supportsMemoryBackendV2(new LocalMemoryBackend())).toBe(true);
    expect(supportsMemoryBackendV2(new Mem0MemoryBackend(''))).toBe(true);
    const v1Only: IMemoryBackend = {
      name: 'stub',
      isAvailable: async () => true,
      addMemory: async () => undefined,
      searchMemory: async () => ['hello'],
    };
    expect(supportsMemoryBackendV2(v1Only)).toBe(false);
  });
});

describe('MemoryBackendCompatAdapter', () => {
  it('lifts a pure v1 backend to structured write/search/soft-delete', async () => {
    const store: string[] = [];
    const v1: IMemoryBackend = {
      name: 'stub-v1',
      isAvailable: async () => true,
      addMemory: async (_userId, content) => {
        store.push(content);
      },
      searchMemory: async (_userId, query, limit = 5) =>
        store.filter((s) => s.includes(query)).slice(0, Number(limit) || 5),
    };

    const v2 = asMemoryBackendV2(v1);
    expect(v2).toBeInstanceOf(MemoryBackendCompatAdapter);

    const record = await v2.addMemoryRecord('u1', 'user likes coffee', {
      metadata: { category: 'preference', tags: ['food'], key: 'likes_coffee' },
      key: 'likes_coffee',
    });
    expect(record.metadata.category).toBe('preference');
    expect(record.metadata.tags).toEqual(['food']);
    expect(store).toContain('user likes coffee');

    const hits = await v2.searchMemoryRecords('u1', 'cafe', { limit: 5 });
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].record.metadata.key).toBe('likes_coffee');

    await expect(v2.deleteMemory('u1', 'likes_coffee', { mode: 'soft' })).resolves.toBe(true);
    const listed = await v2.listMemoryRecords('u1', { filter: { includeDeleted: true } });
    expect(listed.some((r) => r.deletedAt)).toBe(true);

    await expect(v2.restoreMemory('u1', 'likes_coffee')).resolves.toBe(true);
    const restored = await v2.getMemoryRecord('u1', 'likes_coffee');
    expect(restored?.deletedAt).toBeNull();
  });

  it('returns native backend when already full v2', () => {
    const local = new LocalMemoryBackend();
    expect(asMemoryBackendV2(local)).toBe(local);
  });
});

describe('LocalMemoryBackend v2 (mocked MemoryService)', () => {
  it('writes metadata, soft-deletes, and filters by category/tags', async () => {
    const rows = new Map<string, any>();
    const memoryService = {
      remember: jest.fn(async (userId: string, key: string, value: string, category: string, options-: any) => {
        rows.set(`${userId}:${key}`, {
          id: rows.size + 1,
          user_id: userId,
          key,
          value,
          category,
          created_at: '2026-07-01T00:00:00.000Z',
          updated_at: '2026-07-01T00:00:00.000Z',
          deleted_at: null,
          metadata_json: options?.metadata ? JSON.stringify(options.metadata) : null,
        });
      }),
      getByKey: jest.fn(async (userId: string, key: string, opts-: { includeDeleted-: boolean }) => {
        const row = rows.get(`${userId}:${key}`);
        if (!row) return null;
        if (!opts?.includeDeleted && row.deleted_at) return null;
        return row;
      }),
      listRelevant: jest.fn(async (userId: string) =>
        [...rows.values()].filter((r) => r.user_id === userId && !r.deleted_at),
      ),
      listAll: jest.fn(async (userId: string, opts-: { includeDeleted-: boolean }) =>
        [...rows.values()].filter(
          (r) => r.user_id === userId && (opts?.includeDeleted || !r.deleted_at),
        ),
      ),
      softDelete: jest.fn(async (userId: string, key: string) => {
        const row = rows.get(`${userId}:${key}`);
        if (!row || row.deleted_at) return false;
        row.deleted_at = '2026-07-02T00:00:00.000Z';
        return true;
      }),
      hardDelete: jest.fn(async (userId: string, key: string) => rows.delete(`${userId}:${key}`)),
      restore: jest.fn(async (userId: string, key: string) => {
        const row = rows.get(`${userId}:${key}`);
        if (!row?.deleted_at) return false;
        row.deleted_at = null;
        return true;
      }),
      parseMetadata: (entry: any) => {
        try {
          return entry.metadata_json ? JSON.parse(entry.metadata_json) : {};
        } catch {
          return {};
        }
      },
    };

    const backend = new LocalMemoryBackend(memoryService as any);
    expect(backend.contractVersion).toBe(2);

    const record = await backend.addMemoryRecord('u1', 'respostas curtas', {
      key: 'pref_short',
      metadata: { category: 'preference', tags: ['style'], source: 'test' },
    });
    expect(record.metadata.tags).toEqual(['style']);
    expect(memoryService.remember).toHaveBeenCalled();

    const hits = await backend.searchMemoryRecords('u1', 'curtas', {
      limit: 5,
      filter: { category: 'preference', tags: ['style'] },
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].content).toContain('preference');

    await expect(backend.deleteMemory('u1', 'pref_short', { mode: 'soft' })).resolves.toBe(true);
    expect(memoryService.softDelete).toHaveBeenCalledWith('u1', 'pref_short');

    const active = await backend.listMemoryRecords('u1');
    expect(active).toHaveLength(0);

    const withDeleted = await backend.listMemoryRecords('u1', {
      filter: { includeDeleted: true },
    });
    expect(withDeleted).toHaveLength(1);
    expect(withDeleted[0].deletedAt).toBeTruthy();

    await expect(backend.restoreMemory('u1', 'pref_short')).resolves.toBe(true);
  });
});

describe('Mem0MemoryBackend v2', () => {
  it('forwards metadata and soft-deletes in local index', async () => {
    const add = jest.fn().mockResolvedValue({ id: 'remote-1' });
    const search = jest.fn().mockResolvedValue([
      { id: 'remote-1', memory: 'user prefers short answers', score: 0.9 },
    ]);
    const importer = jest.fn().mockResolvedValue({
      MemoryClient: class {
        public add = add;
        public search = search;
      },
    });
    const backend = new Mem0MemoryBackend('mem0-test-key', importer as any);

    const record = await backend.addMemoryRecord('u1', 'user prefers short answers', {
      metadata: { category: 'preference', tags: ['style'] },
    });
    expect(record.id).toBe('remote-1');
    expect(add).toHaveBeenCalledWith(
      'user prefers short answers',
      expect.objectContaining({
        user_id: 'u1',
        metadata: expect.objectContaining({ category: 'preference' }),
      }),
    );

    const hits = await backend.searchMemoryRecords('u1', 'respostas', { limit: 5 });
    expect(hits[0].content).toContain('respostas curtas');

    await backend.deleteMemory('u1', 'remote-1', { mode: 'soft' });
    const after = await backend.searchMemoryRecords('u1', 'respostas', { limit: 5 });
    expect(after).toHaveLength(0);
  });
});
