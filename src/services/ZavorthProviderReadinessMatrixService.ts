import crypto from 'crypto';
import http from 'http';
import https from 'https';
import { config } from '../config/index.js';
import {
  ZAVORTH_PROVIDER_READINESS_MATRIX_CONTRACT_VERSION,
  type ZavorthProviderLiveProbeMode,
  type ZavorthProviderProbeStatus,
  type ZavorthProviderReadinessProof,
  type ZavorthProviderReadinessEntry,
  type ZavorthProviderReadinessMatrixSnapshot,
  type ZavorthProviderReadinessStatus,
} from '../contracts/ZavorthProviderReadinessMatrixContract.js';
import type { AccessRouteCatalogEntry } from '../contracts/ModelPickerContract.js';
import {
  ProviderControlPlaneService,
  type ProviderProfile,
} from './ProviderControlPlaneService.js';

type ProviderControlPlaneLike = Pick<
  ProviderControlPlaneService,
  'resolveAccessRoutes' | 'listProfiles' | 'getCurrentConversationalProvider' | 'getCurrentConversationalModel'
>;

export type ZavorthProviderReadinessMatrixInput = {
  includeAdvanced?: boolean;
  providerId?: string | null;
  probe?: boolean;
  live?: boolean;
  allowAllLive?: boolean;
  blockedProviderIds?: string[] | null;
};

export type ZavorthProviderReadinessMatrixRuntime = {
  now?: () => Date;
  providerControlPlane?: ProviderControlPlaneLike;
  fetch?: typeof fetch | null;
};

type ProviderLiveProbeResult = {
  status: ZavorthProviderProbeStatus;
  mode: ZavorthProviderLiveProbeMode;
  liveNetworkUsed: boolean;
  requestedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  target: string | null;
  httpStatus: number | null;
  modelCount: number | null;
  evidenceHash: string | null;
  summary: string;
};

type ProviderProbeConfig = {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: unknown;
  parseModelCount: (data: unknown) => number | null;
};

type ProviderHttpProbeResponse = {
  ok: boolean;
  status: number;
  text: string;
};

export class ZavorthProviderReadinessMatrixService {
  private readonly now: () => Date;
  private readonly providerControlPlane: ProviderControlPlaneLike;
  private readonly fetchImpl: typeof fetch | null;

  constructor(runtime: ZavorthProviderReadinessMatrixRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.providerControlPlane = runtime.providerControlPlane || new ProviderControlPlaneService();
    this.fetchImpl = runtime.fetch || null;
  }

