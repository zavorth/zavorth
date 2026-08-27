import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import * as os from 'node:os';

export interface FileBlobRecord {
  readonly filePath: string;
  readonly blobHash: string;
  readonly byteSize: number;
  readonly timestamp: number;
}

export interface CheckpointManifest {
  readonly checkpointId: string;
  readonly projectRoot: string;
  readonly description: string;
  readonly createdAt: number;
  readonly entries: readonly FileBlobRecord[];
}

export interface CheckpointSummary {
  readonly checkpointId: string;
  readonly description: string;
  readonly createdAt: number;
  readonly fileCount: number;
  readonly files: readonly string[];
}

export interface CheckpointRollbackResult {
  readonly success: boolean;
  readonly checkpointId: string;
  readonly restoredFiles: readonly string[];
  readonly skippedFiles: readonly string[];
  readonly errors: readonly string[];
}

export interface FileDiffSummary {
  readonly filePath: string;
  readonly previousHash: string;
  readonly currentHash: string | null;
  readonly status: 'modified' | 'deleted' | 'identical';
}

export class ShadowCheckpointStoreService {
  private readonly storeRoot: string;
  private readonly projectRoot: string;

  constructor(options: { storeRoot?: string; projectRoot?: string } = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.storeRoot = options.storeRoot || this.resolveDefaultStorePath(this.projectRoot);
    this.ensureDirectoryStructure();
  }

  public createCheckpoint(
    filePaths: readonly string[],
    description = 'Pre-mutation shadow checkpoint'
  ): CheckpointManifest {
    const timestamp = Date.now();
    const checkpointId = `ckpt-${timestamp}-${crypto.randomBytes(4).toString('hex')}`;
    const entries: FileBlobRecord[] = [];

    for (const filePath of filePaths) {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(this.projectRoot, filePath);

      if (!fs.existsSync(absolutePath)) {
        continue;
      }

      try {
        const stats = fs.statSync(absolutePath);
        if (!stats.isFile()) {
          continue;
        }

        const content = fs.readFileSync(absolutePath);
        const blobHash = this.computeSha256(content);
        const relativePath = path.relative(this.projectRoot, absolutePath);

        this.writeBlob(blobHash, content);

        entries.push({
          filePath: relativePath,
          blobHash,
          byteSize: content.length,
          timestamp,
        });
      } catch (error: unknown) {
        // Skip unreadable files gracefully without crashing
      }
    }

    const manifest: CheckpointManifest = {
      checkpointId,
      projectRoot: this.projectRoot,
      description,
      createdAt: timestamp,
      entries,
    };

    this.writeManifest(manifest);
    return manifest;
  }

