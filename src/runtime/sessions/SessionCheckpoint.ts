/**
 * SessionCheckpoint — Auto and manual checkpointing for session state.
 *
 * Creates periodic snapshots of session state for resuming interrupted work.
 * Supports auto-checkpointing at intervals, manual checkpoints, and
 * checkpoint comparison/diff.
 *
 * Usage:
 *   const checkpoint = new SessionCheckpoint({ autoCheckpointEnabled: true });
 *   await checkpoint.createCheckpoint('ses_123', 'before-experiment');
 *   const restored = await checkpoint.restoreCheckpoint('cp_abc');
 */

import { v4 as uuidv4 } from 'uuid';

export interface CheckpointConfig {
  autoCheckpointEnabled: boolean;
  autoCheckpointIntervalMs: number;
  maxCheckpointsPerSession: number;
  compressionEnabled: boolean;
}

export interface SessionData {
  messages: Array<{ role: string; content: string; timestamp: string }>;
  memory: Array<{ id: string; content: string; keywords: string[] }>;
  config: Record<string, unknown>;
  toolState: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface Checkpoint {
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

export interface CheckpointDiff {
  checkpoint1Id: string;
  checkpoint2Id: string;
  added: string[];
  removed: string[];
  modified: string[];
  unchanged: string[];
}

export interface CheckpointExport {
  checkpoint: Checkpoint;
  exportedAt: string;
  format: 'json' | 'compressed';
}

export interface CheckpointStats {
  totalCheckpoints: number;
  totalSize: number;
  sessions: number;
  oldestCheckpoint: string | null;
  newestCheckpoint: string | null;
  checkpointsBySession: Record<string, number>;
}

const DEFAULT_CONFIG: CheckpointConfig = {
  autoCheckpointEnabled: false,
  autoCheckpointIntervalMs: 300_000, // 5 minutes
  maxCheckpointsPerSession: 50,
  compressionEnabled: false,
};

export class SessionCheckpoint {
  private config: CheckpointConfig;
  private checkpoints = new Map<string, Checkpoint>();
  private sessionData = new Map<string, SessionData>();
  private sessionCounters = new Map<string, number>();
  private autoTimers = new Map<string, ReturnType<typeof setInterval>>();

  constructor(config?: Partial<CheckpointConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Registers session data for checkpointing.
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
   * Creates a manual checkpoint.
   */
  createCheckpoint(
    sessionId: string,
    label?: string,
    description?: string,
    tags: string[] = [],
  ): Checkpoint {
    const data = this.sessionData.get(sessionId);
    if (!data) {
      throw new Error(`Session "${sessionId}" not found.`);
    }

    const number = (this.sessionCounters.get(sessionId) ?? 0) + 1;
    this.sessionCounters.set(sessionId, number);

    const id = `cp-${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString();
    const serialized = JSON.stringify(data);

    const checkpoint: Checkpoint = {
      id,
      sessionId,
      number,
      label: label ?? `Checkpoint ${number}`,
      description: description ?? '',
      data: JSON.parse(serialized), // Deep copy
      createdAt: now,
      size: serialized.length,
      tags,
    };

    this.checkpoints.set(id, checkpoint);
    this.enforceLimit(sessionId);

    return checkpoint;
  }

  /**
   * Creates an auto-checkpoint if enabled.
   */
  autoCheckpoint(sessionId: string): Checkpoint | null {
    if (!this.config.autoCheckpointEnabled) return null;
    return this.createCheckpoint(sessionId, `Auto-checkpoint`);
  }

  /**
   * Starts auto-checkpointing for a session.
   */
  startAutoCheckpoint(sessionId: string): boolean {
    if (!this.config.autoCheckpointEnabled) return false;
    if (this.autoTimers.has(sessionId)) return false;

    const timer = setInterval(() => {
      this.autoCheckpoint(sessionId);
    }, this.config.autoCheckpointIntervalMs);

    this.autoTimers.set(sessionId, timer);
    return true;
  }

  /**
   * Stops auto-checkpointing for a session.
   */
  stopAutoCheckpoint(sessionId: string): boolean {
    const timer = this.autoTimers.get(sessionId);
    if (!timer) return false;

    clearInterval(timer);
    this.autoTimers.delete(sessionId);
    return true;
  }

  /**
   * Gets a specific checkpoint.
   */
  getCheckpoint(checkpointId: string): Checkpoint | null {
    return this.checkpoints.get(checkpointId) ?? null;
  }

  /**
   * Lists checkpoints for a session.
   */
  listCheckpoints(
    sessionId: string,
    filter?: { tags?: string[]; limit?: number; offset?: number },
  ): Checkpoint[] {
    let results = Array.from(this.checkpoints.values())
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
   * Deletes a checkpoint.
   */
  deleteCheckpoint(checkpointId: string): boolean {
    return this.checkpoints.delete(checkpointId);
  }

  /**
   * Restores session to a specific checkpoint.
   */
  restoreCheckpoint(checkpointId: string): SessionData | null {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) return null;

    const restored = JSON.parse(JSON.stringify(checkpoint.data)); // Deep copy
    this.sessionData.set(checkpoint.sessionId, restored);
    return restored;
  }

  /**
   * Compares two checkpoints.
   */
  diffCheckpoints(id1: string, id2: string): CheckpointDiff {
    const cp1 = this.checkpoints.get(id1);
    const cp2 = this.checkpoints.get(id2);

    if (!cp1 || !cp2) {
      throw new Error('One or both checkpoints not found.');
    }

    const fields1 = this.flattenObject(cp1.data);
    const fields2 = this.flattenObject(cp2.data);

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

    return { checkpoint1Id: id1, checkpoint2Id: id2, added, removed, modified, unchanged };
  }

  /**
   * Exports a checkpoint.
   */
  exportCheckpoint(checkpointId: string, format: 'json' | 'compressed' = 'json'): CheckpointExport | null {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) return null;

    return {
      checkpoint: JSON.parse(JSON.stringify(checkpoint)),
      exportedAt: new Date().toISOString(),
      format,
    };
  }

  /**
   * Imports a checkpoint from export.
   */
  importCheckpoint(data: CheckpointExport): Checkpoint {
    const checkpoint = { ...data.checkpoint };
    this.checkpoints.set(checkpoint.id, checkpoint);
    this.sessionData.set(checkpoint.sessionId, checkpoint.data);
    return checkpoint;
  }

  /**
   * Gets checkpoint configuration.
   */
  getConfig(): CheckpointConfig {
    return { ...this.config };
  }

  /**
   * Updates checkpoint configuration.
   */
  setConfig(config: Partial<CheckpointConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Gets statistics.
   */
  getStats(sessionId?: string): CheckpointStats {
    let checkpoints = Array.from(this.checkpoints.values());

    if (sessionId) {
      checkpoints = checkpoints.filter((c) => c.sessionId === sessionId);
    }

    const sessions = new Set(checkpoints.map((c) => c.sessionId));
    const checkpointsBySession: Record<string, number> = {};

    for (const cp of checkpoints) {
      checkpointsBySession[cp.sessionId] = (checkpointsBySession[cp.sessionId] ?? 0) + 1;
    }

    const sorted = checkpoints.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    return {
      totalCheckpoints: checkpoints.length,
      totalSize: checkpoints.reduce((sum, cp) => sum + cp.size, 0),
      sessions: sessions.size,
      oldestCheckpoint: sorted[0]?.createdAt ?? null,
      newestCheckpoint: sorted[sorted.length - 1]?.createdAt ?? null,
      checkpointsBySession,
    };
  }

  /**
   * Stops all auto-checkpoints.
   */
  destroy(): void {
    for (const timer of this.autoTimers.values()) {
      clearInterval(timer);
    }
    this.autoTimers.clear();
  }

  private enforceLimit(sessionId: string): void {
    const checkpoints = this.listCheckpoints(sessionId);
    if (checkpoints.length > this.config.maxCheckpointsPerSession) {
      const toDelete = checkpoints.slice(0, checkpoints.length - this.config.maxCheckpointsPerSession);
      for (const cp of toDelete) {
        this.checkpoints.delete(cp.id);
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
