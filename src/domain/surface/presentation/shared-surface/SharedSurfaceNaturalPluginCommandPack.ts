import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type { ZavorthPluginRegistryService } from '../../../../services/ZavorthPluginRegistryService.js';
import type { SharedSurfaceIntegrationCommandPack } from './SharedSurfaceIntegrationCommandPack.js';

type NaturalPluginIntent = {
  pluginId?: string;
  pluginIds?: string[];
  actionId?: 'open' | 'doctor' | 'trust' | 'review' | 'install' | 'update' | 'remove';
  reason: 'open' | 'doctor' | 'trust' | 'review' | 'install' | 'update' | 'remove' | 'preview' | 'recommend';
  previewOnly?: boolean;
  recommendOnly?: boolean;
  compareTarget?: string;
};

type PluginConversationOption = {
  pluginId: string;
  label: string;
  actionId: 'install';
};

type PluginConversationState = {
  options: PluginConversationOption[];
  recommendedOption?: PluginConversationOption;
  secondaryOption?: PluginConversationOption;
  compareTarget?: string;
  updatedAt: number;
};

export type SharedSurfaceNaturalPluginCommandPackDeps = {
  integrationCommandPack: Pick<SharedSurfaceIntegrationCommandPack, 'executePluginAction'>;
  pluginRegistryService: Pick<ZavorthPluginRegistryService, 'buildSnapshot'>;
};

export class SharedSurfaceNaturalPluginCommandPack {
  private readonly pluginConversationState = new Map<string, PluginConversationState>();

  public constructor(private readonly deps: SharedSurfaceNaturalPluginCommandPackDeps) {}

  public async maybeHandle(ctx: IMessageContext, rawText: string): Promise<boolean> {
    const normalizedRawText = String(rawText || '').trim();
    if (!normalizedRawText || normalizedRawText.startsWith('/')) {
      return false;
    }

    const intent = this.parseContextualPluginIntent(ctx, normalizedRawText) || this.parseNaturalPluginIntent(normalizedRawText);
    if (!intent) {
      return false;
    }

    await this.handleNaturalPluginIntent(ctx, intent);
    return true;
  }

  private parseNaturalPluginIntent(rawText: string): NaturalPluginIntent | null {
    const original = String(rawText || '').trim();
    const normalized = this.normalizeNaturalText(rawText);
    if (!normalized || normalized.startsWith('/')) {
      return null;
    }

    const mentionsPluginPlane =
      /\b(plugin|plugins|extensao|extensoes|integracao|integracoes|integration|integrations|skill|skills)\b/.test(normalized);
    if (!mentionsPluginPlane) {
      return null;
    }

    const wantsPreview =
      /\b(mostre|mostrar|mostra|ver|veja|quero ver)\b/.test(normalized) &&
      /\b(opcoes|opcao|alternativas)\b/.test(normalized) &&
      /\b(antes de instalar|antes de abrir|antes de decidir|antes de confiar)\b/.test(normalized);
    const compareTarget = this.extractNaturalPluginCompareTarget(original);
    const wantsRecommendation =
      /\b(qual|quais)\b/.test(normalized) &&
      /\b(plugin|plugins|skill|skills|integracao|integracoes)\b/.test(normalized) &&
      /\b(melhor|melhores|recomendado|recomenda)\b/.test(normalized);

    if (wantsPreview) {
      return {
        reason: 'preview',
        previewOnly: true,
        compareTarget,
      };
    }

    if (wantsRecommendation) {
      return {
        reason: 'recommend',
        recommendOnly: true,
        compareTarget,
      };
    }

    const actionId =
      /\b(remover|remova|desinstalar|desinstale|apagar|apague|delete)\b/.test(normalized)
        ? 'remove'
        : /\b(atualizar|atualize|update|upgrade|reconciliar|reconcilie)\b/.test(normalized)
          ? 'update'
          : /\b(trusted|confiavel|confiavel|confiar|confie|trust|aprovar|aprove)\b/.test(normalized)
            ? 'trust'
            : /\b(review|revisao|revisar|rebaixe)\b/.test(normalized)
              ? 'review'
              : /\b(doctor|diagnostico|diagnosticar|health|saude|validar|verificar|check)\b/.test(normalized)
                ? 'doctor'
                : /\b(instalar|instale|adicionar|adicione|habilitar|habilite|ativar|ative)\b/.test(normalized)
                  ? 'install'
                  : /\b(abrir|abra|open|proximo passo|next|mostrar)\b/.test(normalized)
                    ? 'open'
                    : null;
    if (!actionId) {
      return null;
    }

    const pluginId = this.resolveNaturalPluginId(normalized);
    if (!pluginId) {
      return mentionsPluginPlane ? null : null;
    }

    return {
      pluginId,
      actionId,
      reason: actionId,
    };
  }


