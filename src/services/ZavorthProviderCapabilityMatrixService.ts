import {
  ZAVORTH_MEDIA_PROVIDER_ROWS,
  ZAVORTH_PROVIDER_DOCUMENTED_IDS,
  ZAVORTH_PROVIDER_MODEL_CATALOGS,
  ZAVORTH_STATIC_PROVIDER_CATALOGS,
  type ZavorthProviderCapabilityModality,
} from './providers/catalog/zavorthProviderCapabilityInventory.js';
import { ZAVORTH_PROVIDER_CAPABILITY_MANIFESTS } from './providers/catalog/manifests/zavorthProviderCapabilityProviders.js';
import {
  ZAVORTH_PROVIDER_CAPABILITY_MATRIX_CONTRACT_VERSION,
  type ZavorthProviderCapabilityMatrixCredentialKind,
  type ZavorthProviderCapabilityMatrixProvider,
  type ZavorthProviderCapabilityMatrixProviderLevel,
  type ZavorthProviderCapabilityMatrixProviderState,
  type ZavorthProviderCapabilityMatrixSnapshot,
  type ZavorthProviderCapabilityMatrixStatus,
} from '../contracts/ZavorthProviderCapabilityMatrixContract.js';

export type ZavorthProviderCapabilityMatrixRuntime = {
  now?: () => Date;
  env?: Record<string, string | undefined>;
};

export type ZavorthProviderCapabilityMatrixInput = {
  query?: string | null;
  limit?: number | null;
};

type ProviderAccumulator = {
  id: string;
  label: string;
  modalities: Set<ZavorthProviderCapabilityModality>;
  models: Set<string>;
  defaultModel: string | null;
  envRefs: Set<string>;
  routeKind: string;
  credentialKind: ZavorthProviderCapabilityMatrixCredentialKind;
  level: ZavorthProviderCapabilityMatrixProviderLevel;
};

