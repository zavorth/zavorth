import { Context } from 'grammy';
import { ZavorthBridgePreferenceStore } from '../../agents/ZavorthBridgePreferenceStore.js';
import { CapabilityLifecycleService } from '../../services/CapabilityLifecycleService.js';
import {
  CapabilityUnavailableError,
  isCapabilityUnavailableError,
} from '../../services/OptionalCapabilityGuard.js';
import {
  ZavorthBridgeControlAction,
  ZavorthBridgeControlResult,
  ZavorthBridgeControlService,
} from '../../services/ZavorthBridgeControlService.js';
import { TelegramOpsInsightPresentationService } from './TelegramOpsInsightPresentationService.js';

type TelegramZavorthBridgeControlServiceDeps = {
  zavorthBridgeControlService: Pick<ZavorthBridgeControlService, 'open' | 'restart' | 'status' | 'setModel'>;
  zavorthBridgePreferenceStore: Pick<ZavorthBridgePreferenceStore, 'getPreferredModel' | 'setPreferredModel'>;
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

    if (normalized === '/ag_open' || normalized === 'abrir zavorthbridge' || normalized === 'abrir zavorth bridge') {
      return { action: 'open' };
    }

    if (
      normalized === '/ag_status' ||
      normalized === 'status do zavorthbridge' ||
      normalized === 'status do zavorth bridge' ||
      normalized === 'status zavorthbridge' ||
      normalized === 'status zavorth bridge'
    ) {
      return { action: 'status' };
    }

    if (
      normalized === '/ag_restart' ||
      normalized === 'reiniciar zavorthbridge' ||
      normalized === 'reiniciar zavorth bridge' ||
      normalized === 'reiniciar o zavorthbridge' ||
      normalized === 'reiniciar o zavorth bridge'
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
    } catch (error: any) {
      if (isCapabilityUnavailableError(error)) {
        await ctx.reply(this.buildCapabilityUnavailableReply(
          error,
          ctx.from?.id?.toString() || 'unknown',
          'Para concluir esse passo do ZavorthBridge eu preciso ativar a capability remota opcional deste host.',
        ));
        return;
      }
      await ctx.reply(`Falha no controle seguro do ZavorthBridge: ${error.message}`);
    }
  }

  public async handleModelCommand(ctx: Context, args: string): Promise<void> {
    const requestedModel = args?.trim() || '';
    if (!requestedModel) {
      const currentPreferredModel = await this.deps.zavorthBridgePreferenceStore.getPreferredModel();
      await ctx.reply(
        `Para trocar o modelo do ZavorthBridge, use /agmodel <nome> ou /ag_model <nome>.\n\nModelo atual salvo: ${currentPreferredModel || 'nenhum'}\nModelos permitidos: gemini-3.1-pro-high, gemini-3.1-pro-low, gemini-3.1-flash.`,
      );
      return;
    }

    const sanitizedModel = requestedModel.replace(/^[+\s]+/, '');
    const normalizedModel = /^clear$/i.test(sanitizedModel) ? null : sanitizedModel;

    if (!normalizedModel) {
      await this.deps.zavorthBridgePreferenceStore.setPreferredModel(null);
      await ctx.reply('Pronto. Removi a preferencia salva de modelo do ZavorthBridge.');
      return;
    }

    await this.handleControl(ctx, 'set-model', normalizedModel);
  }

  public formatControlReply(result: ZavorthBridgeControlResult): string {
    if (result.action === 'set-model') {
      if (result.ok && result.verified) {
        return `Pronto. Modelo do ZavorthBridge confirmado: ${result.selectedModel || 'indisponivel'}.`;
      }

      const failureLines = [
        result.ok
          ? 'Consegui iniciar a troca do modelo, mas a confirmacao final ficou parcial.'
          : 'Nao consegui trocar o modelo do ZavorthBridge agora.',
      ];

      if (result.selectedModel) {
        failureLines.push(`Modelo pedido: ${result.selectedModel}`);
      }
      if (result.errorMessage) {
        failureLines.push(`Motivo: ${result.errorMessage}`);
      }
      if (result.allowedModels && result.allowedModels.length > 0 && result.errorCode === 'model_not_allowed') {
        failureLines.push(`Modelos permitidos: ${result.allowedModels.join(', ')}`);
      }
      return failureLines.join('\n');
    }

    if (result.action === 'open') {
      return result.ok
        ? 'Pronto. O ZavorthBridge foi aberto.'
        : `Nao consegui abrir o ZavorthBridge agora.${result.errorMessage ? `\nMotivo: ${result.errorMessage}` : ''}`;
    }

    if (result.action === 'restart') {
      return result.ok
        ? 'Pronto. Reiniciei o ZavorthBridge.'
        : `Nao consegui reiniciar o ZavorthBridge agora.${result.errorMessage ? `\nMotivo: ${result.errorMessage}` : ''}`;
    }

    const readinessSummary = this.describeReadiness(result) || 'indisponivel';
    const lines = [`Status do ZavorthBridge: ${readinessSummary}.`];

    if (result.selectedModel) {
      lines.push(`Modelo: ${result.selectedModel}`);
    }
    if (typeof result.sessionAccessible === 'boolean') {
      lines.push(`Sessao acessivel: ${result.sessionAccessible ? 'sim' : 'nao'}`);
    }
    if (typeof result.remoteModeActive === 'boolean') {
      lines.push(`Modo remoto: ${result.remoteModeActive ? 'ativo' : 'inativo'}`);
    }
    if (result.errorMessage) {
      lines.push(`Motivo: ${result.errorMessage}`);
    }

    return lines.join('\n');
  }

  private describeReadiness(result: ZavorthBridgeControlResult): string | null {
    if (result.action !== 'status') {
      return null;
    }
    if (!result.appInstalled) {
      return 'ZavorthBridge nao instalado neste notebook';
    }
    if (result.sessionAccessible === false) {
      if (result.desktopName && result.desktopName !== 'Default') {
        return `bloqueado pela sessao do Windows (desktop atual: ${result.desktopName})`;
      }
      return 'sessao do Windows nao acessivel para automacao';
    }
    if (!result.processFound || !result.windowFound) {
      return 'ZavorthBridge fechado ou janela principal nao encontrada';
    }
    if (result.remoteModeActive === false) {
      return 'pronto para uso local; para uso remoto, ative /remote on';
    }
    if (result.remoteModeActive === true && result.sessionAccessible === true && result.processFound && result.windowFound) {
      return 'pronto para uso remoto';
    }
    return 'parcialmente pronto; confira os detalhes abaixo';
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
