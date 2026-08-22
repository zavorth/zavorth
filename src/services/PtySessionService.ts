import { logger } from '../logger.js';
import { HostPowerModeService } from './HostPowerModeService';
import { PtySessionApprovalService } from './PtySessionApprovalService';
import { SecurityAuditLogger } from './SecurityAuditLogger';
import { WorkspaceTaskMandateService } from './WorkspaceTaskMandateService';
import { LogRepository } from '../storage/LogRepository.js';
import fs from 'fs';
import { platform } from 'os';

interface IPtyProcess {
  onData(callback: (data: string) => void): void;
  onExit(callback: () => void): void;
  write(data: string): void;
  kill(): void;
}

interface IPtyModule {
  spawn(command: string, args: string[], options: { name: string; cols: number; rows: number; cwd: string; env: NodeJS.ProcessEnv }): IPtyProcess;
}

export interface PtyOutputChunk {
  seq: number;
  sessionId: string;
  chunk: string;
  truncated: boolean;
  createdAt: string;
}

/** Persistent session record for terminal process lifecycle management. */
export type PtySessionRegistryEntry = {
  sessionId: string;
  workspaceId: string;
  cwd: string;
  shell: string;
  attachToken: string;
  status: 'pending' | 'running' | 'detached' | 'terminated';
  createdAt: string;
  lastActivityAt: string;
  processAlive: boolean;
  bufferChunks: number;
  lastSeq: number;
};

export type PtyReattachResult = {
  ok: boolean;
  sessionId: string | null;
  workspaceId: string | null;
  attachToken: string | null;
  status: PtySessionRegistryEntry['status'] | 'unknown';
  processAlive: boolean;
  output: PtyOutputChunk[];
  reason: string;
};

export class PtySessionService {
  private ptyModule: IPtyModule | null = null;
  private isAvailable: boolean = false;

  private pendingSessionData: Map<string, { cwd: string, shell: string }> = new Map();
  private workspaceActiveSessions: Map<string, Set<string>> = new Map();
  private activeSessions: Map<string, IPtyProcess> = new Map();
  private sessionOutputBuffers: Map<string, PtyOutputChunk[]> = new Map();
  private sessionSequenceNumbers: Map<string, number> = new Map();
  /** Session registry for reconnection and output replay (ring buffer = sessionOutputBuffers). */
  private sessionRegistry: Map<string, PtySessionRegistryEntry> = new Map();
  private attachTokenIndex: Map<string, string> = new Map();
  private reaperTimer: ReturnType<typeof setInterval> | null = null;
  private readonly MAX_CHUNK_LENGTH = 10000;
  private readonly MAX_BUFFER_CHUNKS = 1000;
  private readonly DEFAULT_IDLE_MS = 30 * 60 * 1000;
  private readonly DETACHED_RETENTION_MS = 10 * 60 * 1000;

  private static instance: PtySessionService | null = null;

