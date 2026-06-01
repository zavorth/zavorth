import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type { ZavorthRemoteTransportService } from '../../../../services/ZavorthRemoteTransportService.js';
import type { SharedSurfaceIntegrationCommandPack } from './SharedSurfaceIntegrationCommandPack.js';

type NaturalTransportIntent = {
  transportId?: string;
  transportIds?: string[];
  actionId?: 'inspect' | 'prepare' | 'smoke' | 'repair';
  reason: 'inspect' | 'prepare' | 'smoke' | 'repair' | 'preview' | 'recommend';
  previewOnly?: boolean;
  recommendOnly?: boolean;
  compareTarget?: string;
};

type TransportConversationOption = {
  transportId: string;
  label: string;
  actionId: 'prepare';
};

type TransportConversationState = {
  options: TransportConversationOption[];
  recommendedOption?: TransportConversationOption;
  secondaryOption?: TransportConversationOption;
  compareTarget?: string;
  updatedAt: number;
};

export type SharedSurfaceNaturalTransportCommandPackDeps = {
  integrationCommandPack: Pick<SharedSurfaceIntegrationCommandPack, 'executeTransportAction'>;
  remoteTransportService: Pick<ZavorthRemoteTransportService, 'buildSnapshot'>;
};

export class SharedSurfaceNaturalTransportCommandPack {
  private readonly transportConversationState = new Map<string, TransportConversationState>();

  public constructor(private readonly deps: SharedSurfaceNaturalTransportCommandPackDeps) {}

  public async maybeHandle(ctx: IMessageContext, rawText: string): Promise<boolean> {
    const normalizedRawText = String(rawText || '').trim();
    if (!normalizedRawText || normalizedRawText.startsWith('/')) {
      return false;
    }

    const intent = this.parseContextualTransportIntent(ctx, normalizedRawText) || this.parseNaturalTransportIntent(normalizedRawText);
    if (!intent) {
      return false;
    }

    await this.handleNaturalTransportIntent(ctx, intent);
    return true;
  }

  private parseNaturalTransportIntent(rawText: string): NaturalTransportIntent | null {
    const original = String(rawText || '').trim();
    const normalized = this.normalizeNaturalText(rawText);
    if (!normalized || normalized.startsWith('/')) {
      return null;
    }

    const mentionsTransportPlane =
      /\b(transporte|transport|bridge|sidecar|gateway|roteamento remoto|plano remoto|node host)\b/.test(normalized)
      || /\b(aigateway)\b/.test(normalized);
    if (!mentionsTransportPlane) {
      return null;
    }

    const wantsPreview =
      /\b(mostre|mostrar|mostra|ver|veja|quero ver)\b/.test(normalized) &&
      /\b(opcoes|opcao|alternativas)\b/.test(normalized) &&
      /\b(antes de subir|antes de preparar|antes de decidir|antes de ligar|antes de ativar)\b/.test(normalized);
    const compareTarget = this.extractNaturalTransportCompareTarget(original);
    const wantsRecommendation =
      /\b(qual|quais)\b/.test(normalized) &&
      /\b(transporte|transport|bridge|sidecar|gateway|node host)\b/.test(normalized) &&
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
      /\b(repair|reparo|reparar|repare|corrigir|corrija|consertar|conserte|arrumar|arrume)\b/.test(normalized)
        ? 'repair'
        : /\b(smoke|teste|testar|validar|verificar)\b/.test(normalized)
          ? 'smoke'
          : /\b(preparar|prepare|subir|ligar|ativar|ative|habilitar|habilite|bootstrap)\b/.test(normalized)
            ? 'prepare'
            : /\b(inspecionar|inspecao|status|estado|mostrar|mostre|ver)\b/.test(normalized)
              ? 'inspect'
              : null;
    if (!actionId) {
      return null;
    }

    const transportId = this.resolveNaturalTransportId(normalized);
    if (!transportId) {
      return null;
    }

    return {
      transportId,
      actionId,
      reason: actionId,
    };
  }


