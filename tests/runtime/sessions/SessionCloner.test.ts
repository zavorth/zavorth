import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  SessionMergeStrategies,
  MergePlan,
  MergeResult,
  MergeConflict,
  MergeHistoryEntry,
  FieldMergeConfig,
} from '../../../src/runtime/sessions/SessionMergeStrategies.js';

describe('SessionCloner', () => {
  let merger: SessionMergeStrategies;

  beforeEach(() => {
    merger = new SessionMergeStrategies({ defaultStrategy: 'source-wins' });
  });

  describe('clone session with all parts', () => {
    it('copies all fields from source to target via merge plan', () => {
      const sourceData = {
        name: 'alpha-session',
        config: { model: 'gpt-4o', temperature: 0.7 },
        memory: { chunks: ['remembered task A'] },
        metadata: { tags: ['prod'], owner: 'user1' },
      };

      const plan = merger.createMergePlan('src_1', 'tgt_1', 'source-wins');
      const result = merger.executeMerge(plan, sourceData, {});

      expect(result.merged.name).toBe('alpha-session');
      expect(result.merged.config).toEqual({ model: 'gpt-4o', temperature: 0.7 });
      expect(result.merged.memory).toEqual({ chunks: ['remembered task A'] });
      expect(result.merged.metadata).toEqual({ tags: ['prod'], owner: 'user1' });
      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe('fork session and track divergence', () => {
    it('fork produces a clone, then divergent edits appear in merge comparison', () => {
      const original = {
        name: 'original',
        config: { model: 'gpt-4o' },
        counter: 1,
      };

      const fork = { ...original, counter: 1 };

      // Both evolve independently
      original.counter = 5;
      fork.counter = 10;

      const plan = merger.createMergePlan('fork_1', 'original_1', 'source-wins');
      const result = merger.executeMerge(plan, fork, original);

      expect(result.merged.counter).toBe(10);
      expect(result.merged.config).toEqual({ model: 'gpt-4o' });
      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe('partial clone (memory only)', () => {
    it('merges only memory fields when source contains only memory data', () => {
      const targetData = {
        name: 'target-session',
        config: { model: 'claude-4' },
        metadata: { tags: ['dev'] },
      };

      const sourceData = {
        memory: { chunks: ['insight 1', 'insight 2'], compressedChunks: [] },
      };

      const plan = merger.createMergePlan('src_mem', 'tgt_mem', 'source-wins');
      const result = merger.executeMerge(plan, sourceData, targetData);

      expect(result.merged.name).toBe('target-session');
      expect(result.merged.config).toEqual({ model: 'claude-4' });
      expect(result.merged.memory).toEqual({
        chunks: ['insight 1', 'insight 2'],
        compressedChunks: [],
      });
    });
  });

  describe('partial clone (config only)', () => {
    it('merges only config fields when source contains only config data', () => {
      const targetData = {
        name: 'target-session',
        memory: { chunks: ['existing memory'] },
        metadata: {},
      };

      const sourceData = {
        config: { model: 'gpt-4o-mini', temperature: 0.3 },
      };

      const plan = merger.createMergePlan('src_cfg', 'tgt_cfg', 'source-wins');
      const result = merger.executeMerge(plan, sourceData, targetData);

      expect(result.merged.name).toBe('target-session');
      expect(result.merged.memory).toEqual({ chunks: ['existing memory'] });
      expect(result.merged.config).toEqual({ model: 'gpt-4o-mini', temperature: 0.3 });
    });
  });

  describe('create and restore snapshots', () => {
    it('captures snapshot via merge plan and restores by re-applying source data', () => {
      const snapshot = {
        name: 'snap-session',
        config: { model: 'gpt-4o', temperature: 0.5 },
        memory: { chunks: ['snapshot state'] },
        metadata: { snapshotAt: '2026-06-28T00:00:00Z' },
      };

      const plan = merger.createMergePlan('snap_src', 'snap_tgt', 'source-wins', [], true);
      const preview = merger.dryRunMerge(plan, snapshot, {});

      expect(preview.merged).toEqual(snapshot);
      expect(plan.dryRun).toBe(true);

      const restorePlan = merger.createMergePlan('snap_src', 'snap_tgt', 'source-wins');
      const restored = merger.executeMerge(restorePlan, snapshot, {});

      expect(restored.merged).toEqual(snapshot);
      expect(restored.merged.name).toBe('snap-session');
    });
  });

  describe('get lineage tree', () => {
    it('tracks lineage via merge history entries', () => {
      const baseData = { name: 'base', counter: 0 };

      const plan1 = merger.createMergePlan('original', 'clone_a', 'source-wins');
      merger.executeMerge(plan1, baseData, {});

      const plan2 = merger.createMergePlan('original', 'clone_b', 'source-wins');
      merger.executeMerge(plan2, baseData, {});

      const plan3 = merger.createMergePlan('clone_a', 'clone_a1', 'source-wins');
      merger.executeMerge(plan3, { ...baseData, counter: 1 }, {});

      const history = merger.getMergeHistory();
      expect(history).toHaveLength(3);

      const originalChildren = history.filter((h) => h.sourceId === 'original');
      expect(originalChildren).toHaveLength(2);
      expect(originalChildren.map((h) => h.targetId).sort()).toEqual(['clone_a', 'clone_b']);

      const cloneAChildren = history.filter((h) => h.sourceId === 'clone_a');
      expect(cloneAChildren).toHaveLength(1);
      expect(cloneAChildren[0].targetId).toBe('clone_a1');
    });
  });

  describe('list clones of a session', () => {
    it('returns all merge targets for a given source session', () => {
      const data = { name: 'session', config: {} };

      merger.executeMerge(merger.createMergePlan('parent', 'child_1', 'source-wins'), data, {});
      merger.executeMerge(merger.createMergePlan('parent', 'child_2', 'source-wins'), data, {});
      merger.executeMerge(merger.createMergePlan('parent', 'child_3', 'source-wins'), data, {});
      merger.executeMerge(merger.createMergePlan('other', 'unrelated', 'source-wins'), data, {});

      const parentHistory = merger.getMergeHistory('parent');
      const targets = parentHistory.map((h) => h.targetId);

      expect(targets).toHaveLength(3);
      expect(targets).toContain('child_1');
      expect(targets).toContain('child_2');
      expect(targets).toContain('child_3');
    });
  });

  describe('compare two sessions', () => {
    it('identifies differing fields between source and target', () => {
      const sourceData = {
        name: 'session-A',
        config: { model: 'gpt-4o', temperature: 0.8 },
        metadata: { tags: ['v1'] },
      };

      const targetData = {
        name: 'session-B',
        config: { model: 'claude-4', temperature: 0.8 },
        metadata: { tags: ['v2'] },
      };

      const plan = merger.createMergePlan('A', 'B', 'manual');
      const result = merger.executeMerge(plan, sourceData, targetData);

      const conflictFields = result.conflicts.map((c) => c.field);
      expect(conflictFields).toContain('name');

      const deepMergedFields = result.historyEntry.fieldDetails
        .filter((d) => d.resolution === 'deep-merged')
        .map((d) => d.field);
      expect(deepMergedFields).toContain('config');
      expect(deepMergedFields).toContain('metadata');

      expect(result.merged.config).toEqual({ model: 'claude-4', temperature: 0.8 });
      expect(result.merged.metadata).toEqual({ tags: ['v1'] });
    });

    it('reports identical fields when sessions match on certain keys', () => {
      const sourceData = { name: 'same', version: 1 };
      const targetData = { name: 'same', version: 2 };

      const plan = merger.createMergePlan('C', 'D', 'manual');
      const result = merger.executeMerge(plan, sourceData, targetData);

      const nameDetail = result.historyEntry.fieldDetails.find((d) => d.field === 'name');
      expect(nameDetail?.resolution).toBe('identical');

      const versionDetail = result.historyEntry.fieldDetails.find((d) => d.field === 'version');
      expect(versionDetail?.resolution).toBe('deferred');
    });
  });

  describe('conflict detection on merge', () => {
    it('detects conflicts when strategy is manual', () => {
      const sourceData = { name: 'src', config: { key: 'src-val' } };
      const targetData = { name: 'tgt', config: { key: 'tgt-val' } };

      const plan = merger.createMergePlan('src_conf', 'tgt_conf', 'manual');
      const result = merger.executeMerge(plan, sourceData, targetData);

      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.historyEntry.conflictsFound).toBe(result.conflicts.length);
      expect(result.historyEntry.conflictsResolved).toBe(0);
    });

    it('registers pending conflicts for manual resolution', () => {
      const sourceData = { priority: 'high' };
      const targetData = { priority: 'low' };

      const plan = merger.createMergePlan('src_pend', 'tgt_pend', 'manual');
      const result = merger.executeMerge(plan, sourceData, targetData);

      const pending = merger.getPendingConflicts();
      expect(pending.has(result.historyEntry.id)).toBe(true);
      expect(pending.get(result.historyEntry.id)).toHaveLength(1);
    });

    it('resolves pending conflict via resolveConflict', () => {
      const sourceData = { color: 'blue' };
      const targetData = { color: 'red' };

      const plan = merger.createMergePlan('src_resolve', 'tgt_resolve', 'manual');
      const result = merger.executeMerge(plan, sourceData, targetData);
      const conflict = result.conflicts[0];

      const outcome = merger.resolveConflict(result.historyEntry.id, conflict, 'green');

      expect(outcome).not.toBeNull();
      expect(outcome!.field).toBe('color');
      expect(outcome!.resolvedValue).toBe('green');

      const pending = merger.getPendingConflicts();
      expect(pending.has(result.historyEntry.id)).toBe(false);
    });

    it('returns null when resolving non-existent merge ID', () => {
      const outcome = merger.resolveConflict(
        'nonexistent_id',
        { field: 'x', sourceValue: 1, targetValue: 2 },
        'resolved',
      );
      expect(outcome).toBeNull();
    });

    it('emits conflicts:pending when manual conflicts arise', () => {
      const handler = jest.fn();
      merger.on('conflicts:pending', handler);

      const plan = merger.createMergePlan('S', 'T', 'manual');
      merger.executeMerge(plan, { a: 1 }, { a: 2 });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          mergeId: expect.any(String),
          conflicts: expect.arrayContaining([
            expect.objectContaining({ field: 'a' }),
          ]),
        }),
      );
    });

    it('emits merge:completed after every merge', () => {
      const handler = jest.fn();
      merger.on('merge:completed', handler);

      const plan = merger.createMergePlan('S', 'T', 'source-wins');
      merger.executeMerge(plan, { x: 1 }, { y: 2 });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          historyEntry: expect.any(Object),
          dryRun: false,
        }),
      );
    });
  });

  describe('deep merge of nested objects', () => {
    it('recursively merges nested objects with source-wins', () => {
      const sourceData = {
        config: { a: 1, nested: { x: 10, y: 20 } },
      };
      const targetData = {
        config: { b: 2, nested: { y: 99, z: 30 } },
      };

      const plan = merger.createMergePlan('S', 'T', 'source-wins');
      const result = merger.executeMerge(plan, sourceData, targetData);

      expect(result.merged.config).toEqual({ a: 1, b: 2, nested: { x: 10, y: 20, z: 30 } });
      const configDetail = result.historyEntry.fieldDetails.find((d) => d.field === 'config');
      expect(configDetail?.resolution).toBe('deep-merged');
    });

    it('recursively merges nested objects with target-wins', () => {
      const sourceData = {
        config: { nested: { x: 10, y: 20 } },
      };
      const targetData = {
        config: { nested: { y: 99, z: 30 } },
      };

      const plan = merger.createMergePlan('S', 'T', 'target-wins');
      const result = merger.executeMerge(plan, sourceData, targetData);

      expect(result.merged.config).toEqual({ nested: { x: 10, y: 99, z: 30 } });
    });

    it('handles deeply nested three-level objects', () => {
      const sourceData = {
        level1: { level2: { level3: { a: 1, b: 'src' } } },
      };
      const targetData = {
        level1: { level2: { level3: { b: 'tgt', c: 3 } } },
      };

      const plan = merger.createMergePlan('S', 'T', 'source-wins');
      const result = merger.executeMerge(plan, sourceData, targetData);

      expect(result.merged).toEqual({
        level1: { level2: { level3: { a: 1, b: 'src', c: 3 } } },
      });
    });
  });

  describe('array merge strategies', () => {
    it('replaces arrays by default (replace mode)', () => {
      const sourceData = { tags: ['a', 'b', 'c'] };
      const targetData = { tags: ['x', 'y'] };

      const plan = merger.createMergePlan('S', 'T', 'source-wins');
      const result = merger.executeMerge(plan, sourceData, targetData);

      expect(result.merged.tags).toEqual(['a', 'b', 'c']);
    });

    it('concatenates arrays when field config specifies concatenate', () => {
      const fieldConfigs: FieldMergeConfig[] = [
        { field: 'tags', strategy: 'source-wins', arrayMode: 'concatenate' },
      ];

      const sourceData = { tags: ['a', 'b'] };
      const targetData = { tags: ['c', 'd'] };

      const plan = merger.createMergePlan('S', 'T', 'source-wins', fieldConfigs);
      const result = merger.executeMerge(plan, sourceData, targetData);

      expect(result.merged.tags).toEqual(['a', 'b', 'c', 'd']);
    });

    it('unions arrays when field config specifies union', () => {
      const fieldConfigs: FieldMergeConfig[] = [
        { field: 'tags', strategy: 'source-wins', arrayMode: 'union' },
      ];

      const sourceData = { tags: ['a', 'b', 'c'] };
      const targetData = { tags: ['b', 'c', 'd'] };

      const plan = merger.createMergePlan('S', 'T', 'source-wins', fieldConfigs);
      const result = merger.executeMerge(plan, sourceData, targetData);

      expect(result.merged.tags).toEqual(['a', 'b', 'c', 'd']);
    });

    it('unions arrays with duplicate objects correctly', () => {
      const fieldConfigs: FieldMergeConfig[] = [
        { field: 'items', strategy: 'source-wins', arrayMode: 'union' },
      ];

      const sourceData = { items: [{ id: 1 }, { id: 2 }] };
      const targetData = { items: [{ id: 2 }, { id: 3 }] };

      const plan = merger.createMergePlan('S', 'T', 'source-wins', fieldConfigs);
      const result = merger.executeMerge(plan, sourceData, targetData);

      expect(result.merged.items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    });

    it('uses default array mode from constructor options', () => {
      const concatMerger = new SessionMergeStrategies({ defaultArrayMode: 'concatenate' });

      const sourceData = { tags: ['a'] };
      const targetData = { tags: ['b'] };

      const plan = concatMerger.createMergePlan('S', 'T', 'source-wins');
      const result = concatMerger.executeMerge(plan, sourceData, targetData);

      expect(result.merged.tags).toEqual(['a', 'b']);
    });
  });
});
