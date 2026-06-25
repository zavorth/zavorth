import { INTEGRATION_CHANNEL_MANIFESTS } from '../domain/platform-ecosystem/infrastructure/integration-registry/IntegrationRegistryCatalogChannels.js';
import type {
  ZavorthNativeIntegrationEntry,
  ZavorthNativeIntegrationKind,
  ZavorthNativeIntegrationSnapshot,
  ZavorthNativeIntegrationStatus,
} from '../contracts/native/ZavorthNativeIntegrationContract.js';
import { ZAVORTH_NATIVE_INTEGRATION_CONTRACT_VERSION } from '../contracts/native/ZavorthNativeIntegrationContract.js';
import { GROUPS, PRIMITIVES } from './CapabilityNormalizationCatalog.js';
import { ChannelLongTailActivationService } from './ChannelLongTailActivationService.js';
import { ProviderIntegrationRegistry } from './providers/catalog/ProviderIntegrationRegistry.js';

export type ZavorthNativeIntegrationRuntime = {
  now?: () => Date;
  providerRegistry?: ProviderIntegrationRegistry;
  channelLongTail?: ChannelLongTailActivationService;
};

type NativeSeed = {
  id: string;
  kind: ZavorthNativeIntegrationKind;
  nativeSurface: string;
  configRefs: string[];
  evidence: string[];
  status?: ZavorthNativeIntegrationStatus;
};

const NATIVE_PROVIDER_COMPATIBILITY_SEEDS: NativeSeed[] = [
  providerCompat('grok', 'ProviderIntegrationRegistry:xai', ['XAI_API_KEY'], 'Grok is a native xAI-compatible provider alias in Zavorth.'),
  providerCompat('dashscope', 'ProviderIntegrationRegistry:alibaba', ['ALIBABA_API_KEY', 'DASHSCOPE_API_KEY'], 'DashScope is a native Alibaba/Qwen-compatible provider alias in Zavorth.'),
  providerCompat('modelstudio', 'ProviderIntegrationRegistry:alibaba', ['ALIBABA_API_KEY', 'DASHSCOPE_API_KEY'], 'ModelStudio is a native Alibaba-compatible provider alias in Zavorth.'),
  providerCompat('qwencloud', 'ProviderIntegrationRegistry:qwen', ['QWEN_API_KEY'], 'Qwen Cloud is a native Qwen provider alias in Zavorth.'),
  providerCompat('kimi', 'ProviderIntegrationRegistry:moonshot', ['MOONSHOT_API_KEY', 'KIMI_API_KEY'], 'Kimi is a native Moonshot/Kimi-compatible provider alias in Zavorth.'),
  providerCompat('brave', 'SearchProviderLiveAdapter:brave', ['BRAVE_API_KEY'], 'Brave Search is a native Zavorth search provider.'),
  providerCompat('duckduckgo', 'DuckDuckGoSearchAdapter', [], 'DuckDuckGo is a native Zavorth search provider.'),
  providerCompat('exa', 'SearchProviderLiveAdapter:exa', ['EXA_API_KEY'], 'Exa is a native Zavorth search provider.'),
  providerCompat('firecrawl', 'FirecrawlWebExtractLiveAdapter', ['FIRECRAWL_API_KEY'], 'Firecrawl is a native Zavorth web extraction provider.'),
  providerCompat('searxng', 'SearchProviderLiveAdapter:searxng', ['SEARXNG_BASE_URL'], 'SearXNG is a native Zavorth self-hosted search provider.'),
  providerCompat('tavily', 'SearchProviderLiveAdapter:tavily', ['TAVILY_API_KEY'], 'Tavily is a native Zavorth search provider.'),
  providerCompat('google-vertex', 'GoogleGenAiProviderAdapter:VertexAI', ['GOOGLE_CLOUD_PROJECT', 'GOOGLE_CLOUD_LOCATION'], 'Google Vertex is a native Zavorth Gemini provider mode.'),
  providerCompat('cli', 'LocalLlamaProvider/OllamaRoute', ['CLI_BASE_URL'], 'CLI/local provider routes are native local-runtime surfaces in Zavorth.'),
  providerCompat('local', 'LocalLlamaProvider/OllamaRoute', ['LOCAL_BASE_URL'], 'Local provider routes are native local-runtime surfaces in Zavorth.'),
];

export class ZavorthNativeIntegrationService {
  private readonly now: () => Date;
  private readonly providerRegistry: ProviderIntegrationRegistry;
  private readonly channelLongTail: ChannelLongTailActivationService;

  constructor(runtime: ZavorthNativeIntegrationRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.providerRegistry = runtime.providerRegistry || new ProviderIntegrationRegistry();
    this.channelLongTail = runtime.channelLongTail || new ChannelLongTailActivationService({ now: this.now });
  }

