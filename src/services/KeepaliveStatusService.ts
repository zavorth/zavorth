import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';

export type KeepaliveProcessSnapshot = {
  name: string;
  ready: boolean;
  lastCheckAt: string | null;
  lastStartAt: string | null;
  lastReadyAt: string | null;
  lastError: string | null;
  restarts: number;
};

export type KeepaliveStatusSnapshot = {
  ok: boolean;
  updatedAt: string | null;
  intervalMs: number | null;
  nodeHostId: string | null;
  notes: string[];
  stale: boolean;
  summary: {
    total: number;
    ready: number;
    unhealthy: number;
    restarts: number;
  };
  processes: KeepaliveProcessSnapshot[];
};

type KeepaliveStatusRuntime = {
  now?: () => Date;
  snapshotFilePath?: string;
  staleAfterMs?: number;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
};

export class KeepaliveStatusService {
  private readonly now: () => Date;
  private readonly snapshotFilePath: string;
  private readonly staleAfterMs: number;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;

  constructor(runtime: KeepaliveStatusRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.snapshotFilePath =
      runtime.snapshotFilePath
      || path.resolve(config.projectRoot, 'data', 'runtime', 'ops-remote-keepalive.json');
    this.staleAfterMs = Number(runtime.staleAfterMs || (5 * 60 * 1000)) || (5 * 60 * 1000);
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
  }

  public readSnapshot(): KeepaliveStatusSnapshot | null {
    try {
      if (!this.existsSync(this.snapshotFilePath)) {
        return null;
      }
      const parsed = JSON.parse(this.readFileSync(this.snapshotFilePath, 'utf8')) as Record<string, any>;
      const processEntries = parsed?.processes && typeof parsed.processes === 'object'
        ? Object.entries(parsed.processes)
        : [];
      const processes = processEntries.map(([name, raw]) => this.normalizeProcess(name, raw));
      const updatedAt = this.nullableText(parsed?.updatedAt);
      const stale = this.isStale(updatedAt);
      return {
        ok: parsed?.ok === true && !stale && processes.every((entry) => entry.ready),
        updatedAt,
        intervalMs: Number(parsed?.intervalMs || 0) || null,
        nodeHostId: this.nullableText(parsed?.nodeHostId),
        notes: Array.isArray(parsed?.notes)
          ? parsed.notes.map((entry: unknown) => this.text(entry)).filter(Boolean)
          : [],
        stale,
        summary: {
          total: processes.length,
          ready: processes.filter((entry) => entry.ready).length,
          unhealthy: processes.filter((entry) => !entry.ready).length,
          restarts: processes.reduce((total, entry) => total + entry.restarts, 0),
        },
        processes,
      };
    } catch (error: unknown) {logger.warn('[Keepalive Status] health check failed', error); return null; }
  }

  private normalizeProcess(name: string, raw: unknown): KeepaliveProcessSnapshot {
    const entry = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
    return {
      name: this.text(entry.name, name) || name,
      ready: entry.ready === true,
      lastCheckAt: this.nullableText(entry.lastCheckAt),
      lastStartAt: this.nullableText(entry.lastStartAt),
      lastReadyAt: this.nullableText(entry.lastReadyAt),
      lastError: this.nullableText(entry.lastError),
      restarts: Number(entry.restarts || 0) || 0,
    };
  }

  private isStale(updatedAt: string | null): boolean {
    if (!updatedAt) {
      return true;
    }
    const timestamp = Date.parse(updatedAt);
    if (!Number.isFinite(timestamp)) {
      return true;
    }
    return (this.now().getTime() - timestamp) > this.staleAfterMs;
  }

  private text(value: unknown, fallback = ''): string {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  }

  private nullableText(value: unknown): string | null {
    const normalized = this.text(value);
    return normalized || null;
  }
}
