import fs from 'fs';
import path from 'path';
import { FileManager } from './FileManager.js';
import { TaskManager } from '../orchestrator/TaskManager.js';
import { WorkspaceResolver } from '../security/WorkspaceResolver.js';

export class RollbackManager {
  private taskManager: TaskManager;

  constructor(taskManager: TaskManager) {
    this.taskManager = taskManager;
  }

  public async rollback(taskId: string, workspace: string): Promise<string[]> {
    const task = this.taskManager.getTask(taskId);
    if (!task) {
      throw new Error('Task not found for rollback.');
    }

    const resolvedWorkspace = WorkspaceResolver.validate(workspace);
    const backupDir = path.join(resolvedWorkspace, '.zavorth', 'backups', taskId);
    if (!fs.existsSync(backupDir)) {
      throw new Error(`No backup found for task ${taskId}.`);
    }

    const files = fs.readdirSync(backupDir);
    const restored: string[] = [];

    for (const file of files) {
      const backupDataStr = fs.readFileSync(path.join(backupDir, file), 'utf8');
      const backupData = JSON.parse(backupDataStr);

      if (backupData.existed_before) {
        FileManager.writeSafe(workspace, backupData.original_path, backupData.content);
        restored.push(`Restaurado: ${backupData.original_path}`);
      } else {
        FileManager.deleteSafe(workspace, backupData.original_path);
        restored.push(`Deleted (did not exist): ${backupData.original_path}`);
      }
    }

    // Advance to reverted state.
    try {
      this.taskManager.advanceState(task, 'rollback_pending');
      this.taskManager.advanceState(task, 'reverted');
    } catch (e) {
      // Ignore error if the state is not compatible; force manual persistence.
      task.status = 'reverted';
    }

    return restored;
  }
}
