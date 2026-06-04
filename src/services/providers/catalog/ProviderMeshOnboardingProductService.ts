import type {
  AccessRouteCatalogEntry,
  ModelCapabilityKind,
  ModelFamilyCatalogEntry,
  ModelPickerReadiness,
  ProviderCatalogSource,
  SelectedModelProfile,
} from './ProviderCatalogContracts.js';
import {
  ModelPickerService,
  type ModelPickerBuildOptions,
  type ModelPickerServiceResult,
} from './ModelPickerService.js';
import {
  ModelSelectionService,
  type ModelSelectionServiceResult,
} from './ModelSelectionService.js';
import {
  ProviderCompatibilityClassifier,
  type ProviderCompatibilityClassification,
} from './ProviderCompatibilityClassifier.js';
import {
  getDefaultProviderIntegrationRegistry,
  type ProviderIntegrationRegistry,
} from './ProviderIntegrationRegistry.js';
import type { ProviderIntegrationRouteManifest } from './ProviderIntegrationManifest.js';

export type ProviderMeshOnboardingConsumer =
  | 'onboarding'
  | 'providers_page'
  | 'control'
  | 'cli'
  | 'runtime_factory';

export type ProviderMeshCostModel =
  | 'provider_billed'
  | 'aggregator_billed'
  | 'partner_billed'
  | 'gateway_runtime'
  | 'local_runtime'
  | 'custom_runtime'
  | 'unknown';

export type ProviderMeshLatencyModel =
  | 'provider_network'
  | 'aggregator_network'
  | 'partner_network'
  | 'gateway_or_local'
  | 'local_machine'
  | 'custom_endpoint'
  | 'unknown';

export type ProviderMeshOnboardingQuestion = {
  id: 'capability';
  label: string;
  options: Array<{
    id: ModelCapabilityKind;
    label: string;
    ready: boolean;
  }>;
};

export type ProviderMeshCapabilitySuggestion = {
  capability: ModelCapabilityKind;
  label: string;
  readiness: ModelPickerReadiness;
  ready: boolean;
  familyIds: string[];
  routeIds: string[];
  modelIds: string[];
  selected: SelectedModelProfile | null;
  fallbackRouteIds: string[];
  catalogSources: ProviderCatalogSource[];
  authHealth: {
    readyRouteIds: string[];
    missingAuthRouteIds: string[];
    missingBaseUrlRouteIds: string[];
    needsProbeRouteIds: string[];
    unhealthyRouteIds: string[];
    requirements: string[];
  };
  costModel: ProviderMeshCostModel;
  latencyModel: ProviderMeshLatencyModel;
  limitations: string[];
  compatibility: ProviderCompatibilityClassification | null;
  explanation: string[];
};

export type ProviderMeshConceptSeparation = {
  family: boolean;
  vendor: boolean;
  provider: boolean;
  route: boolean;
  model: boolean;
  credential: boolean;
  explanation: string[];
};

export type ProviderMeshSurfaceConsistency = {
  contractName: 'ModelPickerContract';
  selectedProfileName: 'SelectedModelProfile';
  consumers: ProviderMeshOnboardingConsumer[];
  sameContractAcrossSurfaces: boolean;
  explanation: string[];
};

export type ProviderMeshOnboardingAcceptance = {
  asksByCapability: boolean;
  suggestsFamiliesRoutesModels: boolean;
  validatesAuthAndHealth: boolean;
  registersFallback: boolean;
  explainsCostLatencyLimitations: boolean;
  saysCatalogSource: boolean;
  sameContractAcrossSurfaces: boolean;
};

export type ProviderMeshIncompleteProvider = {
  providerId: string;
  routeId: string;
  label: string;
  reason: string;
};

export type ProviderMeshOnboardingProductSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  status: 'ready' | 'partial' | 'blocked';
  requestedCapability: ModelCapabilityKind | null;
  firstQuestion: ProviderMeshOnboardingQuestion;
  capabilities: ProviderMeshCapabilitySuggestion[];
  selectedCapability: ProviderMeshCapabilitySuggestion | null;
  conceptSeparation: ProviderMeshConceptSeparation;
  surfaceConsistency: ProviderMeshSurfaceConsistency;
  incompleteProviders: ProviderMeshIncompleteProvider[];
  acceptance: ProviderMeshOnboardingAcceptance;
  explanation: string[];
};

export type ProviderMeshOnboardingProductResult = {
  schemaVersion: 1;
  generatedAt: string;
  picker: ModelPickerServiceResult;
  providerMeshOnboarding: ProviderMeshOnboardingProductSnapshot;
};

export type ProviderMeshOnboardingProductOptions = ModelPickerBuildOptions & {
  requestedCapability?: ModelCapabilityKind | null;
  requireReady?: boolean;
  picker?: ModelPickerServiceResult | null;
};

type ProviderMeshOnboardingProductRuntime = {
  modelPickerService?: Pick<ModelPickerService, 'buildPicker'> | null;
  modelSelectionService?: Pick<ModelSelectionService, 'resolve'> | null;
  classifier?: ProviderCompatibilityClassifier | null;
  registry?: Pick<ProviderIntegrationRegistry, 'listRoutes'> | null;
};

const SURFACE_CONSUMERS: ProviderMeshOnboardingConsumer[] = [
  'onboarding',
  'providers_page',
  'control',
  'cli',
  'runtime_factory',
];

