import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import { ShadowCheckpointStoreService } from './ShadowCheckpointStoreService.js';

export interface FileSnapshotEntry {
  readonly filePath: string;
  readonly originalContent: string;
  readonly sha256Checksum: string;
  readonly timestamp: number;
}

export interface ShadowSnapshotRecord {
  readonly snapshotId: string;
  readonly description: string;
  readonly createdAt: number;
  readonly entries: Map<string, FileSnapshotEntry>;
}

export interface RollbackResult {
  readonly success: boolean;
  readonly snapshotId: string;
  readonly restoredFiles: readonly string[];
  readonly skippedFiles: readonly string[];
  readonly errors: readonly string[];
}

export class ZavorthSnapshotRollbackService {
  private readonly snapshots = new Map<string, ShadowSnapshotRecord>();
  private readonly persistentStore: ShadowCheckpointStoreService;

  constructor(persistentStore?: ShadowCheckpointStoreService) {
    this.persistentStore = persistentStore || new ShadowCheckpointStoreService();
  }

  public createSnapshot(
    snapshotId: string,
    filePaths: readonly string[],
    description = 'Pre-mutation shadow snapshot'
  ): ShadowSnapshotRecord {
    const entries = new Map<string, FileSnapshotEntry>();

    for (const filePath of filePaths) {
      try {
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          const checksum = this.computeSha256(content);
          entries.set(filePath, {
            filePath,
            originalContent: content,
            sha256Checksum: checksum,
            timestamp: Date.now(),
          });
        }
      } catch {
        // Fail-safe skip on unreadable files
      }
    }

    const record: ShadowSnapshotRecord = {
      snapshotId,
      description,
      createdAt: Date.now(),
      entries,
    };

    this.snapshots.set(snapshotId, record);
    this.persistentStore.createCheckpoint(filePaths, description);

    return record;
  }

  public rollbackSpecificFiles(snapshotId: string, targetFilePaths: readonly string[]): RollbackResult {
    const record = this.snapshots.get(snapshotId);
    if (!record) {
      const diskResult = this.persistentStore.rollbackCheckpoint(snapshotId, targetFilePaths);
      if (diskResult.success) {
        return {
          success: true,
          snapshotId,
          restoredFiles: diskResult.restoredFiles,
          skippedFiles: diskResult.skippedFiles,
          errors: diskResult.errors,
        };
      }

      return {
        success: false,
        snapshotId,
        restoredFiles: [],
        skippedFiles: [...targetFilePaths],
        errors: [`Snapshot "${snapshotId}" not found.`],
      };
    }

    const restored: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    for (const filePath of targetFilePaths) {
      const entry = record.entries.get(filePath);
      if (!entry) {
        skipped.push(filePath);
        continue;
      }

      try {
        fs.writeFileSync(filePath, entry.originalContent, 'utf8');
        restored.push(filePath);
      } catch (err) {
        errors.push(`Failed to restore file ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return {
      success: errors.length === 0,
      snapshotId,
      restoredFiles: restored,
      skippedFiles: skipped,
      errors,
    };
  }

  public getSnapshot(snapshotId: string): ShadowSnapshotRecord | null {
    return this.snapshots.get(snapshotId) ?? null;
  }

  public removeSnapshot(snapshotId: string): boolean {
    return this.snapshots.delete(snapshotId);
  }

  public computeSha256(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }

  public getPersistentStore(): ShadowCheckpointStoreService {
    return this.persistentStore;
  }
}
