import {
  ZAVORTH_PROVIDER_CAPABILITY_COUNTS,
  ZAVORTH_PROVIDER_CAPABILITY_CATALOG_VERSION,
  ZAVORTH_PROVIDER_DOCUMENTED_IDS,
  ZAVORTH_MEDIA_PROVIDER_ROWS,
  ZAVORTH_PROVIDER_MODEL_CATALOGS,
  ZAVORTH_STATIC_PROVIDER_CATALOGS,
  type ZavorthProviderCapabilityModality,
} from './providers/catalog/zavorthProviderCapabilityInventory.js';
import {
  ZAVORTH_PROVIDER_CAPABILITY_MANIFESTS,
} from './providers/catalog/manifests/zavorthProviderCapabilityProviders.js';
import { getDefaultProviderIntegrationRegistry } from './providers/catalog/ProviderIntegrationRegistry.js';


export type ZavorthProviderCapabilityCatalogStatus = 'ready' | 'attention' | 'blocked';

export type ZavorthProviderCapabilityCatalogSnapshot = {
  contractVersion: typeof ZAVORTH_PROVIDER_CAPABILITY_CATALOG_VERSION;
  schemaVersion: 1;
  surface: 'provider-capability-catalog';
  generatedAt: string;
  status: ZavorthProviderCapabilityCatalogStatus;
  summary: {
    extensionPackageJsonCount: number;
    providerLikeExtensionCount: number;
    providerDirectoryEntries: number;
    documentedProviderIds: number;
    staticCatalogProviderCount: number;
    staticCatalogModelCount: number;
    catalogProviderEntries: number;
    catalogModelEntries: number;
    capabilityManifests: number;
    registeredCapabilityRoutes: number;
  };
  modalities: Record<ZavorthProviderCapabilityModality, {
    providers: string[];
    providerCount: number;
    modelCount: number;
  }>;
  providers: Array<{
    id: string;
    label: string;
    modelCount: number;
    modalities: ZavorthProviderCapabilityModality[];
  }>;
  safety: {
    inventoryOnly: true;
    noProviderSecrets: true;
    noLiveNetworkCalls: true;
    noHiddenAgentProcessLaunch: true;
    liveExecutionRequiresProviderCredentialAndExplicitProof: true;
  };
  commands: Array<{
    id: string;
    command: string;
    summary: string;
    liveNetworkUsedByDefault: boolean;
  }>;
  nextAction: string;
};

export type ZavorthProviderCapabilityCatalogRuntime = {
  now?: () => Date;
};

export class ZavorthProviderCapabilityCatalogService {
  private readonly now: () => Date;

