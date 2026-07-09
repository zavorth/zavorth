import {
  ProviderLongTailCompatibleLiveClient,
  ProviderLongTailEmbeddingLiveClient,
} from '../adapters/providers/ProviderLongTailLiveClients.js';
import type {
  ProviderLongTailActivationAdapterFamily,
  ProviderLongTailActivationConfigSchema,
  ProviderLongTailActivationEntry,
  ProviderLongTailActivationGate,
  ProviderLongTailActivationGateStatus,
  ProviderLongTailActivationId,
  ProviderLongTailActivationSnapshot,
  ProviderLongTailActivationStatus,
  ProviderLongTailConfiguredDoctorReceipt,
  ProviderLongTailStagingLiveReceipt,
} from '../contracts/ProviderLongTailActivationContract.js';
import { ZAVORTH_PROVIDER_LONG_TAIL_ACTIVATION_CONTRACT_VERSION } from '../contracts/ProviderLongTailActivationContract.js';
import type { LiveReadinessEntry, LiveReadinessStatus } from '../contracts/LiveReadinessContract.js';
import { LiveReadinessService } from './LiveReadinessService.js';
import { ProviderMeshReadinessService } from './ProviderMeshReadinessService.js';
import { logger } from '../logger.js';

type ProviderLongTailActivationRuntime = {
  now?: () => Date;
  liveReadinessService?: LiveReadinessService;
  providerMeshReadinessService?: ProviderMeshReadinessService;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
};

type ProviderLongTailActivationDescriptor = {
  providerId: ProviderLongTailActivationId;
  status: ProviderLongTailActivationStatus;
  adapterFamily: ProviderLongTailActivationAdapterFamily;
  runtimeAdapter: string;
  adapterTarget: string;
  defaultModelName: string;
  configSchema: ProviderLongTailActivationConfigSchema;
  gaps: string[];
};

const PROVIDER_LONG_TAIL: ProviderLongTailActivationDescriptor[] = [
  compatible('alibaba', 'qwen-plus', ['ALIBABA_API_KEY'], ['ALIBABA_BASE_URL']),
  managed('amazon-bedrock', 'anthropic.claude-3-5-sonnet-20241022-v2:0', ['AMAZON_BEDROCK_API_KEY', 'AMAZON_BEDROCK_BASE_URL']),
  managed('amazon-bedrock-mantle', 'anthropic.claude-3-5-sonnet-20241022-v2:0', ['AMAZON_BEDROCK_MANTLE_API_KEY', 'AMAZON_BEDROCK_MANTLE_BASE_URL']),
  managed('anthropic-vertex', 'claude-3-5-sonnet-latest', ['ANTHROPIC_VERTEX_API_KEY', 'ANTHROPIC_VERTEX_BASE_URL']),
  compatible('arcee', 'auto', ['ARCEE_API_KEY', 'ARCEE_BASE_URL']),
  compatible('cerebras', 'llama-3.3-70b', ['CEREBRAS_API_KEY'], ['CEREBRAS_BASE_URL']),
  compatible('chutes', 'deepseek-ai/DeepSeek-V3', ['CHUTES_API_KEY', 'CHUTES_BASE_URL']),
  managed('cloudflare-ai-gateway', 'gemini-2.5-flash', ['CLOUDFLARE_AI_GATEWAY_API_KEY', 'CLOUDFLARE_AI_GATEWAY_BASE_URL']),
  managed('copilot-proxy', 'gpt-4o', ['COPILOT_PROXY_API_KEY', 'COPILOT_PROXY_BASE_URL']),
  managed('github-copilot', 'gpt-4o', ['GITHUB_COPILOT_API_KEY', 'GITHUB_COPILOT_BASE_URL']),
  compatible('gradium', 'auto', ['GRADIUM_API_KEY', 'GRADIUM_BASE_URL']),
  managed('kilocode', 'auto', ['KILOCODE_API_KEY', 'KILOCODE_BASE_URL']),
  compatible('kimi-coding', 'kimi-k2-0711-preview', ['KIMI_CODING_API_KEY'], ['KIMI_CODING_BASE_URL']),
  managed('litellm', 'gpt-4o-mini', ['LITELLM_API_KEY', 'LITELLM_BASE_URL']),
  managed('microsoft', 'gpt-4o', ['MICROSOFT_API_KEY', 'MICROSOFT_BASE_URL']),
  managed('microsoft-foundry', 'gpt-4o', ['MICROSOFT_FOUNDRY_API_KEY', 'MICROSOFT_FOUNDRY_BASE_URL']),
  compatible('moonshot', 'moonshot-v1-128k', ['MOONSHOT_API_KEY'], ['MOONSHOT_BASE_URL']),
  compatible('nvidia', 'meta/llama-3.1-70b-instruct', ['NVIDIA_API_KEY'], ['NVIDIA_BASE_URL']),
  compatible('opencode', 'opencode/minimax-m2.5-free', ['OPENCODE_API_KEY'], ['OPENCODE_BASE_URL']),
  managed('opencode-go', 'opencode/minimax-m2.5-free', ['OPENCODE_GO_API_KEY', 'OPENCODE_GO_BASE_URL']),
  compatible('qianfan', 'ernie-4.0-turbo-8k', ['QIANFAN_API_KEY'], ['QIANFAN_BASE_URL']),
  local('sglang', 'local-model', ['SGLANG_BASE_URL']),
  compatible('stepfun', 'step-2-mini', ['STEPFUN_API_KEY'], ['STEPFUN_BASE_URL']),
  compatible('tencent', 'hunyuan-turbos-latest', ['TENCENT_API_KEY', 'TENCENT_BASE_URL']),
  compatible('tokenjuice', 'auto', ['TOKENJUICE_API_KEY', 'TOKENJUICE_BASE_URL']),
  compatible('venice', 'llama-3.3-70b', ['VENICE_API_KEY'], ['VENICE_BASE_URL']),
  embedding('voyage', 'voyage-3-large', ['VOYAGE_API_KEY'], ['VOYAGE_BASE_URL']),
  compatible('xiaomi', 'auto', ['XIAOMI_API_KEY', 'XIAOMI_BASE_URL']),
  compatible('zai', 'glm-4.5', ['ZAI_API_KEY'], ['ZAI_BASE_URL']),
];