  constructor(
    private hostPowerModeService: HostPowerModeService = HostPowerModeService.getInstance(),
    private approvalService: PtySessionApprovalService = new PtySessionApprovalService(),
    private auditLogger: SecurityAuditLogger = new SecurityAuditLogger(new LogRepository()),
    private mandateService?: WorkspaceTaskMandateService
  ) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.ptyModule = require('node-pty') as IPtyModule;
      this.isAvailable = true;
    } catch (error: unknown) {logger.warn('node-pty is not available. PTY tools will fail-closed.');
      this.isAvailable = false;
    }

    // Register callback for when Host Power Mode is disabled
    this.hostPowerModeService.registerOnDisableCallback(async (workspaceId: string) => {
      await this.terminateAllForWorkspace(workspaceId);
    });

    this.startReaper();
  }

  public static getInstance(): PtySessionService {
    if (!PtySessionService.instance) {
      PtySessionService.instance = new PtySessionService();
    }
    return PtySessionService.instance;
  }

  public getIsAvailable(): boolean {
    return this.isAvailable;
  }

  public registerPendingSession(sessionId: string, cwd: string, shell: string): void {
    this.pendingSessionData.set(sessionId, { cwd, shell });
    const now = new Date().toISOString();
    const attachToken = this.issueAttachToken(sessionId);
    this.sessionRegistry.set(sessionId, {
      sessionId,
      workspaceId: '',
      cwd,
      shell,
      attachToken,
      status: 'pending',
      createdAt: now,
      lastActivityAt: now,
      processAlive: false,
      bufferChunks: 0,
      lastSeq: 0,
    });
  }

  public async startSession(sessionId: string, workspaceId: string): Promise<void> {
    if (!this.isAvailable) {
      throw new Error(`PTY_UNAVAILABLE`);
    }

    if (!this.hostPowerModeService.isHostPowerModeEnabled(workspaceId)) {
      await this.approvalService.updateSessionStatus(sessionId, 'terminated');
      throw new Error(`Host Power Mode is disabled. Cannot start PTY session.`);
    }

    const proposal = await this.approvalService.getApprovedSession(sessionId, workspaceId);
    if (!proposal) {
      throw new Error(`PTY session not approved or expired: ${sessionId}`);
    }

    const pendingData = this.pendingSessionData.get(sessionId);
    if (!pendingData) {
      throw new Error(`PTY session data (cwd/shell) lost from memory. Cannot start session.`);
    }

    this.pendingSessionData.delete(sessionId);

    // Validate shell against allowlist
    const allowedWindows = ['powershell', 'pwsh', 'cmd', 'powershell.exe', 'cmd.exe'];
    const allowedUnix = ['bash', 'sh', 'zsh'];
    const isWin = platform() === 'win32';
    const allowList = isWin ? allowedWindows : allowedUnix;

    if (!allowList.includes(pendingData.shell)) {
      throw new Error(`Shell not allowed: ${pendingData.shell}`);
    }

    // Resolve CWD safely
    let finalCwd = '';
    try {
      finalCwd = fs.realpathSync(pendingData.cwd);
    } catch (error: unknown) {throw new Error(`Invalid PTY CWD: path does not exist or cannot be resolved.`);
    }

    // Spawn PTY
    const ptyProcess = this.ptyModule!.spawn(pendingData.shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: finalCwd,
      env: process.env
    });

    this.activeSessions.set(sessionId, ptyProcess);
    this.sessionOutputBuffers.set(sessionId, []);
    this.sessionSequenceNumbers.set(sessionId, 0);

    let wSet = this.workspaceActiveSessions.get(workspaceId);
    if (!wSet) {
      wSet = new Set();
      this.workspaceActiveSessions.set(workspaceId, wSet);
    }
    wSet.add(sessionId);

    const now = new Date().toISOString();
    const existing = this.sessionRegistry.get(sessionId);
    const attachToken = existing?.attachToken || this.issueAttachToken(sessionId);
    this.sessionRegistry.set(sessionId, {
      sessionId,
      workspaceId,
      cwd: finalCwd,
      shell: pendingData.shell,
      attachToken,
      status: 'running',
      createdAt: existing?.createdAt || now,
      lastActivityAt: now,
      processAlive: true,
      bufferChunks: 0,
      lastSeq: 0,
    });
    this.attachTokenIndex.set(attachToken, sessionId);

    ptyProcess.onData((data: string) => {
      this.handlePtyOutput(sessionId, data);
    });

    ptyProcess.onExit(() => {
      this.markProcessExited(sessionId, workspaceId);
    });

    this.auditLogger.logWorkspaceEvent({
      event: 'pty_session_started',
      workspaceId,
      metadata: { sessionId, shell: pendingData.shell, attachToken: `${attachToken.slice(0, 8)}…` }
    });
  }

  /** Reconnect via opaque token — replays buffered output to restore session context. */
  public reattach(attachToken: string, afterSeq = 0): PtyReattachResult {
    const sessionId = this.attachTokenIndex.get(String(attachToken || '').trim()) || null;
    if (!sessionId) {
      return {
        ok: false,
        sessionId: null,
        workspaceId: null,
        attachToken: null,
        status: 'unknown',
        processAlive: false,
        output: [],
        reason: 'Invalid or expired attach token.',
      };
    }
    const entry = this.sessionRegistry.get(sessionId);
    if (!entry || entry.status === 'terminated') {
      return {
        ok: false,
        sessionId,
        workspaceId: entry?.workspaceId || null,
        attachToken: entry?.attachToken || null,
        status: entry?.status || 'terminated',
        processAlive: false,
        output: [],
        reason: 'Session terminated; start a new PTY proposal.',
      };
    }
    this.touchActivity(sessionId);
    if (entry.status === 'detached' && this.activeSessions.has(sessionId)) {
      entry.status = 'running';
      entry.processAlive = true;
    }
    return {
      ok: true,
      sessionId,
      workspaceId: entry.workspaceId || null,
      attachToken: entry.attachToken,
      status: entry.status,
      processAlive: this.activeSessions.has(sessionId),
      output: this.getOutput(sessionId, afterSeq),
      reason: this.activeSessions.has(sessionId) ? 'Reattached to live PTY session; ring buffer catch-up returned.'
        : 'Session registry hit; process not alive — buffer available until reaper.',
    };
  }

  public getAttachToken(sessionId: string): string | null {
    return this.sessionRegistry.get(sessionId)?.attachToken || null;
  }

  public getRegistryEntry(sessionId: string): PtySessionRegistryEntry | null {
    const entry = this.sessionRegistry.get(sessionId);
    if (!entry) return null;
    return {
      ...entry,
      processAlive: this.activeSessions.has(sessionId),
      bufferChunks: this.sessionOutputBuffers.get(sessionId)?.length || 0,
      lastSeq: this.sessionSequenceNumbers.get(sessionId) || 0,
    };
  }

  public listRegistry(workspaceId?: string): PtySessionRegistryEntry[] {
    const entries = Array.from(this.sessionRegistry.values()).map((entry) => ({
      ...entry,
      processAlive: this.activeSessions.has(entry.sessionId),
      bufferChunks: this.sessionOutputBuffers.get(entry.sessionId)?.length || 0,
      lastSeq: this.sessionSequenceNumbers.get(entry.sessionId) || 0,
    }));
    if (!workspaceId) return entries;
    return entries.filter((entry) => entry.workspaceId === workspaceId);
  }

  /** Idle reaper — terminates inactive live sessions; drops detached buffers after retention. */
  public reapIdleSessions(maxIdleMs = this.DEFAULT_IDLE_MS): { reaped: string[]; dropped: string[] } {
    const now = Date.now();
    const reaped: string[] = [];
    const dropped: string[] = [];
    for (const entry of Array.from(this.sessionRegistry.values())) {
      const last = Date.parse(entry.lastActivityAt) || 0;
      const idleMs = now - last;
      if (entry.status === 'running' && this.activeSessions.has(entry.sessionId) && idleMs > maxIdleMs) {
        void this.terminateSession(entry.sessionId, entry.workspaceId || 'system');
        reaped.push(entry.sessionId);
        continue;
      }
      if (
        (entry.status === 'detached' || entry.status === 'terminated' || !this.activeSessions.has(entry.sessionId))
        && idleMs > this.DETACHED_RETENTION_MS
      ) {
        this.dropRegistry(entry.sessionId);
        dropped.push(entry.sessionId);
      }
    }
    return { reaped, dropped };
  }

  public stopReaper(): void {
    if (this.reaperTimer) {
      clearInterval(this.reaperTimer);
      this.reaperTimer = null;
    }
  }

  private handlePtyOutput(sessionId: string, rawData: string): void {
    const buf = this.sessionOutputBuffers.get(sessionId);
    if (!buf) return;

    let seq = this.sessionSequenceNumbers.get(sessionId) || 0;
    seq++;

    let truncated = false;
    let chunk = rawData;
    if (chunk.length > this.MAX_CHUNK_LENGTH) {
      chunk = chunk.substring(0, this.MAX_CHUNK_LENGTH);
      truncated = true;
    }

    // Redact obvious secrets
    chunk = chunk.replace(/(eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)/g, '[REDACTED_JWT]');

    buf.push({
      seq,
      sessionId,
      chunk,
      truncated,
      createdAt: new Date().toISOString()
    });

    // Ring buffer: drop oldest when full
    if (buf.length > this.MAX_BUFFER_CHUNKS) {
      buf.shift();
    }

    this.sessionSequenceNumbers.set(sessionId, seq);
    this.touchActivity(sessionId);
    const entry = this.sessionRegistry.get(sessionId);
    if (entry) {
      entry.bufferChunks = buf.length;
      entry.lastSeq = seq;
    }

    if (truncated) {
      this.auditLogger.logWorkspaceEvent({
        event: 'pty_output_truncated',
        workspaceId: 'system', // we might not easily have workspaceId here unless we store it
        metadata: { sessionId }
      });
    }
  }

  public getOutput(sessionId: string, afterSeq: number): PtyOutputChunk[] {
    const buf = this.sessionOutputBuffers.get(sessionId);
    if (!buf) return [];
    this.touchActivity(sessionId);
    return buf.filter(c => c.seq > afterSeq);
  }

  public async write(sessionId: string, workspaceId: string, input: string): Promise<void> {
    if (!this.hostPowerModeService.isHostPowerModeEnabled(workspaceId)) {
      await this.terminateSession(sessionId, workspaceId);
      throw new Error(`Host Power Mode is disabled. Cannot write to PTY.`);
    }

    const ptyProcess = this.activeSessions.get(sessionId);
    if (!ptyProcess) {
      throw new Error(`PTY session not found or already terminated: ${sessionId}`);
    }

    this.touchActivity(sessionId);
    ptyProcess.write(input);
  }

  public async terminateSession(sessionId: string, workspaceId: string): Promise<void> {
    const ptyProcess = this.activeSessions.get(sessionId);
    if (ptyProcess) {
      try {
        ptyProcess.kill();
      } catch (error: unknown) {// ignore kill errors
      logger.warn('[Pty Session] operation failed', error);
    }
      this.activeSessions.delete(sessionId);
    }
    // Keep ring buffer briefly for reattach catch-up (reaper drops later)
    this.pendingSessionData.delete(sessionId);

    const wSet = this.workspaceActiveSessions.get(workspaceId);
    if (wSet) {
      wSet.delete(sessionId);
    }

    const entry = this.sessionRegistry.get(sessionId);
    if (entry) {
      entry.status = 'terminated';
      entry.processAlive = false;
      entry.lastActivityAt = new Date().toISOString();
    }

    await this.approvalService.updateSessionStatus(sessionId, 'terminated');

    this.auditLogger.logWorkspaceEvent({
      event: 'pty_session_terminated',
      workspaceId,
      metadata: { sessionId }
    });
  }

  private markProcessExited(sessionId: string, workspaceId: string): void {
    this.activeSessions.delete(sessionId);
    const entry = this.sessionRegistry.get(sessionId);
    if (entry) {
      entry.status = 'detached';
      entry.processAlive = false;
      entry.lastActivityAt = new Date().toISOString();
    }
    const wSet = this.workspaceActiveSessions.get(workspaceId);
    if (wSet) {
      wSet.delete(sessionId);
    }
    void this.approvalService.updateSessionStatus(sessionId, 'terminated');
    this.auditLogger.logWorkspaceEvent({
      event: 'pty_session_terminated',
      workspaceId,
      metadata: { sessionId, reason: 'detached' },
    });
  }

  private startReaper(): void {
    if (this.reaperTimer) return;
    this.reaperTimer = setInterval(() => {
      try {
        this.reapIdleSessions();
      } catch (error: unknown) {
        logger.warn('[Pty Session] reaper failed', error);
      }
    }, 60_000);
    // Do not keep the process alive solely for the reaper
    if (typeof this.reaperTimer === 'object' && this.reaperTimer && 'unref' in this.reaperTimer) {
      (this.reaperTimer as NodeJS.Timeout).unref();
    }
  }

  private issueAttachToken(sessionId: string): string {
    const token = `ptyatk_${sessionId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24)}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    this.attachTokenIndex.set(token, sessionId);
    return token;
  }

  private touchActivity(sessionId: string): void {
    const entry = this.sessionRegistry.get(sessionId);
    if (entry) {
      entry.lastActivityAt = new Date().toISOString();
    }
  }

  private dropRegistry(sessionId: string): void {
    const entry = this.sessionRegistry.get(sessionId);
    if (entry?.attachToken) {
      this.attachTokenIndex.delete(entry.attachToken);
    }
    this.sessionRegistry.delete(sessionId);
    this.sessionOutputBuffers.delete(sessionId);
    this.sessionSequenceNumbers.delete(sessionId);
    this.pendingSessionData.delete(sessionId);
    this.activeSessions.delete(sessionId);
  }

  public async terminateAllForWorkspace(workspaceId: string): Promise<void> {
    const wSet = this.workspaceActiveSessions.get(workspaceId);
    if (wSet) {
      const sessions = Array.from(wSet);
      for (const s of sessions) {
        await this.terminateSession(s, workspaceId);
      }
    }
    this.auditLogger.logWorkspaceEvent({
      event: 'pty_session_terminated_due_to_host_power_disabled',
      workspaceId
    });
  }
}
