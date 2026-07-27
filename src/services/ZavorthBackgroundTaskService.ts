import path from 'node:path';

import type { TaskPlaneItem, TaskPlaneSnapshot } from '../contracts/TaskPlaneContract.js';
import { TaskPlaneService } from './TaskPlaneService.js';
import { ZavorthHomePathService } from './ZavorthHomePathService.js';

type BackgroundOptions = {
  projectRoot: string;
  explicitHome?: string | null;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
};

type CreateBackgroundInput = {
  prompt: string;
  title?: string | null;
  sessionId?: string | null;
  profileId?: string | null;
  sourceSurface?: string | null;
  approvalId?: string | null;
};

export type ZavorthBackgroundTaskSnapshot = {
  contractVersion: 'background-task-plane/1';
  generatedAt: string;
  storePath: string;
  summary: {
    total: number;
    queued: number;
    running: number;
    waitingApproval: number;
    done: number;
    failed: number;
    cancelled: number;
  };
  items: TaskPlaneItem[];
  safety: {
    workerSeparated: true;
    executionDirectlyStarted: false;
    taskPlaneBacked: true;
  };
};

export class ZavorthBackgroundTaskService {
  private readonly projectRoot: string;
  private readonly explicitHome: string | null;
  private readonly env: NodeJS.ProcessEnv;
  private readonly now: () => Date;

  constructor(options: BackgroundOptions) {
    this.projectRoot = options.projectRoot;
    this.explicitHome = options.explicitHome || null;
    this.env = options.env || process.env;
    this.now = options.now || (() => new Date());
  }

  public createBackgroundTask(input: CreateBackgroundInput): TaskPlaneItem {
    const prompt = String(input.prompt || '').trim();
    if (!prompt) {
      throw new Error('Background task prompt is required.');
    }
    return this.taskPlane().createTask({
      title: String(input.title || '').trim() || this.deriveTitle(prompt),
      source: `background:${String(input.sourceSurface || 'operator').trim() || 'operator'}`,
      approvalId: input.approvalId || null,
      payload: {
        kind: 'background-agent-run',
        prompt,
        promptPreview: this.redactPrompt(prompt),
        sessionId: input.sessionId || null,
        profileId: input.profileId || null,
        workerSeparated: true,
        statusVisible: true,
        createdBy: 'zavorth-background-service',
      },
    });
  }

  public snapshot(): ZavorthBackgroundTaskSnapshot {
    const taskPlane = this.taskPlane().snapshot();
    const items = taskPlane.items.filter((item) => this.isBackgroundTask(item));
    return {
      contractVersion: 'background-task-plane/1',
      generatedAt: this.now().toISOString(),
      storePath: taskPlane.storePath,
      summary: {
        total: items.length,
        queued: count(taskPlane, 'queued', items),
        running: count(taskPlane, 'running', items),
        waitingApproval: count(taskPlane, 'waiting_approval', items),
        done: count(taskPlane, 'done', items),
        failed: count(taskPlane, 'failed', items),
        cancelled: count(taskPlane, 'cancelled', items),
      },
      items,
      safety: {
        workerSeparated: true,
        executionDirectlyStarted: false,
        taskPlaneBacked: true,
      },
    };
  }

  private taskPlane(): TaskPlaneService {
    const home = new ZavorthHomePathService({
      projectRoot: this.projectRoot,
      explicitHome: this.explicitHome,
      env: this.env,
    }).resolveSnapshot();
    return new TaskPlaneService({
      storePath: path.join(home.resolvedPaths.runtimeDir, 'task-plane.json'),
      stateDbPath: home.resolvedPaths.dbPath,
      now: this.now,
    });
  }

  private isBackgroundTask(item: TaskPlaneItem): boolean {
    return item.source.startsWith('background:')
      || item.payload.kind === 'background-agent-run';
  }

  private deriveTitle(prompt: string): string {
    const cleaned = prompt.replace(/\s+/gu, ' ').trim();
    return cleaned.length <= 80 ? cleaned : `${cleaned.slice(0, 77)}...`;
  }

  private redactPrompt(prompt: string): string {
    return prompt
      .replace(/(api[_-]...key|token|secret|password)\s*[:=]\s*\S+/giu, '$1=***')
      .slice(0, 500);
  }
}

function count(_snapshot: TaskPlaneSnapshot, status: TaskPlaneItem['status'], items: TaskPlaneItem[]): number {
  return items.filter((item) => item.status === status).length;
}
