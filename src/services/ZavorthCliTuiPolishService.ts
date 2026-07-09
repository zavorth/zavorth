import figlet from 'figlet';

import {
  paintCliBadge,
  paintCliDivider,
  paintCliTone,
  stripCliAnsi,
} from '../cli/ZavorthCliVisualTheme.js';
import { ZavorthReadyToGoService, type ZavorthReadyToGoSnapshot } from './ZavorthReadyToGoService.js';
import { ZavorthRuntimeReadinessService, type ZavorthRuntimeReadinessSnapshot } from './ZavorthRuntimeReadinessService.js';
import { ZavorthRuntimeGuidedFixesService, type ZavorthRuntimeGuidedFix } from './ZavorthRuntimeGuidedFixesService.js';
import { logger } from '../logger.js';

export const ZAVORTH_CLI_TUI_POLISH_CONTRACT_VERSION = 'zavorth-cli-tui-polish/1' as const;

export type ZavorthCliTuiPolishStatus = 'ready' | 'attention' | 'blocked';

export type ZavorthCliTuiPolishCard = {
  id: string;
  label: string;
  status: ZavorthCliTuiPolishStatus;
  value: string;
  detail: string;
  command: string;
};

export type ZavorthCliTuiPolishProvider = {
  id: string;
  role: 'active' | 'fallback';
  status: ZavorthCliTuiPolishStatus;
  model: string | null;
  summary: string;
};

export type ZavorthCliTuiPolishChannel = {
  id: 'zavorthControl' | 'telegram' | 'approvals';
  label: string;
  status: ZavorthCliTuiPolishStatus;
  value: string;
  command: string;
};

export type ZavorthCliTuiPolishShortcut = {
  key: string;
  label: string;
  command: string;
  detail: string;
};

export type ZavorthCliTuiPolishSnapshot = {
  contractVersion: typeof ZAVORTH_CLI_TUI_POLISH_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'cli-tui-polish';
  generatedAt: string;
  status: ZavorthCliTuiPolishStatus;
  headline: string;
  mode: 'offline' | 'refreshed';
  operator: {
    activeProvider: string | null;
    activeModel: string | null;
    zavorthControlUrl: string;
    remoteReady: boolean;
    localReady: boolean;
  };
  cards: ZavorthCliTuiPolishCard[];
  providers: ZavorthCliTuiPolishProvider[];
  channels: ZavorthCliTuiPolishChannel[];
  shortcuts: ZavorthCliTuiPolishShortcut[];
  guidedFixes: ZavorthRuntimeGuidedFix[];
  commands: {
    ready: 'zavorth ready';
    readyOffline: 'zavorth ready --offline';
    ask: 'zavorth ask "what should I do next?"';
    edit: 'zavorth edit "change this file" --path <folder>';
    apply: 'zavorth apply <diff-id>';
    providers: 'zavorth providers';
    approvals: 'zavorth gateway approvals';
    receipts: 'zavorth receipts';
    zavorthControl: 'zavorth open';
    fixes: 'zavorth readiness fixes';
    setup: 'zavorth setup';
    chat: 'zavorth chat';
    trust: 'zavorth trust';
  };
  safety: {
    noPromptExecution: true;
    noDirectPromptExecution: true;
    promptRoutingAvailable: true;
    noToolExecution: true;
    noLiveTransactionExecution: true;
    noRawSecretsSerialized: true;
    liveProviderProbeRequiresRefreshFlag: true;
    cliProjectionCannotApproveOrExecute: true;
  };
};

export type ZavorthCliTuiPolishInput = {
  refreshProviders?: boolean;
  includeAdvancedProviders?: boolean;
  userId?: string | null;
  sessionId?: string | null;
  workspaceHint?: string | null;
};

type ReadyToGoLike = Pick<ZavorthReadyToGoService, 'buildSnapshot'>;
type RuntimeReadinessLike = Pick<ZavorthRuntimeReadinessService, 'buildSnapshot'>;
type GuidedFixesLike = Pick<ZavorthRuntimeGuidedFixesService, 'buildSnapshot'>;

export type ZavorthCliTuiPolishRuntime = {
  now?: () => Date;
  readyToGo?: ReadyToGoLike;
  runtimeReadiness?: RuntimeReadinessLike;
  guidedFixes?: GuidedFixesLike;
};

export class ZavorthCliTuiPolishService {
  private readonly now: () => Date;
  private readonly readyToGo: ReadyToGoLike;
  private readonly runtimeReadiness: RuntimeReadinessLike;
  private readonly guidedFixes: GuidedFixesLike;

