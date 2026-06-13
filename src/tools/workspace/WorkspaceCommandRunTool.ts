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
}
