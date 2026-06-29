import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  SessionMergeStrategies,
  MergeStrategy,
  FieldMergeConfig,
  MergeConflict,
} from '../../../src/runtime/sessions/SessionMergeStrategies.js';

describe('SessionMergeStrategies', () => {
  let merger: SessionMergeStrategies;

  beforeEach(() => {
    merger = new SessionMergeStrategies();
  });

  describe('last-writer-wins strategy', () => {
    it('resolves scalar conflicts by taking the source value', () => {
      const plan = merger.createMergePlan('S', 'T', 'last-writer-wins');
      const result = merger.executeMerge(plan, { name: 'new-name' }, { name: 'old-name' });

      expect(result.merged.name).toBe('new-name');
      expect(result.conflicts).toHaveLength(0);
      expect(result.resolved).toHaveLength(1);
      expect(result.resolved[0]).toEqual({ field: 'name', resolvedValue: 'new-name' });
    });

    it('takes source value for nested scalar differences', () => {
      const plan = merger.createMergePlan('S', 'T', 'last-writer-wins');
      const result = merger.executeMerge(
        plan,
        { config: { priority: 'high' } },
        { config: { priority: 'low' } },
      );

      expect(result.merged.config).toEqual({ priority: 'high' });
    });
  });

  describe('source-wins strategy', () => {
    it('always prefers the source value over target', () => {
      const plan = merger.createMergePlan('S', 'T', 'source-wins');
      const result = merger.executeMerge(plan, { a: 1, b: 'src' }, { a: 2, b: 'tgt' });

      expect(result.merged.a).toBe(1);
      expect(result.merged.b).toBe('src');
      expect(result.conflicts).toHaveLength(0);
    });

    it('includes target-only fields in merged output', () => {
      const plan = merger.createMergePlan('S', 'T', 'source-wins');
      const result = merger.executeMerge(plan, { a: 1 }, { a: 2, b: 'only-target' });

      expect(result.merged.b).toBe('only-target');
    });
  });

  describe('target-wins strategy', () => {
    it('always prefers the target value over source', () => {
      const plan = merger.createMergePlan('S', 'T', 'target-wins');
      const result = merger.executeMerge(plan, { a: 'src', b: 10 }, { a: 'tgt', b: 20 });

      expect(result.merged.a).toBe('tgt');
      expect(result.merged.b).toBe(20);
      expect(result.conflicts).toHaveLength(0);
    });

    it('includes source-only fields in merged output', () => {
      const plan = merger.createMergePlan('S', 'T', 'target-wins');
      const result = merger.executeMerge(plan, { a: 'src', extra: true }, { a: 'tgt' });

      expect(result.merged.extra).toBe(true);
    });
  });

  describe('manual resolution', () => {
    it('leaves scalar conflicts pending when strategy is manual', () => {
      const plan = merger.createMergePlan('S', 'T', 'manual');
      const result = merger.executeMerge(plan, { x: 'src' }, { x: 'tgt' });

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]).toEqual({ field: 'x', sourceValue: 'src', targetValue: 'tgt' });
      expect(result.merged.x).toBeUndefined();
      expect(result.historyEntry.conflictsResolved).toBe(0);
    });

    it('resolves conflict and emits conflict:resolved', () => {
      const handler = jest.fn();
      merger.on('conflict:resolved', handler);

      const plan = merger.createMergePlan('S', 'T', 'manual');
      const result = merger.executeMerge(plan, { x: 'src' }, { x: 'tgt' });
      const conflict = result.conflicts[0];

      const outcome = merger.resolveConflict(result.historyEntry.id, conflict, 'manually-chosen');

      expect(outcome).toEqual({ field: 'x', resolvedValue: 'manually-chosen' });
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          mergeId: result.historyEntry.id,
          field: 'x',
          resolution: 'manually-chosen',
        }),
      );
    });

    it('handles multiple manual conflicts in one merge', () => {
      const plan = merger.createMergePlan('S', 'T', 'manual');
      const result = merger.executeMerge(
        plan,
        { a: 'srcA', b: 'srcB', c: 'srcC' },
        { a: 'tgtA', b: 'tgtB', c: 'tgtC' },
      );

      expect(result.conflicts).toHaveLength(3);
      expect(result.historyEntry.conflictsFound).toBe(3);

      const pending = merger.getPendingConflicts();
      const mergeConflicts = pending.get(result.historyEntry.id);
      expect(mergeConflicts).toHaveLength(3);

      const conflictA = { ...result.conflicts[0] };
      const conflictB = { ...result.conflicts[1] };
      const conflictC = { ...result.conflicts[2] };

      merger.resolveConflict(result.historyEntry.id, conflictA, 'resolvedA');
      merger.resolveConflict(result.historyEntry.id, conflictB, 'resolvedB');
      merger.resolveConflict(result.historyEntry.id, conflictC, 'resolvedC');

      const afterResolve = merger.getPendingConflicts();
      expect(afterResolve.has(result.historyEntry.id)).toBe(false);
    });
  });

  describe('field-level merge configs', () => {
    it('applies field-specific strategy overriding the plan strategy', () => {
      const fieldConfigs: FieldMergeConfig[] = [
        { field: 'priority', strategy: 'target-wins' },
      ];

      const plan = merger.createMergePlan('S', 'T', 'source-wins', fieldConfigs);
      const result = merger.executeMerge(plan, { priority: 'high', name: 'src' }, { priority: 'low', name: 'tgt' });

      expect(result.merged.priority).toBe('low');
      expect(result.merged.name).toBe('src');
    });

    it('returns null for unconfigured field', () => {
      const config = merger.getFieldMergeConfig('nonexistent');
      expect(config).toBeNull();
    });

    it('returns stored config for a configured field', () => {
      merger.setFieldMergeConfig('tags', { field: 'tags', strategy: 'source-wins', arrayMode: 'union' });
      const config = merger.getFieldMergeConfig('tags');

      expect(config).not.toBeNull();
      expect(config!.strategy).toBe('source-wins');
      expect(config!.arrayMode).toBe('union');
    });

    it('override configs take precedence over stored configs', () => {
      merger.setFieldMergeConfig('x', { field: 'x', strategy: 'source-wins' });

      const overrides: FieldMergeConfig[] = [
        { field: 'x', strategy: 'target-wins' },
      ];

      const config = merger.getFieldMergeConfig('x', overrides);
      expect(config!.strategy).toBe('target-wins');
    });

    it('emits config:updated when setting field config', () => {
      const handler = jest.fn();
      merger.on('config:updated', handler);

      merger.setFieldMergeConfig('myField', { field: 'myField', strategy: 'manual' });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          field: 'myField',
          config: expect.objectContaining({ strategy: 'manual' }),
        }),
      );
    });
  });

  describe('custom resolver function', () => {
    it('creates and retrieves a custom resolver', () => {
      const resolverFn = (source: unknown, target: unknown) => {
        if (typeof source === 'number' && typeof target === 'number') {
          return source + target;
        }
        return source;
      };

      const id = merger.createCustomResolver(resolverFn);
      const retrieved = merger.getCustomResolver(id);

      expect(retrieved).toBe(resolverFn);
    });

    it('returns null for unknown resolver ID', () => {
      expect(merger.getCustomResolver('nonexistent')).toBeNull();
    });

    it('uses custom resolver in merge when strategy is custom', () => {
      const addResolver = (source: unknown, target: unknown) =>
        (source as number) + (target as number);

      const resolverId = merger.createCustomResolver(addResolver);

      const fieldConfigs: FieldMergeConfig[] = [
        {
          field: 'score',
          strategy: 'custom',
          customResolver: addResolver,
        },
      ];

      const plan = merger.createMergePlan('S', 'T', 'source-wins', fieldConfigs);
      const result = merger.executeMerge(plan, { score: 10 }, { score: 5 });

      expect(result.merged.score).toBe(15);
    });

    it('falls back to pending when custom strategy has no resolver', () => {
      const fieldConfigs: FieldMergeConfig[] = [
        { field: 'value', strategy: 'custom' },
      ];

      const plan = merger.createMergePlan('S', 'T', 'source-wins', fieldConfigs);
      const result = merger.executeMerge(plan, { value: 'a' }, { value: 'b' });

      const conflict = result.conflicts.find((c) => c.field === 'value');
      expect(conflict).toBeDefined();
    });
  });

  describe('dry run merge preview', () => {
    it('returns merge result without marking as permanent', () => {
      const plan = merger.createMergePlan('S', 'T', 'source-wins');
      const result = merger.dryRunMerge(plan, { a: 1 }, { b: 2 });

      expect(result.merged).toEqual({ a: 1, b: 2 });
      expect(result.historyEntry).toBeDefined();
    });

    it('dry run plan has dryRun flag set to true', () => {
      const plan = merger.createMergePlan('S', 'T', 'source-wins', [], false);
      const result = merger.dryRunMerge(plan, { x: 1 }, { x: 2 });

      expect(result.historyEntry).toBeDefined();
    });

    it('emits merge:completed with dryRun=true', () => {
      const handler = jest.fn();
      merger.on('merge:completed', handler);

      const plan = merger.createMergePlan('S', 'T', 'source-wins');
      merger.dryRunMerge(plan, { a: 1 }, { b: 2 });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ dryRun: true }),
      );
    });

    it('produces same merged output as actual merge', () => {
      const plan = merger.createMergePlan('S', 'T', 'source-wins');
      const sourceData = { name: 'test', config: { x: 1 } };
      const targetData = { name: 'other', config: { y: 2 } };

      const dryResult = merger.dryRunMerge(plan, sourceData, targetData);
      const actualResult = merger.executeMerge(plan, sourceData, targetData);

      expect(dryResult.merged).toEqual(actualResult.merged);
    });
  });

  describe('merge history tracking', () => {
    it('records every merge in history', () => {
      merger.executeMerge(merger.createMergePlan('S1', 'T1', 'source-wins'), { a: 1 }, {});
      merger.executeMerge(merger.createMergePlan('S2', 'T2', 'target-wins'), {}, { b: 2 });
      merger.executeMerge(merger.createMergePlan('S3', 'T3', 'manual'), { c: 3 }, { c: 4 });

      const history = merger.getMergeHistory();
      expect(history).toHaveLength(3);
      expect(history[0].sourceId).toBe('S1');
      expect(history[1].strategy).toBe('target-wins');
      expect(history[2].conflictsFound).toBe(1);
    });

    it('filters history by session ID', () => {
      merger.executeMerge(merger.createMergePlan('shared', 'A', 'source-wins'), { a: 1 }, {});
      merger.executeMerge(merger.createMergePlan('shared', 'B', 'source-wins'), { b: 2 }, {});
      merger.executeMerge(merger.createMergePlan('other', 'C', 'source-wins'), { c: 3 }, {});

      const sharedHistory = merger.getMergeHistory('shared');
      expect(sharedHistory).toHaveLength(2);

      const asTarget = merger.getMergeHistory('A');
      expect(asTarget).toHaveLength(1);
      expect(asTarget[0].targetId).toBe('A');

      const unrelated = merger.getMergeHistory('nonexistent');
      expect(unrelated).toHaveLength(0);
    });

    it('clears history', () => {
      merger.executeMerge(merger.createMergePlan('S', 'T', 'source-wins'), { a: 1 }, {});
      expect(merger.getMergeHistory()).toHaveLength(1);

      merger.clearHistory();
      expect(merger.getMergeHistory()).toHaveLength(0);
    });

    it('respects maxHistorySize', () => {
      const smallMerger = new SessionMergeStrategies({ maxHistorySize: 3 });

      for (let i = 0; i < 5; i++) {
        smallMerger.executeMerge(
          smallMerger.createMergePlan(`S${i}`, `T${i}`, 'source-wins'),
          { v: i },
          {},
        );
      }

      const history = smallMerger.getMergeHistory();
      expect(history).toHaveLength(3);
      expect(history[0].sourceId).toBe('S2');
      expect(history[2].sourceId).toBe('S4');
    });

    it('includes field details in history entries', () => {
      const plan = merger.createMergePlan('S', 'T', 'source-wins');
      const result = merger.executeMerge(
        plan,
        { name: 'src', extra: true },
        { name: 'tgt' },
      );

      expect(result.historyEntry.fieldDetails).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'name', resolution: 'source-wins' }),
          expect.objectContaining({ field: 'extra', resolution: 'source-only' }),
        ]),
      );
    });
  });

  describe('deep merge of complex objects', () => {
    it('merges objects with mixed nesting and scalar values', () => {
      const sourceData = {
        a: { b: { c: 1 } },
        x: 'src',
        list: ['a', 'b'],
      };
      const targetData = {
        a: { b: { d: 2 }, e: 3 },
        x: 'tgt',
        list: ['c'],
      };

      const plan = merger.createMergePlan('S', 'T', 'source-wins');
      const result = merger.executeMerge(plan, sourceData, targetData);

      expect(result.merged.a).toEqual({ b: { c: 1, d: 2 }, e: 3 });
      expect(result.merged.x).toBe('src');
      expect(result.merged.list).toEqual(['a', 'b']);
    });

    it('handles objects with null values', () => {
      const sourceData = { key: null };
      const targetData = { key: 'value' };

      const plan = merger.createMergePlan('S', 'T', 'source-wins');
      const result = merger.executeMerge(plan, sourceData, targetData);

      expect(result.merged.key).toBeNull();
    });

    it('merges objects where one side has extra nested properties', () => {
      const sourceData = {
        database: { host: 'localhost', port: 5432 },
      };
      const targetData = {
        database: { host: 'prod-db', ssl: true },
      };

      const plan = merger.createMergePlan('S', 'T', 'target-wins');
      const result = merger.executeMerge(plan, sourceData, targetData);

      expect(result.merged.database).toEqual({
        host: 'prod-db',
        port: 5432,
        ssl: true,
      });
    });

    it('handles boolean, number, and string type mixing correctly', () => {
      const sourceData = { flag: true, count: 42, label: 'src' };
      const targetData = { flag: false, count: 0, label: 'tgt' };

      const plan = merger.createMergePlan('S', 'T', 'source-wins');
      const result = merger.executeMerge(plan, sourceData, targetData);

      expect(result.merged.flag).toBe(true);
      expect(result.merged.count).toBe(42);
      expect(result.merged.label).toBe('src');
    });

    it('identical nested objects are not flagged as conflicts', () => {
      const shared = { model: 'gpt-4o', params: { temp: 0.7 } };
      const sourceData = { config: { ...shared } };
      const targetData = { config: { ...shared } };

      const plan = merger.createMergePlan('S', 'T', 'source-wins');
      const result = merger.executeMerge(plan, sourceData, targetData);

      expect(result.merged.config).toEqual(shared);
      const detail = result.historyEntry.fieldDetails.find((d) => d.field === 'config');
      expect(detail?.resolution).toBe('identical');
    });
  });
});
