import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { ZavorthOperationalStateDbService } from './ZavorthOperationalStateDbService.js';

export type ZavorthSessionRecallMessage = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

export type ZavorthSessionRecallSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ZavorthSessionRecallMessage[];
  metadata?: Record<string, unknown>;
};

export type ZavorthSessionRecallHit = {
  sessionId: string;
  title: string;
  messageId: string | null;
  role: string | null;
  score: number;
  snippet: string;
  createdAt: string | null;
  updatedAt: string;
  neighbors: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: string;
  }>;
};

export type ZavorthSessionRecallSnapshot = {
  contractVersion: 'mnemos-session-recall/1';
  generatedAt: string;
  mode: 'browse' | 'discovery' | 'scroll';
  query: string;
  storePath: string;
  sessionCount: number;
  returned: number;
  hits: ZavorthSessionRecallHit[];
  safety: {
    llmUsed: false;
    rawProviderLogsRequired: false;
    localOnly: true;
  };
};

type Store = {
  sessions: ZavorthSessionRecallSession[];
};

type ServiceOptions = {
  storePath: string;
  stateDb?: ZavorthOperationalStateDbService | null;
  stateDbPath?: string | null;
  now?: () => Date;
};

type RecallInput = {
  query?: string | null;
  sessionId?: string | null;
  currentSessionId?: string | null;
  aroundMessageId?: string | null;
  limit?: number | null;
  window?: number | null;
};

type AppendInput = {
  sessionId?: string | null;
  title?: string | null;
  role: string;
  content: string;
  messageId?: string | null;
  createdAt?: string | null;
  metadata?: Record<string, unknown>;
};

export class ZavorthSessionRecallService {
  private readonly storePath: string;
  private readonly stateDb: ZavorthOperationalStateDbService | null;
  private readonly stateDbPath: string | null;
  private readonly now: () => Date;
  private legacySeeded = false;

  constructor(options: ServiceOptions) {
    this.storePath = path.resolve(options.storePath);
    this.stateDb = options.stateDb || null;
    this.stateDbPath = options.stateDbPath ? path.resolve(options.stateDbPath) : null;
    this.now = options.now || (() => new Date());
  }

  public appendMessage(input: AppendInput): ZavorthSessionRecallSession {
    if (this.hasStateDb()) {
      return this.withStateDb((stateDb) => stateDb.appendSessionMessage(input));
    }
    const store = this.readStore();
    const timestamp = input.createdAt || this.timestamp();
    const sessionId = normalize(input.sessionId) || `session-${randomUUID()}`;
    let session = store.sessions.find((entry) => entry.id === sessionId);
    if (!session) {
      session = {
        id: sessionId,
        title: normalize(input.title) || this.deriveTitle(input.content),
        createdAt: timestamp,
        updatedAt: timestamp,
        messages: [],
        ...(input.metadata ? { metadata: input.metadata } : {}),
      };
      store.sessions.push(session);
    }
    session.updatedAt = timestamp;
    if (input.title) {
      session.title = normalize(input.title) || session.title;
    }
    session.messages.push({
      id: normalize(input.messageId) || `msg-${randomUUID()}`,
      role: normalize(input.role) || 'user',
      content: String(input.content || ''),
      createdAt: timestamp,
    });
    this.writeStore(store);
    return clone(session);
  }

  public recall(input: RecallInput = {}): ZavorthSessionRecallSnapshot {
    if (this.hasStateDb()) {
      return this.withStateDb((stateDb) => stateDb.recallSessions(input));
    }
    const store = this.readStore();
    const query = normalize(input.query);
    const limit = clamp(Number(input.limit || 8), 1, 50);
    const windowSize = clamp(Number(input.window || 2), 0, 8);
    const mode = this.resolveMode(input, query);
    const sessions = [...store.sessions].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    const hits = mode === 'browse'
      ? this.browse(sessions, input.currentSessionId, limit, windowSize)
      : this.search(sessions, query, input, limit, windowSize);

    return {
      contractVersion: 'mnemos-session-recall/1',
      generatedAt: this.timestamp(),
      mode,
      query,
      storePath: this.storePath,
      sessionCount: sessions.length,
      returned: hits.length,
      hits,
      safety: {
        llmUsed: false,
        rawProviderLogsRequired: false,
        localOnly: true,
      },
    };
  }

  public snapshot(limit = 12): ZavorthSessionRecallSnapshot {
    return this.recall({ limit });
  }

  private resolveMode(input: RecallInput, query: string): ZavorthSessionRecallSnapshot['mode'] {
    if (input.sessionId && input.aroundMessageId) return 'scroll';
    if (query) return 'discovery';
    return 'browse';
  }

  private browse(
    sessions: ZavorthSessionRecallSession[],
    currentSessionId: string | null | undefined,
    limit: number,
    windowSize: number,
  ): ZavorthSessionRecallHit[] {
    return sessions
      .filter((session) => !currentSessionId || session.id !== currentSessionId)
      .slice(0, limit)
      .map((session) => {
        const message = session.messages.at(-1) || null;
        const index = message ? session.messages.findIndex((entry) => entry.id === message.id) : -1;
        return this.hitFrom(session, message, index, 1, windowSize);
      });
  }

