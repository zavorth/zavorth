import { Context } from 'grammy';
import { ZavorthBridgePreferenceStore } from '../../../../agents/ZavorthBridgePreferenceStore.js';
import { CapabilityLifecycleService } from '@zavorth/services/CapabilityLifecycleService.js';
import {
  CapabilityUnavailableError,
  isCapabilityUnavailableError,
} from '@zavorth/services/OptionalCapabilityGuard.js';
import {
  ZavorthBridgeControlAction,
  ZavorthBridgeControlResult,
  ZavorthBridgeControlService,
} from '@zavorth/services/ZavorthBridgeControlService.js';
import { TelegramOpsInsightPresentationService } from '../../../../gateways/channels/telegram/controllers/TelegramOpsInsightPresentationService.js';
import { asErrorLike } from '../../../../utils/errorLike.js';

type TelegramZavorthBridgeControlServiceDeps = {
  zavorthBridgeControlService: Pick<ZavorthBridgeControlService, 'open' | 'restart' | 'status' | 'setModel'>;
  zavorthBridgePreferenceStore: Pick<ZavorthBridgePreferenceStore, 'getPreferredModel' | 'setPreferredModel' | 'forUser'>;
  capabilityLifecycleService?: CapabilityLifecycleService;
};

export class TelegramZavorthBridgeControlService {
  private readonly opsPresentationService = new TelegramOpsInsightPresentationService();

  constructor(private readonly deps: TelegramZavorthBridgeControlServiceDeps) {}

  public parseControlCommand(rawText: string): { action: ZavorthBridgeControlAction; model?: string } | null {
    const trimmed = rawText.trim();
    const normalized = trimmed
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');

    if (normalized === '/ag_open' || normalized === 'abrir zavorthbridge' || normalized === 'abrir zavorth bridge' || normalized === 'open zavorthbridge' || normalized === 'open zavorth bridge') {
      return { action: 'open' };
    }

    if (
      normalized === '/ag_status' ||
      normalized === 'status do zavorthbridge' ||
      normalized === 'status do zavorth bridge' ||
      normalized === 'status zavorthbridge' ||
      normalized === 'status zavorth bridge' ||
      normalized === 'zavorthbridge status' ||
      normalized === 'zavorth bridge status'
    ) {
      return { action: 'status' };
    }

    if (
      normalized === '/ag_restart' ||
      normalized === 'reiniciar zavorthbridge' ||
      normalized === 'reiniciar zavorth bridge' ||
      normalized === 'reiniciar o zavorthbridge' ||
      normalized === 'reiniciar o zavorth bridge' ||
      normalized === 'restart zavorthbridge' ||
      normalized === 'restart zavorth bridge'
    ) {
      return { action: 'restart' };
    }

    const modelSlashMatch = trimmed.match(/^\/ag_model\s+(.+)$/i);
    if (modelSlashMatch) {
      return { action: 'set-model', model: modelSlashMatch[1].trim() };
    }

    const openWithModelMatch = normalized.match(/^abrir zavorth ?bridge com\s+(.+)$/i);
    if (openWithModelMatch) {
      return { action: 'set-model', model: openWithModelMatch[1].trim() };
    }

    const modelNaturalMatch = normalized.match(/^(?:usar|trocar para|mudar para)\s+(.+?)\s+(?:no|do)\s+zavorth ?bridge$/i);
    if (modelNaturalMatch) {
      return { action: 'set-model', model: modelNaturalMatch[1].trim() };
    }

    return null;
  }

  public parsePromptCommand(rawText: string): { model: string; prompt: string } | null {
    const trimmed = rawText.trim();
    const slashMatch = trimmed.match(/^\/ag_prompt\s+([^|]+?)\s*\|\s*([\s\S]+)$/i);
    if (!slashMatch) {
      if (/^\/ag_prompt\b/i.test(trimmed)) {
        return { model: '', prompt: '' };
      }
      return null;
    }

    const model = slashMatch[1]?.trim() || '';
    const prompt = slashMatch[2]?.trim() || '';
    if (!model || !prompt) {
      return null;
    }

    return { model, prompt };
  }

  public async handleControl(
    ctx: Context,
    action: ZavorthBridgeControlAction,
    model?: string,
  ): Promise<void> {
    try {
      const result =
        action === 'open'
          ? await this.deps.zavorthBridgeControlService.open()
          : action === 'restart'
            ? await this.deps.zavorthBridgeControlService.restart()
            : action === 'set-model'
              ? await this.deps.zavorthBridgeControlService.setModel(model || '')
              : await this.deps.zavorthBridgeControlService.status();

      if (action === 'set-model' && result.ok) {
        this.deps.capabilityLifecycleService?.registerCapabilityUsage(
          'remote',
          `remote flow used by ${ctx.from?.id?.toString() || 'unknown'} via ZavorthBridge model change`,
        );
      }

      await ctx.reply(this.formatControlReply(result));
    } catch (error: unknown) {
      const err = asErrorLike(error);
      if (isCapabilityUnavailableError(error)) {
        await ctx.reply(this.buildCapabilityUnavailableReply(
          error,
          ctx.from?.id?.toString() || 'unknown',
          'To complete this ZavorthBridge step I need to enable the optional remote capability on this host.',
        ));
        return;
      }
      await ctx.reply(`ZavorthBridge control failed: ${error instanceof Error ? err.message : String(error)}`);
    }
  }

