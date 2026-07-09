import fs from 'fs';
import path from 'path';
import { Task } from '../contracts/TaskContract.js';
import { config } from '../config/index.js';
import { logger } from '../logger.js';export interface BridgeHandoff {
  agent: 'ZAVORTH_BRIDGE';
  taskId: string;
  workspace: string;
  prompt: string;
  handoffFile: string;
  trackingFile: string;
  responseFile: string;
  launchedAt: string;
}

export interface PendingZavorthBridgeSession {
  taskId: string;
  chatId: string;
  prompt: string;
  workspace: string;
  handoffFile: string;
  responseFile: string;
  trackingFile: string;
  launchedAt: string;
  brainDir: string | null;
  deliveredArtifactKeys: string[];
  deliveredResponse: boolean;
  deliveryState?: 'idle' | 'pending' | 'delivering' | 'delivered' | 'failed';
  deliveryAttempts?: number;
  lastDeliveryAttemptAt?: string | null;
  lastDeliveryAt?: string | null;
  lastDeliverySucceededAt?: string | null;
  lastDeliveryError?: string | null;
  pendingDeliveryMessage?: string | null;
  pendingDeliverySummary?: string | null;
  responseCapturedAt?: string | null;
  pendingDeliverySource?: string | null;
  completedAt: string | null;
  lastDeliveredLogAt?: string | null;
  automationAttempts?: number;
  lastAutomationAt?: string | null;
  lastAutomationAction?: string | null;
  companionInstanceId?: string | null;
  sessionKind?: 'handoff' | 'prompt-panel';
  automationEnabled?: boolean;
  lastUiProbeAt?: string | null;
  lastVisibleResponseAt?: string | null;
  lastVisibleResponseKey?: string | null;
  stableVisibleResponseCount?: number;
  lastPermissionNotificationAttemptAt?: string | null;
  lastPermissionNotificationAt?: string | null;
  lastNotifiedPermissionId?: string | null;
}

export class AgentBridgeManager {
  private promptDir = config.zavorthBridgePromptDir;
  private pendingDir = config.zavorthBridgePendingDir;
  private responseDir = config.zavorthBridgeResponseDir;

  constructor() {
    fs.mkdirSync(this.promptDir, { recursive: true });
    fs.mkdirSync(this.pendingDir, { recursive: true });
    fs.mkdirSync(this.responseDir, { recursive: true });
  }

  public async createZavorthBridgeHandoff(task: Task, prompt: string, workspace: string): Promise<BridgeHandoff> {
    const timestamp = new Date().toISOString();
    const slug = this.slugify(prompt);
    const handoffFile = path.join(this.promptDir, `${task.task_id}_${slug}.md`);
    const trackingFile = path.join(this.pendingDir, `${task.task_id}_${slug}.json`);
    const responseFile = path.join(this.responseDir, `${task.task_id}_${slug}.md`);
    const correlationToken = `ZAVORTH_TASK_ID:${task.task_id}`;

    const payload = [
      '# Zavorth -> ZavorthBridge Handoff',
      '',
      `- task_id: ${task.task_id}`,
      `- correlation_token: ${correlationToken}`,
      `- timestamp: ${timestamp}`,
      `- workspace: ${workspace}`,
      `- response_file: ${responseFile}`,
      '',
      '## Prompt',
      prompt,
      '',
      '## Zavorth Notes',
      'Use your normal ZavorthBridge workflow and keep your native task / plan / walkthrough artifacts up to date.',
      `Preserve the correlation token somewhere in your notes if possible: ${correlationToken}`,
      '',
      '## Final Delivery Contract',
      `When the task is complete, always write a UTF-8 markdown report to: ${responseFile}`,
      'Required sections:',
      '- status',
      '- summary',
      '- files changed or commands executed',
      '- blocker or error',
      '',
      'If the task is research-only, use "files changed or commands executed" to list the sources or searches that informed the answer.',
      '',
    ].join('\n');

    await fs.promises.writeFile(handoffFile, payload, 'utf8');

    const session: PendingZavorthBridgeSession = {
      taskId: task.task_id,
      chatId: task.chat_id,
      prompt,
      workspace,
      handoffFile,
      responseFile,
      trackingFile,
      launchedAt: timestamp,
      brainDir: null,
      deliveredArtifactKeys: [],
      deliveredResponse: false,
      deliveryState: 'idle',
      deliveryAttempts: 0,
      lastDeliveryAttemptAt: null,
      lastDeliveryAt: null,
      lastDeliverySucceededAt: null,
      lastDeliveryError: null,
      pendingDeliveryMessage: null,
      pendingDeliverySummary: null,
      responseCapturedAt: null,
      pendingDeliverySource: null,
      completedAt: null,
      lastDeliveredLogAt: null,
      automationAttempts: 0,
      lastAutomationAt: null,
      lastAutomationAction: null,
      companionInstanceId: null,
      sessionKind: 'handoff',
      automationEnabled: true,
      lastUiProbeAt: null,
      lastVisibleResponseAt: null,
      lastVisibleResponseKey: null,
      stableVisibleResponseCount: 0,
      lastPermissionNotificationAttemptAt: null,
      lastPermissionNotificationAt: null,
      lastNotifiedPermissionId: null,
    };

    await this.writeSession(session);

    return {
      agent: 'ZAVORTH_BRIDGE',
      taskId: task.task_id,
      workspace,
      prompt,
      handoffFile,
      trackingFile,
      responseFile,
      launchedAt: timestamp,
    };
  }