  private search(
    sessions: ZavorthSessionRecallSession[],
    query: string,
    input: RecallInput,
    limit: number,
    windowSize: number,
  ): ZavorthSessionRecallHit[] {
    const terms = normalizeSearch(query).split(/\s+/u).filter(Boolean);
    const scored: ZavorthSessionRecallHit[] = [];
    for (const session of sessions) {
      if (input.sessionId && session.id !== input.sessionId) continue;
      const messages = session.messages.length ? session.messages : [{
        id: 'session-title',
        role: 'system',
        content: session.title,
        createdAt: session.updatedAt,
      }];
      for (let index = 0; index < messages.length; index += 1) {
        const message = messages[index];
        if (input.aroundMessageId && message.id !== input.aroundMessageId) continue;
        const score = input.aroundMessageId ? 50 : this.score(`${session.title}\n${message.content}`, terms);
        if (score <= 0) continue;
        scored.push(this.hitFrom(session, message, index, score, windowSize));
      }
    }
    return scored
      .sort((a, b) => b.score - a.score || Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, limit);
  }

  private score(text: string, terms: string[]): number {
    const haystack = normalizeSearch(text);
    let score = 0;
    for (const term of terms) {
      if (!term) continue;
      const exactMatches = haystack.split(term).length - 1;
      if (exactMatches > 0) {
        score += exactMatches * (term.length > 3 ? 6 : 2);
      }
      if (haystack.includes(term)) {
        score += term.length;
      }
    }
    return score;
  }

  private hitFrom(
    session: ZavorthSessionRecallSession,
    message: ZavorthSessionRecallMessage | null,
    index: number,
    score: number,
    windowSize: number,
  ): ZavorthSessionRecallHit {
    const start = Math.max(0, index - windowSize);
    const end = Math.min(session.messages.length, index + windowSize + 1);
    const neighbors = index >= 0
      ? session.messages.slice(start, end).map((entry) => ({
        id: entry.id,
        role: entry.role,
        content: trim(entry.content, 360),
        createdAt: entry.createdAt,
      }))
      : [];
    return {
      sessionId: session.id,
      title: session.title,
      messageId: message?.id || null,
      role: message?.role || null,
      score,
      snippet: trim(message?.content || session.title, 500),
      createdAt: message?.createdAt || null,
      updatedAt: session.updatedAt,
      neighbors,
    };
  }

  private deriveTitle(content: string): string {
    return trim(String(content || 'Session').replace(/\s+/gu, ' '), 72) || 'Session';
  }

  private readStore(): Store {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.storePath, 'utf8')) as Partial<Store>;
      return {
        sessions: Array.isArray(parsed.sessions)
          ? parsed.sessions.map(normalizeSession).filter((entry): entry is ZavorthSessionRecallSession => Boolean(entry))
          : [],
      };
    } catch {
      return { sessions: [] };
    }
  }

  private writeStore(store: Store): void {
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    const tempPath = `${this.storePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
    fs.renameSync(tempPath, this.storePath);
  }

  private timestamp(): string {
    return this.now().toISOString();
  }

  private hasStateDb(): boolean {
    return Boolean(this.stateDb || this.stateDbPath);
  }

  private withStateDb<T>(fn: (stateDb: ZavorthOperationalStateDbService) => T): T {
    if (this.stateDb) {
      this.seedStateDb(this.stateDb);
      return fn(this.stateDb);
    }
    const stateDb = new ZavorthOperationalStateDbService({
      dbPath: this.stateDbPath as string,
      now: this.now,
    });
    try {
      this.seedStateDb(stateDb);
      return fn(stateDb);
    } finally {
      stateDb.close();
    }
  }

  private seedStateDb(stateDb: ZavorthOperationalStateDbService): void {
    if (this.legacySeeded) return;
    const legacy = this.readStore().sessions;
    if (legacy.length > 0) {
      stateDb.importSessionRecallSessions(legacy);
    }
    this.legacySeeded = true;
  }
}

function normalizeSession(value: unknown): ZavorthSessionRecallSession | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<ZavorthSessionRecallSession>;
  const id = normalize(item.id);
  if (!id) return null;
  const updatedAt = normalize(item.updatedAt) || normalize(item.createdAt) || new Date(0).toISOString();
  return {
    id,
    title: normalize(item.title) || id,
    createdAt: normalize(item.createdAt) || updatedAt,
    updatedAt,
    messages: Array.isArray(item.messages)
      ? item.messages.map(normalizeMessage).filter((entry): entry is ZavorthSessionRecallMessage => Boolean(entry))
      : [],
    ...(item.metadata && typeof item.metadata === 'object' ? { metadata: item.metadata } : {}),
  };
}

function normalizeMessage(value: unknown): ZavorthSessionRecallMessage | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<ZavorthSessionRecallMessage>;
  const content = String(item.content || '');
  if (!content) return null;
  return {
    id: normalize(item.id) || `msg-${randomUUID()}`,
    role: normalize(item.role) || 'user',
    content,
    createdAt: normalize(item.createdAt) || new Date(0).toISOString(),
  };
}

function normalize(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeSearch(value: unknown): string {
  return normalize(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase();
}

function trim(value: string, maxLength: number): string {
  const text = String(value || '').trim();
  return text.length <= maxLength ? text : `${text.slice(0, Math.max(0, maxLength - 1))}...`;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
