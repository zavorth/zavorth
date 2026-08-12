
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Database } from '../storage/Database.js';
import { WorkspaceSessionGrantCache } from './WorkspaceSessionGrantCache.js';
import { WorkspaceResolver } from '../security/WorkspaceResolver.js';
import { SecurityAuditLogger } from './SecurityAuditLogger.js';
import { WorkspaceTaskMandateService } from './WorkspaceTaskMandateService.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

export interface TrustedWorkspaceEntry {
  workspaceId: string;
  rootHash: string;
  rootSuffix: string;
  trusted: boolean;
  createdAt: string;
  updatedAt: string;
  allowRiskUpTo: 'LOW' | 'MEDIUM';
  allowPackageInstall: boolean;
  allowNetwork: boolean;
}

export class TrustedWorkspaceService {
  private static instance: TrustedWorkspaceService | null = null;
  private db!: Database;
  private auditLogger!: SecurityAuditLogger;
  private readonly secret: string;

  private constructor() {
    this.secret = process.env.ZAVORTH_WORKSPACE_TRUST_SALT || crypto.randomBytes(32).toString('hex');
  }

  public static async getInstance(): Promise<TrustedWorkspaceService> {
    if (!TrustedWorkspaceService.instance) {
      const instance = new TrustedWorkspaceService();
      await instance.init();
      TrustedWorkspaceService.instance = instance;
    }
    return TrustedWorkspaceService.instance;
  }

  private async init(): Promise<void> {
    this.db = await Database.getInstance();
    this.auditLogger = new SecurityAuditLogger();
    if (!process.env.ZAVORTH_WORKSPACE_TRUST_SALT) {
      logger.warn('[SECURITY] ZAVORTH_WORKSPACE_TRUST_SALT not set. Using random salt. Workspace trust hashes will not persist across restarts.');
    }
  }

  public getTrustEntry(workspaceId: string): TrustedWorkspaceEntry | null {
    const row = this.db.get('SELECT * FROM workspace_trust_entries WHERE workspace_id = ?', [workspaceId]);
    if (!row) {
      return null;
    }
    return this.mapRow(row);
  }

  private mapRow(row: any): TrustedWorkspaceEntry {
    return {
      workspaceId: row.workspace_id,
      rootHash: row.root_hash,
      rootSuffix: row.root_suffix,
      trusted: row.trusted === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      allowRiskUpTo: row.allow_risk_up_to as 'LOW' | 'MEDIUM',
      allowPackageInstall: row.allow_package_install === 1,
      allowNetwork: row.allow_network === 1,
    };
  }

  private computeHash(resolvedPath: string): string {
    return crypto.createHmac('sha256', this.secret).update(resolvedPath).digest('hex');
  }

  public resolveAndValidatePath(rootPath: string): string {
    let resolved: string;
    try {
      resolved = fs.realpathSync(path.resolve(rootPath));
    } catch (error: unknown) {logger.warn('[Trusted Workspace] validation failed', error);
    resolved = path.resolve(rootPath);
  }

    let activeWorkspace: string;
    try {
      activeWorkspace = fs.realpathSync(WorkspaceResolver.resolve(null));
    } catch (error: unknown) {logger.warn('[Trusted Workspace] validation failed', error);
    activeWorkspace = path.resolve(WorkspaceResolver.resolve(null));
  }

    const normResolved = path.normalize(resolved).toLowerCase();
    const normActive = path.normalize(activeWorkspace).toLowerCase();

    if (normResolved !== normActive) {
      throw new Error(`[SECURITY] rootPath does not match active session workspace: '${resolved}' vs active '${activeWorkspace}'`);
    }
    return resolved;
  }