  private parseContextualTransportIntent(
    ctx: Pick<IMessageContext, 'platform' | 'chatId' | 'userId'>,
    rawText: string,
  ): NaturalTransportIntent | null {
    const normalized = this.normalizeNaturalText(rawText);
    if (!normalized || normalized.startsWith('/')) {
      return null;
    }

    const state = this.readTransportConversation(ctx);
    if (!state) {
      return null;
    }

    if (/\b(vai com o recomendado|segue o recomendado|pode ir no recomendado|abre o recomendado)\b/.test(normalized)) {
      if (!state.recommendedOption) {
        return null;
      }
      return {
        transportId: state.recommendedOption.transportId,
        actionId: 'prepare',
        reason: 'prepare',
      };
    }

    if (/\b(faz os dois|abre os dois|quero os dois|pode fazer os dois)\b/.test(normalized)) {
      const primary = state.recommendedOption || state.options[0];
      const secondary = state.secondaryOption || state.options[1];
      const transportIds = [primary?.transportId, secondary?.transportId].filter(
        (entry, index, list): entry is string => Boolean(entry) && list.indexOf(entry) === index,
      );
      if (transportIds.length === 0) {
        return null;
      }
      return {
        transportIds,
        actionId: 'prepare',
        reason: 'prepare',
      };
    }

    const ordinal = this.extractImplicitTaskVariationPreviewSelection(normalized);
    if (ordinal) {
      const option = state.options[ordinal - 1];
      if (!option) {
        return null;
      }
      return {
        transportId: option.transportId,
        actionId: 'prepare',
        reason: 'prepare',
      };
    }

    const transportId = this.resolveNaturalTransportId(normalized);
    if (transportId && /\b(na verdade|melhor|prefiro|vai de|vamos de|quero)\b/.test(normalized)) {
      return {
        transportId,
        actionId: 'prepare',
        reason: 'prepare',
      };
    }

    return null;
  }


  private async handleNaturalTransportIntent(
    ctx: IMessageContext,
    intent: NaturalTransportIntent,
  ): Promise<void> {
    try {
      if (intent.previewOnly) {
        this.rememberTransportConversation(ctx, intent.compareTarget);
        await ctx.reply(this.buildNaturalTransportPreviewReply(intent.compareTarget));
        return;
      }

      if (intent.recommendOnly) {
        this.rememberTransportConversation(ctx, intent.compareTarget);
        await ctx.reply(this.buildNaturalTransportRecommendationReply(intent.compareTarget));
        return;
      }

      if (intent.transportIds && intent.transportIds.length > 0 && intent.actionId === 'prepare') {
        await this.handleNaturalTransportBatchPrepare(ctx, intent.transportIds);
        return;
      }

      if (!intent.transportId || !intent.actionId) {
        await ctx.reply('Nao consegui determinar o transporte ou a acao desejada nesse fluxo guiado.');
        return;
      }

      const result = await this.deps.integrationCommandPack.executeTransportAction({
        transportId: intent.transportId,
        actionId: intent.actionId,
        requestedBy: String(ctx.userId || '').trim() || null,
      });
      await ctx.reply([
        this.buildNaturalTransportIntro(intent),
        '',
        result.summary,
        '',
        ...result.details.map((detail) => `- ${detail}`),
        '',
        `Comandos uteis agora: /transports ${intent.transportId} | /transports prepare ${intent.transportId} | /transports repair ${intent.transportId}.`,
      ].join('\n'));
    } catch (error: any) {
      await ctx.reply(error?.message || 'Nao consegui abrir o fluxo guiado desse transporte agora.');
    }
  }


  private buildNaturalTransportPreviewReply(compareTarget?: string): string {
    const options = this.getNaturalTransportPreviewOptions(compareTarget);
    return [
      'Ainda nao subi nenhum transporte novo. Aqui estao as opcoes mais naturais agora:',
      '',
      'Opcoes:',
      ...options.map((entry, index) => `${index + 1}. ${entry.label}`),
      '',
      'Se quiser, me diga uma opcao, um transporte especifico ou "vai com o recomendado".',
    ].join('\n');
  }


