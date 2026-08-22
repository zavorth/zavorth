import { createHash } from 'crypto';
import { Database } from '../storage/Database';
import { SecurityAuditLogger } from './SecurityAuditLogger';
import { v4 as uuidv4 } from 'uuid';

export interface PtySessionProposal {
  sessionId: string;
  workspaceId: string;
  shell: string;
  cwdHash: string;
  cwdSuffix: string;
  riskLevel: 'LOW' | 'HIGH' | 'CRITICAL';
  status: 'pending' | 'approved' | 'denied' | 'expired' | 'terminated';
  reasonRedacted: string;
  createdAt: string;
  expiresAt: string;
}

export class PtySessionApprovalService {
  private db: Database | null = null;
  private logger: SecurityAuditLogger;
  private readonly PROPOSAL_TTL_MS = 5 * 60 * 1000; // 5 minutes to approve
  private readonly SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour max session life

  constructor(db?: Database, logger?: SecurityAuditLogger) {
    this.db = db || null;
    // We avoid creating a new logger if one wasn't passed, but for tests we can.
    // In actual runtime, the singleton logger from RouteService or ToolRuntime should be used.
    // We'll just cast or use a fallback if absolutely necessary.
    this.logger = logger as SecurityAuditLogger;
  }

  private async getDb(): Promise<Database> {
    if (this.db) return this.db;
    return await Database.getInstance();
  }

  public async proposeSession(
    workspaceId: string,
    shell: string,
    cwdRaw: string,
    riskLevel: 'LOW' | 'HIGH' | 'CRITICAL',
    reasonRaw: string
  ): Promise<PtySessionProposal> {
    const sessionId = `pty_${uuidv4().replace(/-/g, '')}`;
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + this.PROPOSAL_TTL_MS).toISOString();

    const cwdHash = this.hashId(cwdRaw);
    const cwdSuffix = this.getSuffix(cwdRaw);
    const reasonRedacted = this.redactReason(reasonRaw);

    const db = await this.getDb();
    await db.run(
      `INSERT INTO workspace_pty_sessions
        (session_id, workspace_id, shell, cwd_hash, cwd_suffix, risk_level, status, reason_redacted, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sessionId, workspaceId, shell, cwdHash, cwdSuffix, riskLevel, 'pending', reasonRedacted, createdAt, expiresAt]
    );

    this.logger.logWorkspaceEvent({
      event: 'pty_session_requested',
      workspaceId,
      path: cwdRaw,
      riskLevel,
      reason: reasonRedacted,
      metadata: { sessionId, shell }
    });

    return {
      sessionId,
      workspaceId,
      shell,
      cwdHash,
      cwdSuffix,
      riskLevel,
      status: 'pending',
      reasonRedacted,
      createdAt,
      expiresAt
    };
  }

  public async getPendingProposals(workspaceId: string): Promise<PtySessionProposal[]> {
    const now = new Date().toISOString();
    const db = await this.getDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await db.all<any>(
      `SELECT * FROM workspace_pty_sessions
       WHERE workspace_id = ? AND status = 'pending' AND expires_at > ?`,
      [workspaceId, now]
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rows.map((r: any) => ({
      sessionId: r.session_id,
      workspaceId: r.workspace_id,
      shell: r.shell,
      cwdHash: r.cwd_hash,
      cwdSuffix: r.cwd_suffix,
      riskLevel: r.risk_level,
      status: r.status,
      reasonRedacted: r.reason_redacted,
      createdAt: r.created_at,
      expiresAt: r.expires_at
    }));
  }

  public async resolveProposal(
    workspaceId: string,
    sessionId: string,
    approve: boolean
  ): Promise<void> {
    const now = new Date().toISOString();
    const db = await this.getDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = await db.get<any>(
      `SELECT * FROM workspace_pty_sessions WHERE session_id = ? AND workspace_id = ?`,
      [sessionId, workspaceId]
    );

    if (!row) {
      throw new Error(`PTY session proposal not found: ${sessionId}`);
    }

    if (row.status !== 'pending') {
      throw new Error(`PTY session proposal is not pending (status: ${row.status})`);
    }

    if (row.expires_at < now) {
      await db.run(`UPDATE workspace_pty_sessions SET status = 'expired' WHERE session_id = ?`, [sessionId]);
      this.logger.logWorkspaceEvent({
        event: 'pty_session_expired',
        workspaceId,
        metadata: { sessionId }
      });
      throw new Error(`PTY session proposal has expired.`);
    }

    const newStatus = approve ? 'approved' : 'denied';
    // If approved, extend the expiration to the session TTL
    const newExpiresAt = approve ? new Date(Date.now() + this.SESSION_TTL_MS).toISOString() : row.expires_at;

    await db.run(
      `UPDATE workspace_pty_sessions SET status = ?, expires_at = ? WHERE session_id = ?`,
      [newStatus, newExpiresAt, sessionId]
    );

    this.logger.logWorkspaceEvent({
      event: approve ? 'pty_session_approved' : 'pty_session_denied',
      workspaceId,
      metadata: { sessionId }
    });
  }

  public async updateSessionStatus(sessionId: string, status: 'terminated' | 'expired'): Promise<void> {
    const db = await this.getDb();
    await db.run(`UPDATE workspace_pty_sessions SET status = ? WHERE session_id = ?`, [status, sessionId]);
  }

  public async getApprovedSession(sessionId: string, workspaceId: string): Promise<PtySessionProposal | null> {
    const db = await this.getDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = await db.get<any>(
      `SELECT * FROM workspace_pty_sessions WHERE session_id = ? AND workspace_id = ? AND status = 'approved'`,
      [sessionId, workspaceId]
    );
    if (!row) return null;

    if (row.expires_at < new Date().toISOString()) {
      await this.updateSessionStatus(sessionId, 'expired');
      return null;
    }

    return {
      sessionId: row.session_id,
      workspaceId: row.workspace_id,
      shell: row.shell,
      cwdHash: row.cwd_hash,
      cwdSuffix: row.cwd_suffix,
      riskLevel: row.risk_level,
      status: row.status,
      reasonRedacted: row.reason_redacted,
      createdAt: row.created_at,
      expiresAt: row.expires_at
    };
  }

  private hashId(val: string): string {
    return createHash('sha256').update(val).digest('hex');
  }

  private getSuffix(val: string): string {
    return val.length > 8 ? val.substring(val.length - 8) : val;
  }

  private redactReason(reason: string): string {
    let r = reason;
    r = r.replace(/(eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)/g, '[REDACTED_JWT]');
    r = r.replace(/([a-zA-Z0-9]{32,})/g, '[REDACTED_TOKEN_OR_HASH]');
    return r;
  }
}
