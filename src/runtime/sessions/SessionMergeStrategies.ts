/**
 * SessionMergeStrategies — Merge strategies and conflict resolution for session cloning.
 *
 * Provides configurable field-level and deep merge capabilities with
 * conflict tracking and audit history. Supports multiple strategies
 * from automatic resolution to manual user intervention.
 *
 * Usage:
 *   const merger = new SessionMergeStrategies();
 *   merger.setFieldMergeConfig('metadata.tags', { strategy: 'union' });
 *   const plan = merger.createMergePlan('source_1', 'target_2', 'source-wins');
 *   const result = await merger.executeMerge(plan);
 */

import { EventEmitter } from 'events';

export type MergeStrategy = 'last-writer-wins' | 'source-wins' | 'target-wins' | 'manual' | 'custom';

export type ArrayMergeMode = 'concatenate' | 'union' | 'replace';

export type ConflictOutcome = { field: string; resolvedValue: unknown } | null;

export interface FieldMergeConfig {
  field: string;
  strategy: MergeStrategy;
  arrayMode?: ArrayMergeMode;
  customResolver?: (source: unknown, target: unknown) => unknown;
}

export interface MergePlan {
  sourceId: string;
  targetId: string;
  strategy: MergeStrategy;
  fieldConfigs: FieldMergeConfig[];
  dryRun: boolean;
  timestamp: string;
}

export interface MergeConflict {
  field: string;
  sourceValue: unknown;
  targetValue: unknown;
  sourceTimestamp?: string;
  targetTimestamp?: string;
}

export interface MergeHistoryEntry {
  id: string;
  sourceId: string;
  targetId: string;
  strategy: MergeStrategy;
  timestamp: string;
  conflictsFound: number;
  conflictsResolved: number;
  fieldsMerged: number;
  fieldDetails: Array<{ field: string; resolution: string }>;
}

export interface MergeResult {
  merged: Record<string, unknown>;
  conflicts: MergeConflict[];
  resolved: ConflictOutcome[];
  historyEntry: MergeHistoryEntry;
}

export type ConflictResolver = (conflict: MergeConflict) => unknown;

export interface SessionMergeStrategiesOptions {
  defaultStrategy?: MergeStrategy;
  defaultArrayMode?: ArrayMergeMode;
  maxHistorySize?: number;
}

export class SessionMergeStrategies extends EventEmitter {
  private readonly defaultStrategy: MergeStrategy;
  private readonly defaultArrayMode: ArrayMergeMode;
  private readonly maxHistorySize: number;

  private fieldConfigs = new Map<string, FieldMergeConfig>();
  private history: MergeHistoryEntry[] = [];
  private pendingConflicts = new Map<string, MergeConflict[]>();
  private customResolvers = new Map<string, ConflictResolver>();
  private historyCounter = 0;

  constructor(options: SessionMergeStrategiesOptions = {}) {
    super();
    this.defaultStrategy = options.defaultStrategy ?? 'source-wins';
    this.defaultArrayMode = options.defaultArrayMode ?? 'replace';
    this.maxHistorySize = options.maxHistorySize ?? 500;
  }

  private generateId(): string {
    this.historyCounter++;
    return `merge_${Date.now()}_${this.historyCounter}`;
  }