  constructor(runtime: ZavorthProviderCapabilityCatalogRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(): ZavorthProviderCapabilityCatalogSnapshot {
    const registry = getDefaultProviderIntegrationRegistry();
    const capabilityRouteIds = new Set(ZAVORTH_PROVIDER_CAPABILITY_MANIFESTS.flatMap((manifest) =>
      manifest.routes.map((route) => route.routeId),
    ));
    const registeredCapabilityRoutes = registry.listRoutes()
      .filter((route) => capabilityRouteIds.has(route.routeId))
      .length;
    const catalogModelCount = ZAVORTH_PROVIDER_MODEL_CATALOGS
      .reduce((count, catalog) => count + catalog.models.length, 0);
    const modalities = buildModalitySummary();
    const status: ZavorthProviderCapabilityCatalogStatus = registeredCapabilityRoutes >= ZAVORTH_PROVIDER_CAPABILITY_MANIFESTS.length
      && catalogModelCount >= ZAVORTH_PROVIDER_CAPABILITY_COUNTS.staticCatalogModelCount ? 'ready'
      : 'attention';

    return {
      contractVersion: ZAVORTH_PROVIDER_CAPABILITY_CATALOG_VERSION,
      schemaVersion: 1,
      surface: 'provider-capability-catalog',
      generatedAt: this.now().toISOString(),
      status,
      summary: {
        extensionPackageJsonCount: ZAVORTH_PROVIDER_CAPABILITY_COUNTS.extensionPackageJsonCount,
        providerLikeExtensionCount: ZAVORTH_PROVIDER_CAPABILITY_COUNTS.providerLikeExtensionCount,
        providerDirectoryEntries: ZAVORTH_PROVIDER_CAPABILITY_COUNTS.providerDirectoryEntries,
        documentedProviderIds: ZAVORTH_PROVIDER_DOCUMENTED_IDS.length,
        staticCatalogProviderCount: ZAVORTH_PROVIDER_CAPABILITY_COUNTS.staticCatalogProviderCount,
        staticCatalogModelCount: ZAVORTH_PROVIDER_CAPABILITY_COUNTS.staticCatalogModelCount,
        catalogProviderEntries: ZAVORTH_PROVIDER_MODEL_CATALOGS.length,
        catalogModelEntries: catalogModelCount,
        capabilityManifests: ZAVORTH_PROVIDER_CAPABILITY_MANIFESTS.length,
        registeredCapabilityRoutes,
      },
      modalities,
      providers: ZAVORTH_PROVIDER_MODEL_CATALOGS.map((catalog) => ({
        id: catalog.providerId,
        label: catalog.label || catalog.providerId,
        modelCount: catalog.models.length,
        modalities: inferProviderModalities(catalog.providerId),
      })),
      safety: {
        inventoryOnly: true,
        noProviderSecrets: true,
        noLiveNetworkCalls: true,
        noHiddenAgentProcessLaunch: true,
        liveExecutionRequiresProviderCredentialAndExplicitProof: true,
      },
      commands: [
        {
          id: 'provider-capability-catalog',
          command: 'npm run zavorth:provider-capability-catalog --silent',
          summary: 'Show Zavorth provider, media and model capability catalog.',
          liveNetworkUsedByDefault: false,
        },
        {
          id: 'provider-capability-catalog-json',
          command: 'npm run zavorth:provider-capability-catalog:json --silent',
          summary: 'Show Zavorth provider capability catalog as JSON.',
          liveNetworkUsedByDefault: false,
        },
        {
          id: 'provider-model-catalog',
          command: 'npm run zavorth:provider-model-catalog --silent',
          summary: 'Show the unified Zavorth provider and model catalog.',
          liveNetworkUsedByDefault: false,
        },
      ],
      nextAction: status === 'ready'
        ? 'Configure credentials and run explicit live proof for the provider you want to make active.'
        : 'Review missing capability manifests or catalog model counts.',
    };
  }

  public renderText(snapshot: ZavorthProviderCapabilityCatalogSnapshot): string {
    return [
      '[provider-capability-catalog]',
      `status=${snapshot.status}`,
      `extensions=${snapshot.summary.extensionPackageJsonCount} provider_like=${snapshot.summary.providerLikeExtensionCount} provider_docs=${snapshot.summary.providerDirectoryEntries}`,
      `static_catalog_providers=${snapshot.summary.staticCatalogProviderCount} static_models=${snapshot.summary.staticCatalogModelCount}`,
      `catalog_providers=${snapshot.summary.catalogProviderEntries} catalog_models=${snapshot.summary.catalogModelEntries}`,
      `capability_manifests=${snapshot.summary.capabilityManifests} registered_routes=${snapshot.summary.registeredCapabilityRoutes}`,
      '',
      '[modalities]',
      ...Object.entries(snapshot.modalities).map(([modality, entry]) =>
        `- ${modality}: providers=${entry.providerCount} models=${entry.modelCount} ids=${entry.providers.join(', ') || 'none'}`,
      ),
      '',
      '[safety]',
      `inventory_only=${snapshot.safety.inventoryOnly}`,
      `no_live_network=${snapshot.safety.noLiveNetworkCalls}`,
      `no_hidden_agent_process=${snapshot.safety.noHiddenAgentProcessLaunch}`,
      `live_execution_requires_explicit_proof=${snapshot.safety.liveExecutionRequiresProviderCredentialAndExplicitProof}`,
      '',
      `next=${snapshot.nextAction}`,
      '',
    ].join('\n');
  }
}

function buildModalitySummary(): ZavorthProviderCapabilityCatalogSnapshot['modalities'] {
  const modalities: ZavorthProviderCapabilityModality[] = [
    'llm-chat',
    'image',
    'video',
    'music',
    'tts',
    'transcription',
    'embedding',
    'local-runtime',
    'web-search',
  ];
  return modalities.reduce<ZavorthProviderCapabilityCatalogSnapshot['modalities']>((acc, modality) => {
    const staticProviders = ZAVORTH_STATIC_PROVIDER_CATALOGS
      .filter((provider) => provider.modalities.includes(modality));
    const mediaProviders = ZAVORTH_MEDIA_PROVIDER_ROWS
      .filter((provider) => provider.modality === modality);
    const providers = unique([
      ...staticProviders.map((provider) => provider.providerId),
      ...mediaProviders.map((provider) => provider.providerId),
    ]);
    const modelCount = staticProviders.reduce((count, provider) => count + provider.models.length, 0)
      + mediaProviders.reduce((count, provider) => count + provider.models.length, 0);
    acc[modality] = {
      providers,
      providerCount: providers.length,
      modelCount,
    };
    return acc;
  }, {} as ZavorthProviderCapabilityCatalogSnapshot['modalities']);
}

function inferProviderModalities(providerId: string): ZavorthProviderCapabilityModality[] {
  return unique([
    ...ZAVORTH_STATIC_PROVIDER_CATALOGS
      .filter((provider) => provider.providerId === providerId)
      .flatMap((provider) => provider.modalities),
    ...ZAVORTH_MEDIA_PROVIDER_ROWS
      .filter((provider) => provider.providerId === providerId)
      .map((provider) => provider.modality),
  ]);
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values.filter(Boolean)));
}
