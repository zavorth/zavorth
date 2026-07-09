import { execFile, type ChildProcess } from 'child_process';
import { config } from '../../config/index.js';
import type { CodexRemoteSessionRecord, CodexRemoteSessionStoreService } from '../CodexRemoteSessionStoreService.js';
import { logger } from '../../logger.js';
import type {
CodexRemoteRuntimeGuardrailMetadata,
  CodexRemoteRuntimePresenceMetadata,
} from './CodexRemoteSidecarMetadataSupport.js';

type CodexRemoteProcessSessionStore = Pick<CodexRemoteSessionStoreService, 'getSession' | 'updateSession'>;

type CodexRemoteSessionRuntimeShape = Pick<
  CodexRemoteSessionRecord,
  'status' | 'startedAt' | 'finishedAt' | 'lastHeartbeatAt' | 'pid' | 'maxRuntimeSeconds'
>;

type BuildPresenceMetadata = (
  session: CodexRemoteSessionRuntimeShape,
  observedAt?: string,
  stateOverride?: CodexRemoteRuntimePresenceMetadata['state'],
) => CodexRemoteRuntimePresenceMetadata;

type BuildGuardrailMetadata = (
  session: CodexRemoteSessionRuntimeShape,
  observedAt?: string,
  stateOverride?: CodexRemoteRuntimeGuardrailMetadata['state'],
  presenceOverride?: CodexRemoteRuntimePresenceMetadata,
) => CodexRemoteRuntimeGuardrailMetadata;

type CodexRemoteSidecarProcessRuntime = {
  now: () => Date;
  sessions: CodexRemoteProcessSessionStore;
  processes?: Map<string, ChildProcess>;
  heartbeatTimers?: Map<string, ReturnType<typeof setInterval>>;
  setIntervalImpl?: typeof setInterval;
  clearIntervalImpl?: typeof clearInterval;
  buildPresenceMetadata: BuildPresenceMetadata;
  buildGuardrailMetadata: BuildGuardrailMetadata;
};

export class CodexRemoteSidecarProcessSupport {
  private readonly now: () => Date;
  private readonly sessions: CodexRemoteProcessSessionStore;
  private readonly processes: Map<string, ChildProcess>;
  private readonly heartbeatTimers: Map<string, ReturnType<typeof setInterval>>;
  private readonly setIntervalImpl: typeof setInterval;
  private readonly clearIntervalImpl: typeof clearInterval;
  private readonly buildPresenceMetadata: BuildPresenceMetadata;
  private readonly buildGuardrailMetadata: BuildGuardrailMetadata;
  private readonly stopReasons = new Map<string, string>();
  private readonly finalizedSessions = new Set<string>();
  private readonly terminalizingSessions = new Set<string>();

  constructor(runtime: CodexRemoteSidecarProcessRuntime);
  constructor(
    now: () => Date,
    sessions: CodexRemoteProcessSessionStore,
    processes: Map<string, ChildProcess>,
    heartbeatTimers: Map<string, ReturnType<typeof setInterval>>,
    setIntervalImpl: typeof setInterval,
    clearIntervalImpl: typeof clearInterval,
    buildPresenceMetadata: BuildPresenceMetadata,
    buildGuardrailMetadata: BuildGuardrailMetadata,
  );
  constructor(
    runtimeOrNow: CodexRemoteSidecarProcessRuntime | (() => Date),
    sessions?: CodexRemoteProcessSessionStore,
    processes?: Map<string, ChildProcess>,
    heartbeatTimers?: Map<string, ReturnType<typeof setInterval>>,
    setIntervalImpl?: typeof setInterval,
    clearIntervalImpl?: typeof clearInterval,
    buildPresenceMetadata?: BuildPresenceMetadata,
    buildGuardrailMetadata?: BuildGuardrailMetadata,
  ) {
    if (typeof runtimeOrNow === 'function') {
      this.now = runtimeOrNow;
      this.sessions = sessions!;
      this.processes = processes || new Map<string, ChildProcess>();
      this.heartbeatTimers = heartbeatTimers || new Map<string, ReturnType<typeof setInterval>>();
      this.setIntervalImpl = setIntervalImpl || setInterval;
      this.clearIntervalImpl = clearIntervalImpl || clearInterval;
      this.buildPresenceMetadata = buildPresenceMetadata!;
      this.buildGuardrailMetadata = buildGuardrailMetadata!;
      return;
    }

    this.now = runtimeOrNow.now;
    this.sessions = runtimeOrNow.sessions;
    this.processes = runtimeOrNow.processes || new Map<string, ChildProcess>();
    this.heartbeatTimers =
      runtimeOrNow.heartbeatTimers || new Map<string, ReturnType<typeof setInterval>>();
    this.setIntervalImpl = runtimeOrNow.setIntervalImpl || setInterval;
    this.clearIntervalImpl = runtimeOrNow.clearIntervalImpl || clearInterval;
    this.buildPresenceMetadata = runtimeOrNow.buildPresenceMetadata;
    this.buildGuardrailMetadata = runtimeOrNow.buildGuardrailMetadata;
  }

