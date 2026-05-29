import {
  ZAVORTH_ZAVORTH_CONTROL_PROVIDER_COCKPIT_CONTRACT_VERSION,
  type ZavorthControlProviderCockpitAction,
  type ZavorthControlProviderCockpitCard,
  type ZavorthControlProviderCockpitProjection,
  type ZavorthControlProviderCockpitStatus,
} from '../contracts/ZavorthControlProviderCockpitContract.js';
import type {
  ZavorthProviderReadinessEntry,
  ZavorthProviderReadinessMatrixSnapshot,
} from '../contracts/ZavorthProviderReadinessMatrixContract.js';
import {
  ZavorthProviderReadinessMatrixService,
  type ZavorthProviderReadinessMatrixInput,
} from './ZavorthProviderReadinessMatrixService.js';

export type ZavorthControlProviderCockpitInput = ZavorthProviderReadinessMatrixInput & {
  selectedProviderId?: string | null;
};

export type ZavorthControlProviderCockpitRuntime = {
  now?: () => Date;
  providerReadiness?: Pick<ZavorthProviderReadinessMatrixService, 'buildLiveSnapshot'>;
};

export class ZavorthControlProviderCockpitService {
  private readonly now: () => Date;
  private readonly providerReadiness: Pick<ZavorthProviderReadinessMatrixService, 'buildLiveSnapshot'>;

  constructor(runtime: ZavorthControlProviderCockpitRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.providerReadiness = runtime.providerReadiness || new ZavorthProviderReadinessMatrixService({
      now: this.now,
    });
  }

  public async buildProjection(
    input: ZavorthControlProviderCockpitInput = {},
  ): Promise<ZavorthControlProviderCockpitProjection> {
    const selectedProviderId = normalizeId(input.selectedProviderId || input.providerId);
    const matrix = await this.providerReadiness.buildLiveSnapshot({
      ...input,
      providerId: selectedProviderId || input.providerId,
    });
    const cards = matrix.entries.map((entry) => buildCard(entry));
    const actions = buildGlobalActions(matrix, selectedProviderId);
    const healthChecks = buildHealthChecks(matrix);
    const receipts = buildReceipts(matrix);
    const status = resolveProjectionStatus(matrix);

    return {
      contractVersion: ZAVORTH_ZAVORTH_CONTROL_PROVIDER_COCKPIT_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'zavorthControl-provider-cockpit',
      generatedAt: this.now().toISOString(),
      status,
      sourceMatrixContractVersion: matrix.contractVersion,
      visualMutationApplied: false,
      executionAuthority: false,
      selectedProviderId: selectedProviderId || null,
      summary: {
        totalProviders: matrix.summary.total,
        readyProviders: matrix.summary.ready,
        livePassed: matrix.summary.livePassed,
        liveFailed: matrix.summary.liveFailed,
        liveBlocked: matrix.summary.liveBlocked,
        missingAuth: matrix.summary.missingAuth,
        missingBaseUrl: matrix.summary.missingBaseUrl,
        needsProbe: matrix.summary.needsProbe,
      },
      cards,
      actions,
      healthChecks,
      receipts,
      zavorthControlProjection: {
        route: '/control',
        endpoint: '/api/providers/readiness',
        renderMode: 'projection-only',
        visualApprovalRequired: true,
        canRenderCardsAfterApproval: true,
      },
      safety: {
        noRawProviderSecrets: true,
        normalRenderMakesNoNetworkCalls: true,
        liveProbeRequiresExplicitOperatorAction: true,
        zavorthControlCannotExecuteProviderCalls: true,
      },
      nextAction: buildNextAction(matrix, selectedProviderId),
    };
  }

