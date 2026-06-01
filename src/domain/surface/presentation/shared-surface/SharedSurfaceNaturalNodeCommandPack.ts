import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type { ZavorthNodeMeshService } from '../../../../services/ZavorthNodeMeshService.js';
import type { NodeDeviceProfileService } from '../../../../services/NodeDeviceProfileService.js';
import type { NodePairingService } from '../../../../services/NodePairingService.js';
import type { SharedSurfaceSessionNodeCommandPack } from './SharedSurfaceSessionNodeCommandPack.js';

type NaturalNodeIntent = {
  kind: 'pair' | 'nodes';
  args: string;
  intro: string;
  label?: string;
  profileId?: string;
  profileIds?: string[];
  previewOnly?: boolean;
  recommendOnly?: boolean;
  compareTarget?: string;
};

type NodeConversationOption = {
  profileId: string;
  label: string;
  actionId: 'pair';
};

type NodeConversationState = {
  options: NodeConversationOption[];
  recommendedOption?: NodeConversationOption;
  secondaryOption?: NodeConversationOption;
  compareTarget?: string;
  updatedAt: number;
};

export type SharedSurfaceNaturalNodeCommandPackDeps = {
  sessionNodeCommandPack: Pick<SharedSurfaceSessionNodeCommandPack, 'maybeHandle'>;
  nodeMeshService: Pick<ZavorthNodeMeshService, 'buildSnapshot'>;
  nodeDeviceProfiles: Pick<
    NodeDeviceProfileService,
    'normalizeProfileId' | 'listProfiles' | 'listRecommendedProfiles' | 'describeProfile' | 'resolveProfile'
  >;
  nodePairingService: Pick<NodePairingService, 'createPairingDraft'>;
};

export class SharedSurfaceNaturalNodeCommandPack {
  private readonly nodeConversationState = new Map<string, NodeConversationState>();

  public constructor(private readonly deps: SharedSurfaceNaturalNodeCommandPackDeps) {}

  public async maybeHandle(ctx: IMessageContext, rawText: string): Promise<boolean> {
    const normalizedRawText = String(rawText || '').trim();
    if (!normalizedRawText || normalizedRawText.startsWith('/')) {
      return false;
    }

    const intent = this.parseContextualNodeIntent(ctx, normalizedRawText) || this.parseNaturalNodeIntent(normalizedRawText);
    if (!intent) {
      return false;
    }

    await this.handleNaturalNodeIntent(ctx, intent);
    return true;
  }

  private parseNaturalNodeIntent(rawText: string): NaturalNodeIntent | null {
    const original = String(rawText || '').trim();
    const normalized = this.normalizeNaturalText(rawText);
    if (!normalized || normalized.startsWith('/')) {
      return null;
    }

    const mentionsNodePlane =
      /\b(node|nodes|companion|host remoto|node host|pairing|parear|pareamento)\b/.test(normalized);
    if (!mentionsNodePlane) {
      return null;
    }

    const wantsPreview =
      /\b(mostre|mostrar|mostra|ver|veja|quero ver)\b/.test(normalized) &&
      /\b(opcoes|opcao|alternativas)\b/.test(normalized) &&
      /\b(antes de parear|antes de conectar|antes de decidir|antes de criar)\b/.test(normalized);
    const compareTarget = this.extractNaturalNodeCompareTarget(original);
    const wantsRecommendation =
      /\b(qual|quais)\b/.test(normalized) &&
      /\b(node|nodes|perfil|perfis|companion|worker|host)\b/.test(normalized) &&
      /\b(melhor|melhores|recomendado|recomenda)\b/.test(normalized);

    if (wantsPreview) {
      return {
        kind: 'pair',
        args: '',
        intro: 'Entendi que voce quer ver as opcoes de node antes de decidir.',
        previewOnly: true,
        compareTarget,
      };
    }

    if (wantsRecommendation) {
      return {
        kind: 'pair',
        args: '',
        intro: 'Entendi que voce quer uma recomendacao de node antes de parear.',
        recommendOnly: true,
        compareTarget,
      };
    }

    if (/\b(perfis|perfil|profiles|profile)\b/.test(normalized)) {
      return {
        kind: 'nodes',
        args: 'profiles',
        intro: 'Entendi que voce quer ver os perfis do Node Mesh.',
      };
    }

    if (/\b(capabilities|capability|capabilidades|capacidades)\b/.test(normalized)) {
      return {
        kind: 'nodes',
        args: 'capabilities',
        intro: 'Entendi que voce quer ver as capabilities do Node Mesh.',
      };
    }

    if (/\b(conectar|conecta|parear|pareie|pareamento|pairing|adicionar|adicione|criar|crie)\b/.test(normalized)) {
      const profileId = this.extractNaturalNodeProfileId(normalized);
      return {
        kind: 'pair',
        args: profileId,
        profileId: this.normalizeNaturalNodeProfileId(profileId),
        label: this.formatNaturalNodeProfileLabel(profileId),
        intro: `Entendi que voce quer preparar um ${this.formatNaturalNodeProfileLabel(profileId)} no Node Mesh.`,
      };
    }

    const nodeId = this.resolveNaturalNodeId(normalized);
    if (/\b(fila|queue|pendencias|pendente)\b/.test(normalized) && nodeId) {
      return {
        kind: 'nodes',
        args: `queue ${nodeId}`,
        intro: `Entendi que voce quer ver a fila do node ${nodeId}.`,
      };
    }

    if (/\b(historico|history|recentes|recent)\b/.test(normalized) && nodeId) {
      return {
        kind: 'nodes',
        args: `history ${nodeId}`,
        intro: `Entendi que voce quer ver o historico do node ${nodeId}.`,
      };
    }

    if (/\b(status|estado|mostrar|mostre|ver|inspecionar|inspecao)\b/.test(normalized)) {
      return {
        kind: 'nodes',
        args: nodeId || '',
        intro: nodeId
          ? `Entendi que voce quer inspecionar o node ${nodeId}.`
          : 'Entendi que voce quer ver o Node Mesh.',
      };
    }

    return null;
  }


