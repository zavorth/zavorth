import type {
  AccessRouteCatalogEntry,
  AccessRouteClass,
  ModelCapabilityKind,
  ModelPickerContract,
  ModelPickerReadiness,
  ProviderCatalogSource,
  ProviderRouteKind,
  SelectedModelProfile,
} from '../../contracts/ModelPickerContract.js';
import {
  ModelCatalogAggregationService,
  type AggregatedModelCatalogEntry,
  type ModelCatalogAggregationResult,
} from '../../services/providers/catalog/ModelCatalogAggregationService.js';
import {
  AccessRouteResolutionService,
  type AccessRouteResolutionResult,
} from '../../services/providers/catalog/AccessRouteResolutionService.js';
import {
  ModelPickerService,
  type ModelPickerServiceResult,
} from '../../services/providers/catalog/ModelPickerService.js';
import {
  ModelSelectionService,
  type ModelSelectionServiceResult,
} from '../../services/providers/catalog/ModelSelectionService.js';
import {
  ProviderIntegrationRegistry,
  getDefaultProviderIntegrationRegistry,
  type ProviderIntegrationRegistrySnapshot,
} from '../../services/providers/catalog/ProviderIntegrationRegistry.js';
import {
  ProviderMeshOnboardingProductService,
  type ProviderMeshOnboardingProductResult,
} from '../../services/providers/catalog/ProviderMeshOnboardingProductService.js';
import {
  ProviderFactory,
  type ProviderFactoryCreateInput,
  type ProviderFactoryRuntimeTarget,
} from '../../providers/ProviderFactory.js';
import type { UniversalAgentRun } from './UniversalAgentRuntimeTypes.js';

export const PROVIDER_MESH_CONSOLIDATION_CONTRACT_VERSION = '2026-05-04.provider-mesh' as const;

export type ProviderMeshConsolidationStatus = 'ready' | 'partial' | 'blocked';

export type ProviderMeshConsolidatedRoute = {
  id: string;
  label: string;
  providerId: string;
  providerName: string;
  routeKind: ProviderRouteKind;
  routeClass: AccessRouteClass | 'unknown';
  readiness: ModelPickerReadiness;
  ready: boolean;
  issue: string | null;
  familyIds: string[];
  modelCount: number;
  catalogSource: ProviderCatalogSource;
  fallbackRouteIds: string[];
  runtime: {
    adapterKind: string;
    runtimeSupported: boolean;
    firstClassProvider: boolean;
    genericCompatible: boolean;
  };
};

export type ProviderMeshConsolidatedFamily = {
  id: string;
  label: string;
  ready: boolean;
  readiness: ModelPickerReadiness;
  routeCount: number;
  readyRouteCount: number;
  modelCount: number;
  capabilities: ModelCapabilityKind[];
  selected: boolean;
};

export type ProviderMeshConsolidatedSelection = {
  familyId: string | null;
  routeId: string | null;
  modelId: string | null;
  providerName: string | null;
  providerLabel: string | null;
  modelName: string | null;
  modelLabel: string | null;
  ready: boolean;
  source: SelectedModelProfile['source'] | 'unknown';
  fallbackRouteIds: string[];
  fallbackOrder: string[];
  runtimeFactory: {
    adapterKind: string;
    runtimeSupported: boolean;
    firstClassProvider: boolean;
    genericCompatible: boolean;
    explanation: string[];
  };
};

export type ProviderMeshConsolidationReceipt = {
  id: string;
  kind:
    | 'contracts'
    | 'registry'
    | 'model-catalog'
    | 'route-resolution'
    | 'model-picker'
    | 'model-selection'
    | 'onboarding'
    | 'provider-factory'
    | 'provider-arena'
    | 'policy';
  source: string;
  detail: string;
  status: 'ready' | 'partial' | 'missing';
};

