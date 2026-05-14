import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';

export type NaturalChannelIntent = {
  channelId?: string;
  channelIds?: string[];
  actionId?: 'inspect' | 'status' | 'policy' | 'prepare' | 'doctor' | 'repair' | 'apply-scaffold' | 'send-test' | 'login-qr' | 'relink' | 'logout';
  reason: 'connect' | 'inspect' | 'status' | 'policy' | 'doctor' | 'repair' | 'apply-scaffold' | 'preview' | 'recommend' | 'test' | 'login-qr' | 'relink' | 'logout';
  previewOnly?: boolean;
  recommendOnly?: boolean;
  compareTarget?: string;
};

type ChannelConversationOption = {
  channelId: string;
  label: string;
  actionId: 'prepare';
};

type ChannelConversationState = {
  options: ChannelConversationOption[];
  recommendedOption?: ChannelConversationOption;
  secondaryOption?: ChannelConversationOption;
  lastChannelId?: string;
  compareTarget?: string;
  updatedAt: number;
};

export class SharedSurfaceNaturalChannelConversation {
  private readonly channelConversationState = new Map<string, ChannelConversationState>();

  public parseNaturalIntent(rawText: string): NaturalChannelIntent | null {
    const normalized = normalizeNaturalChannelText(rawText);
    if (!normalized || normalized.startsWith('/')) {
      return null;
    }

    const mentionsSessionPlane =
      /\b(sessao|sessoes|session|sessions|replay|historico|history|handoff)\b/.test(normalized);
    const mentionsChannelPlaneWords =
      /\b(canal|channel|grupo|chat|guild|servidor|bot)\b/.test(normalized);
    if (mentionsSessionPlane && !mentionsChannelPlaneWords) {
      return null;
    }

    const wantsPreview =
      /\b(mostre|mostrar|mostra|ver|veja|quero ver)\b/.test(normalized) &&
      /\b(canal|canais|channel|channel mesh)\b/.test(normalized) &&
      /\b(opcoes|opcao|alternativas|canais|channel mesh)\b/.test(normalized) &&
      /\b(antes de conectar|antes de abrir|antes de decidir|antes de colocar)\b/.test(normalized);
    const compareTarget = extractNaturalChannelCompareTarget(rawText);
    const wantsRecommendation =
      /\b(qual|quais)\b/.test(normalized) &&
      /\b(canal|channel)\b/.test(normalized) &&
      /\b(melhor|melhores|recomendado|recomenda)\b/.test(normalized);

    const channelId = extractNaturalChannelId(normalized);
    if (!channelId && !wantsPreview && !wantsRecommendation) {
      return null;
    }

    if (!channelId && wantsPreview) {
      return {
        reason: 'preview',
        previewOnly: true,
      };
    }

    if (!channelId && wantsRecommendation) {
      return {
        reason: 'recommend',
        recommendOnly: true,
        compareTarget,
      };
    }

    const wantsConnect = /\b(conectar|conecta|colocar|coloque|adicionar|adicione|instalar|instale|ativar|ative|configurar|configure|setup|onboard|usar|use|habilitar|habilite|enable|ligar|subir|levar|entrar|entre|acessar|acesse)\b/.test(normalized);
    const wantsPolicy = /\b(policy|politica|politicas|permissoes|allowlist|blocklist|grupo|group policy)\b/.test(normalized);
    const wantsDoctor = /\b(doctor|diagnostico|diagnosticar|saude|health|check|checar|verificar|validar)\b/.test(normalized);
    const wantsSendTest = /\b(send-test|broadcast-test|teste de envio|mensagem de teste|mande um teste|envie um teste|teste o canal)\b/.test(normalized);
    const wantsLoginQr = /\b(qr|qrcode|login qr|parear|pareamento|escane(ar|ie)|scan)\b/.test(normalized);
    const wantsRelink = /\b(relink|reparear|parear de novo|novo pareamento|nova sessao)\b/.test(normalized);
    const wantsLogout = /\b(logout|deslogar|sair da conta|encerrar sessao|remover sessao)\b/.test(normalized);
    const wantsRepair = /\b(repair|reparo|reparar|repare|corrigir|corrige|consertar|conserte|arrumar|arrume)\b/.test(normalized);
    const wantsInspect = /\b(status|estado|inspecionar|inspecao|detalhes|mostrar|mostre|ver)\b/.test(normalized);
    const wantsApplyScaffold =
      /\b(aplicar|aplique|aplica|escrever|escreva|grave|gravar|gerar|gere|criar|crie|preparar|prepare)\b/.test(normalized)
      && /\b(scaffold|env|\.env|variaveis|variaveis de ambiente|configuracao segura|configuracao inicial)\b/.test(normalized);

    if (wantsApplyScaffold) {
      return { channelId: channelId || undefined, actionId: 'apply-scaffold', reason: 'apply-scaffold' };
    }
    if (wantsRepair) {
      return { channelId: channelId || undefined, actionId: 'repair', reason: 'repair' };
    }
    if (wantsDoctor) {
      return { channelId: channelId || undefined, actionId: 'doctor', reason: 'doctor' };
    }
    if (wantsLogout) {
      return { channelId: channelId || undefined, actionId: 'logout', reason: 'logout' };
    }
    if (wantsRelink) {
      return { channelId: channelId || undefined, actionId: 'relink', reason: 'relink' };
    }
    if (wantsLoginQr) {
      return { channelId: channelId || undefined, actionId: 'login-qr', reason: 'login-qr' };
    }
    if (wantsSendTest) {
      return { channelId: channelId || undefined, actionId: 'send-test', reason: 'test' };
    }
    if (wantsPolicy) {
      return { channelId: channelId || undefined, actionId: 'policy', reason: 'policy' };
    }
    if (wantsConnect) {
      return { channelId: channelId || undefined, actionId: 'prepare', reason: 'connect' };
    }
    if (wantsInspect) {
      return { channelId: channelId || undefined, actionId: 'status', reason: 'status' };
    }
    return null;
  }

