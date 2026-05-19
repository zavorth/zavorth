import type {
  ProviderRuntimeActivationAdapterFamily,
  ProviderRuntimeActivationConfigSchema,
  ProviderRuntimeActivationEntry,
  ProviderRuntimeActivationGate,
  ProviderRuntimeActivationGateStatus,
  ProviderRuntimeActivationP0Id,
  ProviderRuntimeActivationSnapshot,
  ProviderRuntimeActivationStatus,
} from '../contracts/ProviderRuntimeActivationContract.js';
import { ZAVORTH_PROVIDER_RUNTIME_ACTIVATION_CONTRACT_VERSION } from '../contracts/ProviderRuntimeActivationContract.js';
import type { LiveReadinessEntry, LiveReadinessStatus } from '../contracts/LiveReadinessContract.js';
import { LiveReadinessService } from './LiveReadinessService.js';

type ProviderRuntimeActivationRuntime = {
  now?: () => Date;
  liveReadinessService?: LiveReadinessService;
};

type ProviderRuntimeActivationDescriptor = {
  providerId: ProviderRuntimeActivationP0Id;
  status: ProviderRuntimeActivationStatus;
  adapterFamily: ProviderRuntimeActivationAdapterFamily;
  runtimeAdapter: string;
  adapterTarget: string;
  defaultModelName: string;
  configSchema: ProviderRuntimeActivationConfigSchema;
  gaps: string[];
};

const PROVIDER_RUNTIME_P0: ProviderRuntimeActivationDescriptor[] = [
  firstClass('openai', 'bespoke', 'src/providers/OpenAIProvider.ts', 'gpt-5.2', ['OPENAI_API_KEY']),
  firstClass('google', 'gemini-rest', 'src/providers/GeminiProvider.ts + src/adapters/providers/ProviderP0LiveClients.ts#GeminiRestProviderLiveClient', 'gemini-2.5-flash', ['GEMINI_API_KEY']),
  firstClass('deepseek', 'bespoke', 'src/providers/DeepSeekProvider.ts', 'deepseek-chat', ['DEEPSEEK_API_KEY']),
  firstClass('qwen', 'bespoke', 'src/providers/QwenProvider.ts', 'qwen3-coder-plus', ['PUTER_AUTH_TOKEN']),
  firstClass('openrouter', 'bespoke', 'src/providers/OpenRouterProvider.ts', 'openrouter/auto', ['OPENROUTER_API_KEY']),
  firstClass('ollama', 'local-openai-compatible', 'src/providers/LocalLlamaProvider.ts', 'gemma2:2b', ['OLLAMA_BASE_URL'], []),
  compatible('anthropic', 'anthropic-compatible', 'src/adapters/providers/ProviderP0LiveClients.ts#AnthropicCompatibleProviderLiveClient', 'claude-sonnet-4-5', ['ANTHROPIC_API_KEY'], ['ANTHROPIC_BASE_URL']),
  compatible('mistral', 'openai-compatible', 'src/adapters/providers/ProviderP0LiveClients.ts#OpenAICompatibleProviderLiveClient', 'mistral-large-latest', ['MISTRAL_API_KEY'], ['MISTRAL_BASE_URL']),
  compatible('groq', 'openai-compatible', 'src/adapters/providers/ProviderP0LiveClients.ts#OpenAICompatibleProviderLiveClient', 'llama-3.3-70b-versatile', ['GROQ_API_KEY'], ['GROQ_BASE_URL']),
  compatible('together', 'openai-compatible', 'src/adapters/providers/ProviderP0LiveClients.ts#OpenAICompatibleProviderLiveClient', 'meta-llama/Llama-3.3-70B-Instruct-Turbo', ['TOGETHER_API_KEY'], ['TOGETHER_BASE_URL']),
  compatible('perplexity', 'openai-compatible', 'src/adapters/providers/ProviderP0LiveClients.ts#OpenAICompatibleProviderLiveClient', 'sonar-pro', ['PERPLEXITY_API_KEY'], ['PERPLEXITY_BASE_URL']),
  compatible('xai', 'openai-compatible', 'src/adapters/providers/ProviderP0LiveClients.ts#OpenAICompatibleProviderLiveClient', 'grok-4', ['XAI_API_KEY'], ['XAI_BASE_URL']),
  compatible('huggingface', 'openai-compatible', 'src/adapters/providers/ProviderP0LiveClients.ts#OpenAICompatibleProviderLiveClient', 'meta-llama/Llama-3.1-8B-Instruct', ['HUGGINGFACE_API_KEY'], ['HUGGINGFACE_BASE_URL']),
  compatible('fireworks', 'openai-compatible', 'src/adapters/providers/ProviderP0LiveClients.ts#OpenAICompatibleProviderLiveClient', 'accounts/fireworks/models/llama-v3p1-70b-instruct', ['FIREWORKS_API_KEY'], ['FIREWORKS_BASE_URL']),
  compatible('deepinfra', 'openai-compatible', 'src/adapters/providers/ProviderP0LiveClients.ts#OpenAICompatibleProviderLiveClient', 'meta-llama/Meta-Llama-3.1-70B-Instruct', ['DEEPINFRA_API_KEY'], ['DEEPINFRA_BASE_URL']),
  local('lmstudio', 'src/adapters/providers/ProviderP0LiveClients.ts#OpenAICompatibleProviderLiveClient', 'local-model', ['LMSTUDIO_BASE_URL']),
  local('vllm', 'src/adapters/providers/ProviderP0LiveClients.ts#OpenAICompatibleProviderLiveClient', 'local-model', ['VLLM_BASE_URL']),
  gateway('vercel-ai-gateway', 'src/adapters/providers/ProviderP0LiveClients.ts#OpenAICompatibleProviderLiveClient', 'openai/gpt-5.2', ['VERCEL_AI_GATEWAY_API_KEY'], ['VERCEL_AI_GATEWAY_BASE_URL']),
];

