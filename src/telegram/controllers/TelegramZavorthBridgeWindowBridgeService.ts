import { Context, InputFile } from 'grammy';
import fs from 'fs';
import path from 'path';
import { ZavorthBridgePreferenceStore } from '../../agents/ZavorthBridgePreferenceStore.js';
import { ZavorthBridgeWindowAutomator } from '../../agents/ZavorthBridgeWindowAutomator.js';
import { ZavorthBridgeCompanionBridge } from '../../agents/ZavorthBridgeCompanionBridge.js';
import {
  ZavorthBridgeCompanionBridgeLike,
  ZavorthBridgeWindowAutomatorLike,
  LiveBridgeSnapshot,
} from './TelegramZavorthBridgeTypes.js';

type TelegramZavorthBridgeWindowBridgeServiceDeps = {
  zavorthBridgePreferenceStore: Pick<ZavorthBridgePreferenceStore, 'getPreferredModel'>;
  createWindowAutomator?: () => ZavorthBridgeWindowAutomatorLike;
  createCompanionBridge?: () => ZavorthBridgeCompanionBridgeLike;
};

export class TelegramZavorthBridgeWindowBridgeService {
  constructor(private readonly deps: TelegramZavorthBridgeWindowBridgeServiceDeps) {}

  public async handleWindowAction(
    ctx: Context,
    action: string,
    text?: string,
  ): Promise<void> {
    if (
      action !== 'focus' &&
      action !== 'approve-visible-step' &&
      action !== 'paste-and-submit'
    ) {
      await ctx.reply('Acao da janela do ZavorthBridge nao reconhecida.');
      return;
    }

    const automator = this.createWindowAutomator();
    const bridge = this.createCompanionBridge();

    try {
      const bridgeReply = await this.tryBridgeWindowAction(action, bridge, text).catch(() => null);
      if (bridgeReply) {
        await ctx.reply(bridgeReply);
        return;
      }

      const tempDir = path.join(process.cwd(), 'data', 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const beforePath = path.join(tempDir, `ag-before-${Date.now()}.png`);
      const afterPath = path.join(tempDir, `ag-after-${Date.now()}.png`);

      await automator.captureWindow(beforePath);

      const result =
        action === 'focus'
          ? await automator.focusWindow()
          : action === 'approve-visible-step'
            ? await automator.approveVisibleStep()
            : await automator.pasteAndSubmit(text || 'Continue a tarefa atual do Zavorth e conclua a resposta.');

      await new Promise((resolve) => setTimeout(resolve, 1200));
      await automator.captureWindow(afterPath);

      if (!result.ok) {
        await ctx.reply(
          `Nao consegui concluir ${this.describeWindowAction(action)} pela janela do ZavorthBridge.${result.message ? `\nMotivo: ${result.message}` : ''}`,
        );
      } else {
        const confirmation = result.verified
          ? `Pronto. ${this.describeWindowAction(action, true)} na janela real do ZavorthBridge.`
          : `Executei ${this.describeWindowAction(action)} na janela do ZavorthBridge, mas a confirmacao final ficou parcial.`;
        await ctx.reply(confirmation);
      }

      try {
        const mediaGroup = [];
        if (fs.existsSync(beforePath)) {
          mediaGroup.push({ type: 'photo', media: new InputFile(beforePath), caption: 'ANTES da acao' });
        }
        if (fs.existsSync(afterPath)) {
          mediaGroup.push({ type: 'photo', media: new InputFile(afterPath), caption: 'DEPOIS da acao' });
        }
        if (mediaGroup.length > 0) {
          await ctx.replyWithMediaGroup?.(mediaGroup as any);
        }
      } catch (sendError) {
        console.warn('[ZavorthBridge] Falha ao enviar snapshots via Telegram:', sendError);
      } finally {
        try {
          if (fs.existsSync(beforePath)) {
            fs.unlinkSync(beforePath);
          }
        } catch {}
        try {
          if (fs.existsSync(afterPath)) {
            fs.unlinkSync(afterPath);
          }
        } catch {}
      }
    } catch (error: any) {
      await ctx.reply(`Falha na automacao da janela do ZavorthBridge: ${error.message}`);
    }
  }

  public async handleBridgeStatus(ctx: Context): Promise<void> {
    const bridge = this.createCompanionBridge();

    try {
      const online = await bridge.isOnline();
      const status = await bridge.readStatus();
      const preferredModel = await this.deps.zavorthBridgePreferenceStore.getPreferredModel();
      const commandModes = this.describeAdvancedCommandModes(status?.capabilities || {});
      await ctx.reply(
        [
          `Ponte do ZavorthBridge: ${online ? 'online' : 'offline'}.`,
          `Instancia: ${status?.instanceId || 'indisponivel'}`,
          `Heartbeat: ${status?.updatedAt || 'indisponivel'}`,
          `Modelo preferido: ${preferredModel || 'nao definido'}`,
          `Comandos: ${commandModes.join(' | ') || 'nenhum comando avancado pronto'}`,
          `Pendencias: ${status?.pendingHandoffs ?? 0}`,
        ].join('\n'),
      );
    } catch (error: any) {
      await ctx.reply(`Nao consegui ler o estado da ponte interna do ZavorthBridge agora.\n\nMotivo: ${error.message}`);
    }
  }

  private createWindowAutomator(): ZavorthBridgeWindowAutomatorLike {
    return this.deps.createWindowAutomator ? this.deps.createWindowAutomator() : new ZavorthBridgeWindowAutomator();
  }

  private createCompanionBridge(): ZavorthBridgeCompanionBridgeLike {
    return this.deps.createCompanionBridge ? this.deps.createCompanionBridge() : new ZavorthBridgeCompanionBridge();
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

  private async tryBridgeWindowAction(
    action: 'focus' | 'approve-visible-step' | 'paste-and-submit',
    bridge: ZavorthBridgeCompanionBridgeLike,
    text?: string,
  ): Promise<string | null> {
    const bridgeState = await this.readLiveBridgeSnapshot(bridge);
    if (!bridgeState) {
      return null;
    }

    if (action === 'focus') {
      if (!bridgeState.capabilities.canOpenAgentPanel) {
        return null;
      }

      await bridge.executeCommand('zavorthBridge.openAgent', [], undefined, 5000, bridgeState.targetInstanceId);
      return 'Pronto. Foquei o painel real do ZavorthBridge pela ponte.';
    }

    if (action === 'approve-visible-step') {
      if (!bridgeState.capabilities.canAcceptStep) {
        return null;
      }

      await bridge.acceptStep(undefined, 8000, bridgeState.targetInstanceId);
      return 'Pronto. Aceitei a etapa visivel do ZavorthBridge pela ponte.';
    }

    if (!bridgeState.capabilities.canSendAgentPrompt) {
      return null;
    }

    const prompt = text || 'Continue a tarefa atual do Zavorth e conclua a resposta.';
    await bridge.sendAgentPrompt(prompt, undefined, 8000, bridgeState.targetInstanceId);
    return 'Pronto. Enviei esse texto para a conversa real do ZavorthBridge pela ponte.';
  }

  private describeWindowAction(
    action: 'focus' | 'approve-visible-step' | 'paste-and-submit',
    completed = false,
  ): string {
    switch (action) {
      case 'focus':
        return completed ? 'Foquei a conversa atual' : 'focar a conversa atual';
      case 'approve-visible-step':
        return completed ? 'Aceitei a etapa visivel' : 'aceitar a etapa visivel';
      default:
        return completed ? 'Enviei o texto atual' : 'enviar o texto atual';
    }
  }

  private describeAdvancedCommandModes(capabilities: Record<string, boolean>): string[] {
    const resolveMode = (bridgeReady: boolean, fallbackReady: boolean, label: string): string =>
      `${label}=${bridgeReady ? 'ponte' : fallbackReady ? 'janela' : 'indisponivel'}`;

    return [
      resolveMode(Boolean(capabilities.canOpenAgentPanel), true, '/agfocus'),
      resolveMode(Boolean(capabilities.canAcceptStep), true, '/agaccept'),
      resolveMode(Boolean(capabilities.canSendAgentPrompt), true, '/agnudge'),
      resolveMode(Boolean(capabilities.canCloseAllEditors), false, '/agclean'),
      resolveMode(Boolean(capabilities.canResetSession || capabilities.canStartNewConversation), false, '/agreset'),
      '/agmodel=controle',
    ];
  }
}
