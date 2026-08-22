import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export type MemoryDraftCandidate = {
  id: string;
  userId: string;
  key: string;
  value: string;
  category: string;
  status: 'pending' | 'promoted' | 'forgotten';
  createdAt: string;
  updatedAt: string;
  source: 'auto-extract' | 'manual';
};

export type MemoryDraftStoreSnapshot = {
  generatedAt: string;
  version: 'memory-draft-store/v1';
  total: number;
  pending: number;
  promoted: number;
  forgotten: number;
  items: MemoryDraftCandidate[];
};

type StoreFile = {
  version: 'memory-draft-store/v1';
  items: MemoryDraftCandidate[];
};

const MAX_VALUE_CHARS = 1000;
const MAX_KEY_CHARS = 96;
const MAX_PENDING_PER_USER = 200;

export class MemoryDraftStoreService {
  private readonly storePath: string;
  private readonly now: () => Date;

  constructor(options: { projectRoot?: string; storePath?: string; now?: () => Date } = {}) {
    const projectRoot = options.projectRoot || process.cwd();
    this.storePath = options.storePath
      || path.join(projectRoot, 'data', 'runtime', 'memory-drafts.json');
    this.now = options.now || (() => new Date());
  }

  public list(userId?: string, status: MemoryDraftCandidate['status'] | 'all' = 'pending'): MemoryDraftCandidate[] {
    const items = this.read().items;
    return items.filter((item) => {
      if (userId && item.userId !== userId) return false;
      if (status !== 'all' && item.status !== status) return false;
      return true;
    });
  }

  public getById(id: string): MemoryDraftCandidate | null {
    return this.read().items.find((item) => item.id === id) || null;
  }

  public snapshot(userId?: string): MemoryDraftStoreSnapshot {
    const items = this.list(userId, 'all');
    return {
      generatedAt: this.now().toISOString(),
      version: 'memory-draft-store/v1',
      total: items.length,
      pending: items.filter((item) => item.status === 'pending').length,
      promoted: items.filter((item) => item.status === 'promoted').length,
      forgotten: items.filter((item) => item.status === 'forgotten').length,
      items: items.slice(0, 100),
    };
  }

  public addCandidates(input: {
    userId: string;
    candidates: Array<{ key: string; value: string; category: string }>;
    source?: MemoryDraftCandidate['source'];
  }): MemoryDraftCandidate[] {
    const store = this.read();
    const created: MemoryDraftCandidate[] = [];
    const stamp = this.now().toISOString();
    const pendingForUser = store.items.filter(
      (item) => item.userId === input.userId && item.status === 'pending',
    ).length;

    for (const candidate of input.candidates) {
      if (pendingForUser + created.length >= MAX_PENDING_PER_USER) break;
      const key = String(candidate.key || '').trim().toLowerCase().slice(0, MAX_KEY_CHARS);
      const value = sanitizeDraftValue(candidate.value);
      const category = String(candidate.category || 'general').trim().toLowerCase().slice(0, 64) || 'general';
      if (!key || !value) continue;
      if (looksLikeSecret(value)) continue;

      const existing = store.items.find((item) =>
        item.userId === input.userId
        && item.key === key
        && item.status === 'pending');
      if (existing) {
        existing.value = value;
        existing.category = category;
        existing.updatedAt = stamp;
        created.push(existing);
        continue;
      }

      const entry: MemoryDraftCandidate = {
        id: `mdraft_${crypto.randomBytes(6).toString('hex')}`,
        userId: input.userId,
        key,
        value,
        category,
        status: 'pending',
        createdAt: stamp,
        updatedAt: stamp,
        source: input.source || 'auto-extract',
      };
      store.items.unshift(entry);
      created.push(entry);
    }
    this.write(store);
    return created;
  }

  public promote(id: string, options: { actorUserId?: string } = {}): MemoryDraftCandidate | null {
    return this.transition(id, 'promoted', options.actorUserId);
  }

  public forget(id: string, options: { actorUserId?: string } = {}): MemoryDraftCandidate | null {
    return this.transition(id, 'forgotten', options.actorUserId);
  }

  public renderText(snapshot: MemoryDraftStoreSnapshot): string {
    return [
      'Zavorth memory drafts',
      `pending: ${snapshot.pending} | promoted: ${snapshot.promoted} | forgotten: ${snapshot.forgotten}`,
      ...snapshot.items
        .filter((item) => item.status === 'pending')
        .slice(0, 20)
        .map((item) => `- ${item.id} | ${item.key}=${item.value} | ${item.category}`),
    ].join('\n');
  }

  private transition(
    id: string,
    status: 'promoted' | 'forgotten',
    actorUserId?: string,
  ): MemoryDraftCandidate | null {
    const store = this.read();
    const item = store.items.find((entry) => entry.id === id);
    if (!item) return null;
    if (item.status !== 'pending') return null;
    if (actorUserId && item.userId !== actorUserId) return null;
    item.status = status;
    item.updatedAt = this.now().toISOString();
    this.write(store);
    return item;
  }

  private read(): StoreFile {
    try {
      if (!fs.existsSync(this.storePath)) {
        return { version: 'memory-draft-store/v1', items: [] };
      }
      const parsed = JSON.parse(fs.readFileSync(this.storePath, 'utf8')) as StoreFile;
      if (!parsed || !Array.isArray(parsed.items)) {
        return { version: 'memory-draft-store/v1', items: [] };
      }
      return { version: 'memory-draft-store/v1', items: parsed.items };
    } catch {
      return { version: 'memory-draft-store/v1', items: [] };
    }
  }

  private write(store: StoreFile): void {
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    const tmp = `${this.storePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
    fs.renameSync(tmp, this.storePath);
  }
}

function sanitizeDraftValue(value: unknown): string {
  return String(value || '')
  // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_VALUE_CHARS);
}

function looksLikeSecret(value: string): boolean {
  return /\b(sk-[A-Za-z0-9_-]{10,}|api[_-]?key\s*[:=]|bearer\s+[A-Za-z0-9._-]{12,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i.test(value);
}
