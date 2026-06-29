/**
 * SessionCloner — Clone, fork, and snapshot session state.
 *
 * Enables parallel exploration by creating copies of session state
 * that can diverge independently, with merge support and lineage tracking.
 *
 * Usage:
 *   const cloner = new SessionCloner();
 *   const clone = cloner.cloneSession('ses_123', { includeMemory: true });
 *   const fork = cloner.forkSession('ses_123', { includeHistory: true });
 *   const snapshot = cloner.createSnapshot('ses_123', 'before-experiment');
 */

import { v4 as uuidv4 } from 'uuid';

export type CloneType = 'clone' | 'fork' | 'snapshot';

export interface SessionClone {
  id: string;
  sourceId: string;
  type: CloneType;
  createdAt: string;
  divergedAt?: string;
  metadata: Record<string, unknown>;
}

export interface CloneOptions {
  includeMemory?: boolean;
  includeHistory?: boolean;
  includeConfig?: boolean;
  includeTools?: boolean;
  customMetadata?: Record<string, unknown>;
}

export interface SessionData {
  messages: Array<{ role: string; content: string; timestamp: string }>;
  memory: Array<{ id: string; content: string; keywords: string[] }>;
  config: Record<string, unknown>;
  toolState: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface SessionSnapshot {
  id: string;
  sessionId: string;
  label: string;
  data: SessionData;
  createdAt: string;
  size: number;
}

export interface MergeConflict {
  field: string;
  sourceValue: unknown;
  targetValue: unknown;
  resolution?: unknown;
}

export interface MergeResult {
  success: boolean;
  conflicts: MergeConflict[];
  mergedFields: string[];
}

export interface LineageEntry {
  sessionId: string;
  parentId?: string;
  type: CloneType;
  createdAt: string;
}

export class SessionCloner {
  private clones = new Map<string, SessionClone>();
  private snapshots = new Map<string, SessionSnapshot>();
  private sessionData = new Map<string, SessionData>();
  private lineage = new Map<string, LineageEntry[]>();

  /**
   * Registers session data for cloning.
   */
  registerSession(sessionId: string, data: SessionData): void {
    this.sessionData.set(sessionId, data);
  }

