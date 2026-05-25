import { ILlmProvider } from './ILlmProvider.js';
import { GeminiProvider } from './GeminiProvider.js';
import { DeepSeekProvider } from './DeepSeekProvider.js';
import { OpenAIProvider } from './OpenAIProvider.js';
import { OpenRouterProvider } from './OpenRouterProvider.js';
import { OpenCodeProvider } from './OpenCodeProvider.js';
import { QwenProvider } from './QwenProvider.js';
import { GatewayProvider } from './GatewayProvider.js';
import { MiniMaxProvider } from './MiniMaxProvider.js';
import { LocalLlamaProvider } from './LocalLlamaProvider.js';
import { AnthropicDirectProviderAdapter } from '../adapters/providers/AnthropicDirectProviderAdapter.js';
import { AnthropicVertexProviderAdapter } from '../adapters/providers/AnthropicVertexProviderAdapter.js';
import { BedrockClaudeProviderAdapter } from '../adapters/providers/BedrockClaudeProviderAdapter.js';
import { GoogleGenAiProviderAdapter } from '../adapters/providers/GoogleGenAiProviderAdapter.js';
import { GeminiInteractionsProviderAdapter } from './GeminiInteractionsProviderAdapter.js';
import { config } from '../config/index.js';
import { wrapLlmProviderWithEgressGuard } from '../security/LlmEgressGuard.js';
import type { SelectedModelProfile } from '../contracts/ModelPickerContract.js';
import {
  ProviderCompatibilityClassifier,
  type ProviderRuntimeAdapterKind,
} from '../services/providers/catalog/ProviderCompatibilityClassifier.js';
import type { ProviderIntegrationRouteManifest } from '../services/providers/catalog/ProviderIntegrationManifest.js';
import { getDefaultProviderIntegrationRegistry } from '../services/providers/catalog/ProviderIntegrationRegistry.js';

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

/**
 * ProviderFactory - Singleton/Factory para instanciar e gerenciar
 * o ciclo de vida dos provedores LLM.
 */
export class ProviderFactory {
  private static cache: Map<string, ILlmProvider> = new Map();

