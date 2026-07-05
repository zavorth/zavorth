import crypto from 'crypto';
import path from 'path';
import { Database } from '../storage/Database.js';
import { SecurityAuditLogger } from './SecurityAuditLogger.js';
import { LogRepository } from '../storage/LogRepository.js';
import { HostCommandPayloadCache } from './HostCommandPayloadCache.js';

export interface HostProposalRow {
  operation_id: string;
  workspace_id: string;
  command_hash: string;
  command_preview_redacted: string;
  args_hash: string;
  args_preview_redacted: string;
  cwd_hash: string;
  cwd_suffix: string;
  shell: number;
  risk_level: string;
  reason_redacted: string;
  approved: number;
  expires_at: string;
  created_at: string;
  requires_strong_confirmation: number;
  strong_confirmation_phrase: string | null;
}

export class HostCommandApprovalService {
  private readonly db: Database | null;
  private readonly auditLogger: SecurityAuditLogger;
  private readonly payloadCache: HostCommandPayloadCache;

  constructor(db?: Database, auditLogger?: SecurityAuditLogger, payloadCache?: HostCommandPayloadCache) {
    this.db = db || Database.getActiveInstance() || null;
    this.auditLogger = auditLogger || new SecurityAuditLogger(new LogRepository());
    this.payloadCache = payloadCache || HostCommandPayloadCache.getInstance();
  }

  private async getDb(): Promise<Database> {
    if (this.db) {
      return this.db;
    }
    return Database.getInstance();
  }