const CAPABILITY_LABELS: Partial<Record<ModelCapabilityKind, string>> = {
  chat: 'Conversa geral',
  coding: 'Codigo e debugging',
  reasoning: 'Raciocinio',
  research: 'Pesquisa',
  vision: 'Visao',
  audio: 'Audio',
  embedding: 'Embeddings',
  tool_use: 'Uso de ferramentas',
  streaming: 'Streaming',
  long_context: 'Contexto longo',
  local: 'Local/offline',
  budget: 'Baixo custo',
  multimodal: 'Multimodal',
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

function capabilityLabel(capability: ModelCapabilityKind): string {
  return CAPABILITY_LABELS[capability] || capability;
}

export class ProviderMeshOnboardingProductService {
  private readonly modelPickerService: Pick<ModelPickerService, 'buildPicker'>;
  private readonly modelSelectionService: Pick<ModelSelectionService, 'resolve'>;
  private readonly classifier: ProviderCompatibilityClassifier;
  private readonly registry: Pick<ProviderIntegrationRegistry, 'listRoutes'>;

  constructor(runtime: ProviderMeshOnboardingProductRuntime = {}) {
    this.modelPickerService = runtime.modelPickerService || new ModelPickerService();
    this.modelSelectionService = runtime.modelSelectionService || new ModelSelectionService();
    this.classifier = runtime.classifier || new ProviderCompatibilityClassifier();
    this.registry = runtime.registry || getDefaultProviderIntegrationRegistry();
  }

  public buildProduct(options: ProviderMeshOnboardingProductOptions = {}): ProviderMeshOnboardingProductResult {
    const {
      picker: providedPicker,
      requestedCapability,
      requireReady,
      ...pickerOptions
    } = options;
    const picker = providedPicker || this.modelPickerService.buildPicker(pickerOptions);
    const providerMeshOnboarding = this.buildSnapshotFromPicker(picker, {
      requestedCapability,
      requireReady,
      includeAdvanced: options.includeAdvanced,
    });

    return {
      schemaVersion: 1,
      generatedAt: picker.generatedAt,
      picker,
      providerMeshOnboarding,
    };
  }

  public buildSnapshot(options: ProviderMeshOnboardingProductOptions = {}): ProviderMeshOnboardingProductSnapshot {
    return this.buildProduct(options).providerMeshOnboarding;
  }

  private buildSnapshotFromPicker(
    picker: ModelPickerServiceResult,
    options: {
      requestedCapability?: ModelCapabilityKind | null;
      requireReady?: boolean;
      includeAdvanced?: boolean;
    },
  ): ProviderMeshOnboardingProductSnapshot {
    const capabilities = this.resolveCapabilities(picker)
      .map((capability) => this.buildCapabilitySuggestion(picker, capability, options.requireReady));
    const firstQuestion = this.buildFirstQuestion(capabilities);
    const requestedCapability = this.resolveRequestedCapability(options.requestedCapability, capabilities);
    const selectedCapability = requestedCapability
      ? capabilities.find((entry) => entry.capability === requestedCapability) || null
      : capabilities.find((entry) => entry.ready) || capabilities[0] || null;
    const conceptSeparation = this.buildConceptSeparation(picker);
    const surfaceConsistency = this.buildSurfaceConsistency();
    const incompleteProviders = this.findIncompleteProviders(picker, options.includeAdvanced === true);
    const acceptance = this.buildAcceptance({
      firstQuestion,
      capabilities,
      conceptSeparation,
      surfaceConsistency,
      incompleteProviders,
      routes: picker.contract.routes.routes,
    });
    const status = this.resolveStatus(acceptance, incompleteProviders, capabilities);

    return {
      schemaVersion: 1,
      generatedAt: picker.generatedAt,
      status,
      requestedCapability,
      firstQuestion,
      capabilities,
      selectedCapability,
      conceptSeparation,
      surfaceConsistency,
      incompleteProviders,
      acceptance,
      explanation: [
        'Provider Mesh C7 monta onboarding por capacidade antes de marca/provider.',
        'Familia, vendor, provider, rota, modelo e credencial permanecem campos separados no contrato.',
        'UI, CLI, onboarding, /dashboard e runtime continuam consumidores do ModelPickerContract.',
      ],
    };
  }

  private resolveCapabilities(picker: ModelPickerServiceResult): ModelCapabilityKind[] {
    const capabilities = unique([
      ...picker.contract.families.families.flatMap((family) => family.capabilities),
      ...picker.contract.routes.routes.flatMap((route) => route.capabilities),
    ]);
    return capabilities.sort((left, right) => capabilityLabel(left).localeCompare(capabilityLabel(right)));
  }

  private buildCapabilitySuggestion(
    picker: ModelPickerServiceResult,
    capability: ModelCapabilityKind,
    requireReady: boolean | undefined,
  ): ProviderMeshCapabilitySuggestion {
    const matchingRoutes = this.routesForCapability(picker.contract.routes.routes, capability);
    const matchingFamilies = this.familiesForCapability(picker.contract.families.families, matchingRoutes, capability);
    const selection = this.modelSelectionService.resolve({
      contract: picker.contract,
      requestedCapability: capability,
      requireReady: requireReady !== false,
    });
    const selectedRoute = picker.contract.routes.routes.find((route) => normalizeId(route.id) === normalizeId(selection.primary.routeId))
      || matchingRoutes[0]
      || null;
    const compatibility = selectedRoute ? this.classifier.classify(selectedRoute) : null;
    const readiness = this.resolveReadiness(matchingRoutes);

    return {
      capability,
      label: capabilityLabel(capability),
      readiness,
      ready: matchingRoutes.some((route) => route.ready),
      familyIds: matchingFamilies.map((family) => family.id),
      routeIds: matchingRoutes.map((route) => route.id),
      modelIds: this.resolveModelIds(selection, matchingFamilies, matchingRoutes),
      selected: selection.primary || null,
      fallbackRouteIds: unique([
        ...selection.compatibility.fallbackOrder,
        ...selection.fallbacks.map((fallback) => fallback.routeId),
        ...matchingRoutes.flatMap((route) => route.fallbackRouteIds),
      ]),
      catalogSources: unique(matchingRoutes.map((route) => route.catalogSource)),
      authHealth: this.buildAuthHealth(matchingRoutes),
      costModel: this.resolveCostModel(matchingRoutes, compatibility),
      latencyModel: this.resolveLatencyModel(matchingRoutes, compatibility),
      limitations: unique([
        ...matchingRoutes.flatMap((route) => route.limitations),
        ...(selection.primary.limitations || []),
      ]),
      compatibility,
      explanation: [
        `${capabilityLabel(capability)} pode usar ${matchingFamilies.length} familia(s), ${matchingRoutes.length} rota(s) e ${this.resolveModelIds(selection, matchingFamilies, matchingRoutes).length} modelo(s).`,
        selection.primary.ready
          ? `Sugestao primaria pronta: ${selection.primary.routeId}/${selection.primary.modelLabel}.`
          : `Sugestao primaria ainda precisa de configuracao: ${selection.primary.routeId}.`,
        this.describeCatalogSources(matchingRoutes),
      ],
    };
  }

  private routesForCapability(
    routes: AccessRouteCatalogEntry[],
    capability: ModelCapabilityKind,
  ): AccessRouteCatalogEntry[] {
    return routes
      .filter((route) => route.capabilities.includes(capability))
      .sort((left, right) => Number(right.ready === true) - Number(left.ready === true));
  }

  private familiesForCapability(
    families: ModelFamilyCatalogEntry[],
    routes: AccessRouteCatalogEntry[],
    capability: ModelCapabilityKind,
  ): ModelFamilyCatalogEntry[] {
    const routeFamilyIds = new Set(routes.flatMap((route) => route.familyIds).map(normalizeId));
    const routeIds = new Set(routes.map((route) => normalizeId(route.id)));
    return families.filter((family) => {
      return family.capabilities.includes(capability)
        || routeFamilyIds.has(normalizeId(family.id))
        || family.routeIds.map(normalizeId).some((routeId) => routeIds.has(routeId));
    });
  }

  private resolveModelIds(
    selection: ModelSelectionServiceResult,
    families: ModelFamilyCatalogEntry[],
    routes: AccessRouteCatalogEntry[],
  ): string[] {
    return unique([
      selection.primary.modelName || selection.primary.modelLabel,
      ...selection.secondary.map((entry) => entry.modelName || entry.modelLabel),
      ...routes.flatMap((route) => [
        route.currentModelName || '',
        ...route.secondaryModelNames,
        ...route.fallbackModelNames,
      ]),
      ...families.flatMap((family) => [
        family.defaultModelName || '',
        ...family.secondaryModelNames,
        ...family.fallbackModelNames,
      ]),
    ]);
  }

  private buildAuthHealth(routes: AccessRouteCatalogEntry[]): ProviderMeshCapabilitySuggestion['authHealth'] {
    return {
      readyRouteIds: routes.filter((route) => route.ready).map((route) => route.id),
      missingAuthRouteIds: routes.filter((route) => route.readinessCode === 'missing_auth').map((route) => route.id),
      missingBaseUrlRouteIds: routes.filter((route) => route.readinessCode === 'missing_base_url').map((route) => route.id),
      needsProbeRouteIds: routes.filter((route) => route.readinessCode === 'needs_probe').map((route) => route.id),
      unhealthyRouteIds: routes.filter((route) => route.readinessCode === 'unhealthy').map((route) => route.id),
      requirements: unique(routes.flatMap((route) => [...route.requirements, ...route.credentialRefs])),
    };
  }

  private resolveReadiness(routes: AccessRouteCatalogEntry[]): ModelPickerReadiness {
    if (routes.some((route) => route.ready)) {
      return 'ready';
    }
    if (routes.some((route) => route.readiness === 'needs_probe')) {
      return 'needs_probe';
    }
    return 'needs_config';
  }

  private resolveCostModel(
    routes: AccessRouteCatalogEntry[],
    compatibility: ProviderCompatibilityClassification | null,
  ): ProviderMeshCostModel {
    if (compatibility?.kind === 'local_self_hosted') return 'local_runtime';
    if (compatibility?.kind === 'gateway') return 'gateway_runtime';
    if (compatibility?.routeKind === 'official') return 'provider_billed';
    if (compatibility?.routeKind === 'aggregator') return 'aggregator_billed';
    if (compatibility?.routeKind === 'partner') return 'partner_billed';
    if (compatibility?.routeKind === 'custom_compatible') return 'custom_runtime';
    if (compatibility?.routeKind === 'local_runtime') return 'local_runtime';

    const routeKinds = routes.map((route) => route.routeKind);
    if (routeKinds.includes('local_runtime')) return 'local_runtime';
    if (routeKinds.includes('aggregator')) return 'aggregator_billed';
    if (routeKinds.includes('partner')) return 'partner_billed';
    if (routeKinds.includes('custom_compatible')) return 'custom_runtime';
    if (routeKinds.includes('official')) return 'provider_billed';
    return 'unknown';
  }

  private resolveLatencyModel(
    routes: AccessRouteCatalogEntry[],
    compatibility: ProviderCompatibilityClassification | null,
  ): ProviderMeshLatencyModel {
    if (compatibility?.kind === 'local_self_hosted') return 'local_machine';
    if (compatibility?.kind === 'gateway') return 'gateway_or_local';
    if (compatibility?.routeKind === 'official') return 'provider_network';
    if (compatibility?.routeKind === 'aggregator') return 'aggregator_network';
    if (compatibility?.routeKind === 'partner') return 'partner_network';
    if (compatibility?.routeKind === 'custom_compatible') return 'custom_endpoint';
    if (compatibility?.routeKind === 'local_runtime') return 'local_machine';

    const routeKinds = routes.map((route) => route.routeKind);
    if (routeKinds.includes('local_runtime')) return 'local_machine';
    if (routeKinds.includes('aggregator')) return 'aggregator_network';
    if (routeKinds.includes('partner')) return 'partner_network';
    if (routeKinds.includes('custom_compatible')) return 'custom_endpoint';
    if (routeKinds.includes('official')) return 'provider_network';
    return 'unknown';
  }

  private describeCatalogSources(routes: AccessRouteCatalogEntry[]): string {
    const sources = unique(routes.map((route) => route.catalogSource));
    if (sources.length === 0) {
      return 'Nenhuma origem de catalogo foi encontrada para esta capacidade.';
    }
    return `Origem de catalogo: ${sources.join(', ')}.`;
  }

  private buildFirstQuestion(capabilities: ProviderMeshCapabilitySuggestion[]): ProviderMeshOnboardingQuestion {
    return {
      id: 'capability',
      label: 'Qual capacidade voce quer priorizar?',
      options: capabilities.map((entry) => ({
        id: entry.capability,
        label: entry.label,
        ready: entry.ready,
      })),
    };
  }

  private resolveRequestedCapability(
    requestedCapability: ModelCapabilityKind | null | undefined,
    capabilities: ProviderMeshCapabilitySuggestion[],
  ): ModelCapabilityKind | null {
    const normalized = normalizeId(requestedCapability);
    if (!normalized) {
      return null;
    }
    return capabilities.find((entry) => normalizeId(entry.capability) === normalized)?.capability || null;
  }

  private buildConceptSeparation(picker: ModelPickerServiceResult): ProviderMeshConceptSeparation {
    const families = picker.contract.families.families;
    const routes = picker.contract.routes.routes;
    const selected = picker.contract.selected;
    const hasFamilies = families.length > 0;
    const hasRoutes = routes.length > 0;
    const explanation = [
      'familyId descreve a familia exibida ao usuario.',
      'vendorId descreve a origem comercial/tecnica.',
      'providerId descreve quem executa a chamada.',
      'routeId descreve o caminho de acesso concreto.',
      'modelId/modelName descreve o modelo escolhido.',
      'credentialRef/credentialKind descrevem requisito de acesso sem expor segredo.',
    ];

    return {
      family: hasFamilies && families.every((family) => Boolean(family.id)),
      vendor: hasFamilies && families.every((family) => Boolean(family.vendorId)) && routes.every((route) => Boolean(route.vendorId)),
      provider: hasRoutes && routes.every((route) => Boolean(route.providerId && route.providerName)),
      route: hasRoutes && routes.every((route) => Boolean(route.id && route.routeKind)),
      model: Boolean('modelName' in selected) && routes.every((route) => 'currentModelName' in route),
      credential: hasRoutes && routes.every((route) => Boolean(route.credentialKind && Array.isArray(route.credentialRefs))),
      explanation,
    };
  }

  private buildSurfaceConsistency(): ProviderMeshSurfaceConsistency {
    return {
      contractName: 'ModelPickerContract',
      selectedProfileName: 'SelectedModelProfile',
      consumers: [...SURFACE_CONSUMERS],
      sameContractAcrossSurfaces: true,
      explanation: [
        'Cada surface pode renderizar diferente, mas nao deve recomputar familia/rota/modelo.',
        'O runtime factory recebe SelectedModelProfile ou compat equivalente.',
      ],
    };
  }

  private findIncompleteProviders(
    picker: ModelPickerServiceResult,
    includeAdvanced: boolean,
  ): ProviderMeshIncompleteProvider[] {
    const contractRouteIds = new Set(picker.contract.routes.routes.map((route) => normalizeId(route.id)));
    return this.registry.listRoutes()
      .filter((route) => includeAdvanced || route.visibility !== 'advanced')
      .filter((route) => !contractRouteIds.has(normalizeId(route.routeId)))
      .map((route: ProviderIntegrationRouteManifest) => ({
        providerId: route.providerId,
        routeId: route.routeId,
        label: route.label,
        reason: 'Provider/rota existe no registry, mas nao chegou ao ModelPickerContract.',
      }));
  }

  private buildAcceptance(input: {
    firstQuestion: ProviderMeshOnboardingQuestion;
    capabilities: ProviderMeshCapabilitySuggestion[];
    conceptSeparation: ProviderMeshConceptSeparation;
    surfaceConsistency: ProviderMeshSurfaceConsistency;
    incompleteProviders: ProviderMeshIncompleteProvider[];
    routes: AccessRouteCatalogEntry[];
  }): ProviderMeshOnboardingAcceptance {
    return {
      asksByCapability: input.firstQuestion.id === 'capability' && input.capabilities.length > 0,
      suggestsFamiliesRoutesModels: input.capabilities.some((entry) => (
        entry.familyIds.length > 0 && entry.routeIds.length > 0 && entry.modelIds.length > 0
      )),
      validatesAuthAndHealth: input.routes.every((route) => Boolean(route.readinessCode) && typeof route.ready === 'boolean'),
      registersFallback: input.capabilities.some((entry) => entry.fallbackRouteIds.length > 0),
      explainsCostLatencyLimitations: input.capabilities.every((entry) => Boolean(entry.costModel && entry.latencyModel && entry.explanation.length > 0)),
      saysCatalogSource: input.capabilities.every((entry) => entry.catalogSources.length > 0),
      sameContractAcrossSurfaces: input.surfaceConsistency.sameContractAcrossSurfaces && input.incompleteProviders.length === 0,
    };
  }

  private resolveStatus(
    acceptance: ProviderMeshOnboardingAcceptance,
    incompleteProviders: ProviderMeshIncompleteProvider[],
    capabilities: ProviderMeshCapabilitySuggestion[],
  ): ProviderMeshOnboardingProductSnapshot['status'] {
    if (capabilities.length === 0) {
      return 'blocked';
    }
    const allAccepted = Object.values(acceptance).every((value) => value === true);
    if (allAccepted && incompleteProviders.length === 0) {
      return 'ready';
    }
    return 'partial';
  }
}
