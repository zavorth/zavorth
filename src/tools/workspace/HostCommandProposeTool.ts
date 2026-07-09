import path from 'path';
import { BaseTool } from '../BaseTool.js';
import { WorkspaceResolver } from '../../security/WorkspaceResolver.js';
import { HostCommandApprovalService } from '../../services/HostCommandApprovalService.js';
import { logger } from '../../logger.js';

export class HostCommandProposeTool extends BaseTool {
  public readonly name = 'workspace.host_command.propose';
  public readonly description = 'Proposes a host command to execute. The command may use shell:true or run outside the workspace, and requires explicit approval.';

  public readonly parameters = {
    type: 'object' as const,
    properties: {
      command: {
        type: 'string',
        description: 'Executable binary or command to propose, for example "npm", "git", or "powershell".',
      },
      args: {
        type: 'array',
        items: { type: 'string' },
        description: 'Arguments for the command.',
      },
      cwd: {
        type: 'string',
        description: 'Execution directory (relative to the workspace or absolute). Default: "."',
      },
      shell: {
        type: 'boolean',
        description: 'Whether to execute the command through the system shell. Default: false',
      },
      reason: {
        type: 'string',
        description: 'Clear motivation for running this command on the host.',
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
      return JSON.stringify({ success: false, error: '"command" is required.' });
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
    } catch (error: unknown) {
      logger.warn('[Host Command Propose] process execution failed', error);
    return JSON.stringify({
        success: false,
        error: `Failed to propose host command: ${error.message || error}`
      });
  }
  }
}
