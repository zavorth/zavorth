import { logger } from '../../../../logger.js';
import { Context, InputFile } from 'grammy';
import fs from 'fs';
import path from 'path';
import { ZavorthBridgePreferenceStore } from '../../../../agents/ZavorthBridgePreferenceStore.js';
import { ZavorthBridgeWindowAutomator } from '../../../../agents/ZavorthBridgeWindowAutomator.js';
import { ZavorthBridgeCompanionBridge } from '../../../../agents/ZavorthBridgeCompanionBridge.js';
import {
  ZavorthBridgeCompanionBridgeLike,
  ZavorthBridgeWindowAutomatorLike,
  LiveBridgeSnapshot,
} from '../../../../gateways/channels/telegram/controllers/TelegramZavorthBridgeTypes.js';

interface MediaGroupPhotoItem {
  type: 'photo';
  media: InputFile | string;
  caption?: string;
}

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
      await ctx.reply('ZavorthBridge window action was not recognized.');
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
            : await automator.pasteAndSubmit(text || 'Continue the current Zavorth task and complete the answer.');

      await new Promise((resolve) => setTimeout(resolve, 1200));
      await automator.captureWindow(afterPath);

      if (!result.ok) {
        await ctx.reply(
          `I could not complete ${this.describeWindowAction(action)} through the ZavorthBridge window.${result.message ? `\nReason: ${result.message}` : ''}`,
        );
      } else {
        const confirmation = result.verified
          ? `Done. ${this.describeWindowAction(action, true)} in the real ZavorthBridge window.`
          : `I executed ${this.describeWindowAction(action)} in the ZavorthBridge window, but final confirmation was partial.`;
        await ctx.reply(confirmation);
      }

      try {
        const mediaGroup: MediaGroupPhotoItem[] = [];
        if (fs.existsSync(beforePath)) {
          mediaGroup.push({ type: 'photo', media: new InputFile(beforePath), caption: 'BEFORE action' });
        }
        if (fs.existsSync(afterPath)) {
          mediaGroup.push({ type: 'photo', media: new InputFile(afterPath), caption: 'AFTER action' });
        }
        if (mediaGroup.length > 0) {
          await ctx.replyWithMediaGroup?.(mediaGroup);
        }
      } catch (sendError) {
        logger.warn('[ZavorthBridge] Failed to send snapshots through Telegram:', sendError);
      } finally {
        try {
          if (fs.existsSync(beforePath)) {
            fs.unlinkSync(beforePath);
          }
        } catch (err) { logger.warn("[auto-fix] Empty catch block", err); }
        try {
          if (fs.existsSync(afterPath)) {
            fs.unlinkSync(afterPath);
          }
        } catch (err) { logger.warn("[auto-fix] Empty catch block", err); }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.reply(`ZavorthBridge window automation failed: ${message}`);
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
          `ZavorthBridge bridge: ${online ? 'online' : 'offline'}.`,
          `Instance: ${status?.instanceId || 'unavailable'}`,
          `Heartbeat: ${status?.updatedAt || 'unavailable'}`,
          `Preferred model: ${preferredModel || 'not set'}`,
          `Commands: ${commandModes.join(' | ') || 'no advanced command ready'}`,
          `Pending: ${status?.pendingHandoffs ?? 0}`,
        ].join('\n'),
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.reply(`I could not read the internal ZavorthBridge bridge state right now.\n\nReason: ${message}`);
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
      return 'Done. Focused the real ZavorthBridge panel through the bridge.';
    }

    if (action === 'approve-visible-step') {
      if (!bridgeState.capabilities.canAcceptStep) {
        return null;
      }

      await bridge.acceptStep(undefined, 8000, bridgeState.targetInstanceId);
      return 'Done. Accepted the visible ZavorthBridge step through the bridge.';
    }

    if (!bridgeState.capabilities.canSendAgentPrompt) {
      return null;
    }

    const prompt = text || 'Continue the current Zavorth task and complete the answer.';
    await bridge.sendAgentPrompt(prompt, undefined, 8000, bridgeState.targetInstanceId);
    return 'Done. Sent this text to the real ZavorthBridge conversation through the bridge.';
  }

  private describeWindowAction(
    action: 'focus' | 'approve-visible-step' | 'paste-and-submit',
    completed = false,
  ): string {
    switch (action) {
      case 'focus':
        return completed ? 'Focused the current conversation' : 'focus the current conversation';
      case 'approve-visible-step':
        return completed ? 'Accepted the visible step' : 'accept the visible step';
      default:
        return completed ? 'Sent the current text' : 'send the current text';
    }
  }

  private describeAdvancedCommandModes(capabilities: Record<string, boolean>): string[] {
    const resolveMode = (bridgeReady: boolean, fallbackReady: boolean, label: string): string =>
      `${label}=${bridgeReady ? 'bridge' : fallbackReady ? 'window' : 'unavailable'}`;

    return [
      resolveMode(Boolean(capabilities.canOpenAgentPanel), true, '/agfocus'),
      resolveMode(Boolean(capabilities.canAcceptStep), true, '/agaccept'),
      resolveMode(Boolean(capabilities.canSendAgentPrompt), true, '/agnudge'),
      resolveMode(Boolean(capabilities.canCloseAllEditors), false, '/agclean'),
      resolveMode(Boolean(capabilities.canResetSession || capabilities.canStartNewConversation), false, '/agreset'),
      '/agmodel=control',
    ];
  }
}
