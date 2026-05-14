import { TaskManager } from './TaskManager.js';
import { Task } from '../contracts/TaskContract.js';

export class ContextManager {
  private taskManager: TaskManager;

  constructor(taskManager: TaskManager) {
    this.taskManager = taskManager;
  }

  public async attachRecentContext(currentTask: Task): Promise<void> {
    const lastTask = this.taskManager.getLatestTaskForUser(currentTask.user_id, currentTask.task_id);
    const normalized = String(currentTask.normalized_message || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (!lastTask) {
      return;
    }

    currentTask.parent_task_id = lastTask.task_id;

    if (
      normalized.includes('anterior') ||
      normalized.includes('ultima') ||
      normalized.includes('dessa ultima') ||
      normalized.includes('da ultima') ||
      normalized.includes('cade') ||
      normalized.includes('terminou') ||
      normalized.includes('deu certo') ||
      normalized.includes('status')
    ) {
      currentTask.target = lastTask.target;
      currentTask.workspace = lastTask.workspace || currentTask.workspace;
      currentTask.metadata.inherited_from = lastTask.task_id;
    }

    this.taskManager.saveTask(currentTask);
  }
}
