import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type { ChannelInstallMode, ChannelInstallPlan, ChannelInstallScaffoldService } from '../../../../services/ChannelInstallScaffoldService.js';
import type { ChannelSetupAssistantService } from '../../../../services/ChannelSetupAssistantService.js';
import type { NaturalChannelSetupTurnService } from '../../../../services/NaturalChannelSetupTurnService.js';
import type { IntegrationHubService } from '../../../../services/IntegrationHubService.js';
import type { SharedSurfaceIntegrationCommandPack } from './SharedSurfaceIntegrationCommandPack.js';
import {
  buildNaturalChannelPreviewReply,
  buildNaturalChannelRecommendationReply,
  formatNaturalChannelLabel,
  looksLikeChannelSetupConfigFollowup,
  naturalChannelWantsDoctor,
  naturalChannelWantsTest,
  normalizeNaturalChannelText,
  SharedSurfaceNaturalChannelConversation,
  type NaturalChannelIntent,
} from './SharedSurfaceNaturalChannelLanguage.js';

export type SharedSurfaceNaturalChannelCommandPackDeps = {
  channelInstallService: Pick<ChannelInstallScaffoldService, 'applyScaffold' | 'buildPlanForChannel'> | null;
  channelSetupAssistantService: Pick<ChannelSetupAssistantService, 'apply' | 'buildSession'> | null;
  naturalChannelSetupTurnService: Pick<NaturalChannelSetupTurnService, 'buildTurn'> | null;
  integrationHubService: Pick<IntegrationHubService, 'buildIntegrationSnapshot' | 'renderConnectReport'>;
  integrationCommandPack: Pick<SharedSurfaceIntegrationCommandPack, 'executeChannelAction'>;
};

export class SharedSurfaceNaturalChannelCommandPack {
  private readonly conversation = new SharedSurfaceNaturalChannelConversation();

  public constructor(private readonly deps: SharedSurfaceNaturalChannelCommandPackDeps) {}

  public async maybeHandle(ctx: IMessageContext, rawText: string): Promise<boolean> {
    const normalizedRawText = String(rawText || '').trim();
    if (!normalizedRawText || normalizedRawText.startsWith('/')) {
      return false;
    }

    const intent =
      this.conversation.parseContextualIntent(ctx, normalizedRawText) ||
      this.conversation.parseNaturalIntent(normalizedRawText);
    if (!intent) {
      return false;
    }

    await this.handleNaturalChannelIntent(ctx, intent, normalizedRawText);
    return true;
  }