export type ProviderMeshConsolidationSnapshot = {
  contractVersion: typeof PROVIDER_MESH_CONSOLIDATION_CONTRACT_VERSION;
  source: 'ProviderMeshConsolidationService';
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status: ProviderMeshConsolidationStatus;
  summary: {
    manifestCount: number;
    familyCount: number;
    routeCount: number;
    readyRouteCount: number;
    modelCount: number;
    customModelCount: number;
    importedModelCount: number;
    incompleteProviderCount: number;
    selectedReady: boolean;
    providerArenaLinked: boolean;
    p0ExtraComplete: boolean;
  };
  p0ExtraCoverage: {
    canonicalContracts: boolean;
    providerIntegrationRegistry: boolean;
    modelCatalogAggregation: boolean;
    accessRouteResolution: boolean;
    modelPicker: boolean;
    modelSelection: boolean;
    providerFactory: boolean;
    onboarding: boolean;
  };
  selected: ProviderMeshConsolidatedSelection;
  families: ProviderMeshConsolidatedFamily[];
  routes: ProviderMeshConsolidatedRoute[];
  modelSources: Record<string, number>;
  onboarding: {
    status: 'ready' | 'partial' | 'blocked';
    requestedCapability: ModelCapabilityKind | null;
    firstQuestionId: string;
    capabilityCount: number;
    selectedCapability: ModelCapabilityKind | null;
    sameContractAcrossSurfaces: boolean;
    consumers: string[];
  };
  receipts: ProviderMeshConsolidationReceipt[];
  policy: {
    noProviderExecutionPerformed: true;
    modelPickerContractIsSourceOfTruth: true;
    providerFactoryUsesSelectedProfile: true;
    catalogDoesNotCreateRuntimeAdapter: true;
    noLegacyProviderSwitch: true;
    onboardingAsksCapabilityFirst: true;
    secretsSerialized: false;
  };
  surface: {
    cliCommand: string;
    dashboardPath: string;
    pickerHint: string;
    onboardingHint: string;
  };
  nextSafeAction: string;
};

export type ProviderMeshConsolidationInput = {
  run: UniversalAgentRun;
  modelPickerContract?: ModelPickerContract | null;
  generatedAt?: string | null;
};

type ProviderMeshConsolidationRuntime = {
  now?: () => Date;
  registry?: ProviderIntegrationRegistry | null;
  modelPickerService?: Pick<ModelPickerService, 'buildPicker'> | null;
  modelCatalogAggregationService?: Pick<ModelCatalogAggregationService, 'aggregate'> | null;
  accessRouteResolutionService?: Pick<AccessRouteResolutionService, 'resolveRoutes'> | null;
  modelSelectionService?: Pick<ModelSelectionService, 'resolve'> | null;
  onboardingService?: Pick<ProviderMeshOnboardingProductService, 'buildProduct'> | null;
  providerFactoryResolver?: ((input: ProviderFactoryCreateInput) => ProviderFactoryRuntimeTarget) | null;
  modelPickerContractService?: { buildContract(options?: { includeAdvanced?: boolean }): ModelPickerContract } | null;
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeKey(value: unknown, fallback = ''): string {
  return normalizeText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function compactList(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean)));
}

function resolveRequestedCapability(run: UniversalAgentRun): ModelCapabilityKind | null {
  const discovery = recordOrNull(run.metadata.naturalCapabilityDiscovery);
  const rawIntent = normalizeKey(discovery?.intentCategory || run.metadata.requestedCapability);
  if (rawIntent.includes('code') || rawIntent.includes('debug')) {
    return 'coding';
  }
  if (rawIntent.includes('research') || rawIntent.includes('search')) {
    return 'research';
  }
  if (rawIntent.includes('vision') || rawIntent.includes('image')) {
    return 'vision';
  }
  if (rawIntent.includes('audio')) {
    return 'audio';
  }
  if (rawIntent.includes('tool')) {
    return 'tool_use';
  }
  if (rawIntent.includes('reason')) {
    return 'reasoning';
  }
  return null;
}

function modelsForRoute(route: AccessRouteCatalogEntry, aggregation: ModelCatalogAggregationResult): AggregatedModelCatalogEntry[] {
  const routeId = normalizeKey(route.id);
  const providerId = normalizeKey(route.providerId);
  const familyIds = route.familyIds.map((familyId) => normalizeKey(familyId));
  return aggregation.models.filter((model) => {
    return normalizeKey(model.routeId) === routeId
      || (normalizeKey(model.providerId) === providerId && familyIds.includes(normalizeKey(model.familyId)));
  });
}

function sourceCounts(models: AggregatedModelCatalogEntry[]): Record<string, number> {
  return models.reduce<Record<string, number>>((acc, model) => {
    acc[model.source] = (acc[model.source] || 0) + 1;
    return acc;
  }, {});
}

