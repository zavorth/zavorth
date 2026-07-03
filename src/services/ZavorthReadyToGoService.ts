import { ZavorthProviderLiveProofStoreService } from './ZavorthProviderLiveProofStoreService.js';
import { ZavorthProviderReadinessMatrixService } from './ZavorthProviderReadinessMatrixService.js';
import { ZavorthRuntimeGuidedFixesService, type ZavorthRuntimeGuidedFix } from './ZavorthRuntimeGuidedFixesService.js';
import { ZavorthRuntimeReadinessService, type ZavorthRuntimeReadinessSnapshot, type ZavorthRuntimeReadinessStatus } from './ZavorthRuntimeReadinessService.js';
import type { ZavorthProviderReadinessEntry, ZavorthProviderReadinessMatrixSnapshot } from '../contracts/ZavorthProviderReadinessMatrixContract.js';
import { renderCliScreen, type CliVisualPanel } from '../cli/ZavorthCliVisualSystem.js';
import { paintCliTone } from '../cli/ZavorthCliVisualTheme.js';

export const ZAVORTH_READY_TO_GO_CONTRACT_VERSION = 'zavorth-ready-to-go/1' as const;

export type ZavorthReadyToGoStatus = 'ready' | 'attention' | 'blocked';

export type ZavorthReadyToGoInput = {
  refreshProviders?: boolean;
  includeAdvancedProviders?: boolean;
  userId?: string | null;
  sessionId?: string | null;
  workspaceHint?: string | null;
};

export type ZavorthReadyToGoProviderLane = {
  id: string;
  label: string;
  role: 'active' | 'fallback';
  status: 'ready' | 'attention' | 'blocked';
  liveReady: boolean;
  defaultRouteAllowed: boolean;
  proof: string;
  model: string | null;
  summary: string;
};

export type ZavorthReadyToGoSnapshot = {
  contractVersion: typeof ZAVORTH_READY_TO_GO_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'zavorth-ready-to-go';
  generatedAt: string;
  status: ZavorthReadyToGoStatus;
  remoteReady: boolean;
  localReady: boolean;
  headline: string;
  summary: {
    runtimeStatus: ZavorthRuntimeReadinessStatus;
    runtimeReady: boolean;
    providerReady: boolean;
    providerDefaultRoutes: number;
    providerLiveReady: number;
    providerLiveFailed: number;
    telegramReady: boolean;
    zavorthControlReady: boolean;
    approvalsReady: boolean;
    blockingFixes: number;
    attentionFixes: number;
  };
  provider: {
    refreshRequested: boolean;
    liveNetworkUsed: boolean;
    activeProvider: string;
    activeModel: string;
    lanes: ZavorthReadyToGoProviderLane[];
    failed: ZavorthReadyToGoProviderLane[];
    missingConfiguredProof: ZavorthReadyToGoProviderLane[];
  };
  channels: {
    zavorthControl: 'ready' | 'blocked';
    telegram: 'ready' | 'attention';
    approvals: 'ready' | 'attention' | 'blocked';
  };
  actions: {
    primary: string;
    zavorthControl: '/zavorthControl';
    telegram: '/readiness';
    fixes: 'zavorth readiness fixes';
    refreshProviders: 'zavorth ready --refresh-providers';
    offline: 'zavorth ready --offline';
  };
  guidedFixes: ZavorthRuntimeGuidedFix[];
  safety: {
    noPromptExecution: true;
    noToolExecution: true;
    noLiveTransactionExecution: true;
    noRawSecretsSerialized: true;
    providerProbeIsExplicitOperatorAction: true;
    approvalsRemainGatewayMediated: true;
  };
  source: {
    readinessGeneratedAt: string;
    providerGeneratedAt: string;
  };
};

type RuntimeReadinessLike = Pick<ZavorthRuntimeReadinessService, 'buildSnapshot'>;
type ProviderReadinessLike = Pick<ZavorthProviderReadinessMatrixService, 'buildSnapshot' | 'buildLiveSnapshot'>;
type GuidedFixesLike = Pick<ZavorthRuntimeGuidedFixesService, 'buildSnapshot'>;

export type ZavorthReadyToGoRuntime = {
  now?: () => Date;
  runtimeReadiness?: RuntimeReadinessLike;
  providerReadiness?: ProviderReadinessLike;
  guidedFixes?: GuidedFixesLike;
};

export class ZavorthReadyToGoService {
  private readonly now: () => Date;
  private readonly runtimeReadiness: RuntimeReadinessLike;
  private readonly providerReadiness: ProviderReadinessLike;
  private readonly guidedFixes: GuidedFixesLike;

  public constructor(runtime: ZavorthReadyToGoRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.runtimeReadiness = runtime.runtimeReadiness || new ZavorthRuntimeReadinessService({ now: this.now });
    this.providerReadiness = runtime.providerReadiness || new ZavorthProviderReadinessMatrixService({
      now: this.now,
      liveProofStore: new ZavorthProviderLiveProofStoreService({ now: this.now }),
    });
    this.guidedFixes = runtime.guidedFixes || new ZavorthRuntimeGuidedFixesService();
  }

