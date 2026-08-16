/**
 * Zavorth Power Lock Tool.
 * Exposes OS power wake-lock controls to the agent and operator via natural language and Cognitive Firewall.
 */

import { SystemPowerWakeLockService } from '../services/system/SystemPowerWakeLockService.js';

export interface ZavorthPowerLockInput {
  action: 'acquire' | 'release' | 'status';
  reason?: string;
  ticketId?: string;
}

export class ZavorthPowerLockTool {
  public static readonly name = 'zavorth_power_lock';
  public static readonly description =
    'Acquires, releases, or inspects OS power wake-locks to prevent system sleep during heavy operations, background swarm runs, or long-running builds.';

  public static readonly schema = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['acquire', 'release', 'status'],
        description: 'The power lock action: acquire a new lock, release an existing lock, or check active status.',
      },
      reason: {
        type: 'string',
        description: 'The reason for acquiring the wake-lock (e.g. "Training local model", "Background Swarm Pipeline").',
      },
      ticketId: {
        type: 'string',
        description: 'The lock ticket ID to release.',
      },
    },
    required: ['action'],
  };

  public static async execute(input: ZavorthPowerLockInput): Promise<string> {
    switch (input.action) {
      case 'acquire': {
        const reason = input.reason || 'Agent Long-Running Operation';
        const ticket = SystemPowerWakeLockService.acquireLock(reason);
        return JSON.stringify({
          status: 'success',
          action: 'acquire',
          ticketId: ticket.id,
          reason: ticket.reason,
          platform: ticket.platform,
          message: `Acquired system wake-lock '${ticket.id}' (${ticket.platform}). Sleep prevented.`,
        });
      }

      case 'release': {
        if (!input.ticketId) {
          return JSON.stringify({
            status: 'error',
            message: 'A ticketId is required to release a wake-lock.',
          });
        }
        const released = SystemPowerWakeLockService.releaseLock(input.ticketId);
        return JSON.stringify({
          status: released ? 'success' : 'not_found',
          action: 'release',
          ticketId: input.ticketId,
          message: released
            ? `Released wake-lock '${input.ticketId}'.`
            : `Lock ticket '${input.ticketId}' not found or already released.`,
        });
      }

      case 'status':
      default: {
        const activeLocks = SystemPowerWakeLockService.getActiveLocks();
        return JSON.stringify({
          status: 'success',
          action: 'status',
          hasActiveLocks: activeLocks.length > 0,
          totalActiveLocks: activeLocks.length,
          locks: activeLocks,
        });
      }
    }
  }
}