  public parseContextualIntent(
    ctx: Pick<IMessageContext, 'platform' | 'chatId' | 'userId'>,
    rawText: string,
  ): NaturalChannelIntent | null {
    const normalized = normalizeNaturalChannelText(rawText);
    if (!normalized || normalized.startsWith('/')) {
      return null;
    }

    const state = this.read(ctx);
    if (!state) {
      return null;
    }

    const wantsApplyScaffold =
      /\b(aplicar|aplique|aplica|escrever|escreva|grave|gravar|gerar|gere|criar|crie|preparar|prepare)\b/.test(normalized)
      && /\b(scaffold|env|\.env|variaveis|variaveis de ambiente|configuracao segura|configuracao inicial)\b/.test(normalized);
    if (wantsApplyScaffold) {
      const target = extractNaturalChannelId(normalized)
        || state.lastChannelId
        || state.recommendedOption?.channelId
        || null;
      if (!target) {
        return null;
      }
      return {
        channelId: target,
        actionId: 'apply-scaffold',
        reason: 'apply-scaffold',
      };
    }

    const contextualTarget =
      extractNaturalChannelId(normalized)
      || state.lastChannelId
      || state.recommendedOption?.channelId
      || null;
    if (contextualTarget && looksLikeChannelSetupConfigFollowup(normalized)) {
      return {
        channelId: contextualTarget,
        actionId: 'prepare',
        reason: 'connect',
      };
    }
    if (contextualTarget && /\b(doctor|diagnostico|validar|valide|health|check)\b/.test(normalized)) {
      return {
        channelId: contextualTarget,
        actionId: 'doctor',
        reason: 'doctor',
      };
    }
    if (contextualTarget && /\b(logout|deslogar|sair da conta|encerrar sessao|remover sessao)\b/.test(normalized)) {
      return {
        channelId: contextualTarget,
        actionId: 'logout',
        reason: 'logout',
      };
    }
    if (contextualTarget && /\b(relink|reparear|parear de novo|novo pareamento|nova sessao)\b/.test(normalized)) {
      return {
        channelId: contextualTarget,
        actionId: 'relink',
        reason: 'relink',
      };
    }
    if (contextualTarget && /\b(qr|qrcode|login qr|parear|pareamento|escane(ar|ie)|scan)\b/.test(normalized)) {
      return {
        channelId: contextualTarget,
        actionId: 'login-qr',
        reason: 'login-qr',
      };
    }
    if (contextualTarget && /\b(send-test|broadcast-test|teste de envio|mensagem de teste|mande um teste|envie um teste|teste o canal)\b/.test(normalized)) {
      return {
        channelId: contextualTarget,
        actionId: 'send-test',
        reason: 'test',
      };
    }

    if (/\b(vai com o recomendado|segue o recomendado|pode ir no recomendado|abre o recomendado)\b/.test(normalized)) {
      if (!state.recommendedOption) {
        return null;
      }
      return {
        channelId: state.recommendedOption.channelId,
        actionId: 'prepare',
        reason: 'connect',
      };
    }

    if (/\b(faz os dois|abre os dois|quero os dois|pode fazer os dois)\b/.test(normalized)) {
      const primary = state.recommendedOption || state.options[0];
      const secondary = state.secondaryOption || state.options[1];
      const channelIds = [primary?.channelId, secondary?.channelId].filter(
        (entry, index, list): entry is string => Boolean(entry) && list.indexOf(entry) === index,
      );
      if (channelIds.length === 0) {
        return null;
      }
      return {
        channelIds,
        actionId: 'prepare',
        reason: 'connect',
      };
    }

    const ordinal = extractImplicitChannelPreviewSelection(normalized);
    if (ordinal) {
      const option = state.options[ordinal - 1];
      if (!option) {
        return null;
      }
      return {
        channelId: option.channelId,
        actionId: 'prepare',
        reason: 'connect',
      };
    }

    const channelId = extractNaturalChannelId(normalized);
    if (channelId && /\b(na verdade|melhor|prefiro|vai de|vamos de|quero)\b/.test(normalized)) {
      return {
        channelId,
        actionId: 'prepare',
        reason: 'connect',
      };
    }

    return null;
  }

