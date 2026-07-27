import { logger } from '../logger.js';
import { ILlmProvider } from './ILlmProvider.js';
import { GatewayProvider } from './GatewayProvider.js';
import { LocalLlamaProvider } from './LocalLlamaProvider.js';
import { config } from '../config/index.js';
import { wrapLlmProviderWithEgressGuard } from '../security/LlmEgressGuard.js';
import type { SelectedModelProfile } from '../contracts/ModelPickerContract.js';
import {
  ProviderCompatibilityClassifier,
  type ProviderRuntimeAdapterKind,
} from '../services/providers/catalog/ProviderCompatibilityClassifier.js';
import type { ProviderIntegrationRouteManifest } from '../services/providers/catalog/ProviderIntegrationManifest.js';
import { getDefaultProviderIntegrationRegistry } from '../services/providers/catalog/ProviderIntegrationRegistry.js';
import { ProviderRegistry } from './ProviderRegistry.js';
import './plugins/index.js';

export type ProviderFactoryRouteInput = Partial<SelectedModelProfile> & {
  baseUrl?: string | null;
  baseURL?: string | null;
  baseUrlRef?: string | null;
  apiKey?: string | null;
  apiKeyRef?: string | null;
};

export type ProviderFactoryCreateInput = string | ProviderFactoryRouteInput;

export type ProviderFactoryRuntimeTarget = {
  providerName: string;
  cacheKey: string;
  adapterKind: ProviderRuntimeAdapterKind;
  modelName: string | null;
  baseUrl: string | null;
  apiKey: string | null;
  firstClassProvider: boolean;
  genericCompatible: boolean;
  runtimeSupported: boolean;
  explanation: string[];
};

