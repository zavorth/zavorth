import path from 'path';
import { BaseTool } from '../BaseTool.js';
import { WorkspaceResolver } from '../../security/WorkspaceResolver.js';
import { WorkspacePathGuard } from '../../mcp/workspace/WorkspacePathGuard.js';
import { WorkspaceSessionGrantCache } from '../../services/WorkspaceSessionGrantCache.js';
import { WorkspaceCommandRiskClassifier } from '../../services/WorkspaceCommandRiskClassifier.js';
import { WorkspaceCommandApprovalService } from '../../services/WorkspaceCommandApprovalService.js';

export class WorkspaceCommandProposeTool extends BaseTool {
  public readonly name = 'workspace.command.propose';
  public readonly description = 'Propõe um comando a ser executado no workspace. Retorna se foi pré-aprovado ou se exige aprovação manual.';

  public readonly parameters = {
    type: 'object' as const,
    properties: {
      command: {
        type: 'string',
        description: 'O comando completo a ser executado (ex: "npm test" ou "git status"). Sem metacaracteres perigosos de shell.',
      },
      cwd: {
        type: 'string',
        description: 'Diretório de execução (relativo ou absoluto dentro do workspace). Default: "."',
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
      return JSON.stringify({ success: false, error: 'O parâmetro "command" é obrigatório e deve ser uma string.' });
    }

    try {
      const workspaceRoot = WorkspaceResolver.resolve(null);
      const workspaceId = path.basename(workspaceRoot);

      // 1. Validate cwd with WorkspacePathGuard
      const guard = new WorkspacePathGuard(workspaceRoot);
      let resolvedCwd: string;
      try {
        resolvedCwd = guard.resolveForWrite(cwdInput);
      } catch (err: any) {
        return JSON.stringify({
          success: false,
          error: `Diretório inválido: ${err.message || err}`
        });
      }

      // 2. Classify risk level
      const riskLevel = this.classifier.classify(command, resolvedCwd, workspaceRoot);

      // Block out-of-workspace commands early
      if (riskLevel === 'CRITICAL' && this.isCommandOrCwdOutside(command, resolvedCwd, workspaceRoot)) {
        return JSON.stringify({
          success: false,
          error: 'Execução de comandos fora do workspace está bloqueada nesta fase.'
        });
      }

      // 3. Determine if it can be auto-approved
      let approved = false;
      let reason = 'Safe Mode active (requires manual approval)';

      const isDevMode = this.grantCache.isDeveloperModeActive(workspaceId);
      if (isDevMode) {
        if (riskLevel === 'LOW') {
          approved = true;
          reason = 'Auto-approved: LOW risk command in Developer Mode';
        } else if (riskLevel === 'MEDIUM') {
          const grant = this.grantCache.getGrant(workspaceId);
          if (grant) {
            // Check package install permissions if applicable
            const isPkgInstall = this.isPackageInstallCommand(command);
            if (isPkgInstall && !grant.allowPackageInstall) {
              approved = false;
              reason = 'Requires approval: package install is not allowed by the current session grant';
            } else {
              approved = true;
              reason = 'Auto-approved: MEDIUM risk command covered by active Session Grant';
            }
          } else {
            approved = false;
            reason = 'Requires approval: MEDIUM risk command with no active Session Grant';
          }
        } else {
          approved = false;
          reason = `Requires approval: ${riskLevel} risk command never auto-executes in this phase`;
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
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: `Erro ao propor comando: ${error.message || error}`
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
        } catch {
          // ignore parsing failures
        }
      }
    }

    return false;
  }
}