  public buildSnapshot(input: ZavorthProviderReadinessMatrixInput = {}): ZavorthProviderReadinessMatrixSnapshot {
    const generatedAt = this.now().toISOString();
    const blocked = new Set((input.blockedProviderIds || []).map(normalizeId));
    const routes = this.providerControlPlane.resolveAccessRoutes({
      includeAdvanced: input.includeAdvanced === true,
      generatedAt,
    }).routes;
    const selectedProviderId = normalizeId(input.providerId);
    const entries = routes
      .filter((route) => !selectedProviderId || routeKeys(route).includes(selectedProviderId))
      .map((route) => this.toEntry(route, {
        probe: input.probe === true,
        blocked: routeKeys(route).some((key) => blocked.has(key)),
      }));
    const summary = summarize(entries);
    const status = summary.blocked > 0
      ? 'blocked'
      : summary.ready > 0
        ? 'ready'
        : 'attention';

    return {
      contractVersion: ZAVORTH_PROVIDER_READINESS_MATRIX_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'provider-readiness-matrix',
      generatedAt,
      status,
      activeProvider: this.providerControlPlane.getCurrentConversationalProvider(),
      activeModel: this.providerControlPlane.getCurrentConversationalModel(),
      summary,
      entries,
      profiles: this.providerControlPlane.listProfiles().map(copyProfile),
      simpleCatalog: {
        fastAndCheap: pickReadyOrKnown(entries, ['gemini', 'groq', 'mistral', 'deepseek', 'openrouter']),
        higherIntelligence: pickReadyOrKnown(entries, ['openai', 'anthropic', 'gemini', 'xai', 'openrouter']),
        localPrivate: pickReadyOrKnown(entries, ['ollama', 'lmstudio', 'vllm', 'aigateway', 'custom-openai-compatible']),
        openAiCompatible: pickReadyOrKnown(entries, ['openai', 'openrouter', 'azure-openai', 'aigateway', 'custom-openai-compatible', 'litellm']),
      },
      liveCompletion: buildLiveCompletion(summary),
      commands: [
        {
          id: 'providers',
          command: 'zavorth providers',
          summary: 'Show provider readiness matrix.',
          liveNetworkUsedByDefault: false,
        },
        {
          id: 'providers-json',
          command: 'zavorth providers --json',
          summary: 'Show provider readiness matrix as JSON.',
          liveNetworkUsedByDefault: false,
        },
        {
          id: 'providers-test',
          command: 'zavorth providers test <provider>',
          summary: 'Prepare a provider probe packet without sending secrets or making hidden live calls.',
          liveNetworkUsedByDefault: false,
        },
        {
          id: 'providers-test-live',
          command: 'zavorth providers test <provider> --live',
          summary: 'Run an explicit live provider probe and return sanitized evidence.',
          liveNetworkUsedByDefault: true,
        },
        {
          id: 'providers-live-matrix',
          command: 'zavorth providers live --provider <provider>',
          summary: 'Build a live provider matrix for a selected provider.',
          liveNetworkUsedByDefault: true,
        },
      ],
      commandCenterProjection: {
        route: '/dashboard',
        endpoint: '/api/providers/readiness',
        executionAuthority: false,
        canRenderTestButtons: true,
      },
      invariants: [
        {
          id: 'catalog-is-not-live-proof',
          status: 'passed',
          detail: 'Provider entries distinguish catalog readiness from live probe evidence.',
        },
        {
          id: 'no-secret-values',
          status: 'passed',
          detail: 'Readiness matrix exposes credential refs and status only, never raw provider secrets.',
        },
        {
          id: 'probe-is-explicit',
          status: 'passed',
          detail: 'Connection testing is represented as an explicit operator action and is not hidden in normal rendering.',
        },
        {
          id: 'command-center-no-authority',
          status: 'passed',
          detail: 'Command Center may render readiness and test buttons but cannot execute provider calls by itself.',
        },
      ],
      nextAction: buildNextAction(summary, entries),
    };
  }

  public async buildLiveSnapshot(input: ZavorthProviderReadinessMatrixInput = {}): Promise<ZavorthProviderReadinessMatrixSnapshot> {
    const shouldRunLive = input.live === true;
    const selectedProviderId = normalizeId(input.providerId);
    const base = this.buildSnapshot({
      ...input,
      probe: true,
      live: false,
    });
    const liveResults = new Map<string, ProviderLiveProbeResult>();
    const liveCandidates = base.entries.filter((entry) => {
      if (!shouldRunLive) return false;
      if (selectedProviderId) return routeEntryKeys(entry).includes(selectedProviderId);
      return input.allowAllLive === true && entry.status === 'ready';
    });

    for (const entry of liveCandidates) {
      liveResults.set(entry.id, await this.runLiveProbe(entry));
    }

    const entries = base.entries.map((entry) => {
      const result = liveResults.get(entry.id);
      if (!result) return entry;
      return completeEntry({
        ...entry,
        probe: {
          ...entry.probe,
          ...result,
        },
      });
    });
    const summary = summarize(entries);
    return {
      ...base,
      status: summary.liveFailed > 0 ? 'attention' : base.status,
      summary,
      entries,
      nextAction: buildLiveNextAction(summary, entries, {
        liveRequested: shouldRunLive,
        selectedProviderId,
      }),
    };
  }