  public remember(
    ctx: Pick<IMessageContext, 'platform' | 'chatId' | 'userId'>,
    compareTarget?: string,
    lastChannelId?: string,
  ): void {
    const normalizedLastChannelId = String(lastChannelId || '').trim().toLowerCase();
    const baseOptions = getNaturalChannelPreviewOptions(compareTarget);
    const options = normalizedLastChannelId
      ? [
          ...baseOptions.filter((entry) => entry.channelId === normalizedLastChannelId),
          ...baseOptions.filter((entry) => entry.channelId !== normalizedLastChannelId),
        ]
      : baseOptions;
    this.channelConversationState.set(this.buildKey(ctx), {
      options,
      recommendedOption: options[0],
      secondaryOption: options[1],
      lastChannelId: normalizedLastChannelId || undefined,
      compareTarget: String(compareTarget || '').trim() || undefined,
      updatedAt: Date.now(),
    });
  }

  private read(ctx: Pick<IMessageContext, 'platform' | 'chatId' | 'userId'>): ChannelConversationState | null {
    const key = this.buildKey(ctx);
    const entry = this.channelConversationState.get(key);
    if (!entry) {
      return null;
    }
    if (Date.now() - entry.updatedAt > 15 * 60 * 1000) {
      this.channelConversationState.delete(key);
      return null;
    }
    return entry;
  }

  private buildKey(ctx: Pick<IMessageContext, 'platform' | 'chatId' | 'userId'>): string {
    return [
      String(ctx.platform || '').trim(),
      String(ctx.chatId || '').trim(),
      String(ctx.userId || '').trim(),
      'channels',
    ].join('::');
  }
}

export function buildNaturalChannelPreviewReply(compareTarget?: string): string {
  const options = getNaturalChannelPreviewOptions(compareTarget);
  return [
    'Ainda nao preparei nenhum canal. Aqui estao as opcoes mais naturais para onboarding agora:',
    '',
    'Opcoes:',
    ...options.map((entry, index) => `${index + 1}. ${entry.label}`),
    '',
    'Se quiser, me diga uma opcao, um canal especifico ou "vai com o recomendado".',
  ].join('\n');
}