  private async handleNaturalChannelIntent(
    ctx: IMessageContext,
    intent: NaturalChannelIntent,
    rawText = '',
  ): Promise<void> {
    try {
      if (intent.previewOnly) {
        this.conversation.remember(ctx);
        await ctx.reply(buildNaturalChannelPreviewReply());
        return;
      }

      if (intent.recommendOnly) {
        this.conversation.remember(ctx, intent.compareTarget);
        await ctx.reply(buildNaturalChannelRecommendationReply(intent.compareTarget));
        return;
      }

      if (intent.channelIds && intent.channelIds.length > 0 && intent.actionId === 'prepare') {
        await this.handleNaturalChannelBatchPrepare(ctx, intent.channelIds);
        return;
      }

      if (!intent.channelId || !intent.actionId) {
        await ctx.reply('Nao consegui determinar o canal ou a acao desejada nesse fluxo guiado.');
        return;
      }

      if (
        this.deps.naturalChannelSetupTurnService
        && (intent.actionId === 'prepare' || intent.actionId === 'apply-scaffold')
      ) {
        if (intent.actionId === 'prepare') {
          this.conversation.remember(ctx, intent.compareTarget, intent.channelId);
        }
        const turn = await this.deps.naturalChannelSetupTurnService.buildTurn({
          intentText: rawText,
          channelId: intent.channelId,
          requestedBy: String(ctx.userId || '').trim() || null,
          autoApply:
            intent.actionId === 'apply-scaffold' ||
            looksLikeChannelSetupConfigFollowup(normalizeNaturalChannelText(rawText)),
          autoDoctor: naturalChannelWantsDoctor(rawText),
          autoTest: naturalChannelWantsTest(rawText),
        });
        await ctx.reply([
          this.buildNaturalChannelIntro(intent),
          '',
          turn.naturalReply,
          '',
          this.buildNaturalChannelCommandHint(
            intent,
            Boolean(this.deps.integrationHubService.buildIntegrationSnapshot(intent.channelId)),
          ),
        ].join('\n'));
        return;
      }

      if (intent.actionId === 'apply-scaffold') {
        await this.handleNaturalChannelScaffold(ctx, intent.channelId);
        return;
      }

      const result = await this.deps.integrationCommandPack.executeChannelAction({
        channelId: intent.channelId,
        actionId: intent.actionId,
        requestedBy: String(ctx.userId || '').trim() || null,
      });
      if (intent.actionId === 'prepare') {
        this.conversation.remember(ctx, intent.compareTarget, intent.channelId);
      }
      const integrationSnapshot = this.deps.integrationHubService.buildIntegrationSnapshot(intent.channelId);
      const lines = [
        this.buildNaturalChannelIntro(intent),
        '',
        result.summary,
        '',
        ...result.details.map((detail) => `- ${detail}`),
      ];
      if (result.loginQr?.dataUrl) {
        lines.push(
          '',
          '- QR pronto: use a imagem no zavorthControl/API local para escanear com seguranca.',
          `- Estado do QR: ${result.loginQr.state || 'ready'}.`,
        );
        if (result.loginQr.expiresAt) {
          lines.push(`- Expira em: ${result.loginQr.expiresAt}.`);
        }
      } else if (result.loginQr?.nextStep) {
        lines.push('', `- QR: ${result.loginQr.state || 'n/d'}. ${result.loginQr.nextStep}`);
      }

      if (intent.actionId === 'prepare') {
        if (integrationSnapshot) {
          lines.push(
            '',
            this.deps.integrationHubService.renderConnectReport({
              requestedId: intent.channelId,
              requestedBy: String(ctx.userId || 'unknown').trim() || 'unknown',
              persist: true,
            }),
          );
        } else if (result.selected) {
          lines.push(
            '',
            `Onboarding guiado: ${result.selected.label} ja aparece no Channel Mesh deste runtime, mas ainda nao tem manifesto first-class no Integration Hub.`,
            `Proximo passo do mesh: ${result.selected.actionHint}`,
          );
        }
        const setupLines = this.buildNaturalChannelSetupLines(intent.channelId);
        if (setupLines.length > 0) {
          lines.push('', ...setupLines);
        }
      }

      lines.push(
        '',
        this.buildNaturalChannelCommandHint(intent, Boolean(integrationSnapshot)),
      );

      await ctx.reply(lines.join('\n'));
    } catch (error: any) {
      await ctx.reply(error?.message || 'Nao consegui abrir o fluxo guiado desse canal agora.');
    }
  }

  private buildNaturalChannelIntro(intent: NaturalChannelIntent): string {
    const label = formatNaturalChannelLabel(String(intent.channelId || '').trim());
    switch (intent.reason) {
      case 'preview':
        return 'Entendi que voce quer ver as opcoes de canal antes de decidir.';
      case 'recommend':
        return 'Entendi que voce quer uma recomendacao de canal antes de iniciar o onboarding.';
      case 'doctor':
        return `Entendi que voce quer validar a saude do canal ${label}.`;
      case 'test':
        return `Entendi que voce quer testar o envio no canal ${label}.`;
      case 'repair':
        return `Entendi que voce quer reparar a operacao do canal ${label}.`;
      case 'status':
        return `Entendi que voce quer ver o status operacional do canal ${label}.`;
      case 'login-qr':
        return `Entendi que voce quer abrir o QR de pareamento do canal ${label}.`;
      case 'relink':
        return `Entendi que voce quer parear novamente o canal ${label}.`;
      case 'logout':
        return `Entendi que voce quer encerrar a sessao do canal ${label}.`;
      case 'policy':
        return `Entendi que voce quer revisar a policy operacional do canal ${label}.`;
      case 'apply-scaffold':
        return `Entendi que voce quer escrever o scaffold seguro do canal ${label}.`;
      case 'inspect':
        return `Entendi que voce quer inspecionar o canal ${label}.`;
      case 'connect':
      default:
        return `Entendi que voce quer colocar o Zavorth no ${label}.`;
    }
  }

