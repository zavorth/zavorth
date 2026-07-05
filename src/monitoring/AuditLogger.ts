import { ExecutionResult } from '../contracts/ExecutionContract.js';
import { PermissionRequest } from '../contracts/PermissionRequest.js';
import { Task } from '../contracts/TaskContract.js';
import { PolicyEvaluation } from '../security/PolicyEngine.js';
import { SecureStorageService } from '../services/SecureStorageService.js';
import { Database } from '../storage/Database.js';
import { config } from '../config/index.js';
import { SecurityAuditTrailService } from './SecurityAuditTrailService.js';

export interface AuditEvent {
  timestamp: string;
  event_type: string;
  task_id: string;
  user_id: string;
  user_input: string;
  intent: string | null;
  plan_id: string | null;
  risk_level: number;
  policy_decision: 'ALLOWED' | 'BLOCKED' | 'REQUIRES_CONFIRMATION';
  policy_violations: string | null;
  operational_mode: string;
  executor: string | null;
  execution_success: boolean | null;
  execution_summary: string | null;
  metadata: Record<string, any>;
}

type AuditLoggerRuntime = {
  secureStorage?: SecureStorageService;
  dbProvider?: Pick<typeof Database, 'getInstance'>;
  trailService?: SecurityAuditTrailService;
};

/**
 * AuditLogger records every containment pipeline step for full traceability.
 * Events are stored in the SQLite `audit_log` table.
 */
export class AuditLogger {
  private initialized = false;
  private readonly secureStorage: SecureStorageService;
  private readonly dbProvider: Pick<typeof Database, 'getInstance'>;
  private readonly trailService: SecurityAuditTrailService;

  constructor(runtime: AuditLoggerRuntime = {}) {
    this.secureStorage = runtime.secureStorage || new SecureStorageService();
    this.dbProvider = runtime.dbProvider || Database;
    this.trailService =
      runtime.trailService ||
      new SecurityAuditTrailService({
        trailDir: config.securityAuditTrailDir,
        statusFile: config.securityAuditStatusFile,
      });
  }

  /**
   * Initializes the audit table if it does not exist yet.
   */
  public async init(): Promise<void> {
    if (this.initialized) return;

    const db = await this.dbProvider.getInstance();
    db.run(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        event_type TEXT NOT NULL,
        task_id TEXT NOT NULL,
        user_id TEXT DEFAULT '',
        user_input TEXT DEFAULT '',
        intent TEXT,
        plan_id TEXT,
        risk_level INTEGER DEFAULT 0,
        policy_decision TEXT DEFAULT 'ALLOWED',
        policy_violations TEXT,
        operational_mode TEXT DEFAULT 'WORKSPACE',
        executor TEXT,
        execution_success INTEGER,
        execution_summary TEXT,
        metadata TEXT DEFAULT '{}'
      )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_audit_task_id ON audit_log(task_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp)`);

    this.initialized = true;
  }

  /**
   * Records a pipeline event in the audit table.
   */
  public async logEvent(event: AuditEvent): Promise<void> {
    await this.init();

    const db = await this.dbProvider.getInstance();
    db.run(
      `INSERT INTO audit_log (
        timestamp, event_type, task_id, user_id, user_input,
        intent, plan_id, risk_level, policy_decision, policy_violations,
        operational_mode, executor, execution_success, execution_summary, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.timestamp,
        event.event_type,
        event.task_id,
        event.user_id,
        this.secureStorage.encryptString(event.user_input),
        event.intent,
        event.plan_id,
        event.risk_level,
        event.policy_decision,
        this.secureStorage.encryptString(event.policy_violations),
        event.operational_mode,
        event.executor,
        event.execution_success === null ? null : (event.execution_success ? 1 : 0),
        this.secureStorage.encryptString(event.execution_summary),
        this.secureStorage.encryptJson(event.metadata),
      ],
    );

