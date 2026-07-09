import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { config } from '../config/index.js';
import { logger } from '../logger.js';

export type CodexRemoteSessionStatus =
  | 'draft'
  | 'running'
  | 'completed'
  | 'failed'
  | 'stopped';

export type CodexRemoteSessionEventType =
  | 'created'
  | 'started'
  | 'resumed'
  | 'attached'
  | 'approval-required'
  | 'approval-approved'
  | 'approval-rejected'
  | 'stopped'
  | 'completed'
  | 'failed'
  | 'note';

export type CodexRemoteSessionEvent = {
  id: string;
  at: string;
  type: CodexRemoteSessionEventType;
  message: string;
};

export type CodexRemoteSessionRecord = {
  sessionId: string;
  title: string;
  prompt: string;
  profileId: string;
  workspaceRoot: string;
  requestedBy: string;
  sourceSurface: string;
  sourceChatId: string | null;
  status: CodexRemoteSessionStatus;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  lastHeartbeatAt: string | null;
  pid: number | null;
  runCount: number;
  maxRuntimeSeconds: number | null;
  handoffWebSessionId: string | null;
  handoffCommand: string | null;
  logFilePath: string | null;
  outputFilePath: string | null;
  lastOutput: string | null;
  lastError: string | null;
  lastExitCode: number | null;
  metadata: Record<string, any>;
  events: CodexRemoteSessionEvent[];
};

type CodexRemoteSessionStoreState = {
  sessions: CodexRemoteSessionRecord[];
};

type CodexRemoteSessionStoreRuntime = {
  now?: () => Date;
  stateFilePath?: string;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
};

const EMPTY_STATE: CodexRemoteSessionStoreState = {
  sessions: [],
};

function isPlainObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeMetadata(
  current: Record<string, any>,
  patch: Record<string, any>,
): Record<string, any> {
  const next: Record<string, any> = { ...current };

  for (const [key, value] of Object.entries(patch)) {
    if (isPlainObject(next[key]) && isPlainObject(value)) {
      next[key] = mergeMetadata(next[key], value);
      continue;
    }
    next[key] = value;
  }

  return next;
}

export class CodexRemoteSessionStoreService {
  private readonly now: () => Date;
  private readonly stateFilePath: string;
  private readonly existsSync: typeof fs.existsSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;

  constructor(runtime: CodexRemoteSessionStoreRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.stateFilePath =
      runtime.stateFilePath || path.join(config.dataDir, 'runtime', 'codex-remote-sessions', 'index.json');
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
  }

  public listSessions(): CodexRemoteSessionRecord[] {
    return [...this.readState().sessions].sort((left, right) =>
      String(right.updatedAt || '').localeCompare(String(left.updatedAt || '')));
  }

  public getSession(sessionId: string): CodexRemoteSessionRecord | null {
    const normalized = String(sessionId || '').trim();
    if (!normalized) {
      return null;
    }
    return this.listSessions().find((session) => session.sessionId === normalized) || null;
  }

  public createSession(input: {
    title?: string | null;
    prompt: string;
    profileId: string;
    workspaceRoot: string;
    requestedBy: string;
    sourceSurface?: string | null;
    sourceChatId?: string | null;
    metadata?: Record<string, any> | null;
    maxRuntimeSeconds?: number | null;
  }): CodexRemoteSessionRecord {
    const now = this.now().toISOString();
    const sessionId = `codex-${randomUUID()}`;
    const title =
      String(input.title || '').trim()
      || this.deriveTitle(input.prompt);
    const record: CodexRemoteSessionRecord = {
      sessionId,
      title,
      prompt: String(input.prompt || '').trim(),
      profileId: String(input.profileId || '').trim() || 'default',
      workspaceRoot: String(input.workspaceRoot || '').trim() || config.defaultWorkspace,
      requestedBy: String(input.requestedBy || '').trim() || 'unknown',
      sourceSurface: String(input.sourceSurface || '').trim() || 'telegram',
      sourceChatId: String(input.sourceChatId || '').trim() || null,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      finishedAt: null,
      lastHeartbeatAt: null,
      pid: null,
      runCount: 0,
      maxRuntimeSeconds:
        typeof input.maxRuntimeSeconds === 'number' && Number.isFinite(input.maxRuntimeSeconds)
          ? Math.max(1, Math.trunc(input.maxRuntimeSeconds))
          : null,
      handoffWebSessionId: null,
      handoffCommand: null,
      logFilePath: null,
      outputFilePath: null,
      lastOutput: null,
      lastError: null,
      lastExitCode: null,
      metadata: mergeMetadata(
        input.metadata && typeof input.metadata === 'object' ? { ...input.metadata } : {},
        {
          codexRemotePresence: {
            state: 'draft',
            alive: false,
            stale: false,
            pid: null,
            runtimeSeconds: null,
            heartbeatAgeMs: null,
            lastHeartbeatAt: null,
            observedAt: now,
          },
          codexRemoteGuardrails: {
            timeoutSeconds: typeof input.maxRuntimeSeconds === 'number' && Number.isFinite(input.maxRuntimeSeconds)
              ? Math.max(1, Math.trunc(input.maxRuntimeSeconds))
              : null,
            staleAfterMs: config.codexRemoteSessionStaleMs,
            state: 'inactive',
          },
          codexRemoteNotifications: {
            lastStaleHeartbeatAt: null,
            lastTerminalEventAt: null,
          },
        },
      ),
      events: [
        {
          id: randomUUID(),
          at: now,
          type: 'created',
          message: `Sessao criada para o perfil ${String(input.profileId || 'default').trim() || 'default'}.`,
        },
      ],
    };

    const state = this.readState();
    this.writeState({
      sessions: [record, ...state.sessions],
    });
    return record;
  }

