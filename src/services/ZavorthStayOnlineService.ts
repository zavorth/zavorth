import fs from 'node:fs';
import path from 'node:path';

import { config } from '../config/index.js';
import { KeepaliveStatusService, type KeepaliveStatusSnapshot } from './KeepaliveStatusService.js';
import { ZavorthReadyToGoService, type ZavorthReadyToGoSnapshot } from './ZavorthReadyToGoService.js';

export const ZAVORTH_STAY_ONLINE_CONTRACT_VERSION = 'zavorth-stay-online/1' as const;

export type ZavorthStayOnlineStatus = 'ready' | 'attention' | 'blocked';
export type ZavorthStayOnlineCheckId =
  | 'ready-to-go'
  | 'runtime-process'
  | 'dashboard'
  | 'telegram'
  | 'provider'
  | 'approvals'
  | 'keepalive'
  | 'self-heal';

export type ZavorthStayOnlineCheck = {
  id: ZavorthStayOnlineCheckId;
  label: string;
  status: ZavorthStayOnlineStatus;
  required: boolean;
  summary: string;
  nextAction: string;
  command: string | null;
};

export type ZavorthStayOnlineInput = {
  refreshProviders?: boolean;
  writeSnapshot?: boolean;
  intervalMs?: number;
  sequence?: number;
  userId?: string | null;
  sessionId?: string | null;
  workspaceHint?: string | null;
};

export type ZavorthStayOnlineSnapshot = {
  contractVersion: typeof ZAVORTH_STAY_ONLINE_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'zavorth-stay-online';
  generatedAt: string;
  status: ZavorthStayOnlineStatus;
  remoteReady: boolean;
  headline: string;
  heartbeat: {
    sequence: number;
    intervalMs: number;
    nextCheckAt: string | null;
    snapshotPath: string;
    written: boolean;
  };
  summary: {
    ready: number;
    attention: number;
    blocked: number;
    requiredBlocked: number;
    providerLiveReady: number;
    providerLiveFailed: number;
    keepaliveActive: boolean;
    keepaliveOk: boolean;
    keepaliveStale: boolean;
  };
  checks: ZavorthStayOnlineCheck[];
  alerts: Array<{
    id: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    command: string | null;
  }>;
  notificationPolicy: {
    quietByDefault: true;
    repeatedWarningRequiresOptIn: true;
    criticalAlwaysNotifies: true;
    unchangedReadySuppressed: true;
    defaultCooldownMs: number;
    telegramFormat: 'operator-briefing';
  };
  actions: {
    once: 'zavorth stay-online';
    watch: 'zavorth stay-online --watch';
    ready: 'zavorth ready';
    fixes: 'zavorth readiness fixes';
    keepalive: 'npm run ops:remote:keepalive';
  };
  projections: {
    cliCommand: 'zavorth stay-online';
    telegramCommand: '/stayonline';
    dashboardEndpoint: '/api/runtime/stay-online';
    snapshotFile: string;
  };
  safety: {
    noPromptExecution: true;
    noToolExecution: true;
    noLiveTransactionExecution: true;
    noApprovalBypass: true;
    rawSecretsSerialized: false;
    selfHealIsCommandProposalOnly: true;
  };
  readyToGo: Pick<
    ZavorthReadyToGoSnapshot,
    'status' | 'remoteReady' | 'localReady' | 'headline' | 'summary' | 'provider' | 'channels' | 'actions'
  >;
  keepalive: KeepaliveStatusSnapshot | null;
};

export type ZavorthStayOnlineNotification = {
  shouldNotify: boolean;
  severity: 'info' | 'warning' | 'critical';
  reason: 'first-check' | 'status-change' | 'active-alert' | 'periodic-ok' | 'quiet';
  message: string;
  compactLogLine: string;
};

type ReadyToGoLike = Pick<ZavorthReadyToGoService, 'buildSnapshot'>;
type KeepaliveLike = Pick<KeepaliveStatusService, 'readSnapshot'>;