  public constructor(runtime: ZavorthCliTuiPolishRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.readyToGo = runtime.readyToGo || new ZavorthReadyToGoService({ now: this.now });
    this.runtimeReadiness = runtime.runtimeReadiness || new ZavorthRuntimeReadinessService({ now: this.now });
    this.guidedFixes = runtime.guidedFixes || new ZavorthRuntimeGuidedFixesService();
  }

  public async buildSnapshot(input: ZavorthCliTuiPolishInput = {}): Promise<ZavorthCliTuiPolishSnapshot> {
    const refreshProviders = input.refreshProviders === true;
    const baseInput = {
      refreshProviders,
      includeAdvancedProviders: input.includeAdvancedProviders === true,
      userId: input.userId || 'operator',
      sessionId: input.sessionId || 'cli-tui-polish',
      workspaceHint: input.workspaceHint || process.cwd(),
    };
    const [ready, readiness] = await Promise.all([
      this.readyToGo.buildSnapshot(baseInput),
      this.runtimeReadiness.buildSnapshot(baseInput),
    ]);
    const fixes = this.guidedFixes.buildSnapshot(readiness).fixes.filter((fix) => fix.status !== 'ready');
    const status = resolveStatus(ready, readiness);

    return {
      contractVersion: ZAVORTH_CLI_TUI_POLISH_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'cli-tui-polish',
      generatedAt: this.now().toISOString(),
      status,
      headline: headlineFor(status, ready),
      mode: refreshProviders ? 'refreshed' : 'offline',
      operator: {
        activeProvider: ready.provider.activeProvider || null,
        activeModel: ready.provider.activeModel || null,
        zavorthControlUrl: ready.actions.zavorthControl || '/zavorthControl',
        remoteReady: ready.remoteReady,
        localReady: ready.localReady,
      },
      cards: buildCards(ready, readiness),
      providers: ready.provider.lanes.slice(0, 8).map((lane) => ({
        id: lane.id,
        role: lane.role,
        status: lane.status,
        model: lane.model,
        summary: lane.summary,
      })),
      channels: buildChannels(ready),
      shortcuts: buildShortcuts(),
      guidedFixes: fixes.slice(0, 6),
      commands: {
        ready: 'zavorth ready',
        readyOffline: 'zavorth ready --offline',
        ask: 'zavorth ask "what should I do next?"',
        edit: 'zavorth edit "change this file" --path <folder>',
        apply: 'zavorth apply <diff-id>',
        providers: 'zavorth providers',
        approvals: 'zavorth gateway approvals',
        receipts: 'zavorth receipts',
        zavorthControl: 'zavorth open',
        fixes: 'zavorth readiness fixes',
        setup: 'zavorth setup',
        chat: 'zavorth chat',
        trust: 'zavorth trust',
      },
      safety: {
        noPromptExecution: true,
        noDirectPromptExecution: true,
        promptRoutingAvailable: true,
        noToolExecution: true,
        noLiveTransactionExecution: true,
        noRawSecretsSerialized: true,
        liveProviderProbeRequiresRefreshFlag: true,
        cliProjectionCannotApproveOrExecute: true,
      },
    };
  }

  public renderCli(snapshot: ZavorthCliTuiPolishSnapshot): string {
    const width = 78;
    return [
      renderHero(snapshot),
      renderTopLine(snapshot),
      renderCards(snapshot.cards, width),
      renderChannels(snapshot.channels, width),
      renderProviders(snapshot.providers, width),
      renderShortcuts(snapshot.shortcuts, width),
      renderFixes(snapshot.guidedFixes),
      renderCommandDock(snapshot),
      paintCliTone(
        snapshot.mode === 'refreshed'
          ? 'Provider probes were explicitly requested for this run.'
          : 'Action mode is available: ask/chat start fast; edit/apply still follow engine policy.',
        'muted',
      ),
      '',
    ].join('\n');
  }
}

function resolveStatus(
  ready: ZavorthReadyToGoSnapshot,
  readiness: ZavorthRuntimeReadinessSnapshot,
): ZavorthCliTuiPolishStatus {
  if (ready.status === 'blocked' || readiness.status === 'blocked') return 'blocked';
  if (ready.status === 'attention' || readiness.status === 'attention') return 'attention';
  return 'ready';
}

function headlineFor(status: ZavorthCliTuiPolishStatus, ready: ZavorthReadyToGoSnapshot): string {
  if (status === 'ready') return ready.remoteReady ? 'Ready to operate now.' : 'Ready locally, with remote warning.';
  if (status === 'attention') return 'Usavel, mas com pontos de atencao.';
  return 'Still blocked for reliable use.';
}