function sanitizeRuntimeTarget(target: ProviderFactoryRuntimeTarget): ProviderMeshConsolidatedSelection['runtimeFactory'] {
  return {
    adapterKind: target.adapterKind,
    runtimeSupported: target.runtimeSupported,
    firstClassProvider: target.firstClassProvider,
    genericCompatible: target.genericCompatible,
    explanation: target.explanation.slice(0, 6),
  };
}

function selectionInput(profile: SelectedModelProfile): ProviderFactoryCreateInput {
  return {
    ...profile,
    modelName: profile.modelName,
    modelLabel: profile.modelLabel,
  };
}

function routeInput(route: AccessRouteCatalogEntry): ProviderFactoryCreateInput {
  return {
    providerName: route.providerName,
    providerId: route.providerId,
    providerLabel: route.label,
    routeId: route.id,
    routeKind: route.routeKind,
    modelName: route.currentModelName,
    modelLabel: route.currentModelName || route.label,
    familyId: route.familyIds[0],
    credentialKind: route.credentialKind,
    credentialRef: route.credentialRefs[0] || null,
    catalogSource: route.catalogSource,
    readiness: route.readiness,
    ready: route.ready,
    fallbackRouteIds: route.fallbackRouteIds,
    fallbackOrder: route.fallbackRouteIds,
    capabilities: route.capabilities,
    modalities: route.modalities,
    limitations: route.limitations,
    baseUrlRef: route.baseUrlRef,
  };
}

export class ProviderMeshConsolidationService {
  private readonly now: () => Date;
  private readonly registry: ProviderIntegrationRegistry;
  private readonly modelPickerService: Pick<ModelPickerService, 'buildPicker'>;
  private readonly modelCatalogAggregationService: Pick<ModelCatalogAggregationService, 'aggregate'>;
  private readonly accessRouteResolutionService: Pick<AccessRouteResolutionService, 'resolveRoutes'>;
  private readonly modelSelectionService: Pick<ModelSelectionService, 'resolve'>;
  private readonly onboardingService: Pick<ProviderMeshOnboardingProductService, 'buildProduct'>;
  private readonly providerFactoryResolver: (input: ProviderFactoryCreateInput) => ProviderFactoryRuntimeTarget;

  constructor(runtime: ProviderMeshConsolidationRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.registry = runtime.registry || getDefaultProviderIntegrationRegistry();
    this.modelPickerService = runtime.modelPickerService || new ModelPickerService({
      contractService: runtime.modelPickerContractService || undefined,
    });
    this.modelCatalogAggregationService = runtime.modelCatalogAggregationService || new ModelCatalogAggregationService({
      registry: this.registry,
    });
    this.accessRouteResolutionService = runtime.accessRouteResolutionService || new AccessRouteResolutionService({
      registry: this.registry,
    });
    this.modelSelectionService = runtime.modelSelectionService || new ModelSelectionService();
    this.onboardingService = runtime.onboardingService || new ProviderMeshOnboardingProductService({
      modelPickerService: this.modelPickerService,
      modelSelectionService: this.modelSelectionService,
      registry: this.registry,
    });
    this.providerFactoryResolver = runtime.providerFactoryResolver || ((input) => ProviderFactory.resolveRuntimeTarget(input));
  }