export type ZavorthStayOnlineRuntime = {
  now?: () => Date;
  projectRoot?: string;
  readyToGo?: ReadyToGoLike;
  keepaliveStatus?: KeepaliveLike;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
};

const DEFAULT_INTERVAL_MS = 60_000;

export class ZavorthStayOnlineService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly readyToGo: ReadyToGoLike;
  private readonly keepaliveStatus: KeepaliveLike;
  private readonly writeFileSyncImpl: typeof fs.writeFileSync;
  private readonly mkdirSyncImpl: typeof fs.mkdirSync;

  public constructor(runtime: ZavorthStayOnlineRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = runtime.projectRoot || config.projectRoot;
    this.readyToGo = runtime.readyToGo || new ZavorthReadyToGoService({ now: this.now });
    this.keepaliveStatus = runtime.keepaliveStatus || new KeepaliveStatusService({ now: this.now });
    this.writeFileSyncImpl = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSyncImpl = runtime.mkdirSync || fs.mkdirSync.bind(fs);
  }

  public get snapshotPath(): string {
    return path.join(this.projectRoot, 'data', 'runtime', 'zavorth-stay-online.json');
  }

  public async buildSnapshot(input: ZavorthStayOnlineInput = {}): Promise<ZavorthStayOnlineSnapshot> {
    const intervalMs = positiveInt(input.intervalMs) || DEFAULT_INTERVAL_MS;
    const generatedAt = this.now().toISOString();
    const readyToGo = await this.readyToGo.buildSnapshot({
      refreshProviders: input.refreshProviders === true,
      userId: input.userId || 'operator',
      sessionId: input.sessionId || 'stay-online',
      workspaceHint: input.workspaceHint || this.projectRoot,
    });
    const keepalive = this.keepaliveStatus.readSnapshot();
    const checks = this.buildChecks({ readyToGo, keepalive });
    const summary = summarize(checks, readyToGo, keepalive);
    const status = resolveStatus(checks);
    const nextCheckAt = new Date(Date.parse(generatedAt) + intervalMs).toISOString();
    const snapshot: ZavorthStayOnlineSnapshot = {
      contractVersion: ZAVORTH_STAY_ONLINE_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'zavorth-stay-online',
      generatedAt,
      status,
      remoteReady: readyToGo.remoteReady && status !== 'blocked',
      headline: headlineFor(status, readyToGo.remoteReady),
      heartbeat: {
        sequence: positiveInt(input.sequence) || 1,
        intervalMs,
        nextCheckAt,
        snapshotPath: this.snapshotPath,
        written: false,
      },
      summary,
      checks,
      alerts: buildAlerts(checks),
      notificationPolicy: {
        quietByDefault: true,
        repeatedWarningRequiresOptIn: true,
        criticalAlwaysNotifies: true,
        unchangedReadySuppressed: true,
        defaultCooldownMs: 30 * 60_000,
        telegramFormat: 'operator-briefing',
      },
      actions: {
        once: 'zavorth stay-online',
        watch: 'zavorth stay-online --watch',
        ready: 'zavorth ready',
        fixes: 'zavorth readiness fixes',
        keepalive: 'npm run ops:remote:keepalive',
      },
      projections: {
        cliCommand: 'zavorth stay-online',
        telegramCommand: '/stayonline',
        dashboardEndpoint: '/api/runtime/stay-online',
        snapshotFile: this.snapshotPath,
      },
      safety: {
        noPromptExecution: true,
        noToolExecution: true,
        noLiveTransactionExecution: true,
        noApprovalBypass: true,
        rawSecretsSerialized: false,
        selfHealIsCommandProposalOnly: true,
      },
      readyToGo: projectReadyToGo(readyToGo),
      keepalive,
    };
    if (input.writeSnapshot !== false) {
      snapshot.heartbeat.written = true;
      this.writeSnapshot(snapshot);
    }
    return snapshot;
  }

  public buildNotification(input: {
    previous?: ZavorthStayOnlineSnapshot | null;
    current: ZavorthStayOnlineSnapshot;
    notifyOkEvery?: number | null;
    notifyReadyOnStart?: boolean;
    notifyWarnings?: boolean;
  }): ZavorthStayOnlineNotification {
    const previous = input.previous || null;
    const current = input.current;
    const okEvery = positiveInt(input.notifyOkEvery);
    const severity = current.status === 'blocked'
      ? 'critical'
      : current.status === 'attention'
        ? 'warning'
        : 'info';
    const activeAlert = current.alerts.find((alert) => alert.severity === 'critical')
      || current.alerts[0]
      || null;

    if (!previous) {
      if (current.status === 'ready' && input.notifyReadyOnStart !== true) {
        return {
          shouldNotify: false,
          severity: 'info',
          reason: 'quiet',
          message: 'Zavorth Stay Online iniciou saudavel; sem notificacao por padrao.',
          compactLogLine: formatCompactLogLine(current, 'quiet'),
        };
      }
      return {
        shouldNotify: true,
        severity,
        reason: 'first-check',
        message: this.renderOperatorBriefing(current, 'first-check'),
        compactLogLine: formatCompactLogLine(current, 'first-check'),
      };
    }

    if (previous.status !== current.status || previous.remoteReady !== current.remoteReady) {
      return {
        shouldNotify: true,
        severity,
        reason: 'status-change',
        message: this.renderOperatorBriefing(current, 'status-change', previous),
        compactLogLine: formatCompactLogLine(current, 'status-change'),
      };
    }

    if (
      current.status !== 'ready'
      && activeAlert
      && (activeAlert.severity === 'critical' || input.notifyWarnings === true)
      && alertSignature(previous) !== alertSignature(current)
    ) {
      return {
        shouldNotify: true,
        severity,
        reason: 'active-alert',
        message: this.renderOperatorBriefing(current, 'active-alert', previous),
        compactLogLine: formatCompactLogLine(current, 'active-alert'),
      };
    }

    if (current.status === 'ready' && okEvery && current.heartbeat.sequence % okEvery === 0) {
      return {
        shouldNotify: true,
        severity: 'info',
        reason: 'periodic-ok',
        message: this.renderOperatorBriefing(current, 'periodic-ok', previous),
        compactLogLine: formatCompactLogLine(current, 'periodic-ok'),
      };
    }

    return {
      shouldNotify: false,
      severity: 'info',
      reason: 'quiet',
      message: 'Zavorth Stay Online sem mudanca relevante.',
      compactLogLine: formatCompactLogLine(current, 'quiet'),
    };
  }

  public renderCli(snapshot: ZavorthStayOnlineSnapshot): string {
    const lines = [
      'Zavorth Stay Online',
      snapshot.headline,
      '',
      `Status: ${snapshot.status}`,
      `Remoto: ${snapshot.remoteReady ? 'online' : 'com atencao'}`,
      `Heartbeat: #${snapshot.heartbeat.sequence} | proximo ${snapshot.heartbeat.nextCheckAt || 'n/a'}`,
      `Snapshot: ${snapshot.heartbeat.snapshotPath}`,
      '',
      'Checks',
      ...snapshot.checks.map((check) =>
        `- ${check.label}: ${check.status}. ${check.summary}${check.command ? ` | ${check.command}` : ''}`,
      ),
    ];
    if (snapshot.alerts.length > 0) {
      lines.push(
        '',
        'Alertas',
        ...snapshot.alerts.map((alert) =>
          `- ${alert.severity}: ${alert.message}${alert.command ? ` | ${alert.command}` : ''}`,
        ),
      );
    }
    lines.push(
      '',
      snapshot.status === 'ready'
        ? 'Veredito: continua tudo ok para uso remoto.'
        : snapshot.status === 'attention'
          ? 'Veredito: continua utilizavel, mas acompanhe os avisos.'
          : 'Veredito: nao confie no uso remoto ate resolver os bloqueios.',
      'Self-heal automatico nao executa acao alvo; ele propoe comandos seguros e mantem approvals no gateway.',
      '',
    );
    return `${lines.join('\n')}`;
  }

  public renderTelegram(snapshot: ZavorthStayOnlineSnapshot): string {
    return this.renderOperatorBriefing(snapshot, 'manual');
  }

  public renderOperatorBriefing(
    snapshot: ZavorthStayOnlineSnapshot,
    reason: ZavorthStayOnlineNotification['reason'] | 'manual',
    previous?: ZavorthStayOnlineSnapshot | null,
  ): string {
    const primaryAlert = snapshot.alerts.find((alert) => alert.severity === 'critical')
      || snapshot.alerts[0]
      || null;
    const nextCommand = primaryAlert?.command
      || (snapshot.status === 'ready' ? null : snapshot.actions.fixes);
    const transition = previous
      ? `Antes: ${previous.status}/${previous.remoteReady ? 'remoto online' : 'remoto off'}`
      : null;
    const impact = snapshot.status === 'ready'
      ? 'Pode usar remoto normalmente.'
      : snapshot.status === 'attention'
        ? 'Pode usar, mas acompanhe o aviso.'
        : 'Nao confie no uso remoto ate resolver.';
    const sections = [
      `Zavorth Stay Online - ${statusLine(snapshot).replace('Status: ', '')}`,
      snapshot.headline,
      transition,
      `Motivo: ${reasonLabel(reason)}`,
      '',
      `Impacto: ${impact}`,
      `Provider: ${snapshot.summary.providerLiveReady} live / ${snapshot.summary.providerLiveFailed} falha(s)`,
      `Keepalive: ${snapshot.summary.keepaliveOk ? 'ok' : snapshot.summary.keepaliveActive ? 'atencao' : 'ausente'}`,
      '',
      primaryAlert ? `Aviso: ${primaryAlert.message}` : 'Aviso: nenhuma acao necessaria.',
      `Proximo: ${nextCommand || 'continue usando.'}`,
    ].filter(Boolean);

    return sections.join('\n');
  }

  private buildChecks(input: {
    readyToGo: ZavorthReadyToGoSnapshot;
    keepalive: KeepaliveStatusSnapshot | null;
  }): ZavorthStayOnlineCheck[] {
    const readyToGo = input.readyToGo;
    const keepalive = input.keepalive;
    return [
      {
        id: 'ready-to-go',
        label: 'Ready To Go',
        status: readyToGo.remoteReady ? 'ready' : readyToGo.localReady ? 'attention' : 'blocked',
        required: true,
        summary: readyToGo.headline,
        nextAction: readyToGo.remoteReady ? 'Continuar monitorando.' : readyToGo.actions.fixes,
        command: readyToGo.remoteReady ? null : readyToGo.actions.fixes,
      },
      {
        id: 'runtime-process',
        label: 'Processo atual',
        status: 'ready',
        required: true,
        summary: `Monitor vivo neste processo (pid ${process.pid}).`,
        nextAction: 'Manter heartbeat recorrente.',
        command: 'zavorth stay-online --watch',
      },
      {
        id: 'dashboard',
        label: 'Dashboard',
        status: readyToGo.channels.dashboard === 'ready' ? 'ready' : 'blocked',
        required: true,
        summary: readyToGo.channels.dashboard === 'ready'
          ? 'Dashboard segue disponivel para controle local.'
          : 'Dashboard nao esta pronto.',
        nextAction: readyToGo.channels.dashboard === 'ready' ? 'Continuar monitorando.' : 'Reabrir dashboard.',
        command: readyToGo.channels.dashboard === 'ready' ? null : 'zavorth go',
      },
      {
        id: 'telegram',
        label: 'Telegram',
        status: readyToGo.channels.telegram === 'ready' ? 'ready' : 'attention',
        required: false,
        summary: readyToGo.channels.telegram === 'ready'
          ? 'Telegram pronto para avisos e approvals remotos.'
          : 'Telegram ainda precisa de configuracao ou doctor.',
        nextAction: readyToGo.channels.telegram === 'ready' ? 'Continuar monitorando.' : 'Rodar doctor do Telegram.',
        command: readyToGo.channels.telegram === 'ready' ? null : 'zavorth connectors doctor telegram',
      },
      {
        id: 'provider',
        label: 'Provider',
        status: readyToGo.summary.providerDefaultRoutes > 0 ? 'ready' : 'blocked',
        required: true,
        summary: `${readyToGo.summary.providerDefaultRoutes} rota(s) live pronta(s), ${readyToGo.summary.providerLiveFailed} falha(s).`,
        nextAction: readyToGo.summary.providerDefaultRoutes > 0 ? 'Continuar monitorando provider.' : 'Renovar prova live do provider.',
        command: readyToGo.summary.providerDefaultRoutes > 0 ? null : 'zavorth ready --refresh-providers',
      },
      {
        id: 'approvals',
        label: 'Approvals',
        status: readyToGo.channels.approvals === 'blocked' ? 'blocked' : readyToGo.channels.approvals,
        required: true,
        summary: readyToGo.channels.approvals === 'ready'
          ? 'Approvals seguem mediados pelo gateway.'
          : 'Approvals precisam de revisao.',
        nextAction: readyToGo.channels.approvals === 'ready' ? 'Continuar monitorando.' : 'Revisar approvals.',
        command: readyToGo.channels.approvals === 'ready' ? null : 'zavorth gateway approvals',
      },
      {
        id: 'keepalive',
        label: 'Keepalive supervisionado',
        status: keepalive?.ok === true ? 'ready' : 'attention',
        required: false,
        summary: keepalive
          ? `${keepalive.summary.ready}/${keepalive.summary.total} processo(s) ready${keepalive.stale ? ' | stale' : ''}.`
          : 'Snapshot de keepalive ainda nao existe.',
        nextAction: keepalive?.ok === true ? 'Continuar monitorando.' : 'Iniciar ou renovar keepalive supervisionado.',
        command: keepalive?.ok === true ? null : 'npm run ops:remote:keepalive',
      },
      {
        id: 'self-heal',
        label: 'Self-heal',
        status: 'ready',
        required: true,
        summary: 'Quedas viram alertas e comandos propostos; nenhuma acao alvo executa sem governanca.',
        nextAction: 'Usar comandos sugeridos quando houver alerta.',
        command: null,
      },
    ];
  }

  private writeSnapshot(snapshot: ZavorthStayOnlineSnapshot): void {
    this.mkdirSyncImpl(path.dirname(this.snapshotPath), { recursive: true });
    this.writeFileSyncImpl(this.snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  }
}

