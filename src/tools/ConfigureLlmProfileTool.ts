import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { EnvFileService } from '../services/EnvFileService.js';
import { config } from '../config/index.js';
import { ProviderFactory } from '../providers/ProviderFactory.js';
import path from 'path';
import { logger } from '../logger.js';

type ConfigureLlmProfileToolRuntime = {
  envFilePath?: string;
  envFileService?: EnvFileService;
  clearProviderCache?: () => void;
};

/** Mutable access to config properties that the set handler mutates at runtime. */
interface MutableConfigProxy {
  llmProvider: string;
  geminiDefaultModel: string;
  [key: string]: string;
}

export class ConfigureLlmProfileTool extends BaseTool {
  public readonly name = 'configure_llm_profile';
  public readonly description =
    'Lista e altera o provider/modelo conversacional padrao do Zavorth de forma persistente no .env.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'set'],
        description: 'Action to perform. list shows options; set configures a provider/model.',
      },
      providerName: {
        type: 'string',
        description: 'Provider name. Examples: opencode, gemini, openai, qwen, minimax, openrouter, aigateway.',
      },
      modelName: {
        type: 'string',
        description: 'Specific model name. Required for action=set.',
      },
      allowUnavailable: {
        type: 'boolean',
        description: 'When true, allows saving a provider before credentials are ready. Use only when the user confirms.',
      },
    },
    required: ['action'],
  };

  constructor(private readonly runtime: ConfigureLlmProfileToolRuntime = {}) {
    super();
  }

  public override getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: `${this.description}
Use "list" to discover available providers and models when the user does not specify one.
Use "set" to save the change.`,
      parameters: this.parameters,
    };
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '').toLowerCase();

    if (action === 'list') {
      return JSON.stringify(this.handleList(), null, 2);
    }

    if (action === 'set') {
      const providerName = String(args.providerName || '').toLowerCase().trim();
      const modelName = String(args.modelName || '').trim();
      const allowUnavailable = args.allowUnavailable === true;

      if (!providerName || !modelName) {
        throw new Error('For action "set", "providerName" and "modelName" are required.');
      }

      return JSON.stringify(this.handleSet(providerName, modelName, allowUnavailable), null, 2);
    }

    throw new Error('Acao is invalid. Use "list" ou "set".');
  }

  private handleList(): Record<string, unknown> {
    const isAvailable = (key: string) => Boolean(key && key.trim().length > 0);

    return {
      status: 'success',
      active_config: {
        currentProvider: config.llmProvider,
        openCodeModel: config.openCodeModel,
        geminiModel: config.geminiModel,
        openaiModel: config.openaiModel,
        deepseekModel: config.deepseekModel,
        openRouterModel: config.openRouterModel,
        qwenModel: config.qwenModel,
      },
      available_providers: {
        opencode: {
          enabled: isAvailable(config.openCodeApiKey),
          suggested_models: ['llama-3-8b', 'llama-3-70b', 'mixtral-8x7b', 'opencode/minimax-m2.5-free', 'qwen-72b'],
          note: 'Aceita qualquer ID de modelo compativel na API.'
        },
        gemini: {
          enabled: isAvailable(config.geminiApiKey),
          suggested_models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-pro']
        },
        openai: {
          enabled: isAvailable(config.openaiApiKey),
          suggested_models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini']
        },
        deepseek: {
          enabled: isAvailable(config.deepseekApiKey),
          suggested_models: ['deepseek-chat', 'deepseek-reasoner']
        },
        openrouter: {
          enabled: isAvailable(config.openRouterApiKey),
          suggested_models: ['anthropic/claude-3.5-sonnet:beta', 'google/gemini-pro-1.5'],
          note: 'Aceita qualquer ID de modelo suportado no OpenRouter.'
        },
        qwen: {
          enabled: isAvailable(config.puterAuthToken),
          suggested_models: ['qwen-max', 'qwen-plus', 'openrouter:qwen/qwen3.5-plus-02-15']
        },
        minimax: {
          enabled: isAvailable(config.minimaxApiKey),
          suggested_models: ['MiniMax-M2.7']
        },
        aigateway: {
          enabled: isAvailable(config.AIGatewayBaseUrl),
          suggested_models: [config.AIGatewayModel || 'gpt-4o'],
          note: 'Local/hybrid OpenAI-compatible route.'
        }
      },
      instructions_for_agent: 'Present providers and models in a friendly way if the user asked to see options. Remember that OpenCode, OpenRouter, and OpenAI accept other strings when the user asks.'
    };
  }

  private handleSet(providerName: string, modelName: string, allowUnavailable: boolean): Record<string, unknown> {
    const envService = this.runtime.envFileService || new EnvFileService();
    const projectRoot = path.resolve(__dirname, '../..');
    const envFilePath = this.runtime.envFilePath || path.join(projectRoot, '.env');
    const normalizedProvider = this.normalizeProvider(providerName);
    const providerDefinition = this.resolveProviderDefinition(normalizedProvider);
    if (!providerDefinition) {
      throw new Error(
        `Provider "${providerName}" is not recognized. Use configure_llm_profile list to see the options.`,
      );
    }

    if (!allowUnavailable && !providerDefinition.enabled) {
      throw new Error(
        this.buildShortNotice(providerDefinition.provider, 'blocked', providerDefinition.requirement),
      );
    }

    const envUpdates = [
      { key: 'LLM_PROVIDER', value: providerDefinition.provider, overwrite: true },
    ];

    envUpdates.push({ key: providerDefinition.modelEnvKey, value: modelName, overwrite: true });

    envService.upsertEntries(envFilePath, envUpdates);

    (this.runtime.clearProviderCache || (() => ProviderFactory.clearCache()))();
    const mutableConfig = config as unknown as MutableConfigProxy;
    mutableConfig.llmProvider = providerDefinition.provider;
    mutableConfig[providerDefinition.configModelKey] = modelName;
    if (providerDefinition.configModelKey === 'geminiModel') {
      mutableConfig.geminiDefaultModel = modelName;
    }

    return {
      status: 'success',
      provider: providerDefinition.provider,
      model: modelName,
      envFilePath,
      provider_ready: providerDefinition.enabled,
      provider_notice: this.buildShortNotice(
        providerDefinition.provider,
        providerDefinition.enabled ? 'ready' : 'prepared',
        providerDefinition.requirement,
      ),
      message: `Configuration permanently updated. Default provider: ${providerDefinition.provider}, model: ${modelName}.`
    };
  }

  private normalizeProvider(providerName: string): string {
    const normalized = ProviderFactory.normalizeProviderName(providerName);
    if (normalized === 'puter') {
      return 'qwen';
    }
    return normalized;
  }

  private resolveProviderDefinition(provider: string): {
    provider: string;
    modelEnvKey: string;
    configModelKey: string;
    enabled: boolean;
    requirement: string;
  } | null {
    switch (provider) {
      case 'opencode':
        return {
          provider,
          modelEnvKey: 'OPENCODE_MODEL',
          configModelKey: 'openCodeModel',
          enabled: Boolean(config.openCodeApiKey),
          requirement: 'OPENCODE_API_KEY',
        };
      case 'gemini':
        return {
          provider,
          modelEnvKey: 'GEMINI_MODEL',
          configModelKey: 'geminiModel',
          enabled: Boolean(config.geminiApiKey || config.geminiApiKeys.length > 0),
          requirement: 'GEMINI_API_KEY',
        };
      case 'openai':
        return {
          provider,
          modelEnvKey: 'OPENAI_MODEL',
          configModelKey: 'openaiModel',
          enabled: Boolean(config.openaiApiKey),
          requirement: 'OPENAI_API_KEY',
        };
      case 'deepseek':
        return {
          provider,
          modelEnvKey: 'DEEPSEEK_MODEL',
          configModelKey: 'deepseekModel',
          enabled: Boolean(config.deepseekApiKey),
          requirement: 'DEEPSEEK_API_KEY',
        };
      case 'openrouter':
        return {
          provider,
          modelEnvKey: 'OPENROUTER_MODEL',
          configModelKey: 'openRouterModel',
          enabled: Boolean(config.openRouterApiKey),
          requirement: 'OPENROUTER_API_KEY',
        };
      case 'qwen':
        return {
          provider,
          modelEnvKey: 'QWEN_MODEL',
          configModelKey: 'qwenModel',
          enabled: Boolean(config.puterAuthToken),
          requirement: 'PUTER_AUTH_TOKEN',
        };
      case 'minimax':
        return {
          provider,
          modelEnvKey: 'MINIMAX_MODEL',
          configModelKey: 'minimaxModel',
          enabled: Boolean(config.minimaxApiKey),
          requirement: 'MINIMAX_API_KEY',
        };
      case 'aigateway':
        return {
          provider,
          modelEnvKey: 'AIGateway_MODEL',
          configModelKey: 'AIGatewayModel',
          enabled: Boolean(config.AIGatewayBaseUrl),
          requirement: 'AIGateway_BASE_URL',
        };
      default:
        return this.resolveProviderFactoryDefinition(provider);
    }
  }

  private resolveProviderFactoryDefinition(provider: string): {
    provider: string;
    modelEnvKey: string;
    configModelKey: string;
    enabled: boolean;
    requirement: string;
  } | null {
    try {
      const target = ProviderFactory.resolveRuntimeTarget(provider);
      if (!target.runtimeSupported || target.providerName === 'gemini') {
        return null;
      }
      const normalizedProvider = target.providerName;
      const prefix = normalizedProvider.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      const needsBaseUrl = (
        target.adapterKind === 'openai_compatible'
        || target.adapterKind === 'anthropic_compatible'
        || target.adapterKind === 'gateway'
        || target.adapterKind === 'local_openai_compatible'
      );
      const needsApiKey = (
        target.adapterKind === 'openai_compatible'
        || target.adapterKind === 'anthropic_compatible'
        || target.adapterKind === 'gateway'
      );
      const missing: string[] = [];
      if (needsApiKey && !target.apiKey) missing.push(`${prefix}_API_KEY`);
      if (needsBaseUrl && !target.baseUrl) missing.push(`${prefix}_BASE_URL`);
      return {
        provider: normalizedProvider,
        modelEnvKey: `${prefix}_MODEL`,
        configModelKey: `${prefix.toLowerCase().replace(/_([a-z0-9])/g, (_, char) => String(char).toUpperCase())}Model`,
        enabled: missing.length === 0,
        requirement: missing.join(' + ') || 'ok',
      };
    } catch (error: unknown) {logger.warn('[ure Llm Profile] module import failed', error); return null; }
  }

  private buildShortNotice(provider: string, status: 'ready' | 'prepared' | 'blocked', requirement: string): string {
    if (status === 'ready') {
      return `${provider}: connected.`;
    }
    if (status === 'prepared') {
      return `${provider}: saved, but still missing ${requirement}.`;
    }
    return `${provider}: not connected; missing ${requirement}.`;
  }
}
