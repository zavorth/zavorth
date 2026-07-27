import type {
  AccessRouteCatalogEntry,
  ModelCapabilityKind,
  ModelFamilyCatalogEntry,
  ModelModality,
  ModelPickerContract,
  ModelPickerContractBuildOptions,
  ModelPickerReadiness,
  ProviderCatalogSource,
} from './ProviderCatalogContracts.js';
import {
  ModelCatalogAggregationService,
  type AggregatedModelCatalogEntry,
  type ModelCatalogAggregationResult,
} from './ModelCatalogAggregationService.js';
import { ModelPickerExplainabilityService } from './ModelPickerExplainabilityService.js';


import { ModelPickerContractService } from '../../../domain/providers/index.js';

export type ModelPickerBuildOptions = ModelPickerContractBuildOptions & {
  selectedFamilyId?: string | null;
  selectedRouteId?: string | null;
  selectedModelId?: string | null;
};

export type ModelPickerModelOption = {
  id: string;
  modelId: string;
  label: string;
  routeId: string;
  familyId: string;
  providerId: string;
  source: ProviderCatalogSource;
  primary: boolean;
  custom: boolean;
  imported: boolean;
  modalities: ModelModality[];
  capabilities: ModelCapabilityKind[];
};

export type ModelPickerRouteOption = {
  id: string;
  label: string;
  providerId: string;
  providerName: string;
  routeKind: AccessRouteCatalogEntry['routeKind'];
  routeClass: AccessRouteCatalogEntry['routeClass'];
  readiness: ModelPickerReadiness;
  readinessCode: AccessRouteCatalogEntry['readinessCode'];
  ready: boolean;
  issue: string | null;
  credentialRefs: string[];
  baseUrlRef: string | null;
  catalogSource: ProviderCatalogSource;
  discoverySupported: boolean;
  models: ModelPickerModelOption[];
  explanation: string[];
};

export type ModelPickerFamilyOption = {
  id: string;
  label: string;
  summary: string;
  vendorId: string;
  ready: boolean;
  readiness: ModelPickerReadiness;
  defaultModelName: string | null;
  primaryRouteId: string;
  capabilities: ModelCapabilityKind[];
  modalities: ModelModality[];
  routes: ModelPickerRouteOption[];
  explanation: string[];
};

export type ModelPickerSelectedOption = {
  familyId: string | null;
  routeId: string | null;
  modelId: string | null;
  providerId: string | null;
  ready: boolean;
  explanation: string[];
};

export type ModelPickerServiceResult = {
  schemaVersion: 1;
  generatedAt: string;
  contract: ModelPickerContract;
  families: ModelPickerFamilyOption[];
  selected: ModelPickerSelectedOption;
  explanation: string[];
};