function normalizeEnvKey(value: unknown): string {
  return String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function readEnv(...keys: Array<string | null | undefined>): string | null {
  for (const key of keys) {
    const normalized = normalizeEnvKey(key);
    if (!normalized) continue;
    const value = String(process.env[normalized] || '').trim();
    if (value) return value;
  }
  return null;
}

function isRouteInput(value: ProviderFactoryCreateInput): value is ProviderFactoryRouteInput {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function findCredentialRef(refs: string[] | undefined, pattern: RegExp): string | null {
  return refs?.find((ref) => pattern.test(ref)) || null;
}

function buildRouteInputFromRegistryRoute(route: ProviderIntegrationRouteManifest): ProviderFactoryRouteInput {
  const primaryModel = (route.models || []).find((model) => model.primary) || route.models?.[0] || null;
  return {
    providerName: route.providerName,
    providerLabel: route.label,
    providerId: route.providerId,
    routeId: route.routeId,
    routeKind: route.routeKind,
    credentialKind: route.authKind,
    credentialRef: findCredentialRef(route.credentialRefs, /API_KEY|TOKEN|SECRET|KEY/i),
    apiKeyRef: findCredentialRef(route.credentialRefs, /API_KEY|TOKEN|SECRET|KEY/i),
    baseUrlRef: findCredentialRef(route.credentialRefs, /BASE_URL|ENDPOINT|URL/i),
    modelName: primaryModel?.modelId || null,
    modelLabel: primaryModel?.label || primaryModel?.modelId || '',
    familyId: route.familyIds[0] || route.routeId,
    vendorId: route.vendorId,
    catalogSource: route.catalogSource || 'static',
    capabilities: route.capabilities,
    modalities: route.modalities,
    limitations: route.limitations || [],
    fallbackRouteIds: route.fallbackRouteIds || [],
  };
}

const DEDICATED_OPENAI_COMPATIBLE_PROVIDERS: Record<string, { modelEnv: string; defaultModel: string; baseUrl: string }> = {
  groq: { modelEnv: 'GROQ_MODEL', defaultModel: 'llama-3.3-70b-versatile', baseUrl: 'https://api.groq.com/openai/v1' },
  xai: { modelEnv: 'XAI_MODEL', defaultModel: 'grok-4', baseUrl: 'https://api.x.ai/v1' },
  mistral: { modelEnv: 'MISTRAL_MODEL', defaultModel: 'mistral-large-latest', baseUrl: 'https://api.mistral.ai/v1' },
  cerebras: { modelEnv: 'CEREBRAS_MODEL', defaultModel: 'llama-3.3-70b', baseUrl: 'https://api.cerebras.ai/v1' },
  together: { modelEnv: 'TOGETHER_MODEL', defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', baseUrl: 'https://api.together.xyz/v1' },
};

/**
 * ProviderFactory - Singleton/Factory to instantiate and manage
 * the lifecycle of LLM providers.
 */
export class ProviderFactory {
  private static cache: Map<string, ILlmProvider> = new Map();

  public static normalizeProviderName(name: string): string {
    const normalized = String(name || '').trim().toLowerCase();

    const registryResolved = ProviderRegistry.resolve(normalized);
    if (registryResolved) {
      return registryResolved.name;
    }

    if (normalized === 'google' || normalized === 'google-ai-studio' || normalized === 'google_ai_studio') {
      return 'gemini';
    }
    if (normalized === 'volcengine') {
      return 'byteplus';
    }
    if (
      normalized === 'custom_compatible'
      || normalized === 'custom-compatible'
      || normalized === 'openai-compatible'
      || normalized === 'openai_compatible'
    ) {
      return 'custom-openai-compatible';
    }
    if (normalized === 'lm-studio' || normalized === 'lm_studio') {
      return 'lmstudio';
    }

    // Never invent a product default provider (e.g. gemini). Empty means unconfigured.
    return normalized;
  }

  public static resolveRuntimeTarget(input: ProviderFactoryCreateInput): ProviderFactoryRuntimeTarget {
    const explicitRouteInput = isRouteInput(input) ? input : null;
    const requestedProviderName = explicitRouteInput
      ? String(explicitRouteInput.providerName || explicitRouteInput.providerId || explicitRouteInput.routeId || '').trim()
      : String(input || '').trim();
    const registryRoute = explicitRouteInput
      ? null
      : getDefaultProviderIntegrationRegistry().resolveProvider(requestedProviderName)?.primaryRoute || null;
    const routeInput = explicitRouteInput || (registryRoute ? buildRouteInputFromRegistryRoute(registryRoute) : null);
    const rawProviderName = routeInput
      ? String(routeInput.providerName || routeInput.providerId || routeInput.routeId || '').trim()
      : requestedProviderName;
    const providerName = this.normalizeProviderName(rawProviderName);
    const providerMeshExpansionTarget = this.resolveProviderMeshExpansionRuntimeTarget(providerName, routeInput);
    if (providerMeshExpansionTarget) {
      return providerMeshExpansionTarget;
    }
    const dedicatedOpenAiCompatibleTarget = this.resolveDedicatedOpenAiCompatibleTarget(providerName, routeInput);
    if (dedicatedOpenAiCompatibleTarget) {
      return dedicatedOpenAiCompatibleTarget;
    }
    const classification = new ProviderCompatibilityClassifier().classify(routeInput || {
      providerName,
      providerId: providerName,
      routeId: providerName,
    });
    const customSignal = Boolean(explicitRouteInput)
      || Boolean(registryRoute)
      || providerName.includes('openai-compatible')
      || providerName.includes('custom-openai-compatible')
      || providerName === 'custom-openai-compatible';
    const shouldPreserveUnknownFallback = !customSignal
      && !classification.firstClassProvider
      && classification.runtimeAdapter === 'openai_compatible';
    const resolvedProviderName = shouldPreserveUnknownFallback ? 'gemini' : providerName;
    const adapterKind = shouldPreserveUnknownFallback ? 'bespoke' : classification.runtimeAdapter;
    const envPrefix = normalizeEnvKey(resolvedProviderName);
    const baseUrl = this.resolveBaseUrl({
      input: routeInput,
      providerName: resolvedProviderName,
      envPrefix,
      adapterKind,
    });
    const apiKey = this.resolveApiKey({
      input: routeInput,
      envPrefix,
      adapterKind,
    });
    const modelName = String(routeInput?.modelName || routeInput?.modelLabel || '').trim() || null;
    const cacheKey = [
      resolvedProviderName,
      adapterKind,
      baseUrl || 'default',
      modelName || 'default',
    ].join('|');

    return {
      providerName: resolvedProviderName,
      cacheKey,
      adapterKind,
      modelName,
      baseUrl,
      apiKey,
      firstClassProvider: shouldPreserveUnknownFallback ? true : classification.firstClassProvider,
      genericCompatible: shouldPreserveUnknownFallback ? false : classification.genericCompatible,
      runtimeSupported: shouldPreserveUnknownFallback ? true : classification.runtimeSupported,
      explanation: shouldPreserveUnknownFallback
        ? [`Provider "${rawProviderName}" did not declare compatibility; keeping Gemini legacy fallback.`]
        : classification.explanation,
    };
  }

  /**
   * Creates or gets an LLM provider based on legacy name or SelectedModelProfile.
   */
  public static create(name: ProviderFactoryCreateInput): ILlmProvider {
    const target = this.resolveRuntimeTarget(name);
    const providerName = target.providerName;

    if (this.cache.has(target.cacheKey)) {
      return this.cache.get(target.cacheKey)!;
    }

    let provider: ILlmProvider | null = null;

    if (target.adapterKind === 'openai_compatible') {
      if (!target.baseUrl) {
        throw new Error(`OpenAI-compatible provider "${providerName}" requires a declared base URL.`);
      }
      provider = new GatewayProvider({
        name: providerName,
        baseURL: target.baseUrl,
        apiKey: target.apiKey || `${providerName}-api-key`,
        modelName: target.modelName,
      });
    } else if (target.adapterKind === 'gateway') {
      provider = new GatewayProvider({
        name: providerName,
        baseURL: target.baseUrl || config.AIGatewayBaseUrl,
        apiKey: target.apiKey || config.AIGatewayApiKey || config.openaiApiKey || 'AIGateway-local',
        modelName: target.modelName || config.AIGatewayModel,
      });
    } else if (target.adapterKind === 'local_openai_compatible') {
      provider = new LocalLlamaProvider({
        baseUrl: target.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
        modelName: target.modelName || process.env.OLLAMA_MODEL || 'gemma2:2b',
      });
    } else if (target.adapterKind === 'anthropic_compatible') {
      provider = new GatewayProvider({
        name: providerName,
        baseURL: target.baseUrl || config.AIGatewayBaseUrl || 'https://api.anthropic.com/v1',
        apiKey: target.apiKey || config.AIGatewayApiKey || process.env.ANTHROPIC_API_KEY || `${providerName}-api-key`,
        modelName: target.modelName || process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest',
        defaultHeaders: {
          'anthropic-version': process.env.ANTHROPIC_VERSION || '2023-06-01',
        },
      });
    } else {
      provider = ProviderRegistry.create(providerName, target);
      if (!provider) {
        logger.warn(`Provider "${providerName}" unknown. Using Gemini as fallback.`);
        provider = ProviderRegistry.create('gemini', target)!;
      }
    }

    provider = wrapLlmProviderWithEgressGuard(provider);
    this.cache.set(target.cacheKey, provider);
    logger.info(`LLM provider "${providerName}" instantiated successfully.`);
    return provider;
  }

  /**
   * Clears the provider cache (used by /model to force re-instantiation).
   */
  public static clearCache(): void {
    this.cache.clear();
  }

  private static resolveProviderMeshExpansionRuntimeTarget(
    providerName: string,
    input: ProviderFactoryRouteInput | null,
  ): ProviderFactoryRuntimeTarget | null {
    const normalized = this.normalizeProviderName(providerName);
    if (normalized === 'anthropic-direct') {
      return this.buildProviderMeshExpansionTarget({
        providerName: normalized,
        adapterKind: 'bespoke',
        modelName: String(input?.modelName || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6').trim(),
        baseUrl: String(input?.baseUrl || input?.baseURL || process.env.ANTHROPIC_BASE_URL || '').trim() || null,
        apiKey: String(input?.apiKey || process.env.ANTHROPIC_API_KEY || '').trim() || null,
        explanation: [
          'anthropic-direct uses the official Anthropic SDK by explicit selection.',
          'The route does not emulate another provider API and does not execute live without real credentials.',
        ],
      });
    }
    if (normalized === 'anthropic-vertex') {
      return this.buildProviderMeshExpansionTarget({
        providerName: normalized,
        adapterKind: 'bespoke',
        modelName: String(input?.modelName || process.env.ANTHROPIC_VERTEX_MODEL || 'claude-sonnet-4-6').trim(),
        baseUrl: null,
        apiKey: null,
        explanation: [
          'anthropic-vertex uses the Anthropic Vertex SDK by explicit Google Cloud route.',
          'Project, region, and cloud identity remain outside secret receipts.',
        ],
      });
    }
    if (normalized === 'bedrock-claude') {
      return this.buildProviderMeshExpansionTarget({
        providerName: normalized,
        adapterKind: 'bespoke',
        modelName: String(input?.modelName || process.env.BEDROCK_CLAUDE_MODEL || 'anthropic.claude-3-5-sonnet-latest-20250929-v1:0').trim(),
        baseUrl: null,
        apiKey: null,
        explanation: [
          'bedrock-claude uses AWS Bedrock Runtime by explicit selection.',
          'The route does not pretend to be an Anthropic endpoint and relies on normal AWS credentials.',
        ],
      });
    }
    if (normalized === 'google-genai') {
      return this.buildProviderMeshExpansionTarget({
        providerName: normalized,
        adapterKind: 'bespoke',
        modelName: String(input?.modelName || process.env.GOOGLE_GENAI_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim(),
        baseUrl: null,
        apiKey: String(input?.apiKey || process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || '').trim() || null,
        explanation: [
          'google-genai uses the @google/genai SDK as an explicit Provider Mesh route.',
          'The legacy Gemini provider remains available separately.',
        ],
      });
    }
    if (normalized === 'gemini-interactions') {
      return this.buildProviderMeshExpansionTarget({
        providerName: normalized,
        adapterKind: 'bespoke',
        modelName: String(input?.modelName || process.env.GEMINI_INTERACTIONS_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim(),
        baseUrl: String(input?.baseUrl || input?.baseURL || process.env.GEMINI_INTERACTIONS_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta').trim(),
        apiKey: String(input?.apiKey || process.env.GEMINI_INTERACTIONS_API_KEY || process.env.GEMINI_API_KEY || '').trim() || null,
        explanation: [
          'gemini-interactions uses the Interactions API beta for observable steps and optional server-side state.',
          'The route is opt-in and does not replace the stable Gemini generateContent.',
        ],
      });
    }
    if (normalized === 'lmstudio' || normalized === 'vllm') {
      const envPrefix = normalizeEnvKey(normalized);
      return this.buildProviderMeshExpansionTarget({
        providerName: normalized,
        adapterKind: 'local_openai_compatible',
        modelName: String(input?.modelName || readEnv(`${envPrefix}_MODEL`) || 'local-model').trim(),
        baseUrl: String(input?.baseUrl || input?.baseURL || readEnv(`${envPrefix}_BASE_URL`) || this.defaultBaseUrlForProvider(normalized) || '').trim() || null,
        apiKey: String(input?.apiKey || readEnv(`${envPrefix}_API_KEY`) || '').trim() || null,
        firstClassProvider: false,
        genericCompatible: true,
        explanation: [
          `${normalized} is treated as a local OpenAI-compatible route in the Provider Mesh.`,
          'local models should not use Anthropic impersonation.',
        ],
      });
    }
    return null;
  }

  private static resolveDedicatedOpenAiCompatibleTarget(
    providerName: string,
    input: ProviderFactoryRouteInput | null,
  ): ProviderFactoryRuntimeTarget | null {
    const dedicated = DEDICATED_OPENAI_COMPATIBLE_PROVIDERS[providerName];
    if (!dedicated) {
      return null;
    }
    const modelName = String(input?.modelName || process.env[dedicated.modelEnv] || dedicated.defaultModel).trim();
    const baseUrl = String(input?.baseUrl || input?.baseURL || process.env[`${normalizeEnvKey(providerName)}_BASE_URL`] || dedicated.baseUrl).trim();
    const apiKey = String(input?.apiKey || readEnv(input?.apiKeyRef, input?.credentialRef, `${normalizeEnvKey(providerName)}_API_KEY`) || '').trim() || null;
    return this.buildProviderMeshExpansionTarget({
      providerName,
      adapterKind: 'bespoke',
      modelName,
      baseUrl,
      apiKey,
      firstClassProvider: true,
      genericCompatible: true,
      explanation: [
        `${providerName} uses a dedicated Zavorth provider, preserving adapter metadata and native tools.`,
        'The API remains OpenAI-compatible, but does not fall through to the generic GatewayProvider.',
      ],
    });
  }

  private static buildProviderMeshExpansionTarget(input: {
    providerName: string;
    adapterKind: ProviderRuntimeAdapterKind;
    modelName: string | null;
    baseUrl: string | null;
    apiKey: string | null;
    firstClassProvider?: boolean;
    genericCompatible?: boolean;
    explanation: string[];
  }): ProviderFactoryRuntimeTarget {
    return {
      providerName: input.providerName,
      cacheKey: [
        input.providerName,
        input.adapterKind,
        input.baseUrl || 'default',
        input.modelName || 'default',
      ].join('|'),
      adapterKind: input.adapterKind,
      modelName: input.modelName,
      baseUrl: input.baseUrl,
      apiKey: input.apiKey,
      firstClassProvider: input.firstClassProvider ?? true,
      genericCompatible: input.genericCompatible ?? false,
      runtimeSupported: true,
      explanation: input.explanation,
    };
  }

  private static resolveBaseUrl(input: {
    input: ProviderFactoryRouteInput | null;
    providerName: string;
    envPrefix: string;
    adapterKind: ProviderRuntimeAdapterKind;
  }): string | null {
    const explicit = String(input.input?.baseUrl || input.input?.baseURL || '').trim();
    if (explicit) return explicit;
    const byRef = readEnv(input.input?.baseUrlRef);
    if (byRef) return byRef;

    if (input.adapterKind === 'gateway') {
      return readEnv(`${input.envPrefix}_BASE_URL`, 'AIGateway_BASE_URL', 'ZAVORTH_AIGateway_GATEWAY_BASE_URL')
        || config.AIGatewayBaseUrl
        || null;
    }
    if (input.adapterKind === 'local_openai_compatible') {
      return readEnv(`${input.envPrefix}_BASE_URL`, 'OLLAMA_BASE_URL')
        || this.defaultBaseUrlForProvider(input.providerName)
        || 'http://localhost:11434/v1';
    }
    if (input.adapterKind === 'openai_compatible') {
      return readEnv(
        `${input.envPrefix}_BASE_URL`,
        'CUSTOM_OPENAI_COMPATIBLE_BASE_URL',
        `${normalizeEnvKey(input.providerName)}_BASE_URL`,
      ) || this.defaultBaseUrlForProvider(input.providerName);
    }
    if (input.adapterKind === 'anthropic_compatible') {
      return readEnv(
        `${input.envPrefix}_BASE_URL`,
        'ANTHROPIC_COMPATIBLE_BASE_URL',
        'ANTHROPIC_BASE_URL',
        'AIGateway_BASE_URL',
      ) || config.AIGatewayBaseUrl || null;
    }
    return null;
  }

  private static defaultBaseUrlForProvider(providerName: string): string | null {
    const defaults: Record<string, string> = {
      deepinfra: 'https://api.deepinfra.com/v1/openai',
      alibaba: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      byteplus: 'https://ark.ap-southeast.bytepluses.com/api/v3',
      cerebras: 'https://api.cerebras.ai/v1',
      chutes: 'https://llm.chutes.ai/v1',
      comfy: 'http://localhost:8188/v1',
      cohere: 'https://api.cohere.ai/compatibility/v1',
      fireworks: 'https://api.fireworks.ai/inference/v1',
      falcon: 'https://router.huggingface.co/v1',
      'github-models': 'https://models.github.ai/inference',
      groq: 'https://api.groq.com/openai/v1',
      huggingface: 'https://router.huggingface.co/v1',
      jais: 'https://router.huggingface.co/v1',
      'kimi-coding': 'https://api.moonshot.ai/v1',
      moonshot: 'https://api.moonshot.ai/v1',
      mistral: 'https://api.mistral.ai/v1',
      nvidia: 'https://integrate.api.nvidia.com/v1',
      opencode: 'https://opencode.ai/zen/v1',
      perplexity: 'https://api.perplexity.ai',
      qianfan: 'https://qianfan.baidubce.com/v2',
      sambanova: 'https://api.sambanova.ai/v1',
      sglang: 'http://localhost:30000/v1',
      lmstudio: 'http://localhost:1234/v1',
      vllm: 'http://localhost:8000/v1',
      stepfun: 'https://api.stepfun.com/v1',
      together: 'https://api.together.xyz/v1',
      'vercel-ai-gateway': 'https://ai-gateway.vercel.sh/v1',
      venice: 'https://api.venice.ai/api/v1',
      voyage: 'https://api.voyageai.com/v1',
      xai: 'https://api.x.ai/v1',
      zai: 'https://open.bigmodel.cn/api/paas/v4',
      nous: 'https://api.nousresearch.com/v1',
      novita: 'https://api.novita.ai/v3/openai',
      arcee: 'https://api.arcee.ai/v2',
      gmi: 'https://api.gmi.cloud/v1',
      kilocode: 'https://api.kilocode.ai/v1',
      xiaomi: 'https://api.xiaomimimo.com/v1',
    };
    return defaults[this.normalizeProviderName(providerName)] || null;
  }

  private static resolveApiKey(input: {
    input: ProviderFactoryRouteInput | null;
    envPrefix: string;
    adapterKind: ProviderRuntimeAdapterKind;
  }): string | null {
    const explicit = String(input.input?.apiKey || '').trim();
    if (explicit) return explicit;
    const providerName = this.normalizeProviderName(String(input.input?.providerName || input.input?.providerId || input.input?.routeId || '').trim());
    if (providerName === 'cohere') {
      return readEnv(input.input?.apiKeyRef, input.input?.credentialRef, 'COHERE_API_KEY', 'CO_API_KEY');
    }
    if (providerName === 'cerebras') {
      return readEnv(input.input?.apiKeyRef, input.input?.credentialRef, 'CEREBRAS_API_KEY');
    }
    if (providerName === 'github-models') {
      return readEnv(input.input?.apiKeyRef, input.input?.credentialRef, 'GITHUB_MODELS_TOKEN', 'GITHUB_TOKEN');
    }
    if (providerName === 'sambanova') {
      return readEnv(input.input?.apiKeyRef, input.input?.credentialRef, 'SAMBANOVA_API_KEY');
    }
    if (providerName === 'falcon') {
      return readEnv(input.input?.apiKeyRef, input.input?.credentialRef, 'FALCON_API_KEY', 'HUGGINGFACE_API_KEY', 'HF_TOKEN');
    }
    if (providerName === 'jais') {
      return readEnv(input.input?.apiKeyRef, input.input?.credentialRef, 'JAIS_API_KEY', 'CORE42_API_KEY', 'HUGGINGFACE_API_KEY', 'HF_TOKEN');
    }
    return readEnv(
      input.input?.apiKeyRef,
      input.input?.credentialRef,
      `${input.envPrefix}_API_KEY`,
      input.adapterKind === 'openai_compatible' ? 'CUSTOM_OPENAI_COMPATIBLE_API_KEY' : null,
      input.adapterKind === 'anthropic_compatible' ? 'ANTHROPIC_API_KEY' : null,
      input.adapterKind === 'anthropic_compatible' ? 'ANTHROPIC_COMPATIBLE_API_KEY' : null,
    );
  }
}
