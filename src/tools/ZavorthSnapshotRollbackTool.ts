import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { ZavorthSnapshotRollbackService } from '../services/snapshot/ZavorthSnapshotRollbackService.js';
import { logger } from '../logger.js';

export class ZavorthSnapshotRollbackTool extends BaseTool {
  public readonly name = 'zavorth_snapshot_rollback';

  public readonly description =
    'Surgical Shadow Snapshot and Rollback Engine. Captures atomic shadow file snapshots before modifications and surgically rolls back failing files without losing progress on unaffected files.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action to perform: 'create_snapshot', 'rollback_files', 'get_snapshot'.",
      },
      snapshotId: {
        type: 'string',
        description: 'Snapshot identifier.',
      },
      filePaths: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of file paths to snapshot or rollback.',
      },
      description: {
        type: 'string',
        description: 'Description of the snapshot purpose.',
      },
    },
    required: ['action'],
  };

  private readonly snapshotService: ZavorthSnapshotRollbackService;

  constructor(service?: ZavorthSnapshotRollbackService) {
    super();
    this.snapshotService = service || new ZavorthSnapshotRollbackService();
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || 'create_snapshot').trim().toLowerCase();

    try {
      switch (action) {
        case 'create_snapshot': {
          const snapshotId = String(args.snapshotId || `snap-${Date.now()}`).trim();
          const filePaths = Array.isArray(args.filePaths) ? args.filePaths.map(String) : [];
          const description = typeof args.description === 'string' ? args.description : 'Pre-mutation shadow snapshot';

          if (filePaths.length === 0) {
            return JSON.stringify({ error: 'filePaths array is required for create_snapshot.' });
          }

          const record = this.snapshotService.createSnapshot(snapshotId, filePaths, description);
          return JSON.stringify({
            success: true,
            snapshotId: record.snapshotId,
            trackedFilesCount: record.entries.size,
            trackedFiles: Array.from(record.entries.keys()),
            createdAt: record.createdAt,
          });
        }

        case 'rollback_files': {
          const snapshotId = String(args.snapshotId || '').trim();
          const targetFiles = Array.isArray(args.filePaths) ? args.filePaths.map(String) : [];

          if (!snapshotId || targetFiles.length === 0) {
            return JSON.stringify({ error: 'snapshotId and filePaths array are required for rollback_files.' });
          }

          const res = this.snapshotService.rollbackSpecificFiles(snapshotId, targetFiles);
          return JSON.stringify(res);
        }

        case 'get_snapshot': {
          const snapshotId = String(args.snapshotId || '').trim();
          if (!snapshotId) {
            return JSON.stringify({ error: 'snapshotId is required for get_snapshot.' });
          }

          const snap = this.snapshotService.getSnapshot(snapshotId);
          if (!snap) {
            return JSON.stringify({ success: false, message: `Snapshot "${snapshotId}" not found.` });
          }

          return JSON.stringify({
            success: true,
            snapshotId: snap.snapshotId,
            description: snap.description,
            files: Array.from(snap.entries.keys()),
            createdAt: snap.createdAt,
          });
        }

        default:
          return JSON.stringify({
            error: `Unknown action "${action}". Valid actions: create_snapshot, rollback_files, get_snapshot.`,
          });
      }
    } catch (err: unknown) {
      logger.warn('[ZavorthSnapshotRollbackTool] execution failed', { error: err });
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  }
}
