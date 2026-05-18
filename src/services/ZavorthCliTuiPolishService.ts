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

export type ZavorthCliTuiPolishSnapshot = {
  contractVersion: typeof ZAVORTH_CLI_TUI_POLISH_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'cli-tui-polish';
  generatedAt: string;
  status: ZavorthCliTuiPolishStatus;
  headline: string;
  mode: 'offline' | 'refreshed';
  cards: ZavorthCliTuiPolishCard[];
  providers: ZavorthCliTuiPolishProvider[];
  guidedFixes: ZavorthRuntimeGuidedFix[];
  commands: {
    ready: 'zavorth ready';
    readyOffline: 'zavorth ready --offline';
    providers: 'zavorth providers';
    approvals: 'zavorth gateway approvals';
    receipts: 'zavorth receipts';
    dashboard: 'zavorth go';
    fixes: 'zavorth readiness fixes';
  };
  safety: {
    noPromptExecution: true;
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
      cards: buildCards(ready, readiness),
      providers: ready.provider.lanes.slice(0, 8).map((lane) => ({
        id: lane.id,
        role: lane.role,
        status: lane.status,
        model: lane.model,
        summary: lane.summary,
      })),
      guidedFixes: fixes.slice(0, 6),
      commands: {
        ready: 'zavorth ready',
        readyOffline: 'zavorth ready --offline',
        providers: 'zavorth providers',
        approvals: 'zavorth gateway approvals',
        receipts: 'zavorth receipts',
        dashboard: 'zavorth go',
        fixes: 'zavorth readiness fixes',
      },
      safety: {
        noPromptExecution: true,
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
      renderCards(snapshot.cards, width),
      renderProviders(snapshot.providers, width),
      renderFixes(snapshot.guidedFixes),
      renderCommandDock(snapshot),
      paintCliTone(
        snapshot.mode === 'refreshed'
          ? 'Provider probes foram solicitados explicitamente nesta execucao.'
          : 'Modo leitura: nenhum provider live, tool, prompt ou transacao foi executado.',
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
  if (status === 'ready') return ready.remoteReady ? 'Pronto para operar agora.' : 'Pronto localmente, com aviso remoto.';
  if (status === 'attention') return 'Usavel, mas com pontos de atencao.';
  return 'Ainda bloqueado para uso confiavel.';
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
      value: ready.remoteReady ? 'remoto ok' : ready.localReady ? 'local ok' : 'bloqueado',
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
      id: 'dashboard',
      label: 'Dashboard',
      status: ready.channels.dashboard,
      value: ready.channels.dashboard,
      detail: 'Superficie visual sem autoridade direta de execucao.',
      command: 'zavorth go',
    },
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
    : ['- Nenhum provider pronto encontrado.'];
  return [
    paintCliTone('Providers', 'info'),
    ...rows,
    '',
  ].join('\n');
}

function renderFixes(fixes: ZavorthRuntimeGuidedFix[]): string {
  if (fixes.length === 0) {
    return [
      paintCliTone('Next', 'info'),
      'Tudo limpo. Para abrir o ambiente: zavorth go',
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
    `${snapshot.commands.dashboard}     ${snapshot.commands.readyOffline}     ${snapshot.commands.providers}`,
    `${snapshot.commands.approvals}     ${snapshot.commands.receipts}     ${snapshot.commands.fixes}`,
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
  } catch {
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
