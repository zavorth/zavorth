import type {
  ZavorthRuntimeReadinessCheck,
  ZavorthRuntimeReadinessCheckId,
  ZavorthRuntimeReadinessSnapshot,
  ZavorthRuntimeReadinessStatus,
} from './ZavorthRuntimeReadinessService.js';

export const ZAVORTH_RUNTIME_READINESS_UX_CONTRACT_VERSION = 'zavorth-runtime-readiness-ux/1' as const;

export type ZavorthRuntimeReadinessUxTone = 'ready' | 'attention' | 'blocked';

export type ZavorthRuntimeReadinessUxActionKind = 'command' | 'route' | 'telegram-command';

export type ZavorthRuntimeReadinessUxAction = {
  id: string;
  label: string;
  kind: ZavorthRuntimeReadinessUxActionKind;
  command?: string;
  route?: string;
  callbackData?: string;
  primary: boolean;
  executionAuthority: false;
  summary: string;
};

export type ZavorthRuntimeReadinessUxCard = {
  id: ZavorthRuntimeReadinessCheckId;
  title: string;
  status: ZavorthRuntimeReadinessStatus;
  statusLabel: 'Pronto' | 'Atencao' | 'Bloqueado';
  tone: ZavorthRuntimeReadinessUxTone;
  required: boolean;
  summary: string;
  nextAction: string;
  href: string;
  action: ZavorthRuntimeReadinessUxAction;
};

export type ZavorthRuntimeReadinessUxDashboardProjection = {
  route: '/dashboard';
  endpoint: '/api/runtime/readiness';
  slot: 'runtime-readiness';
  renderMode: 'operator-cards';
  showTechnicalDetailsByDefault: false;
  executionAuthority: false;
  cards: ZavorthRuntimeReadinessUxCard[];
};

export type ZavorthRuntimeReadinessUxSnapshot = {
  contractVersion: typeof ZAVORTH_RUNTIME_READINESS_UX_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'runtime-readiness-operator-ux';
  generatedAt: string;
  status: ZavorthRuntimeReadinessStatus;
  statusLabel: 'Pronto' | 'Atencao' | 'Bloqueado';
  dailyUseReady: boolean;
  dailyUseLabel: 'pronto' | 'com atencao' | 'bloqueado';
  headline: string;
  subhead: string;
  primaryAction: ZavorthRuntimeReadinessUxAction;
  secondaryActions: ZavorthRuntimeReadinessUxAction[];
  cards: ZavorthRuntimeReadinessUxCard[];
  dashboardProjection: ZavorthRuntimeReadinessUxDashboardProjection;
  zavorthControlProjection: ZavorthRuntimeReadinessUxDashboardProjection;
  cliProjection: {
    command: 'zavorth readiness';
    jsonCommand: 'zavorth readiness --json';
    technicalCommand: 'zavorth readiness --technical';
    renderMode: 'operator-summary';
    showTechnicalDetailsByDefault: false;
    executionAuthority: false;
  };
  telegramProjection: {
    command: '/readiness';
    renderMode: 'operator-summary';
    showTechnicalDetailsByDefault: false;
    executionAuthority: false;
    text: string;
    replyMarkup: {
      inline_keyboard: Array<Array<{
        text: string;
        callback_data: string;
      }>>;
    };
  };
  safety: {
    projectionOnly: true;
    noLiveProbe: true;
    executionAuthority: false;
    approvalsRemainGatewayMediated: true;
    noRawSecretsSerialized: true;
  };
  source: {
    readinessContractVersion: ZavorthRuntimeReadinessSnapshot['contractVersion'];
    readinessGeneratedAt: string;
  };
};