  public async buildSnapshot(input: ZavorthReadyToGoInput = {}): Promise<ZavorthReadyToGoSnapshot> {
    const refreshProviders = input.refreshProviders !== false;
    const provider = refreshProviders
      ? await this.providerReadiness.buildLiveSnapshot({
        includeAdvanced: input.includeAdvancedProviders === true,
        live: true,
        probe: true,
        allowAllLive: true,
      })
      : this.providerReadiness.buildSnapshot({
        includeAdvanced: input.includeAdvancedProviders === true,
        probe: false,
      });
    const readiness = await this.runtimeReadiness.buildSnapshot({
      userId: input.userId || 'operator',
      sessionId: input.sessionId || 'ready-to-go',
      workspaceHint: input.workspaceHint || process.cwd(),
    });
    const fixes = this.guidedFixes.buildSnapshot(readiness).fixes.filter((fix) => fix.status !== 'ready');
    const providerLanes = buildProviderLanes(provider);
    const failed = providerLanes.filter((lane) => lane.status === 'blocked' || lane.summary.toLowerCase().includes('failed'));
    const missingConfiguredProof = providerLanes.filter((lane) => lane.status === 'attention' && !lane.liveReady);
    const telegramReady = readiness.checks.find((check) => check.id === 'telegram')?.status === 'ready';
    const zavorthControlReady = readiness.checks.find((check) => check.id === 'zavorthControl')?.status === 'ready';
    const approvalsReady = readiness.checks.find((check) => check.id === 'approvals')?.status !== 'blocked';
    const providerReady = provider.summary.defaultRouteAllowed > 0;
    const runtimeReady = readiness.status !== 'blocked' && readiness.dailyUseReady === true;
    const localReady = runtimeReady && providerReady && zavorthControlReady && approvalsReady;
    const remoteReady = localReady && telegramReady;
    const status = readiness.status === 'blocked' || !localReady
      ? 'blocked'
      : remoteReady
        ? 'ready'
        : 'attention';

    return {
      contractVersion: ZAVORTH_READY_TO_GO_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'zavorth-ready-to-go',
      generatedAt: this.now().toISOString(),
      status,
      remoteReady,
      localReady,
      headline: headlineFor(status, remoteReady, localReady),
      summary: {
        runtimeStatus: readiness.status,
        runtimeReady,
        providerReady,
        providerDefaultRoutes: provider.summary.defaultRouteAllowed,
        providerLiveReady: provider.summary.liveReady,
        providerLiveFailed: provider.summary.liveFailed,
        telegramReady,
        zavorthControlReady,
        approvalsReady,
        blockingFixes: fixes.filter((fix) => fix.status === 'blocked').length,
        attentionFixes: fixes.filter((fix) => fix.status === 'attention').length,
      },
      provider: {
        refreshRequested: refreshProviders,
        liveNetworkUsed: refreshProviders,
        activeProvider: provider.activeProvider,
        activeModel: provider.activeModel,
        lanes: providerLanes,
        failed,
        missingConfiguredProof,
      },
      channels: {
        zavorthControl: zavorthControlReady ? 'ready' : 'blocked',
        telegram: telegramReady ? 'ready' : 'attention',
        approvals: approvalsReady
          ? readiness.checks.find((check) => check.id === 'approvals')?.status === 'attention'
            ? 'attention'
            : 'ready'
          : 'blocked',
      },
      actions: {
        primary: status === 'ready'
          ? 'Remote use is ready now.'
          : status === 'attention'
            ? 'Local use is ready; review warnings before relying on remote use.'
            : 'Do not rely on remote use yet; resolve blockers first.',
        zavorthControl: '/zavorthControl',
        telegram: '/readiness',
        fixes: 'zavorth readiness fixes',
        refreshProviders: 'zavorth ready --refresh-providers',
        offline: 'zavorth ready --offline',
      },
      guidedFixes: fixes,
      safety: {
        noPromptExecution: true,
        noToolExecution: true,
        noLiveTransactionExecution: true,
        noRawSecretsSerialized: true,
        providerProbeIsExplicitOperatorAction: true,
        approvalsRemainGatewayMediated: true,
      },
      source: {
        readinessGeneratedAt: readiness.generatedAt,
        providerGeneratedAt: provider.generatedAt,
      },
    };
  }