  public renderText(snapshot: ZavorthProviderReadinessMatrixSnapshot): string {
    const lines = [
      '[provider-readiness]',
      `status=${snapshot.status}`,
      `active=${snapshot.activeProvider}/${snapshot.activeModel}`,
      `ready=${snapshot.summary.ready} live_passed=${snapshot.summary.livePassed} live_failed=${snapshot.summary.liveFailed} live_blocked=${snapshot.summary.liveBlocked} live_not_run=${snapshot.summary.liveNotRun}`,
      `live_ready=${snapshot.summary.liveReady} catalog_ready_not_live=${snapshot.summary.catalogReadyButNotLive} default_allowed=${snapshot.summary.defaultRouteAllowed}`,
      `missing_auth=${snapshot.summary.missingAuth} missing_base_url=${snapshot.summary.missingBaseUrl} needs_probe=${snapshot.summary.needsProbe} degraded=${snapshot.summary.degraded} unsupported=${snapshot.summary.unsupported} blocked=${snapshot.summary.blocked}`,
      '',
      '[providers]',
      ...snapshot.entries.map((entry) =>
        `- ${entry.id}: ${entry.status} | proof=${entry.readinessProof} | live_ready=${entry.liveReady ? 'yes' : 'no'} | default=${entry.defaultRouteAllowed ? 'allowed' : 'blocked'} | live=${entry.probe.status} | model=${entry.currentModelName || 'none'} | test="${entry.testCommand}" | ${entry.defaultBlockReason || entry.userAction}`,
      ),
      '',
      '[simple catalog]',
      `fast_and_cheap=${snapshot.simpleCatalog.fastAndCheap.join(', ') || 'none'}`,
      `higher_intelligence=${snapshot.simpleCatalog.higherIntelligence.join(', ') || 'none'}`,
      `local_private=${snapshot.simpleCatalog.localPrivate.join(', ') || 'none'}`,
      `openai_compatible=${snapshot.simpleCatalog.openAiCompatible.join(', ') || 'none'}`,
      '',
      `next=${snapshot.nextAction}`,
      '',
    ];
    return lines.join('\n');
  }

  private toEntry(route: AccessRouteCatalogEntry, input: { probe: boolean; blocked: boolean }): ZavorthProviderReadinessEntry {
    const status = input.blocked ? 'blocked' : normalizeStatus(route);
    const probeStatus = resolveProbeStatus(route, status, input.probe);
    const id = normalizeEntryId(route);
    return completeEntry({
      id,
      label: route.label,
      providerName: route.providerName,
      providerId: route.providerId,
      familyIds: [...route.familyIds],
      routeKind: route.routeKind,
      routeClass: route.routeClass || 'unknown',
      mode: route.mode,
      credentialKind: route.credentialKind,
      credentialRefs: [...route.credentialRefs],
      requirements: [...route.requirements],
      currentModelName: route.currentModelName,
      capabilities: [...route.capabilities],
      status,
      catalogReady: route.ready,
      authConfigured: route.authConfigured === true,
      baseUrlConfigured: route.baseUrlConfigured !== false,
      discoverySupported: route.discoverySupported === true,
      health: route.health || null,
      issue: route.issue,
      explanation: route.explanation || [],
      userAction: userAction(route, status),
      testCommand: `zavorth providers test ${id}`,
      probe: {
        status: probeStatus,
        mode: 'catalog_only',
        liveNetworkUsed: false,
        requestedAt: null,
        completedAt: null,
        durationMs: null,
        target: null,
        httpStatus: null,
        modelCount: null,
        evidenceHash: null,
        summary: probeSummary(probeStatus, route, status),
      },
      rawSecretsPresent: false,
    });
  }

