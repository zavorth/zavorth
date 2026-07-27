import type {
  AccessRouteCatalog,
  AccessRouteCatalogEntry,
  ModelCapabilityKind,
  ModelFamilyCatalog,
  ModelFamilyCatalogEntry,
  ModelModality,
  ModelPickerCandidate,
  ModelPickerContract,
  ModelPickerProfileEntry,
  ModelPickerReadiness,
  ModelPickerSelectionInput,
  ModelPickerSelectionResult,
  ProviderCatalogSource,
  ProviderCredentialKind,
  ProviderMeshIdentity,
  ProviderRouteKind,
  SelectedModelProfile,
} from './ProviderCatalogContracts.js';
import type {
  ProviderCatalogEntry,
  ProviderControlPlaneSelection,
  ProviderProfile,
} from '../../ProviderControlPlaneService.js';
import type { ProviderIntegrationRouteResolution } from './ProviderIntegrationRegistry.js';
import { getDefaultProviderIntegrationRegistry } from './ProviderIntegrationRegistry.js';

export type ProviderCatalogCompatBuildInput = {
  generatedAt: string;
  providers: ProviderCatalogEntry[];
  profiles: ProviderProfile[];
  selected: SelectedModelProfile;
  routes?: AccessRouteCatalog | null;
};