  private parseContextualNodeIntent(
    ctx: Pick<IMessageContext, 'platform' | 'chatId' | 'userId'>,
    rawText: string,
  ): NaturalNodeIntent | null {
    const normalized = this.normalizeNaturalText(rawText);
    if (!normalized || normalized.startsWith('/')) {
      return null;
    }

    const state = this.readNodeConversation(ctx);
    if (!state) {
      return null;
    }

    if (/\b(vai com o recomendado|segue o recomendado|pode ir no recomendado|abre o recomendado)\b/.test(normalized)) {
      if (!state.recommendedOption) {
        return null;
      }
      return {
        kind: 'pair',
        args: state.recommendedOption.profileId,
        profileId: state.recommendedOption.profileId,
        label: state.recommendedOption.label,
        intro: `Entendi que voce quer preparar um ${state.recommendedOption.label} no Node Mesh.`,
      };
    }

    if (/\b(faz os dois|abre os dois|quero os dois|pode fazer os dois)\b/.test(normalized)) {
      const primary = state.recommendedOption || state.options[0];
      const secondary = state.secondaryOption || state.options[1];
      const profileIds = [primary?.profileId, secondary?.profileId].filter(
        (entry, index, list): entry is string => Boolean(entry) && list.indexOf(entry) === index,
      );
      if (profileIds.length === 0) {
        return null;
      }
      return {
        kind: 'pair',
        args: '',
        intro: 'Entendi que voce quer preparar mais de um perfil do Node Mesh.',
        profileIds,
      };
    }

    const ordinal = this.extractImplicitTaskVariationPreviewSelection(normalized);
    if (ordinal) {
      const option = state.options[ordinal - 1];
      if (!option) {
        return null;
      }
      return {
        kind: 'pair',
        args: option.profileId,
        profileId: option.profileId,
        label: option.label,
        intro: `Entendi que voce quer preparar um ${option.label} no Node Mesh.`,
      };
    }

    const profileId = this.resolveNaturalNodeProfileConversationId(normalized);
    if (profileId && /\b(na verdade|melhor|prefiro|vai de|vamos de|quero)\b/.test(normalized)) {
      const profile = this.deps.nodeDeviceProfiles.describeProfile(profileId);
      return {
        kind: 'pair',
        args: profileId,
        profileId,
        label: profile?.label || this.formatNaturalNodeProfileLabel(profileId),
        intro: `Entendi que voce quer preparar um ${profile?.label || this.formatNaturalNodeProfileLabel(profileId)} no Node Mesh.`,
      };
    }

    return null;
  }


  private async handleNaturalNodeIntent(
    ctx: IMessageContext,
    intent: NaturalNodeIntent,
  ): Promise<void> {
    if (intent.previewOnly) {
      this.rememberNodeConversation(ctx, intent.compareTarget);
      await ctx.reply(this.buildNaturalNodePreviewReply(intent.compareTarget));
      return;
    }

    if (intent.recommendOnly) {
      this.rememberNodeConversation(ctx, intent.compareTarget);
      await ctx.reply(this.buildNaturalNodeRecommendationReply(intent.compareTarget));
      return;
    }

    if (intent.profileIds && intent.profileIds.length > 0) {
      await this.handleNaturalNodeBatchPair(ctx, intent.profileIds);
      return;
    }

    if (intent.kind === 'pair') {
      await ctx.reply(intent.intro);
      await this.deps.sessionNodeCommandPack.maybeHandle(ctx, '/nodepair', intent.args);
      return;
    }

    await ctx.reply(intent.intro);
    await this.deps.sessionNodeCommandPack.maybeHandle(ctx, '/nodes', intent.args);
  }