  private buildNaturalTransportRecommendationReply(compareTarget?: string): string {
    const options = this.getNaturalTransportPreviewOptions(compareTarget);
    const target = String(compareTarget || '').trim();
    const normalizedTarget = this.normalizeNaturalText(target);
    let rationale =
      'esse transporte parece o melhor ponto de entrada para ampliar o alcance operacional sem sobrecarregar a configuracao agora.';

    if (/(llm|modelo|modelos|roteador|router|provider|providers|api)/.test(normalizedTarget)) {
      rationale =
        'para conectar providers, roteamento e compatibilidade de gateway, faz mais sentido priorizar o transporte ligado ao AIGateway.';
    } else if (/(remoto|worker|fila|headless|servidor|server|host|node)/.test(normalizedTarget)) {
      rationale =
        'para operacao remota de verdade, fila e heartbeat supervisionado, o node host tende a encaixar melhor agora.';
    } else if (/(discord|comunidade|guild|chat)/.test(normalizedTarget)) {
      rationale =
        'para bridge de chat e troca operacional em comunidade, o transporte do Discord costuma ser o passo mais direto.';
    } else if (/(terminal|shell|pty|console)/.test(normalizedTarget)) {
      rationale =
        'para terminal remoto e fluxo assistido por PTY, vale priorizar o sidecar focado em terminal.';
    }

    return [
      'Minha recomendacao de transporte agora:',
      '',
      `Melhor opcao: ${options[0]?.label || 'n/d'}`,
      `Motivo: ${rationale}`,
      '',
      'Se quiser, posso preparar esse transporte agora ou mostrar as outras opcoes.',
    ].join('\n');
  }


