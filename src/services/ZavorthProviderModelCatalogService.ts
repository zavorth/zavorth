import {
  ZAVORTH_PROVIDER_MODEL_CATALOG_CONTRACT_VERSION,
  type ZavorthProviderModelCatalogProvider,
  type ZavorthProviderModelCatalogSnapshot,
  type ZavorthProviderModelCatalogStatus,
} from '../contracts/ZavorthProviderModelCatalogContract.js';
import type {
  ModelCapabilityKind,
  ModelModality,
} from '../contracts/ModelPickerContract.js';
import type {
  ZavorthProviderReadinessEntry,
  ZavorthProviderReadinessMatrixSnapshot,
} from '../contracts/ZavorthProviderReadinessMatrixContract.js';
import {
  ZavorthProviderReadinessMatrixService,
  type ZavorthProviderReadinessMatrixInput,
} from './ZavorthProviderReadinessMatrixService.js';
import {
  ModelCatalogAggregationService,
  type AggregatedModelCatalogEntry,
} from './providers/catalog/ModelCatalogAggregationService.js';
import {
  ZAVORTH_PROVIDER_MODEL_CATALOGS,
} from './providers/catalog/zavorthProviderCapabilityInventory.js';

export type ZavorthProviderModelCatalogInput = ZavorthProviderReadinessMatrixInput & {
  selectedProviderId?: string | null;
};

export type ZavorthProviderModelCatalogRuntime = {
  now?: () => Date;
  providerReadiness?: Pick<ZavorthProviderReadinessMatrixService, 'buildLiveSnapshot'>;
  modelCatalog?: Pick<ModelCatalogAggregationService, 'aggregate'>;
};

export class ZavorthProviderModelCatalogService {
  private readonly now: () => Date;
  private readonly providerReadiness: Pick<ZavorthProviderReadinessMatrixService, 'buildLiveSnapshot'>;
  private readonly modelCatalog: Pick<ModelCatalogAggregationService, 'aggregate'>;

  constructor(runtime: ZavorthProviderModelCatalogRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.providerReadiness = runtime.providerReadiness || new ZavorthProviderReadinessMatrixService({
      now: this.now,
    });
    this.modelCatalog = runtime.modelCatalog || new ModelCatalogAggregationService();
  }

  public async buildSnapshot(
    input: ZavorthProviderModelCatalogInput = {},
  ): Promise<ZavorthProviderModelCatalogSnapshot> {
    const selectedProviderId = normalizeId(input.selectedProviderId || input.providerId);
    const matrix = await this.providerReadiness.buildLiveSnapshot({
      ...input,
      providerId: selectedProviderId || input.providerId,
      live: input.live === true,
      allowAllLive: input.allowAllLive === true,
    });
    const generatedAt = this.now().toISOString();
    const aggregated = this.modelCatalog.aggregate({
      generatedAt,
      activeProviderIds: [
        matrix.activeProvider,
        ...matrix.entries.filter((entry) => entry.defaultRouteAllowed).map((entry) => entry.id),
      ],
      providerCatalogs: ZAVORTH_PROVIDER_MODEL_CATALOGS,
      includeRegistryModels: true,
    });
    const modelsByProvider = groupModelsByProvider(aggregated.models);
    const providers = matrix.entries.map((entry) => buildProvider(entry, modelsByProvider));
    const summary = buildSummary(matrix, providers, aggregated.models);

    return {
      contractVersion: ZAVORTH_PROVIDER_MODEL_CATALOG_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'provider-model-catalog',
      generatedAt,
      status: resolveStatus(matrix),
      source: {
        readinessSurface: 'provider-readiness-matrix',
        staticCatalog: 'provider-integration-registry',
        liveEvidence: 'sanitized-provider-proof-store',
      },
      activeProvider: matrix.activeProvider,
      activeModel: matrix.activeModel,
      summary,
      sections: buildSections(providers),
      providers,
      commands: [
        {
          id: 'provider-model-catalog',
          command: 'npm run zavorth:provider-model-catalog --silent',
          summary: 'Show provider and model catalog without live network by default.',
          liveNetworkUsedByDefault: false,
        },
        {
          id: 'provider-model-catalog-json',
          command: 'npm run zavorth:provider-model-catalog:json --silent',
          summary: 'Show provider and model catalog as JSON.',
          liveNetworkUsedByDefault: false,
        },
        {
          id: 'provider-readiness',
          command: 'zavorth providers',
          summary: 'Open the lower-level provider readiness matrix.',
          liveNetworkUsedByDefault: false,
        },
        {
          id: 'provider-live-proof',
          command: 'zavorth providers live --provider <provider>',
          summary: 'Run explicit live proof for one provider and store sanitized evidence.',
          liveNetworkUsedByDefault: true,
        },
      ],
      dashboardProjection: {
        route: '/dashboard',
        endpoint: '/api/providers/model-catalog',
        executionAuthority: false,
        normalRenderMakesNoNetworkCalls: true,
      },
      safety: {
        noRawProviderSecrets: true,
        catalogIsNotLiveProof: true,
        liveProbeRequiresExplicitOperatorAction: true,
        dashboardCannotExecuteProviderCalls: true,
        modelListingMayBeDynamicThroughAggregators: true,
      },
      nextAction: buildNextAction(matrix, providers),
    };
  }

