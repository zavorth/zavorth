import { TaskManager } from './TaskManager.js';
import { Task } from '../contracts/TaskContract.js';

export class ContextManager {
  private taskManager: TaskManager;

  constructor(taskManager: TaskManager) {
    this.taskManager = taskManager;
  }

  public async attachRecentContext(currentTask: Task): Promise<void> {
    const lastTask = this.taskManager.getLatestTaskForUser(currentTask.user_id, currentTask.task_id);

    if (!lastTask) {
      return;
    }

    currentTask.parent_task_id = lastTask.task_id;
    currentTask.target = currentTask.target || lastTask.target;
    currentTask.workspace = currentTask.workspace || lastTask.workspace;
    currentTask.metadata.inherited_from = lastTask.task_id;

    this.taskManager.saveTask(currentTask);
  }
}
