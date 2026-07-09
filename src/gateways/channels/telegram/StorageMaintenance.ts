import { logger } from '../../../logger.js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../../config/index.js';interface CleanupSummary {
  deletedFiles: number;
  freedBytes: number;
}

export class StorageMaintenance {
  private readonly videoContextDir = path.join(config.dataDir, 'video-contexts');
  private readonly ytdlpTmpDir = path.join(os.tmpdir(), 'zavorth-ytdlp');
  private readonly audioChunksTmpDir = path.join(os.tmpdir(), 'zavorth-audio-chunks');

  public run(): CleanupSummary {
    const summary: CleanupSummary = {
      deletedFiles: 0,
      freedBytes: 0,
    };

    const tempMaxAgeMs = Math.max(1, config.tempFileRetentionHours) * 60 * 60 * 1000;
    const contextMaxAgeMs = Math.max(1, config.videoContextRetentionDays) * 24 * 60 * 60 * 1000;

    this.cleanupDirectoryByAge(config.tmpDir, tempMaxAgeMs, summary);
    this.cleanupDirectoryByAge(this.ytdlpTmpDir, tempMaxAgeMs, summary);
    this.cleanupDirectoryByAge(this.audioChunksTmpDir, tempMaxAgeMs, summary);
    this.cleanupDirectoryByAge(this.videoContextDir, contextMaxAgeMs, summary);
    this.pruneDirectoryToAllowedFiles(config.tmpDir, new Set<string>(), summary);
    this.pruneDirectoryToAllowedFiles(this.audioChunksTmpDir, new Set<string>(), summary);
    this.pruneDirectoryToAllowedFiles(this.ytdlpTmpDir, new Set<string>(['ffmpeg.exe']), summary);
    this.enforceMaxFiles(this.videoContextDir, Math.max(10, config.videoContextMaxFiles), summary);

    return summary;
  }

  private cleanupDirectoryByAge(directoryPath: string, maxAgeMs: number, summary: CleanupSummary): void {
    if (!fs.existsSync(directoryPath)) {
      return;
    }

    const now = Date.now();
    const entries = fs.readdirSync(directoryPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        this.cleanupDirectoryByAge(fullPath, maxAgeMs, summary);
        this.removeIfEmpty(fullPath);
        continue;
      }

      try {
        const stats = fs.statSync(fullPath);
        if (now - stats.mtimeMs > maxAgeMs) {
          fs.unlinkSync(fullPath);
          summary.deletedFiles += 1;
          summary.freedBytes += stats.size;
        }
      } catch (error: unknown) {logger.warn(`[StorageMaintenance] Falha ao limpar ${fullPath}: ${error}`);
      }
    }
  }

  private enforceMaxFiles(directoryPath: string, maxFiles: number, summary: CleanupSummary): void {
    if (!fs.existsSync(directoryPath)) {
      return;
    }

    const files = fs.readdirSync(directoryPath)
      .map((entry) => path.join(directoryPath, entry))
      .filter((filePath) => fs.existsSync(filePath) && fs.statSync(filePath).isFile())
      .map((filePath) => ({
        filePath,
        stats: fs.statSync(filePath),
      }))
      .sort((left, right) => left.stats.mtimeMs - right.stats.mtimeMs);

    if (files.length <= maxFiles) {
      return;
    }

    const excessFiles = files.slice(0, files.length - maxFiles);
    for (const file of excessFiles) {
      try {
        fs.unlinkSync(file.filePath);
        summary.deletedFiles += 1;
        summary.freedBytes += file.stats.size;
      } catch (error: unknown) {logger.warn(`[StorageMaintenance] Falha ao remover contexto antigo ${file.filePath}: ${error}`);
      }
    }
  }

  private removeIfEmpty(directoryPath: string): void {
    try {
      if (fs.existsSync(directoryPath) && fs.readdirSync(directoryPath).length === 0) {
        fs.rmdirSync(directoryPath);
      }
    } catch (error: unknown) {logger.warn(`[StorageMaintenance] Falha ao remover pasta vazia ${directoryPath}: ${error}`);
    }
  }

  private pruneDirectoryToAllowedFiles(
    directoryPath: string,
    allowedNames: Set<string>,
    summary: CleanupSummary
  ): void {
    if (!fs.existsSync(directoryPath)) {
      return;
    }

    const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        this.removeDirectoryRecursively(fullPath, summary);
        continue;
      }

      if (allowedNames.has(entry.name)) {
        continue;
      }

      try {
        const stats = fs.statSync(fullPath);
        fs.unlinkSync(fullPath);
        summary.deletedFiles += 1;
        summary.freedBytes += stats.size;
      } catch (error: unknown) {logger.warn(`[StorageMaintenance] Falha ao podar ${fullPath}: ${error}`);
      }
    }
  }

  private removeDirectoryRecursively(directoryPath: string, summary: CleanupSummary): void {
    if (!fs.existsSync(directoryPath)) {
      return;
    }

    const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        this.removeDirectoryRecursively(fullPath, summary);
        continue;
      }

      try {
        const stats = fs.statSync(fullPath);
        fs.unlinkSync(fullPath);
        summary.deletedFiles += 1;
        summary.freedBytes += stats.size;
      } catch (error: unknown) {logger.warn(`[StorageMaintenance] Falha ao remover ${fullPath}: ${error}`);
      }
    }

    this.removeIfEmpty(directoryPath);
  }
}