  private parseContextualPluginIntent(
    ctx: Pick<IMessageContext, 'platform' | 'chatId' | 'userId'>,
    rawText: string,
  ): NaturalPluginIntent | null {
    const normalized = this.normalizeNaturalText(rawText);
    if (!normalized || normalized.startsWith('/')) {
      return null;
    }

    const state = this.readPluginConversation(ctx);
    if (!state) {
      return null;
    }

    if (/\b(vai com o recomendado|segue o recomendado|pode ir no recomendado|instala o recomendado)\b/.test(normalized)) {
      if (!state.recommendedOption) {
        return null;
      }
      return {
        pluginId: state.recommendedOption.pluginId,
        actionId: 'install',
        reason: 'install',
      };
    }

    if (/\b(faz os dois|instala os dois|quero os dois|pode fazer os dois)\b/.test(normalized)) {
      const primary = state.recommendedOption || state.options[0];
      const secondary = state.secondaryOption || state.options[1];
      const pluginIds = [primary?.pluginId, secondary?.pluginId].filter(
        (entry, index, list): entry is string => Boolean(entry) && list.indexOf(entry) === index,
      );
      if (pluginIds.length === 0) {
        return null;
      }
      return {
        pluginIds,
        actionId: 'install',
        reason: 'install',
      };
    }

    const ordinal = this.extractImplicitTaskVariationPreviewSelection(normalized);
    if (ordinal) {
      const option = state.options[ordinal - 1];
      if (!option) {
        return null;
      }
      return {
        pluginId: option.pluginId,
        actionId: 'install',
        reason: 'install',
      };
    }

    const pluginId = this.resolveNaturalPluginId(normalized);
    if (pluginId && /\b(na verdade|melhor|prefiro|vai de|vamos de|quero)\b/.test(normalized)) {
      return {
        pluginId,
        actionId: 'install',
        reason: 'install',
      };
    }

    return null;
  }


  private async handleNaturalPluginIntent(
    ctx: IMessageContext,
    intent: NaturalPluginIntent,
  ): Promise<void> {
    try {
      if (intent.previewOnly) {
        this.rememberPluginConversation(ctx);
        await ctx.reply(this.buildNaturalPluginPreviewReply());
        return;
      }

      if (intent.recommendOnly) {
        this.rememberPluginConversation(ctx, intent.compareTarget);
        await ctx.reply(this.buildNaturalPluginRecommendationReply(intent.compareTarget));
        return;
      }

      if (intent.pluginIds && intent.pluginIds.length > 0 && intent.actionId === 'install') {
        await this.handleNaturalPluginBatchInstall(ctx, intent.pluginIds);
        return;
      }

      if (!intent.pluginId || !intent.actionId) {
        await ctx.reply('Nao consegui determinar o plugin ou a acao desejada nesse fluxo guiado.');
        return;
      }

      const result = await this.deps.integrationCommandPack.executePluginAction({
        pluginId: intent.pluginId,
        actionId: intent.actionId,
        requestedBy: String(ctx.userId || '').trim() || null,
      });
      await ctx.reply([
        this.buildNaturalPluginIntro(intent),
        '',
        result.summary,
        '',
        ...result.details.map((detail) => `- ${detail}`),
        '',
        `Comandos uteis agora: /plugins ${intent.pluginId} | /plugins doctor ${intent.pluginId} | /plugins open ${intent.pluginId}.`,
      ].join('\n'));
    } catch (error: any) { const err = error; const e = error;
      await ctx.reply(error?.message || 'Nao consegui abrir o fluxo guiado desse plugin agora.');
    }
  }


  private buildNaturalPluginIntro(intent: NaturalPluginIntent): string {
    const label = String(intent.pluginId || '').trim();
    switch (intent.reason) {
      case 'preview':
        return 'Entendi que voce quer ver as opcoes de plugin antes de decidir.';
      case 'recommend':
        return 'Entendi que voce quer uma recomendacao de plugin antes de agir.';
      case 'install':
        return `Entendi que voce quer instalar ou registrar o plugin ${label}.`;
      case 'update':
        return `Entendi que voce quer atualizar o plugin ${label}.`;
      case 'trust':
        return `Entendi que voce quer marcar o plugin ${label} como trusted.`;
      case 'review':
        return `Entendi que voce quer voltar o plugin ${label} para review.`;
      case 'doctor':
        return `Entendi que voce quer rodar doctor no plugin ${label}.`;
      case 'remove':
        return `Entendi que voce quer remover o plugin ${label}.`;
      case 'open':
      default:
        return `Entendi que voce quer abrir o proximo passo do plugin ${label}.`;
    }
  }