  private async runLiveProbe(entry: ZavorthProviderReadinessEntry): Promise<ProviderLiveProbeResult> {
    const requestedAt = this.now().toISOString();
    const startedAt = Date.now();
    const blocked = this.liveProbeBlocker(entry);
    if (blocked) {
      return liveProbeResult({
        status: 'blocked',
        requestedAt,
        completedAt: this.now().toISOString(),
        durationMs: Date.now() - startedAt,
        summary: blocked,
        evidenceHash: hashEvidence({ providerId: entry.id, blocked }),
      });
    }

    const probe = this.resolveProbeConfig(entry);
    if (!probe) {
      return liveProbeResult({
        status: 'blocked',
        requestedAt,
        completedAt: this.now().toISOString(),
        durationMs: Date.now() - startedAt,
        summary: 'No safe live probe adapter exists for this provider yet.',
        evidenceHash: hashEvidence({ providerId: entry.id, noProbeConfig: true }),
      });
    }

    try {
      const response = this.fetchImpl
        ? await fetchProbe(this.fetchImpl, probe)
        : await nativeHttpProbe(probe);
      const parsed = parseJson(response.text);
      const modelCount = response.ok && parsed ? probe.parseModelCount(parsed) : null;
      const status: ZavorthProviderProbeStatus = response.ok ? 'passed' : 'failed';
      const target = sanitizeProbeTarget(probe.url);
      return liveProbeResult({
        status,
        liveNetworkUsed: true,
        requestedAt,
        completedAt: this.now().toISOString(),
        durationMs: Date.now() - startedAt,
        target,
        httpStatus: response.status,
        modelCount,
        evidenceHash: hashEvidence({
          providerId: entry.id,
          status,
          httpStatus: response.status,
          ok: response.ok,
          modelCount,
          target,
          bodyShape: parsed ? Object.keys(parsed as Record<string, unknown>).sort() : ['non-json'],
        }),
        summary: response.ok
          ? `Live probe passed${typeof modelCount === 'number' ? ` and listed ${modelCount} model(s)` : ''}.`
          : `Live probe failed with HTTP ${response.status}.`,
      });
    } catch (error) {
      const target = sanitizeProbeTarget(probe.url);
      return liveProbeResult({
        status: 'failed',
        liveNetworkUsed: true,
        requestedAt,
        completedAt: this.now().toISOString(),
        durationMs: Date.now() - startedAt,
        target,
        evidenceHash: hashEvidence({
          providerId: entry.id,
          status: 'failed',
          target,
          errorName: error instanceof Error ? error.name : 'UnknownError',
        }),
        summary: `Live probe failed: ${error instanceof Error ? error.name : 'UnknownError'}.`,
      });
    }
  }

  private liveProbeBlocker(entry: ZavorthProviderReadinessEntry): string | null {
    if (entry.status === 'blocked') return 'Provider is blocked by policy or operator configuration.';
    if (entry.status === 'unsupported') return 'Provider is unsupported on this host.';
    if (entry.status === 'missing_auth') return 'Provider live probe is blocked until credentials are configured.';
    if (entry.status === 'missing_base_url') return 'Provider live probe is blocked until base URL is configured.';
    if (entry.credentialRefs.some((ref) => looksLikeRawSecret(ref))) {
      return 'Provider credential reference looked like a raw secret and was refused.';
    }
    return null;
  }

  private resolveProbeConfig(entry: ZavorthProviderReadinessEntry): ProviderProbeConfig | null {
    const keys = new Set([entry.id, entry.providerId, entry.providerName, ...entry.familyIds].map(normalizeId));
    if (keys.has('gemini')) {
      const key = resolveSecretRef('GEMINI_API_KEY');
      if (!key) return null;
      return probeConfig(
        `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${encodeURIComponent(key)}`,
        'GET',
        {},
        countModelsField('models'),
      );
    }
    if (keys.has('anthropic') || keys.has('claude')) {
      const key = resolveSecretRef('ANTHROPIC_API_KEY') || resolveSecretRef('CLAUDE_API_KEY');
      if (!key) return null;
      return probeConfig('https://api.anthropic.com/v1/models', 'GET', {
        'Anthropic-Version': '2023-06-01',
        'x-api-key': key,
      }, countModelsField('data'));
    }
    return resolveOpenAiCompatibleProbe(keys);
  }
}

function normalizeStatus(route: AccessRouteCatalogEntry): ZavorthProviderReadinessStatus {
  if (route.health?.status === 'unhealthy' || route.readinessCode === 'unhealthy') return 'degraded';
  if (route.readinessCode === 'ready') return 'ready';
  if (route.readinessCode === 'missing_auth') return 'missing_auth';
  if (route.readinessCode === 'missing_base_url') return 'missing_base_url';
  if (route.readinessCode === 'needs_probe') return 'needs_probe';
  if (route.readinessCode === 'unsupported') return 'unsupported';
  if (route.readiness === 'ready') return 'ready';
  if (route.readiness === 'needs_probe') return 'needs_probe';
  return route.baseUrlConfigured === false ? 'missing_base_url' : 'missing_auth';
}

