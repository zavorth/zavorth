import { config } from '../../../config/index.js';
import { Task } from '../../../contracts/TaskContract.js';
import { getExplicitExecutorForCommand } from '../../../gateways/channels/telegram/commandCatalog.js';
import { isExternalReviewCommand } from '../../../gateways/channels/telegram/ExternalExecutorIdentity.js';

export function persistTask(taskManager: any, task: Task): void {
  const saveTask = taskManager?.saveTask;
  if (typeof saveTask === 'function') {
    saveTask.call(taskManager, task);
  }
}

export function extractTaskPayload(task: Task): string {
  const raw = task.raw_message.trim();

  if (!raw.startsWith('/')) {
    return raw;
  }

  const prefix = `${task.command_type} `;
  if (raw === task.command_type) {
    return '';
  }

  if (raw.startsWith(prefix)) {
    return raw.slice(prefix.length).trim();
  }

  return raw.replace(task.command_type, '').trim();
}

export function getDefaultWorkspace(commandType: string): string {
  if (getExplicitExecutorForCommand(commandType)) {
    return config.defaultWorkspace;
  }

  if (isExternalReviewCommand(commandType)) {
    return config.defaultWorkspace;
  }

  return 'core';
}
