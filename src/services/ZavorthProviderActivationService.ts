import type { ZavorthProviderModelCatalogProvider } from '../contracts/ZavorthProviderModelCatalogContract.js';
import { ZavorthProviderCapabilityCatalogService } from './ZavorthProviderCapabilityCatalogService.js';
import { ZavorthProviderLiveProofStoreService } from './ZavorthProviderLiveProofStoreService.js';
import { ZavorthProviderModelCatalogService } from './ZavorthProviderModelCatalogService.js';
import { ZavorthProviderReadinessMatrixService } from './ZavorthProviderReadinessMatrixService.js';

export const ZAVORTH_PROVIDER_ACTIVATION_VERSION = '2026-05-17.provider-activation.v1' as const;

export type ZavorthProviderActivationStatus = 'ready' | 'attention' | 'blocked';
export type ZavorthProviderAdapterKind =
  | 'native'
  | 'openai_compatible'
  | 'aggregator'
  | 'local_runtime'
  | 'media_specific'
  | 'configuration_only';

export type ZavorthProviderActivationRoute = {
  id: string;
  label: string;
  status: ZavorthProviderActivationStatus;
  liveReady: boolean;
  catalogReady: boolean;
  defaultRouteAllowed: boolean;
  adapterKind: ZavorthProviderAdapterKind;
  executionReady: boolean;
  liveProofCommand: string;
  setupAction: string;
  connectorAction: string;
  credentialRefs: string[];
  modalities: string[];
  modelCount: number;
};

export type ZavorthProviderActivationSnapshot = {
  contractVersion: typeof ZAVORTH_PROVIDER_ACTIVATION_VERSION;
  schemaVersion: 1;
  surface: 'provider-activation';
  generatedAt: string;
  status: ZavorthProviderActivationStatus;
  summary: {
    routes: number;
    liveReady: number;
    executionReady: number;
    needsCredentials: number;
    needsBaseUrl: number;
    needsLiveProof: number;
    needsConnector: number;
    nativeAdapters: number;
    openAiCompatibleAdapters: number;
    mediaSpecificAdapters: number;
    localRuntimeAdapters: number;
    liveProbeAttempted: number;
    liveProbePassed: number;
    liveProbeFailed: number;
    liveProbeBlocked: number;
  };
  routes: ZavorthProviderActivationRoute[];
  adapterMatrix: Record<ZavorthProviderAdapterKind, string[]>;
  liveProofPlan: Array<{
    providerId: string;
    command: string;
    canRunNow: boolean;
    reason: string;
  }>;
  connectorBacklog: Array<{
    providerId: string;
    label: string;
    adapterKind: ZavorthProviderAdapterKind;
    reason: string;
    nextStep: string;
  }>;
  dashboardProjection: {
    route: '/dashboard';
    endpoint: '/api/providers/activation';
    executionAuthority: false;
    normalRenderMakesNoNetworkCalls: true;
  };
  safety: {
    noRawProviderSecrets: true;
    noHiddenLiveNetworkCalls: true;
    liveProofRequiresExplicitOperatorAction: true;
    nonCompatibleProvidersNeedTypedConnector: true;
    dashboardCannotExecuteProviderCalls: true;
  };
  commands: Array<{
    id: string;
    command: string;
    summary: string;
    liveNetworkUsedByDefault: boolean;
  }>;
  nextAction: string;
};

export type ZavorthProviderActivationInput = {
  includeAdvanced?: boolean;
  providerId?: string | null;
  liveConfigured?: boolean;
  allowAllLive?: boolean;
};

export type ZavorthProviderActivationRuntime = {
  now?: () => Date;
  providerModelCatalog?: ZavorthProviderModelCatalogService;
  capabilityCatalog?: ZavorthProviderCapabilityCatalogService;
  readiness?: ZavorthProviderReadinessMatrixService;
};

export class ZavorthProviderActivationService {
  private readonly now: () => Date;
  private readonly providerModelCatalog: ZavorthProviderModelCatalogService;
  private readonly capabilityCatalog: ZavorthProviderCapabilityCatalogService;
  private readonly readiness: ZavorthProviderReadinessMatrixService;