  public renderText(projection: ZavorthControlProviderCockpitProjection): string {
    return [
      '[provider-cockpit]',
      `status=${projection.status}`,
      `providers=${projection.summary.totalProviders} ready=${projection.summary.readyProviders} live_passed=${projection.summary.livePassed} live_failed=${projection.summary.liveFailed}`,
      `selected=${projection.selectedProviderId || 'none'}`,
      `visual_mutation=${projection.visualMutationApplied}`,
      `execution_authority=${projection.executionAuthority}`,
      '',
      '[cards]',
      ...projection.cards.map((card) =>
        `- ${card.providerId}: ${card.status}/${card.liveStatus} | model=${card.model || 'none'} | ${card.summary}`,
      ),
      '',
      '[actions]',
      ...projection.actions.map((action) =>
        `- ${action.id}: ${action.command} | risk=${action.risk} | zavorthControl_execute=${action.zavorthControlCanExecute}`,
      ),
      '',
      `next=${projection.nextAction}`,
      '',
    ].join('\n');
  }
}

function buildCard(entry: ZavorthProviderReadinessEntry): ZavorthControlProviderCockpitCard {
  return {
    id: `provider-card:${entry.id}`,
    providerId: entry.id,
    title: entry.label || entry.id,
    status: entry.status,
    liveStatus: entry.probe.status,
    priority: entry.status === 'ready'
      ? 'primary'
      : entry.status === 'blocked' || entry.status === 'missing_auth' || entry.status === 'missing_base_url'
        ? 'blocked'
        : 'normal',
    model: entry.currentModelName || null,
    summary: entry.probe.status === 'passed'
      ? entry.probe.summary
      : entry.userAction,
    evidence: {
      liveNetworkUsed: entry.probe.liveNetworkUsed,
      target: entry.probe.target,
      httpStatus: entry.probe.httpStatus,
      durationMs: entry.probe.durationMs,
      modelCount: entry.probe.modelCount,
      evidenceHash: entry.probe.evidenceHash,
    },
    actions: buildEntryActions(entry),
  };
}

function buildEntryActions(entry: ZavorthProviderReadinessEntry): ZavorthControlProviderCockpitAction[] {
  const actions: ZavorthControlProviderCockpitAction[] = [
    {
      id: `provider:${entry.id}:readiness`,
      label: 'View readiness',
      command: `zavorth providers --provider ${entry.id}`,
      kind: 'read',
      providerId: entry.id,
      risk: 'read',
      requiresApproval: false,
      zavorthControlCanExecute: false,
      summary: 'Read-only provider readiness projection.',
    },
    {
      id: `provider:${entry.id}:probe-packet`,
      label: 'Prepare probe',
      command: `zavorth providers test ${entry.id}`,
      kind: 'probe_packet',
      providerId: entry.id,
      risk: 'read',
      requiresApproval: false,
      zavorthControlCanExecute: false,
      summary: 'Prepare an explicit probe packet without live network.',
    },
  ];

  if (entry.status === 'ready' || entry.status === 'needs_probe') {
    actions.push({
      id: `provider:${entry.id}:live-probe`,
      label: 'Run live probe',
      command: `zavorth providers test ${entry.id} --live`,
      kind: 'live_probe',
      providerId: entry.id,
      risk: 'sensitive',
      requiresApproval: false,
      zavorthControlCanExecute: false,
      summary: 'Operator-triggered live provider probe; ZavorthControl only projects the action.',
    });
  } else {
    actions.push({
      id: `provider:${entry.id}:configure`,
      label: 'Configure',
      command: entry.userAction,
      kind: 'configure',
      providerId: entry.id,
      risk: 'read',
      requiresApproval: false,
      zavorthControlCanExecute: false,
      summary: 'Configuration guidance; no provider call is executed.',
    });
  }

  return actions;
}