  public buildSnapshot(input: ProviderMeshConsolidationInput): ProviderMeshConsolidationSnapshot {
    const generatedAt = normalizeText(input.generatedAt, this.now().toISOString());
    const registrySnapshot = this.registry.buildSnapshot();
    const routeResolution = this.accessRouteResolutionService.resolveRoutes({
      includeAdvanced: true,
      generatedAt,
    });
    const aggregation = this.modelCatalogAggregationService.aggregate({
      generatedAt,
      includeRegistryModels: true,
      activeProviderIds: routeResolution.routes
        .filter((route) => route.ready)
        .flatMap((route) => [route.id, route.providerId, route.providerName, ...route.aliases]),
    });
    const picker = this.modelPickerService.buildPicker({
      includeAdvanced: true,
    });
    const requestedCapability = resolveRequestedCapability(input.run);
    const selection = this.modelSelectionService.resolve({
      contract: input.modelPickerContract || picker.contract,
      requestedCapability,
      requireReady: false,
      fallbackOrder: picker.contract.selected.fallbackOrder,
    });
    const onboarding = this.onboardingService.buildProduct({
      picker,
      requestedCapability,
      requireReady: false,
      includeAdvanced: true,
    });
    const selectedRuntimeTarget = this.providerFactoryResolver(selectionInput(selection.selected));
    const routes = this.buildRoutes(routeResolution, aggregation);
    const families = this.buildFamilies(picker, aggregation, selection);
    const status = this.resolveStatus({
      routeResolution,
      selection,
      onboarding,
      registrySnapshot,
    });
    const p0ExtraCoverage = {
      canonicalContracts: true,
      providerIntegrationRegistry: registrySnapshot.manifestCount > 0,
      modelCatalogAggregation: aggregation.models.length > 0,
      accessRouteResolution: routeResolution.routes.length > 0,
      modelPicker: picker.families.length > 0,
      modelSelection: Boolean(selection.selected.routeId),
      providerFactory: selectedRuntimeTarget.runtimeSupported,
      onboarding: onboarding.providerMeshOnboarding.acceptance.sameContractAcrossSurfaces,
    };
    const p0ExtraComplete = Object.values(p0ExtraCoverage).every(Boolean);
    const providerArenaLinked = Boolean(recordOrNull(input.run.metadata.providerArena));
    const incompleteProviderCount = onboarding.providerMeshOnboarding.incompleteProviders.length;

    return {
      contractVersion: PROVIDER_MESH_CONSOLIDATION_CONTRACT_VERSION,
      source: 'ProviderMeshConsolidationService',
      generatedAt,
      identifiers: {
        runId: input.run.id,
        traceId: input.run.traceId,
        requestId: input.run.requestId,
        sessionId: input.run.sessionId,
      },
      status,
      summary: {
        manifestCount: registrySnapshot.manifestCount,
        familyCount: picker.families.length,
        routeCount: routeResolution.summary.totalRoutes,
        readyRouteCount: routeResolution.summary.readyRoutes,
        modelCount: aggregation.models.length,
        customModelCount: aggregation.models.filter((model) => model.custom).length,
        importedModelCount: aggregation.models.filter((model) => model.imported).length,
        incompleteProviderCount,
        selectedReady: selection.selected.ready,
        providerArenaLinked,
        p0ExtraComplete,
      },
      p0ExtraCoverage,
      selected: {
        familyId: selection.selected.familyId || null,
        routeId: selection.selected.routeId || null,
        modelId: selection.selected.identity?.modelId || selection.selected.modelName || null,
        providerName: selection.selected.providerName || null,
        providerLabel: selection.selected.providerLabel || null,
        modelName: selection.selected.modelName || null,
        modelLabel: selection.selected.modelLabel || null,
        ready: selection.selected.ready,
        source: selection.selected.source || 'unknown',
        fallbackRouteIds: [...(selection.selected.fallbackRouteIds || [])],
        fallbackOrder: [...selection.compatibility.fallbackOrder],
        runtimeFactory: sanitizeRuntimeTarget(selectedRuntimeTarget),
      },
      families,
      routes,
      modelSources: sourceCounts(aggregation.models),
      onboarding: {
        status: onboarding.providerMeshOnboarding.status,
        requestedCapability: onboarding.providerMeshOnboarding.requestedCapability,
        firstQuestionId: onboarding.providerMeshOnboarding.firstQuestion.id,
        capabilityCount: onboarding.providerMeshOnboarding.capabilities.length,
        selectedCapability: onboarding.providerMeshOnboarding.selectedCapability?.capability || null,
        sameContractAcrossSurfaces: onboarding.providerMeshOnboarding.surfaceConsistency.sameContractAcrossSurfaces,
        consumers: [...onboarding.providerMeshOnboarding.surfaceConsistency.consumers],
      },
      receipts: this.buildReceipts({
        input,
        registrySnapshot,
        aggregation,
        routeResolution,
        picker,
        selection,
        onboarding,
        selectedRuntimeTarget,
        providerArenaLinked,
      }),
      policy: {
        noProviderExecutionPerformed: true,
        modelPickerContractIsSourceOfTruth: true,
        providerFactoryUsesSelectedProfile: true,
        catalogDoesNotCreateRuntimeAdapter: true,
        noLegacyProviderSwitch: true,
        onboardingAsksCapabilityFirst: true,
        secretsSerialized: false,
      },
      surface: {
        cliCommand: `zavorth provider-mesh run ${input.run.id} --json`,
        dashboardPath: '/dashboard?sector=config',
        pickerHint: 'Use o Model Picker para escolher familia, rota e modelo pelo mesmo contrato em todas as surfaces.',
        onboardingHint: 'Onboarding pergunta primeiro pela capability desejada, depois sugere provider/modelo.',
      },
      nextSafeAction: this.resolveNextSafeAction({
        status,
        selection,
        incompleteProviderCount,
        providerArenaLinked,
      }),
    };
  }

