import { createHash } from 'crypto';
import { Database } from '../storage/Database';
import { SecurityAuditLogger } from './SecurityAuditLogger';
import { v4 as uuidv4 } from 'uuid';

export interface PtyInputApprovalProposal {
  operationId: string;
  sessionId: string;
  workspaceId: string;
  inputHash: string;
  inputPreviewRedacted: string;
  riskLevel: 'LOW' | 'HIGH' | 'CRITICAL';
  status: 'pending' | 'approved' | 'denied' | 'expired' | 'consumed';
  createdAt: string;
  expiresAt: string;
  requiresStrongConfirmation: boolean;
}

export class PtyInputApprovalService {
  private db: Database | null = null;
  private logger: SecurityAuditLogger;
  private readonly PROPOSAL_TTL_MS = 5 * 60 * 1000; // 5 minutes to approve input

  constructor(db?: Database, logger?: SecurityAuditLogger) {
    this.db = db || null;
    this.logger = logger as SecurityAuditLogger;
  }

  private async getDb(): Promise<Database> {
    if (this.db) return this.db;
    return await Database.getInstance();
  }

  public async proposeInput(
    workspaceId: string,
    sessionId: string,
    inputRaw: string,
    sanitizedInput: string,
    riskLevel: 'LOW' | 'HIGH' | 'CRITICAL',
    requiresStrongConfirmation: boolean
  ): Promise<PtyInputApprovalProposal> {
    const operationId = `pty_in_${uuidv4().replace(/-/g, '')}`;
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + this.PROPOSAL_TTL_MS).toISOString();

    const inputHash = this.hashId(inputRaw);
    const inputPreviewRedacted = sanitizedInput.substring(0, 200); // Only preview up to 200 chars safely

    const strongConfirmationPhrase = requiresStrongConfirmation ? 'RUN' : null;

    const db = await this.getDb();
    await db.run(
      `INSERT INTO workspace_pty_input_approvals
        (operation_id, session_id, workspace_id, input_hash, input_preview_redacted, risk_level, status, created_at, expires_at, requires_strong_confirmation, strong_confirmation_phrase)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [operationId, sessionId, workspaceId, inputHash, inputPreviewRedacted, riskLevel, 'pending', createdAt, expiresAt, requiresStrongConfirmation ? 1 : 0, strongConfirmationPhrase]
    );

    this.logger.logWorkspaceEvent({
      event: 'pty_input_requested',
      workspaceId,
      riskLevel,
      metadata: { sessionId, operationId, inputPreviewRedacted, requiresStrongConfirmation }
    });

    if (requiresStrongConfirmation) {
      this.logger.logWorkspaceEvent({
        event: 'critical_pty_input_strong_confirmation_required',
        workspaceId,
        metadata: { sessionId, operationId }
      });
    }

    return {
      operationId,
      sessionId,
      workspaceId,
      inputHash,
      inputPreviewRedacted,
      riskLevel,
      status: 'pending',
      createdAt,
      expiresAt,
      requiresStrongConfirmation
    };
  }

  public async getPendingProposals(workspaceId: string): Promise<PtyInputApprovalProposal[]> {
    const now = new Date().toISOString();
    const db = await this.getDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await db.all<any>(
      `SELECT * FROM workspace_pty_input_approvals
       WHERE workspace_id = ? AND status = 'pending' AND expires_at > ?`,
      [workspaceId, now]
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rows.map((r: any) => ({
      operationId: r.operation_id,
      sessionId: r.session_id,
      workspaceId: r.workspace_id,
      inputHash: r.input_hash,
      inputPreviewRedacted: r.input_preview_redacted,
      riskLevel: r.risk_level,
      status: r.status,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      requiresStrongConfirmation: r.requires_strong_confirmation === 1
    }));
  }

  public async resolveProposal(
    workspaceId: string,
    operationId: string,
    approve: boolean,
    strongConfirmationInput?: string
  ): Promise<void> {
    const now = new Date().toISOString();
    const db = await this.getDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = await db.get<any>(
      `SELECT * FROM workspace_pty_input_approvals WHERE operation_id = ? AND workspace_id = ?`,
      [operationId, workspaceId]
    );

    if (!row) {
      throw new Error(`PTY input proposal not found: ${operationId}`);
    }

    if (row.status !== 'pending') {
      throw new Error(`PTY input proposal is not pending (status: ${row.status})`);
    }

    if (row.expires_at < now) {
      await db.run(`UPDATE workspace_pty_input_approvals SET status = 'expired' WHERE operation_id = ?`, [operationId]);
      throw new Error(`PTY input proposal has expired.`);
    }

    if (approve && row.requires_strong_confirmation === 1) {
      if (strongConfirmationInput !== row.strong_confirmation_phrase) {
        this.logger.logWorkspaceEvent({
          event: 'critical_pty_input_strong_confirmation_failed',
          workspaceId,
          metadata: { sessionId: row.session_id, operationId }
        });
        throw new Error(`Strong confirmation failed. Expected '${row.strong_confirmation_phrase}'.`);
      }
      this.logger.logWorkspaceEvent({
        event: 'critical_pty_input_strong_confirmation_passed',
        workspaceId,
        metadata: { sessionId: row.session_id, operationId }
      });
    }

    const newStatus = approve ? 'approved' : 'denied';

    await db.run(
      `UPDATE workspace_pty_input_approvals SET status = ? WHERE operation_id = ?`,
      [newStatus, operationId]
    );

    this.logger.logWorkspaceEvent({
      event: approve ? 'pty_input_approved' : 'pty_input_blocked',
      workspaceId,
      metadata: { sessionId: row.session_id, operationId, action: approve ? 'approved' : 'denied' }
    });
  }

  public async consumeApprovedInputHash(workspaceId: string, sessionId: string, inputRaw: string): Promise<boolean> {
    const db = await this.getDb();
    const inputHash = this.hashId(inputRaw);
    const now = new Date().toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = await db.get<any>(
      "SELECT operation_id FROM workspace_pty_input_approvals WHERE session_id = ? AND workspace_id = ? AND input_hash = ? AND status = 'approved' AND expires_at > ?",
      [sessionId, workspaceId, inputHash, now]
    );

    if (!row) return false;

    await db.run("UPDATE workspace_pty_input_approvals SET status = 'consumed' WHERE operation_id = ?", [row.operation_id]);

    this.logger.logWorkspaceEvent({
      event: 'pty_input_sent',
      workspaceId,
      metadata: { sessionId, operationId: row.operation_id, status: 'consumed' }
    });

    return true;
  }

  private hashId(val: string): string {
    return createHash('sha256').update(val).digest('hex');
  }
}