function projectReadyToGo(snapshot: ZavorthReadyToGoSnapshot): ZavorthStayOnlineSnapshot['readyToGo'] {
  return {
    status: snapshot.status,
    remoteReady: snapshot.remoteReady,
    localReady: snapshot.localReady,
    headline: snapshot.headline,
    summary: snapshot.summary,
    provider: snapshot.provider,
    channels: snapshot.channels,
    actions: snapshot.actions,
  };
}

function summarize(
  checks: ZavorthStayOnlineCheck[],
  readyToGo: ZavorthReadyToGoSnapshot,
  keepalive: KeepaliveStatusSnapshot | null,
): ZavorthStayOnlineSnapshot['summary'] {
  return {
    ready: checks.filter((check) => check.status === 'ready').length,
    attention: checks.filter((check) => check.status === 'attention').length,
    blocked: checks.filter((check) => check.status === 'blocked').length,
    requiredBlocked: checks.filter((check) => check.required && check.status === 'blocked').length,
    providerLiveReady: readyToGo.summary.providerLiveReady,
    providerLiveFailed: readyToGo.summary.providerLiveFailed,
    keepaliveActive: Boolean(keepalive),
    keepaliveOk: keepalive?.ok === true,
    keepaliveStale: keepalive?.stale === true,
  };
}