type ModelPickerRuntime = {
  contractService?: Pick<ModelPickerContractService, 'buildContract'> | null;
  modelCatalogAggregationService?: Pick<ModelCatalogAggregationService, 'aggregate'> | null;
  explainabilityService?: ModelPickerExplainabilityService | null;
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

function readinessForRoutes(routes: AccessRouteCatalogEntry[], fallback: ModelPickerReadiness): ModelPickerReadiness {
  if (routes.some((route) => route.ready)) {
    return 'ready';
  }
  if (routes.some((route) => route.readiness === 'needs_probe')) {
    return 'needs_probe';
  }
  return fallback;
}

export class ModelPickerService {
  private readonly contractService: Pick<ModelPickerContractService, 'buildContract'>;
  private readonly modelCatalogAggregationService: Pick<ModelCatalogAggregationService, 'aggregate'>;
  private readonly explainabilityService: ModelPickerExplainabilityService;

  constructor(runtime: ModelPickerRuntime = {}) {
    this.contractService = runtime.contractService || new ModelPickerContractService();
    this.modelCatalogAggregationService = runtime.modelCatalogAggregationService || new ModelCatalogAggregationService();
    this.explainabilityService = runtime.explainabilityService || new ModelPickerExplainabilityService();
  }

  public buildPicker(options: ModelPickerBuildOptions = {}): ModelPickerServiceResult {
    const baseContract = this.contractService.buildContract({
      includeAdvanced: options.includeAdvanced === true,
      selectedTarget: options.selectedTarget,
      profileId: options.profileId,
    });
    const activeProviderIds = unique(baseContract.routes.routes
      .filter((route) => route.ready)
      .flatMap((route) => [route.id, route.providerId, route.providerName, ...route.aliases]));
    const aggregation = this.modelCatalogAggregationService.aggregate({
      generatedAt: baseContract.generatedAt,
      includeRegistryModels: true,
      activeProviderIds,
    });
    const contract = this.buildCanonicalContract(baseContract, aggregation);
    const families = this.buildFamilyOptions(contract, aggregation);
    const selected = this.resolveSelectedOption(families, contract, options);

    return {
      schemaVersion: 1,
      generatedAt: contract.generatedAt,
      contract,
      families,
      selected,
      explanation: [
        'ModelPickerService montou familia, route e model a partir do contrato canonical.',
        ...selected.explanation,
      ],
    };
  }

  private buildCanonicalContract(
    contract: ModelPickerContract,
    aggregation: ModelCatalogAggregationResult,
  ): ModelPickerContract {
    const byFamily = new Map<string, ModelFamilyCatalogEntry>();
    for (const family of aggregation.families) {
      byFamily.set(normalizeId(family.id), this.withRouteReadiness(family, contract.routes.routes));
    }
    for (const family of contract.families.families) {
      const key = normalizeId(family.id);
      const existing = byFamily.get(key);
      byFamily.set(key, existing ? this.mergeFamily(existing, family, contract.routes.routes) : this.withRouteReadiness(family, contract.routes.routes));
    }

    return {
      ...contract,
      families: {
        schemaVersion: 1,
        generatedAt: contract.generatedAt,
        families: Array.from(byFamily.values())
          .filter((family) => family.visibility !== 'advanced' || contract.routes.routes.some((route) => {
            return route.familyIds.map(normalizeId).includes(normalizeId(family.id))
              || family.routeIds.map(normalizeId).includes(normalizeId(route.id));
          }))
          .sort((left, right) => left.label.localeCompare(right.label)),
      },
    };
  }

  private buildFamilyOptions(
    contract: ModelPickerContract,
    aggregation: ModelCatalogAggregationResult,
  ): ModelPickerFamilyOption[] {
    return contract.families.families.map((family) => {
      const routes = this.routesForFamily(family, contract.routes.routes);
      const routeOptions = routes.map((route) => this.toRouteOption(route, aggregation));
      const primaryRoute = routeOptions.find((route) => route.ready)
        || routeOptions.find((route) => normalizeId(route.id) === normalizeId(family.primaryRouteId))
        || routeOptions[0]
        || null;
      return {
        id: family.id,
        label: family.label,
        summary: family.summary,
        vendorId: family.vendorId,
        ready: routeOptions.some((route) => route.ready),
        readiness: readinessForRoutes(routes, family.readiness),
        defaultModelName: family.defaultModelName,
        primaryRouteId: primaryRoute?.id || family.primaryRouteId,
        capabilities: [...family.capabilities],
        modalities: [...family.modalities],
        routes: routeOptions,
        explanation: this.explainabilityService.describeFamily(family, routes),
      };
    });
  }

  private toRouteOption(
    route: AccessRouteCatalogEntry,
    aggregation: ModelCatalogAggregationResult,
  ): ModelPickerRouteOption {
    const models = this.modelsForRoute(route, aggregation);
    return {
      id: route.id,
      label: route.label,
      providerId: route.providerId,
      providerName: route.providerName,
      routeKind: route.routeKind,
      routeClass: route.routeClass,
      readiness: route.readiness,
      readinessCode: route.readinessCode,
      ready: route.ready,
      issue: route.issue,
      credentialRefs: [...route.credentialRefs],
      baseUrlRef: route.baseUrlRef || null,
      catalogSource: route.catalogSource,
      discoverySupported: route.discoverySupported === true,
      models,
      explanation: this.explainabilityService.describeRoute({
        route,
        modelCount: models.length,
      }),
    };
  }

  private modelsForRoute(
    route: AccessRouteCatalogEntry,
    aggregation: ModelCatalogAggregationResult,
  ): ModelPickerModelOption[] {
    const familyIds = route.familyIds.map(normalizeId);
    const routeModels = aggregation.models.filter((model) => {
      return normalizeId(model.routeId) === normalizeId(route.id)
        || (familyIds.includes(normalizeId(model.familyId)) && normalizeId(model.providerId) === normalizeId(route.providerId));
    });
    const fromCatalog = routeModels.map((model, index) => this.toModelOption(model, route, index === 0));
    const existingModelIds = new Set(fromCatalog.flatMap((model) => [normalizeId(model.id), normalizeId(model.modelId)]));
    const fallbackModels = unique([
      route.currentModelName || '',
      ...route.secondaryModelNames,
      ...route.fallbackModelNames,
    ])
      .filter((modelId) => !existingModelIds.has(normalizeId(modelId)))
      .map((modelId, index) => ({
        id: `${route.id}/${modelId}`,
        modelId,
        label: modelId,
        routeId: route.id,
        familyId: route.familyIds[0] || route.id,
        providerId: route.providerId,
        source: route.catalogSource,
        primary: fromCatalog.length === 0 && index === 0,
        custom: false,
        imported: false,
        modalities: [...route.modalities],
        capabilities: [...route.capabilities],
      }));

    return [...fromCatalog, ...fallbackModels];
  }

  private toModelOption(
    model: AggregatedModelCatalogEntry,
    route: AccessRouteCatalogEntry,
    primary: boolean,
  ): ModelPickerModelOption {
    return {
      id: model.id,
      modelId: model.root,
      label: model.name,
      routeId: route.id,
      familyId: model.familyId,
      providerId: model.providerId,
      source: model.source,
      primary,
      custom: model.custom,
      imported: model.imported,
      modalities: [...model.modalities],
      capabilities: Object.entries(model.capabilities)
        .filter(([, enabled]) => enabled === true)
        .map(([capability]) => capability as ModelCapabilityKind),
    };
  }

  private resolveSelectedOption(
    families: ModelPickerFamilyOption[],
    contract: ModelPickerContract,
    options: ModelPickerBuildOptions,
  ): ModelPickerSelectedOption {
    const family = this.findFamily(families, options.selectedFamilyId)
      || this.findFamily(families, contract.selected.familyId)
      || families.find((entry) => entry.ready)
      || families[0]
      || null;
    const route = family
      ? this.findRoute(family.routes, options.selectedRouteId)
        || this.findRoute(family.routes, contract.selected.routeId)
        || family.routes.find((entry) => entry.ready)
        || family.routes[0]
        || null
      : null;
    const model = route
      ? this.findModel(route.models, options.selectedModelId)
        || this.findModel(route.models, contract.selected.modelName)
        || route.models.find((entry) => entry.primary)
        || route.models[0]
        || null
      : null;

    return {
      familyId: family?.id || null,
      routeId: route?.id || null,
      modelId: model?.modelId || null,
      providerId: route?.providerId || null,
      ready: route?.ready === true,
      explanation: [
        family ? `Familia selecionada: ${family.label}.` : 'No familia available.',
        route ? `Rota selecionada: ${route.label}.` : 'No route available.',
        model ? `Selected model: ${model.label}.` : 'No model enumerado.',
      ],
    };
  }

  private withRouteReadiness(
    family: ModelFamilyCatalogEntry,
    routes: AccessRouteCatalogEntry[],
  ): ModelFamilyCatalogEntry {
    const familyRoutes = this.routesForFamily(family, routes);
    const ready = familyRoutes.some((route) => route.ready);
    const readiness = readinessForRoutes(familyRoutes, family.readiness);
    const primaryRoute = familyRoutes.find((route) => route.ready)
      || familyRoutes.find((route) => normalizeId(route.id) === normalizeId(family.primaryRouteId))
      || familyRoutes[0];
    return {
      ...family,
      ready,
      readiness,
      issue: ready ? null : familyRoutes.find((route) => route.issue)?.issue || family.issue,
      primaryRouteId: primaryRoute?.id || family.primaryRouteId,
      routeIds: unique([...family.routeIds, ...familyRoutes.map((route) => route.id)]),
      fallbackModelNames: [...family.fallbackModelNames],
      limitations: unique([
        ...family.limitations,
        ...familyRoutes.flatMap((route) => route.limitations),
      ]),
    };
  }

  private mergeFamily(
    left: ModelFamilyCatalogEntry,
    right: ModelFamilyCatalogEntry,
    routes: AccessRouteCatalogEntry[],
  ): ModelFamilyCatalogEntry {
    return this.withRouteReadiness({
      ...left,
      summary: left.summary || right.summary,
      providerIds: unique([...left.providerIds, ...right.providerIds]),
      defaultModelName: left.defaultModelName || right.defaultModelName,
      secondaryModelNames: unique([...left.secondaryModelNames, ...right.secondaryModelNames]),
      fallbackModelNames: unique([...left.fallbackModelNames, ...right.fallbackModelNames]),
      routeIds: unique([...left.routeIds, ...right.routeIds]),
      capabilities: unique([...left.capabilities, ...right.capabilities]),
      modalities: unique([...left.modalities, ...right.modalities]),
      limitations: unique([...left.limitations, ...right.limitations]),
    }, routes);
  }

  private routesForFamily(
    family: ModelFamilyCatalogEntry,
    routes: AccessRouteCatalogEntry[],
  ): AccessRouteCatalogEntry[] {
    const familyId = normalizeId(family.id);
    const routeIds = family.routeIds.map(normalizeId);
    return routes.filter((route) => {
      return route.familyIds.map(normalizeId).includes(familyId)
        || routeIds.includes(normalizeId(route.id));
    });
  }

  private findFamily(families: ModelPickerFamilyOption[], familyId: unknown): ModelPickerFamilyOption | null {
    const normalized = normalizeId(familyId);
    return normalized ? families.find((family) => normalizeId(family.id) === normalized) || null : null;
  }

  private findRoute(routes: ModelPickerRouteOption[], routeId: unknown): ModelPickerRouteOption | null {
    const normalized = normalizeId(routeId);
    return normalized ? routes.find((route) => normalizeId(route.id) === normalized) || null : null;
  }

  private findModel(models: ModelPickerModelOption[], modelId: unknown): ModelPickerModelOption | null {
    const normalized = normalizeId(modelId);
    return normalized
      ? models.find((model) => normalizeId(model.id) === normalized || normalizeId(model.modelId) === normalized) || null
      : null;
  }
}