  private resolveNaturalNodeId(normalized: string): string | null {
    const snapshot = this.deps.nodeMeshService.buildSnapshot();
    return this.resolveNaturalEntryId(
      normalized,
      snapshot.entries.map((entry) => ({
        id: entry.id,
        phrases: [entry.id, entry.label, entry.profileId, entry.kind],
      })),
    );
  }


  private extractNaturalNodeProfileId(normalized: string): string {
    if (/\b(mobile|celular|telefone|phone)\b/.test(normalized)) {
      return 'mobile';
    }
    if (/\b(desktop|notebook|laptop|pc|computador)\b/.test(normalized)) {
      return 'desktop';
    }
    if (/\b(browser|navegador|web)\b/.test(normalized)) {
      return 'browser';
    }
    return 'headless';
  }


  private formatNaturalNodeProfileLabel(profileId: string): string {
    switch (String(profileId || '').trim().toLowerCase()) {
      case 'mobile-companion':
      case 'mobile':
        return 'Mobile Companion';
      case 'desktop-companion':
      case 'desktop':
        return 'Desktop Companion';
      case 'browser-companion':
      case 'browser':
        return 'Browser Companion';
      case 'headless-worker':
      default:
        return 'Headless Worker';
    }
  }


  private buildNaturalNodePreviewReply(compareTarget?: string): string {
    const options = this.getNaturalNodePreviewOptions(compareTarget);
    return [
      'Antes de parear um novo node, estas sao as opcoes mais naturais agora:',
      '',
      'Opcoes:',
      ...options.map((entry, index) => `${index + 1}. ${entry.label}`),
      '',
      'Se quiser, me diga uma opcao, um perfil especifico ou "vai com o recomendado".',
    ].join('\n');
  }


  private buildNaturalNodeRecommendationReply(compareTarget?: string): string {
    const options = this.getNaturalNodePreviewOptions(compareTarget);
    const target = String(compareTarget || '').trim();
    const normalizedTarget = this.normalizeNaturalText(target);
    let rationale =
      'esse perfil parece o melhor ponto de entrada para ganhar capacidade pratica sem abrir complexidade desnecessaria agora.';

    if (/(desktop|visual|tela|janela|notificacao|windows|mac|linux)/.test(normalizedTarget)) {
      rationale =
        'para contexto visual, notificacoes e operacao com tela por perto, o Desktop Companion tende a ser o melhor encaixe.';
    } else if (/(browser|navegador|web|site|automacao web)/.test(normalizedTarget)) {
      rationale =
        'para navegador assistido e automacao web, faz mais sentido priorizar o Browser Companion.';
    } else if (/(mobile|celular|camera|localizacao|android|ios)/.test(normalizedTarget)) {
      rationale =
        'para sinais de camera, localizacao e contexto movel, o Mobile Companion encaixa melhor.';
    } else if (/(servidor|server|remoto|fila|headless|worker|wsl|background)/.test(normalizedTarget)) {
      rationale =
        'para fila remota, execucao segura e trabalho em host sem UI, o Headless Worker continua sendo o perfil mais forte.';
    }

    return [
      'Minha recomendacao de node agora:',
      '',
      `Melhor opcao: ${options[0]?.label || 'n/d'}`,
      `Motivo: ${rationale}`,
      '',
      'Se quiser, posso abrir o pairing desse perfil agora ou mostrar as outras opcoes.',
    ].join('\n');
  }


