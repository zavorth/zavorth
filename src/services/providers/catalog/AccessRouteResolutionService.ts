import type {
  AccessRouteCatalogEntry,
  AccessRouteClass,
  AccessRouteReadinessCode,
  ModelPickerReadiness,
  ProviderCredentialKind,
  ProviderRouteKind,
} from './ProviderCatalogContracts.js';
import type {
  ProviderIntegrationFamilyManifest,
  ProviderIntegrationRouteManifest,
} from './ProviderIntegrationManifest.js';
import type { ProviderIntegrationRegistry } from './ProviderIntegrationRegistry.js';
import { getDefaultProviderIntegrationRegistry } from './ProviderIntegrationRegistry.js';

export type AccessRouteHealthInput = {
  ready?: boolean | null;
  status?: 'healthy' | 'unhealthy' | 'unknown' | 'needs_probe' | 'not_applicable' | string | null;
  message?: string | null;
  checkedAt?: string | null;
};

export type AccessRouteConfiguredProvider = {
  credentialReady?: boolean | null;
  credentials?: Record<string, unknown> | null;
  baseUrl?: string | null;
  baseUrls?: Record<string, unknown> | null;
  healthReady?: boolean | null;
  healthStatus?: string | null;
  healthMessage?: string | null;
  checkedAt?: string | null;
  active?: boolean | null;
  connectionId?: string | null;
  providerNodeId?: string | null;
  proxyId?: string | null;
  discoverySupported?: boolean | null;
};

export type AccessRouteConnectionInput = {
  id?: string | null;
  provider?: string | null;
  providerName?: string | null;
  authType?: string | null;
  isActive?: boolean | null;
  apiKey?: unknown;
  accessToken?: unknown;
  refreshToken?: unknown;
  providerSpecificData?: Record<string, unknown> | null;
  baseUrl?: string | null;
  defaultModel?: string | null;
  testStatus?: string | null;
  lastError?: string | null;
  lastTested?: string | null;
  providerNodeId?: string | null;
  proxyId?: string | null;
};

export type AccessRouteResolutionOptions = {
  generatedAt?: string;
  includeAdvanced?: boolean;
  registry?: ProviderIntegrationRegistry | null;
  credentials?: Record<string, unknown> | null;
  baseUrls?: Record<string, unknown> | null;
  health?: Record<string, AccessRouteHealthInput | null | undefined> | null;
  configuredProviders?: Record<string, AccessRouteConfiguredProvider | null | undefined> | null;
  connections?: AccessRouteConnectionInput[] | null;
  currentModels?: Record<string, string | null | undefined> | null;
  requireProbeForRouteIds?: string[] | null;
};

export type AccessRouteFamilyResolution = {
  familyId: string;
  label: string;
  routeIds: string[];
  readyRouteIds: string[];
  blockedRouteIds: string[];
  explanation: string[];
};

export type AccessRouteResolutionSummary = {
  totalRoutes: number;
  readyRoutes: number;
  blockedRoutes: number;
  byReadinessCode: Record<AccessRouteReadinessCode, number>;
  byRouteClass: Record<AccessRouteClass, number>;
};

export type AccessRouteResolutionResult = {
  schemaVersion: 1;
  generatedAt: string;
  routes: AccessRouteCatalogEntry[];
  byFamily: AccessRouteFamilyResolution[];
  summary: AccessRouteResolutionSummary;
};

type RouteHealthSnapshot = NonNullable<AccessRouteCatalogEntry['health']>;

type RouteRuntimeState = {
  credentialReady: boolean;
  baseUrl: string | null;
  health: RouteHealthSnapshot | null;
  connectionId: string | null;
  providerNodeId: string | null;
  proxyId: string | null;
  discoverySupported: boolean | null;
  currentModelName: string | null;
};

const READINESS_CODES: AccessRouteReadinessCode[] = [
  'ready',
  'missing_auth',
  'missing_base_url',
  'needs_probe',
  'unhealthy',
  'unsupported',
];