  public hashValue(val: string): string {
    const key = process.env.ZAVORTH_AUDIT_HASH_KEY;
    if (!key) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('ZAVORTH_AUDIT_HASH_KEY environment variable is required in production.');
      }
      return crypto.createHmac('sha256', 'default-zavorth-host-command-key').update(val).digest('hex');
    }
    return crypto.createHmac('sha256', key).update(val).digest('hex');
  }

  public classifyRisk(command: string, args: string[], shell: boolean): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const normalizedCmd = command.trim().toLowerCase();
    const cmdBinary = path.basename(normalizedCmd).replace(/\.(exe|cmd|bat)$/i, '');

    // 1. shell:true is HIGH minimum
    let baseRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (shell) {
      baseRisk = 'HIGH';
    }

    // 2. Interpreters are HIGH minimum
    const interpreters = ['powershell', 'pwsh', 'cmd', 'bash', 'sh', 'zsh', 'fish'];
    if (interpreters.includes(cmdBinary)) {
      baseRisk = 'HIGH';
    }

    // Combine command string and arguments to search for destructive operations or secrets
    const fullText = (command + ' ' + args.join(' ')).toLowerCase();

    // 3. Destructive patterns or direct secret leakage escalates to CRITICAL
    const destructivePatterns = [
      /\brm\s+-rf\b/i,
      /\bdel\s+\/s\b/i,
      /\bformat\s/i,
      /\bmkfs\b/i,
      /\bdd\s/i,
      /\bshutdown\b/i,
      /\breboot\b/i,
      /\bdrop\s+table\b/i,
      /\bdrop\s+database\b/i,
      /\bdelete\s+from\b/i
    ];

    const hasDestructive = destructivePatterns.some(p => p.test(fullText));
    const hasSecretPattern = /(?:api[_-]?key|token|secret|password|passwd|jwt|private[_-]?key)\s*[:=]\s*["']?[a-zA-Z0-9_\-.~%+]{8,}/i.test(fullText);

    if (hasDestructive || hasSecretPattern) {
      return 'CRITICAL';
    }

    return baseRisk;
  }

  public redactSecrets(text: string): string {
    const assignmentPattern = /((?:api[_-]?key|token|secret|password|passwd|passphrase|private[_-]?key|auth|credential|jwt|bearer|key)\s*[:=]\s*["']?)([a-zA-Z0-9_\-.~%+]{8,})(["']?)/gi;
    let redacted = text.replace(assignmentPattern, '$1[REDACTED]$3');

    const githubTokenPattern = /\b(gh[pous]_)[a-zA-Z0-9]{36,}\b/g;
    redacted = redacted.replace(githubTokenPattern, '$1[REDACTED]');

    const awsKeyPattern = /\b(AKIA)[A-Z0-9]{16}\b/g;
    redacted = redacted.replace(awsKeyPattern, '$1[REDACTED]');

    const slackTokenPattern = /\b(xox[baprs]-[0-9]{10,12}-)[a-zA-Z0-9]{24,48}\b/g;
    redacted = redacted.replace(slackTokenPattern, '$1[REDACTED]');

    const openAiKeyPattern = /\b(sk-)[a-zA-Z0-9]{48,}\b/g;
    redacted = redacted.replace(openAiKeyPattern, '$1[REDACTED]');

    return redacted;
  }

  private getCwdSuffix(cwd: string): string {
    const normalized = cwd.replace(/\\/g, '/');
    const segments = normalized.split('/').filter(Boolean);
    if (segments.length <= 2) {
      return normalized;
    }
    return segments.slice(-2).join('/');
  }

  public async propose(
    workspaceId: string,
    command: string,
    args: string[],
    cwd: string,
    shell: boolean,
    reason: string
  ): Promise<{ operationId: string; riskLevel: string; approved: boolean }> {
    const db = await this.getDb();
    const operationId = `hcmd-${crypto.randomUUID()}`;

    // Risk assessment
    const riskLevel = this.classifyRisk(command, args, shell);

    // DB has no plain-text commands, args or cwd
    const commandHash = this.hashValue(command);
    const commandPreview = this.redactSecrets(command).slice(0, 100);

    const argsJson = JSON.stringify(args);
    const argsHash = this.hashValue(argsJson);
    const argsPreview = this.redactSecrets(argsJson).slice(0, 150);

    const cwdHash = this.hashValue(cwd);
    const cwdSuffix = this.getCwdSuffix(cwd);

    const reasonRedacted = this.redactSecrets(reason).slice(0, 200);

    const requiresStrong = riskLevel === 'CRITICAL' ? 1 : 0;
    const strongPhrase = riskLevel === 'CRITICAL' ? 'RUN' : null;

    const createdAt = new Date().toISOString();
    // Expires in 30 minutes if not approved/resolved
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    db.run(
      `INSERT INTO workspace_host_command_proposals (
        operation_id, workspace_id, command_hash, command_preview_redacted,
        args_hash, args_preview_redacted, cwd_hash, cwd_suffix,
        shell, risk_level, reason_redacted, approved, expires_at, created_at,
        requires_strong_confirmation, strong_confirmation_phrase
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [
        operationId, workspaceId, commandHash, commandPreview,
        argsHash, argsPreview, cwdHash, cwdSuffix,
        shell ? 1 : 0, riskLevel, reasonRedacted, expiresAt, createdAt,
        requiresStrong, strongPhrase
      ]
    );

    // Save actual command payload securely in memory transit cache
    this.payloadCache.set(operationId, command, args, cwd);

    this.auditLogger.logWorkspaceEvent({
      event: 'host_command_proposed',
      workspaceId,
      toolName: 'workspace.host_command.propose',
      operation: 'propose',
      reason: operationId,
      metadata: {
        commandHash,
        argsHash,
        cwdHash,
        riskLevel,
        shell
      }
    });

    return {
      operationId,
      riskLevel,
      approved: false
    };
  }

  public async resolve(
    operationId: string,
    approved: boolean,
    strongConfirmationInput?: string
  ): Promise<void> {
    const db = await this.getDb();
    const proposal = db.get<HostProposalRow>(
      'SELECT * FROM workspace_host_command_proposals WHERE operation_id = ?',
      [operationId]
    );

    if (!proposal) {
      throw new Error(`Host command proposal not found: ${operationId}`);
    }

    if (!approved) {
      // Deny and clean up proposal + payload cache
      db.run('DELETE FROM workspace_host_command_proposals WHERE operation_id = ?', [operationId]);
      this.payloadCache.delete(operationId);

      this.auditLogger.logWorkspaceEvent({
        event: 'host_command_denied',
        workspaceId: proposal.workspace_id,
        toolName: 'workspace.host_command.resolve',
        operation: 'deny',
        reason: operationId
      });
      return;
    }

    // For CRITICAL risk level, strong confirmation phrasing is checked on backend
    if (proposal.requires_strong_confirmation === 1) {
      if (strongConfirmationInput !== proposal.strong_confirmation_phrase) {
        throw new Error(`CRITICAL commands require the confirmation phrase "${proposal.strong_confirmation_phrase}" to resolve.`);
      }
    }

    // TTL for approved commands is set to 30 minutes maximum (single-use limits)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    db.run(
      'UPDATE workspace_host_command_proposals SET approved = 1, expires_at = ? WHERE operation_id = ?',
      [expiresAt, operationId]
    );

    this.auditLogger.logWorkspaceEvent({
      event: 'host_command_approved',
      workspaceId: proposal.workspace_id,
      toolName: 'workspace.host_command.resolve',
      operation: 'approve',
      reason: operationId,
      metadata: {
        riskLevel: proposal.risk_level,
        shell: proposal.shell === 1
      }
    });
  }

  public async consumeApproval(
    workspaceId: string,
    operationId: string,
    command: string,
    args: string[],
    cwd: string,
    shell: boolean,
    riskLevel: string
  ): Promise<boolean> {
    const db = await this.getDb();
    const commandHash = this.hashValue(command);
    const argsHash = this.hashValue(JSON.stringify(args));
    const cwdHash = this.hashValue(cwd);
    const now = new Date().toISOString();

    const rawDb = db.getRawDb();
    // Atomic DELETE checks matching operation, workspace, hashes, shell, risk level, and approved status
    const stmt = rawDb.prepare(`
      DELETE FROM workspace_host_command_proposals
      WHERE operation_id = ?
        AND workspace_id = ?
        AND command_hash = ?
        AND args_hash = ?
        AND cwd_hash = ?
        AND shell = ?
        AND risk_level = ?
        AND approved = 1
        AND expires_at > ?
    `);

    const info = stmt.run(
      operationId,
      workspaceId,
      commandHash,
      argsHash,
      cwdHash,
      shell ? 1 : 0,
      riskLevel,
      now
    );

    return info.changes === 1;
  }
}
