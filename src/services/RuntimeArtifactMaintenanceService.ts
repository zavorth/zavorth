import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';

export type RuntimeArtifactCleanupSummary = {
  deletedEntries: number;
  freedBytes: number;
};

type RuntimeArtifactMaintenanceOptions = {
  visualSmokeRoot?: string;
  visualSmokeTtlMs?: number;
  visualSmokeMaxBytes?: number;
};

type DirectoryEntrySnapshot = {
  absolutePath: string;
  modifiedAtMs: number;
  sizeBytes: number;
};

export class RuntimeArtifactMaintenanceService {
  private readonly visualSmokeRoot: string;
  private readonly visualSmokeTtlMs: number;
  private readonly visualSmokeMaxBytes: number;

  constructor(options: RuntimeArtifactMaintenanceOptions = {}) {
    this.visualSmokeRoot = options.visualSmokeRoot || path.resolve(config.projectRoot, 'data', 'runtime', 'visual-smoke');
    this.visualSmokeTtlMs = Number(options.visualSmokeTtlMs || config.visualSmokeTtlMs || 24 * 60 * 60 * 1000);
    this.visualSmokeMaxBytes = Number(options.visualSmokeMaxBytes || config.visualSmokeMaxBytes || 1024 * 1024 * 1024);
  }

  public cleanupVisualSmokeProfiles(): RuntimeArtifactCleanupSummary {
    if (!fs.existsSync(this.visualSmokeRoot)) {
      return { deletedEntries: 0, freedBytes: 0 };
    }

    const now = Date.now();
    const staleEntries = this.collectDirectoryEntries()
      .sort((left, right) => left.modifiedAtMs - right.modifiedAtMs);

    let deletedEntries = 0;
    let freedBytes = 0;

    for (const entry of staleEntries) {
      if (now - entry.modifiedAtMs <= this.visualSmokeTtlMs) {
        continue;
      }
      if (this.tryRemoveDirectory(entry.absolutePath)) {
        deletedEntries += 1;
        freedBytes += entry.sizeBytes;
      }
    }

    const remaining = this.collectDirectoryEntries()
      .sort((left, right) => left.modifiedAtMs - right.modifiedAtMs);
    let totalBytes = remaining.reduce((sum, entry) => sum + entry.sizeBytes, 0);

    for (const entry of remaining) {
      if (totalBytes <= this.visualSmokeMaxBytes) {
        break;
      }
      if (this.tryRemoveDirectory(entry.absolutePath)) {
        deletedEntries += 1;
        freedBytes += entry.sizeBytes;
        totalBytes -= entry.sizeBytes;
      }
    }

    return { deletedEntries, freedBytes };
  }

  private collectDirectoryEntries(): DirectoryEntrySnapshot[] {
    return fs.readdirSync(this.visualSmokeRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const absolutePath = path.join(this.visualSmokeRoot, entry.name);
        const stats = fs.statSync(absolutePath);
        return {
          absolutePath,
          modifiedAtMs: stats.mtimeMs,
          sizeBytes: this.calculateDirectorySize(absolutePath),
        };
      });
  }

  private calculateDirectorySize(targetPath: string): number {
    if (!fs.existsSync(targetPath)) {
      return 0;
    }

    const stats = fs.statSync(targetPath);
    if (!stats.isDirectory()) {
      return stats.size;
    }

    return fs.readdirSync(targetPath).reduce((sum, entry) => {
      return sum + this.calculateDirectorySize(path.join(targetPath, entry));
    }, 0);
  }

  private tryRemoveDirectory(targetPath: string): boolean {
    try {
      fs.rmSync(targetPath, { recursive: true, force: true });
      return true;
    } catch (error) { logger.warn('[Runtime Artifact Maintenance] filesystem operation failed', error); return false; }
  }
}
