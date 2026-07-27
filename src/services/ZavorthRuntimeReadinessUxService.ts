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
  statusLabel: 'ready' | 'Atencao' | 'Bloqueado';
  tone: ZavorthRuntimeReadinessUxTone;
  required: boolean;
  summary: string;
  nextAction: string;
  href: string;
  action: ZavorthRuntimeReadinessUxAction;
};

export type ZavorthRuntimeReadinessUxZavorthControlProjection = {
  route: '/zavorthControl' | '/control';
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
  statusLabel: 'ready' | 'Atencao' | 'Bloqueado';
  dailyUseReady: boolean;
  dailyUseLabel: 'ready' | 'com attention' | 'blocked';
  headline: string;
  subhead: string;
  primaryAction: ZavorthRuntimeReadinessUxAction;
  secondaryActions: ZavorthRuntimeReadinessUxAction[];
  cards: ZavorthRuntimeReadinessUxCard[];
  zavorthControlProjection: ZavorthRuntimeReadinessUxZavorthControlProjection;
  cliProjection: {
    command: 'zavorth readiness';
    jsonCommand: 'zavorth readiness --json';
    technicalCommand: 'zavorth readiness --technical';
    renderMode: 'operator-summary';
    showTechnicalDetailsByDefault: false;
    executionAuthority: false;
  };
  telegramProjection: {
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
        ? 'com attention'
        : 'ready'
      : 'blocked';
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
      zavorthControlProjection: createRuntimeReadinessProjection(cards),
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
        text: this.renderTelegramFromParts(base),
        replyMarkup: {
          inline_keyboard: [
            [
              { text: 'ZavorthControl', callback_data: '/zavorthControl' },
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
      `daily use: ${snapshot.dailyUseLabel}`,
      snapshot.subhead,
      '',
      'Estado',
      ...snapshot.cards.map((card) =>
        `- ${card.title}: ${card.statusLabel}. ${card.summary}`,
      ),
      '',
      `next passo: ${snapshot.primaryAction.label}${primary ? ` (${primary})` : ''}`,
    ];

    if (snapshot.secondaryActions.length > 0) {
      lines.push(
        '',
        'shortcuts',
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
      `daily use: ${snapshot.dailyUseLabel}`,
      snapshot.subhead,
      '',
      ...cards.map((card) => `${card.title}: ${card.statusLabel}. ${card.summary}`),
      '',
      `next: ${snapshot.primaryAction.label}.`,
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
      || cards.find((card) => card.id === 'zavorthControl')
      || cards[0];

    if (!target) {
      return {
        id: 'open-zavorthControl',
        label: 'Abrir zavorthControl',
        kind: 'route',
        route: readiness.operator.zavorthControlRoute,
        primary: true,
        executionAuthority: false,
        summary: 'Abrir a interface de controle do Zavorth.',
      };
    }

    return {
      ...target.action,
    };
  }

  private resolveSecondaryActions(
    cards: ZavorthRuntimeReadinessUxCard[],
    primaryAction: ZavorthRuntimeReadinessUxAction,
  ): ZavorthRuntimeReadinessUxAction[] {
    const actions = cards
      .filter((card) => card.action.id !== primaryAction.id.replace(/-primary$/, ''))
      .map((card) => card.action);
    const zavorthControlAction: ZavorthRuntimeReadinessUxAction = {
      id: 'open-zavorthControl',
      label: 'Abrir zavorthControl',
      kind: 'route',
      route: '/control',
      callbackData: '/control',
      primary: false,
      executionAuthority: false,
      summary: 'Abrir a interface de controle do Zavorth.',
    };
    return uniqueActions([zavorthControlAction, ...actions]);
  }
}

function createRuntimeReadinessProjection(
  cards: ZavorthRuntimeReadinessUxCard[],
): ZavorthRuntimeReadinessUxZavorthControlProjection {
  return {
    route: '/control',
    endpoint: '/api/runtime/readiness',
    slot: 'runtime-readiness',
    renderMode: 'operator-cards',
    showTechnicalDetailsByDefault: false,
    executionAuthority: false,
    cards,
  };
}

function titleForCheck(id: ZavorthRuntimeReadinessCheckId): string {
  const titles: Record<ZavorthRuntimeReadinessCheckId, string> = {
    'natural-first-runtime': 'Entrada natural',
    'provider-mesh': 'Provider',
    zavorthControl: 'ZavorthControl',
    telegram: 'Telegram',
    approvals: 'Approvals',
    'transaction-plane': 'Transaction plane',
    'skill-imports': 'Skills',
    'memory-continuity': 'Memory',
  };
  return titles[id];
}

function statusLabelFor(status: ZavorthRuntimeReadinessStatus): ZavorthRuntimeReadinessUxCard['statusLabel'] {
  if (status === 'ready') return 'ready';
  if (status === 'attention') return 'Atencao';
  return 'Bloqueado';
}

function headlineFor(status: ZavorthRuntimeReadinessStatus, dailyUseReady: boolean): string {
  if (status === 'ready') {
    return 'Zavorth is ready for daily use.';
  }
  if (status === 'attention' && dailyUseReady) {
    return 'Zavorth usavel, com attention.';
  }
  if (status === 'attention') {
    return 'Zavorth needs attention before unsupervised use.';
  }
  return 'Zavorth blocked para usage without supervision.';
}

function subheadFor(
  status: ZavorthRuntimeReadinessStatus,
  dailyUseReady: boolean,
  cards: ZavorthRuntimeReadinessUxCard[],
): string {
  const attention = cards.filter((card) => card.status === 'attention').length;
  const blocked = cards.filter((card) => card.status === 'blocked').length;
  if (status === 'ready') {
    return 'CLI, zavorthControl, approvals, memory, skills e transaction plane iso coerentes.';
  }
  if (dailyUseReady) {
    return `${formatItemCount(attention)} ${attention === 1 ? 'pede' : 'pedem'} setup, mas os contratos requireds iso seguros.`;
  }
  return `${formatItemCount(blocked)} ${blocked === 1 ? 'blocks' : 'block'} safe operation until review.`;
}

function summaryForCheck(check: ZavorthRuntimeReadinessCheck): string {
  if (check.status === 'blocked') {
    return blockedSummaryForCheck(check);
  }
  if (check.id === 'natural-first-runtime') {
    return 'Free text enters the gateway; risk becomes preview and approval.';
  }
  if (check.id === 'provider-mesh') {
    return check.status === 'ready'
      ? 'Default provider can respond when you request live LLM output.'
      : 'Provider still needs configuration for live LLM responses.';
  }
  if (check.id === 'zavorthControl') {
    return 'Daily home is available and does not execute target action.';
  }
  if (check.id === 'telegram') {
    return check.status === 'ready'
      ? 'Remote channel is ready for status and approvals.'
      : 'Channel remote ainda e optional in this environment.';
  }
  if (check.id === 'approvals') {
    return check.status === 'attention'
      ? 'Ha decisoes pending; resolver continua passando pelo gateway.'
      : 'Isolated approvals are ready with no direct execution in the UI.';
  }
  if (check.id === 'transaction-plane') {
    return 'Transactions reais seguem travadas; preview e simulaction continuam seguros.';
  }
  if (check.id === 'skill-imports') {
    return 'Skills externas continuam explicits, revisadas e travadas por default.';
  }
  return 'Memory consegue projetar continuidade without write escondida.';
}

function blockedSummaryForCheck(check: ZavorthRuntimeReadinessCheck): string {
  if (check.id === 'zavorthControl') {
    return 'Daily ZavorthControl or projection-only contract needs review.';
  }
  if (check.id === 'approvals') {
    return 'Approval UX did not prove gateway mediation.';
  }
  if (check.id === 'transaction-plane') {
    return 'Transaction gate did not prove live execution blocking.';
  }
  if (check.id === 'skill-imports') {
    return 'Ha source external de skill habilitada without pin/review suficiente.';
  }
  if (check.id === 'memory-continuity') {
    return 'Continuity memory is not available for safe resume.';
  }
  if (check.id === 'natural-first-runtime') {
    return 'Natural input is not preserving gateway and approval.';
  }
  return 'Item needs review before normal use.';
}

function nextActionForCheck(check: ZavorthRuntimeReadinessCheck): string {
  if (check.status === 'ready') {
    return 'No required action now.';
  }
  return check.nextAction;
}

function hrefForCheck(id: ZavorthRuntimeReadinessCheckId): string {
  const hrefs: Record<ZavorthRuntimeReadinessCheckId, string> = {
    'natural-first-runtime': '/zavorthControl',
    'provider-mesh': '/zavorthControl/providers',
    zavorthControl: '/zavorthControl',
    telegram: '/zavorthControl/providers',
    approvals: '/zavorthControl/logs',
    'transaction-plane': '/zavorthControl/health',
    'skill-imports': '/zavorthControl/health',
    'memory-continuity': '/zavorthControl/logs',
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
    if (check.id === 'zavorthControl') return 'Abrir zavorthControl';
    if (check.id === 'approvals') return 'Ver approvals';
    if (check.id === 'provider-mesh') return 'Ver providers';
    return `Ver ${titleForCheck(check.id)}`;
  }
  if (check.id === 'provider-mesh') return 'Configure provider';
  if (check.id === 'telegram') return 'Configure Telegram';
  if (check.id === 'approvals') return 'Resolver approvals';
  if (check.id === 'zavorthControl') return 'Abrir zavorthControl';
  if (check.id === 'skill-imports') return 'Review skills';
  return `Review ${titleForCheck(check.id)}`;
}

function callbackForCheck(id: ZavorthRuntimeReadinessCheckId): string | undefined {
  const callbacks: Partial<Record<ZavorthRuntimeReadinessCheckId, string>> = {
    'provider-mesh': '/models',
    zavorthControl: '/zavorthControl',
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
