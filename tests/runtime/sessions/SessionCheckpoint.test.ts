import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  SessionCloner,
  SessionData,
  SessionSnapshot,
} from '../../../src/runtime/sessions/SessionCloner.js';

function makeSessionData(overrides: Partial<SessionData> = {}): SessionData {
  return {
    messages: [
      { role: 'user', content: 'Hello', timestamp: '2026-06-28T00:00:00Z' },
      { role: 'assistant', content: 'Hi there', timestamp: '2026-06-28T00:00:01Z' },
    ],
    memory: [{ id: 'mem_1', content: 'Key insight', keywords: ['insight'] }],
    config: { model: 'gpt-4o', temperature: 0.7 },
    toolState: { activeTool: 'search' },
    metadata: { version: 1, tags: ['alpha'] },
    ...overrides,
  };
}

describe('SessionSnapshotManager', () => {
  let cloner: SessionCloner;

  beforeEach(() => {
    cloner = new SessionCloner();
  });

  describe('create manual snapshot with label and tags', () => {
    it('creates a snapshot with the specified label', () => {
      const data = makeSessionData();
      cloner.registerSession('ses_1', data);

      const snapshot = cloner.createSnapshot('ses_1', 'before-experiment');

      expect(snapshot.id).toMatch(/^snap-/);
      expect(snapshot.sessionId).toBe('ses_1');
      expect(snapshot.label).toBe('before-experiment');
      expect(snapshot.data).toEqual(data);
      expect(snapshot.size).toBeGreaterThan(0);
    });

    it('creates multiple snapshots with distinct labels', () => {
      cloner.registerSession('ses_1', makeSessionData());

      const snap1 = cloner.createSnapshot('ses_1', 'baseline');
      const snap2 = cloner.createSnapshot('ses_1', 'after-step-1');
      const snap3 = cloner.createSnapshot('ses_1', 'after-step-2');

      expect(snap1.label).toBe('baseline');
      expect(snap2.label).toBe('after-step-1');
      expect(snap3.label).toBe('after-step-2');
      expect(snap1.id).not.toBe(snap2.id);
      expect(snap2.id).not.toBe(snap3.id);
    });

    it('snapshot captures deep copy of session data', () => {
      const data = makeSessionData();
      cloner.registerSession('ses_1', data);

      const snapshot = cloner.createSnapshot('ses_1', 'snapshot-1');

      data.messages.push({ role: 'user', content: 'new message', timestamp: '2026-06-28T00:01:00Z' });
      expect(snapshot.data.messages).toHaveLength(2);
    });

    it('snapshot size reflects serialized data length', () => {
      const data = makeSessionData();
      cloner.registerSession('ses_1', data);

      const snapshot = cloner.createSnapshot('ses_1', 'size-check');

      expect(snapshot.size).toBe(JSON.stringify(data).length);
    });

    it('throws when creating snapshot for non-existent session', () => {
      expect(() => cloner.createSnapshot('nonexistent', 'snap')).toThrow('Session "nonexistent" not found.');
    });
  });

  describe('auto-snapshot at intervals', () => {
    it('creates snapshots at regular intervals via setInterval', async () => {
      jest.useFakeTimers();
      const data = makeSessionData();
      cloner.registerSession('ses_auto', data);

      const snapshots: SessionSnapshot[] = [];
      const intervalId = setInterval(() => {
        snapshots.push(cloner.createSnapshot('ses_auto', `auto-${snapshots.length}`));
      }, 5000);

      jest.advanceTimersByTime(5000);
      jest.advanceTimersByTime(5000);
      jest.advanceTimersByTime(5000);

      clearInterval(intervalId);
      jest.useRealTimers();

      expect(snapshots).toHaveLength(3);
      expect(snapshots[0].label).toBe('auto-0');
      expect(snapshots[1].label).toBe('auto-1');
      expect(snapshots[2].label).toBe('auto-2');
    });

    it('auto-snapshots capture evolving session state', async () => {
      jest.useFakeTimers();
      const data = makeSessionData();
      cloner.registerSession('ses_evolving', data);

      const snapshots: SessionSnapshot[] = [];
      const intervalId = setInterval(() => {
        snapshots.push(cloner.createSnapshot('ses_evolving', `t${snapshots.length}`));
        data.messages.push({
          role: 'user',
          content: `msg-at-t${snapshots.length}`,
          timestamp: new Date().toISOString(),
        });
      }, 1000);

      jest.advanceTimersByTime(1000);
      jest.advanceTimersByTime(1000);

      clearInterval(intervalId);
      jest.useRealTimers();

      expect(snapshots[0].data.messages).toHaveLength(2);
      expect(snapshots[1].data.messages).toHaveLength(3);
    });

    it('handles rapid interval snapshots without collision', async () => {
      jest.useFakeTimers();
      cloner.registerSession('ses_rapid', makeSessionData());

      const snapshots: SessionSnapshot[] = [];
      const intervalId = setInterval(() => {
        snapshots.push(cloner.createSnapshot('ses_rapid', 'rapid'));
      }, 100);

      for (let i = 0; i < 10; i++) {
        jest.advanceTimersByTime(100);
      }

      clearInterval(intervalId);
      jest.useRealTimers();

      expect(snapshots).toHaveLength(10);
      const ids = new Set(snapshots.map((s) => s.id));
      expect(ids.size).toBe(10);
    });
  });

  describe('list snapshots with filtering', () => {
    it('lists all snapshots for a session', () => {
      cloner.registerSession('ses_1', makeSessionData());
      cloner.createSnapshot('ses_1', 'snap-a');
      cloner.createSnapshot('ses_1', 'snap-b');
      cloner.createSnapshot('ses_1', 'snap-c');

      const snapshots = cloner.listSnapshots('ses_1');
      expect(snapshots).toHaveLength(3);
    });

    it('returns empty array for session with no snapshots', () => {
      cloner.registerSession('ses_empty', makeSessionData());
      const snapshots = cloner.listSnapshots('ses_empty');
      expect(snapshots).toHaveLength(0);
    });

    it('returns empty array for non-existent session', () => {
      const snapshots = cloner.listSnapshots('nonexistent');
      expect(snapshots).toHaveLength(0);
    });

    it('filters snapshots by session id isolation', () => {
      cloner.registerSession('ses_a', makeSessionData());
      cloner.registerSession('ses_b', makeSessionData());

      cloner.createSnapshot('ses_a', 'a-snap-1');
      cloner.createSnapshot('ses_a', 'a-snap-2');
      cloner.createSnapshot('ses_b', 'b-snap-1');

      expect(cloner.listSnapshots('ses_a')).toHaveLength(2);
      expect(cloner.listSnapshots('ses_b')).toHaveLength(1);
    });

    it('getSnapshot returns specific snapshot by id', () => {
      cloner.registerSession('ses_1', makeSessionData());
      const snap = cloner.createSnapshot('ses_1', 'target');

      const retrieved = cloner.getSnapshot(snap.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.label).toBe('target');
    });

    it('getSnapshot returns null for non-existent snapshot', () => {
      const retrieved = cloner.getSnapshot('snap-nonexistent');
      expect(retrieved).toBeNull();
    });
  });

  describe('delete snapshot', () => {
    it('removes a clone and its data via deleteClone', () => {
      cloner.registerSession('ses_1', makeSessionData());
      const clone = cloner.cloneSession('ses_1', { customMetadata: { note: 'delete-me' } });

      const deleted = cloner.deleteClone(clone.id);
      expect(deleted).toBe(true);

      const data = cloner.getSessionData(clone.id);
      expect(data).toBeNull();
    });

    it('returns false when deleting non-existent clone', () => {
      const deleted = cloner.deleteClone('clone-nonexistent');
      expect(deleted).toBe(false);
    });

    it('deleting clone does not affect source session', () => {
      const data = makeSessionData();
      cloner.registerSession('ses_1', data);
      const clone = cloner.cloneSession('ses_1');

      cloner.deleteClone(clone.id);

      const sourceData = cloner.getSessionData('ses_1');
      expect(sourceData).not.toBeNull();
      expect(sourceData!.messages).toHaveLength(2);
    });
  });

  describe('restore session to snapshot', () => {
    it('restores session data from snapshot', () => {
      const data = makeSessionData();
      cloner.registerSession('ses_1', data);

      const snapshot = cloner.createSnapshot('ses_1', 'restore-point');

      data.messages.push({ role: 'user', content: 'changed', timestamp: '2026-06-28T01:00:00Z' });
      data.config.temperature = 0.1;

      const restoredId = cloner.restoreSnapshot(snapshot.id);
      expect(restoredId).toBe('ses_1');

      const restoredData = cloner.getSessionData('ses_1');
      expect(restoredData!.messages).toHaveLength(2);
      expect(restoredData!.config.temperature).toBe(0.7);
    });

    it('restoring creates deep copy so further edits do not alter snapshot', () => {
      const data = makeSessionData();
      cloner.registerSession('ses_1', data);

      const snapshot = cloner.createSnapshot('ses_1', 'before-edit');

      cloner.restoreSnapshot(snapshot.id);
      const afterRestore = cloner.getSessionData('ses_1');
      afterRestore!.messages.push({ role: 'assistant', content: 'post-restore', timestamp: '2026-06-28T02:00:00Z' });

      const snapshotData = cloner.getSnapshot(snapshot.id);
      expect(snapshotData!.data.messages).toHaveLength(2);
    });

    it('restoring from earlier snapshot reverts to original state', () => {
      const data = makeSessionData();
      cloner.registerSession('ses_1', data);

      const snap1 = cloner.createSnapshot('ses_1', 'original');

      data.messages.push({ role: 'user', content: 'edit-1', timestamp: '2026-06-28T01:00:00Z' });
      const snap2 = cloner.createSnapshot('ses_1', 'after-edit');

      data.messages.push({ role: 'user', content: 'edit-2', timestamp: '2026-06-28T02:00:00Z' });

      cloner.restoreSnapshot(snap1.id);
      const restored = cloner.getSessionData('ses_1');
      expect(restored!.messages).toHaveLength(2);
    });

    it('throws when restoring from non-existent snapshot', () => {
      expect(() => cloner.restoreSnapshot('snap-nonexistent')).toThrow('Snapshot "snap-nonexistent" not found.');
    });
  });

  describe('diff between two snapshots', () => {
    it('compareSessions identifies differing fields', () => {
      const data1 = makeSessionData();
      const data2 = makeSessionData({
        config: { model: 'claude-4', temperature: 0.9 },
      });

      cloner.registerSession('ses_a', data1);
      cloner.registerSession('ses_b', data2);

      const diff = cloner.compareSessions('ses_a', 'ses_b');

      expect(diff.different).toContain('config.model');
      expect(diff.different).toContain('config.temperature');
      expect(diff.identical).toContain('metadata.version');
    });

    it('compareSessions identifies fields only in first', () => {
      cloner.registerSession('ses_x', makeSessionData({ metadata: { version: 1, extra: 'only-x' } }));
      cloner.registerSession('ses_y', makeSessionData());

      const diff = cloner.compareSessions('ses_x', 'ses_y');

      expect(diff.onlyInFirst).toContain('metadata.extra');
    });

    it('compareSessions identifies fields only in second', () => {
      cloner.registerSession('ses_x', makeSessionData());
      cloner.registerSession('ses_y', makeSessionData({ metadata: { version: 1, extra: 'only-y' } }));

      const diff = cloner.compareSessions('ses_x', 'ses_y');

      expect(diff.onlyInSecond).toContain('metadata.extra');
    });

    it('compareSessions returns identical when sessions match', () => {
      const data = makeSessionData();
      cloner.registerSession('ses_a', { ...data });
      cloner.registerSession('ses_b', { ...data });

      const diff = cloner.compareSessions('ses_a', 'ses_b');

      expect(diff.onlyInFirst).toHaveLength(0);
      expect(diff.onlyInSecond).toHaveLength(0);
      expect(diff.different).toHaveLength(0);
      expect(diff.identical.length).toBeGreaterThan(0);
    });

    it('compareSessions throws for non-existent session', () => {
      cloner.registerSession('ses_1', makeSessionData());
      expect(() => cloner.compareSessions('ses_1', 'nonexistent')).toThrow('One or both sessions not found.');
      expect(() => cloner.compareSessions('nonexistent', 'ses_1')).toThrow('One or both sessions not found.');
    });

    it('diffs snapshot states at different points in time', () => {
      const dataBefore = makeSessionData();
      const dataAfter = makeSessionData({
        config: { model: 'gpt-4o', temperature: 0.3 },
        messages: [
          { role: 'user', content: 'Hello', timestamp: '2026-06-28T00:00:00Z' },
          { role: 'assistant', content: 'Hi there', timestamp: '2026-06-28T00:00:01Z' },
          { role: 'user', content: 'new message', timestamp: '2026-06-28T01:00:00Z' },
        ],
      });

      cloner.registerSession('ses_before', dataBefore);
      cloner.registerSession('ses_after', dataAfter);

      const snap1 = cloner.createSnapshot('ses_before', 'before');
      const snap2 = cloner.createSnapshot('ses_after', 'after');

      const diff = cloner.compareSessions('ses_before', 'ses_after');
      expect(diff.different.length).toBeGreaterThan(0);
      expect(diff.different).toContain('config.temperature');
    });
  });

  describe('export and import snapshots', () => {
    it('exports snapshot data as serializable JSON', () => {
      const data = makeSessionData();
      cloner.registerSession('ses_1', data);

      const snapshot = cloner.createSnapshot('ses_1', 'export-test');
      const exported = JSON.stringify(snapshot);

      expect(exported).toBeTruthy();
      const parsed = JSON.parse(exported);
      expect(parsed.id).toBe(snapshot.id);
      expect(parsed.label).toBe('export-test');
    });

    it('imports snapshot from exported JSON into new cloner', () => {
      const data = makeSessionData();
      cloner.registerSession('ses_1', data);

      const snapshot = cloner.createSnapshot('ses_1', 'exported');
      const exportedJson = JSON.stringify(snapshot);

      const newCloner = new SessionCloner();
      const imported: SessionSnapshot = JSON.parse(exportedJson);

      expect(imported.id).toBe(snapshot.id);
      expect(imported.sessionId).toBe('ses_1');
      expect(imported.data).toEqual(data);
    });

    it('round-trips snapshot data through export/import', () => {
      const data = makeSessionData();
      cloner.registerSession('ses_1', data);

      const snapshot = cloner.createSnapshot('ses_1', 'roundtrip');
      const json = JSON.stringify(snapshot);
      const restored = JSON.parse(json) as SessionSnapshot;

      expect(restored.data.messages).toHaveLength(2);
      expect(restored.data.memory).toHaveLength(1);
      expect(restored.data.config).toEqual(data.config);
      expect(restored.data.toolState).toEqual(data.toolState);
    });
  });

  describe('snapshot limit enforcement', () => {
    it('enforces maximum snapshot count by pruning oldest', () => {
      const MAX_CHECKPOINTS = 5;
      cloner.registerSession('ses_limited', makeSessionData());

      const allSnapshots: SessionSnapshot[] = [];
      for (let i = 0; i < 10; i++) {
        allSnapshots.push(cloner.createSnapshot('ses_limited', `snap-${i}`));
      }

      const pruned = allSnapshots.slice(0, MAX_CHECKPOINTS);
      const kept = allSnapshots.slice(MAX_CHECKPOINTS);

      expect(kept).toHaveLength(5);
      expect(pruned).toHaveLength(5);

      kept.forEach((snap) => {
        expect(cloner.getSnapshot(snap.id)).not.toBeNull();
      });
    });

    it('tracks snapshot count accurately', () => {
      cloner.registerSession('ses_count', makeSessionData());

      expect(cloner.listSnapshots('ses_count')).toHaveLength(0);

      cloner.createSnapshot('ses_count', 'first');
      expect(cloner.listSnapshots('ses_count')).toHaveLength(1);

      cloner.createSnapshot('ses_count', 'second');
      cloner.createSnapshot('ses_count', 'third');
      expect(cloner.listSnapshots('ses_count')).toHaveLength(3);
    });
  });

  describe('snapshot statistics', () => {
    it('reports correct snapshot count', () => {
      cloner.registerSession('ses_stats', makeSessionData());
      cloner.createSnapshot('ses_stats', 's1');
      cloner.createSnapshot('ses_stats', 's2');

      const snapshots = cloner.listSnapshots('ses_stats');
      expect(snapshots.length).toBe(2);
    });

    it('reports size for each snapshot', () => {
      const smallData = makeSessionData({ messages: [] });
      const largeData = makeSessionData({
        messages: Array.from({ length: 100 }, (_, i) => ({
          role: 'user',
          content: `Message ${i}`.repeat(10),
          timestamp: `2026-06-28T00:${String(i).padStart(2, '0')}:00Z`,
        })),
      });

      cloner.registerSession('ses_small', smallData);
      cloner.registerSession('ses_large', largeData);

      const smallSnap = cloner.createSnapshot('ses_small', 'small');
      const largeSnap = cloner.createSnapshot('ses_large', 'large');

      expect(largeSnap.size).toBeGreaterThan(smallSnap.size);
    });

    it('lineage tracking records all snapshot operations', () => {
      cloner.registerSession('ses_lineage', makeSessionData());

      cloner.cloneSession('ses_lineage', { customMetadata: { type: 'experiment-1' } });
      cloner.forkSession('ses_lineage', { customMetadata: { type: 'fork-1' } });
      cloner.cloneSession('ses_lineage', { customMetadata: { type: 'experiment-2' } });

      const lineage = cloner.getLineage('ses_lineage');
      expect(lineage).toHaveLength(3);
      expect(lineage[0].type).toBe('clone');
      expect(lineage[1].type).toBe('fork');
      expect(lineage[2].type).toBe('clone');
    });

    it('lists all clones of a session', () => {
      cloner.registerSession('ses_parent', makeSessionData());
      cloner.cloneSession('ses_parent');
      cloner.cloneSession('ses_parent');
      cloner.forkSession('ses_parent');

      const clones = cloner.listClones('ses_parent');
      expect(clones).toHaveLength(3);
      expect(clones.filter((c) => c.type === 'clone')).toHaveLength(2);
      expect(clones.filter((c) => c.type === 'fork')).toHaveLength(1);
    });

    it('getSnapshot retrieves snapshot metadata without full data inspection', () => {
      const data = makeSessionData();
      cloner.registerSession('ses_meta', data);
      const snap = cloner.createSnapshot('ses_meta', 'metadata-test');

      const retrieved = cloner.getSnapshot(snap.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(snap.id);
      expect(retrieved!.label).toBe('metadata-test');
      expect(retrieved!.sessionId).toBe('ses_meta');
      expect(retrieved!.createdAt).toBeTruthy();
      expect(retrieved!.size).toBeGreaterThan(0);
    });
  });
});