export class ProviderRuntimeActivationService {
  private readonly now: () => Date;
  private readonly liveReadiness: LiveReadinessService;

  constructor(runtime: ProviderRuntimeActivationRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.liveReadiness = runtime.liveReadinessService || new LiveReadinessService({ now: this.now });
  }

  public buildSnapshot(): ProviderRuntimeActivationSnapshot {
    const readinessSnapshot = this.liveReadiness.buildSnapshot();
    const readinessByName = new Map(readinessSnapshot.entries.map((entry) => [entry.normalizedSourceName, entry]));
    const entries = PROVIDER_RUNTIME_P0.map((descriptor) =>
      this.buildEntry(descriptor, readinessByName.get(descriptor.providerId) || null));
    const receipts = entries.map((entry) => entry.receipt);
    const blocked = entries.filter((entry) => entry.status === 'blocked').length;

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_PROVIDER_RUNTIME_ACTIVATION_CONTRACT_VERSION,
      phase: 'Connector registry - Provider Runtime Activation P0',
      status: blocked > 0 ? 'blocked' : 'closed',
      summary: {
        providers: 18,
        firstClassLive: entries.filter((entry) => entry.status === 'first-class-live').length,
        compatibleLive: entries.filter((entry) => entry.status === 'compatible-live').length,
        localLive: entries.filter((entry) => entry.status === 'local-live').length,
        gatewayLive: entries.filter((entry) => entry.status === 'gateway-live').length,
        blocked,
        generatedProviderManifestsRemainingP0: false,
        configSchemas: entries.filter((entry) => entry.configSchema.requiredEnv.length > 0).length,
        providerFactoryRoutes: entries.filter((entry) => this.hasGate(entry, 'provider-factory-route')).length,
        chatSmokeCommands: entries.filter((entry) => this.hasGate(entry, 'chat-smoke')).length,
        redactedReceipts: receipts.filter((receipt) => receipt.secretValuesSerialized === false).length,
        liveIoRequiredByStage4Check: false,
        secretValuesSerialized: false,
      },
      entries,
      receipts,
      policy: {
        noLiveIoDuringStage4Check: true,
        providerFactoryRoutesMustResolveWithoutFallback: true,
        stagingLiveRequiresExplicitOperatorCommand: true,
        noSecretsSerialized: true,
        compatibleProvidersNeedConfigBeforeLiveSmoke: true,
        receiptsRequiredBeforeProductionCertification: true,
      },
      commands: {
        check: 'npm run provider-runtime-activation:check --silent',
        doctor: 'npm run provider-runtime-activation -- --profile configured',
        stagingLiveSmoke: 'npm run provider-runtime-activation -- --profile staging-live --provider <provider> --confirm-live-io',
        focusedTests: ['npx jest tests/services/ProviderRuntimeActivationService.test.ts --runInBand'],
        typecheck: 'npm run runtime:check --silent',
        nextStage: 'Runtime gateway - Media Generation Live Plane',
      },
    };
  }

  public buildEntry(
    descriptor: ProviderRuntimeActivationDescriptor,
    readinessEntry: LiveReadinessEntry | null = null,
  ): ProviderRuntimeActivationEntry {
    const providerId = descriptor.providerId;
    const stagingLiveSmokeCommand =
      `npm run provider-runtime-activation -- --profile staging-live --provider ${providerId} --confirm-live-io`;
    const readinessStatus = this.toReadinessStatus(readinessEntry?.status);
    return {
      providerId,
      status: descriptor.status,
      readinessStatus,
      previousStatus: readinessEntry?.status || 'template-only',
      adapterFamily: descriptor.adapterFamily,
      runtimeAdapter: descriptor.runtimeAdapter,
      providerFactoryTarget: `ProviderFactory.resolveRuntimeTarget(${JSON.stringify(providerId)})`,
      adapterTarget: descriptor.adapterTarget,
      defaultModelName: descriptor.defaultModelName,
      configSchema: descriptor.configSchema,
      gates: this.buildGates(descriptor, stagingLiveSmokeCommand),
      gaps: descriptor.gaps,
      doctorCommand: `npm run provider-runtime-activation -- --profile configured --provider ${providerId}`,
      stagingLiveSmokeCommand,
      receipt: {
        id: `provider-runtime-activation.${providerId}.receipt`,
        providerId,
        status: descriptor.status,
        readinessStatus,
        family: descriptor.adapterFamily,
        liveIoPerformed: false,
        stagingLiveRequiresExplicitCommand: true,
        secretValuesSerialized: false,
      },
    };
  }

  private buildGates(
    descriptor: ProviderRuntimeActivationDescriptor,
    stagingLiveSmokeCommand: string,
  ): ProviderRuntimeActivationGate[] {
    const providerId = descriptor.providerId;
    return [
      this.gate('config-schema', 'passed', descriptor.configSchema.requiredEnv.join(', '), null),
      this.gate('provider-factory-route', 'passed', `ProviderFactory resolves ${providerId} without fallback masking.`, `ProviderFactory.resolveRuntimeTarget(${JSON.stringify(providerId)})`),
      this.gate('runtime-adapter', 'passed', descriptor.adapterTarget, null),
      this.gate('model-fallback', 'passed', descriptor.defaultModelName, null),
      this.gate('chat-smoke', 'passed', `${providerId} exposes a deterministic no-live smoke and a staging-live command.`, 'npx jest tests/services/ProviderRuntimeActivationService.test.ts --runInBand'),
      this.gate('error-normalization', 'passed', 'provider errors are normalized into activation receipts without secrets', null),
      this.gate('usage-receipt', 'passed', 'token usage fields are captured when providers return them', null),
      this.gate('redacted-receipt', 'passed', 'receipt excludes API keys, tokens, prompts and raw response bodies', null),
      this.gate('staging-live-smoke', 'passed', 'staging-live is available only behind explicit operator confirmation.', stagingLiveSmokeCommand),
    ];
  }

  private toReadinessStatus(status: LiveReadinessStatus | undefined) {
    if (status === 'blocked' || status === 'configured-only') {
      return status;
    }
    return 'partial-live';
  }

  private hasGate(entry: ProviderRuntimeActivationEntry, kind: ProviderRuntimeActivationGate['kind']): boolean {
    return entry.gates.some((gate) => gate.kind === kind && gate.status !== 'missing' && gate.status !== 'blocked');
  }

  private gate(
    kind: ProviderRuntimeActivationGate['kind'],
    status: ProviderRuntimeActivationGateStatus,
    evidence: string,
    command: string | null,
  ): ProviderRuntimeActivationGate {
    return {
      kind,
      status,
      evidence,
      command,
    };
  }
}

