import type {
  ModelCapabilityKind,
  ModelFamilyCatalog,
  ModelFamilyCatalogEntry,
  ModelModality,
  ProviderCatalogSource,
} from './ProviderCatalogContracts.js';
import type { ProviderIntegrationRegistry } from './ProviderIntegrationRegistry.js';
import { getDefaultProviderIntegrationRegistry } from './ProviderIntegrationRegistry.js';

export type AggregatedModelType =
  | 'chat'
  | 'embedding'
  | 'image'
  | 'audio'
  | 'video'
  | 'rerank'
  | 'moderation'
  | 'music';

export type ModelCatalogSourceKind = Extract<
  ProviderCatalogSource,
  'live_api' | 'provider_catalog' | 'fallback_catalog' | 'local_catalog' | 'custom_model' | 'imported_model'
>;

export type ModelCatalogInputModel = {
  id: string;
  name?: string | null;
  type?: AggregatedModelType;
  custom?: boolean;
  imported?: boolean;
  source?: ModelCatalogSourceKind;
  contextLength?: number | null;
  dimensions?: number | null;
  supportedEndpoints?: string[];
  supportedSizes?: string[];
  subtype?: string | null;
  apiFormat?: string | null;
  capabilities?: Partial<Record<ModelCapabilityKind | 'vision', boolean>>;
  modalities?: ModelModality[];
  raw?: Record<string, unknown>;
};

export type ModelCatalogProviderInput = {
  providerId: string;
  alias?: string | null;
  label?: string | null;
  active?: boolean;
  source?: ModelCatalogSourceKind;
  routeId?: string | null;
  familyId?: string | null;
  models: ModelCatalogInputModel[];
};

export type ModelCatalogAggregationOptions = {
  generatedAt?: string;
  providerCatalogs?: ModelCatalogProviderInput[];
  liveCatalogs?: ModelCatalogProviderInput[];
  fallbackCatalogs?: ModelCatalogProviderInput[];
  localCatalogs?: ModelCatalogProviderInput[];
  customCatalogs?: ModelCatalogProviderInput[];
  activeProviderIds?: string[];
  blockedProviderIds?: string[];
  includeRegistryModels?: boolean;
  registry?: ProviderIntegrationRegistry | null;
};

export type AggregatedModelCatalogEntry = {
  id: string;
  object: 'model';
  providerId: string;
  providerAlias: string;
  providerLabel: string;
  routeId: string;
  familyId: string;
  ownedBy: string;
  root: string;
  parent: string | null;
  name: string;
  type: AggregatedModelType;
  custom: boolean;
  imported: boolean;
  source: ModelCatalogSourceKind;
  active: boolean;
  capabilities: Partial<Record<ModelCapabilityKind | 'vision', boolean>>;
  modalities: ModelModality[];
  contextLength: number | null;
  dimensions: number | null;
  supportedEndpoints: string[];
  supportedSizes: string[];
  subtype: string | null;
  apiFormat: string | null;
  raw?: Record<string, unknown>;
};

export type ModelCatalogAggregationResult = {
  schemaVersion: 1;
  generatedAt: string;
  catalogs: ModelFamilyCatalog[];
  families: ModelFamilyCatalogEntry[];
  models: AggregatedModelCatalogEntry[];
  sources: ModelCatalogSourceKind[];
  sourceCounts: Record<string, number>;
};

export type LegacyModelsCatalog = Record<string, {
  provider: string;
  active: boolean;
  models: Array<{
    id: string;
    name: string;
    type: AggregatedModelType;
    custom: boolean;
    source: ModelCatalogSourceKind;
  }>;
}>;

