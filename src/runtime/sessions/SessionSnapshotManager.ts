/**
 * SessionSnapshotManager - Automatic and manual session snapshots.
 *
 * Creates periodic snapshots of session state for resuming interrupted work.
 * Supports automatic snapshotting at intervals, manual snapshots, and
 * snapshot comparison/diff.
 *
 * Usage:
 *   const snapshot = new SessionSessionSnapshot({ autoSnapshotEnabled: true });
 *   await snapshot.createSessionSnapshot('ses_123', 'before-experiment');
 *   const restored = await snapshot.restoreSessionSnapshot('cp_abc');
 */

import { v4 as uuidv4 } from 'uuid';

export interface SessionSnapshotConfig {
  autoSnapshotEnabled: boolean;
  autoSnapshotIntervalMs: number;
  maxSessionSnapshotsPerSession: number;
  compressionEnabled: boolean;
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
  number: number;
  label: string;
  description: string;
  data: SessionData;
  createdAt: string;
  size: number;
  tags: string[];
}

export interface SessionSnapshotDiff {
  snapshot1Id: string;
  snapshot2Id: string;
  added: string[];
  removed: string[];
  modified: string[];
  unchanged: string[];
}

export interface SessionSnapshotExport {
  snapshot: SessionSnapshot;
  exportedAt: string;
  format: 'json' | 'compressed';
}

export interface SessionSnapshotStats {
  totalSessionSnapshots: number;
  totalSize: number;
  sessions: number;
  oldestSessionSnapshot: string | null;
  newestSessionSnapshot: string | null;
  snapshotsBySession: Record<string, number>;
}

const DEFAULT_CONFIG: SessionSnapshotConfig = {
  autoSnapshotEnabled: false,
  autoSnapshotIntervalMs: 300_000, // 5 minutes
  maxSessionSnapshotsPerSession: 50,
  compressionEnabled: false,
};

export class SessionSnapshotManager {
  private config: SessionSnapshotConfig;
  private snapshots = new Map<string, SessionSnapshot>();
  private sessionData = new Map<string, SessionData>();
  private sessionCounters = new Map<string, number>();
  private autoTimers = new Map<string, ReturnType<typeof setInterval>>();