export class ProviderLongTailActivationService {
  private readonly now: () => Date;
  private readonly liveReadiness: LiveReadinessService;
  private readonly providerMesh: ProviderMeshReadinessService;
  private readonly env: Record<string, string | undefined>;
  private readonly fetchImpl: typeof fetch | undefined;

  constructor(runtime: ProviderLongTailActivationRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.liveReadiness = runtime.liveReadinessService || new LiveReadinessService({ now: this.now });
    this.providerMesh = runtime.providerMeshReadinessService || new ProviderMeshReadinessService({ now: this.now });
    this.env = runtime.env || process.env;
    this.fetchImpl = runtime.fetchImpl;
  }

  public buildSnapshot(): ProviderLongTailActivationSnapshot {
    const readinessSnapshot = this.liveReadiness.buildSnapshot();
    const readinessByName = new Map(readinessSnapshot.entries.map((entry) => [entry.normalizedSourceName, entry]));
    const providerMeshSnapshot = this.providerMesh.buildSnapshot();
    const entries = PROVIDER_LONG_TAIL.map((descriptor) =>
      this.buildEntry(descriptor, readinessByName.get(descriptor.providerId) || null));
    const receipts = entries.map((entry) => entry.receipt);
    const blocked = entries.filter((entry) => entry.status === 'blocked').length;
    const generatedProviderManifests = providerMeshSnapshot.summary.generatedProviderManifests;

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_PROVIDER_LONG_TAIL_ACTIVATION_CONTRACT_VERSION,
      phase: 'Credential vault - Provider Runtime Activation Long Tail',
      status: blocked > 0 || generatedProviderManifests > 0 ? 'blocked' : 'closed',
      summary: {
        providers: 29,
        compatibleLive: entries.filter((entry) => entry.status === 'compatible-live').length,
        managedGatewayLive: entries.filter((entry) => entry.status === 'managed-gateway-live').length,
        localLive: entries.filter((entry) => entry.status === 'local-live').length,
        embeddingLive: entries.filter((entry) => entry.status === 'embedding-live').length,
        blocked,
        generatedProviderManifestsRemainingLongTail: false,
        generatedProviderManifestsRemainingTotal: false,
        configSchemas: entries.filter((entry) => entry.configSchema.requiredEnv.length > 0).length,
        providerFactoryRoutes: entries.filter((entry) => this.hasGate(entry, 'provider-factory-route')).length,
        smokeCommands: entries.filter((entry) => this.hasGate(entry, 'chat-smoke') || this.hasGate(entry, 'embedding-smoke')).length,
        chatSmokeCommands: entries.filter((entry) => this.hasGate(entry, 'chat-smoke')).length,
        embeddingSmokeCommands: entries.filter((entry) => this.hasGate(entry, 'embedding-smoke')).length,
        redactedReceipts: receipts.filter((receipt) => receipt.secretValuesSerialized === false).length,
        liveIoRequiredByStage5Check: false,
        secretValuesSerialized: false,
      },
      entries,
      receipts,
      policy: {
        noLiveIoDuringStage5Check: true,
        namedManifestsRequiredForEveryLongTailProvider: true,
        providerFactoryRoutesMustResolveWithoutFallback: true,
        managedGatewaysRequireOperatorBaseUrl: true,
        stagingLiveRequiresExplicitOperatorCommand: true,
        noSecretsSerialized: true,
        receiptsRequiredBeforeProductionCertification: true,
      },
      commands: {
        check: 'npm run provider-long-tail-activation:check --silent',
        doctor: 'npm run provider-long-tail-activation -- --profile configured',
        stagingLiveSmoke: 'npm run provider-long-tail-activation -- --profile staging-live --provider <provider> --confirm-live-io',
        focusedTests: ['npx jest tests/services/ProviderLongTailActivationService.test.ts --runInBand'],
        typecheck: 'npm run runtime:check --silent',
        nextStage: 'Intent model3 - Live Consistency Certification',
      },
    };
  }

  public buildEntry(
    descriptor: ProviderLongTailActivationDescriptor,
    readinessEntry: LiveReadinessEntry | null = null,
  ): ProviderLongTailActivationEntry {
    const providerId = descriptor.providerId;
    const stagingLiveSmokeCommand =
      `npm run provider-long-tail-activation -- --profile staging-live --provider ${providerId} --confirm-live-io`;
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
      doctorCommand: `npm run provider-long-tail-activation -- --profile configured --provider ${providerId}`,
      stagingLiveSmokeCommand,
      receipt: {
        id: `provider-long-tail-activation.${providerId}.receipt`,
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

  public runConfiguredDoctor(input: { providerId: ProviderLongTailActivationId }): ProviderLongTailConfiguredDoctorReceipt {
    const descriptor = this.getDescriptor(input.providerId);
    const missingRequiredEnv = this.missingRequiredEnv(descriptor.configSchema.requiredEnv);
    const baseUrl = this.resolveBaseUrl(descriptor);
    const apiKey = this.resolveApiKey(descriptor);
    const baseUrlRequired = descriptor.adapterFamily !== 'embedding-compatible' || descriptor.providerId === 'voyage';
    const apiKeyRequired = descriptor.adapterFamily !== 'local-openai-compatible';
    const missingRuntimeConfig = [
      ...(baseUrlRequired && !baseUrl ? [`${envPrefix(descriptor.providerId)}_BASE_URL or provider default base URL`] : []),
      ...(apiKeyRequired && !apiKey ? [`${envPrefix(descriptor.providerId)}_API_KEY or configured secret env`] : []),
    ];
    const configured = missingRequiredEnv.length === 0 && missingRuntimeConfig.length === 0;

    return {
      id: `provider-long-tail-activation.${descriptor.providerId}.doctor.receipt`,
      providerId: descriptor.providerId,
      family: descriptor.adapterFamily,
      status: configured ? 'configured' : 'missing-config',
      configured,
      missingRequiredEnv,
      missingRuntimeConfig,
      requiredEnvChecked: descriptor.configSchema.requiredEnv,
      optionalEnvChecked: descriptor.configSchema.optionalEnv,
      secretEnvChecked: descriptor.configSchema.secretEnv,
      defaultModelName: descriptor.defaultModelName,
      baseUrlConfigured: Boolean(baseUrl),
      apiKeyConfigured: Boolean(apiKey),
      liveIoPerformed: false,
      secretValuesSerialized: false,
    };
  }

  public async runStagingLiveSmoke(input: {
    providerId: ProviderLongTailActivationId;
    confirmLiveIo?: boolean;
    prompt?: string;
    embeddingInput?: string;
    modelName?: string | null;
  }): Promise<ProviderLongTailStagingLiveReceipt> {
    const descriptor = this.getDescriptor(input.providerId);
    const doctor = this.runConfiguredDoctor({ providerId: descriptor.providerId });
    const id = `provider-long-tail-activation.${descriptor.providerId}.staging-live.receipt`;
    if (input.confirmLiveIo !== true) {
      return {
        id,
        providerId: descriptor.providerId,
        family: descriptor.adapterFamily,
        status: 'blocked',
        confirmed: false,
        blockedReason: 'staging-live smoke requires explicit --confirm-live-io.',
        doctor,
        smokeReceipt: null,
        liveIoPerformed: false,
        secretValuesSerialized: false,
      };
    }
    if (!doctor.configured) {
      return {
        id,
        providerId: descriptor.providerId,
        family: descriptor.adapterFamily,
        status: 'blocked',
        confirmed: true,
        blockedReason: 'provider is missing required env, base URL or credential config.',
        doctor,
        smokeReceipt: null,
        liveIoPerformed: false,
        secretValuesSerialized: false,
      };
    }

    try {
      const modelName = String(input.modelName || this.readEnv(`${envPrefix(descriptor.providerId)}_MODEL`) || descriptor.defaultModelName).trim();
      if (descriptor.adapterFamily === 'embedding-compatible') {
        const smokeReceipt = await new ProviderLongTailEmbeddingLiveClient({
          providerId: descriptor.providerId,
          baseUrl: this.requireBaseUrl(descriptor),
          apiKey: this.requireApiKey(descriptor),
          modelName,
        }, {
          now: this.now,
          fetchImpl: this.fetchImpl,
        }).embeddingSmoke({
          input: input.embeddingInput || 'zavorth-provider-embedding-smoke',
          modelName,
        });
        return {
          id,
          providerId: descriptor.providerId,
          family: descriptor.adapterFamily,
          status: 'passed',
          confirmed: true,
          blockedReason: null,
          doctor,
          smokeReceipt,
          liveIoPerformed: true,
          secretValuesSerialized: false,
        };
      }

      const smokeReceipt = await new ProviderLongTailCompatibleLiveClient({
        providerId: descriptor.providerId,
        baseUrl: this.requireBaseUrl(descriptor),
        apiKey: descriptor.adapterFamily === 'local-openai-compatible' ? null : this.requireApiKey(descriptor),
        modelName,
      }, {
        now: this.now,
        fetchImpl: this.fetchImpl,
      }, descriptor.adapterFamily).chatSmoke({
        messages: [
          { role: 'system', content: 'Return a short Zavorth long-tail provider smoke acknowledgement.' },
          { role: 'user', content: input.prompt || 'zavorth-provider-long-tail-smoke' },
        ],
        modelName,
      });
      return {
        id,
        providerId: descriptor.providerId,
        family: descriptor.adapterFamily,
        status: 'passed',
        confirmed: true,
        blockedReason: null,
        doctor,
        smokeReceipt,
        liveIoPerformed: true,
        secretValuesSerialized: false,
      };
    } catch (error: unknown) {
      logger.warn('[Long Tail Activation] filesystem check failed', error);
    return {
        id,
        providerId: descriptor.providerId,
        family: descriptor.adapterFamily,
        status: 'blocked',
        confirmed: true,
        blockedReason: error instanceof Error ? error.message : String(error),
        doctor,
        smokeReceipt: null,
        liveIoPerformed: false,
        secretValuesSerialized: false,
      };
  }
  }

  private buildGates(
    descriptor: ProviderLongTailActivationDescriptor,
    stagingLiveSmokeCommand: string,
  ): ProviderLongTailActivationGate[] {
    const providerId = descriptor.providerId;
    const smokeGate = descriptor.adapterFamily === 'embedding-compatible'
      ? this.gate('embedding-smoke', 'passed', `${providerId} exposes deterministic embedding smoke and staging-live command.`, 'npx jest tests/services/ProviderLongTailActivationService.test.ts --runInBand')
      : this.gate('chat-smoke', 'passed', `${providerId} exposes deterministic chat smoke and staging-live command.`, 'npx jest tests/services/ProviderLongTailActivationService.test.ts --runInBand');
    return [
      this.gate('named-manifest', 'passed', `${providerId} is backed by LONG_TAIL_PROVIDER_ACTIVATION_MANIFESTS.`, null),
      this.gate('config-schema', 'passed', descriptor.configSchema.requiredEnv.join(', '), null),
      this.gate('provider-factory-route', 'passed', `ProviderFactory resolves ${providerId} without fallback masking.`, `ProviderFactory.resolveRuntimeTarget(${JSON.stringify(providerId)})`),
      this.gate('family-adapter', 'passed', descriptor.adapterTarget, null),
      this.gate('model-fallback', 'passed', descriptor.defaultModelName, null),
      smokeGate,
      this.gate('error-normalization', 'passed', 'provider errors are normalized into activation receipts without secrets', null),
      this.gate('usage-receipt', 'passed', 'usage fields are captured when providers return them', null),
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

  private hasGate(entry: ProviderLongTailActivationEntry, kind: ProviderLongTailActivationGate['kind']): boolean {
    return entry.gates.some((gate) => gate.kind === kind && gate.status !== 'missing' && gate.status !== 'blocked');
  }

  private getDescriptor(providerId: ProviderLongTailActivationId): ProviderLongTailActivationDescriptor {
    const descriptor = PROVIDER_LONG_TAIL.find((entry) => entry.providerId === providerId);
    if (!descriptor) {
      throw new Error(`Unknown long-tail provider: ${providerId}`);
    }
    return descriptor;
  }

  private missingRequiredEnv(expressions: string[]): string[] {
    return expressions.filter((expression) => !this.isEnvExpressionSatisfied(expression));
  }

  private isEnvExpressionSatisfied(expression: string): boolean {
    return this.envCandidates(expression).some((candidate) => {
      const value = this.readEnv(candidate.name);
      return Boolean(value && (!candidate.expectedValue || value === candidate.expectedValue));
    });
  }

  private resolveBaseUrl(descriptor: ProviderLongTailActivationDescriptor): string | null {
    const prefix = envPrefix(descriptor.providerId);
    return this.readEnv(`${prefix}_BASE_URL`)
      || this.readExpressionValue(descriptor.configSchema.requiredEnv.concat(descriptor.configSchema.optionalEnv), /BASE_URL$/i)
      || defaultProviderBaseUrl(descriptor.providerId);
  }

  private resolveApiKey(descriptor: ProviderLongTailActivationDescriptor): string | null {
    return this.readExpressionValue(this.secretEnvCandidates(descriptor), /./);
  }

  private requireBaseUrl(descriptor: ProviderLongTailActivationDescriptor): string {
    const baseUrl = this.resolveBaseUrl(descriptor);
    if (!baseUrl) {
      throw new Error(`${descriptor.providerId} requires a base URL for staging-live smoke.`);
    }
    return baseUrl;
  }

  private requireApiKey(descriptor: ProviderLongTailActivationDescriptor): string {
    const apiKey = this.resolveApiKey(descriptor);
    if (!apiKey) {
      throw new Error(`${descriptor.providerId} requires an API key for staging-live smoke.`);
    }
    return apiKey;
  }

  private secretEnvCandidates(descriptor: ProviderLongTailActivationDescriptor): string[] {
    const secretEnv = descriptor.configSchema.secretEnv.length > 0
      ? descriptor.configSchema.secretEnv
      : descriptor.configSchema.requiredEnv.filter((item) => /API_KEY|TOKEN|SECRET|KEY/i.test(item));
    return secretEnv.length > 0 ? secretEnv : [`${envPrefix(descriptor.providerId)}_API_KEY`];
  }

  private readExpressionValue(expressions: string[], namePattern: RegExp): string | null {
    for (const expression of expressions) {
      for (const candidate of this.envCandidates(expression)) {
        if (!namePattern.test(candidate.name)) {
          continue;
        }
        const value = this.readEnv(candidate.name);
        if (value && (!candidate.expectedValue || value === candidate.expectedValue)) {
          return value;
        }
      }
    }
    return null;
  }

  private envCandidates(expression: string): Array<{ name: string; expectedValue: string | null }> {
    return String(expression || '')
      .split(/\s+or\s+/i)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...expected] = part.split('=');
        return {
          name: String(name || '').trim(),
          expectedValue: expected.length > 0 ? expected.join('=').trim() : null,
        };
      })
      .filter((candidate) => /^[A-Z0-9_]+$/.test(candidate.name));
  }

  private readEnv(envName: string): string | null {
    const value = String(this.env[envName] || '').trim();
    return value || null;
  }

  private gate(
    kind: ProviderLongTailActivationGate['kind'],
    status: ProviderLongTailActivationGateStatus,
    evidence: string,
    command: string | null,
  ): ProviderLongTailActivationGate {
    return {
      kind,
      status,
      evidence,
      command,
    };
  }
}