export function buildNaturalChannelRecommendationReply(compareTarget?: string): string {
  const options = getNaturalChannelPreviewOptions(compareTarget);
  const target = String(compareTarget || '').trim();
  const recommended = options[0];
  const normalizedTarget = normalizeNaturalChannelText(target);
  let rationale =
    'esse caminho costuma equilibrar onboarding simples, boa ergonomia operacional e continuidade com o Zavorth.';

  if (/(trabalho|empresa|equipe|time|corporativo|workspace)/.test(normalizedTarget)) {
    rationale =
      'para uso de trabalho, Slack normalmente oferece o melhor encaixe entre governanca, threads e rollout operacional.';
  } else if (/(comunidade|publico|servidor|guild|community)/.test(normalizedTarget)) {
    rationale =
      'para comunidade, Discord costuma ser o melhor ponto de entrada por causa de canais, threads e operacao em servidor.';
  } else if (/(cliente|clientes|comercial|vendas|brasil|telefone|celular)/.test(normalizedTarget)) {
    rationale =
      'para clientes e operacao mais orientada a celular, WhatsApp tende a ser o canal mais direto; Instagram fica logo ao lado quando o contato nasce em DM/social.';
  } else if (/(privado|seguro|seguranca|pessoal|confidencial)/.test(normalizedTarget)) {
    rationale =
      'para uso mais privado, Signal tende a priorizar melhor o contexto de seguranca e conversas mais restritas.';
  }

  return [
    'Minha recomendacao de canal agora:',
    '',
    `Melhor opcao: ${recommended?.label || 'n/d'}`,
    `Motivo: ${rationale}`,
    '',
    'Se quiser, posso preparar esse canal agora ou mostrar as outras opcoes.',
  ].join('\n');
}

function getNaturalChannelPreviewOptions(compareTarget?: string): ChannelConversationOption[] {
  const baseOptions: ChannelConversationOption[] = [
    { channelId: 'telegram', label: 'Telegram', actionId: 'prepare' },
    { channelId: 'discord', label: 'Discord', actionId: 'prepare' },
    { channelId: 'slack', label: 'Slack', actionId: 'prepare' },
    { channelId: 'whatsapp', label: 'WhatsApp', actionId: 'prepare' },
    { channelId: 'instagram', label: 'Instagram', actionId: 'prepare' },
    { channelId: 'signal', label: 'Signal', actionId: 'prepare' },
    { channelId: 'imessage', label: 'iMessage', actionId: 'prepare' },
    { channelId: 'teams', label: 'Teams', actionId: 'prepare' },
    { channelId: 'email', label: 'Email', actionId: 'prepare' },
  ];
  const normalizedTarget = normalizeNaturalChannelText(compareTarget || '');
  if (/(trabalho|empresa|equipe|time|corporativo|workspace)/.test(normalizedTarget)) {
    return [
      baseOptions[2],
      baseOptions[6],
      baseOptions[0],
      baseOptions[1],
      baseOptions[3],
      baseOptions[4],
      baseOptions[5],
      baseOptions[8],
    ];
  }
  if (/(comunidade|publico|servidor|guild|community)/.test(normalizedTarget)) {
    return [
      baseOptions[1],
      baseOptions[0],
      baseOptions[2],
      baseOptions[3],
      baseOptions[4],
      baseOptions[5],
      baseOptions[6],
      baseOptions[8],
    ];
  }
  if (/(cliente|clientes|comercial|vendas|brasil|telefone|celular)/.test(normalizedTarget)) {
    return [
      baseOptions[3],
      baseOptions[4],
      baseOptions[0],
      baseOptions[2],
      baseOptions[1],
      baseOptions[5],
      baseOptions[8],
      baseOptions[7],
    ];
  }
  if (/(privado|seguro|seguranca|pessoal|confidencial)/.test(normalizedTarget)) {
    return [
      baseOptions[5],
      baseOptions[6],
      baseOptions[0],
      baseOptions[3],
      baseOptions[1],
      baseOptions[2],
      baseOptions[8],
    ];
  }
  return baseOptions;
}