  public async grantTrust(
    workspaceId: string,
    rootPath: string,
    options: {
      allowRiskUpTo?: 'LOW' | 'MEDIUM';
      allowPackageInstall?: boolean;
      allowNetwork?: boolean;
    } = {}
  ): Promise<TrustedWorkspaceEntry> {
    const resolvedPath = this.resolveAndValidatePath(rootPath);
    const rootHash = this.computeHash(resolvedPath);
    const rootSuffix = path.basename(resolvedPath);
    const now = new Date().toISOString();

    const allowRiskUpTo = options.allowRiskUpTo || 'LOW';
    const allowPackageInstall = options.allowPackageInstall ? 1 : 0;
    const allowNetwork = options.allowNetwork ? 1 : 0;

    this.db.run(
      `INSERT OR REPLACE INTO workspace_trust_entries (
        workspace_id, root_hash, root_suffix, trusted, allow_risk_up_to,
        allow_package_install, allow_network, created_at, updated_at
      ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?)`,
      [
        workspaceId,
        rootHash,
        rootSuffix,
        allowRiskUpTo,
        allowPackageInstall,
        allowNetwork,
        now,
        now,
      ]
    );

    // Activating Developer Mode in session grant cache when trust is granted
    const sessionCache = WorkspaceSessionGrantCache.getInstance();
    sessionCache.setDeveloperMode(workspaceId, true);
    sessionCache.setGrant(workspaceId, {
      workspaceId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      allowRiskUpTo,
      allowPackageInstall: !!options.allowPackageInstall,
      allowNetwork: !!options.allowNetwork,
    });

    this.auditLogger.logWorkspaceEvent({
      event: 'workspace_trust_granted',
      workspaceId,
      rootPath: resolvedPath,
      metadata: {
        allowRiskUpTo,
        allowPackageInstall: !!options.allowPackageInstall,
        allowNetwork: !!options.allowNetwork,
      },
    });

    return this.getTrustEntry(workspaceId)!;
  }

  public async revokeTrust(workspaceId: string): Promise<void> {
    const entry = this.getTrustEntry(workspaceId);
    const rootSuffix = entry ? entry.rootSuffix : 'redacted';
    const rootPathHash = entry ? entry.rootHash : 'redacted';

    this.db.run('DELETE FROM workspace_trust_entries WHERE workspace_id = ?', [workspaceId]);

    // Remove active session grants
    const sessionCache = WorkspaceSessionGrantCache.getInstance();
    sessionCache.setDeveloperMode(workspaceId, false);
    sessionCache.revokeGrant(workspaceId);

    // Invalidate approvals/operationIds pending in that workspace
    this.db.run('DELETE FROM workspace_command_approvals WHERE workspace_id = ?', [workspaceId]);

    // Revoke active task mandate
    WorkspaceTaskMandateService.getInstance().revokeMandate(workspaceId);

    this.auditLogger.logWorkspaceEvent({
      event: 'workspace_trust_revoked',
      workspaceId,
      rootPathHash,
      rootPathSuffix: rootSuffix,
    });
  }

  public loadTrust(workspaceId: string, currentRootPath: string): TrustedWorkspaceEntry | null {
    const entry = this.getTrustEntry(workspaceId);
    if (!entry || !entry.trusted) {
      return null;
    }

    try {
      let resolvedCurrent: string;
      try {
        resolvedCurrent = fs.realpathSync(path.resolve(currentRootPath));
      } catch (error: unknown) {logger.warn('[Trusted Workspace] load operation failed', error);
    resolvedCurrent = path.resolve(currentRootPath);
  }
      const currentHash = this.computeHash(resolvedCurrent);

      if (currentHash !== entry.rootHash) {
        this.auditLogger.logWorkspaceEvent({
          event: 'workspace_trust_rejected',
          workspaceId,
          rootPath: resolvedCurrent,
          reason: 'root path hash mismatch (potential path spoofing)',
        });
        return null;
      }

      this.auditLogger.logWorkspaceEvent({
        event: 'workspace_trust_loaded',
        workspaceId,
        rootPath: resolvedCurrent,
      });

      // Synchronize with WorkspaceSessionGrantCache automatically
      const sessionCache = WorkspaceSessionGrantCache.getInstance();
      sessionCache.setDeveloperMode(workspaceId, true);
      const existingGrant = sessionCache.getGrant(workspaceId);
      if (!existingGrant) {
        sessionCache.setGrant(workspaceId, {
          workspaceId,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          allowRiskUpTo: entry.allowRiskUpTo,
          allowPackageInstall: entry.allowPackageInstall,
          allowNetwork: entry.allowNetwork,
        });
      }

      return entry;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      this.auditLogger.logWorkspaceEvent({
        event: 'workspace_trust_rejected',
        workspaceId,
        reason: `failed to resolve current root path: ${err.message}`,
      });
      return null;
    }
  }
}