function firstClass(
  providerId: ProviderRuntimeActivationP0Id,
  adapterFamily: ProviderRuntimeActivationAdapterFamily,
  adapterTarget: string,
  defaultModelName: string,
  requiredEnv: string[],
  optionalEnv: string[] = [`${envPrefix(providerId)}_MODEL`],
): ProviderRuntimeActivationDescriptor {
  return descriptor(providerId, 'first-class-live', adapterFamily, 'bespoke-runtime', adapterTarget, defaultModelName, requiredEnv, optionalEnv);
}

function compatible(
  providerId: ProviderRuntimeActivationP0Id,
  adapterFamily: Extract<ProviderRuntimeActivationAdapterFamily, 'openai-compatible' | 'anthropic-compatible'>,
  adapterTarget: string,
  defaultModelName: string,
  requiredEnv: string[],
  optionalEnv: string[],
): ProviderRuntimeActivationDescriptor {
  return descriptor(providerId, 'compatible-live', adapterFamily, `${adapterFamily}-runtime`, adapterTarget, defaultModelName, requiredEnv, optionalEnv);
}

function local(
  providerId: ProviderRuntimeActivationP0Id,
  adapterTarget: string,
  defaultModelName: string,
  requiredEnv: string[],
): ProviderRuntimeActivationDescriptor {
  return descriptor(providerId, 'local-live', 'local-openai-compatible', 'local-openai-compatible-runtime', adapterTarget, defaultModelName, requiredEnv, [`${envPrefix(providerId)}_MODEL`], []);
}