  private buildNaturalChannelCommandHint(
    intent: NaturalChannelIntent,
    hasIntegrationSnapshot: boolean,
  ): string {
    const commands = [
      `/channels ${intent.channelId}`,
      `/channels status ${intent.channelId}`,
      `/channels doctor ${intent.channelId}`,
      `/channels policy ${intent.channelId}`,
      `/channels send-test ${intent.channelId}`,
    ];
    if (intent.channelId === 'whatsapp') {
      commands.push(`/channels login-qr ${intent.channelId}`);
    }
    if (hasIntegrationSnapshot) {
      commands.push(`/connect ${intent.channelId}`);
    }
    commands.push(`npm run setup:channels -- --channel ${intent.channelId}`);
    return `Comandos uteis agora: ${commands.join(' | ')}.`;
  }

  private async handleNaturalChannelScaffold(ctx: IMessageContext, channelId: string): Promise<void> {
    if (!this.deps.channelInstallService && !this.deps.channelSetupAssistantService) {
      await ctx.reply('Setup de canais indisponivel neste runtime.');
      return;
    }

    const plan = this.buildChannelInstallPlan(channelId);
    if (!plan) {
      await ctx.reply(`Nao encontrei um plano de setup para ${formatNaturalChannelLabel(channelId)}.`);
      return;
    }

    const mode = this.normalizeChannelInstallMode(plan.currentMode || plan.recommendedMode);
    if (!mode) {
      await ctx.reply(`Nao consegui resolver o modo de setup de ${plan.label}.`);
      return;
    }

    const assistantResult = this.deps.channelSetupAssistantService
      ? await this.deps.channelSetupAssistantService.apply({
        channelId: plan.channelId,
        mode,
        requestedBy: String(ctx.userId || '').trim() || null,
      })
      : null;
    const result = assistantResult?.applyReport || this.deps.channelInstallService!.applyScaffold({
      channelId: plan.channelId,
      mode,
    });
    const assistant = assistantResult?.assistant || this.deps.channelSetupAssistantService?.buildSession({
      channelId: plan.channelId,
      mode,
    }) || null;
    const refreshedPlan = this.buildChannelInstallPlan(channelId) || plan;
    const missing = assistant?.selected?.missingEnvKeys?.length
      ? assistant.selected.missingEnvKeys.join(', ')
      : refreshedPlan.missingEnvKeys.length > 0
        ? refreshedPlan.missingEnvKeys.join(', ')
        : 'nenhuma variavel obrigatoria pendente';

    await ctx.reply([
      `Scaffold seguro aplicado para ${result.channelId} (${result.mode}).`,
      '',
      `Arquivo tocado: ${result.env.filePath}.`,
      `Chaves escritas/atualizadas: ${result.env.writtenKeys.join(', ') || 'nenhuma'}.`,
      `Chaves preservadas: ${result.env.preservedKeys.join(', ') || 'nenhuma'}.`,
      `Diretorios criados: ${result.directoriesCreated.length || 0}.`,
      `Ainda falta: ${missing}.`,
      '',
      assistant?.naturalReply ? `Resumo do assistente: ${assistant.naturalReply}` : null,
      assistant?.naturalReply ? '' : null,
      'Proximos passos:',
      ...(assistant?.nextQuestions?.length ? assistant.nextQuestions : result.nextSteps).slice(0, 5).map((step) => `- ${step}`),
      '',
      `Depois rode: ${refreshedPlan.commands.doctor}.`,
    ].filter((line): line is string => line !== null).join('\n'));
  }

