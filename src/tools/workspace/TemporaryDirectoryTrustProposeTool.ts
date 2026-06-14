import os from 'os';
import path from 'path';
import { BaseTool } from '../BaseTool.js';
import { WorkspaceResolver } from '../../security/WorkspaceResolver.js';
import { TemporaryDirectoryTrustService } from '../../services/TemporaryDirectoryTrustService.js';

/**
 * Agent tool: workspace.temp_dir_trust.propose
 *
 * Proposes a Temporary System Directory Trust (Fase 21E-A).
 *
 * Scope: OS temp directories only (/tmp, os.tmpdir(), %TEMP%, %TMP%).
 * NEVER authorizes command.run, shell:true, PTY, or Host Power Mode.
 * Downloads, Desktop, and arbitrary external directories require 21E-B.
 */
export class TemporaryDirectoryTrustProposeTool extends BaseTool {
  public readonly name = 'workspace.temp_dir_trust.propose';
  public readonly description =
    'Proposes a temporary filesystem trust for an OS system temp directory (e.g., /tmp, %TEMP%). ' +
    'Once approved by the user, allows read/write/mkdir inside that temp path without individual prompts. ' +
    'Does NOT authorize command execution. Only covers OS temp directories, not Downloads, Desktop, or other external paths.';

  public readonly parameters = {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string',
        description: `The OS temporary directory path to trust. Must be inside ${os.tmpdir()} or equivalent system TEMP/TMP.`,
      },
      allowedOperations: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['filesystem.read', 'filesystem.write', 'filesystem.mkdir'],
        },
        description:
          'Filesystem operations to authorize. command.run is NOT allowed in this subfase.',
      },
      reason: {
        type: 'string',
        description: 'Human-readable justification for requesting this trust.',
      },
    },
    required: ['path', 'allowedOperations', 'reason'],
  };

  private readonly service: TemporaryDirectoryTrustService;

  constructor(service = TemporaryDirectoryTrustService.getInstance()) {
    super();
    this.service = service;
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const workspaceRoot = WorkspaceResolver.resolve(null);
      const workspaceId = path.basename(workspaceRoot);

      const rawPath = args['path'] as string;
      const rawOps = (args['allowedOperations'] as string[]) || [];
      const reason = args['reason'] as string;

      if (!rawPath) {
        return JSON.stringify({ success: false, error: 'path is required.' });
      }
      if (!Array.isArray(rawOps) || rawOps.length === 0) {
        return JSON.stringify({ success: false, error: 'allowedOperations must be a non-empty array.' });
      }

      const forbidden = ['command.run', 'filesystem.move'];
      for (const op of rawOps) {
        if (forbidden.includes(op)) {
          return JSON.stringify({
            success: false,
            error: `Operation '${op}' is not allowed in Temporary Directory Trust (21E-A). command.run requires 21F/21G.`,
          });
        }
      }

      const allowedOperations = rawOps as Array<'filesystem.read' | 'filesystem.write' | 'filesystem.mkdir'>;

      const trust = this.service.proposeTrust(workspaceId, rawPath, allowedOperations);

      return JSON.stringify({
        success: true,
        trust: {
          trustId: trust.trustId,
          workspaceId: trust.workspaceId,
          pathSuffix: trust.pathSuffix,
          allowedOperations: trust.allowedOperations,
          createdAt: trust.createdAt,
          reason,
          note: 'Awaiting user approval via desktop modal.',
        },
      });
    } catch (err: any) {
      return JSON.stringify({
        success: false,
        error: `Failed to propose Temporary Directory Trust: ${err.message || err}`,
      });
    }
  }
}