export type OpenAIModelsListEntry = {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
  permission: [];
  root: string;
  parent: string | null;
  type?: AggregatedModelType;
  custom?: boolean;
  context_length?: number;
  dimensions?: number;
  capabilities?: Partial<Record<ModelCapabilityKind | 'vision', boolean>>;
  input_modalities?: ModelModality[];
  output_modalities?: ModelModality[];
  supported_endpoints?: string[];
  supported_sizes?: string[];
  subtype?: string;
  api_format?: string;
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeId(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function sourceRank(source: ModelCatalogSourceKind): number {
  switch (source) {
    case 'live_api':
      return 0;
    case 'custom_model':
      return 1;
    case 'imported_model':
      return 2;
    case 'local_catalog':
      return 3;
    case 'provider_catalog':
      return 4;
    case 'fallback_catalog':
      return 5;
    default:
      return 99;
  }
}

export class ModelCatalogAggregationService {
  private readonly registry: ProviderIntegrationRegistry;

  constructor(options: { registry?: ProviderIntegrationRegistry | null } = {}) {
    this.registry = options.registry || getDefaultProviderIntegrationRegistry();
  }

  public aggregate(options: ModelCatalogAggregationOptions = {}): ModelCatalogAggregationResult {
    const generatedAt = options.generatedAt || new Date().toISOString();
    const activeProviderIds = new Set((options.activeProviderIds || []).map(normalizeId));
    const blockedProviderIds = new Set((options.blockedProviderIds || []).map(normalizeId));
    const registry = options.registry || this.registry;
    const providerCatalogs = [
      ...(options.includeRegistryModels === false ? [] : this.toProviderCatalogsFromRegistry(registry)),
      ...(options.providerCatalogs || []),
    ];
    const allCatalogs = [
      ...providerCatalogs.map((entry) => this.withSource(entry, 'provider_catalog')),
      ...(options.liveCatalogs || []).map((entry) => this.withSource(entry, 'live_api')),
      ...(options.localCatalogs || []).map((entry) => this.withSource(entry, 'local_catalog')),
      ...(options.fallbackCatalogs || []).map((entry) => this.withSource(entry, 'fallback_catalog')),
      ...(options.customCatalogs || []).map((entry) => this.withSource(entry, 'custom_model')),
    ];

    const models = new Map<string, AggregatedModelCatalogEntry>();
    for (const catalog of allCatalogs) {
      const providerId = normalizeId(catalog.providerId);
      if (!providerId || blockedProviderIds.has(providerId) || blockedProviderIds.has(normalizeId(catalog.alias))) {
        continue;
      }
      const route = registry.resolveRouteForProvider({
        id: catalog.routeId || catalog.providerId,
        effectiveProviderName: catalog.providerId,
        aliases: catalog.alias ? [catalog.alias] : [],
      });
      const providerAlias = normalizeText(catalog.alias, providerId);
      const providerLabel = normalizeText(catalog.label, route?.route.label || providerAlias);
      const routeId = normalizeText(catalog.routeId, route?.route.routeId || providerId);
      const familyId = normalizeText(catalog.familyId, route?.route.familyIds?.[0] || providerId);
      const active = catalog.active === true || activeProviderIds.has(providerId) || activeProviderIds.has(providerAlias);

      for (const inputModel of catalog.models || []) {
        const root = normalizeText(inputModel.id);
        if (!root) {
          continue;
        }
        const source = inputModel.imported ? 'imported_model'
          : inputModel.source || catalog.source || 'provider_catalog';
        const id = root.includes('/') ? root : `${providerAlias}/${root}`;
        const model: AggregatedModelCatalogEntry = {
          id,
          object: 'model',
          providerId,
          providerAlias,
          providerLabel,
          routeId,
          familyId,
          ownedBy: providerId,
          root: root.includes('/') ? root.split('/').slice(1).join('/') || root : root,
          parent: null,
          name: normalizeText(inputModel.name, root),
          type: inputModel.type || 'chat',
          custom: inputModel.custom === true || source === 'custom_model',
          imported: inputModel.imported === true || source === 'imported_model',
          source,
          active,
          capabilities: { ...(inputModel.capabilities || {}) },
          modalities: inputModel.modalities ? [...inputModel.modalities] : this.modalitiesForType(inputModel.type || 'chat'),
          contextLength: typeof inputModel.contextLength === 'number' ? inputModel.contextLength : null,
          dimensions: typeof inputModel.dimensions === 'number' ? inputModel.dimensions : null,
          supportedEndpoints: inputModel.supportedEndpoints ? [...inputModel.supportedEndpoints] : [],
          supportedSizes: inputModel.supportedSizes ? [...inputModel.supportedSizes] : [],
          subtype: normalizeText(inputModel.subtype) || null,
          apiFormat: normalizeText(inputModel.apiFormat) || null,
          raw: inputModel.raw,
        };
        this.putPreferredModel(models, model);
      }
    }

    const finalModels = Array.from(models.values()).sort((left, right) => {
      const providerCompare = left.providerAlias.localeCompare(right.providerAlias);
      return providerCompare || left.root.localeCompare(right.root);
    });
    const families = this.buildFamilies(finalModels, registry);
    const catalogs = this.buildCatalogsBySource(generatedAt, families);
    const sourceCounts = finalModels.reduce<Record<string, number>>((acc, model) => {
      acc[model.source] = (acc[model.source] || 0) + 1;
      return acc;
    }, {});

    return {
      schemaVersion: 1,
      generatedAt,
      catalogs,
      families,
      models: finalModels,
      sources: unique(finalModels.map((model) => model.source)),
      sourceCounts,
    };
  }

  public toLegacyModelsCatalog(result: ModelCatalogAggregationResult): LegacyModelsCatalog {
    const catalog: LegacyModelsCatalog = {};
    for (const model of result.models) {
      if (!catalog[model.providerAlias]) {
        catalog[model.providerAlias] = {
          provider: model.providerLabel,
          active: model.active,
          models: [],
        };
      }
      catalog[model.providerAlias].active = catalog[model.providerAlias].active || model.active;
      catalog[model.providerAlias].models.push({
        id: model.id,
        name: model.name,
        type: model.type,
        custom: model.custom,
        source: model.source,
      });
    }
    return catalog;
  }

  public toOpenAIModelsList(
    result: ModelCatalogAggregationResult,
    options: { timestamp?: number; activeOnly?: boolean } = {},
  ): OpenAIModelsListEntry[] {
    const timestamp = options.timestamp || Math.floor(Date.now() / 1000);
    return result.models
      .filter((model) => options.activeOnly === true ? model.active : true)
      .map((model) => ({
        id: model.id,
        object: 'model',
        created: timestamp,
        owned_by: model.ownedBy,
        permission: [],
        root: model.root,
        parent: model.parent,
        ...(model.type !== 'chat' ? { type: model.type } : {}),
        ...(model.custom ? { custom: true } : {}),
        ...(model.contextLength ? { context_length: model.contextLength } : {}),
        ...(model.dimensions ? { dimensions: model.dimensions } : {}),
        ...(Object.keys(model.capabilities).length > 0 ? { capabilities: model.capabilities } : {}),
        ...(model.modalities.length > 0 && (model.type !== 'chat' || model.modalities.includes('image'))
          ? { input_modalities: model.modalities }
          : {}),
        ...(model.modalities.length > 0 && (model.type !== 'chat' || model.modalities.includes('image'))
          ? { output_modalities: ['text'] as ModelModality[] }
          : {}),
        ...(model.supportedEndpoints.length > 0 ? { supported_endpoints: model.supportedEndpoints } : {}),
        ...(model.supportedSizes.length > 0 ? { supported_sizes: model.supportedSizes } : {}),
        ...(model.subtype ? { subtype: model.subtype } : {}),
        ...(model.apiFormat && model.apiFormat !== 'chat-completions' ? { api_format: model.apiFormat } : {}),
      }));
  }

  private toProviderCatalogsFromRegistry(registry: ProviderIntegrationRegistry): ModelCatalogProviderInput[] {
    return registry.listRoutes().flatMap((route) => {
      const providerModels = (route.models || []).map((model) => ({
        id: model.modelId,
        name: model.label,
        type: this.typeFromModalities(model.modalities || route.modalities),
        source: 'provider_catalog' as ModelCatalogSourceKind,
        capabilities: this.capabilityRecord(model.capabilities || route.capabilities),
        modalities: model.modalities || route.modalities,
      }));
      const family = registry.resolveFamily(route.familyIds[0])?.family;
      const fallbackModels = providerModels.length > 0
        ? []
        : unique([
          family?.defaultModelName || '',
          ...(family?.secondaryModelNames || []),
          ...(family?.fallbackModelNames || []),
        ]).map((modelId) => ({
          id: modelId,
          name: modelId,
          type: this.typeFromModalities(route.modalities),
          source: 'fallback_catalog' as ModelCatalogSourceKind,
          capabilities: this.capabilityRecord(route.capabilities),
          modalities: route.modalities,
        }));
      return [
        {
          providerId: route.providerId,
          alias: route.aliases?.[0] || route.routeId,
          label: route.label,
          source: 'provider_catalog' as ModelCatalogSourceKind,
          routeId: route.routeId,
          familyId: route.familyIds[0],
          active: false,
          models: [...providerModels, ...fallbackModels],
        },
      ];
    });
  }

  private buildFamilies(
    models: AggregatedModelCatalogEntry[],
    registry: ProviderIntegrationRegistry,
  ): ModelFamilyCatalogEntry[] {
    const byFamily = new Map<string, AggregatedModelCatalogEntry[]>();
    for (const model of models) {
      const list = byFamily.get(model.familyId) || [];
      list.push(model);
      byFamily.set(model.familyId, list);
    }

    return Array.from(byFamily.entries()).map(([familyId, familyModels]) => {
      const first = familyModels[0];
      const resolvedFamily = registry.resolveFamily(familyId)?.family;
      const routeIds = unique(familyModels.map((model) => model.routeId));
      return {
        id: familyId,
        label: resolvedFamily?.label || first.providerLabel,
        summary: resolvedFamily?.summary || `Catalogo agregado para ${first.providerLabel}.`,
        vendorId: resolvedFamily?.vendorId || first.providerId,
        providerIds: unique([...(resolvedFamily?.providerIds || []), ...familyModels.map((model) => model.providerId)]),
        defaultModelName: first.root || null,
        secondaryModelNames: familyModels.slice(1).map((model) => model.root),
        fallbackModelNames: resolvedFamily?.fallbackModelNames || [],
        primaryRouteId: routeIds[0],
        routeIds,
        visibility: resolvedFamily?.visibility || 'public',
        readiness: familyModels.some((model) => model.active) ? 'ready' : 'needs_config',
        ready: familyModels.some((model) => model.active),
        issue: familyModels.some((model) => model.active) ? null : 'Provider has no active connection in this catalog.',
        capabilities: unique([
          ...(resolvedFamily?.capabilities || []),
          ...familyModels.flatMap((model) => Object.entries(model.capabilities)
            .filter(([, enabled]) => enabled)
            .map(([capability]) => capability as ModelCapabilityKind)),
        ]),
        modalities: unique([
          ...(resolvedFamily?.modalities || []),
          ...familyModels.flatMap((model) => model.modalities),
        ]),
        limitations: [],
        catalogSource: familyModels.some((model) => model.source === 'live_api') ? 'live_api'
          : familyModels.some((model) => model.source === 'fallback_catalog') ? 'fallback_catalog'
            : 'provider_catalog',
      };
    });
  }

  private buildCatalogsBySource(
    generatedAt: string,
    families: ModelFamilyCatalogEntry[],
  ): ModelFamilyCatalog[] {
    const bySource = new Map<ProviderCatalogSource, ModelFamilyCatalogEntry[]>();
    for (const family of families) {
      const list = bySource.get(family.catalogSource) || [];
      list.push(family);
      bySource.set(family.catalogSource, list);
    }
    return Array.from(bySource.entries()).map(([source, sourceFamilies]) => ({
      schemaVersion: 1,
      generatedAt,
      families: sourceFamilies.map((family) => ({
        ...family,
        catalogSource: source,
      })),
    }));
  }

  private withSource(
    catalog: ModelCatalogProviderInput,
    source: ModelCatalogSourceKind,
  ): ModelCatalogProviderInput {
    return {
      ...catalog,
      source: catalog.source || source,
      models: (catalog.models || []).map((model) => ({
        ...model,
        source: model.source || catalog.source || source,
      })),
    };
  }

  private putPreferredModel(
    models: Map<string, AggregatedModelCatalogEntry>,
    next: AggregatedModelCatalogEntry,
  ): void {
    const existing = models.get(next.id);
    if (!existing || sourceRank(next.source) < sourceRank(existing.source)) {
      models.set(next.id, next);
    }
  }

  private modalitiesForType(type: AggregatedModelType): ModelModality[] {
    if (type === 'image') return ['image'];
    if (type === 'audio' || type === 'music') return ['audio'];
    if (type === 'video') return ['video'];
    if (type === 'embedding') return ['embedding'];
    return ['text'];
  }

  private typeFromModalities(modalities: ModelModality[] = []): AggregatedModelType {
    if (modalities.includes('embedding')) return 'embedding';
    if (modalities.includes('image')) return 'image';
    if (modalities.includes('audio')) return 'audio';
    if (modalities.includes('video')) return 'video';
    return 'chat';
  }

  private capabilityRecord(capabilities: ModelCapabilityKind[] = []): Partial<Record<ModelCapabilityKind, boolean>> {
    return capabilities.reduce<Partial<Record<ModelCapabilityKind, boolean>>>((acc, capability) => {
      acc[capability] = true;
      return acc;
    }, {});
  }
}