  private buildRoutes(
    routeResolution: AccessRouteResolutionResult,
    aggregation: ModelCatalogAggregationResult,
  ): ProviderMeshConsolidatedRoute[] {
    return routeResolution.routes.slice(0, 18).map((route) => {
      const target = this.providerFactoryResolver(routeInput(route));
      return {
        id: route.id,
        label: route.label,
        providerId: route.providerId,
        providerName: route.providerName,
        routeKind: route.routeKind,
        routeClass: route.routeClass || 'unknown',
        readiness: route.readiness,
        ready: route.ready,
        issue: route.issue,
        familyIds: [...route.familyIds],
        modelCount: modelsForRoute(route, aggregation).length,
        catalogSource: route.catalogSource,
        fallbackRouteIds: [...route.fallbackRouteIds],
        runtime: {
          adapterKind: target.adapterKind,
          runtimeSupported: target.runtimeSupported,
          firstClassProvider: target.firstClassProvider,
          genericCompatible: target.genericCompatible,
        },
      };
    });
  }

  private buildFamilies(
    picker: ModelPickerServiceResult,
    aggregation: ModelCatalogAggregationResult,
    selection: ModelSelectionServiceResult,
  ): ProviderMeshConsolidatedFamily[] {
    return picker.families.slice(0, 14).map((family) => {
      const routeIds = new Set(family.routes.map((route) => normalizeKey(route.id)));
      return {
        id: family.id,
        label: family.label,
        ready: family.ready,
        readiness: family.readiness,
        routeCount: family.routes.length,
        readyRouteCount: family.routes.filter((route) => route.ready).length,
        modelCount: aggregation.models.filter((model) => routeIds.has(normalizeKey(model.routeId))).length,
        capabilities: [...family.capabilities],
        selected: normalizeKey(selection.selected.familyId) === normalizeKey(family.id),
      };
    });
  }

  private resolveStatus(input: {
    routeResolution: AccessRouteResolutionResult;
    selection: ModelSelectionServiceResult;
    onboarding: ProviderMeshOnboardingProductResult;
    registrySnapshot: ProviderIntegrationRegistrySnapshot;
  }): ProviderMeshConsolidationStatus {
    if (input.registrySnapshot.manifestCount === 0 || input.routeResolution.summary.totalRoutes === 0) {
      return 'blocked';
    }
    if (
      !input.selection.selected.ready
      || input.onboarding.providerMeshOnboarding.status !== 'ready'
      || input.routeResolution.summary.blockedRoutes > 0
    ) {
      return 'partial';
    }
    return 'ready';
  }