function resolveProbeStatus(
  route: AccessRouteCatalogEntry,
  status: ZavorthProviderReadinessStatus,
  probe: boolean,
): ZavorthProviderProbeStatus {
  if (status === 'blocked' || status === 'unsupported') return 'blocked';
  if (status === 'missing_auth' || status === 'missing_base_url') return 'blocked';
  if (route.health?.status === 'healthy') return 'passed';
  if (route.health?.status === 'unhealthy') return 'failed';
  if (!probe) return status === 'ready' || status === 'needs_probe' || status === 'degraded' ? 'ready_to_probe' : 'not_run';
  return 'ready_to_probe';
}

function probeSummary(
  status: ZavorthProviderProbeStatus,
  route: AccessRouteCatalogEntry,
  readiness: ZavorthProviderReadinessStatus,
): string {
  if (status === 'passed') return 'Existing health evidence says this provider is reachable.';
  if (status === 'failed') return route.health?.message || 'Existing health evidence says this provider is degraded.';
  if (status === 'blocked') return `Probe blocked until provider status is fixed: ${readiness}.`;
  if (status === 'ready_to_probe') return 'Ready for an explicit live probe command; no hidden network call was made.';
  return 'Probe has not been requested.';
}

function userAction(route: AccessRouteCatalogEntry, status: ZavorthProviderReadinessStatus): string {
  if (status === 'ready') return 'Provider can be selected; run an explicit test if you need live proof.';
  if (status === 'missing_auth') return `Configure ${route.credentialRefs.filter((ref) => !ref.toLowerCase().includes('url')).join(', ') || 'provider credentials'}.`;
  if (status === 'missing_base_url') return `Configure ${route.baseUrlRef || route.requirements.find((item) => item.toLowerCase().includes('url')) || 'base URL'}.`;
  if (status === 'needs_probe') return `Run zavorth providers test ${normalizeEntryId(route)} before using it as default.`;
  if (status === 'degraded') return route.health?.message || 'Review provider health before routing work here.';
  if (status === 'unsupported') return 'This route is known but not supported on this host yet.';
  return 'Blocked by policy or operator configuration.';
}

function summarize(entries: ZavorthProviderReadinessEntry[]): ZavorthProviderReadinessMatrixSnapshot['summary'] {
  return {
    total: entries.length,
    ready: count(entries, 'ready'),
    livePassed: countProbe(entries, 'passed'),
    liveFailed: countProbe(entries, 'failed'),
    liveBlocked: countProbe(entries, 'blocked'),
    liveNotRun: entries.filter((entry) => !['passed', 'failed', 'blocked'].includes(entry.probe.status)).length,
    liveReady: entries.filter((entry) => entry.liveReady).length,
    catalogReadyButNotLive: entries.filter((entry) => entry.catalogReady && !entry.liveReady).length,
    defaultRouteAllowed: entries.filter((entry) => entry.defaultRouteAllowed).length,
    missingAuth: count(entries, 'missing_auth'),
    missingBaseUrl: count(entries, 'missing_base_url'),
    needsProbe: count(entries, 'needs_probe'),
    degraded: count(entries, 'degraded'),
    unsupported: count(entries, 'unsupported'),
    blocked: count(entries, 'blocked'),
  };
}

function buildLiveCompletion(summary: ZavorthProviderReadinessMatrixSnapshot['summary']): ZavorthProviderReadinessMatrixSnapshot['liveCompletion'] {
  return {
    providerSelectionRequiresLiveProof: true,
    catalogSupportIsNotLiveProof: true,
    liveProbeRequiresExplicitOperatorAction: true,
    rawSecretsSerialized: false,
    publicApiProviderTestEndpoint: '/api/v1/providers/:id/test',
    defaultRoutingPolicy: 'ready-and-live-proof',
    counts: {
      catalogReady: summary.ready,
      liveReady: summary.liveReady,
      catalogReadyButNotLive: summary.catalogReadyButNotLive,
      defaultRouteAllowed: summary.defaultRouteAllowed,
    },
  };
}