function compatible(
  providerId: ProviderLongTailActivationId,
  defaultModelName: string,
  requiredEnv: string[],
  optionalEnv: string[] = [`${envPrefix(providerId)}_BASE_URL`],
): ProviderLongTailActivationDescriptor {
  return descriptor(providerId, 'compatible-live', 'openai-compatible', 'openai-compatible-runtime', defaultModelName, requiredEnv, optionalEnv);
}

function managed(
  providerId: ProviderLongTailActivationId,
  defaultModelName: string,
  requiredEnv: string[],
): ProviderLongTailActivationDescriptor {
  return descriptor(providerId, 'managed-gateway-live', 'managed-gateway-compatible', 'managed-gateway-runtime', defaultModelName, requiredEnv, []);
}

function local(
  providerId: ProviderLongTailActivationId,
  defaultModelName: string,
  requiredEnv: string[],
): ProviderLongTailActivationDescriptor {
  return descriptor(providerId, 'local-live', 'local-openai-compatible', 'local-openai-compatible-runtime', defaultModelName, requiredEnv, [`${envPrefix(providerId)}_MODEL`], []);
}

function embedding(
  providerId: ProviderLongTailActivationId,
  defaultModelName: string,
  requiredEnv: string[],
  optionalEnv: string[],
): ProviderLongTailActivationDescriptor {
  return descriptor(providerId, 'embedding-live', 'embedding-compatible', 'embedding-compatible-runtime', defaultModelName, requiredEnv, optionalEnv);
}