  public renderText(snapshot: ZavorthProviderModelCatalogSnapshot): string {
    return [
      '[provider-model-catalog]',
      `status=${snapshot.status}`,
      `active=${snapshot.activeProvider}/${snapshot.activeModel}`,
      `routes=${snapshot.summary.providerRoutes} catalog_ready=${snapshot.summary.catalogReadyRoutes} live_ready=${snapshot.summary.liveReadyRoutes} default_allowed=${snapshot.summary.defaultRouteAllowed}`,
      `static_models=${snapshot.summary.staticCatalogModels} live_discovered=${snapshot.summary.liveDiscoveredModels} effective_surface=${snapshot.summary.effectiveModelSurface}`,
      '',
      '[sections]',
      `live_validated=${snapshot.sections.liveValidated.join(', ') || 'none'}`,
      `ready_but_not_live=${snapshot.sections.readyButNotLive.join(', ') || 'none'}`,
      `needs_credentials=${snapshot.sections.needsCredentials.join(', ') || 'none'}`,
      `needs_base_url=${snapshot.sections.needsBaseUrl.join(', ') || 'none'}`,
      `aggregators=${snapshot.sections.aggregators.join(', ') || 'none'}`,
      `media_capable=${snapshot.sections.mediaCapable.join(', ') || 'none'}`,
      '',
      '[providers]',
      ...snapshot.providers.map((provider) =>
        `- ${provider.id}: ${provider.status} live=${provider.liveStatus} default=${provider.defaultRouteAllowed ? 'allowed' : 'blocked'} models=${provider.effectiveModelCount} sample=${provider.modelSample.join('|') || 'none'} action="${provider.userAction}"`,
      ),
      '',
      `next=${snapshot.nextAction}`,
      '',
    ].join('\n');
  }
}