  private buildNaturalPluginPreviewReply(compareTarget?: string): string {
    const options = this.getNaturalPluginPreviewOptions(compareTarget);
    return [
      'Ainda nao instalei nenhum plugin novo. Aqui estao as opcoes mais naturais agora:',
      '',
      'Opcoes:',
      ...options.map((entry, index) => `${index + 1}. ${entry.label}`),
      '',
      'Se quiser, me diga uma opcao, um plugin especifico ou "vai com o recomendado".',
    ].join('\n');
  }


  private buildNaturalPluginRecommendationReply(compareTarget?: string): string {
    const options = this.getNaturalPluginPreviewOptions(compareTarget);
    const target = String(compareTarget || '').trim();
    const normalizedTarget = this.normalizeNaturalText(target);
    let rationale =
      'esse plugin parece o melhor ponto de entrada para ampliar capacidade sem adicionar friccao desnecessaria agora.';

    if (/(llm|modelo|modelos|roteador|router|provider|providers|api)/.test(normalizedTarget)) {
      rationale =
        'para modelo, roteamento e multiplos providers, esse plugin tende a ser o ponto mais util para ganhar flexibilidade rapido.';
    } else if (/(mobile|celular|android|ios|remoto|bridge)/.test(normalizedTarget)) {
      rationale =
        'para bridge remota e mobilidade, esse plugin tende a encaixar melhor no fluxo operacional atual do Zavorth.';
    } else if (/(observabilidade|logs|telemetria|monitoramento)/.test(normalizedTarget)) {
      rationale =
        'para observabilidade, faz mais sentido priorizar o plugin que expose telemetria e leitura operacional primeiro.';
    }

    return [
      'Minha recomendacao de plugin agora:',
      '',
      `Melhor opcao: ${options[0]?.label || 'n/d'}`,
      `Motivo: ${rationale}`,
      '',
      'Se quiser, posso instalar esse plugin agora ou mostrar as outras opcoes.',
    ].join('\n');
  }


