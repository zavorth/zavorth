import fs from 'fs';
import path from 'path';
import type { Task } from '../../contracts/TaskContract.js';
import type { PendingZavorthBridgeSession } from '../AgentBridgeManager.js';
import { logger } from '../../logger.js';
import {
isLocalDirectoryInspectionPrompt as isLocalDirectoryInspectionPromptImpl,
  normalizeComparisonValue as normalizeComparisonValueImpl,
  resolveDirectoryListingTarget as resolveDirectoryListingTargetImpl,
} from './RealZavorthBridgeWatcherDirectoryHelpers.js';
export type RealZavorthBridgeWatcherTaskSupportHost = {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  logRepo: { log(level: string, source: string, message: string, meta?: Record<string, any>): void };
  deps: {
    taskManager?: {
      getTask(taskId: string): Task | undefined;
      saveTask(task: Task): void;
      advanceState(task: Task, state: string): void;
    };
  };
  bridgeManager: {
    saveSession(session: PendingZavorthBridgeSession): Promise<void>;
  };
  formatter: {
    formatZavorthBridgeDirectoryFallback(payload: {
      shortId: string;
      directoryPath: string;
      summary: string;
      previewLines: string[];
      hiddenCount: number;
    }): string;
  };
  getTask(taskId: string): Task | null;
  isTaskTerminal(task: Task | null): boolean;
  resolvePendingPermissionForTerminalTask(task: Task, note: string): Promise<void>;
  truncate(content: string, maxLength: number): string;
  processPendingDeliveries(): Promise<void>;
  sendToSession(session: PendingZavorthBridgeSession, message: string): Promise<void>;
};

export class RealZavorthBridgeWatcherTaskSupport {
  constructor(private readonly host: RealZavorthBridgeWatcherTaskSupportHost) {}

  public getTask(taskId: string): Task | null {
    return this.host.getTask(taskId);
  }

  public isTaskTerminal(task: Task | null): boolean {
    return this.host.isTaskTerminal(task);
  }

  public async markTaskDelivered(taskId: string, summary: string | null): Promise<void> {
    const task = this.getTask(taskId);
    if (!task || this.isTaskTerminal(task)) {
      return;
    }

    await this.host.resolvePendingPermissionForTerminalTask(
      task,
      'Automatically closed because the ZavorthBridge task had already completed.',
    );

    task.result_summary = summary ? this.host.truncate(summary, 800) : task.result_summary;
    task.error_summary = null;
    task.requires_approval = false;
    task.approval_status = 'not_required';
    task.metadata = {
      ...(task.metadata || {}),
      pendingPermissionId: null,
      pendingPermissionNotifiedAt: null,
      pendingPermissionNotificationError: null,
      zavorthBridgeDeliveryState: 'delivered',
      zavorthBridgeDeliveredAt: new Date().toISOString(),
    };

    if (task.status === 'waiting_approval') {
      this.host.deps.taskManager?.advanceState(task, 'running');
    }

    if (task.status === 'approved') {
      this.host.deps.taskManager?.advanceState(task, 'running');
    }

    if (task.status === 'running' || task.status === 'validating' || task.status === 'delivery_pending') {
      this.host.deps.taskManager?.advanceState(task, 'completed');
      return;
    }

    this.host.deps.taskManager?.saveTask(task);
  }

  public async markTaskFailed(taskId: string, summary: string): Promise<void> {
    const task = this.getTask(taskId);
    if (!task || this.isTaskTerminal(task)) {
      return;
    }

    await this.host.resolvePendingPermissionForTerminalTask(
      task,
      'Automatically closed because the ZavorthBridge task failed.',
    );

    task.result_summary = null;
    task.error_summary = summary;
    task.requires_approval = false;
    task.approval_status = 'not_required';
    task.metadata = {
      ...(task.metadata || {}),
      pendingPermissionId: null,
      pendingPermissionNotifiedAt: null,
      pendingPermissionNotificationError: null,
      zavorthBridgeFailureReason: summary,
      zavorthBridgeDeliveryState: 'failed',
    };

    if (task.status === 'waiting_approval' || task.status === 'approved') {
      this.host.deps.taskManager?.advanceState(task, 'running');
    }

    if (!this.isTaskTerminal(task)) {
      this.host.deps.taskManager?.advanceState(task, 'failed');
      return;
    }

    this.host.deps.taskManager?.saveTask(task);
  }

  public queueSessionDelivery(
    session: PendingZavorthBridgeSession,
    message: string,
    summary: string | null,
    source: string,
  ): void {
    session.pendingDeliveryMessage = message;
    session.pendingDeliverySummary = summary;
    session.responseCapturedAt = new Date().toISOString();
    session.pendingDeliverySource = source;
    session.deliveryState = 'pending';
    session.lastDeliveryError = null;

    const task = this.getTask(session.taskId);
    if (!task || this.isTaskTerminal(task)) {
      return;
    }

    task.result_summary = summary ? this.host.truncate(summary, 800) : task.result_summary;
    task.metadata = {
      ...(task.metadata || {}),
      zavorthBridgeDeliveryState: 'pending',
      zavorthBridgeResponseCapturedAt: session.responseCapturedAt,
      zavorthBridgeResponseSource: source,
      pendingPermissionId: null,
      pendingPermissionNotifiedAt: null,
      pendingPermissionNotificationError: null,
    };
    if (task.status === 'waiting_approval' || task.status === 'approved') {
      this.host.deps.taskManager?.advanceState(task, 'running');
    }

    if (task.status === 'running' || task.status === 'validating') {
      this.host.deps.taskManager?.advanceState(task, 'delivery_pending');
      return;
    }

    this.host.deps.taskManager?.saveTask(task);
  }