  private buildNaturalChannelSetupLines(channelId: string): string[] {
    const assistant = this.deps.channelSetupAssistantService?.buildSession({ channelId }) || null;
    if (assistant?.selected) {
      const selected = assistant.selected;
      const missing = selected.missingEnvKeys.length > 0
        ? selected.missingEnvKeys.join(', ')
        : 'nenhuma variavel obrigatoria pendente';
      const webhook = selected.webhookUrl || 'sem webhook para este canal';
      return [
        'Setup natural-first:',
        `- status: ${assistant.status}.`,
        `- modo recomendado: ${selected.recommendedMode}${selected.currentMode ? ` | modo atual: ${selected.currentMode}` : ''}.`,
        `- variaveis obrigatorias: ${selected.requiredEnvKeys.join(', ') || 'nenhuma'}.`,
        `- faltando agora: ${missing}.`,
        `- webhook: ${webhook}.`,
        `- proximo passo: ${selected.operatorNextStep}`,
        `- se quiser que eu escreva o scaffold seguro no .env, diga: "aplique o scaffold do ${selected.label}".`,
      ];
    }

    const plan = this.buildChannelInstallPlan(channelId);
    if (!plan) {
      return [];
    }

    const missing = plan.missingEnvKeys.length > 0
      ? plan.missingEnvKeys.join(', ')
      : 'nenhuma variavel obrigatoria pendente';
    const webhook = plan.publicWebhookUrl || plan.localWebhookUrl || 'sem webhook para este canal';
    return [
      'Setup natural-first:',
      `- modo recomendado: ${plan.recommendedMode}${plan.currentMode ? ` | modo atual: ${plan.currentMode}` : ''}.`,
      `- variaveis obrigatorias: ${plan.requiredEnvKeys.join(', ') || 'nenhuma'}.`,
      `- faltando agora: ${missing}.`,
      `- webhook: ${webhook}.`,
      `- se quiser que eu escreva o scaffold seguro no .env, diga: "aplique o scaffold do ${plan.label}".`,
    ];
  }

  private buildChannelInstallPlan(channelId: string): ChannelInstallPlan | null {
    if (!this.deps.channelInstallService) {
      return null;
    }
    try {
      return this.deps.channelInstallService.buildPlanForChannel(channelId as any);
    } catch {
      return null;
    }
  }

  private normalizeChannelInstallMode(value: string | null | undefined): ChannelInstallMode | null {
    const normalized = String(value || '').trim().toLowerCase();
    const modes: ChannelInstallMode[] = [
      'native',
      'bridge',
      'stub',
      'cloud-api',
      'baileys',
      'signal-cli',
      'mac-bridge',
      'graph-bot',
      'meta-messaging',
      'local-outbox',
      'smtp-imap',
    ];
    return modes.find((mode) => mode === normalized) || null;
  }

  private async handleNaturalChannelBatchPrepare(
    ctx: IMessageContext,
    channelIds: string[],
  ): Promise<void> {
    const uniqueIds = Array.from(new Set(channelIds.map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean)));
    if (uniqueIds.length === 0) {
      await ctx.reply('Nao encontrei canais suficientes para preparar nesse passo.');
      return;
    }

    if (uniqueIds.length === 1) {
      await this.handleNaturalChannelIntent(ctx, {
        channelId: uniqueIds[0],
        actionId: 'prepare',
        reason: 'connect',
      }, `quero conectar ao ${uniqueIds[0]}`);
      return;
    }

    const replies: string[] = [
      'Preparei mais de um canal com base na conversa recente.',
      '',
    ];
    for (const channelId of uniqueIds) {
      const result = await this.deps.integrationCommandPack.executeChannelAction({
        channelId,
        actionId: 'prepare',
        requestedBy: String(ctx.userId || '').trim() || null,
      });
      replies.push(`${formatNaturalChannelLabel(channelId)}: ${result.summary}`);
    }

    replies.push('', 'Se quiser, agora eu posso aprofundar um deles com doctor, policy ou onboarding guiado.');
    await ctx.reply(replies.join('\n'));
  }
}