  public static normalizeProviderName(name: string): string {
    const normalized = String(name || '').trim().toLowerCase();
    if (normalized === 'ai-gateway' || normalized === 'ai_gateway' || normalized === 'aigateway') {
      return 'aigateway';
    }
    if (normalized === 'google' || normalized === 'google-ai-studio' || normalized === 'google_ai_studio') {
      return 'gemini';
    }
    if (
      normalized === 'custom_compatible'
      || normalized === 'custom-compatible'
      || normalized === 'openai-compatible'
      || normalized === 'openai_compatible'
    ) {
      return 'custom-openai-compatible';
    }
    if (normalized === 'local-llama' || normalized === 'local_llama' || normalized === 'localllama') {
      return 'ollama';
    }
    if (normalized === 'anthropic-sdk' || normalized === 'claude-direct' || normalized === 'anthropic_direct') {
      return 'anthropic-direct';
    }
    if (normalized === 'anthropic_vertex' || normalized === 'claude-vertex' || normalized === 'vertex-claude') {
      return 'anthropic-vertex';
    }
    if (normalized === 'bedrock' || normalized === 'aws-bedrock' || normalized === 'bedrock_claude') {
      return 'bedrock-claude';
    }
    if (normalized === 'genai' || normalized === 'google_genai' || normalized === 'google-ai') {
      return 'google-genai';
    }
    if (normalized === 'gemini-interactions' || normalized === 'google-interactions-api' || normalized === 'interactions-api') {
      return 'gemini-interactions';
    }
    if (normalized === 'lm-studio' || normalized === 'lm_studio') {
      return 'lmstudio';
    }
    return normalized || 'gemini';
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
        ? [`Provedor "${rawProviderName}" nao declarou compatibilidade; mantendo fallback Gemini legado.`]
        : classification.explanation,
    };
  }

  /**
   * Cria ou obtem um provedor LLM com base no nome legado ou SelectedModelProfile.
   */
  public static create(name: ProviderFactoryCreateInput): ILlmProvider {
    const target = this.resolveRuntimeTarget(name);
    const providerName = target.providerName;

    if (this.cache.has(target.cacheKey)) {
      return this.cache.get(target.cacheKey)!;
    }

    let provider: ILlmProvider;

    if (providerName === 'anthropic-direct') {
      provider = new AnthropicDirectProviderAdapter({
        apiKey: target.apiKey,
        baseUrl: target.baseUrl,
        modelName: target.modelName,
      });
    } else if (providerName === 'anthropic-vertex') {
      provider = new AnthropicVertexProviderAdapter({
        modelName: target.modelName,
      });
    } else if (providerName === 'bedrock-claude') {
      provider = new BedrockClaudeProviderAdapter({
        modelName: target.modelName,
      });
    } else if (providerName === 'google-genai') {
      provider = new GoogleGenAiProviderAdapter({
        apiKey: target.apiKey,
        modelName: target.modelName,
      });
    } else if (providerName === 'gemini-interactions') {
      provider = new GeminiInteractionsProviderAdapter({
        apiKey: target.apiKey,
        baseUrl: target.baseUrl,
        modelName: target.modelName,
      });
    } else if (target.adapterKind === 'openai_compatible') {
      if (!target.baseUrl) {
        throw new Error(`Provider OpenAI-compatible "${providerName}" precisa de base URL declarada.`);
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
      switch (providerName) {
        case 'gemini':
          provider = new GeminiProvider();
          break;
        case 'deepseek':
          provider = new DeepSeekProvider();
          break;
        case 'openai':
          provider = new OpenAIProvider();
          break;
        case 'minimax':
          provider = new MiniMaxProvider();
          break;
        case 'aigateway':
          provider = new GatewayProvider();
          break;
        case 'qwen':
        case 'puter':
          provider = new QwenProvider();
          break;
        case 'openrouter':
          provider = new OpenRouterProvider();
          break;
        case 'opencode':
          provider = new OpenCodeProvider();
          break;
        case 'ollama':
          provider = new LocalLlamaProvider({
            baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
            modelName: process.env.OLLAMA_MODEL || 'gemma2:2b',
          });
          break;
        default:
          console.warn(`Provider "${providerName}" desconhecido. Usando Gemini como fallback.`);
          provider = new GeminiProvider();
      }
    }

    provider = wrapLlmProviderWithEgressGuard(provider);
    this.cache.set(target.cacheKey, provider);
    console.log(`Provider LLM "${providerName}" instanciado com sucesso.`);
    return provider;
  }

  /**
   * Limpa o cache de provedores (usado pelo /model para forcar re-instanciacao).
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
          'anthropic-direct usa o SDK oficial Anthropic por selecao explicita.',
          'A rota nao emula API de outro provider e nao executa live sem credencial real.',
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
          'anthropic-vertex usa o SDK Anthropic Vertex por rota Google Cloud explicita.',
          'Project, region e identidade cloud ficam fora de receipts secretos.',
        ],
      });
    }
    if (normalized === 'bedrock-claude') {
      return this.buildProviderMeshExpansionTarget({
        providerName: normalized,
        adapterKind: 'bespoke',
        modelName: String(input?.modelName || process.env.BEDROCK_CLAUDE_MODEL || 'anthropic.claude-sonnet-4-5-20250929-v1:0').trim(),
        baseUrl: null,
        apiKey: null,
        explanation: [
          'bedrock-claude usa AWS Bedrock Runtime por selecao explicita.',
          'A rota nao finge endpoint Anthropic e depende de credenciais AWS normais.',
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
          'google-genai usa o SDK @google/genai como rota explicita do Provider Mesh.',
          'O provider Gemini legado continua disponivel separadamente.',
        ],
      });
    }
    if (normalized === 'gemini-interactions') {
      return this.buildProviderMeshExpansionTarget({
        providerName: normalized,
        adapterKind: 'bespoke',
        modelName: String(input?.modelName || process.env.GEMINI_INTERACTIONS_MODEL || process.env.GEMINI_MODEL || 'gemini-3.5-flash').trim(),
        baseUrl: String(input?.baseUrl || input?.baseURL || process.env.GEMINI_INTERACTIONS_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta').trim(),
        apiKey: String(input?.apiKey || process.env.GEMINI_INTERACTIONS_API_KEY || process.env.GEMINI_API_KEY || '').trim() || null,
        explanation: [
          'gemini-interactions usa a Interactions API beta para steps observaveis e estado server-side opcional.',
          'A rota fica opt-in e nao substitui o Gemini generateContent estavel.',
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
          `${normalized} e tratado como rota local OpenAI-compatible do Provider Mesh.`,
          'Modelos locais nao devem usar impersonacao Anthropic.',
        ],
      });
    }
    return null;
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
      cerebras: 'https://api.cerebras.ai/v1',
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