function buildProvider(
  entry: ZavorthProviderReadinessEntry,
  modelsByProvider: Map<string, AggregatedModelCatalogEntry[]>,
): ZavorthProviderModelCatalogProvider {
  const keys = routeEntryKeys(entry);
  const models = uniqueModels(keys.flatMap((key) => modelsByProvider.get(key) || []));
  const modelSample = unique([
    entry.currentModelName || '',
    ...models.map((model) => model.root || model.name || model.id),
  ]).slice(0, 8);
  const modalities = unique([
    ...models.flatMap((model) => model.modalities),
    ...inferModalitiesFromCapabilities(entry.capabilities),
  ]);
  const liveDiscoveredModelCount = entry.probe.modelCount
    ?? extractModelCount(entry.probe.summary)
    ?? extractModelCount(entry.health?.message);
  const staticModelCount = models.length;
  const effectiveModelCount = Math.max(
    staticModelCount,
    typeof liveDiscoveredModelCount === 'number' ? liveDiscoveredModelCount : 0,
    entry.currentModelName ? 1 : 0,
  );

  return {
    id: entry.id,
    label: entry.label,
    providerId: entry.providerId,
    providerName: entry.providerName,
    routeKind: entry.routeKind,
    mode: entry.mode,
    status: entry.status,
    catalogReady: entry.catalogReady,
    liveReady: entry.liveReady,
    defaultRouteAllowed: entry.defaultRouteAllowed,
    readinessProof: entry.readinessProof,
    liveStatus: entry.probe.status,
    model: entry.currentModelName,
    staticModelCount,
    liveDiscoveredModelCount,
    effectiveModelCount,
    modelSample,
    capabilities: unique([...entry.capabilities, ...models.flatMap((model) =>
      Object.entries(model.capabilities)
        .filter(([, enabled]) => enabled)
        .map(([capability]) => capability as ModelCapabilityKind),
    )]),
    modalities,
    credentialKind: entry.credentialKind,
    credentialRefs: [...entry.credentialRefs],
    requirements: [...entry.requirements],
    issue: entry.issue,
    defaultBlockReason: entry.defaultBlockReason,
    userAction: entry.userAction,
    testCommand: entry.testCommand,
  };
}

function buildSummary(
  matrix: ZavorthProviderReadinessMatrixSnapshot,
  providers: ZavorthProviderModelCatalogProvider[],
  staticModels: AggregatedModelCatalogEntry[],
): ZavorthProviderModelCatalogSnapshot['summary'] {
  const modalityCounts = providers.reduce<Record<ModelModality | 'unknown', number>>((acc, provider) => {
    const modalities = provider.modalities.length > 0 ? provider.modalities : ['unknown' as const];
    for (const modality of modalities) {
      acc[modality] = (acc[modality] || 0) + 1;
    }
    return acc;
  }, { unknown: 0, text: 0, image: 0, audio: 0, video: 0, embedding: 0, tool: 0 });
  const capabilityCounts = providers.reduce<Partial<Record<ModelCapabilityKind, number>>>((acc, provider) => {
    for (const capability of provider.capabilities) {
      acc[capability] = (acc[capability] || 0) + 1;
    }
    return acc;
  }, {});

  return {
    providerRoutes: matrix.summary.total,
    catalogReadyRoutes: matrix.summary.ready,
    liveReadyRoutes: matrix.summary.liveReady,
    defaultRouteAllowed: matrix.summary.defaultRouteAllowed,
    catalogReadyButNotLive: matrix.summary.catalogReadyButNotLive,
    missingAuth: matrix.summary.missingAuth,
    missingBaseUrl: matrix.summary.missingBaseUrl,
    staticCatalogModels: staticModels.length,
    liveDiscoveredModels: providers.reduce((count, provider) => count + (provider.liveDiscoveredModelCount || 0), 0),
    effectiveModelSurface: providers.reduce((count, provider) => count + provider.effectiveModelCount, 0),
    modalityCounts,
    capabilityCounts,
  };
}

function buildSections(providers: ZavorthProviderModelCatalogProvider[]): ZavorthProviderModelCatalogSnapshot['sections'] {
  return {
    liveValidated: providers.filter((entry) => entry.liveReady).map((entry) => entry.id),
    readyButNotLive: providers
      .filter((entry) => entry.catalogReady && !entry.liveReady)
      .map((entry) => entry.id),
    needsCredentials: providers
      .filter((entry) => entry.status === 'missing_auth')
      .map((entry) => entry.id),
    needsBaseUrl: providers
      .filter((entry) => entry.status === 'missing_base_url')
      .map((entry) => entry.id),
    aggregators: providers
      .filter((entry) => entry.routeKind === 'aggregator')
      .map((entry) => entry.id),
    localPrivate: providers
      .filter((entry) => entry.mode === 'local' || entry.mode === 'hybrid' || entry.capabilities.includes('local'))
      .map((entry) => entry.id),
    mediaCapable: providers
      .filter((entry) => entry.modalities.some((modality) => ['image', 'audio', 'video'].includes(modality)))
      .map((entry) => entry.id),
  };
}