export class ZavorthRuntimeReadinessUxService {
  public buildSnapshot(readiness: ZavorthRuntimeReadinessSnapshot): ZavorthRuntimeReadinessUxSnapshot {
    const cards = readiness.checks.map((check) => this.buildCard(check));
    const primaryAction = this.resolvePrimaryAction(readiness, cards);
    const secondaryActions = this.resolveSecondaryActions(cards, primaryAction);
    const statusLabel = statusLabelFor(readiness.status);
    const dailyUseLabel = readiness.dailyUseReady
      ? readiness.status === 'attention'
        ? 'com atencao'
        : 'pronto'
      : 'bloqueado';
    const headline = headlineFor(readiness.status, readiness.dailyUseReady);
    const subhead = subheadFor(readiness.status, readiness.dailyUseReady, cards);
    const base: Omit<ZavorthRuntimeReadinessUxSnapshot, 'telegramProjection'> = {
      contractVersion: ZAVORTH_RUNTIME_READINESS_UX_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'runtime-readiness-operator-ux',
      generatedAt: readiness.generatedAt,
      status: readiness.status,
      statusLabel,
      dailyUseReady: readiness.dailyUseReady,
      dailyUseLabel,
      headline,
      subhead,
      primaryAction,
      secondaryActions,
      cards,
      dashboardProjection: {
        route: '/dashboard',
        endpoint: '/api/runtime/readiness',
        slot: 'runtime-readiness',
        renderMode: 'operator-cards',
        showTechnicalDetailsByDefault: false,
        executionAuthority: false,
        cards,
      },
      zavorthControlProjection: {
        route: '/dashboard',
        endpoint: '/api/runtime/readiness',
        slot: 'runtime-readiness',
        renderMode: 'operator-cards',
        showTechnicalDetailsByDefault: false,
        executionAuthority: false,
        cards,
      },
      cliProjection: {
        command: 'zavorth readiness',
        jsonCommand: 'zavorth readiness --json',
        technicalCommand: 'zavorth readiness --technical',
        renderMode: 'operator-summary',
        showTechnicalDetailsByDefault: false,
        executionAuthority: false,
      },
      safety: {
        projectionOnly: true,
        noLiveProbe: true,
        executionAuthority: false,
        approvalsRemainGatewayMediated: true,
        noRawSecretsSerialized: true,
      },
      source: {
        readinessContractVersion: readiness.contractVersion,
        readinessGeneratedAt: readiness.generatedAt,
      },
    };

    return {
      ...base,
      telegramProjection: {
        command: '/readiness',
        renderMode: 'operator-summary',
        showTechnicalDetailsByDefault: false,
        executionAuthority: false,
        text: this.renderTelegramFromParts(base),
        replyMarkup: {
          inline_keyboard: [
            [
              { text: 'Dashboard', callback_data: '/dashboard' },
              { text: 'Status', callback_data: '/status' },
            ],
            [
              { text: 'Providers', callback_data: '/models' },
              { text: 'Fixes', callback_data: '/fixes' },
              { text: 'Approvals', callback_data: '/echoapprovals' },
            ],
          ],
        },
      },
    };
  }

  public renderCli(snapshot: ZavorthRuntimeReadinessUxSnapshot): string {
    const primary = formatAction(snapshot.primaryAction);
    const lines = [
      snapshot.headline,
      `Uso diario: ${snapshot.dailyUseLabel}`,
      snapshot.subhead,
      '',
      'Estado',
      ...snapshot.cards.map((card) =>
        `- ${card.title}: ${card.statusLabel}. ${card.summary}`,
      ),
      '',
      `Proximo passo: ${snapshot.primaryAction.label}${primary ? ` (${primary})` : ''}`,
    ];

    if (snapshot.secondaryActions.length > 0) {
      lines.push(
        '',
        'Atalhos',
        ...snapshot.secondaryActions.slice(0, 3).map((action) =>
          `- ${action.label}${formatAction(action) ? ` (${formatAction(action)})` : ''}`,
        ),
      );
    }

    return `${lines.join('\n')}\n`;
  }

  public renderTelegram(snapshot: ZavorthRuntimeReadinessUxSnapshot): string {
    return snapshot.telegramProjection.text;
  }

  private renderTelegramFromParts(
    snapshot: Omit<ZavorthRuntimeReadinessUxSnapshot, 'telegramProjection'>,
  ): string {
    const cards = prioritizeCardsForTelegram(snapshot.cards);
    return [
      snapshot.headline,
      `Uso diario: ${snapshot.dailyUseLabel}`,
      snapshot.subhead,
      '',
      ...cards.map((card) => `${card.title}: ${card.statusLabel}. ${card.summary}`),
      '',
      `Proximo: ${snapshot.primaryAction.label}.`,
    ].join('\n');
  }

  private buildCard(check: ZavorthRuntimeReadinessCheck): ZavorthRuntimeReadinessUxCard {
    const action = buildActionForCheck(check, false);
    return {
      id: check.id,
      title: titleForCheck(check.id),
      status: check.status,
      statusLabel: statusLabelFor(check.status),
      tone: check.status,
      required: check.required,
      summary: summaryForCheck(check),
      nextAction: nextActionForCheck(check),
      href: hrefForCheck(check.id),
      action,
    };
  }

