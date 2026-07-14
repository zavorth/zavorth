/**
 * Durable duplex session metadata (survives process restart for status/recovery messaging).
 * Live handlers stay in-memory only — media/agent state cannot fully resume after crash.
 */

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config/index.js';
import type { VoiceDuplexSessionSnapshot } from './VoiceRealtimeDuplexSession.js';

export type DurableDuplexRecord = {
  snapshot: VoiceDuplexSessionSnapshot;
  ownerUserId: string | null;
  savedAt: string;
  /** true when restored after process death without live handlers */
  orphaned?: boolean;
};

function storeEnabled(): boolean {
  const v = String(process.env.ZAVORTH_VOICE_DUPLEX_DURABLE || 'true').toLowerCase();
  return v !== '0' && v !== 'false' && v !== 'off';
}

function storePath(): string {
  const override = String(process.env.ZAVORTH_VOICE_DUPLEX_STORE_PATH || '').trim();
  if (override) return path.resolve(override);
  const root = path.resolve(config.projectRoot || process.cwd());
  return path.join(root, 'data', 'runtime', 'voice', 'duplex-sessions.json');
}

export class VoiceDuplexSessionStore {
  private readonly filePath: string;
  private readonly enabled: boolean;

  constructor(options: { filePath?: string; enabled?: boolean } = {}) {
    this.filePath = options.filePath || storePath();
    this.enabled =
      options.enabled ??
      (storeEnabled() && !(process.env.NODE_ENV === 'test' && !process.env.ZAVORTH_VOICE_DUPLEX_STORE_PATH));
  }

  public save(snapshot: VoiceDuplexSessionSnapshot, ownerUserId: string | null): void {
    if (!this.enabled) return;
    try {
      const all = this.readAll();
      all[snapshot.sessionId] = {
        snapshot,
        ownerUserId,
        savedAt: new Date().toISOString(),
        orphaned: false,
      };
      this.writeAll(all);
    } catch {
      // never break voice path
    }
  }

  public remove(sessionId: string): void {
    if (!this.enabled) return;
    try {
      const all = this.readAll();
      if (all[sessionId]) {
        delete all[sessionId];
        this.writeAll(all);
      }
    } catch {
      // ignore
    }
  }

  public get(sessionId: string): DurableDuplexRecord | null {
    if (!this.enabled) return null;
    try {
      return this.readAll()[sessionId] || null;
    } catch {
      return null;
    }
  }

  public list(): DurableDuplexRecord[] {
    if (!this.enabled) return [];
    try {
      return Object.values(this.readAll());
    } catch {
      return [];
    }
  }

  /** Mark all non-ended records as orphaned after boot (handlers gone). */
  public markOrphansOnBoot(): number {
    if (!this.enabled) return 0;
    try {
      const all = this.readAll();
      let n = 0;
      for (const id of Object.keys(all)) {
        const rec = all[id];
        if (rec.snapshot.phase !== 'ended') {
          rec.orphaned = true;
          rec.snapshot = {
            ...rec.snapshot,
            phase: 'error',
            lastError:
              'Voice session was interrupted by process restart. Start a new call.',
            updatedAt: new Date().toISOString(),
          };
          n += 1;
        }
      }
      if (n) this.writeAll(all);
      return n;
    } catch {
      return 0;
    }
  }

  private readAll(): Record<string, DurableDuplexRecord> {
    if (!fs.existsSync(this.filePath)) return {};
    const raw = fs.readFileSync(this.filePath, 'utf8');
    if (!raw.trim()) return {};
    const parsed = JSON.parse(raw) as Record<string, DurableDuplexRecord>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  }

  private writeAll(all: Record<string, DurableDuplexRecord>): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(all, null, 0), 'utf8');
    fs.renameSync(tmp, this.filePath);
  }
}

let defaultStore: VoiceDuplexSessionStore | null = null;

export function getVoiceDuplexSessionStore(): VoiceDuplexSessionStore {
  if (!defaultStore) {
    defaultStore = new VoiceDuplexSessionStore();
    defaultStore.markOrphansOnBoot();
  }
  return defaultStore;
}

export function resetVoiceDuplexSessionStoreForTests(): void {
  defaultStore = null;
}
