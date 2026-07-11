import path from 'node:path';

import {
  ContextCompactionService,
  type ContextCompactionDecision,
  type ContextCompactionInput,
} from './ContextCompactionService.js';
import {
  ZavorthSessionRecallService,
  type ZavorthSessionRecallHit,
  type ZavorthSessionRecallSession,
  type ZavorthSessionRecallSnapshot,
} from './ZavorthSessionRecallService.js';
import type { ZavorthOperationalStateDbService } from './ZavorthOperationalStateDbService.js';

export const SESSION_CONTINUUM_STORE_FILE = 'mnemos-session-recall.json';

export type SessionContinuumSearchInput = {
  query?: string | null;
  sessionId?: string | null;
  currentSessionId?: string | null;
  aroundMessageId?: string | null;
  limit?: number | null;
  window?: number | null;
};

export type SessionContinuumAppendMessageInput = {
  sessionId?: string | null;
  title?: string | null;
  role: string;
  content: string;
  messageId?: string | null;
  createdAt?: string | null;
  metadata?: Record<string, unknown>;
};

export type SessionContinuumAppendTurnInput = {
  sessionId?: string | null;
  title?: string | null;
  userMessage?: string | null;
  assistantMessage?: string | null;
  metadata?: Record<string, unknown>;
};

export type SessionContinuumAppendTurnResult = {
  localOnly: true;
  sessionId: string | null;
  storePath: string;
  user: ZavorthSessionRecallSession | null;
  assistant: ZavorthSessionRecallSession | null;
};

export type SessionContinuumServiceOptions = {
  storePath: string;
  stateDb?: ZavorthOperationalStateDbService | null;
  stateDbPath?: string | null;
  now?: () => Date;
  recall?: ZavorthSessionRecallService;
  compaction?: ContextCompactionService;
};

export function resolveSessionContinuumStorePath(runtimeDir: string): string {
  return path.join(path.resolve(runtimeDir), SESSION_CONTINUUM_STORE_FILE);
}

export class SessionContinuumService {
  private readonly storePath: string;
  private readonly recallService: ZavorthSessionRecallService;
  private readonly compaction: ContextCompactionService;

  constructor(options: SessionContinuumServiceOptions) {
    this.storePath = path.resolve(options.storePath);
    this.recallService = options.recall || new ZavorthSessionRecallService({
      storePath: this.storePath,
      stateDb: options.stateDb || null,
      stateDbPath: options.stateDbPath || null,
      now: options.now,
    });
    this.compaction = options.compaction || new ContextCompactionService();
  }

  public getStorePath(): string {
    return this.storePath;
  }

  public getRecallService(): ZavorthSessionRecallService {
    return this.recallService;
  }

  public compact(input: ContextCompactionInput): ContextCompactionDecision {
    return this.compaction.compact(input);
  }

  public appendMessage(input: SessionContinuumAppendMessageInput): ZavorthSessionRecallSession {
    return this.recallService.appendMessage(input);
  }

  /**
   * Local-only end-of-turn capture into the shared session recall store.
   * Does not call providers or leave the machine.
   */
  public appendTurn(input: SessionContinuumAppendTurnInput): SessionContinuumAppendTurnResult {
    const sessionId = String(input.sessionId || '').trim() || null;
    const title = String(input.title || '').trim() || null;
    const metadata = {
      ...(input.metadata || {}),
      continuum: 'session-continuum/1',
      localOnly: true,
    };
    let user: ZavorthSessionRecallSession | null = null;
    let assistant: ZavorthSessionRecallSession | null = null;
    let activeSessionId = sessionId;

    const userMessage = String(input.userMessage || '').trim();
    if (userMessage) {
      user = this.recallService.appendMessage({
        sessionId: activeSessionId,
        title,
        role: 'user',
        content: userMessage,
        metadata,
      });
      activeSessionId = user.id;
    }

    const assistantMessage = String(input.assistantMessage || '').trim();
    if (assistantMessage) {
      assistant = this.recallService.appendMessage({
        sessionId: activeSessionId,
        title,
        role: 'assistant',
        content: assistantMessage,
        metadata,
      });
      activeSessionId = assistant.id;
    }

    return {
      localOnly: true,
      sessionId: activeSessionId,
      storePath: this.storePath,
      user,
      assistant,
    };
  }

  public search(input: SessionContinuumSearchInput = {}): ZavorthSessionRecallSnapshot {
    return this.recallService.recall(input);
  }

  public recall(input: SessionContinuumSearchInput = {}): ZavorthSessionRecallSnapshot {
    return this.search(input);
  }

  public browse(input: Omit<SessionContinuumSearchInput, 'query' | 'aroundMessageId'> = {}): ZavorthSessionRecallSnapshot {
    return this.search({
      ...input,
      query: null,
      aroundMessageId: null,
    });
  }

  public discover(query: string, input: SessionContinuumSearchInput = {}): ZavorthSessionRecallSnapshot {
    return this.search({
      ...input,
      query,
    });
  }

  public scroll(input: SessionContinuumSearchInput): ZavorthSessionRecallSnapshot {
    return this.search({
      ...input,
      sessionId: input.sessionId,
      aroundMessageId: input.aroundMessageId,
    });
  }

  public formatHits(hits: ZavorthSessionRecallHit[], maxSnippet = 200): string[] {
    return hits.map((hit) => {
      const snippet = String(hit.snippet || '').replace(/\s+/g, ' ').trim().slice(0, maxSnippet);
      return `${hit.sessionId}: ${hit.title} | score=${hit.score} | ${snippet}`;
    });
  }
}
