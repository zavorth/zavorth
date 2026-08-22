import path from 'path';
import crypto from 'crypto';
import { SecurityAuditLogger } from './SecurityAuditLogger.js';
import { LogRepository } from '../storage/LogRepository.js';
import { WorkspaceResolver } from '../security/WorkspaceResolver.js';

export interface WorkspaceTaskMandate {
  mandateId: string;
  workspaceId: string;
  taskId?: string; // Binds the mandate to the active task to prevent hijacking
  description: string;
  targetDirectories: string[]; // absolute canonical paths inside the active workspace
  allowedOperations: Array<
    | 'filesystem.read'
    | 'filesystem.write'
    | 'filesystem.mkdir'
    | 'filesystem.move' // Reserved but inactive
    | 'command.run'
  >;
  allowedBinaries: string[]; // e.g. ["git", "npm", "node", "pnpm", "yarn"]
  maxRiskLevel: 'LOW' | 'MEDIUM';
  allowPackageInstall: boolean;
  allowNetwork: boolean;
  expiresAt: string;
  createdAt: string;
}

export class WorkspaceTaskMandateService {
  private static instance: WorkspaceTaskMandateService | null = null;
  private readonly proposedByWorkspace: Map<string, WorkspaceTaskMandate> = new Map();
  private readonly activeByWorkspace: Map<string, WorkspaceTaskMandate> = new Map();
  private readonly auditLogger: SecurityAuditLogger;

  constructor(auditLogger?: SecurityAuditLogger) {
    this.auditLogger = auditLogger || new SecurityAuditLogger(new LogRepository());
  }

  public static getInstance(): WorkspaceTaskMandateService {
    if (!WorkspaceTaskMandateService.instance) {
      WorkspaceTaskMandateService.instance = new WorkspaceTaskMandateService();
    }
    return WorkspaceTaskMandateService.instance;
  }

  public static resetInstance(): void {
    WorkspaceTaskMandateService.instance = null;
  }

