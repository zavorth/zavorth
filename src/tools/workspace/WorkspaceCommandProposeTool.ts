import { asErrorLike } from '../../utils/errorLike';
﻿import path from 'path';
import { BaseTool } from '../BaseTool.js';
import { WorkspaceResolver } from '../../security/WorkspaceResolver.js';
import { WorkspacePathGuard } from '../../mcp/workspace/WorkspacePathGuard.js';
import { WorkspaceSessionGrantCache } from '../../services/WorkspaceSessionGrantCache.js';
import { WorkspaceCommandRiskClassifier } from '../../services/WorkspaceCommandRiskClassifier.js';
import { WorkspaceCommandApprovalService } from '../../services/WorkspaceCommandApprovalService.js';
import { logger } from '../../logger.js';

export class WorkspaceCommandProposeTool extends BaseTool {
  public readonly name = 'workspace.command.propose';
  public readonly description = 'Proposes a command to run in the workspace. Returns whether it was pre-approved or requires manual approval.';

  public readonly parameters = {
    type: 'object' as const,
    properties: {
      command: {
        type: 'string',
        description: 'Complete command to execute, for example "npm test" or "git status". Dangerous shell metacharacters are not allowed.',
      },
      cwd: {
        type: 'string',
        description: 'Execution directory, relative or absolute inside the workspace. Default: "."',
      },
    },
    required: ['command'],
  };

  private readonly grantCache: WorkspaceSessionGrantCache;
  private readonly classifier: WorkspaceCommandRiskClassifier;
  private readonly approvalService: WorkspaceCommandApprovalService;

  constructor(
    grantCache = WorkspaceSessionGrantCache.getInstance(),
    classifier = new WorkspaceCommandRiskClassifier(),
    approvalService = new WorkspaceCommandApprovalService()
  ) {
    super();
    this.grantCache = grantCache;
    this.classifier = classifier;
    this.approvalService = approvalService;
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const command = args.command as string;
    const cwdInput = (args.cwd as string) || '.';

    if (!command || typeof command !== 'string') {
      return JSON.stringify({ success: false, error: 'The "command" parameter is required and must be a string.' });
    }

    try {
      const workspaceRoot = WorkspaceResolver.resolve(null);
      const workspaceId = path.basename(workspaceRoot);

      // 1. Validate cwd with WorkspacePathGuard
      const guard = new WorkspacePathGuard(workspaceRoot);
      let resolvedCwd: string;
      try {
        resolvedCwd = guard.resolveForWrite(cwdInput);
      } catch (error: unknown) {
        const err = asErrorLike(error);
        logger.warn('[Workspace Command Propose] validation failed', error);
    return JSON.stringify({
          success: false,
          error: `Invalid directory: ${err.message || err}`
        });
  }

      // 2. Classify risk level
      const riskLevel = this.classifier.classify(command, resolvedCwd, workspaceRoot);

      // Block out-of-workspace commands early
      if (riskLevel === 'CRITICAL' && this.isCommandOrCwdOutside(command, resolvedCwd, workspaceRoot)) {
        return JSON.stringify({
          success: false,
          error: 'Command execution outside the workspace is blocked at this stage.'
        });
      }

      // 3. Revalidate and load persistent trust if configured
      const { TrustedWorkspaceService } = await import('../../services/TrustedWorkspaceService.js');
      const trustService = await TrustedWorkspaceService.getInstance();
      trustService.loadTrust(workspaceId, workspaceRoot);

      // Determine if it can be auto-approved
      let approved = false;
      let reason = 'Safe Mode active (requires manual approval)';

      const { WorkspaceTaskMandateService } = await import('../../services/WorkspaceTaskMandateService.js');
      const mandateService = WorkspaceTaskMandateService.getInstance();
      const activeMandate = mandateService.getActiveMandate(workspaceId);

      if (activeMandate) {
        const checkResult = mandateService.checkCommandApproval(workspaceId, workspaceRoot, command, resolvedCwd, riskLevel);
        if (checkResult.allowed) {
          approved = true;
          reason = checkResult.reason;
        } else {
          approved = false;
          reason = `Requires approval: Command violates active Task Mandate (${checkResult.reason})`;
        }
      } else {
        // Fallback to Developer Mode / Session Grant only if no active mandate exists
        const isDevMode = this.grantCache.isDeveloperModeActive(workspaceId);
        if (isDevMode) {
          const grant = this.grantCache.getGrant(workspaceId);
          if (grant) {
            if (riskLevel === 'LOW') {
              approved = true;
              reason = 'Auto-approved: LOW risk command in Developer Mode';
            } else if (riskLevel === 'MEDIUM') {
              const isPkgInstall = this.isPackageInstallCommand(command);
              const isNetwork = this.isNetworkCommand(command);
              if (isPkgInstall) {
                if (grant.allowPackageInstall) {
                  approved = true;
                  reason = 'Auto-approved: Package install command allowed by session grant';
                } else {
                  approved = false;
                  reason = 'Requires approval: Package install is not allowed by the current session grant';
                }
              } else if (isNetwork) {
                if (grant.allowNetwork && grant.allowRiskUpTo === 'MEDIUM') {
                  approved = true;
                  reason = 'Auto-approved: Network command allowed by session grant';
                } else {
                  approved = false;
                  reason = 'Requires approval: Network access is not allowed or risk level not allowed by the current session grant';
                }
              } else {
                if (grant.allowRiskUpTo === 'MEDIUM') {
                  approved = true;
                  reason = 'Auto-approved: MEDIUM risk command covered by active Session Grant';
                } else {
                  approved = false;
                  reason = 'Requires approval: MEDIUM risk command requires allowRiskUpTo=MEDIUM';
                }
              }
            } else {
              approved = false;
              reason = `Requires approval: ${riskLevel} risk command never auto-executes in this phase`;
            }
          } else {
            approved = false;
            reason = 'Requires approval: Developer Mode active but no active Session Grant';
          }
        }
      }

      // 4. Register proposal
      const operationId = await this.approvalService.requestApproval(workspaceId, command, approved);

      return JSON.stringify({
        success: true,
        operationId,
        approved,
        riskLevel,
        reason
      });
    } catch (error: unknown) {
      logger.warn('[Workspace Command Propose] serialization failed', error);
    return JSON.stringify({
        success: false,
        error: `Failed to propose command: ${error.message || error}`
      });
  }
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

  private isCommandOrCwdOutside(command: string, cwd: string, workspaceRoot: string): boolean {
    const resolvedRoot = path.resolve(workspaceRoot);
    const resolvedCwd = path.resolve(cwd);

    const isPathOutside = (target: string, root: string): boolean => {
      const relative = path.relative(root, target);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return true;
      }
      const normalizedTarget = target.replace(/\\/g, '/').toLowerCase();
      const normalizedRoot = root.replace(/\\/g, '/').toLowerCase();
      return !normalizedTarget.startsWith(normalizedRoot + '/') && normalizedTarget !== normalizedRoot;
    };

    if (isPathOutside(resolvedCwd, resolvedRoot)) {
      return true;
    }

    // Check tokens for any relative path indicating path traversal outside workspace
    const tokens = command.split(/\s+/u);
    for (const token of tokens) {
      if (token.includes('/') || token.includes('\\') || token.startsWith('.')) {
        try {
          const resolved = path.resolve(resolvedCwd, token);
          if (isPathOutside(resolved, resolvedRoot)) {
            return true;
          }
        } catch (error: unknown) {// ignore parsing failures
      logger.warn('[Workspace Command Propose] lifecycle operation failed', error);
    }
      }
    }

    return false;
  }
}