  private resolvePrimaryAction(
    readiness: ZavorthRuntimeReadinessSnapshot,
    cards: ZavorthRuntimeReadinessUxCard[],
  ): ZavorthRuntimeReadinessUxAction {
    const target = cards.find((card) => card.required && card.status === 'blocked')
      || cards.find((card) => card.status === 'attention')
      || cards.find((card) => card.id === 'dashboard')
      || cards[0];

    if (!target) {
      return {
        id: 'open-dashboard',
        label: 'Abrir dashboard',
        kind: 'route',
        route: readiness.operator.dashboardRoute,
        primary: true,
        executionAuthority: false,
        summary: 'Abrir a superficie diaria do Zavorth.',
      };
    }

    return {
      ...target.action,
      id: `${target.action.id}-primary`,
      primary: true,
    };
  }

  private resolveSecondaryActions(
    cards: ZavorthRuntimeReadinessUxCard[],
    primaryAction: ZavorthRuntimeReadinessUxAction,
  ): ZavorthRuntimeReadinessUxAction[] {
    const actions = cards
      .filter((card) => card.action.id !== primaryAction.id.replace(/-primary$/, ''))
      .map((card) => card.action);
    const dashboardAction: ZavorthRuntimeReadinessUxAction = {
      id: 'open-dashboard',
      label: 'Abrir dashboard',
      kind: 'route',
      route: '/dashboard',
      callbackData: '/dashboard',
      primary: false,
      executionAuthority: false,
      summary: 'Abrir a superficie diaria do Zavorth.',
    };
    return uniqueActions([dashboardAction, ...actions]);
  }
}

function titleForCheck(id: ZavorthRuntimeReadinessCheckId): string {
  const titles: Record<ZavorthRuntimeReadinessCheckId, string> = {
    'natural-first-runtime': 'Entrada natural',
    'provider-mesh': 'Provider',
    dashboard: 'Dashboard',
    telegram: 'Telegram',
    approvals: 'Approvals',
    'transaction-plane': 'Transaction plane',
    'skill-imports': 'Skills',
    'memory-continuity': 'Memoria',
  };
  return titles[id];
}

function statusLabelFor(status: ZavorthRuntimeReadinessStatus): ZavorthRuntimeReadinessUxCard['statusLabel'] {
  if (status === 'ready') return 'Pronto';
  if (status === 'attention') return 'Atencao';
  return 'Bloqueado';
}

function headlineFor(status: ZavorthRuntimeReadinessStatus, dailyUseReady: boolean): string {
  if (status === 'ready') {
    return 'Zavorth pronto para uso diario.';
  }
  if (status === 'attention' && dailyUseReady) {
    return 'Zavorth usavel, com atencao.';
  }
  if (status === 'attention') {
    return 'Zavorth precisa de atencao antes de uso sem supervisao.';
  }
  return 'Zavorth bloqueado para uso sem supervisao.';
}

function subheadFor(
  status: ZavorthRuntimeReadinessStatus,
  dailyUseReady: boolean,
  cards: ZavorthRuntimeReadinessUxCard[],
): string {
  const attention = cards.filter((card) => card.status === 'attention').length;
  const blocked = cards.filter((card) => card.status === 'blocked').length;
  if (status === 'ready') {
    return 'CLI, dashboard, approvals, memoria, skills e transaction plane estao coerentes.';
  }
  if (dailyUseReady) {
    return `${formatItemCount(attention)} ${attention === 1 ? 'pede' : 'pedem'} setup, mas os contratos obrigatorios estao seguros.`;
  }
  return `${formatItemCount(blocked)} ${blocked === 1 ? 'bloqueia' : 'bloqueiam'} a operacao segura ate revisao.`;
}

function summaryForCheck(check: ZavorthRuntimeReadinessCheck): string {
  if (check.status === 'blocked') {
    return blockedSummaryForCheck(check);
  }
  if (check.id === 'natural-first-runtime') {
    return 'Texto livre entra no gateway; risco vira preview e approval.';
  }
  if (check.id === 'provider-mesh') {
    return check.status === 'ready'
      ? 'Provider padrao pode responder quando voce pedir LLM ao vivo.'
      : 'Provider ainda precisa de configuracao para respostas LLM ao vivo.';
  }
  if (check.id === 'dashboard') {
    return 'Home diario esta disponivel e nao executa acao alvo.';
  }
  if (check.id === 'telegram') {
    return check.status === 'ready'
      ? 'Canal remoto esta pronto para status e approvals.'
      : 'Canal remoto ainda e opcional neste ambiente.';
  }
  if (check.id === 'approvals') {
    return check.status === 'attention'
      ? 'Ha decisoes pendentes; resolver continua passando pelo gateway.'
      : 'Aprovacoes estao prontas e sem execucao direta na UI.';
  }
  if (check.id === 'transaction-plane') {
    return 'Transacoes reais seguem travadas; preview e simulacao continuam seguros.';
  }
  if (check.id === 'skill-imports') {
    return 'Skills externas continuam explicitas, revisadas e travadas por padrao.';
  }
  return 'Memoria consegue projetar continuidade sem escrita escondida.';
}