  public async failStalledSession(
    session: PendingZavorthBridgeSession,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    liveStatus: Record<string, any> | null,
  ): Promise<void> {
    const reason = this.describeStalledFailure(session, liveStatus);
    await this.markTaskFailed(session.taskId, reason);

    session.completedAt = new Date().toISOString();
    session.lastAutomationAction = session.lastAutomationAction || 'stalled-timeout';
    await this.host.bridgeManager.saveSession(session);

    this.host.logRepo.log('warn', 'RealZavorthBridgeWatcher', 'ZavorthBridge session timed out without visible progress.', {
      taskId: session.taskId,
      reason,
      activeEditor: liveStatus?.activeEditor || null,
      lastSyncedHandoff: liveStatus?.lastSyncedHandoff || null,
    });

    await this.host.sendToSession(
      session,
      [
        'ZavorthBridge failed to complete the task.',
        `Short reference: ${session.taskId.substring(0, 8)}`,
        `Reason: ${reason}`,
      ].join('\n'),
    );
  }

  public async tryQueueLocalDirectoryFallback(
    session: PendingZavorthBridgeSession,
    task: Task | null,
  ): Promise<boolean> {
    if (!task || this.isTaskTerminal(task)) {
      return false;
    }

    const prompt = String(session.prompt || task.raw_message || '').trim();
    if (!isLocalDirectoryInspectionPromptImpl(prompt)) {
      return false;
    }

    const directoryPath = resolveDirectoryListingTargetImpl(
      prompt,
      task.workspace || session.workspace || process.cwd(),
    );
    if (!directoryPath) {
      return false;
    }

    let entries: fs.Dirent[] = [];
    try {
      entries = await fs.promises.readdir(directoryPath, { withFileTypes: true });
    } catch (error: unknown) {logger.warn('[Real Zavorth Bridge Watcher Task] filesystem operation failed', error); return false; }

    const folders = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
    const others = entries
      .filter((entry) => !entry.isDirectory() && !entry.isFile())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));

    const previewLines = [
      ...folders.map((name) => `- [DIR] ${name}`),
      ...files.map((name) => `- [FILE] ${name}`),
      ...others.map((name) => `- [OTHER] ${name}`),
    ];
    const preview = previewLines.slice(0, 40);
    const hiddenCount = Math.max(previewLines.length - preview.length, 0);
    const summary =
      entries.length === 0
        ? `Empty folder at ${directoryPath}`
        : `${folders.length} folder(s), ${files.length} file(s), and ${others.length} other item(s) at ${directoryPath}`;

    task.fallback_used = true;
    task.metadata = {
      ...(task.metadata || {}),
      zavorthBridgeLocalDirectoryFallbackPath: directoryPath,
      zavorthBridgeFallbackReason: 'stalled_local_directory_listing',
    };

    this.queueSessionDelivery(
      session,
      this.host.formatter.formatZavorthBridgeDirectoryFallback({
        shortId: session.taskId.substring(0, 8),
        directoryPath,
        summary,
        previewLines: preview,
        hiddenCount,
      }),
      summary,
      'local folder fallback',
    );
    await this.host.bridgeManager.saveSession(session);
    await this.host.processPendingDeliveries();

    this.host.logRepo.log(
      'info',
      'RealZavorthBridgeWatcher',
      'Resolved stalled ZavorthBridge directory inspection via local fallback.',
      {
        taskId: session.taskId,
        directoryPath,
        entryCount: entries.length,
      },
    );

    return true;
  }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
  public describeStalledFailure(session: PendingZavorthBridgeSession, liveStatus: Record<string, any> | null): string {
    if (this.hasCompanionHandoffMismatch(session, liveStatus)) {
      return 'The real session was diverted to another handoff and stopped making progress on this task.';
    }

    if (
      session.companionInstanceId &&
      liveStatus?.instanceId &&
      liveStatus.instanceId !== session.companionInstanceId
    ) {
      return 'The ZavorthBridge companion changed instance during the task and execution lost context.';
    }

    return 'ZavorthBridge did not finish, did not ask for approval, and had no visible progress for too long.';
  }

  public hasCompanionHandoffMismatch(
    session: PendingZavorthBridgeSession,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    liveStatus: Record<string, any> | null,
  ): boolean {
    const expectedNeedles = [
      session.taskId,
      path.basename(session.handoffFile),
      normalizeComparisonValueImpl(session.handoffFile),
    ]
      .map((value) => normalizeComparisonValueImpl(value))
      .filter(Boolean);

    const liveCandidates = [
      liveStatus?.activeEditor,
      liveStatus?.lastSyncedHandoff,
      liveStatus?.lastOpenedHandoff,
      liveStatus?.latestPendingHandoff,
    ]
      .map((value) => normalizeComparisonValueImpl(value))
      .filter(Boolean);

    if (liveCandidates.length === 0 || expectedNeedles.length === 0) {
      return false;
    }

    return liveCandidates.every((candidate) => expectedNeedles.every((needle) => !candidate.includes(needle)));
  }
}