  private getNaturalPluginPreviewOptions(compareTarget?: string): PluginConversationOption[] {
    const snapshot = this.deps.pluginRegistryService.buildSnapshot();
    const entries = (snapshot.entries || []).map((entry) => ({
      pluginId: entry.id,
      label: entry.label || entry.id,
      tags: entry.tags || [],
    }));
    const normalizedTarget = this.normalizeNaturalText(compareTarget || '');
    const scored = entries
      .map((entry) => {
        const haystack = this.normalizeNaturalText([entry.pluginId, entry.label, ...entry.tags].join(' '));
        let score = 0;
        if (/(llm|modelo|modelos|roteador|router|provider|providers|api)/.test(normalizedTarget)) {
          if (/(openrouter|router|llm|provider)/.test(haystack)) {
            score += 6;
          }
        }
        if (/(mobile|celular|android|ios|remoto|bridge)/.test(normalizedTarget)) {
          if (/(bridge|mobile|remote|zavorthBridge)/.test(haystack)) {
            score += 6;
          }
        }
        if (/(observabilidade|logs|telemetria|monitoramento)/.test(normalizedTarget)) {
          if (/(telemetry|observability|monitor|log)/.test(haystack)) {
            score += 6;
          }
        }
        if (score === 0 && /(openrouter)/.test(haystack)) {
          score += 2;
        }
        return {
          pluginId: entry.pluginId,
          label: entry.label,
          actionId: 'install' as const,
          score,
        };
      })
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));

    return scored.slice(0, 6).map((entry) => ({
      pluginId: entry.pluginId,
      label: entry.label,
      actionId: 'install',
    }));
  }


  private rememberPluginConversation(
    ctx: Pick<IMessageContext, 'platform' | 'chatId' | 'userId'>,
    compareTarget?: string,
  ): void {
    const options = this.getNaturalPluginPreviewOptions(compareTarget);
    this.pluginConversationState.set(this.buildPluginConversationKey(ctx), {
      options,
      recommendedOption: options[0],
      secondaryOption: options[1],
      compareTarget: String(compareTarget || '').trim() || undefined,
      updatedAt: Date.now(),
    });
  }


  private readPluginConversation(
    ctx: Pick<IMessageContext, 'platform' | 'chatId' | 'userId'>,
  ): PluginConversationState | null {
    const key = this.buildPluginConversationKey(ctx);
    const entry = this.pluginConversationState.get(key);
    if (!entry) {
      return null;
    }
    if (Date.now() - entry.updatedAt > 15 * 60 * 1000) {
      this.pluginConversationState.delete(key);
      return null;
    }
    return entry;
  }


  private buildPluginConversationKey(
    ctx: Pick<IMessageContext, 'platform' | 'chatId' | 'userId'>,
  ): string {
    return [
      String(ctx.platform || '').trim(),
      String(ctx.chatId || '').trim(),
      String(ctx.userId || '').trim(),
      'plugins',
    ].join('::');
  }


  private extractNaturalPluginCompareTarget(rawText: string): string | undefined {
    const match = String(rawText || '').match(/\b(?:para|pro|pra)\s+(.+)$/i);
    return match?.[1] ? String(match[1]).trim() : undefined;
  }


  private async handleNaturalPluginBatchInstall(
    ctx: IMessageContext,
    pluginIds: string[],
  ): Promise<void> {
    const uniqueIds = Array.from(new Set(pluginIds.map((entry) => String(entry || '').trim()).filter(Boolean)));
    if (uniqueIds.length === 0) {
      await ctx.reply('Nao encontrei plugins suficientes para instalar nesse passo.');
      return;
    }

    if (uniqueIds.length === 1) {
      await this.handleNaturalPluginIntent(ctx, {
        pluginId: uniqueIds[0],
        actionId: 'install',
        reason: 'install',
      });
      return;
    }

    const lines = [
      'Abri mais de um fluxo de plugin com base na conversa recente.',
      '',
    ];
    for (const pluginId of uniqueIds) {
      const result = await this.deps.integrationCommandPack.executePluginAction({
        pluginId,
        actionId: 'install',
        requestedBy: String(ctx.userId || '').trim() || null,
      });
      lines.push(`${pluginId}: ${result.summary}`);
    }
    lines.push('', 'Se quiser, agora eu posso aprofundar um deles com doctor, trust ou proximo passo.');
    await ctx.reply(lines.join('\n'));
  }


  private resolveNaturalPluginId(normalized: string): string | null {
    const snapshot = this.deps.pluginRegistryService.buildSnapshot();
    return this.resolveNaturalEntryId(
      normalized,
      snapshot.entries.map((entry) => ({
        id: entry.id,
        phrases: [entry.id, entry.label, ...entry.tags],
      })),
    );
  }


  private resolveNaturalEntryId(
    normalized: string,
    entries: Array<{ id: string; phrases: Array<string | null | undefined> }>,
  ): string | null {
    let best: { id: string; score: number } | null = null;
    for (const entry of entries) {
      for (const phrase of entry.phrases) {
        const folded = this.normalizeNaturalText(phrase);
        if (!folded || folded.length < 3) {
          continue;
        }
        const pattern = new RegExp(`(^|[^a-z0-9])${this.escapeRegex(folded)}([^a-z0-9]|$)`, 'i');
        if (!pattern.test(normalized) && !normalized.includes(folded)) {
          continue;
        }
        const score = folded.length;
        if (!best || score > best.score) {
          best = { id: entry.id, score };
        }
      }
    }
    return best?.id || null;
  }


  private extractNaturalTaskVariationPreviewSelection(normalized: string): number | null {
    const match = normalized.match(
      /\b(?:abre|abrir|abra|usa|usar|quero|escolhe|escolher|pegue|pega)\b.*?\b(a\s+)?(primeira|segunda|terceira|quarta|quinta|sexta|1|2|3|4|5|6)\s+opcao\b/,
    );
    if (!match?.[2]) {
      return null;
    }
    switch (match[2]) {
      case 'primeira':
      case '1':
        return 1;
      case 'segunda':
      case '2':
        return 2;
      case 'terceira':
      case '3':
        return 3;
      case 'quarta':
      case '4':
        return 4;
      case 'quinta':
      case '5':
        return 5;
      case 'sexta':
      case '6':
        return 6;
      default:
        return null;
    }
  }


  private extractImplicitTaskVariationPreviewSelection(normalized: string): number | null {
    const match = normalized.match(/\b(?:na verdade\s+)?(primeira|segunda|terceira|quarta|quinta|sexta|1|2|3|4|5|6)\b/);
    if (!match?.[1]) {
      return null;
    }
    return this.extractNaturalTaskVariationPreviewSelection(`abre a ${match[1]} opcao`);
  }


  private normalizeNaturalText(value: string | null | undefined): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }


  private escapeRegex(value: string): string {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