  /**
   * Creates a merge plan for cloning data between sessions.
   */
  createMergePlan(
    sourceId: string,
    targetId: string,
    strategy: MergeStrategy,
    fieldConfigs: FieldMergeConfig[] = [],
    dryRun = false,
  ): MergePlan {
    return {
      sourceId,
      targetId,
      strategy,
      fieldConfigs,
      dryRun,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Executes a merge using the provided plan. Source and target data are
   * plain key-value maps representing session fields.
   */
  executeMerge(
    plan: MergePlan,
    sourceData: Record<string, unknown>,
    targetData: Record<string, unknown>,
  ): MergeResult {
    const strategy = plan.strategy;
    const allKeys = new Set([...Object.keys(sourceData), ...Object.keys(targetData)]);
    const merged: Record<string, unknown> = {};
    const conflicts: MergeConflict[] = [];
    const resolved: ConflictOutcome[] = [];
    const fieldDetails: Array<{ field: string; resolution: string }> = [];

    for (const key of allKeys) {
      const sourceVal = sourceData[key];
      const targetVal = targetData[key];
      const fieldConfig = this.getFieldMergeConfig(key, plan.fieldConfigs);
      const effectiveStrategy = fieldConfig?.strategy ?? strategy;

      if (sourceVal === undefined) {
        merged[key] = targetVal;
        fieldDetails.push({ field: key, resolution: 'target-only' });
        continue;
      }
      if (targetVal === undefined) {
        merged[key] = sourceVal;
        fieldDetails.push({ field: key, resolution: 'source-only' });
        continue;
      }

      const conflict: MergeConflict = {
        field: key,
        sourceValue: sourceVal,
        targetValue: targetVal,
      };

      if (this.deepEqual(sourceVal, targetVal)) {
        merged[key] = sourceVal;
        fieldDetails.push({ field: key, resolution: 'identical' });
        continue;
      }

      if (Array.isArray(sourceVal) && Array.isArray(targetVal)) {
        merged[key] = this.mergeArrays(sourceVal, targetVal, fieldConfig?.arrayMode);
        fieldDetails.push({ field: key, resolution: 'array-merged' });
        continue;
      }

      if (this.isMergeableObject(sourceVal) && this.isMergeableObject(targetVal)) {
        merged[key] = this.deepMerge(
          sourceVal as Record<string, unknown>,
          targetVal as Record<string, unknown>,
          effectiveStrategy,
          plan.fieldConfigs,
        );
        fieldDetails.push({ field: key, resolution: 'deep-merged' });
        continue;
      }

      const outcome = this.resolveField(key, sourceVal, targetVal, effectiveStrategy, fieldConfig);
      if (outcome.status === 'resolved') {
        merged[key] = outcome.value;
        resolved.push({ field: key, resolvedValue: outcome.value });
        fieldDetails.push({ field: key, resolution: effectiveStrategy });
      } else {
        conflicts.push(conflict);
        fieldDetails.push({ field: key, resolution: 'deferred' });
      }
    }

    const conflictsFound = conflicts.length;
    const conflictsResolved = resolved.length;
    const fieldsMerged = Object.keys(merged).length;

    const historyEntry: MergeHistoryEntry = {
      id: this.generateId(),
      sourceId: plan.sourceId,
      targetId: plan.targetId,
      strategy,
      timestamp: plan.timestamp,
      conflictsFound,
      conflictsResolved,
      fieldsMerged,
      fieldDetails,
    };

    this.recordHistory(historyEntry);

    if (conflicts.length > 0) {
      this.pendingConflicts.set(historyEntry.id, conflicts);
      this.emit('conflicts:pending', { mergeId: historyEntry.id, conflicts });
    }

    this.emit('merge:completed', { historyEntry, dryRun: plan.dryRun });

    return { merged, conflicts, resolved, historyEntry };
  }

  /**
   * Executes a merge in dry-run mode, returning a preview without applying changes.
   */
  dryRunMerge(
    plan: MergePlan,
    sourceData: Record<string, unknown>,
    targetData: Record<string, unknown>,
  ): MergeResult {
    const dryPlan: MergePlan = { ...plan, dryRun: true };
    return this.executeMerge(dryPlan, sourceData, targetData);
  }

  /**
   * Manually resolves a conflict identified in a pending merge.
   */
  resolveConflict(
    mergeId: string,
    conflict: MergeConflict,
    resolution: unknown,
  ): ConflictOutcome {
    const pending = this.pendingConflicts.get(mergeId);
    if (!pending) {
      return null;
    }

    const idx = pending.findIndex(
      (c) => c.field === conflict.field && this.deepEqual(c.sourceValue, conflict.sourceValue),
    );
    if (idx === -1) {
      return null;
    }

    pending.splice(idx, 1);
    if (pending.length === 0) {
      this.pendingConflicts.delete(mergeId);
    }

    this.emit('conflict:resolved', { mergeId, field: conflict.field, resolution });
    return { field: conflict.field, resolvedValue: resolution };
  }

  /**
   * Gets the merge configuration for a specific field.
   */
  getFieldMergeConfig(
    field: string,
    overrides?: FieldMergeConfig[],
  ): FieldMergeConfig | null {
    if (overrides) {
      const override = overrides.find((c) => c.field === field);
      if (override) return override;
    }
    return this.fieldConfigs.get(field) ?? null;
  }

  /**
   * Sets a merge configuration for a specific field.
   */
  setFieldMergeConfig(field: string, config: FieldMergeConfig): void {
    this.fieldConfigs.set(field, { ...config, field });
    this.emit('config:updated', { field, config });
  }

  /**
   * Retrieves merge history, optionally filtered by session ID.
   */
  getMergeHistory(sessionId?: string): MergeHistoryEntry[] {
    if (!sessionId) return [...this.history];
    return this.history.filter(
      (h) => h.sourceId === sessionId || h.targetId === sessionId,
    );
  }

  /**
   * Creates and registers a custom conflict resolver.
   */
  createCustomResolver(fn: ConflictResolver): string {
    const id = `resolver_${Date.now()}_${this.customResolvers.size}`;
    this.customResolvers.set(id, fn);
    return id;
  }

  /**
   * Retrieves a registered custom resolver by ID.
   */
  getCustomResolver(id: string): ConflictResolver | null {
    return this.customResolvers.get(id) ?? null;
  }

  /**
   * Returns all pending conflicts awaiting manual resolution.
   */
  getPendingConflicts(): Map<string, MergeConflict[]> {
    return new Map(this.pendingConflicts);
  }

  /**
   * Clears merge history.
   */
  clearHistory(): void {
    this.history = [];
    this.historyCounter = 0;
  }

  private recordHistory(entry: MergeHistoryEntry): void {
    this.history.push(entry);
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
  }

  private mergeArrays(
    source: unknown[],
    target: unknown[],
    mode?: ArrayMergeMode,
  ): unknown[] {
    const effectiveMode = mode ?? this.defaultArrayMode;
    switch (effectiveMode) {
      case 'concatenate':
        return [...source, ...target];
      case 'union': {
        const seen = new Set<string>();
        const result: unknown[] = [];
        for (const item of [...source, ...target]) {
          const key = JSON.stringify(item);
          if (!seen.has(key)) {
            seen.add(key);
            result.push(item);
          }
        }
        return result;
      }
      case 'replace':
        return [...source];
      default:
        return [...target];
    }
  }

  private deepMerge(
    source: Record<string, unknown>,
    target: Record<string, unknown>,
    strategy: MergeStrategy,
    fieldConfigs: FieldMergeConfig[],
  ): Record<string, unknown> {
    const result = { ...target };
    const allKeys = new Set([...Object.keys(source), ...Object.keys(target)]);

    for (const key of allKeys) {
      const srcVal = source[key];
      const tgtVal = target[key];
      const prefix = key;

      if (srcVal === undefined) {
        result[key] = tgtVal;
        continue;
      }
      if (tgtVal === undefined) {
        result[key] = srcVal;
        continue;
      }

      if (Array.isArray(srcVal) && Array.isArray(tgtVal)) {
        const config = this.getFieldMergeConfig(prefix, fieldConfigs);
        result[key] = this.mergeArrays(srcVal, tgtVal, config?.arrayMode);
        continue;
      }

      if (this.isMergeableObject(srcVal) && this.isMergeableObject(tgtVal)) {
        result[key] = this.deepMerge(
          srcVal as Record<string, unknown>,
          tgtVal as Record<string, unknown>,
          strategy,
          fieldConfigs,
        );
        continue;
      }

      const outcome = this.resolveField(prefix, srcVal, tgtVal, strategy, null);
      if (outcome.status === 'resolved') {
        result[key] = outcome.value;
      }
    }

    return result;
  }

  private resolveField(
    field: string,
    sourceVal: unknown,
    targetVal: unknown,
    strategy: MergeStrategy,
    config: FieldMergeConfig | null,
  ): { status: 'resolved'; value: unknown } | { status: 'pending' } {
    switch (strategy) {
      case 'source-wins':
        return { status: 'resolved', value: sourceVal };
      case 'target-wins':
        return { status: 'resolved', value: targetVal };
      case 'last-writer-wins':
        return { status: 'resolved', value: sourceVal };
      case 'custom': {
        if (config?.customResolver) {
          return { status: 'resolved', value: config.customResolver(sourceVal, targetVal) };
        }
        return { status: 'pending' };
      }
      case 'manual':
        return { status: 'pending' };
      default:
        return { status: 'resolved', value: sourceVal };
    }
  }

  private isMergeableObject(val: unknown): val is Record<string, unknown> {
    return val !== null && typeof val === 'object' && !Array.isArray(val);
  }

  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (typeof a !== typeof b) return false;
    if (typeof a !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;

    const keysA = Object.keys(a as Record<string, unknown>);
    const keysB = Object.keys(b as Record<string, unknown>);
    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!this.deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
        return false;
      }
    }
    return true;
  }
}