function buildCards(
  ready: ZavorthReadyToGoSnapshot,
  readiness: ZavorthRuntimeReadinessSnapshot,
): ZavorthCliTuiPolishCard[] {
  const providerStatus = ready.summary.providerReady ? 'ready' : 'attention';
  const approvalsStatus = ready.channels.approvals === 'blocked' ? 'blocked' : ready.channels.approvals;
  return [
    {
      id: 'ready',
      label: 'Ready',
      status: ready.status,
      value: ready.remoteReady ? 'remote ok' : ready.localReady ? 'local ok' : 'blocked',
      detail: ready.actions.primary,
      command: 'zavorth ready',
    },
    {
      id: 'providers',
      label: 'Providers',
      status: providerStatus,
      value: `${ready.summary.providerDefaultRoutes} live`,
      detail: providerDetail(ready),
      command: 'zavorth providers',
    },
    {
      id: 'readiness',
      label: 'Readiness',
      status: readiness.status,
      value: `${readiness.summary.ready}/${readiness.checks.length}`,
      detail: readiness.nextAction,
      command: 'zavorth readiness',
    },
    {
      id: 'approvals',
      label: 'Approvals',
      status: approvalsStatus,
      value: ready.channels.approvals,
      detail: 'Resolucao sempre mediada pelo gateway.',
      command: 'zavorth gateway approvals',
    },
    {
      id: 'receipts',
      label: 'Receipts',
      status: 'ready',
      value: 'auditavel',
      detail: 'Historico de acoes, bloqueios e evidencias.',
      command: 'zavorth receipts',
    },
    {
      id: 'zavorthControl',
      label: 'ZavorthControl',
      status: ready.channels.zavorthControl,
      value: ready.channels.zavorthControl,
      detail: 'Superficie visual sem autoridade direta de execucao.',
      command: 'zavorth open',
    },
  ];
}

function buildChannels(ready: ZavorthReadyToGoSnapshot): ZavorthCliTuiPolishChannel[] {
  return [
    {
      id: 'zavorthControl',
      label: 'ZavorthControl',
      status: ready.channels.zavorthControl,
      value: ready.actions.zavorthControl || '/zavorthControl',
      command: 'zavorth open',
    },
    {
      id: 'telegram',
      label: 'Telegram',
      status: ready.channels.telegram,
      value: ready.channels.telegram,
      command: 'zavorth connectors doctor telegram',
    },
    {
      id: 'approvals',
      label: 'Approvals',
      status: ready.channels.approvals === 'blocked' ? 'blocked' : ready.channels.approvals,
      value: ready.channels.approvals,
      command: 'zavorth trust',
    },
  ];
}

function buildShortcuts(): ZavorthCliTuiPolishShortcut[] {
  return [
    { key: '/ask', label: 'quick ask', command: 'zavorth ask', detail: 'Lite/Express answer without the heavy audit surface.' },
    { key: '/edit', label: 'quick edit', command: 'zavorth edit', detail: 'Velocity diff in trusted folders; Shield otherwise.' },
    { key: '/apply', label: 'accept diff', command: 'zavorth apply', detail: 'Apply only after policy confirms the path.' },
    { key: '/model', label: 'model route', command: 'zavorth providers select', detail: 'Choose provider/model without editing .env.' },
    { key: '/ready', label: 'readiness', command: 'zavorth ready', detail: 'One check before daily use.' },
    { key: '/trust', label: 'permissions', command: 'zavorth trust', detail: 'Approvals, reusable scopes and break-glass.' },
  ];
}

function renderHero(snapshot: ZavorthCliTuiPolishSnapshot): string {
  const wordmark = safeFiglet('Zavorth');
  const badgeTone = toneForStatus(snapshot.status);
  return [
    paintCliTone(wordmark, 'brand'),
    `${paintCliBadge(snapshot.status, badgeTone)} ${snapshot.headline}`,
    paintCliTone(`generated ${snapshot.generatedAt} | ${snapshot.mode}`, 'muted'),
    paintCliDivider(78, 'muted'),
  ].join('\n');
}

function renderTopLine(snapshot: ZavorthCliTuiPolishSnapshot): string {
  const provider = snapshot.operator.activeProvider || 'auto';
  const model = snapshot.operator.activeModel || 'model-auto';
  const scope = snapshot.operator.remoteReady
    ? 'remote ready'
    : snapshot.operator.localReady
      ? 'local ready'
      : 'setup needed';
  return [
    paintCliTone('Operator', 'info'),
    `${paintCliBadge(scope, toneForStatus(snapshot.status))} provider ${provider} | model ${model}`,
    `${paintCliBadge('zavorthControl', 'brand')} ${snapshot.operator.zavorthControlUrl}`,
    '',
  ].join('\n');
}