  private getNaturalNodePreviewOptions(compareTarget?: string): NodeConversationOption[] {
    const profiles = this.deps.nodeDeviceProfiles.listRecommendedProfiles();
    const baseOrder: Record<string, number> = {
      'headless-worker': 4,
      'desktop-companion': 3,
      'browser-companion': 2,
      'mobile-companion': 1,
    };
    const normalizedTarget = this.normalizeNaturalText(compareTarget || '');
    const scored = profiles
      .map((profile) => {
        let score = baseOrder[profile.id] || 0;
        if (/(desktop|visual|tela|janela|notificacao|windows|mac|linux)/.test(normalizedTarget)) {
          if (profile.kind === 'desktop') {
            score += 10;
          }
        }
        if (/(browser|navegador|web|site|automacao web)/.test(normalizedTarget)) {
          if (profile.kind === 'browser') {
            score += 10;
          }
        }
        if (/(mobile|celular|camera|localizacao|android|ios)/.test(normalizedTarget)) {
          if (profile.kind === 'mobile') {
            score += 10;
          }
        }
        if (/(servidor|server|remoto|fila|headless|worker|wsl|background)/.test(normalizedTarget)) {
          if (profile.kind === 'headless') {
            score += 10;
          }
        }
        return {
          profileId: profile.id,
          label: profile.label,
          actionId: 'pair' as const,
          score,
        };
      })
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));

    return scored.map((entry) => ({
      profileId: entry.profileId,
      label: entry.label,
      actionId: 'pair',
    }));
  }


  private rememberNodeConversation(
    ctx: Pick<IMessageContext, 'platform' | 'chatId' | 'userId'>,
    compareTarget?: string,
  ): void {
    const options = this.getNaturalNodePreviewOptions(compareTarget);
    this.nodeConversationState.set(this.buildNodeConversationKey(ctx), {
      options,
      recommendedOption: options[0],
      secondaryOption: options[1],
      compareTarget: String(compareTarget || '').trim() || undefined,
      updatedAt: Date.now(),
    });
  }


  private readNodeConversation(
    ctx: Pick<IMessageContext, 'platform' | 'chatId' | 'userId'>,
  ): NodeConversationState | null {
    const key = this.buildNodeConversationKey(ctx);
    const entry = this.nodeConversationState.get(key);
    if (!entry) {
      return null;
    }
    if (Date.now() - entry.updatedAt > 15 * 60 * 1000) {
      this.nodeConversationState.delete(key);
      return null;
    }
    return entry;
  }


  private buildNodeConversationKey(
    ctx: Pick<IMessageContext, 'platform' | 'chatId' | 'userId'>,
  ): string {
    return [
      String(ctx.platform || '').trim(),
      String(ctx.chatId || '').trim(),
      String(ctx.userId || '').trim(),
      'nodes',
    ].join('::');
  }


  private extractNaturalNodeCompareTarget(rawText: string): string | undefined {
    const match = String(rawText || '').match(/\b(?:para|pro|pra)\s+(.+)$/i);
    return match?.[1] ? String(match[1]).trim() : undefined;
  }


  private normalizeNaturalNodeProfileId(profileId: string | null | undefined): string {
    return this.deps.nodeDeviceProfiles.normalizeProfileId(profileId) || 'headless-worker';
  }


  private resolveNaturalNodeProfileConversationId(normalized: string): string | null {
    let direct: string | null = null;
    if (/\b(mobile|celular|telefone|phone)\b/.test(normalized)) {
      direct = this.normalizeNaturalNodeProfileId('mobile');
    } else if (/\b(desktop|notebook|laptop|pc|computador)\b/.test(normalized)) {
      direct = this.normalizeNaturalNodeProfileId('desktop');
    } else if (/\b(browser|navegador|web)\b/.test(normalized)) {
      direct = this.normalizeNaturalNodeProfileId('browser');
    } else if (/\b(headless|worker|servidor|server)\b/.test(normalized)) {
      direct = this.normalizeNaturalNodeProfileId('headless');
    }
    const profiles = this.deps.nodeDeviceProfiles.listProfiles();
    const exact = profiles.find((profile) => {
      const label = this.normalizeNaturalText(profile.label);
      return normalized.includes(profile.id) || normalized.includes(label);
    });
    return exact?.id || direct || null;
  }


  private async handleNaturalNodeBatchPair(
    ctx: IMessageContext,
    profileIds: string[],
  ): Promise<void> {
    const uniqueIds = Array.from(new Set(profileIds.map((entry) => this.normalizeNaturalNodeProfileId(entry)).filter(Boolean)));
    if (uniqueIds.length === 0) {
      await ctx.reply('Nao encontrei perfis suficientes para preparar nesse passo.');
      return;
    }

    if (uniqueIds.length === 1) {
      const profile = this.deps.nodeDeviceProfiles.describeProfile(uniqueIds[0]);
      await this.handleNaturalNodeIntent(ctx, {
        kind: 'pair',
        args: uniqueIds[0],
        profileId: uniqueIds[0],
        label: profile?.label || this.formatNaturalNodeProfileLabel(uniqueIds[0]),
        intro: `Entendi que voce quer preparar um ${profile?.label || this.formatNaturalNodeProfileLabel(uniqueIds[0])} no Node Mesh.`,
      });
      return;
    }

    const lines = [
      'Preparei mais de um perfil de node com base na conversa recente.',
      '',
    ];
    for (const profileId of uniqueIds) {
      const profile = this.deps.nodeDeviceProfiles.resolveProfile(profileId, null);
      const draft = this.deps.nodePairingService.createPairingDraft({
        profileId: profile.id,
        label: profile.label,
        requestedBy: String(ctx.userId || '').trim() || null,
        hostHints: {
          workspace: process.cwd(),
        },
      });
      lines.push(`${profile.label}: pairing code ${draft.pairingCode} | node ${draft.entry.id}.`);
    }
    lines.push('', 'Se quiser, agora eu posso aprofundar um deles com os detalhes completos de pairing ou mostrar os perfis do mesh.');
    await ctx.reply(lines.join('\n'));
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
