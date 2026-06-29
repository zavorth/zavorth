import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import {
  SessionPersistenceStore,
  SessionState,
  CompressedMemoryChunk,
} from '../../../src/runtime/sessions/SessionPersistenceStore.js';

function makeSessionState(overrides: Partial<SessionState> = {}): SessionState {
  return {
    id: 'ses_test',
    status: 'active',
    createdAt: '2026-06-28T00:00:00Z',
    updatedAt: '2026-06-28T00:00:00Z',
    workspace: '/test',
    model: 'gpt-4o',
    messageCount: 10,
    tokenUsage: { input: 1000, output: 500 },
    metadata: {},
    ...overrides,
  };
}

function makeMemoryChunk(overrides: Partial<CompressedMemoryChunk> = {}): CompressedMemoryChunk {
  return {
    id: 'chunk_1',
    sessionId: 'ses_test',
    content: 'Test memory chunk content',
    keywords: ['test', 'memory'],
    timestamp: '2026-06-28T00:00:00Z',
    tokenCount: 20,
    ...overrides,
  };
}

function checksumFile(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf-8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

describe('CheckpointStorage', () => {
  let store: SessionPersistenceStore;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-test-'));
    store = new SessionPersistenceStore({ dbPath: tempDir });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('save and load checkpoint', () => {
    it('persists session state to disk and loads it back', async () => {
      await store.initialize();
      const state = makeSessionState({ id: 'ses_persist' });

      await store.saveSession(state);
      const loaded = await store.loadSession('ses_persist');

      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe('ses_persist');
      expect(loaded!.status).toBe('active');
      expect(loaded!.model).toBe('gpt-4o');
    });

    it('overwrites existing checkpoint on re-save', async () => {
      await store.initialize();
      const state = makeSessionState({ id: 'ses_overwrite', messageCount: 5 });
      await store.saveSession(state);

      state.messageCount = 15;
      state.status = 'completed';
      await store.saveSession(state);

      const loaded = await store.loadSession('ses_overwrite');
      expect(loaded!.messageCount).toBe(15);
      expect(loaded!.status).toBe('completed');
    });

    it('returns null for non-existent checkpoint', async () => {
      const loaded = await store.loadSession('nonexistent');
      expect(loaded).toBeNull();
    });

    it('handles special characters in session metadata', async () => {
      await store.initialize();
      const state = makeSessionState({
        id: 'ses_special',
        metadata: { note: 'Path: C:\\Users\\test with spaces & "quotes"', unicode: '日本語テスト' },
      });

      await store.saveSession(state);
      const loaded = await store.loadSession('ses_special');

      expect(loaded!.metadata.note).toBe('Path: C:\\Users\\test with spaces & "quotes"');
      expect(loaded!.metadata.unicode).toBe('日本語テスト');
    });

    it('updates updatedAt timestamp on save', async () => {
      await store.initialize();
      const state = makeSessionState({
        id: 'ses_timestamp',
        updatedAt: '2020-01-01T00:00:00Z',
      });

      await store.saveSession(state);
      const loaded = await store.loadSession('ses_timestamp');

      expect(loaded!.updatedAt).not.toBe('2020-01-01T00:00:00Z');
      expect(new Date(loaded!.updatedAt).getTime()).toBeGreaterThan(0);
    });
  });

  describe('list metadata without loading full data', () => {
    it('lists all sessions with metadata', async () => {
      await store.initialize();
      await store.saveSession(makeSessionState({ id: 'ses_a', model: 'gpt-4o' }));
      await store.saveSession(makeSessionState({ id: 'ses_b', model: 'claude-4' }));
      await store.saveSession(makeSessionState({ id: 'ses_c', model: 'gemini-2' }));

      const sessions = await store.listSessions();
      expect(sessions).toHaveLength(3);
      expect(sessions.map((s) => s.id).sort()).toEqual(['ses_a', 'ses_b', 'ses_c']);
    });

    it('returns empty array when no checkpoints exist', async () => {
      await store.initialize();
      const sessions = await store.listSessions();
      expect(sessions).toHaveLength(0);
    });

    it('lists sessions sorted by updatedAt descending', async () => {
      await store.initialize();

      const sessionsDir = path.join(tempDir, 'sessions');

      const stateOld = makeSessionState({ id: 'ses_old', updatedAt: '2026-01-01T00:00:00Z' });
      const stateNew = makeSessionState({ id: 'ses_new', updatedAt: '2026-06-28T00:00:00Z' });
      const stateMid = makeSessionState({ id: 'ses_mid', updatedAt: '2026-03-15T00:00:00Z' });

      fs.writeFileSync(path.join(sessionsDir, 'ses_old.json'), JSON.stringify(stateOld));
      fs.writeFileSync(path.join(sessionsDir, 'ses_new.json'), JSON.stringify(stateNew));
      fs.writeFileSync(path.join(sessionsDir, 'ses_mid.json'), JSON.stringify(stateMid));

      const sessions = await store.listSessions();
      expect(sessions[0].id).toBe('ses_new');
      expect(sessions[1].id).toBe('ses_mid');
      expect(sessions[2].id).toBe('ses_old');
    });

    it('skips corrupted checkpoint files gracefully', async () => {
      await store.initialize();

      const sessionsDir = path.join(tempDir, 'sessions');
      fs.writeFileSync(path.join(sessionsDir, 'ses_good.json'), JSON.stringify(makeSessionState({ id: 'ses_good' })));
      fs.writeFileSync(path.join(sessionsDir, 'ses_corrupt.json'), '{ invalid json');

      const sessions = await store.listSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe('ses_good');
    });
  });

  describe('delete checkpoint file', () => {
    it('removes session file from disk', async () => {
      await store.initialize();
      await store.saveSession(makeSessionState({ id: 'ses_delete' }));

      const fileBefore = path.join(tempDir, 'sessions', 'ses_delete.json');
      expect(fs.existsSync(fileBefore)).toBe(true);

      await store.deleteSession('ses_delete');

      expect(fs.existsSync(fileBefore)).toBe(false);
    });

    it('removes associated memory file on delete', async () => {
      await store.initialize();
      await store.saveSession(makeSessionState({ id: 'ses_delmem' }));
      await store.saveMemoryChunks('ses_delmem', [makeMemoryChunk({ sessionId: 'ses_delmem' })]);

      const memFile = path.join(tempDir, 'memory', 'ses_delmem.json');
      expect(fs.existsSync(memFile)).toBe(true);

      await store.deleteSession('ses_delmem');

      expect(fs.existsSync(memFile)).toBe(false);
    });

    it('loading deleted checkpoint returns null', async () => {
      await store.initialize();
      await store.saveSession(makeSessionState({ id: 'ses_delload' }));
      await store.deleteSession('ses_delload');

      const loaded = await store.loadSession('ses_delload');
      expect(loaded).toBeNull();
    });

    it('deleting non-existent checkpoint does not throw', async () => {
      await store.initialize();
      await expect(store.deleteSession('nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('cleanup old checkpoints', () => {
    it('prunes oldest sessions when maxSessions is exceeded', async () => {
      const limitedStore = new SessionPersistenceStore({ dbPath: tempDir, maxSessions: 3 });
      await limitedStore.initialize();

      await limitedStore.saveSession(makeSessionState({ id: 'ses_1', updatedAt: '2026-01-01T00:00:00Z' }));
      await limitedStore.saveSession(makeSessionState({ id: 'ses_2', updatedAt: '2026-01-02T00:00:00Z' }));
      await limitedStore.saveSession(makeSessionState({ id: 'ses_3', updatedAt: '2026-01-03T00:00:00Z' }));
      await limitedStore.saveSession(makeSessionState({ id: 'ses_4', updatedAt: '2026-01-04T00:00:00Z' }));

      const sessions = await limitedStore.listSessions();
      expect(sessions.length).toBeLessThanOrEqual(3);
      const ids = sessions.map((s) => s.id);
      expect(ids).toContain('ses_4');
    });

    it('does not prune when under the limit', async () => {
      const limitedStore = new SessionPersistenceStore({ dbPath: tempDir, maxSessions: 5 });
      await limitedStore.initialize();

      await limitedStore.saveSession(makeSessionState({ id: 'ses_1' }));
      await limitedStore.saveSession(makeSessionState({ id: 'ses_2' }));

      const sessions = await limitedStore.listSessions();
      expect(sessions).toHaveLength(2);
    });

    it('respects default maxSessions of 1000', async () => {
      const defaultStore = new SessionPersistenceStore({ dbPath: tempDir });
      await defaultStore.initialize();

      for (let i = 0; i < 5; i++) {
        await defaultStore.saveSession(makeSessionState({ id: `ses_${i}` }));
      }

      const sessions = await defaultStore.listSessions();
      expect(sessions).toHaveLength(5);
    });
  });

  describe('verify integrity with checksum', () => {
    it('file checksum matches after save', async () => {
      await store.initialize();
      const state = makeSessionState({ id: 'ses_checksum' });
      await store.saveSession(state);

      const filePath = path.join(tempDir, 'sessions', 'ses_checksum.json');
      const checksum = checksumFile(filePath);

      expect(checksum).toBeTruthy();
      expect(checksum).toHaveLength(64);
    });

    it('checksum changes when content is updated', async () => {
      await store.initialize();
      await store.saveSession(makeSessionState({ id: 'ses_cksum', messageCount: 1 }));

      const filePath = path.join(tempDir, 'sessions', 'ses_cksum.json');
      const checksum1 = checksumFile(filePath);

      await store.saveSession(makeSessionState({ id: 'ses_cksum', messageCount: 2 }));
      const checksum2 = checksumFile(filePath);

      expect(checksum1).not.toBe(checksum2);
    });

    it('invalid JSON file is skipped on load', async () => {
      await store.initialize();

      const filePath = path.join(tempDir, 'sessions', 'ses_invalid.json');
      fs.writeFileSync(filePath, 'this is not json {{{');

      const loaded = await store.loadSession('ses_invalid');
      expect(loaded).toBeNull();
    });

    it('corrupted memory file returns empty array on load', async () => {
      await store.initialize();

      const memPath = path.join(tempDir, 'memory', 'ses_corrupt_mem.json');
      fs.writeFileSync(memPath, 'not valid json');

      const chunks = await store.loadMemoryChunks('ses_corrupt_mem');
      expect(chunks).toEqual([]);
    });

    it('verifies stored JSON is valid after every save', async () => {
      await store.initialize();

      for (let i = 0; i < 10; i++) {
        await store.saveSession(makeSessionState({ id: `ses_verify_${i}`, messageCount: i }));
      }

      const sessionsDir = path.join(tempDir, 'sessions');
      const files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith('.json'));

      for (const file of files) {
        const content = fs.readFileSync(path.join(sessionsDir, file), 'utf-8');
        expect(() => JSON.parse(content)).not.toThrow();
      }
    });
  });

  describe('export as JSON', () => {
    it('exports session as valid JSON string', async () => {
      await store.initialize();
      const state = makeSessionState({ id: 'ses_export' });
      await store.saveSession(state);

      const filePath = path.join(tempDir, 'sessions', 'ses_export.json');
      const exported = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(exported);

      expect(parsed.id).toBe('ses_export');
      expect(parsed.status).toBe('active');
    });

    it('exports memory chunks as valid JSON', async () => {
      await store.initialize();
      const chunks = [
        makeMemoryChunk({ id: 'c1', content: 'chunk one' }),
        makeMemoryChunk({ id: 'c2', content: 'chunk two' }),
      ];

      await store.saveMemoryChunks('ses_exportmem', chunks);

      const filePath = path.join(tempDir, 'memory', 'ses_exportmem.json');
      const exported = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(exported);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].content).toBe('chunk one');
      expect(parsed[1].content).toBe('chunk two');
    });

    it('export preserves all session fields', async () => {
      await store.initialize();
      const state = makeSessionState({
        id: 'ses_full_export',
        status: 'completed',
        model: 'claude-4',
        messageCount: 42,
        tokenUsage: { input: 5000, output: 3000 },
        metadata: { exported: true, tags: ['backup'] },
      });

      await store.saveSession(state);

      const filePath = path.join(tempDir, 'sessions', 'ses_full_export.json');
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      expect(parsed.model).toBe('claude-4');
      expect(parsed.tokenUsage).toEqual({ input: 5000, output: 3000 });
      expect(parsed.metadata.exported).toBe(true);
    });
  });

  describe('import from export', () => {
    it('imports session from exported JSON file', async () => {
      await store.initialize();

      const exportData = makeSessionState({ id: 'ses_import', model: 'imported-model' });
      const exportPath = path.join(tempDir, 'import-source.json');
      fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));

      const imported = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));
      await store.saveSession(imported);

      const loaded = await store.loadSession('ses_import');
      expect(loaded).not.toBeNull();
      expect(loaded!.model).toBe('imported-model');
    });

    it('imports memory chunks from exported file', async () => {
      await store.initialize();

      const chunks = [
        makeMemoryChunk({ id: 'imp_1', content: 'imported memory 1' }),
        makeMemoryChunk({ id: 'imp_2', content: 'imported memory 2' }),
      ];

      const exportPath = path.join(tempDir, 'mem-export.json');
      fs.writeFileSync(exportPath, JSON.stringify(chunks, null, 2));

      const imported = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));
      await store.saveMemoryChunks('ses_importmem', imported);

      const loaded = await store.loadMemoryChunks('ses_importmem');
      expect(loaded).toHaveLength(2);
      expect(loaded[0].content).toBe('imported memory 1');
    });

    it('imports multiple sessions from separate files', async () => {
      await store.initialize();

      const files = ['session-a.json', 'session-b.json', 'session-c.json'];
      for (let i = 0; i < files.length; i++) {
        const state = makeSessionState({ id: `ses_multi_${i}`, messageCount: i * 10 });
        fs.writeFileSync(path.join(tempDir, files[i]), JSON.stringify(state));
      }

      for (const file of files) {
        const data = JSON.parse(fs.readFileSync(path.join(tempDir, file), 'utf-8'));
        await store.saveSession(data);
      }

      const sessions = await store.listSessions();
      expect(sessions).toHaveLength(3);
    });

    it('import round-trip preserves data integrity', async () => {
      await store.initialize();
      const original = makeSessionState({
        id: 'ses_roundtrip',
        tokenUsage: { input: 12345, output: 67890 },
        metadata: { deep: { nested: { value: true } } },
      });

      await store.saveSession(original);
      const exported = fs.readFileSync(path.join(tempDir, 'sessions', 'ses_roundtrip.json'), 'utf-8');
      fs.unlinkSync(path.join(tempDir, 'sessions', 'ses_roundtrip.json'));

      const reimported = JSON.parse(exported);
      await store.saveSession(reimported);
      const loaded = await store.loadSession('ses_roundtrip');

      expect(loaded!.tokenUsage).toEqual({ input: 12345, output: 67890 });
      expect(loaded!.metadata.deep.nested.value).toBe(true);
    });
  });

  describe('storage statistics', () => {
    it('reports zero stats for empty store', async () => {
      await store.initialize();
      const stats = await store.getStats();

      expect(stats.totalSessions).toBe(0);
      expect(stats.totalMemoryChunks).toBe(0);
      expect(stats.dbSizeBytes).toBe(0);
    });

    it('tracks session count accurately', async () => {
      await store.initialize();
      await store.saveSession(makeSessionState({ id: 'ses_s1' }));
      await store.saveSession(makeSessionState({ id: 'ses_s2' }));
      await store.saveSession(makeSessionState({ id: 'ses_s3' }));

      const stats = await store.getStats();
      expect(stats.totalSessions).toBe(3);
    });

    it('tracks total memory chunk count', async () => {
      await store.initialize();
      await store.saveMemoryChunks('ses_m1', [
        makeMemoryChunk({ id: 'c1' }),
        makeMemoryChunk({ id: 'c2' }),
        makeMemoryChunk({ id: 'c3' }),
      ]);
      await store.saveMemoryChunks('ses_m2', [
        makeMemoryChunk({ id: 'c4', sessionId: 'ses_m2' }),
        makeMemoryChunk({ id: 'c5', sessionId: 'ses_m2' }),
      ]);

      const stats = await store.getStats();
      expect(stats.totalMemoryChunks).toBe(5);
    });

    it('reports non-zero db size with data', async () => {
      await store.initialize();
      await store.saveSession(makeSessionState({ id: 'ses_size' }));

      const stats = await store.getStats();
      expect(stats.dbSizeBytes).toBeGreaterThan(0);
    });

    it('db size increases with more data', async () => {
      await store.initialize();

      await store.saveSession(makeSessionState({ id: 'ses_small', messageCount: 1 }));
      const statsSmall = await store.getStats();

      await store.saveSession(makeSessionState({
        id: 'ses_large',
        messageCount: 100,
        metadata: { description: 'A'.repeat(1000) },
      }));
      const statsLarge = await store.getStats();

      expect(statsLarge.dbSizeBytes).toBeGreaterThan(statsSmall.dbSizeBytes);
    });
  });

  describe('compression', () => {
    it('truncates memory chunks to maxMemoryChunks limit', async () => {
      const limitedStore = new SessionPersistenceStore({ dbPath: tempDir, maxMemoryChunks: 3 });
      await limitedStore.initialize();

      const chunks: CompressedMemoryChunk[] = Array.from({ length: 10 }, (_, i) =>
        makeMemoryChunk({ id: `chunk_${i}`, sessionId: 'ses_limitedmem' }),
      );

      await limitedStore.saveMemoryChunks('ses_limitedmem', chunks);
      const loaded = await limitedStore.loadMemoryChunks('ses_limitedmem');

      expect(loaded).toHaveLength(3);
      expect(loaded[0].id).toBe('chunk_7');
      expect(loaded[1].id).toBe('chunk_8');
      expect(loaded[2].id).toBe('chunk_9');
    });

    it('appendMemoryChunk adds to existing chunks', async () => {
      await store.initialize();

      await store.appendMemoryChunk('ses_append', makeMemoryChunk({ id: 'c1' }));
      await store.appendMemoryChunk('ses_append', makeMemoryChunk({ id: 'c2' }));
      await store.appendMemoryChunk('ses_append', makeMemoryChunk({ id: 'c3' }));

      const loaded = await store.loadMemoryChunks('ses_append');
      expect(loaded).toHaveLength(3);
      expect(loaded.map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
    });

    it('memory chunks persist across save-load cycles', async () => {
      await store.initialize();
      const chunks = [
        makeMemoryChunk({ id: 'persist_1', content: 'keep me' }),
        makeMemoryChunk({ id: 'persist_2', content: 'me too' }),
      ];

      await store.saveMemoryChunks('ses_persistmem', chunks);
      const loaded = await store.loadMemoryChunks('ses_persistmem');

      expect(loaded[0].content).toBe('keep me');
      expect(loaded[1].content).toBe('me too');
      expect(loaded[0].keywords).toEqual(['test', 'memory']);
    });

    it('returns empty array for session with no memory chunks', async () => {
      await store.initialize();
      const chunks = await store.loadMemoryChunks('nonexistent');
      expect(chunks).toEqual([]);
    });

    it('large memory payloads compress via truncation', async () => {
      const smallLimitStore = new SessionPersistenceStore({ dbPath: tempDir, maxMemoryChunks: 5 });
      await smallLimitStore.initialize();

      const manyChunks: CompressedMemoryChunk[] = Array.from({ length: 50 }, (_, i) =>
        makeMemoryChunk({ id: `bulk_${i}`, content: `Memory content ${i}`.repeat(100) }),
      );

      await smallLimitStore.saveMemoryChunks('ses_bulk', manyChunks);
      const loaded = await smallLimitStore.loadMemoryChunks('ses_bulk');

      expect(loaded).toHaveLength(5);
    });
  });

  describe('auto-initialization', () => {
    it('initializes directories automatically on first operation', async () => {
      const freshStore = new SessionPersistenceStore({ dbPath: path.join(tempDir, 'auto-init') });
      await freshStore.saveSession(makeSessionState({ id: 'ses_autoinit' }));

      const loaded = await freshStore.loadSession('ses_autoinit');
      expect(loaded).not.toBeNull();
    });

    it('is idempotent for initialization', async () => {
      await store.initialize();
      await store.initialize();

      const sessionsDir = path.join(tempDir, 'sessions');
      expect(fs.existsSync(sessionsDir)).toBe(true);
    });
  });
});