  public buildSnapshot(): ZavorthNativeIntegrationSnapshot {
    const entries = [
      ...this.providerSeeds().map((seed) => this.toEntry(seed)),
      ...this.channelSeeds().map((seed) => this.toEntry(seed)),
      ...this.capabilitySeeds().map((seed) => this.toEntry(seed)),
    ].sort((left, right) => `${left.kind}:${left.id}`.localeCompare(`${right.kind}:${right.id}`));
    const needsAdapter = entries.filter((entry) => entry.status === 'needs-native-adapter').length;

    return {
      contractVersion: ZAVORTH_NATIVE_INTEGRATION_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      catalogId: 'zavorth-native',
      status: needsAdapter > 0 ? 'attention' : 'ready',
      summary: {
        providers: entries.filter((entry) => entry.kind === 'provider').length,
        channels: entries.filter((entry) => entry.kind === 'channel').length,
        capabilities: entries.filter((entry) => entry.kind === 'capability').length,
        nativeReady: entries.length - needsAdapter,
        needsAdapter,
        missingConfigurationOnly: needsAdapter === 0,
      },
      entries,
      safety: {
        inventoryOnly: true,
        noRuntimeAdapterCodeExecuted: true,
        noSecretsRead: true,
        noLiveNetworkCalls: true,
        zavorthNativeActivationRequiresConfigAndProof: true,
      },
      nextActions: [
        'Configure only the native providers, channels and capabilities you want to activate.',
        'Run doctor commands before live proof commands.',
        'Live proof commands require explicit operator confirmation and redacted receipts.',
      ],
    };
  }

  public renderText(snapshot: ZavorthNativeIntegrationSnapshot): string {
    return [
      '[zavorth-native-integrations]',
      `status=${snapshot.status}`,
      `catalog=${snapshot.catalogId}`,
      `providers=${snapshot.summary.providers} channels=${snapshot.summary.channels} capabilities=${snapshot.summary.capabilities}`,
      `native_ready=${snapshot.summary.nativeReady} needs_adapter=${snapshot.summary.needsAdapter}`,
      `missing_configuration_only=${snapshot.summary.missingConfigurationOnly}`,
      '',
      '[activation]',
      ...snapshot.entries.slice(0, 160).map((entry) =>
        `- ${entry.kind}/${entry.id}: ${entry.status} | ${entry.nativeSurface} | config=${entry.configRefs.join(', ') || 'none'}`),
      snapshot.entries.length > 160 ? `... ${snapshot.entries.length - 160} more native integration(s)` : '',
      '',
      '[safety]',
      'zavorth_native_activation_requires_config_and_proof=true',
      'no_runtime_adapter_code_executed=true',
      'no_secrets_read=true',
      'no_live_network_calls=true',
      '',
      '[next]',
      ...snapshot.nextActions.map((action) => `- ${action}`),
      '',
    ].filter((line) => line !== '').join('\n');
  }

  private providerSeeds(): NativeSeed[] {
    const seeds = new Map<string, NativeSeed>();
    for (const manifest of this.providerRegistry.listManifests()) {
      for (const id of unique([
        manifest.id,
        manifest.providerId,
        manifest.providerName,
        ...(manifest.aliases || []),
        ...manifest.routes.flatMap((route) => [
          route.routeId,
          route.providerId,
          route.providerName,
          ...(route.aliases || []),
        ]),
      ].map(normalizeId))) {
        if (!id || id.endsWith('*')) {
          continue;
        }
        const route = this.providerRegistry.resolveRoute(id);
        const provider = this.providerRegistry.resolveProvider(id);
        seeds.set(id, {
          id,
          kind: 'provider',
          nativeSurface: `ProviderIntegrationRegistry:${manifest.providerId}`,
          configRefs: unique([
            ...(route?.route.credentialRefs || []),
            ...(provider?.primaryRoute?.credentialRefs || []),
            ...fallbackProviderConfigRefs(id),
          ]),
          evidence: [
            `Provider is declared in Zavorth ProviderIntegrationRegistry as ${manifest.providerId}.`,
            'Activation is native to Zavorth and does not execute runtime adapter code.',
          ],
        });
      }
    }
    for (const seed of NATIVE_PROVIDER_COMPATIBILITY_SEEDS) {
      seeds.set(seed.id, seed);
    }
    return Array.from(seeds.values());
  }

