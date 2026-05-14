import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import * as path from 'path';
import type { AgentState, SessionEventMap } from '../runtime/sessions/v2/AgentState.js';
import { InfiniteMemoryCompressor } from '../runtime/sessions/v2/InfiniteMemoryCompressor.js';
import { SessionManager } from '../runtime/sessions/v2/SessionManager.js';
import { SessionRecorder } from '../runtime/sessions/v2/SessionRecorder.js';
import { MemoryVectorStore } from '../storage/MemoryVectorStore.js';
import { VectorEmbeddingService } from './VectorEmbeddingService.js';
import type { LlmRuntimeService } from './llm/LlmRuntimeService.js';
import { WorkspaceResolver } from '../security/WorkspaceResolver.js';

type SessionV2EventBus = Pick<EventEmitter, 'on' | 'removeListener'> & {
  on<K extends keyof SessionEventMap>(event: K, listener: SessionEventMap[K]): EventEmitter;
  removeListener<K extends keyof SessionEventMap>(event: K, listener: SessionEventMap[K]): EventEmitter;
};

export interface SessionV2Controller {
  getEvents(): SessionV2EventBus;
  getState(): AgentState;
  startProcess(command?: string, args?: string[]): void;
  write(input: string): void;
  kill(): void;
}

export type SessionV2Snapshot = {
  sessionId: string;
  createdAt: string;
  state: AgentState;
  recording: {
    enabled: boolean;
    active: boolean;
    frameCount: number;
    elapsedSeconds: number;
    lastSavedPath: string | null;
  };
  memory: ReturnType<InfiniteMemoryCompressor['getSnapshot']>;
};

export type SessionV2CreateInput = {
  sessionId?: string | null;
  cwd?: string | null;
  command?: string | null;
  args?: string[] | null;
  record?: boolean | null;
};

export type SessionV2MemoryResponse = {
  sessionId: string;
  query: string | null;
  snapshot: ReturnType<InfiniteMemoryCompressor['getSnapshot']>;
  context: ReturnType<InfiniteMemoryCompressor['buildActiveContext']>;
};

type ManagedSession = {
  sessionId: string;
  createdAt: string;
  manager: SessionV2Controller;
  recorder: SessionRecorder | null;
  memory: InfiniteMemoryCompressor;
  recordingEnabled: boolean;
  lastSavedPath: string | null;
};

export class SessionV2Service {
  private readonly sessions = new Map<string, ManagedSession>();
  private readonly memoryVectorStore = new MemoryVectorStore(undefined, {
    embeddingService: VectorEmbeddingService.isConfigured()
      ? new VectorEmbeddingService()
      : null,
  });

  constructor(
    private readonly options: {
      recordingDir?: string;
      sessionFactory?: (sessionId: string, cwd: string) => SessionV2Controller;
      llmRuntime?: LlmRuntimeService;
    } = {},
  ) {}

  public createSession(input: SessionV2CreateInput = {}): SessionV2Snapshot {
    const sessionId = String(input.sessionId || '').trim() || randomUUID();
    const existing = this.sessions.get(sessionId);
    if (existing) {
      return this.buildSnapshot(existing);
    }

    const cwd = this.resolveCwd(input.cwd);
    const manager = this.options.sessionFactory?.(sessionId, cwd) || new SessionManager(sessionId, cwd);
    const memory = new InfiniteMemoryCompressor(sessionId, {
      llmRuntime: this.options.llmRuntime,
      vectorStore: this.memoryVectorStore,
    });
    const recordingEnabled = input.record !== false;
    const recorder = recordingEnabled
      ? new SessionRecorder(sessionId, this.resolveRecordingDir())
      : null;
    const entry: ManagedSession = {
      sessionId,
      createdAt: new Date().toISOString(),
      manager,
      recorder,
      memory,
      recordingEnabled,
      lastSavedPath: null,
    };

    this.bindSession(entry);
    this.sessions.set(sessionId, entry);
    manager.startProcess(
      String(input.command || '').trim() || undefined,
      Array.isArray(input.args) ? input.args.filter((value) => typeof value === 'string') : undefined,
    );

    return this.buildSnapshot(entry);
  }

  public ensureController(input: SessionV2CreateInput = {}): SessionV2Controller {
    const sessionId = String(input.sessionId || '').trim() || randomUUID();
    const existing = this.sessions.get(sessionId);
    if (existing) {
      return existing.manager;
    }
    this.createSession({
      ...input,
      sessionId,
    });
    return this.requireSession(sessionId).manager;
  }

