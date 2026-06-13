import path from 'path';
import { BaseTool } from '../BaseTool.js';
import { WorkspaceResolver } from '../../security/WorkspaceResolver.js';
import { WorkspaceCommandRiskClassifier } from '../../services/WorkspaceCommandRiskClassifier.js';
import { WorkspaceCommandApprovalService } from '../../services/WorkspaceCommandApprovalService.js';
import { WorkspaceCommandRunnerService } from '../../services/WorkspaceCommandRunnerService.js';

export class WorkspaceCommandRunTool extends BaseTool {
  public readonly name = 'workspace.command.run';
  public readonly description = 'Executa um comando que foi previamente proposto e aprovado.';

  public readonly parameters = {
    type: 'object' as const,
    properties: {
      command: {
        type: 'string',
        description: 'O comando completo a ser executado (exatamente como proposto).',
      },
      operationId: {
        type: 'string',
        description: 'O identificador de aprovação retornado por workspace.command.propose.',
      },
      cwd: {
        type: 'string',
        description: 'Diretório de execução (relativo ou absoluto dentro do workspace). Default: "."',
      },
      timeoutMs: {
        type: 'number',
        description: 'Timeout em milissegundos para execução do comando. Max: 60000. Default: 30000.',
      },
    },
    required: ['command', 'operationId'],
  };

  private readonly classifier: WorkspaceCommandRiskClassifier;
  private readonly approvalService: WorkspaceCommandApprovalService;
  private readonly runnerService: WorkspaceCommandRunnerService;

  constructor(
    classifier = new WorkspaceCommandRiskClassifier(),
    approvalService = new WorkspaceCommandApprovalService(),
    runnerService = new WorkspaceCommandRunnerService()
  ) {
    super();
    this.classifier = classifier;
    this.approvalService = approvalService;
    this.runnerService = runnerService;
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const command = args.command as string;
    const operationId = args.operationId as string;
    const cwdInput = (args.cwd as string) || '.';
    let timeoutMs = Number(args.timeoutMs || 30000);

    if (timeoutMs > 60000) timeoutMs = 60000;
    if (timeoutMs < 1000) timeoutMs = 1000;

    if (!command || !operationId) {
      return JSON.stringify({ success: false, error: '"command" e "operationId" são parâmetros obrigatórios.' });
    }

    try {
      const workspaceRoot = WorkspaceResolver.resolve(null);
      const workspaceId = path.basename(workspaceRoot);

      // 1. Classify command to determine riskLevel for audit logs
      const riskLevel = this.classifier.classify(command, path.resolve(workspaceRoot, cwdInput), workspaceRoot);

      // Revalidate trust at run-time if the workspace has trust configured
      const { TrustedWorkspaceService } = await import('../../services/TrustedWorkspaceService.js');
      const trustService = await TrustedWorkspaceService.getInstance();
      const trustEntry = trustService.getTrustEntry(workspaceId);
      if (trustEntry) {
        const loaded = trustService.loadTrust(workspaceId, workspaceRoot);
        if (!loaded || !loaded.trusted) {
          return JSON.stringify({
            success: false,
            error: 'Execução bloqueada: a confiança neste workspace foi revogada, expirou ou o caminho do root foi alterado.'
          });
        }
      }

      // Block out-of-workspace execution at run-time
      const isOutside = riskLevel === 'CRITICAL' && this.isCommandOrCwdOutside(command, path.resolve(workspaceRoot, cwdInput), workspaceRoot);
      if (isOutside) {
        return JSON.stringify({
          success: false,
          error: 'Execução bloqueada: comando ou diretório fora do workspace.'
        });
      }

      // 2. Atomically verify and consume the approval
      const isApproved = await this.approvalService.consumeApproval(workspaceId, command, operationId);
      if (!isApproved) {
        return JSON.stringify({
          success: false,
          error: 'Operação não autorizada. O operationId é inválido, expirou ou a aprovação não foi concedida.'
        });
      }

      // 3. Execute command via process runner
      const result = await this.runnerService.executeCommand(command, cwdInput, workspaceRoot, timeoutMs, riskLevel);

      return JSON.stringify({
        success: true,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        durationMs: result.durationMs,
        timeoutFlag: result.timeoutFlag,
        truncatedFlag: result.truncatedFlag
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: `Falha na execução do comando: ${error.message || error}`
      });
    }
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