export type ProviderCatalogSelectionProfileInput = {
  source: SelectedModelProfile['source'];
  selection: ProviderControlPlaneSelection;
  providers: ProviderCatalogEntry[];
  fallbackOrder: string[];
  explanation: string[];
  modelName: string | null;
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeId(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function resolveRouteIntegration(entry: ProviderCatalogEntry): ProviderIntegrationRouteResolution | null {
  return getDefaultProviderIntegrationRegistry().resolveRouteForProvider({
    id: entry.id,
    effectiveProviderName: entry.effectiveProviderName,
    aliases: entry.aliases,
  });
}

function primaryModelFromRoute(resolution: ProviderIntegrationRouteResolution | null): string | null {
  const model = resolution?.route.models?.find((entry) => entry.primary) || resolution?.route.models?.[0];
  return model?.modelId || null;
}

function secondaryModelsFromRoute(resolution: ProviderIntegrationRouteResolution | null): string[] {
  return (resolution?.route.models || [])
    .filter((entry) => !entry.primary)
    .map((entry) => entry.modelId);
}

function familyForRoute(resolution: ProviderIntegrationRouteResolution | null) {
  if (!resolution) {
    return null;
  }
  return resolution.manifest.families.find((family) => {
    return resolution.route.familyIds.includes(family.familyId);
  }) || resolution.manifest.families[0] || null;
}

export function buildProviderCatalogContract(input: ProviderCatalogCompatBuildInput): ModelPickerContract {
  return {
    schemaVersion: 1,
    generatedAt: input.generatedAt,
    families: toModelFamilyCatalog(input.providers, input.generatedAt),
    routes: input.routes || toAccessRouteCatalog(input.providers, input.generatedAt),
    profiles: input.profiles.map(toModelPickerProfileEntry),
    selected: input.selected,
  };
}

export function toModelFamilyCatalog(
  providers: ProviderCatalogEntry[],
  generatedAt: string,
): ModelFamilyCatalog {
  return {
    schemaVersion: 1,
    generatedAt,
    families: providers.map(toModelFamilyCatalogEntry),
  };
}

export function toAccessRouteCatalog(
  providers: ProviderCatalogEntry[],
  generatedAt: string,
): AccessRouteCatalog {
  return {
    schemaVersion: 1,
    generatedAt,
    routes: providers.map((entry) => toAccessRouteCatalogEntry(entry)),
  };
}

export function toModelFamilyCatalogEntry(entry: ProviderCatalogEntry): ModelFamilyCatalogEntry {
  const resolution = resolveRouteIntegration(entry);
  const family = familyForRoute(resolution);
  const route = resolution?.route || null;
  const identity = toProviderMeshIdentity(entry, entry.currentModel);
  return {
    id: entry.id,
    label: entry.label,
    summary: entry.summary,
    vendorId: family?.vendorId || identity.vendorId,
    providerIds: unique([...(family?.providerIds || []), identity.providerId, entry.effectiveProviderName].filter(Boolean)),
    defaultModelName: entry.currentModel || family?.defaultModelName || primaryModelFromRoute(resolution),
    secondaryModelNames: family?.secondaryModelNames || secondaryModelsFromRoute(resolution),
    fallbackModelNames: family?.fallbackModelNames || [],
    primaryRouteId: route?.routeId || entry.id,
    routeIds: unique([route?.routeId || entry.id, entry.id]),
    visibility: entry.visibility,
    readiness: entry.readiness,
    ready: entry.ready,
    issue: entry.issue,
    capabilities: family?.capabilities || route?.capabilities || inferCapabilities(entry),
    modalities: family?.modalities || route?.modalities || inferModalities(entry),
    limitations: inferLimitations(entry, route?.limitations || []),
    catalogSource: family?.catalogSource || route?.catalogSource || identity.catalogSource,
  };
}

export function toAccessRouteCatalogEntry(entry: ProviderCatalogEntry): AccessRouteCatalogEntry {
  const resolution = resolveRouteIntegration(entry);
  const route = resolution?.route || null;
  const identity = toProviderMeshIdentity(entry, entry.currentModel);
  return {
    id: entry.id,
    label: entry.label,
    familyIds: route?.familyIds || [entry.id],
    vendorId: route?.vendorId || identity.vendorId,
    providerId: route?.providerId || identity.providerId,
    providerName: entry.effectiveProviderName,
    routeKind: route?.routeKind || identity.routeKind,
    mode: entry.mode,
    aliases: unique([...entry.aliases, ...(route?.aliases || [])]),
    requirements: [...entry.requirements],
    credentialKind: route?.authKind || identity.credentialKind,
    credentialRefs: unique([...(route?.credentialRefs || []), ...(identity.credentialRef ? [identity.credentialRef] : [])]),
    currentModelName: entry.currentModel || primaryModelFromRoute(resolution),
    secondaryModelNames: secondaryModelsFromRoute(resolution),
    fallbackModelNames: familyForRoute(resolution)?.fallbackModelNames || [],
    readiness: entry.readiness,
    ready: entry.ready,
    issue: entry.issue,
    capabilities: route?.capabilities || inferCapabilities(entry),
    modalities: route?.modalities || inferModalities(entry),
    limitations: inferLimitations(entry, route?.limitations || []),
    fallbackRouteIds: route?.fallbackRouteIds || [],
    catalogSource: route?.catalogSource || identity.catalogSource,
  };
}

export function toModelPickerProfileEntry(profile: ProviderProfile): ModelPickerProfileEntry {
  return {
    id: profile.id,
    label: profile.label,
    summary: profile.summary,
    preferredOrder: [...profile.preferredOrder],
  };
}

export function toSelectedModelProfile(input: ProviderCatalogSelectionProfileInput): SelectedModelProfile {
  const provider = findProvider(input.providers, input.selection.effectiveProviderName)
    || findProvider(input.providers, input.selection.requestedTarget);
  const modelName = input.selection.modelName
    || input.modelName
    || provider?.currentModel
    || null;
  const routeId = provider?.id || normalizeId(input.selection.effectiveProviderName);
  const identity = provider
    ? toProviderMeshIdentity(provider, modelName)
    : toFallbackIdentity(input.selection.effectiveProviderName, routeId, modelName);
  const capabilities: ModelCapabilityKind[] = provider ? inferCapabilities(provider) : ['chat'];
  const modalities: ModelModality[] = provider ? inferModalities(provider) : ['text'];
  const limitations = provider ? inferLimitations(provider) : ['Provider is not in the canonical catalog yet.'];
  const fallbackRouteIds = unique(input.fallbackOrder.map((target) => {
    return findProvider(input.providers, target)?.id || normalizeId(target);
  })).filter((target) => target !== routeId);

  return {
    schemaVersion: 1,
    source: input.source,
    providerName: input.selection.effectiveProviderName,
    providerLabel: provider?.label || input.selection.replyLabel,
    modelName,
    modelLabel: modelName || provider?.currentModel || input.selection.replyLabel,
    routeId,
    familyId: provider?.id || routeId,
    vendorId: identity.vendorId,
    providerId: identity.providerId,
    routeKind: identity.routeKind,
    credentialKind: identity.credentialKind,
    credentialRef: identity.credentialRef,
    catalogSource: identity.catalogSource,
    readiness: provider?.readiness || 'needs_config',
    ready: provider?.ready === true,
    fallbackOrder: [...input.fallbackOrder],
    fallbackRouteIds,
    capabilities,
    modalities,
    limitations,
    identity,
    explanation: input.explanation,
  };
}

export function selectModelFromPickerContract(
  contract: ModelPickerContract,
  input: ModelPickerSelectionInput = {},
): ModelPickerSelectionResult {
  const candidates = buildModelPickerCandidates(contract, input);
  const requireReady = input.requireReady !== false;
  const selectedCandidate = candidates.find((candidate) => !requireReady || candidate.ready) || candidates[0] || null;
  const selected = selectedCandidate
    ? selectedProfileFromCandidate(contract, selectedCandidate)
    : input.requestedCapability
      ? null
      : contract.selected;

  return {
    schemaVersion: 1,
    generatedAt: contract.generatedAt,
    input: { ...input },
    selected,
    candidates,
    explanation: describeSelection(input, selectedCandidate, candidates),
  };
}

export function buildModelPickerCandidates(
  contract: ModelPickerContract,
  input: ModelPickerSelectionInput = {},
): ModelPickerCandidate[] {
  const capability = input.requestedCapability || null;
  return contract.routes.routes
    .map((route) => {
      const family = contract.families.families.find((entry) => entry.id === route.familyIds[0] || entry.routeIds.includes(route.id));
      const capabilityScore = scoreRoute(route, capability);
      return {
        routeId: route.id,
        familyId: family?.id || route.familyIds[0] || route.id,
        vendorId: route.vendorId,
        providerId: route.providerId,
        modelName: route.currentModelName,
        providerLabel: route.label,
        modelLabel: route.currentModelName || route.label,
        readiness: route.readiness,
        ready: route.ready,
        capabilityScore,
        catalogSource: route.catalogSource,
        capabilities: [...route.capabilities],
        modalities: [...route.modalities],
        limitations: [...route.limitations],
        fallbackRouteIds: [...route.fallbackRouteIds],
        explanation: [
          `${route.label} via ${route.routeKind}.`,
          route.ready ? 'Rota ready.' : (route.issue || `Rota em ${route.readiness}.`),
        ],
      };
    })
    .filter((candidate) => !capability || candidate.capabilityScore > 0)
    .sort((left, right) => {
      if (left.ready !== right.ready) {
        return left.ready ? -1 : 1;
      }
      if (left.capabilityScore !== right.capabilityScore) {
        return right.capabilityScore - left.capabilityScore;
      }
      return left.routeId.localeCompare(right.routeId);
    });
}

function selectedProfileFromCandidate(
  contract: ModelPickerContract,
  candidate: ModelPickerCandidate,
): SelectedModelProfile {
  const route = contract.routes.routes.find((entry) => entry.id === candidate.routeId);
  if (!route) {
    return contract.selected;
  }
  const family = contract.families.families.find((entry) => entry.id === candidate.familyId);
  const identity: ProviderMeshIdentity = {
    familyId: candidate.familyId,
    vendorId: candidate.vendorId,
    providerId: candidate.providerId,
    routeId: candidate.routeId,
    routeKind: route.routeKind,
    modelId: candidate.modelName,
    credentialRef: route.credentialRefs[0] || null,
    credentialKind: route.credentialKind,
    catalogSource: route.catalogSource,
  };
  return {
    schemaVersion: 1,
    source: 'target-selection',
    providerName: route.providerName,
    providerLabel: route.label,
    modelName: candidate.modelName,
    modelLabel: candidate.modelLabel,
    routeId: route.id,
    familyId: family?.id || candidate.familyId,
    vendorId: candidate.vendorId,
    providerId: candidate.providerId,
    routeKind: route.routeKind,
    credentialKind: route.credentialKind,
    credentialRef: route.credentialRefs[0] || null,
    catalogSource: route.catalogSource,
    readiness: route.readiness,
    ready: route.ready,
    fallbackOrder: [route.id, ...route.fallbackRouteIds],
    fallbackRouteIds: [...route.fallbackRouteIds],
    capabilities: [...route.capabilities],
    modalities: [...route.modalities],
    limitations: [...route.limitations],
    identity,
    explanation: candidate.explanation,
  };
}

function describeSelection(
  input: ModelPickerSelectionInput,
  selected: ModelPickerCandidate | null,
  candidates: ModelPickerCandidate[],
): string[] {
  if (!selected) {
    return input.requestedCapability
      ? [`No route supports capability ${input.requestedCapability} in the current catalog.`]
      : ['No rota available in the current catalog.'];
  }
  const capability = input.requestedCapability ? ` para ${input.requestedCapability}` : '';
  return [
    `Selecionado ${selected.providerLabel}/${selected.modelLabel}${capability}.`,
    `${candidates.length} candidate(s) avaliados pelo contrato canonical.`,
  ];
}

function scoreRoute(route: AccessRouteCatalogEntry, capability: ModelCapabilityKind | null): number {
  const capabilityScore = capability && route.capabilities.includes(capability) ? 20 : capability ? 0 : 1;
  const readinessScore = route.ready ? 100 : route.readiness === 'needs_probe' ? 20 : 0;
  return readinessScore + capabilityScore;
}

function findProvider(providers: ProviderCatalogEntry[], target: string): ProviderCatalogEntry | null {
  const normalized = normalizeId(target);
  return providers.find((entry) => {
    return normalizeId(entry.id) === normalized
      || normalizeId(entry.effectiveProviderName) === normalized
      || entry.aliases.map(normalizeId).includes(normalized);
  }) || null;
}

function toProviderMeshIdentity(entry: ProviderCatalogEntry, modelName: string | null): ProviderMeshIdentity {
  const resolution = resolveRouteIntegration(entry);
  if (resolution) {
    return {
      familyId: resolution.route.familyIds[0] || entry.id,
      vendorId: resolution.route.vendorId,
      providerId: resolution.route.providerId,
      routeId: resolution.route.routeId,
      routeKind: resolution.route.routeKind,
      modelId: modelName || primaryModelFromRoute(resolution),
      credentialRef: resolution.route.credentialRefs?.[0] || entry.requirements[0] || null,
      credentialKind: resolution.route.authKind,
      catalogSource: resolution.route.catalogSource || 'static',
    };
  }
  const credentialRef = entry.requirements[0] || null;
  return {
    familyId: entry.id,
    vendorId: inferVendorId(entry),
    providerId: normalizeId(entry.effectiveProviderName || entry.id),
    routeId: entry.id,
    routeKind: inferRouteKind(entry),
    modelId: modelName,
    credentialRef,
    credentialKind: inferCredentialKind(entry),
    catalogSource: inferCatalogSource(entry),
  };
}

function toFallbackIdentity(providerName: string, routeId: string, modelName: string | null): ProviderMeshIdentity {
  const normalizedProvider = normalizeId(providerName || routeId);
  return {
    familyId: routeId,
    vendorId: normalizedProvider,
    providerId: normalizedProvider,
    routeId,
    routeKind: 'fallback',
    modelId: modelName,
    credentialRef: null,
    credentialKind: 'runtime_config',
    catalogSource: 'fallback',
  };
}

function inferVendorId(entry: ProviderCatalogEntry): string {
  const id = normalizeId(entry.id);
  const provider = normalizeId(entry.effectiveProviderName);
  if (id === 'gemini' || id === 'gemma' || provider === 'gemini') {
    return 'google';
  }
  if (id === 'qwen' || provider === 'qwen') {
    return 'alibaba';
  }
  if (id === 'aigateway' || provider === 'aigateway') {
    return 'zavorth';
  }
  return provider || id;
}

function inferRouteKind(entry: ProviderCatalogEntry): ProviderRouteKind {
  const id = normalizeId(entry.id);
  if (entry.kind === 'alias' || entry.mode === 'alias') {
    return 'alias';
  }
  if (id === 'openrouter') {
    return 'aggregator';
  }
  if (entry.mode === 'local') {
    return 'local_runtime';
  }
  if (entry.mode === 'hybrid') {
    return 'custom_compatible';
  }
  return 'official';
}

function inferCredentialKind(entry: ProviderCatalogEntry): ProviderCredentialKind {
  const requirement = normalizeText(entry.requirements[0]).toUpperCase();
  if (!requirement) {
    return 'none';
  }
  if (requirement.includes('BASE_URL') || requirement.includes('ENDPOINT')) {
    return 'local_endpoint';
  }
  if (requirement.includes('TOKEN')) {
    return 'bearer_token';
  }
  if (requirement.includes('API_KEY')) {
    return 'api_key';
  }
  return 'runtime_config';
}

function inferCatalogSource(entry: ProviderCatalogEntry): ProviderCatalogSource {
  return entry.ready ? 'runtime_config' : 'static';
}

function inferCapabilities(entry: ProviderCatalogEntry): ModelCapabilityKind[] {
  const id = normalizeId(entry.id);
  const provider = normalizeId(entry.effectiveProviderName);
  const capabilities: ModelCapabilityKind[] = ['chat', 'streaming'];
  if (['openai', 'deepseek', 'minimax', 'aigateway', 'qwen', 'opencode'].includes(id) || provider === 'openai') {
    capabilities.push('coding');
  }
  if (['openai', 'aigateway'].includes(id)) {
    capabilities.push('reasoning', 'tool_use');
  }
  if (['openrouter'].includes(id)) {
    capabilities.push('research');
  }
  if (['gemini', 'gemma', 'openai'].includes(id) || provider === 'gemini') {
    capabilities.push('multimodal', 'vision', 'long_context');
  }
  if (['gemma', 'deepseek', 'qwen'].includes(id)) {
    capabilities.push('budget');
  }
  if (entry.mode === 'local' || entry.mode === 'hybrid') {
    capabilities.push('local');
  }
  return unique(capabilities);
}

function inferModalities(entry: ProviderCatalogEntry): ModelModality[] {
  const capabilities = inferCapabilities(entry);
  const modalities: ModelModality[] = ['text'];
  if (capabilities.includes('vision') || capabilities.includes('multimodal')) {
    modalities.push('image');
  }
  if (capabilities.includes('tool_use')) {
    modalities.push('tool');
  }
  return unique(modalities);
}

function inferLimitations(entry: ProviderCatalogEntry, initial: string[] = []): string[] {
  const limitations: string[] = [...initial];
  if (!entry.ready && entry.issue) {
    limitations.push(entry.issue);
  }
  if (entry.readiness === 'needs_probe') {
    limitations.push('Requires runtime probe before automatic selection.');
  }
  if (entry.visibility === 'advanced') {
    limitations.push('Rota avancada; ocultar em surfaces simples por default.');
  }
  return unique(limitations);
}