  public trackProcess(sessionId: string, child: ChildProcess): void {
    this.processes.set(sessionId, child);
  }

  public untrackProcess(sessionId: string): void {
    this.processes.delete(sessionId);
  }

  public getProcess(sessionId: string): ChildProcess | undefined {
    return this.processes.get(sessionId);
  }

  public hasProcess(sessionId: string): boolean {
    return this.processes.has(sessionId);
  }

  public markFinalized(sessionId: string, reason: string): void {
    this.stopReasons.set(sessionId, reason);
    this.finalizedSessions.add(sessionId);
  }

  public consumeFinalized(sessionId: string): boolean {
    const finalized = this.finalizedSessions.delete(sessionId);
    if (finalized) {
      this.stopReasons.delete(sessionId);
    }
    return finalized;
  }

  public consumeStopReason(sessionId: string): string | null {
    const stopReason = this.stopReasons.get(sessionId) || null;
    this.stopReasons.delete(sessionId);
    return stopReason;
  }

  public markTerminalizing(sessionId: string): void {
    this.terminalizingSessions.add(sessionId);
  }

  public clearTerminalizing(sessionId: string): void {
    this.terminalizingSessions.delete(sessionId);
  }

  public isTerminalizing(sessionId: string): boolean {
    return this.terminalizingSessions.has(sessionId);
  }

  public startHeartbeat(sessionId: string): void {
    const timer = this.setIntervalImpl(() => {
      this.touchHeartbeat(sessionId);
    }, config.codexRemoteSessionHeartbeatMs);
    this.heartbeatTimers.set(sessionId, timer);
  }

  public clearHeartbeat(sessionId: string): void {
    const timer = this.heartbeatTimers.get(sessionId);
    if (timer) {
      this.clearIntervalImpl(timer);
      this.heartbeatTimers.delete(sessionId);
    }
  }

  public touchHeartbeat(sessionId: string): CodexRemoteSessionRecord | null {
    const current = this.sessions.getSession(sessionId);
    if (!current || current.status !== 'running') {
      return null;
    }
    const observedAt = this.now().toISOString();
    return this.sessions.updateSession(sessionId, {
      lastHeartbeatAt: observedAt,
      metadata: {
        codexRemotePresence: this.buildPresenceMetadata(
          {
            ...current,
            lastHeartbeatAt: observedAt,
          },
          observedAt,
        ),
        codexRemoteGuardrails: this.buildGuardrailMetadata(
          {
            ...current,
            lastHeartbeatAt: observedAt,
          },
          observedAt,
        ),
      },
    });
  }

  public async isSessionAlive(session: CodexRemoteSessionRecord): Promise<boolean> {
    const local = this.processes.get(session.sessionId);
    if (local && !local.killed) {
      return true;
    }
    if (!session.pid) {
      return false;
    }
    try {
      process.kill(session.pid, 0);
      return true;
    } catch (error: any) { logger.warn('[Codex Remote Sidecar Process] process signal failed', error); return false; }
  }

  public async terminateChild(child: ChildProcess): Promise<void> {
    await new Promise<void>((resolve) => {
      let settled = false;
      const finalize = () => {
        if (settled) {
          return;
        }
        settled = true;
        resolve();
      };

      const timeout = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch (error: any) { logger.warn('[Codex Remote Sidecar Process] operation failed', error); }
        finalize();
      }, 5000);

      child.once('exit', () => {
        clearTimeout(timeout);
        finalize();
      });

      if (process.platform === 'win32' && child.pid) {
        execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], () => {
          clearTimeout(timeout);
          finalize();
        });
        return;
      }

      try {
        child.kill('SIGTERM');
      } catch (error: any) {
        clearTimeout(timeout);
        finalize();
      }
    });
  }

  public async killProcessByPid(pid: number): Promise<void> {
    await new Promise<void>((resolve) => {
      if (process.platform === 'win32') {
        execFile('taskkill', ['/PID', String(pid), '/T', '/F'], () => resolve());
        return;
      }
      try {
        process.kill(pid, 'SIGTERM');
      } catch (error: any) { logger.warn('[Codex Remote Sidecar Process] process execution failed', error); }
      resolve();
    });
  }
}
