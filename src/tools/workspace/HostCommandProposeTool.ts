import path from 'path';
import { BaseTool } from '../BaseTool.js';
import { WorkspaceResolver } from '../../security/WorkspaceResolver.js';
import { HostCommandApprovalService } from '../../services/HostCommandApprovalService.js';

export class HostCommandProposeTool extends BaseTool {
  public readonly name = 'workspace.host_command.propose';
  public readonly description = 'Proposes a host command to execute. The command may use shell:true or run outside the workspace, and requires explicit approval.';

  public readonly parameters = {
    type: 'object' as const,
    properties: {
      command: {
        type: 'string',
        description: 'O binário ou comando executável a propor (ex: "npm", "git", "powershell").',
      },
      args: {
        type: 'array',
        items: { type: 'string' },
        description: 'Argumentos para o comando.',
      },
      cwd: {
        type: 'string',
        description: 'Execution directory (relative to the workspace or absolute). Default: "."',
      },
      shell: {
        type: 'boolean',
        description: 'Se deve executar o comando usando o shell do sistema. Default: false',
      },
      reason: {
        type: 'string',
        description: 'Motivação clara para executar este comando no host.',
      }
    },
    required: ['command', 'args', 'reason'],
  };

  private readonly approvalService: HostCommandApprovalService;

  constructor(approvalService = new HostCommandApprovalService()) {
    super();
    this.approvalService = approvalService;
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const command = args.command as string;
    const commandArgs = (args.args as string[]) || [];
    const cwdInput = (args.cwd as string) || '.';
    const shell = Boolean(args.shell);
    const reason = args.reason as string;

    if (!command || typeof command !== 'string') {
      return JSON.stringify({ success: false, error: '"command" é obrigatório.' });
    }

    try {
      const workspaceRoot = WorkspaceResolver.resolve(null);
      const workspaceId = path.basename(workspaceRoot);

      // Resolve cwd
      const resolvedCwd = path.isAbsolute(cwdInput)
        ? path.resolve(cwdInput)
        : path.resolve(workspaceRoot, cwdInput);

      const result = await this.approvalService.propose(
        workspaceId,
        command,
        commandArgs,
        resolvedCwd,
        shell,
        reason
      );

      return JSON.stringify({
        success: true,
        operationId: result.operationId,
        approved: result.approved,
        riskLevel: result.riskLevel,
        status: 'HOST_COMMAND_APPROVAL_REQUIRED',
        message: 'Operator approval is required to execute host commands.'
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: `Erro ao propor comando de host: ${error.message || error}`
      });
    }
  }
}