  private hashValue(val: string): string {
    const key = process.env.ZAVORTH_AUDIT_HASH_KEY;
    if (!key) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('ZAVORTH_AUDIT_HASH_KEY environment variable is required in production.');
      }
      return crypto.createHmac('sha256', 'default-zavorth-mandate-key-please-change-in-production').update(val).digest('hex');
    }
    return crypto.createHmac('sha256', key).update(val).digest('hex');
  }

  private getRelativePath(absolutePath: string, workspaceRoot: string): string {
    const relative = path.relative(workspaceRoot, absolutePath);
    return relative.replace(/\\/g, '/');
  }

  /**
   * Proposes a mandate for a workspace.
   */
  public proposeMandate(
    workspaceId: string,
    mandateData: Omit<WorkspaceTaskMandate, 'mandateId' | 'expiresAt' | 'createdAt' | 'workspaceId'>
  ): WorkspaceTaskMandate {
    const mandateId = `mandate-${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    // Expiry will be calculated when approved/resolved. Setting a placeholder for now.
    const expiresAt = '';

    // Target directories must be validated to be inside workspaceRoot
    const workspaceRoot = WorkspaceResolver.resolve(workspaceId);
    const resolvedTargets = mandateData.targetDirectories.map(dir => {
      return WorkspaceResolver.ensurePathInsideWorkspace(workspaceRoot, dir);
    });

    const proposed: WorkspaceTaskMandate = {
      ...mandateData,
      workspaceId,
      targetDirectories: resolvedTargets,
      mandateId,
      expiresAt,
      createdAt
    };

    this.proposedByWorkspace.set(workspaceId, proposed);

    // Audit logs should not show absolute path complete
    const relativeTargets = proposed.targetDirectories.map(dir => this.getRelativePath(dir, workspaceRoot));
    const targetHashes = proposed.targetDirectories.map(dir => this.hashValue(dir));

    this.auditLogger.logWorkspaceEvent({
      event: 'workspace_task_mandate_requested',
      workspaceId,
      toolName: 'workspace.task_mandate',
      operation: 'propose',
      reason: proposed.description,
      metadata: {
        mandateId,
        taskId: proposed.taskId,
        targetDirectoriesRelative: relativeTargets,
        targetDirectoriesHashes: targetHashes,
        allowedOperations: proposed.allowedOperations,
        allowedBinaries: proposed.allowedBinaries,
        maxRiskLevel: proposed.maxRiskLevel,
        allowPackageInstall: proposed.allowPackageInstall,
        allowNetwork: proposed.allowNetwork
      }
    });

    return proposed;
  }

  /**
   * Resolves a proposed mandate (Approve / Deny).
   */
  public resolveMandate(workspaceId: string, approved: boolean): WorkspaceTaskMandate | null {
    const proposed = this.proposedByWorkspace.get(workspaceId);
    if (!proposed) {
      return null;
    }

    const workspaceRoot = WorkspaceResolver.resolve(workspaceId);
    const relativeTargets = proposed.targetDirectories.map(dir => this.getRelativePath(dir, workspaceRoot));
    const targetHashes = proposed.targetDirectories.map(dir => this.hashValue(dir));

    if (approved) {
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const active: WorkspaceTaskMandate = {
        ...proposed,
        expiresAt
      };

      this.activeByWorkspace.set(workspaceId, active);
      this.proposedByWorkspace.delete(workspaceId);

      this.auditLogger.logWorkspaceEvent({
        event: 'workspace_task_mandate_approved',
        workspaceId,
        toolName: 'workspace.task_mandate',
        operation: 'resolve',
        reason: active.mandateId,
        metadata: {
          taskId: active.taskId,
          expiresAt,
          targetDirectoriesRelative: relativeTargets,
          targetDirectoriesHashes: targetHashes
        }
      });

      return active;
    } else {
      this.proposedByWorkspace.delete(workspaceId);

      this.auditLogger.logWorkspaceEvent({
        event: 'workspace_task_mandate_denied',
        workspaceId,
        toolName: 'workspace.task_mandate',
        operation: 'resolve',
        reason: proposed.mandateId,
        metadata: {
          taskId: proposed.taskId
        }
      });

      return null;
    }
  }

  /**
   * Revokes an active mandate.
   */
  public revokeMandate(workspaceId: string): void {
    const active = this.activeByWorkspace.get(workspaceId);
    this.activeByWorkspace.delete(workspaceId);
    this.proposedByWorkspace.delete(workspaceId);

    if (active) {
      this.auditLogger.logWorkspaceEvent({
        event: 'workspace_task_mandate_revoked',
        workspaceId,
        toolName: 'workspace.task_mandate',
        operation: 'revoke',
        reason: active.mandateId,
        metadata: {
          taskId: active.taskId
        }
      });
    }
  }

  public getProposedMandate(workspaceId: string): WorkspaceTaskMandate | null {
    return this.proposedByWorkspace.get(workspaceId) || null;
  }

  public getActiveMandate(workspaceId: string): WorkspaceTaskMandate | null {
    const mandate = this.activeByWorkspace.get(workspaceId);
    if (!mandate) {
      return null;
    }

    // Expired check using numeric parse
    if (Date.now() > Date.parse(mandate.expiresAt)) {
      this.activeByWorkspace.delete(workspaceId);

      this.auditLogger.logWorkspaceEvent({
        event: 'workspace_task_mandate_expired',
        workspaceId,
        toolName: 'workspace.task_mandate',
        operation: 'check-expiry',
        reason: mandate.mandateId,
        metadata: {
          taskId: mandate.taskId
        }
      });
      return null;
    }

    return mandate;
  }

  public checkCommandApproval(
    workspaceId: string,
    workspaceRoot: string,
    command: string,
    cwd: string,
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  ): { allowed: boolean; reason: string; blockFallback: boolean } {
    const activeMandate = this.getActiveMandate(workspaceId);
    if (!activeMandate) {
      return { allowed: false, reason: 'No active mandate', blockFallback: false };
    }

    // Check operation
    if (!activeMandate.allowedOperations.includes('command.run')) {
      this.logScopeViolation(workspaceId, activeMandate, 'command', 'command.run is not allowed by mandate');
      return { allowed: false, reason: 'command.run not permitted by mandate', blockFallback: true };
    }

    // Risk level checks
    let riskAllowed = false;
    if (activeMandate.maxRiskLevel === 'MEDIUM') {
      riskAllowed = riskLevel === 'LOW' || riskLevel === 'MEDIUM';
    } else {
      riskAllowed = riskLevel === 'LOW';
    }

    if (!riskAllowed) {
      this.logScopeViolation(workspaceId, activeMandate, 'command', `Risk level ${riskLevel} exceeds maxRiskLevel ${activeMandate.maxRiskLevel}`);
      return { allowed: false, reason: `Risk level ${riskLevel} exceeds mandate maxRiskLevel`, blockFallback: true };
    }

    // Parse binary name
    const parsed = this.parseCommand(command);
    if (!parsed) {
      this.logScopeViolation(workspaceId, activeMandate, 'command', `Failed to parse command binary: ${command}`);
      return { allowed: false, reason: 'Command parsing failed', blockFallback: true };
    }

    const binaryBase = path.basename(parsed.binary).replace(/\.(exe|cmd|bat)$/i, '').toLowerCase();

    // Check allowed binaries
    const isBinaryAllowed = activeMandate.allowedBinaries.some(b => b.toLowerCase() === binaryBase);
    if (!isBinaryAllowed) {
      this.logScopeViolation(workspaceId, activeMandate, 'command', `Binary '${binaryBase}' is not allowed by mandate`);
      return { allowed: false, reason: `Binary '${binaryBase}' not allowed by mandate`, blockFallback: true };
    }

    // Check target directory for execution cwd
    const isCwdAllowed = this.isPathInTargetDirectories(cwd, activeMandate.targetDirectories);
    if (!isCwdAllowed) {
      const relCwd = this.getRelativePath(cwd, workspaceRoot);
      this.logScopeViolation(workspaceId, activeMandate, 'command', `Cwd '${relCwd}' is outside targetDirectories`);
      return { allowed: false, reason: 'Cwd is outside mandate target directories', blockFallback: true };
    }

    // Network / package checks
    const isPkgInstall = this.isPackageInstallCommand(command);
    const isNetwork = this.isNetworkCommand(command);

    if (isPkgInstall && !activeMandate.allowPackageInstall) {
      this.logScopeViolation(workspaceId, activeMandate, 'command', 'Package install is not allowed by mandate');
      return { allowed: false, reason: 'Package install command not allowed by mandate', blockFallback: true };
    }

    if (isNetwork && !activeMandate.allowNetwork) {
      this.logScopeViolation(workspaceId, activeMandate, 'command', 'Network operations are not allowed by mandate');
      return { allowed: false, reason: 'Network command not allowed by mandate', blockFallback: true };
    }

    // Log auto approval event
    const commandHash = this.hashValue(command);
    this.auditLogger.logWorkspaceEvent({
      event: 'command_auto_approved_by_task_mandate',
      workspaceId,
      toolName: 'workspace.command.propose',
      operation: 'command-check',
      reason: activeMandate.mandateId,
      metadata: {
        commandHash,
        taskId: activeMandate.taskId
      }
    });

    return { allowed: true, reason: 'Auto-approved by active task mandate', blockFallback: true };
  }

  public checkWriteApproval(
    workspaceId: string,
    workspaceRoot: string,
    absolutePath: string,
    operation: 'filesystem.write' | 'filesystem.mkdir' | 'filesystem.move'
  ): { allowed: boolean; reason: string; blockFallback: boolean } {
    const activeMandate = this.getActiveMandate(workspaceId);
    if (!activeMandate) {
      return { allowed: false, reason: 'No active mandate', blockFallback: false };
    }

    // Check operation
    if (!activeMandate.allowedOperations.includes(operation)) {
      this.logScopeViolation(workspaceId, activeMandate, operation, `${operation} is not in allowedOperations`);
      return { allowed: false, reason: `${operation} not permitted by mandate`, blockFallback: true };
    }

    // filesystem.move is reserved but inactive
    if (operation === 'filesystem.move') {
      this.logScopeViolation(workspaceId, activeMandate, operation, 'filesystem.move is reserved but inactive in this phase');
      return { allowed: false, reason: 'filesystem.move is reserved but inactive', blockFallback: true };
    }

    // Check target directories
    const isPathAllowed = this.isPathInTargetDirectories(absolutePath, activeMandate.targetDirectories);
    if (!isPathAllowed) {
      const relPath = this.getRelativePath(absolutePath, workspaceRoot);
      this.logScopeViolation(workspaceId, activeMandate, operation, `Path '${relPath}' is outside targetDirectories`);
      return { allowed: false, reason: 'Path is outside mandate target directories', blockFallback: true };
    }

    // Log auto approval event
    const pathHash = this.hashValue(absolutePath);
    const pathSuffix = path.basename(absolutePath);

    this.auditLogger.logWorkspaceEvent({
      event: 'filesystem_write_auto_approved_by_task_mandate',
      workspaceId,
      toolName: 'workspace.filesystem.write',
      operation,
      reason: activeMandate.mandateId,
      metadata: {
        pathHash,
        pathSuffix,
        taskId: activeMandate.taskId
      }
    });

    return { allowed: true, reason: `Auto-approved by active task mandate: ${operation}`, blockFallback: true };
  }

  private isPathInTargetDirectories(absolutePath: string, targetDirectories: string[]): boolean {
    const normPath = path.normalize(absolutePath).toLowerCase();
    return targetDirectories.some(dir => {
      const normDir = path.normalize(dir).toLowerCase();
      const relative = path.relative(normDir, normPath);
      return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
    });
  }

  private logScopeViolation(workspaceId: string, mandate: WorkspaceTaskMandate, operationType: string, detail: string): void {
    this.auditLogger.logWorkspaceEvent({
      event: 'task_mandate_scope_violation',
      workspaceId,
      toolName: 'workspace.task_mandate',
      operation: operationType,
      reason: detail,
      metadata: {
        mandateId: mandate.mandateId,
        taskId: mandate.taskId,
        expiresAt: mandate.expiresAt
      }
    });
  }

  private isPackageInstallCommand(command: string): boolean {
    const trimmed = command.trim().toLowerCase();
    const parts = trimmed.split(/\s+/u);
    const binary = parts[0] ? path.basename(parts[0]).replace(/\.(exe|cmd|bat)$/i, '') : '';
    const action = parts[1] || '';
    return ['npm', 'pnpm', 'yarn'].includes(binary) && ['install', 'i'].includes(action);
  }

  private isNetworkCommand(command: string): boolean {
    const trimmed = command.toLowerCase();
    return trimmed.includes('http://') || trimmed.includes('https://') || trimmed.includes('ftp://')
      || trimmed.includes('ping ') || trimmed.includes('git clone') || trimmed.includes('git pull')
      || trimmed.includes('git push') || trimmed.includes('git fetch');
  }

  private parseCommand(command: string): { binary: string; args: string[] } | null {
    const tokens: string[] = [];
    let current = '';
    let quote: '"' | "'" | null = null;

    for (let index = 0; index < command.length; index += 1) {
      const char = command[index];
      if ((char === '"' || char === "'") && !quote) {
        quote = char;
        continue;
      }
      if (quote === char) {
        quote = null;
        continue;
      }
      if (!quote && /\s/u.test(char)) {
        if (current) {
          tokens.push(current);
          current = '';
        }
        continue;
      }
      current += char;
    }

    if (quote) {
      return null;
    }
    if (current) {
      tokens.push(current);
    }
    if (tokens.length === 0) {
      return null;
    }

    return {
      binary: tokens[0],
      args: tokens.slice(1),
    };
  }
}