  private getNaturalTransportPreviewOptions(compareTarget?: string): TransportConversationOption[] {
    const snapshot = this.deps.remoteTransportService.buildSnapshot();
    const entries = (snapshot.entries || []).map((entry) => ({
      transportId: entry.id,
      label: entry.label || entry.id,
      haystack: this.normalizeNaturalText([
        entry.id,
        entry.label,
        entry.transport,
        entry.kind,
        entry.direction,
        entry.operatorSummary,
        ...(entry.details || []),
      ].join(' ')),
    }));
    const normalizedTarget = this.normalizeNaturalText(compareTarget || '');
    const scored = entries
      .map((entry) => {
        let score = 0;
        if (/(llm|modelo|modelos|roteador|router|provider|providers|api)/.test(normalizedTarget)) {
          if (/(aigateway|gateway proprio|provider|router|sidecar)/.test(entry.haystack)) {
            score += 6;
          }
        }
        if (/(remoto|worker|fila|headless|servidor|server|host|node)/.test(normalizedTarget)) {
          if (/(node host|node-host|heartbeat|headless|worker)/.test(entry.haystack)) {
            score += 6;
          }
        }
        if (/(discord|comunidade|guild|chat)/.test(normalizedTarget)) {
          if (/(discord)/.test(entry.haystack)) {
            score += 6;
          }
        }
        if (/(terminal|shell|pty|console)/.test(normalizedTarget)) {
          if (/(terminal|pty|shell)/.test(entry.haystack)) {
            score += 6;
          }
        }
        if (score === 0 && /(aigateway)/.test(entry.haystack)) {
          score += 2;
        }
        return {
          transportId: entry.transportId,
          label: entry.label,
          actionId: 'prepare' as const,
          score,
        };
      })
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));

    return scored.slice(0, 6).map((entry) => ({
      transportId: entry.transportId,
      label: entry.label,
      actionId: 'prepare',
    }));
  }


  private rememberTransportConversation(
    ctx: Pick<IMessageContext, 'platform' | 'chatId' | 'userId'>,
    compareTarget?: string,
  ): void {
    const options = this.getNaturalTransportPreviewOptions(compareTarget);
    this.transportConversationState.set(this.buildTransportConversationKey(ctx), {
      options,
      recommendedOption: options[0],
      secondaryOption: options[1],
      compareTarget: String(compareTarget || '').trim() || undefined,
      updatedAt: Date.now(),
    });
  }


  private readTransportConversation(
    ctx: Pick<IMessageContext, 'platform' | 'chatId' | 'userId'>,
  ): TransportConversationState | null {
    const key = this.buildTransportConversationKey(ctx);
    const entry = this.transportConversationState.get(key);
    if (!entry) {
      return null;
    }
    if (Date.now() - entry.updatedAt > 15 * 60 * 1000) {
      this.transportConversationState.delete(key);
      return null;
    }
    return entry;
  }


  private buildTransportConversationKey(
    ctx: Pick<IMessageContext, 'platform' | 'chatId' | 'userId'>,
  ): string {
    return [
      String(ctx.platform || '').trim(),
      String(ctx.chatId || '').trim(),
      String(ctx.userId || '').trim(),
      'transports',
    ].join('::');
  }


  private extractNaturalTransportCompareTarget(rawText: string): string | undefined {
    const match = String(rawText || '').match(/\b(?:para|pro|pra)\s+(.+)$/i);
    return match?.[1] ? String(match[1]).trim() : undefined;
  }


  private async handleNaturalTransportBatchPrepare(
    ctx: IMessageContext,
    transportIds: string[],
  ): Promise<void> {
    const seen = new Set<string>();
    const uniqueIds = transportIds
      .map((entry) => String(entry || '').trim())
      .filter((entry) => {
        const normalized = entry.toLowerCase();
        if (!entry || seen.has(normalized)) {
          return false;
        }
        seen.add(normalized);
        return true;
      });
    if (uniqueIds.length === 0) {
      await ctx.reply('Nao encontrei transportes suficientes para preparar nesse passo.');
      return;
    }

    if (uniqueIds.length === 1) {
      await this.handleNaturalTransportIntent(ctx, {
        transportId: uniqueIds[0],
        actionId: 'prepare',
        reason: 'prepare',
      });
      return;
    }

    const lines = [
      'Preparei mais de um transporte com base na conversa recente.',
      '',
    ];
    for (const transportId of uniqueIds) {
      const result = await this.deps.integrationCommandPack.executeTransportAction({
        transportId,
        actionId: 'prepare',
        requestedBy: String(ctx.userId || '').trim() || null,
      });
      lines.push(`${this.formatNaturalTransportLabel(transportId)}: ${result.summary}`);
    }
    lines.push('', 'Se quiser, agora eu posso aprofundar um deles com smoke, repair ou historico.');
    await ctx.reply(lines.join('\n'));
  }


  private buildNaturalTransportIntro(intent: NaturalTransportIntent): string {
    const label = this.formatNaturalTransportLabel(String(intent.transportId || '').trim());
    switch (intent.reason) {
      case 'preview':
        return 'Entendi que voce quer ver as opcoes de transporte antes de decidir.';
      case 'recommend':
        return 'Entendi que voce quer uma recomendacao de transporte antes de agir.';
      case 'prepare':
        return `Entendi que voce quer preparar o transporte ${label}.`;
      case 'smoke':
        return `Entendi que voce quer validar o transporte ${label}.`;
      case 'repair':
        return `Entendi que voce quer reparar o transporte ${label}.`;
      case 'inspect':
      default:
        return `Entendi que voce quer inspecionar o transporte ${label}.`;
    }
  }


  private formatNaturalTransportLabel(transportId: string): string {
    const snapshot = this.deps.remoteTransportService.buildSnapshot({ selectedId: transportId });
    if (snapshot.selected?.label) {
      return snapshot.selected.label;
    }

    switch (String(transportId || '').trim().toLowerCase()) {
      case 'aigateway':
        return 'AIGateway';
      case 'discord-transport':
        return 'Discord transport';
      case 'node-host':
        return 'Node host transport';
      case 'zavorthterminal':
        return 'Zavorth Terminal';
      default:
        return transportId;
    }
  }


  private resolveNaturalTransportId(normalized: string): string | null {
    const snapshot = this.deps.remoteTransportService.buildSnapshot();
    const manualAliases: Record<string, string[]> = {
      AIGateway: ['aigateway', 'ai gateway', 'gateway proprio'],
      'discord-transport': ['discord transport', 'transporte do discord', 'bridge do discord'],
      'node-host': ['node host', 'host remoto', 'host do node'],
    };
    return this.resolveNaturalEntryId(
      normalized,
      snapshot.entries.map((entry) => ({
        id: entry.id,
        phrases: [entry.id, entry.label, entry.transport, ...(manualAliases[entry.id] || [])],
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
