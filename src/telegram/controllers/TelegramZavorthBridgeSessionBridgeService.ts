import { Context } from 'grammy';
import { config } from '../../config/index.js';
import { Task } from '../../contracts/TaskContract.js';
import { ZavorthBridgeControlService } from '../../services/ZavorthBridgeControlService.js';
import {
  ZavorthBridgeAutomationResult,
  ZavorthBridgeUiReadState,
  ZavorthBridgeWindowAutomator,
} from '../../agents/ZavorthBridgeWindowAutomator.js';
import { ZavorthBridgeCompanionBridge } from '../../agents/ZavorthBridgeCompanionBridge.js';
import { PermissionService } from '../../services/PermissionService.js';
import { TaskManager } from '../../orchestrator/TaskManager.js';
import { AgentBridgeManager } from '../../orchestrator/AgentBridgeManager.js';
import {
  AgentBridgeManagerLike,
  ZavorthBridgeCompanionBridgeLike,
  ZavorthBridgeWindowAutomatorLike,
  LiveBridgeSnapshot,
} from './TelegramZavorthBridgeTypes.js';

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
      await ctx.reply('Acao de sessao do ZavorthBridge nao reconhecida.');
      return;
    }

    const bridge = this.createCompanionBridge();
    const automator = this.createWindowAutomator();

    try {
      const bridgeState = await this.readLiveBridgeSnapshot(bridge);
      if (!bridgeState) {
        await ctx.reply('O ZavorthBridge ainda nao esta com a ponte interna online. Abra o app real antes de usar esse comando.');
        return;
      }

      if (action === 'clean') {
        if (!bridgeState.capabilities.canCloseAllEditors) {
          await ctx.reply('Essa instancia do ZavorthBridge nao oferece fechamento de abas por dentro da ponte interna.');
          return;
        }

        await bridge.closeAllEditors(undefined, 8000, bridgeState.targetInstanceId);
        await ctx.reply('Pronto. Limpei as abas temporarias do ZavorthBridge pela ponte.');
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
          completedSteps.push('abas limpas');
        }

        if (bridgeState.capabilities.canStartNewConversation) {
          await bridge.startNewConversation(undefined, 8000, bridgeState.targetInstanceId);
          completedSteps.push('conversa reiniciada');
          resetPerformedByBridge = true;
        }

        if (completedSteps.length === 0) {
          await ctx.reply('Essa instancia nao oferece os comandos necessarios para /agreset pela ponte.');
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
            'Sessao ZavorthBridge encerrada por /agreset depois que o reset rapido nao ficou confiavel.',
          );
          await ctx.reply(
            `O reset rapido do ZavorthBridge nao ficou confiavel na UI, entao reiniciei o app inteiro para limpar a sessao.${visualReset.message ? `\nMotivo do reset rapido: ${visualReset.message}` : ''}`,
          );
          return;
        }

        await ctx.reply(
          `Disparei o reset do ZavorthBridge, mas nao consegui confirmar a conversa limpa na UI real.${visualReset.message ? `\nMotivo: ${visualReset.message}` : ''}${restartResult.errorMessage ? `\nTambem falhou ao reiniciar o app: ${restartResult.errorMessage}` : ''}`,
        );
        return;
      }

      if (!visualReset.verified) {
        const restartResult = await this.deps.zavorthBridgeControlService.restart();
        if (restartResult.ok) {
          await this.invalidateActiveZavorthBridgeSessions(
            'Sessao ZavorthBridge encerrada por /agreset porque a conversa visivel nao confirmou o reset rapido.',
          );
          await ctx.reply(
            `O reset rapido do ZavorthBridge nao limpou a conversa visivel, entao reiniciei o app inteiro para te devolver uma sessao limpa.${visualReset.message ? `\nMotivo do reset rapido: ${visualReset.message}` : ''}`,
          );
          return;
        }

        await ctx.reply(
          `Disparei o reset do ZavorthBridge, mas a confirmacao visual ficou parcial.${visualReset.message ? `\nMotivo: ${visualReset.message}` : ''}${restartResult.errorMessage ? `\nTambem falhou ao reiniciar o app: ${restartResult.errorMessage}` : ''}`,
        );
        return;
      }

      await this.invalidateActiveZavorthBridgeSessions(
        'Sessao ZavorthBridge anterior encerrada por /agreset para abrir uma conversa limpa.',
      );
      await ctx.reply('Pronto. Reiniciei a conversa visivel do ZavorthBridge e confirmei o reset na UI real.');
    } catch (error: any) {
      await ctx.reply(`Nao consegui limpar ou reiniciar o ZavorthBridge agora.\n\nMotivo: ${error.message}`);
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
        message: 'A UI do ZavorthBridge ainda mostra um pedido de permissao apos o reset.',
        diagnostics: surface.diagnostics,
      };
    }

    return {
      ...surface,
      verified: surface.verified !== false,
      message: surface.message || 'Conversa do ZavorthBridge pronta depois do reset pela ponte.',
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