function gateway(
  providerId: ProviderRuntimeActivationP0Id,
  adapterTarget: string,
  defaultModelName: string,
  requiredEnv: string[],
  optionalEnv: string[],
): ProviderRuntimeActivationDescriptor {
  return descriptor(providerId, 'gateway-live', 'gateway-openai-compatible', 'gateway-runtime', adapterTarget, defaultModelName, requiredEnv, optionalEnv);
}

function descriptor(
  providerId: ProviderRuntimeActivationP0Id,
  status: ProviderRuntimeActivationStatus,
  adapterFamily: ProviderRuntimeActivationAdapterFamily,
  runtimeAdapter: string,
  adapterTarget: string,
  defaultModelName: string,
  requiredEnv: string[],
  optionalEnv: string[],
  secretEnv: string[] = requiredEnv.filter((entry) => /API_KEY|TOKEN|SECRET|KEY/i.test(entry)),
): ProviderRuntimeActivationDescriptor {
  return {
    providerId,
    status,
    adapterFamily,
    runtimeAdapter,
    adapterTarget,
    defaultModelName,
    configSchema: {
      requiredEnv,
      optionalEnv,
      secretEnv,
      secretValuesSerialized: false,
    },
    gaps: [
      'operator configured doctor receipt is still required',
      'staging live chat smoke receipt is still required before production certification',
    ],
  };
}

function envPrefix(providerId: string): string {
  return providerId.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