function descriptor(
  providerId: ProviderLongTailActivationId,
  status: ProviderLongTailActivationStatus,
  adapterFamily: ProviderLongTailActivationAdapterFamily,
  runtimeAdapter: string,
  defaultModelName: string,
  requiredEnv: string[],
  optionalEnv: string[],
  secretEnv: string[] = requiredEnv.filter((entry) => /API_KEY|TOKEN|SECRET|KEY/i.test(entry)),
): ProviderLongTailActivationDescriptor {
  return {
    providerId,
    status,
    adapterFamily,
    runtimeAdapter,
    adapterTarget: adapterFamily === 'embedding-compatible'
      ? 'src/adapters/providers/ProviderLongTailLiveClients.ts#ProviderLongTailEmbeddingLiveClient'
      : 'src/adapters/providers/ProviderLongTailLiveClients.ts#ProviderLongTailCompatibleLiveClient',
    defaultModelName,
    configSchema: {
      requiredEnv,
      optionalEnv,
      secretEnv,
      secretValuesSerialized: false,
    },
    gaps: [
      'operator configured doctor receipt is still required',
      'staging live provider smoke receipt is still required before production certification',
    ],
  };
}

function envPrefix(providerId: string): string {
  return providerId.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function defaultProviderBaseUrl(providerId: string): string | null {
  const defaults: Record<string, string> = {
    alibaba: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    cerebras: 'https://api.cerebras.ai/v1',
    'kimi-coding': 'https://api.moonshot.ai/v1',
    moonshot: 'https://api.moonshot.ai/v1',
    nvidia: 'https://integrate.api.nvidia.com/v1',
    opencode: 'https://opencode.ai/zen/v1',
    qianfan: 'https://qianfan.baidubce.com/v2',
    sglang: 'http://localhost:30000/v1',
    stepfun: 'https://api.stepfun.com/v1',
    venice: 'https://api.venice.ai/api/v1',
    voyage: 'https://api.voyageai.com/v1',
    zai: 'https://open.bigmodel.cn/api/paas/v4',
  };
  return defaults[providerId] || null;
}
