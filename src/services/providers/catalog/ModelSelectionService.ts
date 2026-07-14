import type {
  AccessRouteCatalogEntry,
  ModelCapabilityKind,
  ModelFamilyCatalogEntry,
  ModelPickerContract,
  ProviderMeshIdentity,
  SelectedModelProfile,
} from '../../../contracts/ModelPickerContract.js';

export type ModelSelectionServiceInput = {
  contract: ModelPickerContract;
  selectedFamilyId?: string | null;
  selectedRouteId?: string | null;
  selectedModelId?: string | null;
  selectedTarget?: string | null;
  requestedCapability?: ModelCapabilityKind | null;
  requireReady?: boolean;
  fallbackOrder?: string[];
};

export type ModelSelectionServiceResult = {
  schemaVersion: 1;
  generatedAt: string;
  primary: SelectedModelProfile;
  selected: SelectedModelProfile;
  secondary: SelectedModelProfile[];
  fallbacks: SelectedModelProfile[];
  compatibility: {
    providerName: string;
    modelName: string | null;
    fallbackOrder: string[];
  };
  explanation: string[];
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

function routeKeys(route: AccessRouteCatalogEntry): string[] {
  return unique([
    route.id,
    route.providerId,
    route.providerName,
    route.label,
    ...route.aliases,
  ].map(normalizeId));
}

export class ModelSelectionService {
  public resolve(input: ModelSelectionServiceInput): ModelSelectionServiceResult {
    const contract = input.contract;
    const route = this.resolvePrimaryRoute(input);
    if (!route) {
      return this.fromExistingSelection(contract, input);
    }

    const family = this.resolveFamilyForRoute(contract, route, input.selectedFamilyId);
    const modelName = this.resolvePrimaryModelName({
      family,
      route,
      selectedModelId: input.selectedModelId,
      existing: contract.selected.modelName,
    });
    const fallbackRoutes = this.resolveFallbackRoutes(input, route);
    const source = input.selectedTarget || input.selectedFamilyId || input.selectedRouteId || input.selectedModelId
      ? 'target-selection'
      : contract.selected.source;
    const primary = this.toSelectedModelProfile({
      contract,
      family,
      route,
      modelName,
      source,
      fallbackOrder: input.fallbackOrder,
      fallbackRouteIds: fallbackRoutes.map((entry) => entry.id),
      explanation: this.describePrimarySelection({ family, route, modelName, input }),
    });
    const secondary = this.resolveSecondaryProfiles({
      contract,
      family,
      route,
      primaryModelName: modelName,
      source,
    });
    const fallbacks = fallbackRoutes.map((fallbackRoute) => {
      const fallbackFamily = this.resolveFamilyForRoute(contract, fallbackRoute, null);
      return this.toSelectedModelProfile({
        contract,
        family: fallbackFamily,
        route: fallbackRoute,
        modelName: this.resolvePrimaryModelName({
          family: fallbackFamily,
          route: fallbackRoute,
          selectedModelId: null,
          existing: null,
        }),
        source,
        fallbackOrder: input.fallbackOrder,
        fallbackRouteIds: fallbackRoute.fallbackRouteIds,
        explanation: [
          `Fallback canonico: ${fallbackFamily?.label || fallbackRoute.id}.`,
          `Rota fallback: ${fallbackRoute.label}.`,
        ],
      });
    });

    return {
      schemaVersion: 1,
      generatedAt: contract.generatedAt,
      primary,
      selected: primary,
      secondary,
      fallbacks,
      compatibility: {
        providerName: primary.providerName,
        modelName: primary.modelName,
        fallbackOrder: unique([
          ...primary.fallbackOrder,
          ...fallbacks.map((entry) => entry.providerName),
        ]).filter((entry) => entry !== primary.providerName),
      },
      explanation: [
        ...primary.explanation,
        secondary.length > 0
          ? `Modelos secundarios: ${secondary.map((entry) => entry.modelLabel).join(', ')}.`
          : 'Nenhum modelo secundario declarado para a rota.',
        fallbacks.length > 0
          ? `Fallbacks canonicals: ${fallbacks.map((entry) => `${entry.routeId}/${entry.modelLabel}`).join(', ')}.`
          : 'Nenhum fallback canonico declarado para a selecao.',
      ],
    };
  }

  private fromExistingSelection(
    contract: ModelPickerContract,
    input: ModelSelectionServiceInput,
  ): ModelSelectionServiceResult {
    const selected = contract.selected;
    return {
      schemaVersion: 1,
      generatedAt: contract.generatedAt,
      primary: selected,
      selected,
      secondary: [],
      fallbacks: [],
      compatibility: {
        providerName: selected.providerName,
        modelName: selected.modelName,
        fallbackOrder: [...(input.fallbackOrder || selected.fallbackOrder)],
      },
      explanation: [
        ...selected.explanation,
        'ModelSelectionService preservou a selecao existente porque nenhuma rota canonica foi resolvida.',
      ],
    };
  }

  private resolvePrimaryRoute(input: ModelSelectionServiceInput): AccessRouteCatalogEntry | null {
    const contract = input.contract;
    const routes = contract.routes.routes;
    const family = this.findFamily(contract, input.selectedFamilyId);
    const familyRouteIds = family ? new Set(family.routeIds.map(normalizeId)) : null;
    const requestedRoute = this.findRoute(contract, input.selectedRouteId)
      || this.findRoute(contract, input.selectedTarget);
    if (requestedRoute && (!familyRouteIds || familyRouteIds.has(normalizeId(requestedRoute.id)) || requestedRoute.familyIds.map(normalizeId).includes(normalizeId(family?.id)))) {
      return requestedRoute;
    }

    const selectedRoute = this.findRoute(contract, contract.selected.routeId);
    if (family) {
      return routes.find((route) => {
        return route.ready === true
          && (familyRouteIds?.has(normalizeId(route.id)) || route.familyIds.map(normalizeId).includes(normalizeId(family.id)));
      })
        || routes.find((route) => familyRouteIds?.has(normalizeId(route.id)) || route.familyIds.map(normalizeId).includes(normalizeId(family.id)))
        || null;
    }

    if (input.requestedCapability) {
      const candidates = routes
        .filter((route) => route.capabilities.includes(input.requestedCapability as ModelCapabilityKind))
        .sort((left, right) => Number(right.ready === true) - Number(left.ready === true));
      const capabilityRoute = input.requireReady === false
        ? candidates[0]
        : candidates.find((route) => route.ready === true) || candidates[0];
      if (capabilityRoute) {
        return capabilityRoute;
      }
    }

    return selectedRoute
      || routes.find((route) => route.ready === true)
      || routes[0]
      || null;
  }

  private resolveFallbackRoutes(
    input: ModelSelectionServiceInput,
    primaryRoute: AccessRouteCatalogEntry,
  ): AccessRouteCatalogEntry[] {
    const contract = input.contract;
    const targets = unique([
      ...(input.fallbackOrder || []),
      ...primaryRoute.fallbackRouteIds,
      ...input.contract.selected.fallbackRouteIds,
      ...input.contract.selected.fallbackOrder,
    ]);
    return targets
      .map((target) => this.findRoute(contract, target))
      .filter((route): route is AccessRouteCatalogEntry => Boolean(route))
      .filter((route) => normalizeId(route.id) !== normalizeId(primaryRoute.id));
  }

  private resolveSecondaryProfiles(input: {
    contract: ModelPickerContract;
    family: ModelFamilyCatalogEntry | null;
    route: AccessRouteCatalogEntry;
    primaryModelName: string | null;
    source: SelectedModelProfile['source'];
  }): SelectedModelProfile[] {
    const modelNames = unique([
      ...input.route.secondaryModelNames,
      ...(input.family?.secondaryModelNames || []),
    ]).filter((modelName) => normalizeId(modelName) !== normalizeId(input.primaryModelName));
    return modelNames.map((modelName) => this.toSelectedModelProfile({
      contract: input.contract,
      family: input.family,
      route: input.route,
      modelName,
      source: input.source,
      fallbackOrder: input.route.fallbackRouteIds,
      fallbackRouteIds: input.route.fallbackRouteIds,
      explanation: [
        `Modelo secundario ${modelName} na familia ${input.family?.label || input.route.id}.`,
        `Rota compartilhada: ${input.route.label}.`,
      ],
    }));
  }

  private toSelectedModelProfile(input: {
    contract: ModelPickerContract;
    family: ModelFamilyCatalogEntry | null;
    route: AccessRouteCatalogEntry;
    modelName: string | null;
    source: SelectedModelProfile['source'];
    fallbackOrder?: string[] | null;
    fallbackRouteIds: string[];
    explanation: string[];
  }): SelectedModelProfile {
    const familyId = input.family?.id || input.route.familyIds[0] || input.route.id;
    const modelLabel = input.modelName || input.route.currentModelName || input.route.label;
    const fallbackRouteIds = unique(input.fallbackRouteIds);
    const fallbackOrder = unique([
      ...(input.fallbackOrder || []),
      ...fallbackRouteIds,
    ]).filter((entry) => normalizeId(entry) !== normalizeId(input.route.id));
    const identity: ProviderMeshIdentity = {
      familyId,
      vendorId: input.route.vendorId,
      providerId: input.route.providerId,
      routeId: input.route.id,
      routeKind: input.route.routeKind,
      modelId: input.modelName,
      credentialRef: input.route.credentialRefs[0] || null,
      credentialKind: input.route.credentialKind,
      catalogSource: input.route.catalogSource,
    };

    return {
      schemaVersion: 1,
      source: input.source,
      providerName: input.route.providerName,
      providerLabel: input.route.label,
      modelName: input.modelName,
      modelLabel,
      routeId: input.route.id,
      familyId,
      vendorId: input.route.vendorId,
      providerId: input.route.providerId,
      routeKind: input.route.routeKind,
      credentialKind: input.route.credentialKind,
      credentialRef: input.route.credentialRefs[0] || null,
      catalogSource: input.route.catalogSource,
      readiness: input.route.readiness,
      ready: input.route.ready,
      fallbackOrder,
      fallbackRouteIds,
      capabilities: [...input.route.capabilities],
      modalities: [...input.route.modalities],
      limitations: [...input.route.limitations],
      identity,
      explanation: input.explanation,
    };
  }

  private resolvePrimaryModelName(input: {
    family: ModelFamilyCatalogEntry | null;
    route: AccessRouteCatalogEntry;
    selectedModelId: string | null | undefined;
    existing: string | null | undefined;
  }): string | null {
    return normalizeText(input.selectedModelId)
      || normalizeText(input.existing)
      || input.route.currentModelName
      || input.family?.defaultModelName
      || input.route.secondaryModelNames[0]
      || input.family?.secondaryModelNames[0]
      || input.route.fallbackModelNames[0]
      || input.family?.fallbackModelNames[0]
      || null;
  }

  private describePrimarySelection(input: {
    family: ModelFamilyCatalogEntry | null;
    route: AccessRouteCatalogEntry;
    modelName: string | null;
    input: ModelSelectionServiceInput;
  }): string[] {
    return [
      `Familia selecionada: ${input.family?.label || input.route.familyIds[0] || input.route.id}.`,
      `Rota selecionada: ${input.route.label} (${input.route.routeKind}).`,
      `Modelo principal: ${input.modelName || input.route.currentModelName || 'nao informado'}.`,
      input.input.requestedCapability
        ? `Capability solicitada: ${input.input.requestedCapability}.`
        : 'Selecao feita sem capability obrigatoria.',
    ];
  }

  private resolveFamilyForRoute(
    contract: ModelPickerContract,
    route: AccessRouteCatalogEntry,
    requestedFamilyId: string | null | undefined,
  ): ModelFamilyCatalogEntry | null {
    return this.findFamily(contract, requestedFamilyId)
      || contract.families.families.find((family) => {
        return family.routeIds.map(normalizeId).includes(normalizeId(route.id))
          || route.familyIds.map(normalizeId).includes(normalizeId(family.id));
      })
      || null;
  }

  private findFamily(contract: ModelPickerContract, familyId: unknown): ModelFamilyCatalogEntry | null {
    const normalized = normalizeId(familyId);
    return normalized
      ? contract.families.families.find((family) => normalizeId(family.id) === normalized) || null
      : null;
  }

  private findRoute(contract: ModelPickerContract, routeId: unknown): AccessRouteCatalogEntry | null {
    const normalized = normalizeId(routeId);
    return normalized
      ? contract.routes.routes.find((route) => routeKeys(route).includes(normalized)) || null
      : null;
  }
}
