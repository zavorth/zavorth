import { logger } from '../../../logger.js';
import { randomUUID } from 'crypto';
import type { Task } from '../../../contracts/TaskContract.js';

export function createEchoTraceId(prefix = 'voice'): string {
  return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

export function resolveEchoTraceId(
  task?: Pick<Task, 'task_id' | 'metadata'> | null,
  fallbackPrefix = 'voice',
): string {
  const explicitTraceId = String(task?.metadata?.traceId || task?.metadata?.trace_id || '').trim();
  if (explicitTraceId) {
    return explicitTraceId;
  }

  const taskId = String(task?.task_id || '').trim();
  if (!taskId) {
    return createEchoTraceId(fallbackPrefix);
  }

  return taskId.startsWith('task:') ? taskId : `task:${taskId}`;
}

export function logEchoTrace(
  traceId: string,
  phase: string,
  details: Record<string, unknown> = {},
): void {
  const suffix = Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${formatEchoTraceValue(value)}`)
    .join(' ');

  logger.info(`[EchoTrace] trace=${traceId} phase=${phase}${suffix ? ` ${suffix}` : ''}`);
}

function formatEchoTraceValue(value: unknown): string {
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return '""';
    }
    return /[\s=]/.test(normalized) ? JSON.stringify(normalized) : normalized;
  }

  return JSON.stringify(value);
}
