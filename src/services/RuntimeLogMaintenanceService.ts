import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';

type RuntimeLogMaintenanceOptions = {
  runtimeDir?: string;
  maxBytes?: number;
  maxFiles?: number;
  extensions?: string[];
};

export class RuntimeLogMaintenanceService {
  private readonly runtimeDir: string;
  private readonly maxBytes: number;
  private readonly maxFiles: number;
  private readonly extensions: Set<string>;

  constructor(options: RuntimeLogMaintenanceOptions = {}) {
    this.runtimeDir = options.runtimeDir || path.resolve(config.projectRoot, 'data', 'runtime');
    this.maxBytes = Number(options.maxBytes || config.runtimeLogRotationMaxBytes || 25 * 1024 * 1024);
    this.maxFiles = Number(options.maxFiles || config.runtimeLogRotationMaxFiles || 5);
    this.extensions = new Set((options.extensions || ['.log', '.jsonl']).map((entry) => String(entry).toLowerCase()));
  }

  public rotateOversizedLogs(): Array<{ file: string; rotated: boolean; sizeBytes: number }> {
    if (!fs.existsSync(this.runtimeDir)) {
      return [];
    }

    const results: Array<{ file: string; rotated: boolean; sizeBytes: number }> = [];
    for (const absolutePath of this.collectCandidateFiles(this.runtimeDir)) {
      const extension = path.extname(absolutePath).toLowerCase();
      if (!this.extensions.has(extension)) {
        continue;
      }

      const sizeBytes = fs.statSync(absolutePath).size;
      const rotated = sizeBytes > this.maxBytes ? this.rotateFile(absolutePath) : false;
      results.push({
        file: absolutePath,
        rotated,
        sizeBytes,
      });
    }

    return results;
  }

  private collectCandidateFiles(rootDir: string): string[] {
    const collected: string[] = [];
    for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
      const absolutePath = path.join(rootDir, entry.name);
      if (entry.isSymbolicLink()) {
        continue;
      }
      if (entry.isDirectory()) {
        collected.push(...this.collectCandidateFiles(absolutePath));
        continue;
      }
      if (entry.isFile()) {
        collected.push(absolutePath);
      }
    }
    return collected;
  }

  private rotateFile(targetPath: string): boolean {
    for (let index = this.maxFiles; index >= 1; index -= 1) {
      const current = `${targetPath}.${index}`;
      if (!fs.existsSync(current)) {
        continue;
      }
      if (index >= this.maxFiles) {
        fs.rmSync(current, { force: true });
        continue;
      }
      fs.renameSync(current, `${targetPath}.${index + 1}`);
    }

    fs.renameSync(targetPath, `${targetPath}.1`);
    fs.writeFileSync(targetPath, '', 'utf8');
    return true;
  }
}