function renderCards(cards: ZavorthCliTuiPolishCard[], width: number): string {
  const rows = cards.map((card) => {
    const title = `${statusIcon(card.status)} ${card.label}`;
    const left = `${pad(title, 18)} ${pad(card.value, 14)}`;
    return `${left} ${truncate(card.detail, Math.max(24, width - stripCliAnsi(left).length - 1))}`;
  });
  return [
    paintCliTone('Status', 'info'),
    ...rows,
    '',
  ].join('\n');
}

function renderProviders(providers: ZavorthCliTuiPolishProvider[], width: number): string {
  const rows = providers.length > 0
    ? providers.map((provider) => {
      const role = provider.role === 'active' ? 'principal' : 'fallback';
      const label = `${statusIcon(provider.status)} ${provider.id}`;
      const model = provider.model ? ` ${provider.model}` : '';
      return `${pad(label, 22)} ${pad(role, 10)} ${truncate(`${provider.summary}${model}`, width - 34)}`;
    })
    : ['- No ready provider found.'];
  return [
    paintCliTone('Providers', 'info'),
    ...rows,
    '',
  ].join('\n');
}

function renderChannels(channels: ZavorthCliTuiPolishChannel[], width: number): string {
  const rows = channels.map((channel) => {
    const label = `${statusIcon(channel.status)} ${channel.label}`;
    return `${pad(label, 18)} ${pad(channel.value, 18)} ${truncate(channel.command, width - 38)}`;
  });
  return [
    paintCliTone('Channels', 'info'),
    ...rows,
    '',
  ].join('\n');
}

function renderShortcuts(shortcuts: ZavorthCliTuiPolishShortcut[], width: number): string {
  const rows = shortcuts.map((shortcut) => {
    const left = `${pad(shortcut.key, 10)} ${pad(shortcut.label, 18)}`;
    return `${left} ${truncate(`${shortcut.command} - ${shortcut.detail}`, width - stripCliAnsi(left).length - 1)}`;
  });
  return [
    paintCliTone('Smart commands', 'info'),
    ...rows,
    '',
  ].join('\n');
}

function renderFixes(fixes: ZavorthRuntimeGuidedFix[]): string {
  if (fixes.length === 0) {
    return [
      paintCliTone('Next', 'info'),
      'All clear. Try: zavorth ask "summarize this project" or zavorth open',
      '',
    ].join('\n');
  }
  return [
    paintCliTone('Next', 'info'),
    ...fixes.map((fix) => `${statusIcon(fix.status)} ${fix.label}: ${fix.command || fix.route || fix.summary}`),
    '',
  ].join('\n');
}

function renderCommandDock(snapshot: ZavorthCliTuiPolishSnapshot): string {
  return [
    paintCliTone('Commands', 'info'),
    `${snapshot.commands.ask}     ${snapshot.commands.edit}`,
    `${snapshot.commands.apply}     ${snapshot.commands.zavorthControl}     ${snapshot.commands.chat}`,
    `${snapshot.commands.readyOffline}     ${snapshot.commands.providers}     ${snapshot.commands.trust}`,
    '',
  ].join('\n');
}

function providerDetail(ready: ZavorthReadyToGoSnapshot): string {
  const readyText = `${ready.summary.providerLiveReady} ${ready.summary.providerLiveReady === 1 ? 'pronto' : 'prontos'}`;
  if (ready.summary.providerLiveFailed <= 0) {
    return `${readyText}; sem falhas live recentes.`;
  }
  const failedText = `${ready.summary.providerLiveFailed} ${ready.summary.providerLiveFailed === 1 ? 'aviso' : 'avisos'}`;
  return `${readyText}; ${failedText} para revisar.`;
}

function safeFiglet(value: string): string {
  try {
    return figlet.textSync(value, {
      font: 'Small',
      horizontalLayout: 'default',
      verticalLayout: 'default',
      width: 80,
    });
  } catch (error: unknown) {logger.warn('[Zavorth Cli Tui Polish] string operation failed', error);
    return value.toUpperCase();
  }
}

function statusIcon(status: ZavorthCliTuiPolishStatus): string {
  if (status === 'ready') return paintCliTone('OK', 'success');
  if (status === 'attention') return paintCliTone('!!', 'warning');
  return paintCliTone('XX', 'danger');
}

function toneForStatus(status: ZavorthCliTuiPolishStatus): 'success' | 'warning' | 'danger' {
  if (status === 'ready') return 'success';
  if (status === 'attention') return 'warning';
  return 'danger';
}

function pad(value: string, width: number): string {
  const visible = stripCliAnsi(value).length;
  return `${value}${' '.repeat(Math.max(0, width - visible))}`;
}

function truncate(value: string, max: number): string {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 3))}...`;
}