  private channelSeeds(): NativeSeed[] {
    const seeds = new Map<string, NativeSeed>();
    for (const manifest of INTEGRATION_CHANNEL_MANIFESTS) {
      for (const id of unique([manifest.id, ...(manifest.aliases || [])].map(normalizeId))) {
        seeds.set(id, {
          id,
          kind: 'channel',
          nativeSurface: `IntegrationChannelRegistry:${manifest.id}`,
          configRefs: this.channelManifestConfigRefs(manifest, id),
          evidence: [
            `Channel is declared in Zavorth IntegrationChannelRegistry as ${manifest.id}.`,
            'Activation is native to Zavorth and governed by channel policy.',
          ],
        });
      }
    }
    for (const entry of this.channelLongTail.buildSnapshot().entries) {
      const id = normalizeId(entry.channelId);
      seeds.set(id, {
        id,
        kind: 'channel',
        nativeSurface: `ChannelLongTailActivationService:${entry.family}`,
        configRefs: unique([
          ...entry.configSchema.requiredEnv,
          ...entry.configSchema.allowlistEnv,
        ]),
        evidence: [
          `Channel is declared in Zavorth long-tail activation as ${entry.channelId}.`,
          'Configured doctor and staging-live proof command are native to Zavorth.',
        ],
      });
    }
    for (const id of ['signal', 'teams', 'msteams']) {
      seeds.set(id, {
        id,
        kind: 'channel',
        nativeSurface: id === 'signal' ? 'SignalGateway/SignalLiveClient' : 'TeamsGateway/TeamsGraphBotClient',
        configRefs: fallbackChannelConfigRefs(id),
        evidence: [
          `${id} has a Zavorth native gateway/live client surface.`,
          'Activation requires local config and explicit live proof.',
        ],
      });
    }
    return Array.from(seeds.values());
  }

  private capabilitySeeds(): NativeSeed[] {
    const primitiveById = new Map(PRIMITIVES.map((primitive) => [primitive.primitiveId, primitive]));
    return GROUPS.flatMap((group) => group.names.map((id) => {
      const primitive = primitiveById.get(group.primitiveId);
      return {
        id: normalizeId(id),
        kind: 'capability' as const,
        nativeSurface: primitive
          ? `${primitive.serviceTarget}#${primitive.primitiveId}`
          : `CapabilityNormalizationCatalog:${group.primitiveId}`,
        configRefs: [],
        evidence: [
          `Capability is declared in Zavorth CapabilityNormalizationCatalog under ${group.primitiveId}.`,
          'The LLM can see this as a Zavorth-native capability once policy exposes the corresponding tool/runtime surface.',
        ],
      };
    }));
  }

  private toEntry(seed: NativeSeed): ZavorthNativeIntegrationEntry {
    return {
      id: seed.id,
      kind: seed.kind,
      source: 'zavorth-native-catalog',
      status: seed.status || 'ready-for-configuration',
      nativeSurface: `zavorth-native:${seed.nativeSurface}`,
      configRefs: unique(seed.configRefs),
      doctorCommand: this.doctorCommandFor(seed),
      liveProofCommand: this.liveProofCommandFor(seed),
      safety: {
        zavorthNative: true,
        noSecretsSerialized: true,
        liveUseRequiresExplicitConfiguration: true,
        liveProofRequiresOperatorConfirmation: true,
      },
      evidence: seed.evidence,
    };
  }

  private channelManifestConfigRefs(manifest: any, id: string): string[] {
    const refs = (manifest.requirements || [])
      .map((requirement: any) => String(requirement.envKey || requirement.key || '').trim())
      .filter(Boolean);
    return refs.length > 0 ? refs : fallbackChannelConfigRefs(id);
  }

  private doctorCommandFor(seed: Pick<NativeSeed, 'id' | 'kind'>): string {
    if (seed.kind === 'provider') {
      return `zavorth providers doctor ${seed.id}`;
    }
    if (seed.kind === 'channel') {
      return `zavorth channels doctor ${seed.id}`;
    }
    return `zavorth capabilities doctor ${seed.id}`;
  }

  private liveProofCommandFor(seed: Pick<NativeSeed, 'id' | 'kind'>): string {
    if (seed.kind === 'provider') {
      return `zavorth providers prove ${seed.id} --confirm-live-io`;
    }
    if (seed.kind === 'channel') {
      return `zavorth channels prove ${seed.id} --confirm-live-io`;
    }
    return `zavorth capabilities prove ${seed.id} --confirm-live-io`;
  }
}

function fallbackProviderConfigRefs(providerId: string): string[] {
  const prefix = envPrefix(providerId);
  if (['local', 'ollama', 'cli', 'lmstudio', 'vllm', 'sglang'].includes(providerId)) {
    return [`${prefix}_BASE_URL`];
  }
  return [`${prefix}_API_KEY`];
}

function fallbackChannelConfigRefs(channelId: string): string[] {
  const prefix = envPrefix(channelId);
  return [`${prefix}_TOKEN`, `${prefix}_ALLOWED_RECIPIENTS`];
}

function providerCompat(id: string, nativeSurface: string, configRefs: string[], evidence: string): NativeSeed {
  return {
    id,
    kind: 'provider',
    nativeSurface,
    configRefs,
    evidence: [
      evidence,
      'This is declared as a Zavorth-native compatibility alias, not an runtime-adapter bridge.',
    ],
  };
}

function envPrefix(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function normalizeId(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values.filter(Boolean)));
}