function completeEntry(entry: Omit<
  ZavorthProviderReadinessEntry,
  'liveReady' | 'defaultRouteAllowed' | 'readinessProof' | 'defaultBlockReason'
>): ZavorthProviderReadinessEntry {
  const readinessProof = resolveReadinessProof(entry);
  const liveReady = readinessProof === 'health' || readinessProof === 'live_probe';
  const defaultRouteAllowed = entry.status === 'ready' && liveReady;
  return {
    ...entry,
    liveReady,
    defaultRouteAllowed,
    readinessProof,
    defaultBlockReason: defaultRouteAllowed ? null : defaultBlockReason(entry, readinessProof),
  };
}

function resolveReadinessProof(entry: Pick<ZavorthProviderReadinessEntry, 'status' | 'probe' | 'health' | 'catalogReady'>): ZavorthProviderReadinessProof {
  if (entry.status === 'blocked' || entry.probe.status === 'blocked') return 'blocked';
  if (entry.probe.status === 'passed') {
    return entry.probe.mode === 'explicit_live_probe' ? 'live_probe' : 'health';
  }
  if (entry.catalogReady) return 'catalog';
  return 'none';
}

function defaultBlockReason(
  entry: Pick<ZavorthProviderReadinessEntry, 'status' | 'probe' | 'userAction'>,
  proof: ZavorthProviderReadinessProof,
): string {
  if (proof === 'blocked') return entry.probe.summary || entry.userAction;
  if (entry.status !== 'ready') return entry.userAction;
  if (proof === 'catalog') return 'Provider is configured, but default routing requires live health evidence or an explicit live probe.';
  return 'Provider is not ready for default routing.';
}

function count(entries: ZavorthProviderReadinessEntry[], status: ZavorthProviderReadinessStatus): number {
  return entries.filter((entry) => entry.status === status).length;
}

function countProbe(entries: ZavorthProviderReadinessEntry[], status: ZavorthProviderProbeStatus): number {
  return entries.filter((entry) => entry.probe.status === status).length;
}

function pickReadyOrKnown(entries: ZavorthProviderReadinessEntry[], wanted: string[]): string[] {
  const normalizedWanted = wanted.map(normalizeId);
  return entries
    .filter((entry) => routeEntryKeys(entry).some((key) => normalizedWanted.includes(key)))
    .sort((a, b) => Number(b.status === 'ready') - Number(a.status === 'ready'))
    .map((entry) => entry.id)
    .filter(uniqueByValue)
    .slice(0, 8);
}

function buildNextAction(
  summary: ZavorthProviderReadinessMatrixSnapshot['summary'],
  entries: ZavorthProviderReadinessEntry[],
): string {
  if (summary.ready > 0 && summary.needsProbe === 0 && summary.degraded === 0) {
    return 'Pick a ready provider profile or run zavorth providers test <provider> for live proof.';
  }
  const missing = entries.find((entry) => entry.status === 'missing_auth' || entry.status === 'missing_base_url');
  if (missing) return missing.userAction;
  const probe = entries.find((entry) => entry.status === 'needs_probe' || entry.status === 'degraded');
  if (probe) return probe.userAction;
  return 'Review provider matrix and keep unsupported/blocked routes out of defaults.';
}

function buildLiveNextAction(
  summary: ZavorthProviderReadinessMatrixSnapshot['summary'],
  entries: ZavorthProviderReadinessEntry[],
  input: { liveRequested: boolean; selectedProviderId: string },
): string {
  if (!input.liveRequested) {
    return input.selectedProviderId
      ? `Run zavorth providers test ${input.selectedProviderId} --live when you want live proof.`
      : 'Run zavorth providers live --provider <provider> for live proof; normal matrix rendering stays offline.';
  }
  const failed = entries.find((entry) => entry.probe.status === 'failed');
  if (failed) return `${failed.id} live probe failed; keep it out of defaults until it passes.`;
  const blocked = entries.find((entry) => entry.probe.status === 'blocked');
  if (blocked) return blocked.probe.summary;
  if (summary.livePassed > 0) return 'Live provider evidence is available; provider can be selected with fresh proof.';
  return 'No live provider probe was executed; select one provider or pass --all deliberately.';
}

