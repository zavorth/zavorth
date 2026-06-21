import path from 'path';
import { BaseTool } from '../BaseTool.js';
import { Database } from '../../storage/Database.js';
import { WorkspaceResolver } from '../../security/WorkspaceResolver.js';
import { HostPowerModeService } from '../../services/HostPowerModeService.js';
import { HostCommandApprovalService } from '../../services/HostCommandApprovalService.js';
import { HostCommandRunnerService } from '../../services/HostCommandRunnerService.js';
import { HostCommandPayloadCache } from '../../services/HostCommandPayloadCache.js';

export class HostCommandRunTool extends BaseTool {
  public readonly name = 'workspace.host_command.run';
  public readonly description = 'Executa um comando de host previamente proposto e aprovado.';

  public readonly parameters = {
    type: 'object' as const,
    properties: {
      operationId: {
        type: 'string',
        description: 'O identificador do comando retornado na proposição.',
      },
      command: {
        type: 'string',
        description: 'O binário ou comando executável (deve coincidir exatamente com o proposto).',
      },
      args: {
        type: 'array',
        items: { type: 'string' },
        description: 'Argumentos do comando (devem coincidir exatamente com os propostos).',
      },
      cwd: {
        type: 'string',
        description: 'Execution directory (must exactly match the proposed value).',
      },
      shell: {
        type: 'boolean',
        description: 'Se deve usar shell (deve coincidir exatamente com o proposto).',
      },
      timeoutMs: {
        type: 'number',
        description: 'Timeout em milissegundos. Max: 60000. Default: 30000.',
      }
    },
    required: ['operationId', 'command', 'args', 'cwd', 'shell'],
  };

  private readonly db: Database;
  private readonly approvalService: HostCommandApprovalService;
  private readonly runnerService: HostCommandRunnerService;
  private readonly payloadCache: HostCommandPayloadCache;

  constructor(
    db?: Database,
    approvalService = new HostCommandApprovalService(),
    runnerService = new HostCommandRunnerService(),
    payloadCache = HostCommandPayloadCache.getInstance()
  ) {
    super();
    this.db = db || (Database as any).instance || null;
    this.approvalService = approvalService;
    this.runnerService = runnerService;
    this.payloadCache = payloadCache;
  }

  private async getDb(): Promise<Database> {
    if (this.db) {
      return this.db;
    }
    return Database.getInstance();
  }

  private isCwdOutside(cwd: string, workspaceRoot: string): boolean {
    const resolvedRoot = path.resolve(workspaceRoot);
    const resolvedCwd = path.resolve(cwd);

    const relative = path.relative(resolvedRoot, resolvedCwd);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return true;
    }
    const normalizedTarget = resolvedCwd.replace(/\\/g, '/').toLowerCase();
    const normalizedRoot = resolvedRoot.replace(/\\/g, '/').toLowerCase();
    return !normalizedTarget.startsWith(normalizedRoot + '/') && normalizedTarget !== normalizedRoot;
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const operationId = args.operationId as string;
    const command = args.command as string;
    const commandArgs = (args.args as string[]) || [];
    const cwdInput = args.cwd as string;
    const shell = Boolean(args.shell);
    let timeoutMs = Number(args.timeoutMs || 30000);

    if (timeoutMs > 60000) timeoutMs = 60000;
    if (timeoutMs < 1000) timeoutMs = 1000;

    if (!operationId || !command || !cwdInput) {
      return JSON.stringify({ success: false, error: 'operationId, command e cwd são obrigatórios.' });
    }

    try {
      const db = await this.getDb();

      // 1. Fetch proposal metadata to perform guards
      const proposal = db.get<{ workspace_id: string; risk_level: string; approved: number }>(
        'SELECT workspace_id, risk_level, approved FROM workspace_host_command_proposals WHERE operation_id = ?',
        [operationId]
      );

      if (!proposal) {
        return JSON.stringify({ success: false, error: 'Approval not found or already consumed.' });
      }

      if (proposal.approved !== 1) {
        return JSON.stringify({ success: false, error: 'Command has not been approved by the operator yet.' });
      }

      const workspaceRoot = WorkspaceResolver.resolve(proposal.workspace_id);
      const workspaceId = proposal.workspace_id;

      // Resolve cwd
      const resolvedCwd = path.isAbsolute(cwdInput)
        ? path.resolve(cwdInput)
        : path.resolve(workspaceRoot, cwdInput);

      // Check Host Power Mode status
      const isOutside = this.isCwdOutside(resolvedCwd, workspaceRoot);
      const requiresHpm = shell || isOutside;

      if (requiresHpm) {
        const hpmState = HostPowerModeService.getInstance().getState(workspaceId);
        if (!hpmState.enabled) {
          return JSON.stringify({
            success: false,
            error: `Host Power Mode desativado. shell:true ou comandos out-of-workspace exigem Host Power Mode ativo.`
          });
        }
      }

      // Check payload cache
      const cached = this.payloadCache.get(operationId);
      if (!cached) {
        return JSON.stringify({ success: false, error: 'Raw payload not found in transient cache.' });
      }

      // 2. Consume approval atomically checking all command details (prevent mutation)
      const consumed = await this.approvalService.consumeApproval(
        workspaceId,
        operationId,
        command,
        commandArgs,
        resolvedCwd,
        shell,
        proposal.risk_level
      );

      if (!consumed) {
        return JSON.stringify({
          success: false,
          error: 'Failed to consume approval. Ensure arguments, cwd, and shell exactly match the proposal.'
        });
      }

      // 3. Execute using cached raw values
      const runResult = await this.runnerService.executeCommand(
        workspaceId,
        cached.command,
        cached.args,
        cached.cwd,
        shell,
        timeoutMs,
        proposal.risk_level
      );

      // 4. Clean up transit cache
      this.payloadCache.delete(operationId);

      return JSON.stringify({
        success: true,
        exitCode: runResult.exitCode,
        stdout: runResult.stdout,
        stderr: runResult.stderr,
        durationMs: runResult.durationMs,
        timeoutFlag: runResult.timeoutFlag,
        truncatedFlag: runResult.truncatedFlag
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: `Host command execution failed: ${error.message || error}`
      });
    }
  }
}
