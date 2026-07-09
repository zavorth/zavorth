import { logger } from '../../logger.js';
/**
 * CheckpointStorage — File-based storage for session checkpoints.
 *
 * Stores checkpoints as JSON files with metadata index for fast lookup.
 * Supports compression, integrity verification, and cleanup.
 *
 * Usage:
 *   const storage = new CheckpointStorage({ basePath: '.zavorth/checkpoints' });
 *   await storage.saveCheckpoint(checkpoint);
 *   const loaded = await storage.loadCheckpoint('cp_abc');
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface StorageConfig {
  basePath: string;
  compressionEnabled: boolean;
  maxFileSize: number;
}

export interface CheckpointMetadata {
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
  totalCheckpoints: number;
  totalSize: number;
  sessions: number;
  oldestCheckpoint: string | null;
  newestCheckpoint: string | null;
}

export interface CheckpointData {
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
  basePath: '.zavorth/checkpoints',
  compressionEnabled: false,
  maxFileSize: 10 * 1024 * 1024, // 10MB
};

export class CheckpointStorage {
  private config: StorageConfig;
  private metadataIndex = new Map<string, CheckpointMetadata>();
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
   * Saves a checkpoint to disk.
   */
  async saveCheckpoint(checkpoint: CheckpointData): Promise<CheckpointMetadata> {
    await this.initialize();

    const dataPath = this.getCheckpointDataPath(checkpoint.id);
    const metaPath = this.getCheckpointMetaPath(checkpoint.id);

    // Save data
    const dataContent = JSON.stringify(checkpoint, null, 2);
    fs.writeFileSync(dataPath, dataContent, 'utf-8');

    // Calculate checksum
    const checksum = crypto.createHash('sha256').update(dataContent).digest('hex');

    // Save metadata
    const metadata: CheckpointMetadata = {
      id: checkpoint.id,
      sessionId: checkpoint.sessionId,
      number: checkpoint.number,
      label: checkpoint.label,
      size: dataContent.length,
      checksum,
      filePath: dataPath,
      createdAt: checkpoint.createdAt,
    };

    fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');
    this.metadataIndex.set(checkpoint.id, metadata);

    return metadata;
  }

  /**
   * Loads a checkpoint from disk.
   */
  async loadCheckpoint(checkpointId: string): Promise<CheckpointData | null> {
    await this.initialize();

    const metadata = this.metadataIndex.get(checkpointId);
    if (!metadata) return null;

    try {
      const content = fs.readFileSync(metadata.filePath, 'utf-8');

      // Verify checksum
      const checksum = crypto.createHash('sha256').update(content).digest('hex');
      if (checksum !== metadata.checksum) {
        logger.warn(`Checksum mismatch for checkpoint ${checkpointId}`);
      }

      return JSON.parse(content) as CheckpointData;
    } catch (error: unknown) {return null;
    }
  }

  /**
   * Deletes a checkpoint.
   */
  async deleteCheckpoint(checkpointId: string): Promise<boolean> {
    await this.initialize();

    const metadata = this.metadataIndex.get(checkpointId);
    if (!metadata) return false;

    try {
      if (fs.existsSync(metadata.filePath)) {
        fs.unlinkSync(metadata.filePath);
      }

      const metaPath = this.getCheckpointMetaPath(checkpointId);
      if (fs.existsSync(metaPath)) {
        fs.unlinkSync(metaPath);
      }

      this.metadataIndex.delete(checkpointId);
      return true;
    } catch (error: unknown) {return false;
    }
  }

  /**
   * Lists checkpoint metadata.
   */
  async listMetadata(sessionId?: string): Promise<CheckpointMetadata[]> {
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
  async getMetadata(checkpointId: string): Promise<CheckpointMetadata | null> {
    await this.initialize();
    return this.metadataIndex.get(checkpointId) ?? null;
  }

  /**
   * Cleans up old checkpoints beyond the limit.
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
      if (await this.deleteCheckpoint(entry.id)) {
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
      totalCheckpoints: entries.length,
      totalSize: entries.reduce((sum, e) => sum + e.size, 0),
      sessions: sessions.size,
      oldestCheckpoint: sorted[0]?.createdAt ?? null,
      newestCheckpoint: sorted[sorted.length - 1]?.createdAt ?? null,
    };
  }

  /**
   * Verifies checkpoint integrity.
   */
  async verifyIntegrity(checkpointId: string): Promise<boolean> {
    await this.initialize();

    const metadata = this.metadataIndex.get(checkpointId);
    if (!metadata) return false;

    try {
      const content = fs.readFileSync(metadata.filePath, 'utf-8');
      const checksum = crypto.createHash('sha256').update(content).digest('hex');
      return checksum === metadata.checksum;
    } catch (error: unknown) {return false;
    }
  }

  /**
   * Exports checkpoint as JSON.
   */
  async exportCheckpoint(checkpointId: string): Promise<string | null> {
    const checkpoint = await this.loadCheckpoint(checkpointId);
    if (!checkpoint) return null;

    return JSON.stringify({
      checkpoint,
      exportedAt: new Date().toISOString(),
      format: 'json',
    }, null, 2);
  }

  /**
   * Imports checkpoint from export.
   */
  async importCheckpoint(data: string): Promise<CheckpointData | null> {
    try {
      const imported = JSON.parse(data);
      const checkpoint = imported.checkpoint as CheckpointData;
      await this.saveCheckpoint(checkpoint);
      return checkpoint;
    } catch (error: unknown) {return null;
    }
  }

  private getCheckpointDataPath(checkpointId: string): string {
    return path.join(this.config.basePath, 'data', `${checkpointId}.json`);
  }

  private getCheckpointMetaPath(checkpointId: string): string {
    return path.join(this.config.basePath, 'metadata', `${checkpointId}.json`);
  }

  private async loadMetadataIndex(): Promise<void> {
    const metaDir = path.join(this.config.basePath, 'metadata');
    if (!fs.existsSync(metaDir)) return;

    const files = fs.readdirSync(metaDir).filter((f) => f.endsWith('.json'));

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(metaDir, file), 'utf-8');
        const metadata = JSON.parse(content) as CheckpointMetadata;
        this.metadataIndex.set(metadata.id, metadata);
      } catch (error: unknown) {// Skip corrupted metadata files
      }
    }
  }
}