  public listSessions(): SessionV2Snapshot[] {
    return Array.from(this.sessions.values())
      .map((entry) => this.buildSnapshot(entry))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  public getSession(sessionId: string): SessionV2Snapshot | null {
    const entry = this.getManagedSession(sessionId);
    return entry ? this.buildSnapshot(entry) : null;
  }

  public writeSession(sessionId: string, input: string): SessionV2Snapshot {
    const entry = this.requireSession(sessionId);
    const normalizedInput = String(input || '');
    if (!normalizedInput.trim()) {
      throw new Error('input obrigatorio.');
    }
    entry.manager.write(normalizedInput);
    return this.buildSnapshot(entry);
  }

  public killSession(sessionId: string): SessionV2Snapshot {
    const entry = this.requireSession(sessionId);
    entry.manager.kill();
    this.finalizeRecording(entry);
    return this.buildSnapshot(entry);
  }

  public listRecordings(sessionId?: string): Array<{ filename: string; path: string; sizeBytes: number }> {
    const recordings = SessionRecorder.listRecordings(this.resolveRecordingDir());
    const normalizedSessionId = String(sessionId || '').trim();
    if (!normalizedSessionId) {
      return recordings;
    }
    return recordings.filter((recording) => recording.filename.startsWith(`${normalizedSessionId}-`));
  }

  public getRecording(filename: string): { filename: string; path: string; sizeBytes: number } | null {
    const normalizedFilename = path.basename(String(filename || '').trim());
    if (!normalizedFilename.endsWith('.cast')) {
      return null;
    }
    return this.listRecordings().find((recording) => recording.filename === normalizedFilename) || null;
  }

  public queryMemory(sessionId: string, query?: string | null): SessionV2MemoryResponse {
    const entry = this.requireSession(sessionId);
    const normalizedQuery = String(query || '').trim();
    return {
      sessionId: entry.sessionId,
      query: normalizedQuery || null,
      snapshot: entry.memory.getSnapshot(),
      context: entry.memory.buildActiveContext(normalizedQuery || undefined),
    };
  }

  public shutdown(): void {
    for (const entry of this.sessions.values()) {
      entry.manager.kill();
      this.finalizeRecording(entry);
    }
    this.sessions.clear();
    this.memoryVectorStore.close();
  }

  private bindSession(entry: ManagedSession): void {
    if (entry.recorder) {
      entry.recorder.startRecording(entry.manager);
    }

    entry.manager.getEvents().on('pty:data', (data: string) => {
      entry.memory.pushMessage(`[stdout] ${data}`);
    });

    entry.manager.getEvents().on('pty:error', (data: string) => {
      entry.memory.pushMessage(`[stderr] ${data}`);
    });

    entry.manager.getEvents().on('pty:input', (data: string) => {
      entry.memory.pushMessage(`[stdin] ${data}`);
    });

    entry.manager.getEvents().on('pty:exit', () => {
      this.finalizeRecording(entry);
    });
  }

  private finalizeRecording(entry: ManagedSession): void {
    if (!entry.recorder || entry.lastSavedPath) {
      return;
    }
    entry.lastSavedPath = entry.recorder.stopRecording();
  }

  private buildSnapshot(entry: ManagedSession): SessionV2Snapshot {
    return {
      sessionId: entry.sessionId,
      createdAt: entry.createdAt,
      state: entry.manager.getState(),
      recording: {
        enabled: entry.recordingEnabled,
        active: Boolean(entry.recorder && !entry.lastSavedPath),
        frameCount: entry.recorder?.getFrameCount() || 0,
        elapsedSeconds: entry.recorder?.getElapsedSeconds() || 0,
        lastSavedPath: entry.lastSavedPath,
      },
      memory: entry.memory.getSnapshot(),
    };
  }

  private getManagedSession(sessionId: string): ManagedSession | null {
    const normalizedSessionId = String(sessionId || '').trim();
    if (!normalizedSessionId) {
      return null;
    }
    return this.sessions.get(normalizedSessionId) || null;
  }

  private requireSession(sessionId: string): ManagedSession {
    const entry = this.getManagedSession(sessionId);
    if (!entry) {
      throw new Error('Sessao v2 nao encontrada.');
    }
    return entry;
  }

  private resolveCwd(cwd?: string | null): string {
    const normalized = String(cwd || '').trim();
    if (!normalized) {
      return WorkspaceResolver.validate(process.cwd());
    }
    return WorkspaceResolver.validate(path.resolve(normalized));
  }

  private resolveRecordingDir(): string {
    return this.options.recordingDir
      ? path.resolve(this.options.recordingDir)
      : path.join(process.cwd(), 'data', 'runtime', 'experimental', 'session-v2-recordings');
  }
}

export {
  SessionV2Service as ExperimentalSessionV2Service,
};

export type ExperimentalSessionV2Controller = SessionV2Controller;
export type ExperimentalSessionV2CreateInput = SessionV2CreateInput;
export type ExperimentalSessionV2MemoryResponse = SessionV2MemoryResponse;
export type ExperimentalSessionV2Snapshot = SessionV2Snapshot;
