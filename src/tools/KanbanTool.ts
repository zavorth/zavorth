import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import {
  ZavorthKanbanBoardService,
  type KanbanColumnId,
  type TaskPriority,
} from '../services/kanban/ZavorthKanbanBoardService.js';
import { logger } from '../logger.js';

export class KanbanTool extends BaseTool {
  public readonly name = 'kanban_board';

  public readonly description =
    'Autonomous Swarm Kanban Matrix. Manages task state machines, DAG dependencies, subagent assignment, token telemetry, and the self-healing auto-repair lane.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description:
          "Action to perform: 'create_task', 'move_task', 'get_board', 'decompose_goal', 'trigger_repair', 'list_tasks'.",
      },
      taskId: {
        type: 'string',
        description: 'Task ID (for move_task, trigger_repair).',
      },
      title: {
        type: 'string',
        description: 'Title of the task to create.',
      },
      description: {
        type: 'string',
        description: 'Detailed description of the task.',
      },
      priority: {
        type: 'string',
        description: "Priority level: 'LOW', 'MEDIUM', 'HIGH', 'URGENT'.",
      },
      column: {
        type: 'string',
        description: "Target column: 'TODO', 'READY', 'RUNNING', 'REVIEW', 'AUTO_REPAIR', 'DONE'.",
      },
      goal: {
        type: 'string',
        description: 'High-level goal description for decompose_goal action.',
      },
      subtasks: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of subtask titles for decompose_goal.',
      },
      reason: {
        type: 'string',
        description: 'Fault incident log or reason for trigger_repair.',
      },
    },
    required: ['action'],
  };

  private readonly kanbanService: ZavorthKanbanBoardService;

  constructor(service?: ZavorthKanbanBoardService) {
    super();
    this.kanbanService = service || new ZavorthKanbanBoardService();
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '').trim().toLowerCase();

    try {
      switch (action) {
        case 'create_task': {
          const title = String(args.title || '').trim();
          if (!title) {
            return JSON.stringify({ error: 'Title is required for create_task.' });
          }

          const priority = (String(args.priority || 'MEDIUM').toUpperCase()) as TaskPriority;
          const description = typeof args.description === 'string' ? args.description : undefined;

          const task = this.kanbanService.createTask({
            title,
            description,
            priority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priority) ? priority : 'MEDIUM',
          });

          return JSON.stringify({
            success: true,
            task,
            message: `Task [${task.id}] created in column ${task.column}.`,
          });
        }

        case 'move_task': {
          const taskId = String(args.taskId || '').trim();
          const targetCol = (String(args.column || '').toUpperCase()) as KanbanColumnId;

          if (!taskId || !targetCol) {
            return JSON.stringify({ error: 'taskId and column parameters are required for move_task.' });
          }

          const res = this.kanbanService.moveTask(taskId, targetCol);
          return JSON.stringify(res);
        }

        case 'get_board':
        case 'list_tasks': {
          const board = this.kanbanService.getBoardState();
          return JSON.stringify({
            success: true,
            board,
          });
        }

        case 'decompose_goal': {
          const goal = String(args.goal || '').trim();
          if (!goal) {
            return JSON.stringify({ error: 'goal parameter is required for decompose_goal.' });
          }

          const subtasks = Array.isArray(args.subtasks)
            ? args.subtasks.map(String).filter((s) => s.trim().length > 0)
            : undefined;

          const tasks = this.kanbanService.decomposeGoal(goal, subtasks ?? []);
          return JSON.stringify({
            success: true,
            goal,
            createdTasksCount: tasks.length,
            tasks,
          });
        }

        case 'trigger_repair': {
          const taskId = String(args.taskId || '').trim();
          if (!taskId) {
            return JSON.stringify({ error: 'taskId is required for trigger_repair.' });
          }

          const reason = typeof args.reason === 'string' ? args.reason : 'Fault detected during execution';
          const res = this.kanbanService.triggerAutoRepair(taskId, reason);
          return JSON.stringify(res);
        }

        default:
          return JSON.stringify({
            error: `Unknown action "${action}". Valid actions: create_task, move_task, get_board, list_tasks, decompose_goal, trigger_repair.`,
          });
      }
    } catch (err: unknown) {
      logger.warn('[KanbanTool] execution failed', { error: err });
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  }
}