  public rollbackCheckpoint(
    checkpointId: string,
    targetFilePaths?: readonly string[]
  ): CheckpointRollbackResult {
    const manifest = this.readManifest(checkpointId);
    if (!manifest) {
      return {
        success: false,
        checkpointId,
        restoredFiles: [],
        skippedFiles: [],
        errors: [`Checkpoint manifest '${checkpointId}' not found.`],
      };
    }

    const targetFilter = targetFilePaths
      ? new Set(targetFilePaths.map((p) => (path.isAbsolute(p) ? path.relative(this.projectRoot, p) : p)))
      : null;

    const restoredFiles: string[] = [];
    const skippedFiles: string[] = [];
    const errors: string[] = [];

    for (const entry of manifest.entries) {
      if (targetFilter && !targetFilter.has(entry.filePath)) {
        skippedFiles.push(entry.filePath);
        continue;
      }

      const absolutePath = path.resolve(this.projectRoot, entry.filePath);
      const blobContent = this.readBlob(entry.blobHash);

      if (!blobContent) {
        errors.push(`Blob '${entry.blobHash}' missing for '${entry.filePath}'.`);
        continue;
      }

      try {
        const parentDir = path.dirname(absolutePath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
        fs.writeFileSync(absolutePath, blobContent);
        restoredFiles.push(entry.filePath);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Failed to restore '${entry.filePath}': ${message}`);
      }
    }

    return {
      success: errors.length === 0,
      checkpointId,
      restoredFiles,
      skippedFiles,
      errors,
    };
  }

  public rollbackLastCheckpoint(): CheckpointRollbackResult {
    const checkpoints = this.listCheckpoints(1);
    if (checkpoints.length === 0) {
      return {
        success: false,
        checkpointId: 'none',
        restoredFiles: [],
        skippedFiles: [],
        errors: ['No checkpoints available to rollback.'],
      };
    }
    return this.rollbackCheckpoint(checkpoints[0].checkpointId);
  }

  public listCheckpoints(limit = 20): readonly CheckpointSummary[] {
    const manifestsDir = path.join(this.storeRoot, 'manifests');
    if (!fs.existsSync(manifestsDir)) {
      return [];
    }

    try {
      const files = fs.readdirSync(manifestsDir);
      const summaries: CheckpointSummary[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const manifestPath = path.join(manifestsDir, file);
        try {
          const raw = fs.readFileSync(manifestPath, 'utf8');
          const manifest: CheckpointManifest = JSON.parse(raw);
          summaries.push({
            checkpointId: manifest.checkpointId,
            description: manifest.description,
            createdAt: manifest.createdAt,
            fileCount: manifest.entries.length,
            files: manifest.entries.map((e) => e.filePath),
          });
        } catch {
          // Skip malformed manifest files
        }
      }

      return summaries
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit);
    } catch {
      return [];
    }
  }

  public getDiff(checkpointId: string): readonly FileDiffSummary[] {
    const manifest = this.readManifest(checkpointId);
    if (!manifest) {
      return [];
    }

    const diffs: FileDiffSummary[] = [];

    for (const entry of manifest.entries) {
      const absolutePath = path.resolve(this.projectRoot, entry.filePath);
      if (!fs.existsSync(absolutePath)) {
        diffs.push({
          filePath: entry.filePath,
          previousHash: entry.blobHash,
          currentHash: null,
          status: 'deleted',
        });
        continue;
      }

      try {
        const currentContent = fs.readFileSync(absolutePath);
        const currentHash = this.computeSha256(currentContent);
        diffs.push({
          filePath: entry.filePath,
          previousHash: entry.blobHash,
          currentHash,
          status: currentHash === entry.blobHash ? 'identical' : 'modified',
        });
      } catch {
        // Skip unreadable files
      }
    }

    return diffs;
  }

  private writeBlob(hash: string, content: Buffer): void {
    const blobsDir = path.join(this.storeRoot, 'blobs');
    const prefix = hash.slice(0, 2);
    const subDir = path.join(blobsDir, prefix);
    if (!fs.existsSync(subDir)) {
      fs.mkdirSync(subDir, { recursive: true });
    }
    const blobPath = path.join(subDir, hash);
    if (!fs.existsSync(blobPath)) {
      fs.writeFileSync(blobPath, content);
    }
  }

  private readBlob(hash: string): Buffer | null {
    const prefix = hash.slice(0, 2);
    const blobPath = path.join(this.storeRoot, 'blobs', prefix, hash);
    if (!fs.existsSync(blobPath)) {
      return null;
    }
    try {
      return fs.readFileSync(blobPath);
    } catch {
      return null;
    }
  }

  private writeManifest(manifest: CheckpointManifest): void {
    const manifestsDir = path.join(this.storeRoot, 'manifests');
    if (!fs.existsSync(manifestsDir)) {
      fs.mkdirSync(manifestsDir, { recursive: true });
    }
    const manifestPath = path.join(manifestsDir, `${manifest.checkpointId}.json`);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  }

  private readManifest(checkpointId: string): CheckpointManifest | null {
    const manifestPath = path.join(this.storeRoot, 'manifests', `${checkpointId}.json`);
    if (!fs.existsSync(manifestPath)) {
      return null;
    }
    try {
      const raw = fs.readFileSync(manifestPath, 'utf8');
      return JSON.parse(raw) as CheckpointManifest;
    } catch {
      return null;
    }
  }

  private ensureDirectoryStructure(): void {
    const blobsDir = path.join(this.storeRoot, 'blobs');
    const manifestsDir = path.join(this.storeRoot, 'manifests');
    if (!fs.existsSync(blobsDir)) {
      fs.mkdirSync(blobsDir, { recursive: true });
    }
    if (!fs.existsSync(manifestsDir)) {
      fs.mkdirSync(manifestsDir, { recursive: true });
    }
  }

  private resolveDefaultStorePath(projectRoot: string): string {
    const projectSlug = crypto
      .createHash('sha256')
      .update(path.resolve(projectRoot))
      .digest('hex')
      .slice(0, 16);
    return path.join(os.homedir(), '.zavorth', 'checkpoints', projectSlug);
  }

  private computeSha256(content: Buffer | string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