  constructor(config?: Partial<SessionSnapshotConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Registers session data for snapshotting.
   */
  registerSession(sessionId: string, data: SessionData): void {
    this.sessionData.set(sessionId, data);
  }

  /**
   * Updates session data.
   */
  updateSessionData(sessionId: string, data: Partial<SessionData>): void {
    const existing = this.sessionData.get(sessionId);
    if (existing) {
      this.sessionData.set(sessionId, { ...existing, ...data });
    }
  }

  /**
   * Creates a manual snapshot.
   */
  createSessionSnapshot(
    sessionId: string,
    label?: string,
    description?: string,
    tags: string[] = [],
  ): SessionSnapshot {
    const data = this.sessionData.get(sessionId);
    if (!data) {
      throw new Error(`Session "${sessionId}" not found.`);
    }

    const number = (this.sessionCounters.get(sessionId) ?? 0) + 1;
    this.sessionCounters.set(sessionId, number);

    const id = `cp-${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString();
    const serialized = JSON.stringify(data);

    const snapshot: SessionSnapshot = {
      id,
      sessionId,
      number,
      label: label ?? `SessionSnapshot ${number}`,
      description: description ?? '',
      data: JSON.parse(serialized), // Deep copy
      createdAt: now,
      size: serialized.length,
      tags,
    };

    this.snapshots.set(id, snapshot);
    this.enforceLimit(sessionId);

    return snapshot;
  }

  /**
   * Creates an automatic snapshot if enabled.
   */
  autoSnapshot(sessionId: string): SessionSnapshot | null {
    if (!this.config.autoSnapshotEnabled) return null;
    return this.createSessionSnapshot(sessionId, `Auto-snapshot`);
  }

  /**
   * Starts automatic snapshotting for a session.
   */
  startAutoSnapshot(sessionId: string): boolean {
    if (!this.config.autoSnapshotEnabled) return false;
    if (this.autoTimers.has(sessionId)) return false;

    const timer = setInterval(() => {
      this.autoSnapshot(sessionId);
    }, this.config.autoSnapshotIntervalMs);

    this.autoTimers.set(sessionId, timer);
    return true;
  }

  /**
   * Stops automatic snapshotting for a session.
   */
  stopAutoSnapshot(sessionId: string): boolean {
    const timer = this.autoTimers.get(sessionId);
    if (!timer) return false;

    clearInterval(timer);
    this.autoTimers.delete(sessionId);
    return true;
  }

  /**
   * Gets a specific snapshot.
   */
  getSessionSnapshot(snapshotId: string): SessionSnapshot | null {
    return this.snapshots.get(snapshotId) ?? null;
  }

  /**
   * Lists snapshots for a session.
   */
  listSessionSnapshots(
    sessionId: string,
    filter?: { tags?: string[]; limit?: number; offset?: number },
  ): SessionSnapshot[] {
    let results = Array.from(this.snapshots.values())
      .filter((c) => c.sessionId === sessionId)
      .sort((a, b) => a.number - b.number);

    if (filter?.tags && filter.tags.length > 0) {
      results = results.filter((c) => filter.tags!.some((t) => c.tags.includes(t)));
    }

    const offset = filter?.offset ?? 0;
    const limit = filter?.limit ?? results.length;

    return results.slice(offset, offset + limit);
  }

  /**
   * Deletes a snapshot.
   */
  deleteSessionSnapshot(snapshotId: string): boolean {
    return this.snapshots.delete(snapshotId);
  }

  /**
   * Restores session to a specific snapshot.
   */
  restoreSessionSnapshot(snapshotId: string): SessionData | null {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) return null;

    const restored = JSON.parse(JSON.stringify(snapshot.data)); // Deep copy
    this.sessionData.set(snapshot.sessionId, restored);
    return restored;
  }

  /**
   * Compares two snapshots.
   */
  diffSessionSnapshots(id1: string, id2: string): SessionSnapshotDiff {
    const cp1 = this.snapshots.get(id1);
    const cp2 = this.snapshots.get(id2);

    if (!cp1 || !cp2) {
      throw new Error('One or both snapshots not found.');
    }

    const fields1 = this.flattenObject(cp1.data as unknown as Record<string, unknown>);
    const fields2 = this.flattenObject(cp2.data as unknown as Record<string, unknown>);

    const allKeys = new Set([...Object.keys(fields1), ...Object.keys(fields2)]);
    const added: string[] = [];
    const removed: string[] = [];
    const modified: string[] = [];
    const unchanged: string[] = [];

    for (const key of allKeys) {
      if (!(key in fields1)) {
        added.push(key);
      } else if (!(key in fields2)) {
        removed.push(key);
      } else if (JSON.stringify(fields1[key]) !== JSON.stringify(fields2[key])) {
        modified.push(key);
      } else {
        unchanged.push(key);
      }
    }

    return { snapshot1Id: id1, snapshot2Id: id2, added, removed, modified, unchanged };
  }

  /**
   * Exports a snapshot.
   */
  exportSessionSnapshot(snapshotId: string, format: 'json' | 'compressed' = 'json'): SessionSnapshotExport | null {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) return null;

    return {
      snapshot: JSON.parse(JSON.stringify(snapshot)),
      exportedAt: new Date().toISOString(),
      format,
    };
  }

  /**
   * Imports a snapshot from export.
   */
  importSessionSnapshot(data: SessionSnapshotExport): SessionSnapshot {
    const snapshot = { ...data.snapshot };
    this.snapshots.set(snapshot.id, snapshot);
    this.sessionData.set(snapshot.sessionId, snapshot.data);
    return snapshot;
  }

  /**
   * Gets snapshot configuration.
   */
  getConfig(): SessionSnapshotConfig {
    return { ...this.config };
  }

  /**
   * Updates snapshot configuration.
   */
  setConfig(config: Partial<SessionSnapshotConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Gets statistics.
   */
  getStats(sessionId?: string): SessionSnapshotStats {
    let snapshots = Array.from(this.snapshots.values());

    if (sessionId) {
      snapshots = snapshots.filter((c) => c.sessionId === sessionId);
    }

    const sessions = new Set(snapshots.map((c) => c.sessionId));
    const snapshotsBySession: Record<string, number> = {};

    for (const cp of snapshots) {
      snapshotsBySession[cp.sessionId] = (snapshotsBySession[cp.sessionId] ?? 0) + 1;
    }

    const sorted = snapshots.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    return {
      totalSessionSnapshots: snapshots.length,
      totalSize: snapshots.reduce((sum, cp) => sum + cp.size, 0),
      sessions: sessions.size,
      oldestSessionSnapshot: sorted[0]?.createdAt ?? null,
      newestSessionSnapshot: sorted[sorted.length - 1]?.createdAt ?? null,
      snapshotsBySession,
    };
  }

  /**
   * Stops all automatic snapshots.
   */
  destroy(): void {
    for (const timer of this.autoTimers.values()) {
      clearInterval(timer);
    }
    this.autoTimers.clear();
  }

  private enforceLimit(sessionId: string): void {
    const snapshots = this.listSessionSnapshots(sessionId);
    if (snapshots.length > this.config.maxSessionSnapshotsPerSession) {
      const toDelete = snapshots.slice(0, snapshots.length - this.config.maxSessionSnapshotsPerSession);
      for (const cp of toDelete) {
        this.snapshots.delete(cp.id);
      }
    }
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
}