  /**
   * Creates a complete clone of a session.
   */
  cloneSession(sessionId: string, options: CloneOptions = {}): SessionClone {
    const sourceData = this.sessionData.get(sessionId);
    if (!sourceData) {
      throw new Error(`Session "${sessionId}" not found.`);
    }

    const cloneId = `clone-${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString();

    const cloneData = this.extractParts(sourceData, options);
    this.sessionData.set(cloneId, cloneData);

    const clone: SessionClone = {
      id: cloneId,
      sourceId: sessionId,
      type: 'clone',
      createdAt: now,
      metadata: options.customMetadata ?? {},
    };

    this.clones.set(cloneId, clone);
    this.addLineage(sessionId, cloneId, 'clone', now);

    return clone;
  }

  /**
   * Creates a fork that can diverge independently.
   */
  forkSession(sessionId: string, options: CloneOptions = {}): SessionClone {
    const sourceData = this.sessionData.get(sessionId);
    if (!sourceData) {
      throw new Error(`Session "${sessionId}" not found.`);
    }

    const forkId = `fork-${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString();

    const forkData = this.extractParts(sourceData, options);
    this.sessionData.set(forkId, forkData);

    const fork: SessionClone = {
      id: forkId,
      sourceId: sessionId,
      type: 'fork',
      createdAt: now,
      divergedAt: now,
      metadata: options.customMetadata ?? {},
    };

    this.clones.set(forkId, fork);
    this.addLineage(sessionId, forkId, 'fork', now);

    return fork;
  }

  /**
   * Clones only specific parts of a session.
   */
  partialClone(sessionId: string, parts: string[]): SessionClone {
    const sourceData = this.sessionData.get(sessionId);
    if (!sourceData) {
      throw new Error(`Session "${sessionId}" not found.`);
    }

    const cloneId = `partial-${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString();

    const options: CloneOptions = {
      includeMemory: parts.includes('memory'),
      includeHistory: parts.includes('history'),
      includeConfig: parts.includes('config'),
      includeTools: parts.includes('tools'),
    };

    const cloneData = this.extractParts(sourceData, options);
    this.sessionData.set(cloneId, cloneData);

    const clone: SessionClone = {
      id: cloneId,
      sourceId: sessionId,
      type: 'clone',
      createdAt: now,
      metadata: { partialParts: parts },
    };

    this.clones.set(cloneId, clone);
    this.addLineage(sessionId, cloneId, 'clone', now);

    return clone;
  }

  /**
   * Merges changes from source session into target session.
   */
  mergeSessions(
    sourceId: string,
    targetId: string,
    strategy: 'last-writer-wins' | 'source-wins' | 'target-wins' = 'last-writer-wins',
  ): MergeResult {
    const sourceData = this.sessionData.get(sourceId);
    const targetData = this.sessionData.get(targetId);

    if (!sourceData || !targetData) {
      throw new Error('Source or target session not found.');
    }

    const conflicts: MergeConflict[] = [];
    const mergedFields: string[] = [];

    // Merge messages
    if (strategy === 'source-wins' || strategy === 'last-writer-wins') {
      targetData.messages = [...sourceData.messages];
      mergedFields.push('messages');
    } else if (targetData.messages.length === 0) {
      targetData.messages = [...sourceData.messages];
      mergedFields.push('messages');
    }

    // Merge memory
    if (strategy === 'source-wins') {
      targetData.memory = [...sourceData.memory];
      mergedFields.push('memory');
    } else if (strategy === 'target-wins') {
      // Keep target
    } else {
      // last-writer-wins: merge by id, source overwrites
      const memoryMap = new Map(targetData.memory.map((m) => [m.id, m]));
      for (const m of sourceData.memory) {
        memoryMap.set(m.id, m);
      }
      targetData.memory = Array.from(memoryMap.values());
      mergedFields.push('memory');
    }

    // Merge config
    const configConflicts = this.mergeObjects(sourceData.config, targetData.config, strategy);
    conflicts.push(...configConflicts.filter((c) => c.resolution === undefined));
    if (configConflicts.length > 0) mergedFields.push('config');

    // Merge toolState
    const toolConflicts = this.mergeObjects(sourceData.toolState, targetData.toolState, strategy);
    conflicts.push(...toolConflicts.filter((c) => c.resolution === undefined));
    if (toolConflicts.length > 0) mergedFields.push('toolState');

    // Merge metadata
    const metaConflicts = this.mergeObjects(sourceData.metadata, targetData.metadata, strategy);
    conflicts.push(...metaConflicts.filter((c) => c.resolution === undefined));
    if (metaConflicts.length > 0) mergedFields.push('metadata');

    return {
      success: conflicts.length === 0,
      conflicts,
      mergedFields,
    };
  }

  /**
   * Detects conflicts between two session data sets.
   */
  detectConflicts(sourceData: SessionData, targetData: SessionData): MergeConflict[] {
    const conflicts: MergeConflict[] = [];

    // Check config conflicts
    for (const key of Object.keys(sourceData.config)) {
      if (key in targetData.config) {
        const sourceVal = sourceData.config[key];
        const targetVal = targetData.config[key];
        if (JSON.stringify(sourceVal) !== JSON.stringify(targetVal)) {
          conflicts.push({
            field: `config.${key}`,
            sourceValue: sourceVal,
            targetValue: targetVal,
          });
        }
      }
    }

    // Check toolState conflicts
    for (const key of Object.keys(sourceData.toolState)) {
      if (key in targetData.toolState) {
        const sourceVal = sourceData.toolState[key];
        const targetVal = targetData.toolState[key];
        if (JSON.stringify(sourceVal) !== JSON.stringify(targetVal)) {
          conflicts.push({
            field: `toolState.${key}`,
            sourceValue: sourceVal,
            targetValue: targetVal,
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Creates a point-in-time snapshot.
   */
  createSnapshot(sessionId: string, label: string): SessionSnapshot {
    const data = this.sessionData.get(sessionId);
    if (!data) {
      throw new Error(`Session "${sessionId}" not found.`);
    }

    const snapshotId = `snap-${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString();

    const snapshot: SessionSnapshot = {
      id: snapshotId,
      sessionId,
      label,
      data: JSON.parse(JSON.stringify(data)), // Deep copy
      createdAt: now,
      size: JSON.stringify(data).length,
    };

    this.snapshots.set(snapshotId, snapshot);
    return snapshot;
  }

  /**
   * Restores a session from a snapshot.
   */
  restoreSnapshot(snapshotId: string): string {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot "${snapshotId}" not found.`);
    }

    this.sessionData.set(snapshot.sessionId, JSON.parse(JSON.stringify(snapshot.data)));
    return snapshot.sessionId;
  }

  /**
   * Gets full lineage tree for a session.
   */
  getLineage(sessionId: string): LineageEntry[] {
    return this.lineage.get(sessionId) ?? [];
  }

  /**
   * Lists all clones/forks of a session.
   */
  listClones(sessionId: string): SessionClone[] {
    return Array.from(this.clones.values()).filter((c) => c.sourceId === sessionId);
  }

  /**
   * Compares two sessions and returns differences.
   */
  compareSessions(id1: string, id2: string): {
    onlyInFirst: string[];
    onlyInSecond: string[];
    different: string[];
    identical: string[];
  } {
    const data1 = this.sessionData.get(id1);
    const data2 = this.sessionData.get(id2);

    if (!data1 || !data2) {
      throw new Error('One or both sessions not found.');
    }

    const fields1 = this.flattenObject(data1);
    const fields2 = this.flattenObject(data2);

    const allKeys = new Set([...Object.keys(fields1), ...Object.keys(fields2)]);

    const onlyInFirst: string[] = [];
    const onlyInSecond: string[] = [];
    const different: string[] = [];
    const identical: string[] = [];

    for (const key of allKeys) {
      if (!(key in fields1)) {
        onlyInSecond.push(key);
      } else if (!(key in fields2)) {
        onlyInFirst.push(key);
      } else if (JSON.stringify(fields1[key]) !== JSON.stringify(fields2[key])) {
        different.push(key);
      } else {
        identical.push(key);
      }
    }

    return { onlyInFirst, onlyInSecond, different, identical };
  }

  /**
   * Gets snapshot by ID.
   */
  getSnapshot(snapshotId: string): SessionSnapshot | null {
    return this.snapshots.get(snapshotId) ?? null;
  }

  /**
   * Lists all snapshots for a session.
   */
  listSnapshots(sessionId: string): SessionSnapshot[] {
    return Array.from(this.snapshots.values()).filter((s) => s.sessionId === sessionId);
  }

  /**
   * Gets session data.
   */
  getSessionData(sessionId: string): SessionData | null {
    return this.sessionData.get(sessionId) ?? null;
  }

  /**
   * Deletes a clone and its data.
   */
  deleteClone(cloneId: string): boolean {
    const clone = this.clones.get(cloneId);
    if (!clone) return false;

    this.clones.delete(cloneId);
    this.sessionData.delete(cloneId);
    return true;
  }

  private extractParts(data: SessionData, options: CloneOptions): SessionData {
    return {
      messages: options.includeHistory !== false ? [...data.messages] : [],
      memory: options.includeMemory !== false ? [...data.memory] : [],
      config: options.includeConfig !== false ? { ...data.config } : {},
      toolState: options.includeTools !== false ? { ...data.toolState } : {},
      metadata: { ...data.metadata },
    };
  }

  private mergeObjects(
    source: Record<string, unknown>,
    target: Record<string, unknown>,
    strategy: string,
  ): MergeConflict[] {
    const conflicts: MergeConflict[] = [];

    for (const key of Object.keys(source)) {
      if (key in target) {
        const sourceVal = source[key];
        const targetVal = target[key];

        if (JSON.stringify(sourceVal) !== JSON.stringify(targetVal)) {
          if (strategy === 'source-wins') {
            target[key] = sourceVal;
          } else if (strategy === 'target-wins') {
            // Keep target
          } else {
            // last-writer-wins: source wins
            target[key] = sourceVal;
          }
        }
      } else {
        target[key] = source[key];
      }
    }

    return conflicts;
  }

  private flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, this.flattenObject(value as Record<string, unknown>, fullKey));
      } else {
        result[fullKey] = value;
      }
    }

    return result;
  }

  private addLineage(sessionId: string, childId: string, type: CloneType, createdAt: string): void {
    const entries = this.lineage.get(sessionId) ?? [];
    entries.push({ sessionId: childId, parentId: sessionId, type, createdAt });
    this.lineage.set(sessionId, entries);
  }
}