  public updateSession(
    sessionId: string,
    patch:
      | Partial<CodexRemoteSessionRecord>
      | ((current: CodexRemoteSessionRecord) => Partial<CodexRemoteSessionRecord>),
  ): CodexRemoteSessionRecord {
    const state = this.readState();
    const index = state.sessions.findIndex((entry) => entry.sessionId === String(sessionId || '').trim());
    if (index < 0) {
      throw new Error(`Sessao Codex Remote nao encontrada: ${sessionId}.`);
    }

    const current = state.sessions[index];
    const resolvedPatch = typeof patch === 'function' ? patch(current) : patch;
    const next: CodexRemoteSessionRecord = {
      ...current,
      ...resolvedPatch,
      updatedAt: String(resolvedPatch.updatedAt || '').trim() || this.now().toISOString(),
      metadata: resolvedPatch.metadata && typeof resolvedPatch.metadata === 'object'
        ? mergeMetadata(current.metadata, resolvedPatch.metadata)
        : current.metadata,
      events: Array.isArray(resolvedPatch.events)
        ? resolvedPatch.events.slice(-40)
        : current.events,
    };

    const sessions = [...state.sessions];
    sessions[index] = next;
    this.writeState({ sessions });
    return next;
  }

  public appendEvent(
    sessionId: string,
    input: {
      type: CodexRemoteSessionEventType;
      message: string;
      at?: string | null;
    },
  ): CodexRemoteSessionRecord {
    return this.updateSession(sessionId, (current) => ({
      events: [
        ...current.events,
        {
          id: randomUUID(),
          at: String(input.at || '').trim() || this.now().toISOString(),
          type: input.type,
          message: String(input.message || '').trim() || 'Sem observacao adicional.',
        },
      ].slice(-40),
    }));
  }

  private deriveTitle(prompt: string): string {
    const normalized = String(prompt || '').replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return 'Codex Remote session';
    }
    return normalized.length > 72 ? `${normalized.slice(0, 69)}...` : normalized;
  }

  private readState(): CodexRemoteSessionStoreState {
    try {
      if (!this.existsSync(this.stateFilePath)) {
        return { ...EMPTY_STATE };
      }
      const parsed = JSON.parse(this.readFileSync(this.stateFilePath, 'utf8')) as CodexRemoteSessionStoreState;
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.sessions)) {
        return { ...EMPTY_STATE };
      }
      return {
        sessions: parsed.sessions
          .filter((entry) => entry && typeof entry === 'object')
          .map((entry) => ({
            ...entry,
            events: Array.isArray(entry.events) ? entry.events.slice(-40) : [],
          })),
      };
    } catch (error: any) {
    logger.warn('[Codex Remote Session Store] parsing failed', error);
    return { ...EMPTY_STATE };
  }
  }

  private writeState(state: CodexRemoteSessionStoreState): void {
    this.mkdirSync(path.dirname(this.stateFilePath), { recursive: true });
    this.writeFileSync(this.stateFilePath, JSON.stringify(state, null, 2), 'utf8');
  }
}
