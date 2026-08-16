/**
 * Zavorth Checkpoint Tool.
 * Enables LLM agents and operators to save, inspect, list, and clear session step checkpoints for instant crash recovery.
 */

import { BaseTool } from './BaseTool.js';
import { SessionCheckpointRecoveryService } from '../storage/SessionCheckpointRecoveryService.js';
import { logger } from '../logger.js';

export class ZavorthCheckpointTool extends BaseTool {
  readonly name = 'zavorth_checkpoint';
  readonly description = 'Saves, retrieves, lists, or clears atomic session step checkpoints for fault recovery and session safety.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        description: "Action to perform: 'save', 'get', 'list', 'clear'.",
      },
      sessionId: {
        type: 'string',
        description: 'Target session ID (for save, get, clear).',
      },
      pendingTask: {
        type: 'string',
        description: 'Description of the in-flight task to persist in the checkpoint (for save).',
      },
      modifiedFiles: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of files touched during this turn (for save).',
      },
      lastCompletedTool: {
        type: 'string',
        description: 'Name of the last tool successfully run (for save).',
      },
      stepIndex: {
        type: 'number',
        description: 'Current execution step index (for save).',
      },
      totalSteps: {
        type: 'number',
        description: 'Total estimated steps in task (for save).',
      },
    },
    required: ['action'] as string[],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '').toLowerCase();
    const sessionId = String(args.sessionId || 'session-default').trim();

    try {
      switch (action) {
        case 'save': {
          const checkpoint = {
            sessionId,
            stepIndex: typeof args.stepIndex === 'number' ? args.stepIndex : 1,
            totalSteps: typeof args.totalSteps === 'number' ? args.totalSteps : 1,
            lastCompletedTool: typeof args.lastCompletedTool === 'string' ? args.lastCompletedTool : 'none',
            modifiedFiles: Array.isArray(args.modifiedFiles) ? args.modifiedFiles.map(String) : [],
            pendingTask: typeof args.pendingTask === 'string' ? args.pendingTask : 'Task in progress',
            timestamp: new Date().toISOString(),
          };
          SessionCheckpointRecoveryService.saveCheckpoint(checkpoint);
          return JSON.stringify({ success: true, message: `Checkpoint saved for session "${sessionId}".`, checkpoint });
        }

        case 'get': {
          const checkpoint = SessionCheckpointRecoveryService.getCheckpoint(sessionId);
          if (!checkpoint) {
            return JSON.stringify({ success: false, message: `No checkpoint found for session "${sessionId}".` });
          }
          return JSON.stringify({ success: true, checkpoint });
        }

        case 'list': {
          const checkpoints = SessionCheckpointRecoveryService.listPendingCheckpoints();
          return JSON.stringify({ success: true, total: checkpoints.length, checkpoints });
        }

        case 'clear': {
          SessionCheckpointRecoveryService.clearCheckpoint(sessionId);
          return JSON.stringify({ success: true, message: `Checkpoint cleared for session "${sessionId}".` });
        }

        default:
          return JSON.stringify({ error: `Invalid action "${action}". Valid: save, get, list, clear.` });
      }
    } catch (err: unknown) {
      logger.warn('[ZavorthCheckpointTool] execution failed', err);
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  }
}
