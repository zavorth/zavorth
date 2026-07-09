import { Context } from 'grammy';
import { config } from '@zavorth/config/index.js';
import { Task } from '@zavorth/contracts/TaskContract.js';
import { ZavorthBridgeControlService } from '@zavorth/services/ZavorthBridgeControlService.js';
import {
  ZavorthBridgeAutomationResult,
  ZavorthBridgeUiReadState,
  ZavorthBridgeWindowAutomator,
} from '../../../../agents/ZavorthBridgeWindowAutomator.js';
import { ZavorthBridgeCompanionBridge } from '../../../../agents/ZavorthBridgeCompanionBridge.js';
import { PermissionService } from '@zavorth/services/PermissionService.js';
import { TaskManager } from '../../../../orchestrator/TaskManager.js';
import { AgentBridgeManager } from '../../../../orchestrator/AgentBridgeManager.js';
import {
  AgentBridgeManagerLike,
  ZavorthBridgeCompanionBridgeLike,
  ZavorthBridgeWindowAutomatorLike,
  LiveBridgeSnapshot,
} from '../../../../gateways/channels/telegram/controllers/TelegramZavorthBridgeTypes.js';

type TelegramZavorthBridgeSessionBridgeServiceDeps = {
  taskManager: Pick<TaskManager, 'advanceState' | 'getTask'>;
  zavorthBridgeControlService: Pick<ZavorthBridgeControlService, 'restart'>;
  permissionService: Pick<PermissionService, 'listRequests' | 'rejectRequest'>;
  persistTask: (task: Task) => void;
  createWindowAutomator?: () => ZavorthBridgeWindowAutomatorLike;
  createCompanionBridge?: () => ZavorthBridgeCompanionBridgeLike;
  createBridgeManager?: () => AgentBridgeManagerLike;
};

export class TelegramZavorthBridgeSessionBridgeService {
  constructor(private readonly deps: TelegramZavorthBridgeSessionBridgeServiceDeps) {}

  public async handleSessionAction(ctx: Context, action: string): Promise<void> {
    if (action !== 'clean' && action !== 'reset') {
      await ctx.reply('Unrecognized ZavorthBridge session action.');
      return;
    }

    const bridge = this.createCompanionBridge();
    const automator = this.createWindowAutomator();

    try {
      const bridgeState = await this.readLiveBridgeSnapshot(bridge);
      if (!bridgeState) {
        await ctx.reply('ZavorthBridge internal bridge is not online yet. Open the real app before using this command.');
        return;
      }

      if (action === 'clean') {
        if (!bridgeState.capabilities.canCloseAllEditors) {
          await ctx.reply('This ZavorthBridge instance does not support tab closing through the internal bridge.');
          return;
        }

        await bridge.closeAllEditors(undefined, 8000, bridgeState.targetInstanceId);
        await ctx.reply('Done. Cleaned temporary ZavorthBridge tabs via bridge.');
        return;
      }

      let resetPerformedByBridge = false;
      if (bridgeState.capabilities.canResetSession) {
        await bridge.resetSession(undefined, 12000, bridgeState.targetInstanceId);
        resetPerformedByBridge = true;
      } else {
        const completedSteps: string[] = [];

        if (bridgeState.capabilities.canCloseAllEditors) {
          await bridge.closeAllEditors(undefined, 8000, bridgeState.targetInstanceId);
          completedSteps.push('tabs cleaned');
        }

        if (bridgeState.capabilities.canStartNewConversation) {
          await bridge.startNewConversation(undefined, 8000, bridgeState.targetInstanceId);
          completedSteps.push('conversation restarted');
          resetPerformedByBridge = true;
        }

        if (completedSteps.length === 0) {
          await ctx.reply('This instance does not support the commands needed for /agreset via bridge.');
          return;
        }
      }

      const targetProcessId = Number(bridgeState.status?.processId || 0);
      const visualReset = resetPerformedByBridge
        ? await this.verifyResetAfterBridgeAction(automator, targetProcessId)
        : await automator.resetVisibleConversation(0, targetProcessId);
      if (!visualReset.ok) {
        const restartResult = await this.deps.zavorthBridgeControlService.restart();
        if (restartResult.ok) {
          await this.invalidateActiveZavorthBridgeSessions(
            'ZavorthBridge session terminated by /agreset after quick reset was not reliable.',
          );
          await ctx.reply(
            `Quick ZavorthBridge reset was not reliable in the UI, so I restarted the entire app to clear the session.${visualReset.message ? `\nQuick reset reason: ${visualReset.message}` : ''}`,
          );
          return;
        }

        await ctx.reply(
          `Triggered ZavorthBridge reset, but could not confirm a clean conversation in the real UI.${visualReset.message ? `\nReason: ${visualReset.message}` : ''}${restartResult.errorMessage ? `\nAlso failed to restart the app: ${restartResult.errorMessage}` : ''}`,
        );
        return;
      }

      if (!visualReset.verified) {
        const restartResult = await this.deps.zavorthBridgeControlService.restart();
        if (restartResult.ok) {
          await this.invalidateActiveZavorthBridgeSessions(
            'ZavorthBridge session terminated by /agreset because the visible conversation did not confirm the quick reset.',
          );
          await ctx.reply(
            `Quick ZavorthBridge reset did not clean the visible conversation, so I restarted the entire app to give you a clean session.${visualReset.message ? `\nQuick reset reason: ${visualReset.message}` : ''}`,
          );
          return;
        }

        await ctx.reply(
          `Triggered ZavorthBridge reset, but visual confirmation was partial.${visualReset.message ? `\nReason: ${visualReset.message}` : ''}${restartResult.errorMessage ? `\nAlso failed to restart the app: ${restartResult.errorMessage}` : ''}`,
        );
        return;
      }

      await this.invalidateActiveZavorthBridgeSessions(
        'Previous ZavorthBridge session terminated by /agreset to open a clean conversation.',
      );
      await ctx.reply('Done. Restarted the visible ZavorthBridge conversation and confirmed the reset in the real UI.');
    } catch (error: any) { const err = error; const e = error;
      const message = error instanceof Error ? error.message : String(error);
      await ctx.reply(`Could not clean or restart ZavorthBridge right now.\n\nReason: ${message}`);
    }
  }

