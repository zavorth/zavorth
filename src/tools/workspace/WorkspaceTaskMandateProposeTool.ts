import path from 'path';
import { BaseTool } from '../BaseTool.js';
import { WorkspaceResolver } from '../../security/WorkspaceResolver.js';
import { WorkspacePathGuard } from '../../mcp/workspace/WorkspacePathGuard.js';
import { WorkspaceTaskMandateService } from '../../services/WorkspaceTaskMandateService.js';

export class WorkspaceTaskMandateProposeTool extends BaseTool {
  public readonly name = 'workspace.task_mandate.propose';
  public readonly description = 'Proposes a task mandate for approval. Once approved, actions in this scope can run without individual prompt approvals.';

  public readonly parameters = {
    type: 'object' as const,
    properties: {
      description: {
        type: 'string',
        description: 'Justificativa e descrição do objetivo da tarefa.'
      },
      targetDirectories: {
        type: 'array',
        items: { type: 'string' },
        description: 'Diretórios relativos ou absolutos permitidos (ex: ["src/components"]).'
      },
      allowedOperations: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['filesystem.read', 'filesystem.write', 'filesystem.mkdir', 'filesystem.move', 'command.run']
        },
        description: 'Operações de arquivos e comandos autorizadas.'
      },
      allowedBinaries: {
        type: 'array',
        items: { type: 'string' },
        description: 'Binários autorizados a executar (ex: ["git", "npm", "node", "pnpm", "yarn"]).'
      },
      maxRiskLevel: {
        type: 'string',
        enum: ['LOW', 'MEDIUM'],
        description: 'Nível máximo de risco autorizado.'
      },
      allowPackageInstall: {
        type: 'boolean',
        description: 'Se permite instalar pacotes (npm install).'
      },
      allowNetwork: {
        type: 'boolean',
        description: 'Se permite comandos que acessam a rede.'
      },
      taskId: {
        type: 'string',
        description: 'O ID opcional da tarefa atual vinculada ao mandato.'
      }
    },
    required: [
      'description',
      'targetDirectories',
      'allowedOperations',
      'allowedBinaries',
      'maxRiskLevel',
      'allowPackageInstall',
      'allowNetwork'
    ]
  };

  private readonly service: WorkspaceTaskMandateService;

  constructor(service = WorkspaceTaskMandateService.getInstance()) {
    super();
    this.service = service;
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const workspaceRoot = WorkspaceResolver.resolve(null);
      const workspaceId = path.basename(workspaceRoot);

      const description = args.description as string;
      const targetDirectoriesInput = (args.targetDirectories as string[]) || [];
      const allowedOperations = (args.allowedOperations as any[]) || [];
      const allowedBinaries = (args.allowedBinaries as string[]) || [];
      const maxRiskLevel = args.maxRiskLevel as 'LOW' | 'MEDIUM';
      const allowPackageInstall = !!args.allowPackageInstall;
      const allowNetwork = !!args.allowNetwork;
      const taskId = args.taskId as string | undefined;

      // Validate and resolve target directories
      const guard = new WorkspacePathGuard(workspaceRoot);
      const targetDirectories: string[] = [];

      for (const dirInput of targetDirectoriesInput) {
        try {
          const resolved = guard.resolveForWrite(dirInput);
          targetDirectories.push(resolved);
        } catch (err: any) {
          return JSON.stringify({
            success: false,
            error: `Diretório alvo inválido '${dirInput}': ${err.message || err}`
          });
        }
      }

      const proposed = this.service.proposeMandate(workspaceId, {
        taskId,
        description,
        targetDirectories,
        allowedOperations,
        allowedBinaries,
        maxRiskLevel,
        allowPackageInstall,
        allowNetwork
      });

      // Sanitization: Convert absolute targetDirectories to relative paths for LLM/UI payload response
      const relativeTargets = proposed.targetDirectories.map(dir => {
        const relative = path.relative(workspaceRoot, dir);
        return relative.replace(/\\/g, '/');
      });

      return JSON.stringify({
        success: true,
        mandate: {
          mandateId: proposed.mandateId,
          workspaceId: proposed.workspaceId,
          taskId: proposed.taskId,
          description: proposed.description,
          targetDirectories: relativeTargets, // relativized for safety
          allowedOperations: proposed.allowedOperations,
          allowedBinaries: proposed.allowedBinaries,
          maxRiskLevel: proposed.maxRiskLevel,
          allowPackageInstall: proposed.allowPackageInstall,
          allowNetwork: proposed.allowNetwork,
          createdAt: proposed.createdAt
        }
      });

    } catch (err: any) {
      return JSON.stringify({
        success: false,
        error: `Erro ao propor mandato de tarefa: ${err.message || err}`
      });
    }
  }
}