  public async handleModelCommand(ctx: Context, args: string): Promise<void> {
    const requestedModel = args?.trim() || '';
    const operatorUserId = ctx.from?.id?.toString() || null;
    const store = typeof (this.deps.zavorthBridgePreferenceStore as any).forUser === 'function'
      ? (this.deps.zavorthBridgePreferenceStore as ZavorthBridgePreferenceStore).forUser(operatorUserId)
      : this.deps.zavorthBridgePreferenceStore;
    if (!requestedModel) {
      const currentPreferredModel = await store.getPreferredModel(operatorUserId);
      await ctx.reply(
        `To change the ZavorthBridge model, use /agmodel <name> or /ag_model <name>.\n\nCurrent saved model: ${currentPreferredModel || 'none'}\nAllowed models: gemini-2.5-pro, gemini-3.1-pro-low, gemini-3.1-flash.`,
      );
      return;
    }

    const sanitizedModel = requestedModel.replace(/^[+\s]+/, '');
    const normalizedModel = /^clear$/i.test(sanitizedModel) ? null : sanitizedModel;

    if (!normalizedModel) {
      await store.setPreferredModel(null, operatorUserId);
      await ctx.reply('Done. Removed the saved ZavorthBridge model preference.');
      return;
    }

    await this.handleControl(ctx, 'set-model', normalizedModel);
  }

  public formatControlReply(result: ZavorthBridgeControlResult): string {
    if (result.action === 'set-model') {
      if (result.ok && result.verified) {
        return `Done. ZavorthBridge model confirmed: ${result.selectedModel || 'unavailable'}.`;
      }

      const failureLines = [
        result.ok
          ? 'Started the model switch, but the final confirmation was partial.'
          : 'Could not switch ZavorthBridge model right now.',
      ];

      if (result.selectedModel) {
        failureLines.push(`Requested model: ${result.selectedModel}`);
      }
      if (result.errorMessage) {
        failureLines.push(`Reason: ${result.errorMessage}`);
      }
      if (result.allowedModels && result.allowedModels.length > 0 && result.errorCode === 'model_not_allowed') {
        failureLines.push(`Allowed models: ${result.allowedModels.join(', ')}`);
      }
      return failureLines.join('\n');
    }

    if (result.action === 'open') {
      return result.ok
        ? 'Done. ZavorthBridge has been opened.'
        : `Could not open ZavorthBridge right now.${result.errorMessage ? `\nReason: ${result.errorMessage}` : ''}`;
    }

    if (result.action === 'restart') {
      return result.ok
        ? 'Done. ZavorthBridge has been restarted.'
        : `Could not restart ZavorthBridge right now.${result.errorMessage ? `\nReason: ${result.errorMessage}` : ''}`;
    }

    const readinessSummary = this.describeReadiness(result) || 'unavailable';
    const lines = [`ZavorthBridge status: ${readinessSummary}.`];

    if (result.selectedModel) {
      lines.push(`Model: ${result.selectedModel}`);
    }
    if (typeof result.sessionAccessible === 'boolean') {
      lines.push(`Session accessible: ${result.sessionAccessible ? 'yes' : 'no'}`);
    }
    if (typeof result.remoteModeActive === 'boolean') {
      lines.push(`Remote mode: ${result.remoteModeActive ? 'active' : 'inactive'}`);
    }
    if (result.errorMessage) {
      lines.push(`Reason: ${result.errorMessage}`);
    }

    return lines.join('\n');
  }

  private describeReadiness(result: ZavorthBridgeControlResult): string | null {
    if (result.action !== 'status') {
      return null;
    }
    if (!result.appInstalled) {
      return 'ZavorthBridge not installed on this machine';
    }
    if (result.sessionAccessible === false) {
      if (result.desktopName && result.desktopName !== 'Default') {
        return `blocked by Windows session (current desktop: ${result.desktopName})`;
      }
      return 'Windows session not accessible for automation';
    }
    if (!result.processFound || !result.windowFound) {
      return 'ZavorthBridge closed or main window not found';
    }
    if (result.remoteModeActive === false) {
      return 'ready for local use; for remote use, enable /remote on';
    }
    if (result.remoteModeActive === true && result.sessionAccessible === true && result.processFound && result.windowFound) {
      return 'ready for remote use';
    }
    return 'partially ready; check the details below';
  }

  private buildCapabilityUnavailableReply(
    error: CapabilityUnavailableError,
    userId: string,
    reason: string,
  ): string {
    const capabilityLifecycleService = this.deps.capabilityLifecycleService;
    if (!capabilityLifecycleService) {
      return `${reason}\n\n${error.message}`;
    }

    const demand = capabilityLifecycleService.registerCapabilityDemand(
      error.capabilityId,
      userId,
      reason,
      error.dependencyName,
    );
    if (!demand) {
      return `${reason}\n\n${error.message}`;
    }

    return this.opsPresentationService.formatCapabilityApprovalReply(
      demand.capability,
      demand.approval,
      {
        reason,
        remediation: error.remediation,
        dependencyName: error.dependencyName,
      },
    );
  }
}
