import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type { WatchModeSnapshot } from './ComputerUseWatchModeService.js';
import { logger } from '../logger.js';

type ComputerUseWatchModeStateFileRuntime = {
  now?: () => Date;
  projectRoot?: string;
  snapshotFile?: string;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
};

type WatchModeStateDocument = {
  version: number;
  updatedAt: string | null;
  snapshot: WatchModeSnapshot | null;
};

export class ComputerUseWatchModeStateFileService {
  private readonly now: () => Date;
  private readonly snapshotFile: string;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly readFileSyncImpl: typeof fs.readFileSync;
  private readonly writeFileSyncImpl: typeof fs.writeFileSync;
  private readonly mkdirSyncImpl: typeof fs.mkdirSync;

  constructor(runtime: ComputerUseWatchModeStateFileRuntime = {}) {
    const projectRoot = runtime.projectRoot || config.projectRoot;
    this.now = runtime.now || (() => new Date());
    this.snapshotFile = runtime.snapshotFile || path.join(projectRoot, 'data', 'runtime', 'watch-mode-state.json');
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSyncImpl = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSyncImpl = runtime.mkdirSync || fs.mkdirSync.bind(fs);
  }

  public readSnapshot(): WatchModeSnapshot | null {
    try {
      if (!this.existsSyncImpl(this.snapshotFile)) {
        return null;
      }
      const parsed = JSON.parse(this.readFileSyncImpl(this.snapshotFile, 'utf8')) as WatchModeStateDocument | WatchModeSnapshot;
      if (parsed && typeof parsed === 'object' && 'snapshot' in parsed) {
        return (parsed as WatchModeStateDocument).snapshot || null;
      }
      return (parsed as WatchModeSnapshot) || null;
    } catch (error) { logger.warn('[Computer Use Watch Mode State File] JSON parse failed', error); return null; }
  }

  public saveSnapshot(snapshot: WatchModeSnapshot): WatchModeSnapshot {
    const document: WatchModeStateDocument = {
      version: 1,
      updatedAt: this.now().toISOString(),
      snapshot,
    };
    this.mkdirSyncImpl(path.dirname(this.snapshotFile), { recursive: true });
    this.writeFileSyncImpl(this.snapshotFile, JSON.stringify(document, null, 2), 'utf8');
    return snapshot;
  }
}