  private buildReceipts(input: {
    input: ProviderMeshConsolidationInput;
    registrySnapshot: ProviderIntegrationRegistrySnapshot;
    aggregation: ModelCatalogAggregationResult;
    routeResolution: AccessRouteResolutionResult;
    picker: ModelPickerServiceResult;
    selection: ModelSelectionServiceResult;
    onboarding: ProviderMeshOnboardingProductResult;
    selectedRuntimeTarget: ProviderFactoryRuntimeTarget;
    providerArenaLinked: boolean;
  }): ProviderMeshConsolidationReceipt[] {
    return [
      {
        id: `provider-mesh:${input.input.run.id}:contracts`,
        kind: 'contracts',
        source: 'ModelPickerContract',
        detail: 'Contratos canonicos de familia, rota, modelo e perfil selecionado estao ligados.',
        status: 'ready',
      },
      {
        id: `provider-mesh:${input.input.run.id}:registry`,
        kind: 'registry',
        source: 'ProviderIntegrationRegistry',
        detail: `${input.registrySnapshot.manifestCount} manifest(s), ${input.registrySnapshot.routeCount} rota(s), ${input.registrySnapshot.familyCount} familia(s).`,
        status: input.registrySnapshot.manifestCount > 0 ? 'ready' : 'missing',
      },
      {
        id: `provider-mesh:${input.input.run.id}:model-catalog`,
        kind: 'model-catalog',
        source: 'ModelCatalogAggregationService',
        detail: `${input.aggregation.models.length} modelo(s) agregados de ${input.aggregation.sources.length} fonte(s).`,
        status: input.aggregation.models.length > 0 ? 'ready' : 'partial',
      },
      {
        id: `provider-mesh:${input.input.run.id}:routes`,
        kind: 'route-resolution',
        source: 'AccessRouteResolutionService',
        detail: `${input.routeResolution.summary.readyRoutes}/${input.routeResolution.summary.totalRoutes} rota(s) prontas.`,
        status: input.routeResolution.summary.totalRoutes > 0 ? 'ready' : 'missing',
      },
      {
        id: `provider-mesh:${input.input.run.id}:picker`,
        kind: 'model-picker',
        source: 'ModelPickerService',
        detail: `${input.picker.families.length} familia(s) expostas pelo picker.`,
        status: input.picker.families.length > 0 ? 'ready' : 'missing',
      },
      {
        id: `provider-mesh:${input.input.run.id}:selection`,
        kind: 'model-selection',
        source: 'ModelSelectionService',
        detail: `Selecionado ${input.selection.selected.providerLabel}/${input.selection.selected.modelLabel}.`,
        status: input.selection.selected.ready ? 'ready' : 'partial',
      },
      {
        id: `provider-mesh:${input.input.run.id}:onboarding`,
        kind: 'onboarding',
        source: 'ProviderMeshOnboardingProductService',
        detail: `${input.onboarding.providerMeshOnboarding.capabilities.length} capability suggestion(s); surfaces usam o mesmo contrato.`,
        status: input.onboarding.providerMeshOnboarding.status === 'ready'
          ? 'ready'
          : input.onboarding.providerMeshOnboarding.status === 'blocked'
            ? 'missing'
            : 'partial',
      },
      {
        id: `provider-mesh:${input.input.run.id}:provider-factory`,
        kind: 'provider-factory',
        source: 'ProviderFactory.resolveRuntimeTarget',
        detail: `Adapter ${input.selectedRuntimeTarget.adapterKind}; runtimeSupported=${String(input.selectedRuntimeTarget.runtimeSupported)}.`,
        status: input.selectedRuntimeTarget.runtimeSupported ? 'ready' : 'partial',
      },
      {
        id: `provider-mesh:${input.input.run.id}:provider-arena`,
        kind: 'provider-arena',
        source: 'ProviderArenaService',
        detail: input.providerArenaLinked
          ? 'Provider Arena esta vinculada para comparar rota, budget e fallback.'
          : 'Provider Arena ainda nao publicou evidencia para este run.',
        status: input.providerArenaLinked ? 'ready' : 'partial',
      },
      {
        id: `provider-mesh:${input.input.run.id}:policy`,
        kind: 'policy',
        source: 'ProviderMeshConsolidationService',
        detail: 'Snapshot e read-only: nao executa provider, nao troca modelo e nao serializa secrets.',
        status: 'ready',
      },
    ];
  }

  private resolveNextSafeAction(input: {
    status: ProviderMeshConsolidationStatus;
    selection: ModelSelectionServiceResult;
    incompleteProviderCount: number;
    providerArenaLinked: boolean;
  }): string {
    if (input.status === 'blocked') {
      return 'Reparar registry/rotas antes de expor provider mesh como fonte canonica.';
    }
    if (!input.selection.selected.ready) {
      return 'Completar credenciais/base URL/probe da rota selecionada antes de usar como default.';
    }
    if (input.incompleteProviderCount > 0) {
      return 'Finalizar onboarding dos providers incompletos antes de marcar como stable.';
    }
    if (!input.providerArenaLinked) {
      return 'Executar ou observar uma rota real para alimentar Provider Arena com budget, health e fallback.';
    }
    return 'Usar Provider Mesh como fonte canonica para picker, onboarding, ProviderFactory e surfaces.';
  }
}
