import path from 'path';
import { BaseTool } from '../BaseTool.js';
import { WorkspaceResolver } from '../../security/WorkspaceResolver.js';
import { WorkspacePathGuard } from '../../mcp/workspace/WorkspacePathGuard.js';
import { WorkspaceTaskMandateService } from '../../services/WorkspaceTaskMandateService.js';
import { logger } from '../../logger.js';

export class WorkspaceTaskMandateProposeTool extends BaseTool {
  public readonly name = 'workspace.task_mandate.propose';
  public readonly description = 'Proposes a task mandate for approval. Once approved, actions in this scope can run without individual prompt approvals.';

  public readonly parameters = {
    type: 'object' as const,
    properties: {
      description: {
        type: 'string',
        description: 'Justification and description of the task objective.'
      },
      targetDirectories: {
        type: 'array',
        items: { type: 'string' },
        description: 'Allowed relative or absolute directories, for example ["src/components"].'
      },
      allowedOperations: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['filesystem.read', 'filesystem.write', 'filesystem.mkdir', 'filesystem.move', 'command.run']
        },
        description: 'Authorized file and command operations.'
      },
      allowedBinaries: {
        type: 'array',
        items: { type: 'string' },
        description: 'Authorized binaries to execute, for example ["git", "npm", "node", "pnpm", "yarn"].'
      },
      maxRiskLevel: {
        type: 'string',
        enum: ['LOW', 'MEDIUM'],
        description: 'Maximum authorized risk level.'
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
        description: 'Optional current task ID linked to the mandate.'
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
        } catch (error) {
    logger.warn('[Workspace Task Mandate Propose] validation failed', error);
    return JSON.stringify({
            success: false,
            error: `Invalid target directory '${dirInput}': ${err.message || err}`
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

    } catch (error) {
    logger.warn('[Workspace Task Mandate Propose] creation failed', error);
    return JSON.stringify({
        success: false,
        error: `Error while proposing task mandate: ${err.message || err}`
      });
  }
  }
}
