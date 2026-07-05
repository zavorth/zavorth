import os from 'os';
import path from 'path';
import { BaseTool } from '../BaseTool.js';
import { WorkspaceResolver } from '../../security/WorkspaceResolver.js';
import { TemporaryDirectoryTrustService } from '../../services/TemporaryDirectoryTrustService.js';
import { logger } from '../../logger.js';

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
      directory: {
        type: 'string',
        description: 'The directory path to trust (e.g. OS temporary folder, Downloads, or Desktop).',
      },
      path: {
        type: 'string',
        description: 'Legacy argument for directory path (use directory instead).',
      },
      kind: {
        type: 'string',
        enum: ['system-temp', 'user-selected-external'],
        description: 'The kind of trust being requested. system-temp or user-selected-external.',
      },
      durationMinutes: {
        type: 'number',
        description: 'Suggested trust expiration duration in minutes (maximum 240 / 4h).',
      },
      allowedOperations: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['filesystem.read', 'filesystem.write', 'filesystem.mkdir'],
        },
        description:
          'Filesystem operations to authorize. command.run is NOT allowed.',
      },
      reason: {
        type: 'string',
        description: 'Human-readable justification for requesting this trust.',
      },
    },
    required: ['allowedOperations', 'reason'],
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

      const rawPath = (args['directory'] as string) || (args['path'] as string);
      const kind = (args['kind'] as 'system-temp' | 'user-selected-external') || 'system-temp';
      const durationMinutes = args['durationMinutes'] !== undefined ? Number(args['durationMinutes']) : undefined;
      const rawOps = (args['allowedOperations'] as string[]) || [];
      const reason = args['reason'] as string;

      if (!rawPath) {
        return JSON.stringify({ success: false, error: 'directory or path is required.' });
      }
      if (!Array.isArray(rawOps) || rawOps.length === 0) {
        return JSON.stringify({ success: false, error: 'allowedOperations must be a non-empty array.' });
      }

      const forbidden = ['command.run', 'filesystem.move'];
      for (const op of rawOps) {
        if (forbidden.includes(op)) {
          return JSON.stringify({
            success: false,
            error: `Operation '${op}' is not allowed in Temporary Directory Trust (21E-B). command.run is strictly forbidden.`,
          });
        }
      }

      const allowedOperations = rawOps as Array<'filesystem.read' | 'filesystem.write' | 'filesystem.mkdir'>;

      const trust = this.service.proposeTrust(workspaceId, rawPath, allowedOperations, kind, durationMinutes);

      return JSON.stringify({
        success: true,
        trust: {
          trustId: trust.trustId,
          workspaceId: trust.workspaceId,
          rootSuffix: trust.rootSuffix,
          displayName: trust.displayName,
          kind: trust.kind,
          allowedOperations: trust.allowedOperations,
          createdAt: trust.createdAt,
          reason,
          note: 'Awaiting user approval via desktop modal.',
        },
      });
    } catch (error) {
    logger.warn('[Temporary Directory Trust Propose] creation failed', error);
    return JSON.stringify({
        success: false,
        error: `Failed to propose Temporary Directory Trust: ${err.message || err}`,
      });
  }
  }
}