const ROUTE_CLASSES: AccessRouteClass[] = [
  'official',
  'aggregator',
  'partner',
  'gateway',
  'local',
  'custom_compatible',
  'alias',
  'fallback',
];

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

function hasConfiguredValue(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return value !== null && value !== undefined;
}

function asStringOrNull(value: unknown): string | null {
  const text = normalizeText(value);
  return text || null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function lookupRecordValue<T>(
  record: Record<string, T | undefined> | null | undefined,
  keys: string[],
): T | undefined {
  if (!record) {
    return undefined;
  }
  const normalizedKeys = keys.map(normalizeId);
  for (const [key, value] of Object.entries(record)) {
    if (keys.includes(key) || normalizedKeys.includes(normalizeId(key))) {
      return value;
    }
  }
  return undefined;
}

function isBaseUrlRef(ref: string): boolean {
  const normalized = normalizeId(ref);
  return normalized.includes('base_url')
    || normalized.endsWith('_url')
    || normalized.includes('endpoint')
    || normalized === 'host'
    || normalized.endsWith('_host')
    || normalized.endsWith('host');
}

function readinessFromCode(code: AccessRouteReadinessCode): ModelPickerReadiness {
  switch (code) {
    case 'ready':
      return 'ready';
    case 'needs_probe':
    case 'unhealthy':
      return 'needs_probe';
    case 'missing_auth':
    case 'missing_base_url':
    case 'unsupported':
    default:
      return 'needs_config';
  }
}

function routeClassFor(route: ProviderIntegrationRouteManifest): AccessRouteClass {
  if (
    route.routeKind === 'custom_compatible'
    && (
      normalizeId(route.vendorId) === 'zavorth'
      || normalizeId(route.routeId) === 'aigateway'
      || normalizeId(route.providerName) === 'aigateway'
    )
  ) {
    return 'gateway';
  }
  if (route.routeKind === 'local_runtime') {
    return 'local';
  }
  return route.routeKind;
}

function routeNeedsBaseUrl(route: ProviderIntegrationRouteManifest): boolean {
  return (route.credentialRefs || []).some(isBaseUrlRef)
    || route.authKind === 'local_endpoint'
    || route.routeKind === 'custom_compatible'
    || route.routeKind === 'local_runtime'
    || route.mode === 'local'
    || route.mode === 'hybrid';
}

function routeNeedsAuth(route: ProviderIntegrationRouteManifest): boolean {
  return route.authKind !== 'none' && route.authKind !== 'local_endpoint';
}

function defaultBaseUrlForRoute(route: ProviderIntegrationRouteManifest): string | null {
  const keys = [
    route.routeId,
    route.providerId,
    route.providerName,
    route.vendorId,
    ...(route.aliases || []),
  ].map(normalizeId);
  const defaults: Record<string, string> = {
    aigateway: 'http://127.0.0.1:20128/v1',
    alibaba: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    byteplus: 'https://ark.ap-southeast.bytepluses.com/api/v3',
    cerebras: 'https://api.cerebras.ai/v1',
    chutes: 'https://llm.chutes.ai/v1',
    cohere: 'https://api.cohere.ai/compatibility/v1',
    comfy: 'http://localhost:8188/v1',
    deepinfra: 'https://api.deepinfra.com/v1/openai',
    fireworks: 'https://api.fireworks.ai/inference/v1',
    falcon: 'https://router.huggingface.co/v1',
    groq: 'https://api.groq.com/openai/v1',
    huggingface: 'https://router.huggingface.co/v1',
    jais: 'https://router.huggingface.co/v1',
    'github-models': 'https://models.github.ai/inference',
    'kimi-coding': 'https://api.moonshot.ai/v1',
    lmstudio: 'http://localhost:1234/v1',
    litellm: 'http://127.0.0.1:4000/v1',
    microsoft: 'https://models.inference.ai.azure.com',
    'microsoft-foundry': 'https://models.inference.ai.azure.com',
    mistral: 'https://api.mistral.ai/v1',
    moonshot: 'https://api.moonshot.ai/v1',
    nvidia: 'https://integrate.api.nvidia.com/v1',
    ollama: 'http://127.0.0.1:11434',
    opencode: 'https://opencode.ai/zen/v1',
    perplexity: 'https://api.perplexity.ai',
    qianfan: 'https://qianfan.baidubce.com/v2',
    sambanova: 'https://api.sambanova.ai/v1',
    sglang: 'http://localhost:30000/v1',
    stepfun: 'https://api.stepfun.com/v1',
    tencent: 'https://api.hunyuan.cloud.tencent.com/v1',
    together: 'https://api.together.xyz/v1',
    'vercel-ai-gateway': 'https://ai-gateway.vercel.sh/v1',
    venice: 'https://api.venice.ai/api/v1',
    voyage: 'https://api.voyageai.com/v1',
    vllm: 'http://localhost:8000/v1',
    xai: 'https://api.x.ai/v1',
    zai: 'https://open.bigmodel.cn/api/paas/v4',
  };
  const match = keys.find((key) => defaults[key]);
  return match ? defaults[match]! : null;
}

function routeSupportsDiscovery(route: ProviderIntegrationRouteManifest): boolean {
  return route.passthroughModels === true || route.catalogSource === 'live_api' || (route.models || []).length > 0;
}

export class AccessRouteResolutionService {
  private readonly registry: ProviderIntegrationRegistry;

  constructor(options: { registry?: ProviderIntegrationRegistry | null } = {}) {
    this.registry = options.registry || getDefaultProviderIntegrationRegistry();
  }

  public resolveRoutes(options: AccessRouteResolutionOptions = {}): AccessRouteResolutionResult {
    const generatedAt = options.generatedAt || new Date().toISOString();
    const registry = options.registry || this.registry;
    const requireProbeForRouteIds = new Set((options.requireProbeForRouteIds || []).map(normalizeId));
    const routes = registry.listRoutes()
      .filter((route) => options.includeAdvanced === true || route.visibility !== 'advanced')
      .map((route) => this.resolveRoute(route, registry, options, requireProbeForRouteIds));

    return {
      schemaVersion: 1,
      generatedAt,
      routes,
      byFamily: this.resolveFamilies(registry.listFamilies(), routes),
      summary: this.summarize(routes),
    };
  }

  private resolveRoute(
    route: ProviderIntegrationRouteManifest,
    registry: ProviderIntegrationRegistry,
    options: AccessRouteResolutionOptions,
    requireProbeForRouteIds: Set<string>,
  ): AccessRouteCatalogEntry {
    const state = this.buildRuntimeState(route, registry, options);
    const credentialRefs = route.credentialRefs || [];
    const secretRefs = credentialRefs.filter((ref) => !isBaseUrlRef(ref));
    const baseUrlRefs = credentialRefs.filter(isBaseUrlRef);
    const authRequired = routeNeedsAuth(route);
    const baseUrlRequired = routeNeedsBaseUrl(route);
    const authConfigured = !authRequired || state.credentialReady || secretRefs.some((ref) => {
      return hasConfiguredValue(lookupRecordValue(options.credentials, [ref]));
    });
    const baseUrlConfigured = !baseUrlRequired || Boolean(state.baseUrl);
    const requiresProbe = requireProbeForRouteIds.has(normalizeId(route.routeId));
    const readinessCode = this.resolveReadinessCode({
      authRequired,
      authConfigured,
      baseUrlRequired,
      baseUrlConfigured,
      requiresProbe,
      health: state.health,
    });
    const readiness = readinessFromCode(readinessCode);
    const family = this.primaryFamilyForRoute(registry.listFamilies(), route);
    const routeClass = routeClassFor(route);
    const issue = this.describeIssue({
      route,
      readinessCode,
      authRequired,
      baseUrlRequired,
      secretRefs,
      baseUrlRefs,
      health: state.health,
    });
    const explanation = this.describeRoute({
      route,
      routeClass,
      readinessCode,
      issue,
      authRequired,
      authConfigured,
      baseUrlRequired,
      baseUrlConfigured,
      health: state.health,
    });

    return {
      id: route.routeId,
      label: route.label,
      familyIds: [...route.familyIds],
      vendorId: route.vendorId,
      providerId: route.providerId,
      providerName: route.providerName,
      routeKind: route.routeKind as ProviderRouteKind,
      mode: route.mode,
      aliases: [...(route.aliases || [])],
      requirements: unique([...credentialRefs]),
      credentialKind: route.authKind as ProviderCredentialKind,
      credentialRefs: [...credentialRefs],
      currentModelName: state.currentModelName || this.primaryModelName(route),
      secondaryModelNames: this.secondaryModelNames(route),
      fallbackModelNames: family?.fallbackModelNames ? [...family.fallbackModelNames] : [],
      readiness,
      readinessCode,
      ready: readinessCode === 'ready',
      issue,
      routeClass,
      authConfigured,
      baseUrlRef: baseUrlRefs[0] || null,
      baseUrlConfigured,
      discoverySupported: state.discoverySupported ?? routeSupportsDiscovery(route),
      connectionId: state.connectionId,
      providerNodeId: state.providerNodeId,
      proxyId: state.proxyId,
      health: state.health,
      explanation,
      capabilities: [...route.capabilities],
      modalities: [...route.modalities],
      limitations: this.limitationsFor(route, readinessCode, issue),
      fallbackRouteIds: [...(route.fallbackRouteIds || [])],
      catalogSource: route.catalogSource || 'static',
    };
  }

  private buildRuntimeState(
    route: ProviderIntegrationRouteManifest,
    registry: ProviderIntegrationRegistry,
    options: AccessRouteResolutionOptions,
  ): RouteRuntimeState {
    const keys = this.routeLookupKeys(route);
    const configured = this.lookupConfiguredProvider(options.configuredProviders, keys);
    const connection = this.lookupConnection(route, registry, options.connections || []);
    const connectionData = connection ? this.connectionToConfiguredProvider(connection) : null;
    const mergedConfigured = this.mergeConfiguredProviders(configured, connectionData);
    const baseUrls = {
      ...(options.baseUrls || {}),
      ...(mergedConfigured?.baseUrls || {}),
    };
    const credentials = {
      ...(options.credentials || {}),
      ...(mergedConfigured?.credentials || {}),
    };
    const credentialReady = mergedConfigured?.credentialReady === true || (route.credentialRefs || [])
      .filter((ref) => !isBaseUrlRef(ref))
      .some((ref) => hasConfiguredValue(lookupRecordValue(credentials, [ref, ...keys])));
    const configuredBaseUrl = asStringOrNull(mergedConfigured?.baseUrl);
    const baseUrl = (route.credentialRefs || [])
      .filter(isBaseUrlRef)
      .map((ref) => asStringOrNull(lookupRecordValue(baseUrls, [ref, ...keys])))
      .find(Boolean)
      || configuredBaseUrl
      || asStringOrNull(lookupRecordValue(baseUrls, keys))
      || defaultBaseUrlForRoute(route);
    const health = this.lookupHealth(route, options.health, mergedConfigured);
    const currentModelName = asStringOrNull(lookupRecordValue(options.currentModels, keys))
      || asStringOrNull(connection?.defaultModel);

    return {
      credentialReady,
      baseUrl,
      health,
      connectionId: mergedConfigured?.connectionId || null,
      providerNodeId: mergedConfigured?.providerNodeId || null,
      proxyId: mergedConfigured?.proxyId || null,
      discoverySupported: typeof mergedConfigured?.discoverySupported === 'boolean'
        ? mergedConfigured.discoverySupported
        : null,
      currentModelName,
    };
  }

  private resolveReadinessCode(input: {
    authRequired: boolean;
    authConfigured: boolean;
    baseUrlRequired: boolean;
    baseUrlConfigured: boolean;
    requiresProbe: boolean;
    health: RouteHealthSnapshot | null;
  }): AccessRouteReadinessCode {
    if (input.baseUrlRequired && !input.baseUrlConfigured) {
      return 'missing_base_url';
    }
    if (input.authRequired && !input.authConfigured) {
      return 'missing_auth';
    }
    if (input.health?.status === 'unhealthy') {
      return 'unhealthy';
    }
    if (input.requiresProbe && (!input.health || input.health.status === 'unknown')) {
      return 'needs_probe';
    }
    return 'ready';
  }

  private describeIssue(input: {
    route: ProviderIntegrationRouteManifest;
    readinessCode: AccessRouteReadinessCode;
    authRequired: boolean;
    baseUrlRequired: boolean;
    secretRefs: string[];
    baseUrlRefs: string[];
    health: RouteHealthSnapshot | null;
  }): string | null {
    switch (input.readinessCode) {
      case 'missing_base_url':
        return `missing setup base URL: ${input.baseUrlRefs[0] || `${input.route.routeId}_BASE_URL`}.`;
      case 'missing_auth':
        return input.secretRefs.length > 0
          ? `missing setup credential: ${input.secretRefs.join(' or ')}.`
          : `Route ${input.route.label} requires credential ${input.route.authKind}, but does not declare credentialRef.`;
      case 'needs_probe':
        return input.health?.message || `Route ${input.route.label} needs a probe before being marked ready.`;
      case 'unhealthy':
        return input.health?.message || `Health check failed para ${input.route.label}.`;
      case 'unsupported':
        return `Route ${input.route.label} is not supported by the current runtime yet.`;
      case 'ready':
      default:
        return null;
    }
  }

  private describeRoute(input: {
    route: ProviderIntegrationRouteManifest;
    routeClass: AccessRouteClass;
    readinessCode: AccessRouteReadinessCode;
    issue: string | null;
    authRequired: boolean;
    authConfigured: boolean;
    baseUrlRequired: boolean;
    baseUrlConfigured: boolean;
    health: RouteHealthSnapshot | null;
  }): string[] {
    const authText = input.authRequired
      ? (input.authConfigured ? 'credential configurada' : 'credential missing')
      : 'without credential external';
    const baseText = input.baseUrlRequired
      ? (input.baseUrlConfigured ? 'base URL configurada' : 'base URL missing')
      : 'base URL gerenciada pelo provider';
    const healthText = input.health ? `health ${input.health.status}`
      : 'health not provided';
    return [
      `${input.route.label} usa rota ${input.routeClass}.`,
      `${authText}; ${baseText}; ${healthText}.`,
      input.issue || `Route ready for selection (${input.readinessCode}).`,
    ];
  }

  private resolveFamilies(
    families: ProviderIntegrationFamilyManifest[],
    routes: AccessRouteCatalogEntry[],
  ): AccessRouteFamilyResolution[] {
    const familyIds = unique(routes.flatMap((route) => route.familyIds));
    return familyIds.map((familyId) => {
      const family = families.find((entry) => normalizeId(entry.familyId) === normalizeId(familyId));
      const familyRoutes = routes.filter((route) => route.familyIds.map(normalizeId).includes(normalizeId(familyId)));
      const readyRouteIds = familyRoutes.filter((route) => route.ready).map((route) => route.id);
      const blockedRouteIds = familyRoutes.filter((route) => !route.ready).map((route) => route.id);
      return {
        familyId,
        label: family?.label || familyId,
        routeIds: familyRoutes.map((route) => route.id),
        readyRouteIds,
        blockedRouteIds,
        explanation: readyRouteIds.length > 0
          ? [`${family?.label || familyId} tem rota ready: ${readyRouteIds.join(', ')}.`]
          : blockedRouteIds.map((routeId) => {
            const route = familyRoutes.find((entry) => entry.id === routeId);
            return `${route?.label || routeId}: ${route?.issue || route?.readinessCode || 'unavailable'}.`;
          }),
      };
    });
  }

  private summarize(routes: AccessRouteCatalogEntry[]): AccessRouteResolutionSummary {
    const byReadinessCode = Object.fromEntries(READINESS_CODES.map((code) => [code, 0])) as Record<AccessRouteReadinessCode, number>;
    const byRouteClass = Object.fromEntries(ROUTE_CLASSES.map((code) => [code, 0])) as Record<AccessRouteClass, number>;
    for (const route of routes) {
      byReadinessCode[route.readinessCode || 'unsupported'] += 1;
      byRouteClass[route.routeClass || 'fallback'] += 1;
    }
    return {
      totalRoutes: routes.length,
      readyRoutes: routes.filter((route) => route.ready).length,
      blockedRoutes: routes.filter((route) => !route.ready).length,
      byReadinessCode,
      byRouteClass,
    };
  }

  private routeLookupKeys(route: ProviderIntegrationRouteManifest): string[] {
    return unique([
      route.routeId,
      route.providerId,
      route.providerName,
      route.vendorId,
      ...route.familyIds,
      ...(route.aliases || []),
    ]);
  }

  private lookupConfiguredProvider(
    configuredProviders: AccessRouteResolutionOptions['configuredProviders'],
    keys: string[],
  ): AccessRouteConfiguredProvider | null {
    return lookupRecordValue(configuredProviders, keys) || null;
  }

  private lookupHealth(
    route: ProviderIntegrationRouteManifest,
    health: AccessRouteResolutionOptions['health'],
    configured: AccessRouteConfiguredProvider | null,
  ): RouteHealthSnapshot | null {
    const configuredHealth = typeof configured?.healthReady === 'boolean' || configured?.healthStatus || configured?.healthMessage
      ? {
        ready: configured.healthReady ?? null,
        status: configured.healthStatus || null,
        message: configured.healthMessage || null,
        checkedAt: configured.checkedAt || null,
      }
      : null;
    const raw = lookupRecordValue(health, this.routeLookupKeys(route)) || configuredHealth;
    if (!raw) {
      return null;
    }
    return this.normalizeHealth(raw);
  }

  private normalizeHealth(raw: AccessRouteHealthInput): RouteHealthSnapshot {
    if (raw.ready === true) {
      return {
        status: 'healthy',
        message: raw.message || null,
        checkedAt: raw.checkedAt || null,
      };
    }
    if (raw.ready === false) {
      return {
        status: 'unhealthy',
        message: raw.message || null,
        checkedAt: raw.checkedAt || null,
      };
    }
    const normalizedStatus = normalizeId(raw.status);
    if (normalizedStatus === 'healthy') {
      return { status: 'healthy', message: raw.message || null, checkedAt: raw.checkedAt || null };
    }
    if (normalizedStatus === 'unhealthy' || normalizedStatus === 'error' || normalizedStatus === 'failed') {
      return { status: 'unhealthy', message: raw.message || null, checkedAt: raw.checkedAt || null };
    }
    if (normalizedStatus === 'not_applicable') {
      return { status: 'not_applicable', message: raw.message || null, checkedAt: raw.checkedAt || null };
    }
    return {
      status: 'unknown',
      message: raw.message || null,
      checkedAt: raw.checkedAt || null,
    };
  }

  private lookupConnection(
    route: ProviderIntegrationRouteManifest,
    registry: ProviderIntegrationRegistry,
    connections: AccessRouteConnectionInput[],
  ): AccessRouteConnectionInput | null {
    const routeId = normalizeId(route.routeId);
    return connections.find((connection) => {
      if (connection.isActive === false) {
        return false;
      }
      const resolved = registry.resolveRouteForProvider({
        id: connection.provider || connection.providerName,
        providerName: connection.providerName || connection.provider,
        aliases: [connection.provider || '', connection.providerName || ''],
      });
      return normalizeId(resolved?.route.routeId) === routeId;
    }) || null;
  }

  private connectionToConfiguredProvider(connection: AccessRouteConnectionInput): AccessRouteConfiguredProvider {
    const providerSpecificData = asRecord(connection.providerSpecificData);
    const baseUrl = asStringOrNull(connection.baseUrl)
      || asStringOrNull(providerSpecificData.baseUrl)
      || asStringOrNull(providerSpecificData.endpoint)
      || asStringOrNull(providerSpecificData.apiBaseUrl);
    const hasApiKey = hasConfiguredValue(connection.apiKey);
    const hasToken = hasConfiguredValue(connection.accessToken) || hasConfiguredValue(connection.refreshToken);
    const testStatus = normalizeId(connection.testStatus);
    return {
      credentialReady: hasApiKey || hasToken,
      baseUrl,
      active: connection.isActive !== false,
      connectionId: connection.id || null,
      providerNodeId: connection.providerNodeId || asStringOrNull(providerSpecificData.nodeId),
      proxyId: connection.proxyId || asStringOrNull(providerSpecificData.proxyId),
      healthReady: testStatus === 'active' ? true : testStatus === 'error' ? false : null,
      healthStatus: testStatus === 'active' ? 'healthy' : testStatus === 'error' ? 'unhealthy' : null,
      healthMessage: connection.lastError || null,
      checkedAt: connection.lastTested || null,
    };
  }

  private mergeConfiguredProviders(
    left: AccessRouteConfiguredProvider | null,
    right: AccessRouteConfiguredProvider | null,
  ): AccessRouteConfiguredProvider | null {
    if (!left) {
      return right;
    }
    if (!right) {
      return left;
    }
    return {
      ...left,
      ...right,
      credentialReady: left.credentialReady === true || right.credentialReady === true,
      credentials: {
        ...(left.credentials || {}),
        ...(right.credentials || {}),
      },
      baseUrl: right.baseUrl || left.baseUrl || null,
      baseUrls: {
        ...(left.baseUrls || {}),
        ...(right.baseUrls || {}),
      },
      healthReady: right.healthReady ?? left.healthReady ?? null,
      healthStatus: right.healthStatus || left.healthStatus || null,
      healthMessage: right.healthMessage || left.healthMessage || null,
      checkedAt: right.checkedAt || left.checkedAt || null,
      connectionId: right.connectionId || left.connectionId || null,
      providerNodeId: right.providerNodeId || left.providerNodeId || null,
      proxyId: right.proxyId || left.proxyId || null,
      discoverySupported: right.discoverySupported ?? left.discoverySupported ?? null,
    };
  }

  private primaryFamilyForRoute(
    families: ProviderIntegrationFamilyManifest[],
    route: ProviderIntegrationRouteManifest,
  ): ProviderIntegrationFamilyManifest | null {
    return families.find((family) => route.familyIds.map(normalizeId).includes(normalizeId(family.familyId))) || null;
  }

  private primaryModelName(route: ProviderIntegrationRouteManifest): string | null {
    return (route.models || []).find((model) => model.primary)?.modelId || route.models?.[0]?.modelId || null;
  }

  private secondaryModelNames(route: ProviderIntegrationRouteManifest): string[] {
    return (route.models || []).filter((model) => !model.primary).map((model) => model.modelId);
  }

  private limitationsFor(
    route: ProviderIntegrationRouteManifest,
    readinessCode: AccessRouteReadinessCode,
    issue: string | null,
  ): string[] {
    return unique([
      ...(route.limitations || []),
      ...(readinessCode === 'needs_probe' ? ['Requires runtime probe before automatic selection.'] : []),
      ...(issue && readinessCode !== 'ready' ? [issue] : []),
    ]);
  }
}