function blockedSummaryForCheck(check: ZavorthRuntimeReadinessCheck): string {
  if (check.id === 'dashboard') {
    return 'Dashboard diario ou contrato projection-only precisa ser restaurado.';
  }
  if (check.id === 'approvals') {
    return 'Approval UX nao provou mediacao pelo gateway.';
  }
  if (check.id === 'transaction-plane') {
    return 'Gate transacional nao provou bloqueio de execucao live.';
  }
  if (check.id === 'skill-imports') {
    return 'Ha fonte externa de skill habilitada sem pin/revisao suficiente.';
  }
  if (check.id === 'memory-continuity') {
    return 'Memoria de continuidade nao esta disponivel para retomada segura.';
  }
  if (check.id === 'natural-first-runtime') {
    return 'Entrada natural nao esta preservando gateway e approval.';
  }
  return 'Item precisa de revisao antes de uso normal.';
}

function nextActionForCheck(check: ZavorthRuntimeReadinessCheck): string {
  if (check.status === 'ready') {
    return 'Nenhuma acao obrigatoria agora.';
  }
  return check.nextAction;
}

function hrefForCheck(id: ZavorthRuntimeReadinessCheckId): string {
  const hrefs: Record<ZavorthRuntimeReadinessCheckId, string> = {
    'natural-first-runtime': '/dashboard',
    'provider-mesh': '/dashboard/providers',
    dashboard: '/dashboard',
    telegram: '/dashboard/providers',
    approvals: '/dashboard/logs',
    'transaction-plane': '/dashboard/health',
    'skill-imports': '/dashboard/health',
    'memory-continuity': '/dashboard/logs',
  };
  return hrefs[id];
}

function buildActionForCheck(
  check: ZavorthRuntimeReadinessCheck,
  primary: boolean,
): ZavorthRuntimeReadinessUxAction {
  const id = actionIdForCheck(check.id);
  const route = hrefForCheck(check.id);
  const callbackData = callbackForCheck(check.id);
  const kind: ZavorthRuntimeReadinessUxActionKind = callbackData ? 'telegram-command' : 'route';
  return {
    id,
    label: actionLabelForCheck(check),
    kind,
    command: check.command,
    route,
    callbackData,
    primary,
    executionAuthority: false,
    summary: nextActionForCheck(check),
  };
}

function actionIdForCheck(id: ZavorthRuntimeReadinessCheckId): string {
  return `readiness-${id}`;
}

function actionLabelForCheck(check: ZavorthRuntimeReadinessCheck): string {
  if (check.status === 'ready') {
    if (check.id === 'dashboard') return 'Abrir dashboard';
    if (check.id === 'approvals') return 'Ver approvals';
    if (check.id === 'provider-mesh') return 'Ver providers';
    return `Ver ${titleForCheck(check.id)}`;
  }
  if (check.id === 'provider-mesh') return 'Configurar provider';
  if (check.id === 'telegram') return 'Configurar Telegram';
  if (check.id === 'approvals') return 'Resolver approvals';
  if (check.id === 'dashboard') return 'Abrir dashboard';
  if (check.id === 'skill-imports') return 'Revisar skills';
  return `Revisar ${titleForCheck(check.id)}`;
}

function callbackForCheck(id: ZavorthRuntimeReadinessCheckId): string | undefined {
  const callbacks: Partial<Record<ZavorthRuntimeReadinessCheckId, string>> = {
    'provider-mesh': '/models',
    dashboard: '/dashboard',
    approvals: '/echoapprovals',
    telegram: '/status',
  };
  return callbacks[id];
}

function formatAction(action: ZavorthRuntimeReadinessUxAction): string {
  return action.route || action.command || action.callbackData || '';
}

function formatItemCount(value: number): string {
  return `${value} ${value === 1 ? 'item' : 'itens'}`;
}

function uniqueActions(actions: ZavorthRuntimeReadinessUxAction[]): ZavorthRuntimeReadinessUxAction[] {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = action.route || action.command || action.callbackData || action.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function prioritizeCardsForTelegram(
  cards: ZavorthRuntimeReadinessUxCard[],
): ZavorthRuntimeReadinessUxCard[] {
  const urgent = cards.filter((card) => card.status !== 'ready');
  const steady = cards.filter((card) => card.status === 'ready');
  return [...urgent, ...steady].slice(0, 5);
}