    try {
      this.trailService.append(event);
    } catch (error) {
      this.trailService.recordFailure(error);
    }
  }

  /**
   * Shortcut: records user input reception.
   */
  public async logInput(taskId: string, userId: string, input: string, intent: string): Promise<void> {
    await this.logEvent({
      timestamp: new Date().toISOString(),
      event_type: 'INPUT_RECEIVED',
      task_id: taskId,
      user_id: userId,
      user_input: input.substring(0, 500),
      intent,
      plan_id: null,
      risk_level: 0,
      policy_decision: 'ALLOWED',
      policy_violations: null,
      operational_mode: '',
      executor: null,
      execution_success: null,
      execution_summary: null,
      metadata: {},
    });
  }

  /**
   * Shortcut: records a policy evaluation.
   */
  public async logPolicyEvaluation(
    taskId: string,
    planId: string,
    riskLevel: number,
    mode: string,
    evaluation: PolicyEvaluation,
  ): Promise<void> {
    const decision = evaluation.allowed ? 'ALLOWED' : 'BLOCKED';
    const violations = evaluation.violations.length > 0
      ? JSON.stringify(evaluation.violations)
      : null;

    await this.logEvent({
      timestamp: new Date().toISOString(),
      event_type: 'POLICY_EVALUATED',
      task_id: taskId,
      user_id: '',
      user_input: '',
      intent: null,
      plan_id: planId,
      risk_level: riskLevel,
      policy_decision: decision,
      policy_violations: violations,
      operational_mode: mode,
      executor: null,
      execution_success: null,
      execution_summary: null,
      metadata: {
        warnings_count: evaluation.warnings.length,
        violations_count: evaluation.violations.length,
      },
    });
  }

  /**
   * Shortcut: records an execution result.
   */
  public async logExecution(
    taskId: string,
    executor: string,
    result: ExecutionResult,
  ): Promise<void> {
    await this.logEvent({
      timestamp: new Date().toISOString(),
      event_type: 'EXECUTION_COMPLETED',
      task_id: taskId,
      user_id: '',
      user_input: '',
      intent: null,
      plan_id: null,
      risk_level: 0,
      policy_decision: 'ALLOWED',
      policy_violations: null,
      operational_mode: '',
      executor,
      execution_success: result.success,
      execution_summary: result.success
        ? `OK: ${result.actions_executed.length} actions executed`
        : `FAILED: ${result.error_message}`,
      metadata: {
        files_written: result.files_written.length,
        files_deleted: result.files_deleted.length,
        commands_executed: result.commands_executed.length,
        rollback_available: result.rollback_available,
      },
    });
  }

  /**
   * Shortcut: records a security block.
   */
  public async logSecurityBlock(taskId: string, reason: string, details: Record<string, any> = {}): Promise<void> {
    await this.logEvent({
      timestamp: new Date().toISOString(),
      event_type: 'SECURITY_BLOCK',
      task_id: taskId,
      user_id: '',
      user_input: '',
      intent: null,
      plan_id: null,
      risk_level: 3,
      policy_decision: 'BLOCKED',
      policy_violations: reason,
      operational_mode: '',
      executor: null,
      execution_success: false,
      execution_summary: reason,
      metadata: details,
    });
  }

  public async logApprovalDecision(
    task: Task,
    action: 'approve' | 'reject',
    decidedBy: string | null,
    details: Record<string, any> = {},
  ): Promise<void> {
    await this.logEvent({
      timestamp: new Date().toISOString(),
      event_type: 'APPROVAL_DECISION',
      task_id: task.task_id,
      user_id: decidedBy || '',
      user_input: '',
      intent: task.intent || null,
      plan_id: null,
      risk_level: Number(task.risk_level || 0),
      policy_decision: action === 'approve' ? 'REQUIRES_CONFIRMATION' : 'BLOCKED',
      policy_violations: action === 'approve' ? null : 'Operator rejected task approval.',
      operational_mode: String(task.metadata?.operator_mode_gate ? 'OPERATOR' : ''),
      executor: task.executor_used || null,
      execution_success: action === 'approve' ? null : false,
      execution_summary: action === 'approve'
        ? 'Operator approved task execution.'
        : 'Operator rejected task execution.',
      metadata: {
        action,
        approval_status: task.approval_status,
        requires_approval: task.requires_approval,
        ...details,
      },
    });
  }

  public async logPermissionDecision(
    permission: PermissionRequest,
    action: 'approve' | 'reject' | 'grant' | 'revoke',
    decidedBy: string | null,
    details: Record<string, any> = {},
  ): Promise<void> {
    await this.logEvent({
      timestamp: new Date().toISOString(),
      event_type: 'PERMISSION_DECISION',
      task_id: permission.task_id || `permission:${permission.permission_id}`,
      user_id: decidedBy || '',
      user_input: '',
      intent: null,
      plan_id: null,
      risk_level: 0,
      policy_decision: action === 'reject' || action === 'revoke' ? 'BLOCKED' : 'REQUIRES_CONFIRMATION',
      policy_violations: null,
      operational_mode: '',
      executor: permission.executor,
      execution_success: null,
      execution_summary: `Permission ${action}: ${permission.executor}/${permission.kind}`,
      metadata: {
        action,
        permission_id: permission.permission_id,
        kind: permission.kind,
        scope: permission.scope,
        workspace: permission.workspace,
        requested_value: permission.requested_value,
        resolved_value: permission.resolved_value,
        status: permission.status,
        ...details,
      },
    });
  }

  /**
   * Reads the latest audit events.
   */
  public async getRecentEvents(limit = 20): Promise<AuditEvent[]> {
    await this.init();
    const db = await this.dbProvider.getInstance();
    const rows = db.all(
      'SELECT * FROM audit_log ORDER BY id DESC LIMIT ?',
      [limit],
    );

    return (rows || []).map((row: any) => ({
      timestamp: row.timestamp,
      event_type: row.event_type,
      task_id: row.task_id,
      user_id: row.user_id,
      user_input: this.secureStorage.decryptString(row.user_input) || '',
      intent: row.intent,
      plan_id: row.plan_id,
      risk_level: row.risk_level,
      policy_decision: row.policy_decision,
      policy_violations: this.secureStorage.decryptString(row.policy_violations),
      operational_mode: row.operational_mode,
      executor: row.executor,
      execution_success: row.execution_success === null ? null : Boolean(row.execution_success),
      execution_summary: this.secureStorage.decryptString(row.execution_summary),
      metadata: row.metadata ? this.secureStorage.decryptJson(row.metadata) : {},
    }));
  }

  /**
   * Reads events for a specific task.
   */
  public async getEventsByTask(taskId: string): Promise<AuditEvent[]> {
    await this.init();
    const db = await this.dbProvider.getInstance();
    const rows = db.all(
      'SELECT * FROM audit_log WHERE task_id = ? ORDER BY id ASC',
      [taskId],
    );

    return (rows || []).map((row: any) => ({
      timestamp: row.timestamp,
      event_type: row.event_type,
      task_id: row.task_id,
      user_id: row.user_id,
      user_input: this.secureStorage.decryptString(row.user_input) || '',
      intent: row.intent,
      plan_id: row.plan_id,
      risk_level: row.risk_level,
      policy_decision: row.policy_decision,
      policy_violations: this.secureStorage.decryptString(row.policy_violations),
      operational_mode: row.operational_mode,
      executor: row.executor,
      execution_success: row.execution_success === null ? null : Boolean(row.execution_success),
      execution_summary: this.secureStorage.decryptString(row.execution_summary),
      metadata: row.metadata ? this.secureStorage.decryptJson(row.metadata) : {},
    }));
  }
}
