import type {
  AccessRouteCatalogEntry,
  ModelCapabilityKind,
  ModelPickerReadiness,
} from './ProviderCatalogContracts.js';
import { ModelPickerService, type ModelPickerServiceResult } from './ModelPickerService.js';

import type {
  ZavorthModelProviderExperienceCategory,
  ZavorthModelProviderExperienceCategoryId,
  ZavorthModelProviderExperienceCoverageEntry,
  ZavorthModelProviderExperienceProviderTier,
  ZavorthModelProviderExperienceRoute,
  ZavorthModelProviderExperienceSnapshot,
} from '../../../contracts/native/ZavorthModelProviderExperienceContract.js';

export type ModelProviderExperienceOptions = {
  generatedAt?: string | null;
  picker?: ModelPickerServiceResult | null;
  includeAdvanced?: boolean;
};

type ModelProviderExperienceRuntime = {
  modelPickerService?: Pick<ModelPickerService, 'buildPicker'> | null;
  now?: () => Date;
};

type CoverageTarget = {
  providerId: string;
  label: string;
  tier: ZavorthModelProviderExperienceProviderTier;
  aliases?: string[];
};

type CategoryDefinition = {
  id: ZavorthModelProviderExperienceCategoryId;
  label: string;
  summary: string;
  routeIds: string[];
  emptyHint: string;
};

const ESSENTIAL_TARGETS: CoverageTarget[] = [
  { providerId: 'openai', label: 'OpenAI', tier: 'essential' },
  { providerId: 'anthropic', label: 'Anthropic / Claude', tier: 'essential', aliases: ['claude'] },
  { providerId: 'gemini', label: 'Google Gemini', tier: 'essential', aliases: ['google'] },
  { providerId: 'openrouter', label: 'OpenRouter', tier: 'essential' },
  { providerId: 'ollama', label: 'Ollama local', tier: 'essential' },
  { providerId: 'custom-openai-compatible', label: 'OpenAI-compatible endpoint', tier: 'essential', aliases: ['openai-compatible'] },
];

const POWER_USER_TARGETS: CoverageTarget[] = [
  { providerId: 'groq', label: 'Groq', tier: 'power_user' },
  { providerId: 'mistral', label: 'Mistral', tier: 'power_user' },
  { providerId: 'xai', label: 'xAI', tier: 'power_user' },
  { providerId: 'deepseek', label: 'DeepSeek', tier: 'power_user' },
  { providerId: 'together', label: 'Together AI', tier: 'power_user' },
  { providerId: 'cerebras', label: 'Cerebras', tier: 'power_user' },
  { providerId: 'amazon-bedrock', label: 'Amazon Bedrock', tier: 'power_user' },
  { providerId: 'azure-openai', label: 'Azure OpenAI', tier: 'power_user', aliases: ['microsoft'] },
];

