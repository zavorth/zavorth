import crypto from 'crypto';
import { Database } from '../storage/Database.js';
import { LogRepository } from '../storage/LogRepository.js';
import { SecurityAuditLogger } from './SecurityAuditLogger.js';

export class WorkspaceCommandApprovalService {
  private readonly db: Database;
  private readonly auditLogger: SecurityAuditLogger;

  constructor(db?: Database, auditLogger?: SecurityAuditLogger) {
    this.db = db || (Database as any).instance || null;
    this.auditLogger = auditLogger || new SecurityAuditLogger(new LogRepository());
  }

  private async getDb(): Promise<Database> {
    if (this.db) {
      return this.db;
    }
    return Database.getInstance();
  }

  private hashValue(val: string): string {
    const key = process.env.ZAVORTH_AUDIT_HASH_KEY;
    if (!key) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('ZAVORTH_AUDIT_HASH_KEY environment variable is required in production.');
      }
      return crypto.createHmac('sha256', 'default-zavorth-command-key-please-change-in-production').update(val).digest('hex');
    }
    return crypto.createHmac('sha256', key).update(val).digest('hex');
  }

  /**
   * Registers a proposed command as pending or pre-approved.
   */
  public async requestApproval(
    workspaceId: string,
    command: string,
    approved: boolean = false
  ): Promise<string> {
    const db = await this.getDb();
    const operationId = `cmd-${crypto.randomUUID()}`;
    const argsHash = this.hashValue(command);
    const createdAt = new Date().toISOString();
    
    // Expires in 5 minutes if approved, or 30 minutes if pending approval
    const duration = approved ? 5 * 60 * 1000 : 30 * 60 * 1000;
    const expiresAt = new Date(Date.now() + duration).toISOString();

    db.run(
      `INSERT INTO workspace_command_approvals
       (operation_id, workspace_id, command, args_hash, approved, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [operationId, workspaceId, command, argsHash, approved ? 1 : 0, expiresAt, createdAt]
    );

    this.auditLogger.logWorkspaceEvent({
      event: approved ? 'command_auto_approved' : 'command_approval_requested',
      workspaceId,
      toolName: 'workspace.command.propose',
      operation: 'request-approval',
      reason: operationId,
      metadata: { argsHash }
    });

    return operationId;
  }

  /**
   * Approves a pending command approval.
   */
  public async approveOperation(operationId: string): Promise<void> {
    const db = await this.getDb();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const entry = db.get<{ workspace_id: string; command: string; args_hash: string }>(
      'SELECT workspace_id, command, args_hash FROM workspace_command_approvals WHERE operation_id = ?',
      [operationId]
    );

    if (!entry) {
      throw new Error(`Command operation not found: ${operationId}`);
    }

    db.run(
      'UPDATE workspace_command_approvals SET approved = 1, expires_at = ? WHERE operation_id = ?',
      [expiresAt, operationId]
    );

    this.auditLogger.logWorkspaceEvent({
      event: 'command_approved',
      workspaceId: entry.workspace_id,
      toolName: 'workspace.command.propose',
      operation: 'approve-operation',
      reason: operationId,
      metadata: { argsHash: entry.args_hash }
    });
  }

  /**
   * Denies / deletes a pending command approval.
   */
  public async denyOperation(operationId: string): Promise<void> {
    const db = await this.getDb();
    const entry = db.get<{ workspace_id: string; args_hash: string }>(
      'SELECT workspace_id, args_hash FROM workspace_command_approvals WHERE operation_id = ?',
      [operationId]
    );

    if (!entry) {
      throw new Error(`Command operation not found: ${operationId}`);
    }

    db.run('DELETE FROM workspace_command_approvals WHERE operation_id = ?', [operationId]);

    this.auditLogger.logWorkspaceEvent({
      event: 'command_denied',
      workspaceId: entry.workspace_id,
      toolName: 'workspace.command.propose',
      operation: 'deny-operation',
      reason: operationId,
      metadata: { argsHash: entry.args_hash }
    });
  }

  /**
   * Validates and consumes the approval entry atomically.
   */
  public async consumeApproval(
    workspaceId: string,
    command: string,
    operationId: string
  ): Promise<boolean> {
    const db = await this.getDb();
    const argsHash = this.hashValue(command);
    const now = new Date().toISOString();

    const rawDb = db.getRawDb();
    const stmt = rawDb.prepare(`
      DELETE FROM workspace_command_approvals
      WHERE operation_id = ?
        AND workspace_id = ?
        AND args_hash = ?
        AND approved = 1
        AND expires_at > ?
    `);
    const info = stmt.run(operationId, workspaceId, argsHash, now);

    return info.changes === 1;
  }
}
