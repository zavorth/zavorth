import { logger } from '../logger.js';
import { HostPowerModeService } from './HostPowerModeService';
import { PtySessionApprovalService } from './PtySessionApprovalService';
import { SecurityAuditLogger } from './SecurityAuditLogger';
import { WorkspaceTaskMandateService } from './WorkspaceTaskMandateService';
import fs from 'fs';
import path from 'path';
import { platform } from 'os';

export interface PtyOutputChunk {
  seq: number;
  sessionId: string;
  chunk: string;
  truncated: boolean;
  createdAt: string;
}

export class PtySessionService {
  private ptyModule: any = null;
  private isAvailable: boolean = false;

  private pendingSessionData: Map<string, { cwd: string, shell: string }> = new Map();
  private workspaceActiveSessions: Map<string, Set<string>> = new Map();
  private activeSessions: Map<string, any> = new Map();
  private sessionOutputBuffers: Map<string, PtyOutputChunk[]> = new Map();
  private sessionSequenceNumbers: Map<string, number> = new Map();
  private readonly MAX_CHUNK_LENGTH = 10000;
  private readonly MAX_BUFFER_CHUNKS = 1000;

  private static instance: PtySessionService | null = null;

  constructor(
    private hostPowerModeService: HostPowerModeService = HostPowerModeService.getInstance(),
    private approvalService: PtySessionApprovalService = new PtySessionApprovalService(),
    private logger: SecurityAuditLogger = new SecurityAuditLogger(new (require('../storage/LogRepository').LogRepository)()),
    private mandateService?: WorkspaceTaskMandateService
  ) {
    try {
      this.ptyModule = require('node-pty');
      this.isAvailable = true;
    } catch (e) {
      logger.warn('node-pty is not available. PTY tools will fail-closed.');
      this.isAvailable = false;
    }

    // Register callback for when Host Power Mode is disabled
    this.hostPowerModeService.registerOnDisableCallback(async (workspaceId: string) => {
      await this.terminateAllForWorkspace(workspaceId);
    });
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
    } catch (err) {
      throw new Error(`Invalid PTY CWD: path does not exist or cannot be resolved.`);
    }

    // Spawn PTY
    const ptyProcess = this.ptyModule.spawn(pendingData.shell, [], {
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

    ptyProcess.onData((data: string) => {
      this.handlePtyOutput(sessionId, data);
    });

    ptyProcess.onExit(() => {
      this.terminateSession(sessionId, workspaceId);
    });

    this.logger.logWorkspaceEvent({
      event: 'pty_session_started',
      workspaceId,
      metadata: { sessionId, shell: pendingData.shell }
    });
  }

  private handlePtyOutput(sessionId: string, rawData: string): void {
    let buf = this.sessionOutputBuffers.get(sessionId);
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

    if (buf.length > this.MAX_BUFFER_CHUNKS) {
      buf.shift(); // remove oldest
    }

    this.sessionSequenceNumbers.set(sessionId, seq);

    if (truncated) {
      this.logger.logWorkspaceEvent({
        event: 'pty_output_truncated',
        workspaceId: 'system', // we might not easily have workspaceId here unless we store it
        metadata: { sessionId }
      });
    }
  }

  public getOutput(sessionId: string, afterSeq: number): PtyOutputChunk[] {
    const buf = this.sessionOutputBuffers.get(sessionId);
    if (!buf) return [];
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

    ptyProcess.write(input);
  }

  public async terminateSession(sessionId: string, workspaceId: string): Promise<void> {
    const ptyProcess = this.activeSessions.get(sessionId);
    if (ptyProcess) {
      try {
        ptyProcess.kill();
      } catch (e) {
        // ignore kill errors
      }
      this.activeSessions.delete(sessionId);
    }
    this.sessionOutputBuffers.delete(sessionId);
    this.sessionSequenceNumbers.delete(sessionId);
    this.pendingSessionData.delete(sessionId);
    
    const wSet = this.workspaceActiveSessions.get(workspaceId);
    if (wSet) {
      wSet.delete(sessionId);
    }

    await this.approvalService.updateSessionStatus(sessionId, 'terminated');

    this.logger.logWorkspaceEvent({
      event: 'pty_session_terminated',
      workspaceId,
      metadata: { sessionId }
    });
  }

  public async terminateAllForWorkspace(workspaceId: string): Promise<void> {
    const wSet = this.workspaceActiveSessions.get(workspaceId);
    if (wSet) {
      const sessions = Array.from(wSet);
      for (const s of sessions) {
        await this.terminateSession(s, workspaceId);
      }
    }
    this.logger.logWorkspaceEvent({
      event: 'pty_session_terminated_due_to_host_power_disabled',
      workspaceId
    });
  }
}