  private createWindowAutomator(): ZavorthBridgeWindowAutomatorLike {
    return this.deps.createWindowAutomator ? this.deps.createWindowAutomator() : new ZavorthBridgeWindowAutomator();
  }

  private createCompanionBridge(): ZavorthBridgeCompanionBridgeLike {
    return this.deps.createCompanionBridge ? this.deps.createCompanionBridge() : new ZavorthBridgeCompanionBridge();
  }

  private createBridgeManager(): AgentBridgeManagerLike {
    return this.deps.createBridgeManager ? this.deps.createBridgeManager() : new AgentBridgeManager();
  }

  private async verifyResetAfterBridgeAction(
    automator: ZavorthBridgeWindowAutomatorLike,
    processId: number,
  ): Promise<ZavorthBridgeAutomationResult> {
    const surface = await automator.ensureConversationSurface(0, processId);
    if (!surface.ok) {
      return surface;
    }

    const snapshot = await automator.readLatestResponse(0, processId).catch(() => null as ZavorthBridgeUiReadState | null);
    if (snapshot?.ok && snapshot.hasPermissionPrompt) {
      return {
        ok: true,
        mode: 'ensure-conversation-surface',
        windowTitle: config.zavorthBridgeWindowTitle,
        pid: processId || undefined,
        textLength: 0,
        verified: false,
        message: 'ZavorthBridge UI still shows a permission request after reset.',
        diagnostics: surface.diagnostics,
      };
    }

    return {
      ...surface,
      verified: surface.verified !== false,
      message: surface.message || 'ZavorthBridge conversation ready after bridge reset.',
    };
  }

  private async invalidateActiveZavorthBridgeSessions(reason: string): Promise<void> {
    const bridgeManager = this.createBridgeManager();
    const sessions = await bridgeManager.listPendingSessions().catch(() => []);
    const activeSessions = sessions.filter((session) => !session.completedAt);

    for (const session of activeSessions) {
      session.completedAt = new Date().toISOString();
      session.pendingDeliveryMessage = null;
      session.pendingDeliverySummary = null;
      session.pendingDeliverySource = null;
      if (!session.deliveredResponse) {
        session.deliveryState = 'failed';
        session.lastDeliveryError = reason;
      }
      await bridgeManager.saveSession(session).catch(() => undefined);

      const task = this.deps.taskManager.getTask(session.taskId);
      if (!task || !this.isZavorthBridgeTask(task) || this.isTaskTerminal(task)) {
        continue;
      }

      await this.rejectPendingZavorthBridgePermissions(task.task_id, reason);
      task.requires_approval = false;
      task.approval_status = 'not_required';
      task.error_summary = task.error_summary || reason;
      task.metadata = {
        ...(task.metadata || {}),
        pendingPermissionId: null,
        pendingPermissionNotifiedAt: null,
        pendingPermissionNotificationError: null,
        zavorthBridgeDeliveryState: 'failed',
        zavorthBridgeFailureReason: reason,
      };

      if (task.status === 'waiting_approval' || task.status === 'approved') {
        this.deps.taskManager.advanceState(task, 'running');
      }

      if (task.status === 'running' || task.status === 'validating' || task.status === 'delivery_pending') {
        this.deps.taskManager.advanceState(task, 'failed');
      } else {
        this.deps.persistTask(task);
      }
    }
  }

  private async rejectPendingZavorthBridgePermissions(taskId: string, note: string): Promise<void> {
    const pending = await this.deps.permissionService.listRequests('pending', 200).catch(() => []);
    for (const permission of pending) {
      if (
        permission.task_id !== taskId ||
        permission.executor !== 'zavorthBridge' ||
        permission.kind !== 'ui_permission'
      ) {
        continue;
      }

      await this.deps.permissionService.rejectRequest(permission.permission_id, 'system:agreset', note).catch(() => undefined);
    }
  }

  private isZavorthBridgeTask(task: Task): boolean {
    const commandType = String(task.command_type || '').trim().toLowerCase();
    const executor = String(task.executor_used || '').trim().toLowerCase();
    return commandType.startsWith('/ag') || executor.startsWith('zavorthBridge');
  }

  private isTaskTerminal(task: Task): boolean {
    return ['completed', 'failed', 'rejected', 'cancelled', 'reverted'].includes(task.status);
  }

  private async readLiveBridgeSnapshot(bridge: ZavorthBridgeCompanionBridgeLike): Promise<LiveBridgeSnapshot | null> {
    if (!(await bridge.isOnline())) {
      return null;
    }

    const status = await bridge.readStatus().catch(() => null);
    return {
      targetInstanceId: status?.instanceId,
      capabilities: status?.capabilities || {},
      status,
    };
  }
}
