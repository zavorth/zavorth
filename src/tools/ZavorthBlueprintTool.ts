/**
 * Zavorth Blueprint Tool.
 * Exposes scheduled automation blueprints to the agent and operator via natural language and Cognitive Firewall.
 */

import { AutomationBlueprintService } from '../services/automation/AutomationBlueprintService.js';

export interface ZavorthBlueprintInput {
  action: 'list' | 'get' | 'schedule' | 'cancel';
  blueprintId?: string;
  taskId?: string;
  cronOverride?: string;
}

export class ZavorthBlueprintTool {
  public static readonly name = 'zavorth_blueprint';
  public static readonly description =
    'Lists, inspects, schedules, or cancels pre-configured automation blueprints (git hygiene, security audit, dependency freshness, system health digest, workspace doc sync).';

  public static readonly schema = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'get', 'schedule', 'cancel'],
        description: 'The action to perform: list available blueprints, inspect a blueprint, schedule an automation, or cancel an active task.',
      },
      blueprintId: {
        type: 'string',
        description: 'The blueprint ID (e.g. "git_hygiene", "security_audit", "dependency_freshness", "system_health_digest", "workspace_doc_sync").',
      },
      taskId: {
        type: 'string',
        description: 'The scheduled task ID to cancel.',
      },
      cronOverride: {
        type: 'string',
        description: 'Optional custom cron schedule expression (e.g. "0 9 * * 1-5").',
      },
    },
    required: ['action'],
  };

  public static async execute(input: ZavorthBlueprintInput): Promise<string> {
    switch (input.action) {
      case 'list': {
        const blueprints = AutomationBlueprintService.listBlueprints();
        const activeTasks = AutomationBlueprintService.listScheduledTasks();
        return JSON.stringify({
          status: 'success',
          action: 'list',
          totalBlueprints: blueprints.length,
          blueprints,
          activeScheduledTasks: activeTasks,
        });
      }

      case 'get': {
        if (!input.blueprintId) {
          return JSON.stringify({
            status: 'error',
            message: 'blueprintId is required to inspect a blueprint.',
          });
        }
        const bp = AutomationBlueprintService.getBlueprint(input.blueprintId);
        if (!bp) {
          return JSON.stringify({
            status: 'not_found',
            message: `Blueprint '${input.blueprintId}' not found.`,
          });
        }
        return JSON.stringify({
          status: 'success',
          action: 'get',
          blueprint: bp,
        });
      }

      case 'schedule': {
        if (!input.blueprintId) {
          return JSON.stringify({
            status: 'error',
            message: 'blueprintId is required to schedule an automation.',
          });
        }
        try {
          const task = AutomationBlueprintService.scheduleBlueprint(input.blueprintId, input.cronOverride);
          return JSON.stringify({
            status: 'success',
            action: 'schedule',
            task,
            message: `Scheduled automation '${task.name}' with schedule '${task.cronExpression}'.`,
          });
        } catch (err: unknown) {
          return JSON.stringify({
            status: 'error',
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }

      case 'cancel': {
        if (!input.taskId) {
          return JSON.stringify({
            status: 'error',
            message: 'taskId is required to cancel a scheduled task.',
          });
        }
        const cancelled = AutomationBlueprintService.cancelScheduledTask(input.taskId);
        return JSON.stringify({
          status: cancelled ? 'success' : 'not_found',
          action: 'cancel',
          taskId: input.taskId,
          message: cancelled
            ? `Cancelled scheduled task '${input.taskId}'.`
            : `Task '${input.taskId}' not found.`,
        });
      }

      default:
        return JSON.stringify({
          status: 'error',
          message: `Unknown action: ${String(input.action)}`,
        });
    }
  }
}