export function extractNaturalChannelCompareTarget(rawText: string): string | undefined {
  const match = String(rawText || '').match(/\b(?:para|pro|pra)\s+(.+)$/i);
  return match?.[1] ? String(match[1]).trim() : undefined;
}

export function extractNaturalChannelId(normalized: string): string | null {
  const channelMatchers: Array<{ id: string; patterns: RegExp[] }> = [
    { id: 'discord', patterns: [/\bdiscord\b/] },
    { id: 'telegram', patterns: [/\btelegram\b/] },
    { id: 'slack', patterns: [/\bslack\b/] },
    { id: 'whatsapp', patterns: [/\bwhatsapp\b/, /\bwhats app\b/, /\bwpp\b/, /\bzap\b/] },
    { id: 'instagram', patterns: [/\binstagram\b/, /\binsta\b/, /\big\b/, /\bdm do instagram\b/, /\bdirect\b/] },
    { id: 'signal', patterns: [/\bsignal\b/] },
    { id: 'imessage', patterns: [/\bimessage\b/, /\bi message\b/, /\bapple messages\b/, /\bmensagens da apple\b/] },
    { id: 'teams', patterns: [/\bmicrosoft teams\b/, /\bteams\b/] },
    { id: 'email', patterns: [/\be-mail\b/, /\bemail\b/, /\bmail\b/] },
    { id: 'web', patterns: [/\bweb\b/, /\bsite\b/, /\bdashboard\b/, /\bapp\b/] },
  ];

  for (const entry of channelMatchers) {
    if (entry.patterns.some((pattern) => pattern.test(normalized))) {
      return entry.id;
    }
  }
  return null;
}

export function formatNaturalChannelLabel(channelId: string): string {
  switch (String(channelId || '').trim().toLowerCase()) {
    case 'discord':
      return 'Discord';
    case 'telegram':
      return 'Telegram';
    case 'slack':
      return 'Slack';
    case 'whatsapp':
      return 'WhatsApp';
    case 'instagram':
      return 'Instagram';
    case 'signal':
      return 'Signal';
    case 'imessage':
      return 'iMessage';
    case 'teams':
      return 'Teams';
    case 'email':
      return 'Email';
    case 'web':
      return 'Web';
    default:
      return channelId;
  }
}

export function looksLikeChannelSetupConfigFollowup(rawText: string): boolean {
  const normalized = normalizeNaturalChannelText(rawText);
  return /\b(token|secret|guild|channel id|chat id|tenant id|app id|smtp|imap|webhook|verify token|phone number id|business account|business account id|recipient id|user ids|allowed|recipients|node id|signal-cli)\b/.test(normalized)
    || /\b[A-Z0-9_]{3,}\s*=/.test(String(rawText || ''));
}

export function naturalChannelWantsDoctor(rawText: string): boolean {
  return /\b(doctor|diagnostico|diagnosticar|validar|valide|verificar|health|check|smoke)\b/i.test(String(rawText || ''));
}

export function naturalChannelWantsTest(rawText: string): boolean {
  return /\b(send-test|broadcast-test|teste de envio|mensagem de teste|mande um teste|envie um teste|teste o canal)\b/i.test(String(rawText || ''));
}

export function normalizeNaturalChannelText(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function extractNaturalChannelPreviewSelection(normalized: string): number | null {
  const match = normalized.match(
    /\b(?:abre|abrir|abra|usa|usar|quero|escolhe|escolher|pegue|pega)\b.*?\b(a\s+)?(primeira|segunda|terceira|quarta|quinta|sexta|setima|oitava|nona|1|2|3|4|5|6|7|8|9)\s+opcao\b/,
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
    case 'setima':
    case '7':
      return 7;
    case 'oitava':
    case '8':
      return 8;
    case 'nona':
    case '9':
      return 9;
    default:
      return null;
  }
}

function extractImplicitChannelPreviewSelection(normalized: string): number | null {
  const match = normalized.match(/\b(?:na verdade\s+)?(primeira|segunda|terceira|quarta|quinta|sexta|setima|oitava|nona|1|2|3|4|5|6|7|8|9)\b/);
  if (!match?.[1]) {
    return null;
  }
  return extractNaturalChannelPreviewSelection(`abre a ${match[1]} opcao`);
}