function liveProbeResult(input: Partial<ProviderLiveProbeResult> & {
  status: ZavorthProviderProbeStatus;
  requestedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  summary: string;
}): ProviderLiveProbeResult {
  return {
    status: input.status,
    mode: 'explicit_live_probe',
    liveNetworkUsed: input.liveNetworkUsed === true,
    requestedAt: input.requestedAt,
    completedAt: input.completedAt,
    durationMs: input.durationMs,
    target: input.target || null,
    httpStatus: input.httpStatus ?? null,
    modelCount: input.modelCount ?? null,
    evidenceHash: input.evidenceHash || null,
    summary: input.summary,
  };
}

function resolveOpenAiCompatibleProbe(keys: Set<string>): ProviderProbeConfig | null {
  const specs: Array<{
    ids: string[];
    url: string;
    keyRef: string;
    authHeader?: string;
    authPrefix?: string;
  }> = [
    { ids: ['openai'], url: 'https://api.openai.com/v1/models', keyRef: 'OPENAI_API_KEY', authPrefix: 'Bearer ' },
    { ids: ['openrouter'], url: 'https://openrouter.ai/api/v1/models', keyRef: 'OPENROUTER_API_KEY', authPrefix: 'Bearer ' },
    { ids: ['deepseek'], url: 'https://api.deepseek.com/v1/models', keyRef: 'DEEPSEEK_API_KEY', authPrefix: 'Bearer ' },
    { ids: ['groq'], url: 'https://api.groq.com/openai/v1/models', keyRef: 'GROQ_API_KEY', authPrefix: 'Bearer ' },
    { ids: ['xai', 'x.ai'], url: 'https://api.x.ai/v1/models', keyRef: 'XAI_API_KEY', authPrefix: 'Bearer ' },
    { ids: ['mistral'], url: 'https://api.mistral.ai/v1/models', keyRef: 'MISTRAL_API_KEY', authPrefix: 'Bearer ' },
    { ids: ['together'], url: 'https://api.together.xyz/v1/models', keyRef: 'TOGETHER_API_KEY', authPrefix: 'Bearer ' },
    { ids: ['cerebras'], url: 'https://api.cerebras.ai/v1/models', keyRef: 'CEREBRAS_API_KEY', authPrefix: 'Bearer ' },
    { ids: ['minimax'], url: 'https://api.minimax.io/v1/models', keyRef: 'MINIMAX_API_KEY', authPrefix: 'Bearer ' },
    { ids: ['qwen', 'puter'], url: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models', keyRef: 'PUTER_AUTH_TOKEN', authPrefix: 'Bearer ' },
  ];
  const spec = specs.find((candidate) => candidate.ids.some((id) => keys.has(id)));
  if (spec) {
    const key = resolveSecretRef(spec.keyRef);
    if (!key) return null;
    return probeConfig(spec.url, 'GET', {
      [spec.authHeader || 'Authorization']: `${spec.authPrefix || ''}${key}`,
    }, countAnyModelArray);
  }

  if (keys.has('aigateway')) {
    const baseUrl = normalizeBaseUrl(resolveSecretRef('AIGateway_BASE_URL') || resolveSecretRef('AIGATEWAY_BASE_URL'));
    if (!baseUrl) return null;
    const key = resolveSecretRef('AIGateway_API_KEY') || resolveSecretRef('AIGATEWAY_API_KEY');
    return probeConfig(`${baseUrl}/models`, 'GET', key ? { Authorization: `Bearer ${key}` } : {}, countAnyModelArray);
  }

  if (keys.has('custom-openai-compatible') || keys.has('openai-compatible') || keys.has('litellm')) {
    const baseUrl = normalizeBaseUrl(resolveSecretRef('CUSTOM_OPENAI_COMPATIBLE_BASE_URL'));
    const key = resolveSecretRef('CUSTOM_OPENAI_COMPATIBLE_API_KEY');
    if (!baseUrl || !key) return null;
    return probeConfig(`${baseUrl}/models`, 'GET', { Authorization: `Bearer ${key}` }, countAnyModelArray);
  }

  if (keys.has('ollama')) {
    const baseUrl = normalizeBaseUrl(resolveSecretRef('OLLAMA_BASE_URL') || 'http://127.0.0.1:11434');
    return probeConfig(`${baseUrl}/api/tags`, 'GET', {}, countModelsField('models'));
  }

  return null;
}

function probeConfig(
  url: string,
  method: 'GET' | 'POST',
  headers: Record<string, string>,
  parseModelCount: (data: unknown) => number | null,
  body?: unknown,
): ProviderProbeConfig {
  return {
    url,
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body,
    parseModelCount,
  };
}

function countModelsField(field: string): (data: unknown) => number | null {
  return (data) => {
    const value = (data as Record<string, unknown> | null)?.[field];
    return Array.isArray(value) ? value.length : null;
  };
}

function countAnyModelArray(data: unknown): number | null {
  const record = data as Record<string, unknown> | null;
  if (!record) return null;
  for (const field of ['data', 'models']) {
    const value = record[field];
    if (Array.isArray(value)) return value.length;
  }
  return null;
}

function parseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function fetchProbe(fetchImpl: typeof fetch, probe: ProviderProbeConfig): Promise<ProviderHttpProbeResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetchImpl(probe.url, {
      method: probe.method,
      headers: probe.headers,
      body: probe.body === undefined ? undefined : JSON.stringify(probe.body),
      signal: controller.signal,
    });
    return {
      ok: response.ok,
      status: response.status,
      text: await response.text(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function nativeHttpProbe(probe: ProviderProbeConfig): Promise<ProviderHttpProbeResponse> {
  return new Promise((resolve, reject) => {
    const url = new URL(probe.url);
    const body = probe.body === undefined ? null : JSON.stringify(probe.body);
    const client = url.protocol === 'http:' ? http : https;
    const request = client.request({
      method: probe.method,
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      headers: {
        ...probe.headers,
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
      },
      timeout: 7000,
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on('end', () => {
        const status = response.statusCode || 0;
        resolve({
          ok: status >= 200 && status < 300,
          status,
          text: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    request.on('timeout', () => {
      request.destroy(new Error('ProviderProbeTimeout'));
    });
    request.on('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

function hashEvidence(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}

function sanitizeProbeTarget(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return 'unknown';
  }
}

function normalizeBaseUrl(value: string): string {
  const trimmed = String(value || '').trim().replace(/\/+$/, '');
  return trimmed;
}

function resolveSecretRef(ref: string): string {
  const normalized = String(ref || '').trim();
  const envValue = process.env[normalized];
  if (envValue) return envValue.trim();
  const key = normalized.toLowerCase();
  const mapped: Record<string, unknown> = {
    gemini_api_key: (config.geminiApiKeys && config.geminiApiKeys[0]) || config.geminiApiKey,
    openai_api_key: config.openaiApiKey,
    deepseek_api_key: config.deepseekApiKey,
    minimax_api_key: config.minimaxApiKey,
    openrouter_api_key: config.openRouterApiKey,
    puter_auth_token: config.puterAuthToken,
    opencode_api_key: config.openCodeApiKey,
    aigateway_base_url: config.AIGatewayBaseUrl,
    aigateway_api_key: (config as typeof config & Record<string, unknown>).AIGatewayApiKey,
  };
  const value = mapped[key];
  return typeof value === 'string' ? value.trim() : '';
}

function looksLikeRawSecret(value: string): boolean {
  return /(sk-[a-z0-9_-]{12,}|AIza[0-9A-Za-z_-]{16,}|Bearer\s+[A-Za-z0-9._-]{16,})/i.test(value);
}

function copyProfile(profile: ProviderProfile) {
  return {
    id: profile.id,
    label: profile.label,
    summary: profile.summary,
    preferredOrder: [...profile.preferredOrder],
  };
}

function normalizeEntryId(route: AccessRouteCatalogEntry): string {
  return normalizeId(route.id || route.providerId || route.providerName);
}

function routeKeys(route: AccessRouteCatalogEntry): string[] {
  return [
    route.id,
    route.providerId,
    route.providerName,
    route.vendorId,
    ...route.familyIds,
    ...route.aliases,
  ].map(normalizeId).filter(Boolean);
}

function routeEntryKeys(entry: ZavorthProviderReadinessEntry): string[] {
  return [
    entry.id,
    entry.providerId,
    entry.providerName,
    ...entry.familyIds,
  ].map(normalizeId).filter(Boolean);
}

function normalizeId(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function uniqueByValue<T>(value: T, index: number, values: T[]): boolean {
  return values.indexOf(value) === index;
}
