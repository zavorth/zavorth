import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { EnvFileService } from '../services/EnvFileService.js';
import { config } from '../config/index.js';
import { ProviderFactory } from '../providers/ProviderFactory.js';
import path from 'path';

type ConfigureLlmProfileToolRuntime = {
  envFilePath?: string;
  envFileService?: EnvFileService;
  clearProviderCache?: () => void;
};

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
        description: 'A acao a ser realizada. list lista opcoes; set configura um provider/modelo.',
      },
      providerName: {
        type: 'string',
        description: 'Nome do provider. Ex: opencode, gemini, openai, qwen, minimax, openrouter, aigateway.',
      },
      modelName: {
        type: 'string',
        description: 'Nome do modelo especifico. Obrigatorio para action=set.',
      },
      allowUnavailable: {
        type: 'boolean',
        description: 'Se true, permite gravar provider sem credencial pronta. Use apenas quando o usuario confirmar.',
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
Use "list" para descobrir provedores e modelos disponiveis se o usuario nao especificar.
Use "set" para gravar a mudanca.`,
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
        throw new Error('Para a acao "set", "providerName" e "modelName" sao obrigatorios.');
      }

      return JSON.stringify(this.handleSet(providerName, modelName, allowUnavailable), null, 2);
    }

    throw new Error('Acao invalida. Use "list" ou "set".');
  }

  private handleList(): Record<string, any> {
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
          note: 'Rota local/hibrida OpenAI-compatible.'
        }
      },
      instructions_for_agent: 'Apresente os provedores e modelos de forma amigavel ao usuario se ele pediu para ver as opcoes. Lembre-se que OpenCode, OpenRouter e OpenAI aceitam outras strings se o usuario pedir.'
    };
  }

  private handleSet(providerName: string, modelName: string, allowUnavailable: boolean): Record<string, any> {
    const envService = this.runtime.envFileService || new EnvFileService();
    const projectRoot = path.resolve(__dirname, '../..');
    const envFilePath = this.runtime.envFilePath || path.join(projectRoot, '.env');
    const normalizedProvider = this.normalizeProvider(providerName);
    const providerDefinition = this.resolveProviderDefinition(normalizedProvider);
    if (!providerDefinition) {
      throw new Error(
        `Provider "${providerName}" nao reconhecido. Use configure_llm_profile list para ver as opcoes.`,
      );
    }

    if (!allowUnavailable && !providerDefinition.enabled) {
      throw new Error(
        `Provider "${providerDefinition.provider}" nao esta pronto: falta credencial/configuracao (${providerDefinition.requirement}). ` +
        'Se quiser apenas preparar o .env mesmo assim, confirme explicitamente com allowUnavailable=true.',
      );
    }

    const envUpdates = [
      { key: 'LLM_PROVIDER', value: providerDefinition.provider, overwrite: true },
    ];

    envUpdates.push({ key: providerDefinition.modelEnvKey, value: modelName, overwrite: true });

    envService.upsertEntries(envFilePath, envUpdates);

    (this.runtime.clearProviderCache || (() => ProviderFactory.clearCache()))();
    (config as any).llmProvider = providerDefinition.provider;
    (config as any)[providerDefinition.configModelKey] = modelName;
    if (providerDefinition.configModelKey === 'geminiModel') {
      (config as any).geminiDefaultModel = modelName;
    }

    return {
      status: 'success',
      provider: providerDefinition.provider,
      model: modelName,
      envFilePath,
      message: `Configuracao alterada permanentemente. Provedor padrao: ${providerDefinition.provider}, modelo: ${modelName}.`
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
        return null;
    }
  }
}