const CATEGORIES: CategoryDefinition[] = [
  {
    id: 'fast_and_budget',
    label: 'Fast and budget',
    summary: 'Low latency or lower-cost routes for daily chat, quick coding and status checks.',
    routeIds: ['gemini', 'openai', 'groq', 'mistral', 'deepseek', 'openrouter'],
    emptyHint: 'Configure Gemini, OpenAI, Groq, Mistral, DeepSeek or OpenRouter.',
  },
  {
    id: 'highest_intelligence',
    label: 'Highest intelligence',
    summary: 'Reasoning-heavy routes for complex coding, review, planning and agent orchestration.',
    routeIds: ['openai', 'anthropic', 'claude', 'gemini', 'xai', 'openrouter'],
    emptyHint: 'Configure OpenAI, Anthropic, Gemini, xAI or OpenRouter.',
  },
  {
    id: 'local_private',
    label: 'Local and private',
    summary: 'Local or user-controlled endpoints for privacy-first work and offline-friendly setups.',
    routeIds: ['ollama', 'lmstudio', 'AIGateway', 'custom-openai-compatible', 'vllm'],
    emptyHint: 'Start Ollama, LM Studio or an OpenAI-compatible local endpoint.',
  },
  {
    id: 'openai_compatible',
    label: 'OpenAI-compatible',
    summary: 'Routes that speak OpenAI-style APIs, including custom endpoints, gateways and aggregators.',
    routeIds: ['custom-openai-compatible', 'AIGateway', 'openrouter', 'azure-openai', 'vercel-ai-gateway', 'litellm'],
    emptyHint: 'Add a base URL and API key for an OpenAI-compatible endpoint.',
  },
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

export class ModelProviderExperienceService {
  private readonly modelPickerService: Pick<ModelPickerService, 'buildPicker'>;
  private readonly now: () => Date;

  constructor(runtime: ModelProviderExperienceRuntime = {}) {
    this.modelPickerService = runtime.modelPickerService || new ModelPickerService();
    this.now = runtime.now || (() => new Date());
  }

  public buildExperience(options: ModelProviderExperienceOptions = {}): ZavorthModelProviderExperienceSnapshot {
    const generatedAt = options.generatedAt || this.now().toISOString();
    const picker = options.picker || this.modelPickerService.buildPicker({
      includeAdvanced: options.includeAdvanced !== false,
    });
    const routes = picker.contract.routes.routes;
    const essentialEntries = ESSENTIAL_TARGETS.map((target) => this.coverageForTarget(routes, target));
    const powerEntries = POWER_USER_TARGETS.map((target) => this.coverageForTarget(routes, target));
    const categories = CATEGORIES.map((category) => this.buildCategory(routes, category));
    const readyEssential = essentialEntries.filter((entry) => entry.ready).length;
    const presentEssential = essentialEntries.filter((entry) => entry.present).length;

    return {
      schemaVersion: 1,
      generatedAt,
      status: presentEssential < ESSENTIAL_TARGETS.length
        ? 'incomplete'
        : readyEssential > 0
          ? 'ready'
          : 'needs_config',
      essentialCoverage: {
        required: ESSENTIAL_TARGETS.length,
        present: presentEssential,
        ready: readyEssential,
        entries: essentialEntries,
      },
      powerUserCoverage: {
        tracked: POWER_USER_TARGETS.length,
        present: powerEntries.filter((entry) => entry.present).length,
        ready: powerEntries.filter((entry) => entry.ready).length,
        entries: powerEntries,
      },
      categories,
      fallbackPolicy: {
        strategy: 'capability_then_readiness_then_cost_privacy',
        supportsLastKnownGoodProvider: true,
        requiresPolicyBrokerForExternalUse: true,
        explanation: [
          'Choose by requested capability first, then prefer configured/healthy routes.',
          'Use local/private routes when privacy is the user priority.',
          'External provider calls remain governed by the Policy Broker and receipts.',
        ],
      },
      productPromise: 'Use any model, but keep provider choice, credentials, fallback and external effects governed.',
      explanation: [
        'This snapshot is the product-facing model choice layer over ProviderIntegrationRegistry and ModelPickerService.',
        'It intentionally groups providers by daily-use intent instead of exposing a flat long-tail list.',
      ],
    };
  }

  private coverageForTarget(
    routes: AccessRouteCatalogEntry[],
    target: CoverageTarget,
  ): ZavorthModelProviderExperienceCoverageEntry {
    const route = this.findRoute(routes, [target.providerId, ...(target.aliases || [])]);
    return {
      providerId: target.providerId,
      label: target.label,
      tier: target.tier,
      routeId: route?.id || null,
      present: Boolean(route),
      ready: route?.ready === true,
      readiness: route?.readiness || 'missing',
      setupHint: route ? this.setupHint(route) : `Add ${target.label} to the provider registry.`,
    };
  }

  private buildCategory(
    routes: AccessRouteCatalogEntry[],
    definition: CategoryDefinition,
  ): ZavorthModelProviderExperienceCategory {
    const categoryRoutes = unique(definition.routeIds)
      .map((routeId) => this.findRoute(routes, [routeId]))
      .filter((route): route is AccessRouteCatalogEntry => Boolean(route));
    const primary = categoryRoutes.find((route) => route.ready)
      || categoryRoutes[0]
      || null;

    return {
      id: definition.id,
      label: definition.label,
      summary: definition.summary,
      recommendedRouteIds: categoryRoutes.map((route) => route.id),
      primary: primary ? this.toExperienceRoute(primary) : null,
      alternatives: categoryRoutes
        .filter((route) => normalizeId(route.id) !== normalizeId(primary?.id))
        .map((route) => this.toExperienceRoute(route)),
      emptyHint: definition.emptyHint,
    };
  }

  private toExperienceRoute(route: AccessRouteCatalogEntry): ZavorthModelProviderExperienceRoute {
    const modelName = route.currentModelName || route.secondaryModelNames[0] || route.fallbackModelNames[0] || null;
    return {
      routeId: route.id,
      providerId: route.providerId,
      providerName: route.providerName,
      label: route.label,
      modelName,
      modelLabel: modelName || 'Auto / provider default',
      routeKind: route.routeKind,
      credentialKind: route.credentialKind,
      credentialRefs: [...route.credentialRefs],
      readiness: route.readiness,
      ready: route.ready,
      capabilities: [...route.capabilities],
      setupHint: this.setupHint(route),
      explanation: this.explainRoute(route),
    };
  }

  private findRoute(routes: AccessRouteCatalogEntry[], targets: string[]): AccessRouteCatalogEntry | null {
    const normalizedTargets = targets.map(normalizeId);
    return routes.find((route) => {
      const routeKeys = [
        route.id,
        route.providerId,
        route.providerName,
        route.label,
        ...route.aliases,
      ].map(normalizeId);
      return normalizedTargets.some((target) => routeKeys.includes(target));
    }) || null;
  }

  private setupHint(route: AccessRouteCatalogEntry): string {
    if (route.ready) {
      return 'Ready now.';
    }
    if (route.readinessCode === 'missing_base_url' || route.baseUrlConfigured === false) {
      return `Set ${route.baseUrlRef || route.credentialRefs.find((ref) => ref.endsWith('BASE_URL')) || 'the provider base URL'}.`;
    }
    if (route.readinessCode === 'missing_auth' || route.authConfigured === false) {
      return route.credentialRefs.length > 0
        ? `Set ${route.credentialRefs.join(' or ')}.`
        : 'Add provider credentials.';
    }
    if (route.readiness === 'needs_probe') {
      return 'Run provider doctor or live canary to verify health.';
    }
    return route.issue || 'Configure and test this provider.';
  }

  private explainRoute(route: AccessRouteCatalogEntry): string[] {
    const capabilities = route.capabilities.length > 0
      ? `Capabilities: ${route.capabilities.join(', ')}.`
      : 'No capabilities declared.';
    const readiness = route.ready
      ? 'Route is configured and ready.'
      : `Route is ${route.readiness}: ${this.setupHint(route)}`;
    const governance = this.requiresExternalGovernance(route.capabilities)
      ? 'External use remains policy-gated and receipt-backed.'
      : 'Local route still follows provider mesh and receipt rules.';
    return [capabilities, readiness, governance];
  }

  private requiresExternalGovernance(capabilities: ModelCapabilityKind[]): boolean {
    return capabilities.some((capability) => capability !== 'local');
  }
}