  public constructor(runtime: ZavorthProviderActivationRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.providerModelCatalog = runtime.providerModelCatalog || new ZavorthProviderModelCatalogService({ now: this.now });
    this.capabilityCatalog = runtime.capabilityCatalog || new ZavorthProviderCapabilityCatalogService({ now: this.now });
    this.readiness = runtime.readiness || new ZavorthProviderReadinessMatrixService({
      now: this.now,
      liveProofStore: new ZavorthProviderLiveProofStoreService({ now: this.now }),
    });
  }

  public async buildSnapshot(input: ZavorthProviderActivationInput = {}): Promise<ZavorthProviderActivationSnapshot> {
    const providerId = normalizeId(input.providerId);
    const liveMatrix = await this.readiness.buildLiveSnapshot({
      includeAdvanced: input.includeAdvanced === true,
      providerId: providerId || null,
      probe: true,
      live: input.liveConfigured === true,
      allowAllLive: input.allowAllLive === true,
    });
    const catalog = await this.providerModelCatalog.buildSnapshot({
      includeAdvanced: input.includeAdvanced === true,
      providerId: providerId || null,
      selectedProviderId: providerId || null,
      live: false,
      allowAllLive: false,
    });
    const capability = this.capabilityCatalog.buildSnapshot();
    const liveById = new Map(liveMatrix.entries.map((entry) => [normalizeId(entry.id), entry]));
    const routes = catalog.providers.map((provider) => {
      const live = liveById.get(normalizeId(provider.id));
      return this.toRoute(provider, live?.probe.status || provider.liveStatus);
    });
    const summary = summarize(routes, liveMatrix.summary);
    const status: ZavorthProviderActivationStatus = summary.executionReady > 0
      ? 'ready'
      : summary.needsCredentials + summary.needsBaseUrl > 0
        ? 'attention'
        : 'blocked';
    const adapterMatrix = groupByAdapter(routes);
    const liveProofPlan = routes.map((route) => ({
      providerId: route.id,
      command: route.liveProofCommand,
      canRunNow: route.catalogReady && route.credentialRefs.length > 0 && !route.liveReady,
      reason: route.liveReady ? 'fresh live proof exists' : route.setupAction,
    }));
    const connectorBacklog = routes
      .filter((route) => !route.executionReady && ['media_specific', 'configuration_only'].includes(route.adapterKind))
      .map((route) => ({
        providerId: route.id,
        label: route.label,
        adapterKind: route.adapterKind,
        reason: route.connectorAction,
        nextStep: route.adapterKind === 'media_specific'
          ? 'Implement or configure the typed media connector before live execution.'
          : 'Configure a compatible endpoint or add a typed adapter before live execution.',
      }));

    return {
      contractVersion: ZAVORTH_PROVIDER_ACTIVATION_VERSION,
      schemaVersion: 1,
      surface: 'provider-activation',
      generatedAt: this.now().toISOString(),
      status,
      summary,
      routes,
      adapterMatrix,
      liveProofPlan,
      connectorBacklog,
      dashboardProjection: {
        route: '/dashboard',
        endpoint: '/api/providers/activation',
        executionAuthority: false,
        normalRenderMakesNoNetworkCalls: true,
      },
      safety: {
        noRawProviderSecrets: true,
        noHiddenLiveNetworkCalls: true,
        liveProofRequiresExplicitOperatorAction: true,
        nonCompatibleProvidersNeedTypedConnector: true,
        dashboardCannotExecuteProviderCalls: true,
      },
      commands: [
        {
          id: 'provider-activation',
          command: 'npm run zavorth:provider-activation --silent',
          summary: 'Show provider activation, adapter and live-proof readiness without network calls.',
          liveNetworkUsedByDefault: false,
        },
        {
          id: 'provider-activation-json',
          command: 'npm run zavorth:provider-activation:json --silent',
          summary: 'Show provider activation as JSON.',
          liveNetworkUsedByDefault: false,
        },
        {
          id: 'provider-activation-live-configured',
          command: 'npm run zavorth:provider-activation:live-configured --silent',
          summary: 'Run explicit live probes for configured providers only and store sanitized proof.',
          liveNetworkUsedByDefault: true,
        },
      ],
      nextAction: buildNextAction(summary, routes, capability.status),
    };
  }

