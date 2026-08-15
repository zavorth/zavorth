import crypto from 'crypto';
import path from 'path';
import { Database } from '../storage/Database.js';
import { LogRepository } from '../storage/LogRepository.js';
import { SecurityAuditLogger } from './SecurityAuditLogger.js';

export class WorkspaceWriteApprovalService {
  private readonly db: Database | null;
  private readonly auditLogger: SecurityAuditLogger;

  constructor(db?: Database, auditLogger?: SecurityAuditLogger) {
    // Lazy or injected initialization
    this.db = db || Database.getActiveInstance() || null;
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
      return crypto.createHmac('sha256', 'default-zavorth-audit-key-please-change-in-production').update(val).digest('hex');
    }
    return crypto.createHmac('sha256', key).update(val).digest('hex');
  }

  private getPathSuffix(filePath: string): string {
    const filename = path.basename(filePath).toLowerCase();
    const ext = path.extname(filePath).toLowerCase();
    return ext || filename || 'redacted';
  }

  private canonicalStringify(val: any): string {
    if (val === null || typeof val !== 'object') {
      return JSON.stringify(val);
    }
    if (Array.isArray(val)) {
      return '[' + val.map(entry => this.canonicalStringify(entry)).join(',') + ']';
    }
    const keys = Object.keys(val).sort();
    const properties = keys.map(key => `${JSON.stringify(key)}:${this.canonicalStringify(val[key])}`);
    return '{' + properties.join(',') + '}';
  }

  public computeRequestHash(args: Record<string, unknown>): string {
    // Strip operationId from args to verify the base request properties match
    const cleanArgs = { ...args };
    delete cleanArgs.operationId;
    const canonical = this.canonicalStringify(cleanArgs);
    return this.hashValue(canonical);
  }

  /**
   * Registers a write/mkdir request as pending.
   * Logs workspace_write_requested event.
   */
  public async requestApproval(
    workspaceId: string,
    toolName: string,
    resolvedPath: string,
    args: Record<string, unknown>
  ): Promise<string> {
    const db = await this.getDb();
    const operationId = `write-${crypto.randomUUID()}`;
    const pathHash = this.hashValue(resolvedPath);
    const pathSuffix = this.getPathSuffix(resolvedPath);
    const requestHash = this.computeRequestHash(args);
    const createdAt = new Date().toISOString();

    // expires in 5 minutes after approved (initial status pending = 0, expires far in future until approved)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    db.run(
      `INSERT INTO workspace_write_approvals
       (operation_id, workspace_id, tool_name, path_hash, path_suffix, request_hash, approved, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [operationId, workspaceId, toolName, pathHash, pathSuffix, requestHash, expiresAt, createdAt]
    );

    this.auditLogger.logWorkspaceEvent({
      event: 'workspace_write_requested',
      workspaceId,
      toolName,
      path: resolvedPath,
      operation: 'request-approval',
      reason: operationId,
    });

    return operationId;
  }

  /**
   * Approves a pending operation (sets approved = 1, expires_at = now + 5 mins).
   * Logs workspace_write_approved.
   */
  public async approveOperation(operationId: string): Promise<void> {
    const db = await this.getDb();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const entry = db.get<{ workspace_id: string; tool_name: string; path_suffix: string; path_hash: string }>(
      'SELECT workspace_id, tool_name, path_suffix, path_hash FROM workspace_write_approvals WHERE operation_id = ?',
      [operationId]
    );

    if (!entry) {
      throw new Error(`Operation not found: ${operationId}`);
    }

    db.run(
      'UPDATE workspace_write_approvals SET approved = 1, expires_at = ? WHERE operation_id = ?',
      [expiresAt, operationId]
    );

    this.auditLogger.logWorkspaceEvent({
      event: 'workspace_write_approved',
      workspaceId: entry.workspace_id,
      toolName: entry.tool_name,
      rootPathHash: entry.path_hash,
      rootPathSuffix: entry.path_suffix,
      operation: 'approve-operation',
      reason: operationId,
    });
  }

  /**
   * Explicitly denies/deletes a pending operation.
   * Logs workspace_write_denied.
   */
  public async denyOperation(operationId: string): Promise<void> {
    const db = await this.getDb();
    const entry = db.get<{ workspace_id: string; tool_name: string; path_suffix: string; path_hash: string }>(
      'SELECT workspace_id, tool_name, path_suffix, path_hash FROM workspace_write_approvals WHERE operation_id = ?',
      [operationId]
    );

    if (!entry) {
      throw new Error(`Operation not found: ${operationId}`);
    }

    db.run('DELETE FROM workspace_write_approvals WHERE operation_id = ?', [operationId]);

    this.auditLogger.logWorkspaceEvent({
      event: 'workspace_write_denied',
      workspaceId: entry.workspace_id,
      toolName: entry.tool_name,
      rootPathHash: entry.path_hash,
      rootPathSuffix: entry.path_suffix,
      operation: 'deny-operation',
      reason: operationId,
    });
  }

  /**
   * Validates and consumes the approval entry atomically.
   * Deletes the row first before checking if it existed to guarantee single-use.
   */
  public async consumeApproval(
    workspaceId: string,
    toolName: string,
    resolvedPath: string,
    args: Record<string, unknown>,
    operationId: string
  ): Promise<boolean> {
    const db = await this.getDb();
    const pathHash = this.hashValue(resolvedPath);
    const requestHash = this.computeRequestHash(args);
    const now = new Date().toISOString();

    // In better-sqlite3, running a DELETE statement returns details on changes.
    // We can delete the row atomically only if it matches all constraints.
    // To do this, we get SQLite DB raw instance and run prepare + run, returning changes count.
    const rawDb = db.getRawDb();
    const stmt = rawDb.prepare(`
      DELETE FROM workspace_write_approvals
      WHERE operation_id = ?         AND workspace_id = ?         AND tool_name = ?         AND path_hash = ?         AND request_hash = ?         AND approved = 1
        AND expires_at > ?     `);
    const info = stmt.run(operationId, workspaceId, toolName, pathHash, requestHash, now);

    // If exactly 1 row was deleted, it means the approval was valid and has now been consumed.
    return info.changes === 1;
  }
}
