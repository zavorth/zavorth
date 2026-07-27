import { logger } from '../../logger.js';
/**
 * SessionSnapshotStorage - File-based storage for session snapshots.
 *
 * Stores snapshots as JSON files with metadata index for fast lookup.
 * Supports compression, integrity verification, and cleanup.
 *
 * Usage:
 *   const storage = new SessionSnapshotStorage({ basePath: '.zavorth/snapshots' });
 *   await storage.saveSnapshot(snapshot);
 *   const loaded = await storage.loadSnapshot('cp_abc');
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface StorageConfig {
  basePath: string;
  compressionEnabled: boolean;
  maxFileSize: number;
}

export interface SessionSnapshotMetadata {
  id: string;
  sessionId: string;
  number: number;
  label: string;
  size: number;
  checksum: string;
  filePath: string;
  createdAt: string;
}

export interface StorageStats {
  totalSnapshots: number;
  totalSize: number;
  sessions: number;
  oldestSnapshot: string | null;
  newestSnapshot: string | null;
}

export interface SessionSnapshotData {
  id: string;
  sessionId: string;
  number: number;
  label: string;
  description: string;
  data: unknown;
  createdAt: string;
  size: number;
  tags: string[];
}

const DEFAULT_CONFIG: StorageConfig = {
  basePath: '.zavorth/snapshots',
  compressionEnabled: false,
  maxFileSize: 10 * 1024 * 1024, // 10MB
};

export class SessionSnapshotStorage {
  private config: StorageConfig;
  private metadataIndex = new Map<string, SessionSnapshotMetadata>();
  private initialized = false;

  constructor(config?: Partial<StorageConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initializes storage directories.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    fs.mkdirSync(this.config.basePath, { recursive: true });
    fs.mkdirSync(path.join(this.config.basePath, 'metadata'), { recursive: true });
    fs.mkdirSync(path.join(this.config.basePath, 'data'), { recursive: true });

    await this.loadMetadataIndex();
    this.initialized = true;
  }

  /**
   * Saves a snapshot to disk.
   */
  async saveSnapshot(snapshot: SessionSnapshotData): Promise<SessionSnapshotMetadata> {
    await this.initialize();

    const dataPath = this.getSessionSnapshotDataPath(snapshot.id);
    const metaPath = this.getSnapshotMetaPath(snapshot.id);

    // Save data
    const dataContent = JSON.stringify(snapshot, null, 2);
    fs.writeFileSync(dataPath, dataContent, 'utf-8');

    // Calculate checksum
    const checksum = crypto.createHash('sha256').update(dataContent).digest('hex');

    // Save metadata
    const metadata: SessionSnapshotMetadata = {
      id: snapshot.id,
      sessionId: snapshot.sessionId,
      number: snapshot.number,
      label: snapshot.label,
      size: dataContent.length,
      checksum,
      filePath: dataPath,
      createdAt: snapshot.createdAt,
    };

    fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');
    this.metadataIndex.set(snapshot.id, metadata);

    return metadata;
  }

  /**
   * Loads a snapshot from disk.
   */
  async loadSnapshot(snapshotId: string): Promise<SessionSnapshotData | null> {
    await this.initialize();

    const metadata = this.metadataIndex.get(snapshotId);
    if (!metadata) return null;

    try {
      const content = fs.readFileSync(metadata.filePath, 'utf-8');

      // Verify checksum
      const checksum = crypto.createHash('sha256').update(content).digest('hex');
      if (checksum !== metadata.checksum) {
        logger.warn(`Checksum mismatch for snapshot ${snapshotId}`);
      }

      return JSON.parse(content) as SessionSnapshotData;
    } catch (error: unknown) {return null;
    }
  }

  /**
   * Deletes a snapshot.
   */
  async deleteSnapshot(snapshotId: string): Promise<boolean> {
    await this.initialize();

    const metadata = this.metadataIndex.get(snapshotId);
    if (!metadata) return false;

    try {
      if (fs.existsSync(metadata.filePath)) {
        fs.unlinkSync(metadata.filePath);
      }

      const metaPath = this.getSnapshotMetaPath(snapshotId);
      if (fs.existsSync(metaPath)) {
        fs.unlinkSync(metaPath);
      }

      this.metadataIndex.delete(snapshotId);
      return true;
    } catch (error: unknown) {return false;
    }
  }

  /**
   * Lists snapshot metadata.
   */
  async listMetadata(sessionId?: string): Promise<SessionSnapshotMetadata[]> {
    await this.initialize();

    let entries = Array.from(this.metadataIndex.values());

    if (sessionId) {
      entries = entries.filter((e) => e.sessionId === sessionId);
    }

    return entries.sort((a, b) => a.number - b.number);
  }

  /**
   * Gets specific metadata.
   */
  async getMetadata(snapshotId: string): Promise<SessionSnapshotMetadata | null> {
    await this.initialize();
    return this.metadataIndex.get(snapshotId) ?? null;
  }

  /**
   * Cleans up old snapshots beyond the limit.
   */
  async cleanup(sessionId: string, maxCount: number): Promise<number> {
    await this.initialize();

    const entries = Array.from(this.metadataIndex.values())
      .filter((e) => e.sessionId === sessionId)
      .sort((a, b) => a.number - b.number);

    if (entries.length <= maxCount) return 0;

    const toDelete = entries.slice(0, entries.length - maxCount);
    let deleted = 0;

    for (const entry of toDelete) {
      if (await this.deleteSnapshot(entry.id)) {
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Gets storage statistics.
   */
  async getStats(): Promise<StorageStats> {
    await this.initialize();

    const entries = Array.from(this.metadataIndex.values());
    const sessions = new Set(entries.map((e) => e.sessionId));
    const sorted = entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    return {
      totalSnapshots: entries.length,
      totalSize: entries.reduce((sum, e) => sum + e.size, 0),
      sessions: sessions.size,
      oldestSnapshot: sorted[0]?.createdAt ?? null,
      newestSnapshot: sorted[sorted.length - 1]?.createdAt ?? null,
    };
  }

  /**
   * Verifies snapshot integrity.
   */
  async verifyIntegrity(snapshotId: string): Promise<boolean> {
    await this.initialize();

    const metadata = this.metadataIndex.get(snapshotId);
    if (!metadata) return false;

    try {
      const content = fs.readFileSync(metadata.filePath, 'utf-8');
      const checksum = crypto.createHash('sha256').update(content).digest('hex');
      return checksum === metadata.checksum;
    } catch (error: unknown) {return false;
    }
  }

  /**
   * Exports snapshot as JSON.
   */
  async exportSnapshot(snapshotId: string): Promise<string | null> {
    const snapshot = await this.loadSnapshot(snapshotId);
    if (!snapshot) return null;

    return JSON.stringify({
      snapshot,
      exportedAt: new Date().toISOString(),
      format: 'json',
    }, null, 2);
  }

  /**
   * Imports snapshot from export.
   */
  async importSnapshot(data: string): Promise<SessionSnapshotData | null> {
    try {
      const imported = JSON.parse(data);
      const snapshot = imported.snapshot as SessionSnapshotData;
      await this.saveSnapshot(snapshot);
      return snapshot;
    } catch (error: unknown) {return null;
    }
  }

  private getSessionSnapshotDataPath(snapshotId: string): string {
    return path.join(this.config.basePath, 'data', `${snapshotId}.json`);
  }

  private getSnapshotMetaPath(snapshotId: string): string {
    return path.join(this.config.basePath, 'metadata', `${snapshotId}.json`);
  }

  private async loadMetadataIndex(): Promise<void> {
    const metaDir = path.join(this.config.basePath, 'metadata');
    if (!fs.existsSync(metaDir)) return;

    const files = fs.readdirSync(metaDir).filter((f) => f.endsWith('.json'));

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(metaDir, file), 'utf-8');
        const metadata = JSON.parse(content) as SessionSnapshotMetadata;
        this.metadataIndex.set(metadata.id, metadata);
      } catch (error: unknown) {
        // Skip corrupted metadata files.
      }
    }
  }
}