function resolveStatus(matrix: ZavorthProviderReadinessMatrixSnapshot): ZavorthProviderModelCatalogStatus {
  if (matrix.status === 'blocked') return 'blocked';
  if (matrix.summary.liveFailed > 0 || matrix.summary.missingAuth > 0 || matrix.summary.catalogReadyButNotLive > 0) {
    return 'attention';
  }
  return 'ready';
}

function buildNextAction(
  matrix: ZavorthProviderReadinessMatrixSnapshot,
  providers: ZavorthProviderModelCatalogProvider[],
): string {
  const defaultAllowed = providers.filter((entry) => entry.defaultRouteAllowed).length;
  const readyButNotLive = providers.find((entry) => entry.catalogReady && !entry.liveReady);
  if (defaultAllowed > 0) {
    return `${defaultAllowed} route(s) can be used by default. To expand safely, run live proof for a configured provider before routing production traffic.`;
  }
  if (readyButNotLive) {
    return `Run explicit live proof for ${readyButNotLive.id} before allowing it as a default route.`;
  }
  if (matrix.summary.missingAuth > 0) {
    return 'Configure provider credentials, then run a live proof for the provider you want as default.';
  }
  return matrix.nextAction;
}

function groupModelsByProvider(models: AggregatedModelCatalogEntry[]): Map<string, AggregatedModelCatalogEntry[]> {
  const map = new Map<string, AggregatedModelCatalogEntry[]>();
  for (const model of models) {
    for (const key of unique([
      model.providerId,
      model.providerAlias,
      model.routeId,
      model.familyId,
      model.ownedBy,
    ].map(normalizeId))) {
      const list = map.get(key) || [];
      list.push(model);
      map.set(key, list);
    }
  }
  return map;
}

function uniqueModels(models: AggregatedModelCatalogEntry[]): AggregatedModelCatalogEntry[] {
  const seen = new Set<string>();
  const output: AggregatedModelCatalogEntry[] = [];
  for (const model of models) {
    const key = `${model.providerAlias}:${model.root}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(model);
  }
  return output;
}

function routeEntryKeys(entry: ZavorthProviderReadinessEntry): string[] {
  return unique([
    entry.id,
    entry.providerId,
    entry.providerName,
    ...entry.familyIds,
  ].map(normalizeId));
}

function inferModalitiesFromCapabilities(capabilities: ModelCapabilityKind[]): ModelModality[] {
  const modalities: ModelModality[] = [];
  if (capabilities.includes('chat') || capabilities.includes('coding') || capabilities.includes('reasoning') || capabilities.includes('research')) {
    modalities.push('text');
  }
  if (capabilities.includes('vision') || capabilities.includes('multimodal')) {
    modalities.push('image');
  }
  if (capabilities.includes('audio')) {
    modalities.push('audio');
  }
  if (capabilities.includes('embedding')) {
    modalities.push('embedding');
  }
  if (capabilities.includes('tool_use')) {
    modalities.push('tool');
  }
  return modalities;
}

function extractModelCount(value: unknown): number | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const match = text.match(/listed\s+([0-9][0-9.,]*)\s+model/i)
    || text.match(/([0-9][0-9.,]*)\s+model\(s\)/i);
  if (!match) return null;
  const count = Number(match[1].replace(/[,.]/g, ''));
  return Number.isFinite(count) && count > 0 ? count : null;
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeId(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}