  public renderText(snapshot: ZavorthProviderActivationSnapshot): string {
    return [
      '[provider-activation]',
      `status=${snapshot.status}`,
      `routes=${snapshot.summary.routes} execution_ready=${snapshot.summary.executionReady} live_ready=${snapshot.summary.liveReady}`,
      `needs_credentials=${snapshot.summary.needsCredentials} needs_base_url=${snapshot.summary.needsBaseUrl} needs_live_proof=${snapshot.summary.needsLiveProof} needs_connector=${snapshot.summary.needsConnector}`,
      `adapters=native:${snapshot.summary.nativeAdapters} openai:${snapshot.summary.openAiCompatibleAdapters} media:${snapshot.summary.mediaSpecificAdapters} local:${snapshot.summary.localRuntimeAdapters}`,
      '',
      '[routes]',
      ...snapshot.routes.slice(0, 40).map((route) =>
        `- ${route.id}: ${route.status} adapter=${route.adapterKind} live=${route.liveReady ? 'yes' : 'no'} exec=${route.executionReady ? 'yes' : 'no'} models=${route.modelCount} next="${route.setupAction}"`,
      ),
      snapshot.routes.length > 40 ? `... ${snapshot.routes.length - 40} more route(s)` : '',
      '',
      '[connector backlog]',
      ...snapshot.connectorBacklog.slice(0, 20).map((item) => `- ${item.providerId}: ${item.reason}`),
      '',
      `next=${snapshot.nextAction}`,
      '',
    ].filter(Boolean).join('\n');
  }

  private toRoute(
    provider: ZavorthProviderModelCatalogProvider,
    probeStatus: string,
  ): ZavorthProviderActivationRoute {
    const adapterKind = classifyAdapter(provider);
    const typedConnectorReady = hasTypedConnector(provider);
    const needsConnector = (adapterKind === 'media_specific' || adapterKind === 'configuration_only') && !typedConnectorReady;
    const executionReady = provider.defaultRouteAllowed && !needsConnector;
    const status: ZavorthProviderActivationStatus = executionReady
      ? 'ready'
      : provider.status === 'missing_auth' || provider.status === 'missing_base_url'
        ? 'attention'
        : 'attention';
    return {
      id: provider.id,
      label: provider.label,
      status,
      liveReady: provider.liveReady || probeStatus === 'passed',
      catalogReady: provider.catalogReady,
      defaultRouteAllowed: provider.defaultRouteAllowed,
      adapterKind,
      executionReady,
      liveProofCommand: `zavorth providers live --provider ${provider.id}`,
      setupAction: resolveSetupAction(provider),
      connectorAction: needsConnector
        ? `Typed ${adapterKind === 'media_specific' ? 'media' : 'provider'} connector is required before live execution.`
        : typedConnectorReady
          ? 'Typed Zavorth media connector is configured and gated by live proof.'
          : 'Route can execute through an existing Zavorth adapter once live proof is fresh.',
      credentialRefs: [...provider.credentialRefs],
      modalities: [...provider.modalities],
      modelCount: provider.effectiveModelCount,
    };
  }
}

function hasTypedConnector(provider: ZavorthProviderModelCatalogProvider): boolean {
  const id = normalizeId(provider.id);
  return id === 'elevenlabs';
}

function classifyAdapter(provider: ZavorthProviderModelCatalogProvider): ZavorthProviderAdapterKind {
  const id = normalizeId(provider.id);
  if (['gemini', 'gemma', 'openai', 'deepseek', 'openrouter', 'aigateway', 'anthropic', 'claude', 'qwen', 'minimax'].includes(id)) {
    return 'native';
  }
  if (provider.routeKind === 'aggregator') return 'aggregator';
  if (provider.mode === 'local' || provider.routeKind === 'local_runtime') return 'local_runtime';
  const modalities = provider.modalities.map(normalizeId);
  if (modalities.includes('video') || modalities.includes('audio') || modalities.includes('image')) {
    return provider.routeKind === 'custom_compatible' ? 'media_specific' : 'native';
  }
  if (provider.routeKind === 'custom_compatible' || provider.capabilities.includes('tool_use') || provider.capabilities.includes('chat')) {
    return 'openai_compatible';
  }
  return 'configuration_only';
}

