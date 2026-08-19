import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { ZavorthSystemPowerService } from '../services/power/ZavorthSystemPowerService.js';
import { logger } from '../logger.js';

export class ZavorthPowerLockTool extends BaseTool {
  public readonly name = 'zavorth_power_lock';

  public readonly description =
    'Manages system power wake locks during long autonomous subagent tasks and provides battery throttling status.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action to perform: 'acquire', 'release', 'status', 'evaluate_throttle'.",
      },
      tag: {
        type: 'string',
        description: 'Descriptive identifier for the wake lock (for action=acquire).',
      },
      lockId: {
        type: 'string',
        description: 'Wake lock ID (for action=release).',
      },
      maxDurationMs: {
        type: 'number',
        description: 'Maximum lock duration in milliseconds (default: 300000ms / 5 minutes).',
      },
    },
    required: ['action'],
  };

  private readonly powerService: ZavorthSystemPowerService;

  constructor(service?: ZavorthSystemPowerService) {
    super();
    this.powerService = service || new ZavorthSystemPowerService();
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || 'status').trim().toLowerCase();

    try {
      switch (action) {
        case 'acquire': {
          const tag = String(args.tag || 'subagent-task').trim();
          const duration = typeof args.maxDurationMs === 'number' ? args.maxDurationMs : 300000;
          const lock = this.powerService.acquireWakeLock(tag, duration);

          return JSON.stringify({
            success: true,
            message: `Power wake lock acquired for "${tag}".`,
            lock,
          });
        }

        case 'release': {
          const lockId = String(args.lockId || '').trim();
          if (!lockId) {
            return JSON.stringify({ error: 'lockId is required for action=release.' });
          }

          const released = this.powerService.releaseWakeLock(lockId);
          return JSON.stringify({
            success: released,
            message: released ? `Lock "${lockId}" released.` : `Lock "${lockId}" not found or already expired.`,
          });
        }

        case 'status': {
          const powerStatus = this.powerService.getPowerStatus();
          const activeLocks = this.powerService.getActiveLocks();
          const throttle = this.powerService.evaluateThrottlePolicy();

          return JSON.stringify({
            success: true,
            powerStatus,
            activeLocks,
            throttle,
          });
        }

        case 'evaluate_throttle': {
          const throttle = this.powerService.evaluateThrottlePolicy();
          return JSON.stringify({
            success: true,
            throttle,
          });
        }

        default:
          return JSON.stringify({
            error: `Unknown action "${action}". Valid actions: acquire, release, status, evaluate_throttle.`,
          });
      }
    } catch (err: unknown) {
      logger.warn('[ZavorthPowerLockTool] execution failed', { error: err });
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  }
}
