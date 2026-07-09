import path from 'path';
import type { PendingZavorthBridgeSession } from '../AgentBridgeManager.js';
import { config } from '../../config/index.js';
import type { Task } from '../../contracts/TaskContract.js';
import { asErrorLike } from '../../utils/errorLike.js';

export type RealZavorthBridgeWatcherCompanionSupportHost = {
  logRepo: { log(level: string, source: string, message: string, meta?: Record<string, any>): void };
  bridgeManager: {
    saveSession(session: PendingZavorthBridgeSession): Promise<void>;
  };
  windowAutomator: {
    focusWindow(timeoutMs: number, processId: number): Promise<unknown>;
    sendRecoveryPrompt(
      session: PendingZavorthBridgeSession,
      reason: 'stalled' | 'log_error',
      timeoutMs: number,
    ): Promise<unknown>;
  };
  companionBridge: {
    isOnline(): Promise<boolean>;
    readStatus(): Promise<Record<string, any> | null>;
    openHandoff(
      handoffFile: string,
      taskId: string,
      timeoutMs: number,
      targetInstanceId?: string,
    ): Promise<unknown>;
    syncPendingHandoffs(
      taskId: string,
      timeoutMs: number,
      targetInstanceId?: string,
    ): Promise<unknown>;
    openConversationPicker(
      taskId: string,
      timeoutMs: number,
      targetInstanceId?: string,
    ): Promise<unknown>;
  };
  getTask(taskId: string): Task | null;
};

export type ScopedCompanionUiTarget = {
  targetInstanceId?: string;
  liveStatus: Record<string, any> | null;
  targetProcessId?: number;
  exactInstanceMatch: boolean;
};

export class RealZavorthBridgeWatcherCompanionSupport {
  constructor(private readonly host: RealZavorthBridgeWatcherCompanionSupportHost) {}

  public async tryAutomationRescue(
    session: PendingZavorthBridgeSession,
    reason: 'stalled' | 'log_error',
  ): Promise<void> {
    if (!config.zavorthBridgeAutomationEnabled) {
      return;
    }

    const attempts = session.automationAttempts || 0;
    if (attempts >= config.zavorthBridgeAutomationMaxAttempts) {
      return;
    }

    try {
      const companionStatus = await this.getLiveCompanionStatus(this.resolveCompanionTargetInstanceId(session));
      const companionActions = await this.tryCompanionRecovery(session, reason, attempts, companionStatus);
      const targetProcessId = Number(companionStatus?.processId || 0);

      if (companionActions.length > 0) {
        session.lastAutomationAction = companionActions.join(' + ');
      } else if (attempts === 0) {
        await this.host.windowAutomator.focusWindow(200, targetProcessId);
        session.lastAutomationAction = 'focus-window';
      } else {
        await this.host.windowAutomator.sendRecoveryPrompt(session, reason, 200);
        session.lastAutomationAction = 'paste-and-submit';
      }

      session.automationAttempts = attempts + 1;
      session.lastAutomationAt = new Date().toISOString();
      this.host.logRepo.log('info', 'RealZavorthBridgeWatcher', 'ZavorthBridge automation rescue executed.', {
        taskId: session.taskId,
        reason,
        action: session.lastAutomationAction,
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      this.host.logRepo.log('warn', 'RealZavorthBridgeWatcher', `ZavorthBridge window automation failed: ${err.message}`, {
        taskId: session.taskId,
        reason,
      });
    }
  }

  public async getLiveCompanionStatus(targetInstanceId?: string): Promise<Record<string, any> | null> {
    if (!(await this.host.companionBridge.isOnline())) {
      return null;
    }

    const status = (await this.host.companionBridge.readStatus()) as Record<string, any> | null;
    if (!status) {
      return null;
    }

    if (targetInstanceId && status.instanceId && status.instanceId !== targetInstanceId) {
      return {
        ...status,
        targetInstanceId,
      };
    }

    return status;
  }

  public async resolveScopedCompanionUiTarget(session: PendingZavorthBridgeSession): Promise<ScopedCompanionUiTarget> {
    const targetInstanceId = this.resolveCompanionTargetInstanceId(session);
    const liveStatus = await this.getLiveCompanionStatus(targetInstanceId).catch(() => null);
    const exactInstanceMatch =
      !targetInstanceId || Boolean(liveStatus?.instanceId && liveStatus.instanceId === targetInstanceId);
    const targetProcessId =
      exactInstanceMatch && Number(liveStatus?.processId || 0) > 0 ? Number(liveStatus?.processId || 0) : undefined;

    return {
      targetInstanceId,
      liveStatus,
      targetProcessId,
      exactInstanceMatch,
    };
  }

  public canCaptureScopedSessionUi(target: ScopedCompanionUiTarget): boolean {
    if (!target.targetInstanceId) {
      return true;
    }

    return Boolean(target.exactInstanceMatch && target.targetProcessId && target.targetProcessId > 0);
  }

  public resolveCompanionTargetInstanceId(session: PendingZavorthBridgeSession): string | undefined {
    const sessionInstanceId = String(session.companionInstanceId || '').trim();
    if (sessionInstanceId) {
      return sessionInstanceId;
    }

    const taskInstanceId = String(this.host.getTask(session.taskId)?.metadata?.zavorthBridgeCompanionInstanceId || '').trim();
    return taskInstanceId || undefined;
  }

  public async tryCompanionRecovery(
    session: PendingZavorthBridgeSession,
    reason: 'stalled' | 'log_error',
    attempts: number,
    status: Record<string, any> | null,
  ): Promise<string[]> {
    if (!status) {
      return [];
    }

    const actions: string[] = [];
    const canOpenHandoff = Boolean(status?.capabilities?.canOpenHandoff);
    const canSyncPendingHandoffs = Boolean(status?.capabilities?.canSyncPendingHandoffs);
    const canOpenConversationPicker = Boolean(status?.capabilities?.canOpenConversationPicker);
    const targetInstanceId = this.resolveCompanionTargetInstanceId(session) || status?.instanceId;

    if (canOpenHandoff) {
      await this.host.companionBridge.openHandoff(session.handoffFile, session.taskId, 8000, targetInstanceId);
      actions.push('companion-open-handoff');
    }

    if (canSyncPendingHandoffs) {
      await this.host.companionBridge.syncPendingHandoffs(session.taskId, 8000, targetInstanceId);
      actions.push('companion-sync-pending-handoffs');
    }

    if (canOpenConversationPicker && attempts > 0 && reason === 'log_error') {
      await this.host.companionBridge.openConversationPicker(session.taskId, 8000, targetInstanceId);
      actions.push('companion-open-conversation-picker');
    }

    return actions;
  }

  public buildCompanionRecoveryPrompt(
    session: PendingZavorthBridgeSession,
    reason: 'stalled' | 'log_error',
  ): string {
    const header =
      reason === 'log_error'
        ? 'Recover from the current ZavorthBridge error and continue the Zavorth task.'
        : 'Continue the current Zavorth task without waiting for more user input.';

    return [
      `[ZAVORTH_RECOVERY for ${session.taskId}]`,
      header,
      `Correlation token: ZAVORTH_TASK_ID:${session.taskId}`,
      `Workspace: ${session.workspace}`,
      `Primary handoff file: ${path.basename(session.handoffFile)}`,
      'Update your native ZavorthBridge artifacts as you continue.',
      'If you are done, provide a concise final summary.',
    ].join('\n');
  }
}