  public async listPendingSessions(): Promise<PendingZavorthBridgeSession[]> {
    const entries = await fs.promises.readdir(this.pendingDir, { withFileTypes: true });
    const sessions: PendingZavorthBridgeSession[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        continue;
      }

      const trackingFile = path.join(this.pendingDir, entry.name);
      try {
        const raw = await fs.promises.readFile(trackingFile, 'utf8');
        const parsed = JSON.parse(raw) as PendingZavorthBridgeSession;
        parsed.trackingFile = trackingFile;
        sessions.push(parsed);
      } catch (error: unknown) {// Ignore malformed tracking files so they do not break the watcher loop.
      logger.warn('[Agent Bridge Manager] JSON parse failed', error);
    }
    }

    return sessions.sort((left, right) => {
      return new Date(left.launchedAt).getTime() - new Date(right.launchedAt).getTime();
    });
  }

  public async saveSession(session: PendingZavorthBridgeSession): Promise<void> {
    await this.writeSession(session);
  }

  private slugify(text: string): string {
    const collapsed = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return (collapsed || 'task').slice(0, 48);
  }

  private async writeSession(session: PendingZavorthBridgeSession): Promise<void> {
    const merged = await this.mergeWithExistingSession(session);
    await fs.promises.writeFile(session.trackingFile, JSON.stringify(merged, null, 2), 'utf8');
  }

  private async mergeWithExistingSession(session: PendingZavorthBridgeSession): Promise<PendingZavorthBridgeSession> {
    if (!fs.existsSync(session.trackingFile)) {
      return session;
    }

    try {
      const existing = JSON.parse(
        await fs.promises.readFile(session.trackingFile, 'utf8'),
      ) as Partial<PendingZavorthBridgeSession>;

      return {
        ...existing,
        ...session,
        brainDir: session.brainDir || existing.brainDir || null,
        deliveredArtifactKeys: this.mergeArtifactKeys(existing.deliveredArtifactKeys, session.deliveredArtifactKeys),
        deliveredResponse: Boolean(existing.deliveredResponse || session.deliveredResponse),
        deliveryState:
          session.deliveryState !== undefined
            ? session.deliveryState
            : existing.deliveryState || (existing.deliveredResponse ? 'delivered' : 'idle'),
        deliveryAttempts: Math.max(existing.deliveryAttempts || 0, session.deliveryAttempts || 0),
        lastDeliveryAttemptAt: this.pickLatestTimestamp(existing.lastDeliveryAttemptAt, session.lastDeliveryAttemptAt),
        lastDeliveryAt: this.pickLatestTimestamp(existing.lastDeliveryAt, session.lastDeliveryAt),
        lastDeliverySucceededAt: this.pickLatestTimestamp(
          existing.lastDeliverySucceededAt,
          session.lastDeliverySucceededAt,
        ),
        lastDeliveryError:
          session.lastDeliveryError !== undefined ? session.lastDeliveryError : existing.lastDeliveryError || null,
        pendingDeliveryMessage:
          session.pendingDeliveryMessage !== undefined
            ? session.pendingDeliveryMessage
            : existing.pendingDeliveryMessage || null,
        pendingDeliverySummary:
          session.pendingDeliverySummary !== undefined
            ? session.pendingDeliverySummary
            : existing.pendingDeliverySummary || null,
        responseCapturedAt: this.pickLatestTimestamp(existing.responseCapturedAt, session.responseCapturedAt),
        pendingDeliverySource:
          session.pendingDeliverySource !== undefined
            ? session.pendingDeliverySource
            : existing.pendingDeliverySource || null,
        completedAt: this.pickLatestTimestamp(existing.completedAt, session.completedAt),
        lastDeliveredLogAt: this.pickLatestTimestamp(existing.lastDeliveredLogAt, session.lastDeliveredLogAt),
        automationAttempts: Math.max(existing.automationAttempts || 0, session.automationAttempts || 0),
        lastAutomationAt: this.pickLatestTimestamp(existing.lastAutomationAt, session.lastAutomationAt),
        lastAutomationAction: session.lastAutomationAction || existing.lastAutomationAction || null,
        companionInstanceId: session.companionInstanceId || existing.companionInstanceId || null,
        sessionKind: session.sessionKind || existing.sessionKind || 'handoff',
        automationEnabled: session.automationEnabled ?? existing.automationEnabled ?? true,
        lastUiProbeAt: this.pickLatestTimestamp(existing.lastUiProbeAt, session.lastUiProbeAt),
        lastVisibleResponseAt: this.pickLatestTimestamp(existing.lastVisibleResponseAt, session.lastVisibleResponseAt),
        lastVisibleResponseKey:
          session.lastVisibleResponseKey !== undefined ? session.lastVisibleResponseKey : existing.lastVisibleResponseKey || null,
        stableVisibleResponseCount:
          session.stableVisibleResponseCount !== undefined
            ? session.stableVisibleResponseCount
            : existing.stableVisibleResponseCount || 0,
        lastPermissionNotificationAttemptAt: this.pickLatestTimestamp(
          existing.lastPermissionNotificationAttemptAt,
          session.lastPermissionNotificationAttemptAt,
        ),
        lastPermissionNotificationAt: this.pickLatestTimestamp(
          existing.lastPermissionNotificationAt,
          session.lastPermissionNotificationAt,
        ),
        lastNotifiedPermissionId:
          session.lastNotifiedPermissionId !== undefined
            ? session.lastNotifiedPermissionId
            : existing.lastNotifiedPermissionId || null,
      };
    } catch (error: unknown) {logger.warn('[Agent Bridge Manager] operation failed', error); return session; }
  }

  private mergeArtifactKeys(existing: string[] | undefined, next: string[] | undefined): string[] {
    return Array.from(new Set([...(existing || []), ...(next || [])]));
  }

  private pickLatestTimestamp(...values: Array<string | null | undefined>): string | null {
    const parsed = values
      .map((value) => {
        const timestamp = value ? Date.parse(String(value)) : Number.NaN;
        return Number.isFinite(timestamp)
          ? { value: String(value), timestamp }
          : null;
      })
      .filter((entry): entry is { value: string; timestamp: number } => Boolean(entry))
      .sort((left, right) => right.timestamp - left.timestamp);

    return parsed[0]?.value || values.find((value) => Boolean(value)) || null;
  }
}