function buildGlobalActions(
  matrix: ZavorthProviderReadinessMatrixSnapshot,
  selectedProviderId: string,
): ZavorthControlProviderCockpitAction[] {
  const target = selectedProviderId || matrix.entries.find((entry) => entry.status === 'ready')?.id || null;
  return [
    {
      id: 'providers:matrix',
      label: 'Provider matrix',
      command: 'zavorth providers',
      kind: 'read',
      providerId: null,
      risk: 'read',
      requiresApproval: false,
      zavorthControlCanExecute: false,
      summary: 'Read the provider matrix without live network.',
    },
    {
      id: 'providers:live-selected',
      label: 'Live probe selected',
      command: target ? `zavorth providers live --provider ${target}` : 'zavorth providers live --provider <provider>',
      kind: 'live_probe',
      providerId: target,
      risk: 'sensitive',
      requiresApproval: false,
      zavorthControlCanExecute: false,
      summary: 'Run live evidence for one provider from CLI/API, not from zavorthControl authority.',
    },
  ];
}

function buildHealthChecks(matrix: ZavorthProviderReadinessMatrixSnapshot): ZavorthControlProviderCockpitProjection['healthChecks'] {
  return [
    {
      id: 'provider-matrix-attached',
      label: 'Provider matrix attached',
      status: 'ready',
      detail: `Matrix ${matrix.contractVersion} attached with ${matrix.summary.total} provider route(s).`,
    },
    {
      id: 'live-evidence',
      label: 'Live evidence',
      status: matrix.summary.liveFailed > 0
        ? 'attention'
        : matrix.summary.livePassed > 0
          ? 'ready'
          : 'attention',
      detail: matrix.summary.livePassed > 0
        ? `${matrix.summary.livePassed} provider probe(s) passed.`
        : 'No live provider evidence has been recorded in this projection.',
    },
    {
      id: 'zavorthControl-authority',
      label: 'ZavorthControl authority',
      status: 'ready',
      detail: 'ZavorthControl projection is read-only and cannot execute provider calls.',
    },
  ];
}

function buildReceipts(matrix: ZavorthProviderReadinessMatrixSnapshot): ZavorthControlProviderCockpitProjection['receipts'] {
  const receipts: ZavorthControlProviderCockpitProjection['receipts'] = [
    {
      id: `provider-matrix:${matrix.generatedAt}`,
      kind: 'matrix',
      status: 'recorded',
      providerId: null,
      detail: `Readiness matrix recorded: ${matrix.summary.ready}/${matrix.summary.total} ready.`,
      evidenceHash: null,
    },
    {
      id: `provider-safety:${matrix.generatedAt}`,
      kind: 'safety',
      status: 'recorded',
      providerId: null,
      detail: 'No raw provider secrets are serialized; zavorthControl execution authority is disabled.',
      evidenceHash: null,
    },
  ];
  for (const entry of matrix.entries) {
    if (entry.probe.evidenceHash || entry.probe.status === 'blocked') {
      receipts.push({
        id: `provider-live:${entry.id}:${entry.probe.evidenceHash || entry.probe.status}`,
        kind: 'live-evidence',
        status: entry.probe.status === 'blocked' ? 'blocked' : entry.probe.evidenceHash ? 'recorded' : 'not-run',
        providerId: entry.id,
        detail: entry.probe.summary,
        evidenceHash: entry.probe.evidenceHash,
      });
    }
  }
  return receipts;
}

function resolveProjectionStatus(matrix: ZavorthProviderReadinessMatrixSnapshot): ZavorthControlProviderCockpitStatus {
  if (matrix.status === 'blocked' || matrix.summary.blocked > 0) return 'blocked';
  if (matrix.summary.liveFailed > 0 || matrix.summary.ready === 0) return 'attention';
  return 'ready';
}

function buildNextAction(matrix: ZavorthProviderReadinessMatrixSnapshot, selectedProviderId: string): string {
  if (matrix.summary.liveFailed > 0) return 'Review failed provider evidence before selecting this provider.';
  if (matrix.summary.livePassed > 0) return 'Provider live evidence is available for ZavorthControl projection.';
  if (selectedProviderId) return `Run zavorth providers live --provider ${selectedProviderId} for live evidence.`;
  return 'Approve a visual block before rendering provider cockpit cards in /control.';
}

function normalizeId(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}