function resolveSetupAction(provider: ZavorthProviderModelCatalogProvider): string {
  if (provider.liveReady) return 'Ready with fresh live proof.';
  if (provider.status === 'missing_auth') return `Configure ${provider.credentialRefs.filter((ref) => !/url/i.test(ref)).join(', ') || 'provider credentials'}.`;
  if (provider.status === 'missing_base_url') return provider.userAction || 'Configure provider base URL.';
  if (provider.catalogReady) return `Run ${`zavorth providers live --provider ${provider.id}`} for explicit live proof.`;
  return provider.userAction || 'Complete provider setup before activation.';
}

function summarize(
  routes: ZavorthProviderActivationRoute[],
  liveSummary: { livePassed: number; liveFailed: number; liveBlocked: number },
): ZavorthProviderActivationSnapshot['summary'] {
  return {
    routes: routes.length,
    liveReady: routes.filter((route) => route.liveReady).length,
    executionReady: routes.filter((route) => route.executionReady).length,
    needsCredentials: routes.filter((route) => /credential|api_key|configure/i.test(route.setupAction) && route.credentialRefs.length > 0 && !route.catalogReady).length,
    needsBaseUrl: routes.filter((route) => /base url/i.test(route.setupAction)).length,
    needsLiveProof: routes.filter((route) => route.catalogReady && !route.liveReady).length,
    needsConnector: routes.filter((route) => !route.executionReady && ['media_specific', 'configuration_only'].includes(route.adapterKind)).length,
    nativeAdapters: routes.filter((route) => route.adapterKind === 'native').length,
    openAiCompatibleAdapters: routes.filter((route) => route.adapterKind === 'openai_compatible').length,
    mediaSpecificAdapters: routes.filter((route) => route.adapterKind === 'media_specific').length,
    localRuntimeAdapters: routes.filter((route) => route.adapterKind === 'local_runtime').length,
    liveProbeAttempted: liveSummary.livePassed + liveSummary.liveFailed + liveSummary.liveBlocked,
    liveProbePassed: liveSummary.livePassed,
    liveProbeFailed: liveSummary.liveFailed,
    liveProbeBlocked: liveSummary.liveBlocked,
  };
}

function groupByAdapter(routes: ZavorthProviderActivationRoute[]): Record<ZavorthProviderAdapterKind, string[]> {
  return {
    native: routes.filter((route) => route.adapterKind === 'native').map((route) => route.id),
    openai_compatible: routes.filter((route) => route.adapterKind === 'openai_compatible').map((route) => route.id),
    aggregator: routes.filter((route) => route.adapterKind === 'aggregator').map((route) => route.id),
    local_runtime: routes.filter((route) => route.adapterKind === 'local_runtime').map((route) => route.id),
    media_specific: routes.filter((route) => route.adapterKind === 'media_specific').map((route) => route.id),
    configuration_only: routes.filter((route) => route.adapterKind === 'configuration_only').map((route) => route.id),
  };
}

function buildNextAction(
  summary: ZavorthProviderActivationSnapshot['summary'],
  routes: ZavorthProviderActivationRoute[],
  capabilityStatus: string,
): string {
  if (capabilityStatus !== 'ready') return 'Finish provider capability catalog certification first.';
  const proof = routes.find((route) => route.catalogReady && !route.liveReady);
  if (proof) return `Run ${proof.liveProofCommand} to activate ${proof.label}.`;
  const connector = routes.find((route) => !route.executionReady && route.adapterKind === 'media_specific');
  if (connector) return `Add typed connector support for ${connector.label} before live media execution.`;
  if (summary.executionReady > 0) return 'Provider activation is ready; configure additional credentials to expand coverage.';
  return 'Configure one provider credential, run live proof, then select it as default.';
}

function normalizeId(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}