function resolveStatus(checks: ZavorthStayOnlineCheck[]): ZavorthStayOnlineStatus {
  if (checks.some((check) => check.required && check.status === 'blocked')) {
    return 'blocked';
  }
  if (checks.some((check) => check.status !== 'ready')) {
    return 'attention';
  }
  return 'ready';
}

function buildAlerts(checks: ZavorthStayOnlineCheck[]): ZavorthStayOnlineSnapshot['alerts'] {
  return checks
    .filter((check) => check.status !== 'ready')
    .map((check) => ({
      id: `alert-${check.id}`,
      severity: check.status === 'blocked' && check.required ? 'critical' as const : 'warning' as const,
      message: `${check.label}: ${check.summary}`,
      command: check.command,
    }));
}

function headlineFor(status: ZavorthStayOnlineStatus, remoteReady: boolean): string {
  if (status === 'ready' && remoteReady) return 'Tudo segue online para uso remoto.';
  if (status === 'attention' && remoteReady) return 'Zavorth segue online, com aviso operacional.';
  if (status === 'attention') return 'Zavorth segue parcialmente online; acompanhe os alertas.';
  return 'Zavorth perdeu uma garantia necessaria para uso remoto.';
}

function checkStatus(snapshot: ZavorthStayOnlineSnapshot, id: ZavorthStayOnlineCheckId): string {
  return snapshot.checks.find((check) => check.id === id)?.status || 'unknown';
}