const MODALITIES: ZavorthProviderCapabilityModality[] = [
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

const RUNTIME_NATIVE_IDS = new Set([
  'anthropic',
  'deepseek',
  'gemini',
  'google',
  'local-llama',
  'minimax',
  'openai',
  'openai-codex',
  'opencode',
  'openrouter',
  'qwen',
  'xai',
]);

const LOCAL_RUNTIME_IDS = new Set([
  'comfy',
  'lmstudio',
  'microsoft',
  'ollama',
  'sglang',
  'tts-local-cli',
  'vllm',
]);

const DEFAULT_ENV_REFS: Record<string, string[]> = {
  alibaba: ['MODELSTUDIO_API_KEY', 'ALIBABA_API_KEY'],
  anthropic: ['ANTHROPIC_API_KEY'],
  amazon: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION'],
  'amazon-bedrock': ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION'],
  'amazon-bedrock-mantle': ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION'],
  byteplus: ['BYTEPLUS_API_KEY', 'BYTEPLUS_BASE_URL'],
  'byteplus-plan': ['BYTEPLUS_API_KEY', 'BYTEPLUS_BASE_URL'],
  comfy: ['COMFY_BASE_URL', 'COMFY_API_KEY', 'COMFY_CLOUD_API_KEY'],
  deepinfra: ['DEEPINFRA_API_KEY'],
  deepseek: ['DEEPSEEK_API_KEY'],
  fal: ['FAL_KEY', 'FAL_API_KEY'],
  fireworks: ['FIREWORKS_API_KEY'],
  gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
  google: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
  groq: ['GROQ_API_KEY'],
  huggingface: ['HUGGINGFACE_API_KEY', 'HF_TOKEN'],
  litellm: ['LITELLM_API_KEY', 'LITELLM_BASE_URL'],
  lmstudio: ['LMSTUDIO_BASE_URL'],
  minimax: ['MINIMAX_API_KEY'],
  mistral: ['MISTRAL_API_KEY'],
  moonshot: ['MOONSHOT_API_KEY'],
  ollama: ['OLLAMA_BASE_URL'],
  openai: ['OPENAI_API_KEY'],
  'openai-codex': ['OPENAI_API_KEY'],
  opencode: ['OPENCODE_API_KEY', 'OPENCODE_BASE_URL'],
  openrouter: ['OPENROUTER_API_KEY'],
  perplexity: ['PERPLEXITY_API_KEY'],
  qianfan: ['QIANFAN_API_KEY'],
  qwen: ['QWEN_API_KEY'],
  runway: ['RUNWAYML_API_SECRET'],
  sambanova: ['SAMBANOVA_API_KEY'],
  tencent: ['TENCENT_API_KEY'],
  'tencent-tokenhub': ['TENCENT_TOKENHUB_API_KEY', 'TENCENT_API_KEY'],
  together: ['TOGETHER_API_KEY'],
  venice: ['VENICE_API_KEY'],
  vercel: ['VERCEL_AI_GATEWAY_API_KEY'],
  'vercel-ai-gateway': ['VERCEL_AI_GATEWAY_API_KEY'],
  volcengine: ['VOLCENGINE_API_KEY', 'ARK_API_KEY'],
  'volcengine-plan': ['VOLCENGINE_API_KEY', 'ARK_API_KEY'],
  xai: ['XAI_API_KEY'],
  xiaomi: ['XIAOMI_API_KEY'],
  zai: ['ZAI_API_KEY'],
};

export class ZavorthProviderCapabilityMatrixService {
  private readonly now: () => Date;
  private readonly env: Record<string, string | undefined>;

  public constructor(runtime: ZavorthProviderCapabilityMatrixRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.env = runtime.env || process.env;
  }

  public buildSnapshot(input: ZavorthProviderCapabilityMatrixInput = {}): ZavorthProviderCapabilityMatrixSnapshot {
    const providers = this.filterProviders(this.buildProviders(), input);
    const summary = this.buildSummary(providers);
    const status: ZavorthProviderCapabilityMatrixStatus = providers.length > 0 ? 'ready' : 'blocked';
    return {
      contractVersion: ZAVORTH_PROVIDER_CAPABILITY_MATRIX_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      surface: 'provider-capability-matrix',
      status,
      summary,
      providers,
      llmContextBlock: this.buildLlmContextBlock(providers),
      commands: {
        status: 'zavorth providers matrix',
        json: 'npm run zavorth:provider-capability-matrix:json --silent',
        lookup: 'zavorth providers matrix --query "<provider or modality>"',
        doctor: 'zavorth providers doctor <provider>',
        canary: 'zavorth providers canary <provider> --confirm-live-io',
      },
      safety: {
        readOnlyInventory: true,
        noSecretsSerialized: true,
        liveProofRequiresExplicitCommand: true,
        compatibleDoesNotMeanDefaultEnabled: true,
      },
    };
  }

  public renderText(snapshot = this.buildSnapshot()): string {
    return [
      'Provider Capability Matrix',
      '',
      `status=${snapshot.status}`,
      `providers=${snapshot.summary.total} configured=${snapshot.summary.configured} needs_credential=${snapshot.summary.credentialRequired}`,
      '',
      ...snapshot.providers.map((provider) =>
        `${provider.id} | ${provider.state} | ${provider.modalities.join(',') || 'unknown'} | ${provider.dashboardAction}`,
      ),
      '',
    ].join('\n');
  }

  public buildLlmContextBlock(providers = this.buildProviders()): string {
    const visible = providers.slice(0, 30);
    return [
      'Provider Capability Matrix (canonical Zavorth provider map; read-only inventory).',
      'Do not infer provider coverage from src/providers only; use this matrix because routes, media providers, compatible gateways and long-tail providers live in multiple layers.',
      ...visible.map((provider) =>
        `- ${provider.id}: ${provider.state}; modalities=${provider.modalities.join('/') || 'unknown'}; doctor=${provider.doctor.available}; canary=${provider.canary.available}; env=${provider.envRefs.join(',') || 'none'}.`,
      ),
      'Live rule: configured means credentials or local endpoint are detected; canary is still explicit and never runs by default.',
    ].join('\n');
  }

  private buildProviders(): ZavorthProviderCapabilityMatrixProvider[] {
    const byId = new Map<string, ProviderAccumulator>();
    for (const id of ZAVORTH_PROVIDER_DOCUMENTED_IDS) {
      this.getAccumulator(byId, id, humanize(id));
    }
    for (const row of ZAVORTH_STATIC_PROVIDER_CATALOGS) {
      const entry = this.getAccumulator(byId, row.providerId, row.label);
      row.modalities.forEach((modality) => entry.modalities.add(modality));
      row.models.forEach((model) => entry.models.add(model));
      if (!entry.defaultModel && row.models[0]) entry.defaultModel = row.models[0];
      (row.credentialRefs || []).forEach((envRef) => entry.envRefs.add(envRef));
      entry.routeKind = row.routeKind || entry.routeKind;
      entry.level = row.local ? 'local-runtime' : this.levelFor(row.providerId, row.routeKind || entry.routeKind);
    }
    for (const row of ZAVORTH_MEDIA_PROVIDER_ROWS) {
      const entry = this.getAccumulator(byId, row.providerId, row.label);
      entry.modalities.add(row.modality);
      row.models.forEach((model) => entry.models.add(model));
      if (!entry.defaultModel) entry.defaultModel = row.defaultModel;
      row.credentialRefs.forEach((envRef) => entry.envRefs.add(envRef));
      entry.level = this.levelFor(row.providerId, entry.routeKind);
    }
    for (const catalog of ZAVORTH_PROVIDER_MODEL_CATALOGS) {
      const entry = this.getAccumulator(byId, catalog.providerId, catalog.label || humanize(catalog.providerId));
      catalog.models.forEach((model) => entry.models.add(model.id));
      if (!entry.defaultModel && catalog.models[0]?.id) entry.defaultModel = catalog.models[0].id;
    }
    for (const manifest of ZAVORTH_PROVIDER_CAPABILITY_MANIFESTS) {
      const id = manifest.providerId || manifest.id;
      const entry = this.getAccumulator(byId, id, manifest.label || humanize(id));
      manifest.routes.flatMap((route) => route.credentialRefs || [])
        .forEach((envRef) => entry.envRefs.add(envRef));
      entry.routeKind = manifest.routes[0]?.routeKind || entry.routeKind;
      entry.credentialKind = credentialKindFor(String(manifest.authKind || 'api_key'));
      entry.level = this.levelFor(id, entry.routeKind);
    }

    return Array.from(byId.values())
      .map((entry) => this.materialize(entry))
      .sort((left, right) => left.label.localeCompare(right.label));
  }

  private getAccumulator(
    byId: Map<string, ProviderAccumulator>,
    rawId: string,
    label: string,
  ): ProviderAccumulator {
    const id = normalizeId(rawId);
    const current = byId.get(id);
    if (current) {
      if (current.label === humanize(id) && label) current.label = label;
      return current;
    }
    const entry: ProviderAccumulator = {
      id,
      label: label || humanize(id),
      modalities: new Set(defaultModalitiesFor(id)),
      models: new Set(),
      defaultModel: null,
      envRefs: new Set(defaultEnvRefsFor(id)),
      routeKind: LOCAL_RUNTIME_IDS.has(id) ? 'local_runtime' : 'custom_compatible',
      credentialKind: LOCAL_RUNTIME_IDS.has(id) ? 'local-endpoint' : 'api-key',
      level: this.levelFor(id, LOCAL_RUNTIME_IDS.has(id) ? 'local_runtime' : 'custom_compatible'),
    };
    byId.set(id, entry);
    return entry;
  }

  private materialize(entry: ProviderAccumulator): ZavorthProviderCapabilityMatrixProvider {
    const envRefs = unique(Array.from(entry.envRefs).map((envRef) => envRef.trim()).filter(Boolean));
    const state = this.stateFor(entry, envRefs);
    return {
      id: entry.id,
      label: entry.label,
      level: entry.level,
      state,
      modalities: unique(Array.from(entry.modalities)),
      modelCount: entry.models.size,
      defaultModel: entry.defaultModel,
      envRefs,
      routeKind: entry.routeKind,
      credentialKind: entry.credentialKind,
      statusReason: statusReasonFor(state, envRefs),
      doctor: {
        available: true,
        command: `zavorth providers doctor ${entry.id}`,
        liveNetworkUsedByDefault: false,
      },
      canary: {
        available: true,
        command: `zavorth providers canary ${entry.id} --confirm-live-io`,
        liveNetworkUsedByDefault: false,
        requiresExplicitConfirmation: true,
      },
      dashboardAction: state === 'configured' || state === 'active' ? 'use' : 'configure',
    };
  }

  private stateFor(
    entry: ProviderAccumulator,
    envRefs: string[],
  ): ZavorthProviderCapabilityMatrixProviderState {
    const activeProvider = normalizeId(this.env.ZAVORTH_DEFAULT_PROVIDER || this.env.DEFAULT_PROVIDER || '');
    if (activeProvider && activeProvider === entry.id && this.hasConfig(envRefs)) {
      return 'active';
    }
    if (envRefs.length === 0) {
      return LOCAL_RUNTIME_IDS.has(entry.id) ? 'configured' : 'compatible';
    }
    return this.hasConfig(envRefs) ? 'configured' : 'needs-credential';
  }

  private hasConfig(envRefs: string[]): boolean {
    return envRefs.some((envRef) => Boolean(this.env[envRef] && String(this.env[envRef]).trim()));
  }

  private levelFor(providerId: string, routeKind: string): ZavorthProviderCapabilityMatrixProviderLevel {
    const id = normalizeId(providerId);
    if (LOCAL_RUNTIME_IDS.has(id) || routeKind === 'local_runtime') return 'local-runtime';
    if (RUNTIME_NATIVE_IDS.has(id)) return 'runtime-native';
    if (routeKind === 'custom_compatible') return 'compatible-route';
    return 'zavorth-native';
  }

  private filterProviders(
    providers: ZavorthProviderCapabilityMatrixProvider[],
    input: ZavorthProviderCapabilityMatrixInput,
  ): ZavorthProviderCapabilityMatrixProvider[] {
    const query = normalizeSearch(input.query || '');
    const limit = positive(input.limit) || 500;
    return providers
      .filter((provider) => !query || query.every((term) => searchable(provider).includes(term)))
      .slice(0, limit);
  }

  private buildSummary(providers: ZavorthProviderCapabilityMatrixProvider[]): ZavorthProviderCapabilityMatrixSnapshot['summary'] {
    const modalityCounts = Object.fromEntries(MODALITIES.map((modality) => [
      modality,
      providers.filter((provider) => provider.modalities.includes(modality)).length,
    ])) as Record<ZavorthProviderCapabilityModality, number>;
    return {
      total: providers.length,
      active: providers.filter((provider) => provider.state === 'active').length,
      configured: providers.filter((provider) => provider.state === 'configured' || provider.state === 'active').length,
      credentialRequired: providers.filter((provider) => provider.state === 'needs-credential').length,
      compatible: providers.filter((provider) => provider.state === 'compatible').length,
      blocked: providers.filter((provider) => provider.state === 'blocked').length,
      doctorAvailable: providers.filter((provider) => provider.doctor.available).length,
      canaryAvailable: providers.filter((provider) => provider.canary.available).length,
      modalityCounts,
    };
  }
}

function credentialKindFor(value: string): ZavorthProviderCapabilityMatrixCredentialKind {
  if (value.includes('oauth')) return 'oauth';
  if (value.includes('local')) return 'local-endpoint';
  if (value.includes('none')) return 'none';
  return 'api-key';
}

function defaultModalitiesFor(providerId: string): ZavorthProviderCapabilityModality[] {
  if (providerId.includes('speech') || providerId.includes('audio')) return ['tts'];
  if (providerId.includes('search')) return ['web-search'];
  if (LOCAL_RUNTIME_IDS.has(providerId)) return ['local-runtime'];
  return ['llm-chat'];
}

function defaultEnvRefsFor(providerId: string): string[] {
  const direct = DEFAULT_ENV_REFS[providerId];
  if (direct) return direct;
  const prefix = providerId.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return [`${prefix}_API_KEY`, `${prefix}_BASE_URL`];
}

function statusReasonFor(state: ZavorthProviderCapabilityMatrixProviderState, envRefs: string[]): string {
  if (state === 'active') return 'Configured and selected as the current default route.';
  if (state === 'configured') return 'Credential or local endpoint is detected; live proof is still explicit.';
  if (state === 'needs-credential') return `Waiting for ${envRefs.join(' or ')}.`;
  if (state === 'compatible') return 'Cataloged compatible route; not enabled as a default provider.';
  return 'Blocked by policy or missing route.';
}

function searchable(provider: ZavorthProviderCapabilityMatrixProvider): string {
  return [
    provider.id,
    provider.label,
    provider.state,
    provider.level,
    provider.routeKind,
    provider.credentialKind,
    provider.modalities.join(' '),
    provider.envRefs.join(' '),
  ].join(' ').toLowerCase();
}

function normalizeSearch(value: string): string[] {
  return String(value || '').toLowerCase().split(/\s+/).map((term) => term.trim()).filter(Boolean);
}

function normalizeId(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function humanize(value: string): string {
  return String(value || '')
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Provider';
}

function positive(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values.filter(Boolean)));
}