  public renderCli(snapshot: ZavorthReadyToGoSnapshot): string {
    const providerLines = snapshot.provider.lanes.slice(0, 8).map((lane) =>
      `${lane.role === 'active' ? 'Primary' : 'Fallback'} ${lane.id}: ${labelForLane(lane)}${lane.model ? ` (${lane.model})` : ''}`,
    );
    const issueLines = [
      ...snapshot.provider.failed.map((lane) => `- Provider ${lane.id}: ${lane.summary}`),
      ...snapshot.guidedFixes.slice(0, 4).map((fix) => `- ${fix.label}: ${fix.command || fix.route || fix.summary}`),
    ];
    const panels: CliVisualPanel[] = [
      {
        title: 'Readiness',
        tone: snapshot.status === 'ready' ? 'success' : snapshot.status === 'blocked' ? 'danger' : 'warning',
        lines: [
          `remote: ${snapshot.remoteReady ? 'ready' : 'needs attention'}`,
          `local: ${snapshot.localReady ? 'ready' : 'blocked'}`,
          `provider routes: ${snapshot.summary.providerDefaultRoutes} live-ready`,
          `telegram: ${snapshot.channels.telegram}`,
          `zavorthControl: ${snapshot.channels.zavorthControl}`,
          `approvals: ${snapshot.channels.approvals}`,
        ],
      },
      {
        title: 'Providers',
        tone: 'info',
        lines: providerLines.length > 0 ? providerLines : ['No ready provider found.'],
      },
      ...(issueLines.length > 0
        ? [{
            title: 'Warnings',
            tone: 'warning' as const,
            lines: issueLines,
          }]
        : []),
      {
        title: 'Next',
        tone: 'brand',
        lines: [
          `${paintCliTone('>', 'brand')} ${snapshot.actions.primary}`,
      snapshot.provider.refreshRequested
            ? 'Provider probes were explicit operator checks; no prompt, tool or transaction was executed.'
            : 'Offline mode: no live provider call was executed.',
        ],
      },
    ];
    return renderCliScreen({
      eyebrow: 'Zavorth CLI',
      title: 'Zavorth Ready',
      summary: snapshot.headline,
      panels,
      mode: 'compact',
    });
  }

  public renderTelegram(snapshot: ZavorthReadyToGoSnapshot): string {
    return [
      'Zavorth Ready To Go',
      snapshot.headline,
      '',
      `Remoto: ${snapshot.remoteReady ? 'pronto' : 'com atencao'}`,
      `Provider: ${snapshot.summary.providerDefaultRoutes} rota(s) live`,
      `Telegram: ${snapshot.channels.telegram}`,
      `Approvals: ${snapshot.channels.approvals}`,
      '',
      snapshot.provider.lanes.slice(0, 4).map((lane) => `${lane.id}: ${labelForLane(lane)}`).join('\n'),
      '',
      snapshot.actions.primary,
    ].join('\n');
  }
}

function buildProviderLanes(snapshot: ZavorthProviderReadinessMatrixSnapshot): ZavorthReadyToGoProviderLane[] {
  const active = normalizeId(snapshot.activeProvider);
  return snapshot.entries
    .filter((entry) => entry.status === 'ready' || entry.probe.status === 'failed' || entry.liveReady)
    .filter((entry) => entry.status === 'ready' || entry.liveReady || entry.probe.status === 'failed')
    .map((entry) => providerLane(entry, routeEntryKeys(entry).includes(active) ? 'active' : 'fallback'))
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === 'active' ? -1 : 1;
      return Number(b.defaultRouteAllowed) - Number(a.defaultRouteAllowed) || a.id.localeCompare(b.id);
    });
}

function providerLane(entry: ZavorthProviderReadinessEntry, role: 'active' | 'fallback'): ZavorthReadyToGoProviderLane {
  const failed = entry.probe.status === 'failed';
  const status: ZavorthReadyToGoProviderLane['status'] = failed
    ? 'blocked'
    : entry.defaultRouteAllowed
      ? 'ready'
      : 'attention';
  return {
    id: entry.id,
    label: entry.label,
    role,
    status,
    liveReady: entry.liveReady,
    defaultRouteAllowed: entry.defaultRouteAllowed,
    proof: entry.readinessProof,
    model: entry.currentModelName,
    summary: failed
      ? entry.probe.summary
      : entry.defaultRouteAllowed
        ? 'Live proof ok.'
        : entry.defaultBlockReason || entry.userAction,
  };
}

function routeEntryKeys(entry: ZavorthProviderReadinessEntry): string[] {
  return [entry.id, entry.providerId, entry.providerName, ...entry.familyIds].map(normalizeId).filter(Boolean);
}

function normalizeId(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function headlineFor(status: ZavorthReadyToGoStatus, remoteReady: boolean, localReady: boolean): string {
  if (status === 'ready' && remoteReady) return 'Zavorth is ready for remote and local use.';
  if (localReady) return 'Zavorth is ready locally, with attention still needed for remote use.';
  return 'Zavorth is not ready to rely on away from this PC yet.';
}

function labelForLane(lane: ZavorthReadyToGoProviderLane): string {
  if (lane.status === 'ready') return 'ok';
  if (lane.status === 'blocked') return 'failed';
  return 'needs live proof';
}