function alertSignature(snapshot: ZavorthStayOnlineSnapshot): string {
  return snapshot.alerts
    .map((alert) => `${alert.id}:${alert.severity}:${alert.message}:${alert.command || ''}`)
    .join('|');
}

function statusLine(snapshot: ZavorthStayOnlineSnapshot): string {
  if (snapshot.status === 'ready') {
    return 'Status: PRONTO';
  }
  if (snapshot.status === 'attention') {
    return 'Status: ATENCAO';
  }
  return 'Status: BLOQUEADO';
}

function reasonLabel(reason: ZavorthStayOnlineNotification['reason'] | 'manual'): string {
  if (reason === 'first-check') return 'primeira checagem relevante';
  if (reason === 'status-change') return 'mudanca de estado';
  if (reason === 'active-alert') return 'novo alerta ativo';
  if (reason === 'periodic-ok') return 'confirmacao periodica solicitada';
  if (reason === 'manual') return 'consulta manual';
  return 'sem mudanca relevante';
}

function formatCompactLogLine(
  snapshot: ZavorthStayOnlineSnapshot,
  reason: ZavorthStayOnlineNotification['reason'],
): string {
  const alert = snapshot.alerts.find((entry) => entry.severity === 'critical') || snapshot.alerts[0] || null;
  const command = alert?.command ? ` next="${alert.command}"` : '';
  return [
    `status=${snapshot.status}`,
    `remote=${snapshot.remoteReady ? 'online' : 'attention'}`,
    `reason=${reason}`,
    `providers=${snapshot.summary.providerLiveReady}/${snapshot.summary.providerLiveReady + snapshot.summary.providerLiveFailed}`,
    `keepalive=${snapshot.summary.keepaliveOk ? 'ok' : snapshot.summary.keepaliveActive ? 'attention' : 'missing'}`,
    `alerts=${snapshot.alerts.length}`,
  ].join(' ') + command;
}

function positiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}


