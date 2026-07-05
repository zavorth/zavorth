import fs from 'fs';
import { config } from '../config/index.js';
import { ProviderFactory } from '../providers/ProviderFactory.js';
import { resolveWorkspaceLlmStrategy } from './WorkspaceLlmProfile.js';
import type { WorkspaceTaskKind, WorkspaceTaskSubtype } from './WorkspaceTaskKind.js';
import type { AIGatewayProxyStatus } from './AIGatewayProxyService.js';
import type {
  ModelCapabilityKind,
  ModelPickerContract,
  SelectedModelProfile,
} from '../contracts/ModelPickerContract.js';
import {
  AccessRouteResolutionService,
  type AccessRouteHealthInput,
  type AccessRouteResolutionResult,
} from './providers/catalog/AccessRouteResolutionService.js';
import {
  buildProviderCatalogContract,
  toSelectedModelProfile,
} from './providers/catalog/ProviderCatalogCompat.js';
import {
  ModelSelectionService,
  type ModelSelectionServiceResult,
} from './providers/catalog/ModelSelectionService.js';
import { ZavorthProviderLiveProofStoreService } from './ZavorthProviderLiveProofStoreService.js';
import { logger } from '../logger.js';

export type ProviderCatalogMode = 'cloud' | 'local' | 'hybrid' | 'alias';
export type ProviderCatalogVisibility = 'public' | 'advanced';
export type ProviderCatalogReadiness = 'ready' | 'needs_config' | 'needs_probe';
export type ProviderProfileId = 'balanced' | 'coding' | 'research' | 'budget' | 'local-first';

export type ProviderCatalogEntry = {
  id: string;
  kind: 'provider' | 'alias';
  label: string;
  effectiveProviderName: string;
  aliases: string[];
  visibility: ProviderCatalogVisibility;
  mode: ProviderCatalogMode;
  summary: string;
  currentModel: string | null;
  requirements: string[];
  readiness: ProviderCatalogReadiness;
  ready: boolean;
  issue: string | null;
};

export type ProviderProfile = {
  id: ProviderProfileId;
  label: string;
  summary: string;
  preferredOrder: string[];
};

export type ProviderControlPlaneSelection = {
  selectionKind: 'provider' | 'model';
  requestedTarget: string;
  replyLabel: string;
  effectiveProviderName: string;
  modelName?: string;
};

export type ProviderProfileRecommendation = {
  profile: ProviderProfile;
  strategy: {
    providerName: string;
    modelName?: string;
    fallbackOrder: string[];
  };
  selectedModelProfile?: SelectedModelProfile | null;
  selectionExplanation?: string[];
  fallbackProfiles?: SelectedModelProfile[];
};

export type ProviderControlPlaneModelSelectionInput = {
  includeAdvanced?: boolean;
  selectedTarget?: string | null;
  selectedFamilyId?: string | null;
  selectedRouteId?: string | null;
  selectedModelId?: string | null;
  profileId?: string | null;
  requestedCapability?: ModelCapabilityKind | null;
  requireReady?: boolean;
  fallbackOrder?: string[];
};

export type ProviderProfileSelection = {
  profile: ProviderProfile;
  target: ProviderCatalogEntry;
  selection: ProviderControlPlaneSelection;
  skippedCandidates: Array<{
    id: string;
    readiness: ProviderCatalogReadiness;
    issue: string | null;
  }>;
};

type ProviderControlPlaneRuntime = {
  clearProviderCache?: () => void;
  accessRouteResolutionService?: Pick<AccessRouteResolutionService, 'resolveRoutes'> | null;
};

const DEFAULT_AIGateway_GATEWAY_BASE_URL = 'http://127.0.0.1:21128/v1';

function normalizeProviderId(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

const PROVIDER_PROFILES: ProviderProfile[] = [
  {
    id: 'balanced',
    label: 'Balanced',
    summary: 'Prioriza estabilidade geral e custo moderado para conversa cotidiana.',
    preferredOrder: ['gemini', 'openai', 'openrouter', 'deepseek'],
  },
  {
    id: 'coding',
    label: 'Coding',
    summary: 'Prioriza raciocinio de codigo, revisao e testes com fallback progressivo.',
    preferredOrder: ['AIGateway', 'openai', 'openrouter', 'gemini'],
  },
  {
    id: 'research',
    label: 'Research',
    summary: 'Prioriza comparacao, busca e sintese com boa cobertura de web e contexto longo.',
    preferredOrder: ['openrouter', 'openai', 'gemini', 'AIGateway'],
  },
  {
    id: 'budget',
    label: 'Budget',
    summary: 'Prioriza custo baixo e disponibilidade ampla para volume alto.',
    preferredOrder: ['gemini', 'gemma', 'qwen', 'deepseek'],
  },
  {
    id: 'local-first',
    label: 'Local-first',
    summary: 'Prioriza rotas locais ou hibridas antes de provedores cloud.',
    preferredOrder: ['AIGateway', 'gemini', 'openai'],
  },
];

export class ProviderControlPlaneService {
  private readonly clearProviderCache: () => void;
  private readonly accessRouteResolutionService: Pick<AccessRouteResolutionService, 'resolveRoutes'>;

  constructor(runtime: ProviderControlPlaneRuntime = {}) {
    this.clearProviderCache = runtime.clearProviderCache || (() => ProviderFactory.clearCache());
    this.accessRouteResolutionService = runtime.accessRouteResolutionService || new AccessRouteResolutionService();
  }

  public listProviders(options: { includeAdvanced?: boolean } = {}): ProviderCatalogEntry[] {
    const entries = this.buildProviderEntries();
    if (options.includeAdvanced) {
      return entries;
    }
    return entries.filter((entry) => entry.visibility === 'public');
  }

  public listProfiles(): ProviderProfile[] {
    return PROVIDER_PROFILES.map((entry) => ({
      ...entry,
      preferredOrder: [...entry.preferredOrder],
    }));
  }

  public resolveAccessRoutes(options: { includeAdvanced?: boolean; generatedAt?: string } = {}): AccessRouteResolutionResult {
    return this.accessRouteResolutionService.resolveRoutes({
      generatedAt: options.generatedAt,
      includeAdvanced: options.includeAdvanced === true,
      credentials: this.buildCredentialReadiness(),
      baseUrls: this.buildBaseUrlReadiness(),
      health: this.buildRouteHealth(),
      currentModels: this.buildCurrentModelMap(),
      requireProbeForRouteIds: ['AIGateway'],
    });
  }

  public buildModelPickerContract(options: {
    includeAdvanced?: boolean;
    selectedTarget?: string | null;
    profileId?: string | null;
    generatedAt?: string;
  } = {}): ModelPickerContract {
    const generatedAt = options.generatedAt || new Date().toISOString();
    const providers = this.listProviders({ includeAdvanced: options.includeAdvanced === true });
    const allProviders = this.listProviders({ includeAdvanced: true });
    const profiles = this.listProfiles();
    const selected = this.resolveBaseSelectedModelProfile({
      selectedTarget: options.selectedTarget,
      profileId: options.profileId,
      providers: allProviders,
      profiles,
    });

    return buildProviderCatalogContract({
      generatedAt,
      providers,
      profiles,
      selected,
      routes: {
        schemaVersion: 1,
        generatedAt,
        routes: this.resolveAccessRoutes({
          includeAdvanced: options.includeAdvanced === true,
          generatedAt,
        }).routes,
      },
    });
  }

  public resolveSelectedModelProfile(
    input: ProviderControlPlaneModelSelectionInput = {},
  ): ModelSelectionServiceResult {
    const configured = this.readConfiguredModelSelection();
    const selectedFamilyId = input.selectedFamilyId ?? configured.selectedFamilyId;
    const selectedRouteId = input.selectedRouteId ?? configured.selectedRouteId;
    const selectedModelId = input.selectedModelId ?? configured.selectedModelId;
    const contract = this.buildModelPickerContract({
      includeAdvanced: input.includeAdvanced === true,
      selectedTarget: input.selectedTarget,
      profileId: input.profileId,
    });

    return new ModelSelectionService().resolve({
      contract,
      selectedFamilyId,
      selectedRouteId,
      selectedModelId,
      selectedTarget: input.selectedTarget,
      requestedCapability: input.requestedCapability,
      requireReady: input.requireReady,
      fallbackOrder: input.fallbackOrder,
    });
  }

  public getProfile(profileId: string): ProviderProfile | null {
    const normalized = String(profileId || '').trim().toLowerCase();
    return this.listProfiles().find((entry) => entry.id === normalized) || null;
  }

  public getCurrentConversationalProvider(): string {
    return String(config.llmProvider || 'gemini').trim().toLowerCase() || 'gemini';
  }

  public getCurrentConversationalModel(): string {
    return this.getCurrentModelForProvider(this.getCurrentConversationalProvider()) || 'gemini-2.5-flash';
  }

  public getCurrentModelForProvider(providerName: string): string | null {
    switch (String(providerName || '').trim().toLowerCase()) {
      case 'gemini':
        return String(config.geminiModel || config.geminiDefaultModel || '').trim() || null;
      case 'deepseek':
        return String(config.deepseekModel || '').trim() || null;
      case 'openai':
        return String(config.openaiModel || '').trim() || null;
      case 'minimax':
        return String(config.minimaxModel || '').trim() || null;
      case 'aigateway':
        return String(config.AIGatewayModel || '').trim() || null;
      case 'openrouter':
        return String(config.openRouterModel || '').trim() || null;
      case 'opencode':
        return String(config.openCodeModel || '').trim() || null;
      case 'qwen':
      case 'puter':
        return String(config.qwenModel || '').trim() || null;
      default:
        return null;
    }
  }

  public resolveSelection(rawTarget: string): ProviderControlPlaneSelection | null {
    const normalized = String(rawTarget || '').trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    if (normalized === 'gemma') {
      return {
        selectionKind: 'model',
        requestedTarget: normalized,
        replyLabel: 'Gemma 2',
        effectiveProviderName: 'gemini',
        modelName: config.gemmaModel || 'gemma-2-27b-it',
      };
    }

    if (this.isDirectGeminiModel(normalized)) {
      return {
        selectionKind: 'model',
        requestedTarget: normalized,
        replyLabel: normalized.startsWith('gemma-') ? 'Gemma via Gemini API' : 'Gemini',
        effectiveProviderName: 'gemini',
        modelName: normalized,
      };
    }

    const providerEntry = this.findSelectableProvider(normalized);
    if (!providerEntry) {
      return null;
    }

    return {
      selectionKind: 'provider',
      requestedTarget: normalized,
      replyLabel: providerEntry.label,
      effectiveProviderName: providerEntry.effectiveProviderName,
    };
  }

  public applySelection(selection: ProviderControlPlaneSelection): void {
    this.clearProviderCache();
    config.llmProvider = selection.effectiveProviderName;
    if (selection.effectiveProviderName === 'gemini') {
      if (selection.selectionKind === 'model' && selection.modelName) {
        config.geminiModel = selection.modelName;
      } else {
        config.geminiModel = config.geminiDefaultModel || config.geminiModel;
      }
    }
  }

  public resolveProfileSelection(profileId: string): ProviderProfileSelection | null {
    const profile = this.getProfile(profileId);
    if (!profile) {
      return null;
    }

    const providers = this.listProviders({ includeAdvanced: true });
    const skippedCandidates: ProviderProfileSelection['skippedCandidates'] = [];

    for (const preferredTarget of profile.preferredOrder) {
      const provider = providers.find((entry) => {
        return entry.id === preferredTarget
          || entry.aliases.includes(preferredTarget)
          || entry.effectiveProviderName === preferredTarget;
      });

      if (!provider) {
        continue;
      }

      if (provider.readiness !== 'ready') {
        skippedCandidates.push({
          id: provider.id,
          readiness: provider.readiness,
          issue: provider.issue,
        });
        continue;
      }

      const selection = this.resolveSelection(provider.id) || this.resolveSelection(preferredTarget);
      if (!selection) {
        continue;
      }

      return {
        profile,
        target: provider,
        selection,
        skippedCandidates,
      };
    }

    return null;
  }

  public applyProfileSelection(profileId: string): ProviderProfileSelection {
    const profile = this.getProfile(profileId);
    if (!profile) {
      throw new Error(`Nao reconheci esse perfil de provider: ${profileId}`);
    }

    const resolved = this.resolveProfileSelection(profile.id);
    if (!resolved) {
      const blockers = profile.preferredOrder
        .map((targetId) => {
          const provider = this.listProviders({ includeAdvanced: true }).find((entry) => {
            return entry.id === targetId
              || entry.aliases.includes(targetId)
              || entry.effectiveProviderName === targetId;
          });
          if (!provider) {
            return null;
          }
          return provider.issue ? `${provider.label}: ${provider.issue}` : provider.label;
        })
        .filter(Boolean)
        .slice(0, 3);

      throw new Error(
        blockers.length > 0
          ? `Nenhum provider pronto atende o perfil ${profile.label}. ${blockers.join(' | ')}`
          : `Nenhum provider pronto atende o perfil ${profile.label} agora.`,
      );
    }

    this.applySelection(resolved.selection);
    return resolved;
  }

  public getUsageTargets(): string[] {
    return ['gemini', 'gemma', 'gemma-2-27b-it', 'deepseek', 'openai', 'minimax', 'qwen', 'puter', 'openrouter', 'AIGateway'];
  }

  public recommendProfileForTask(
    taskKind: WorkspaceTaskKind,
    taskSubtype: WorkspaceTaskSubtype,
    options: {
      workspaceMemory?: Record<string, any> | null | undefined;
    } = {},
  ): ProviderProfileRecommendation {
    const strategy = resolveWorkspaceLlmStrategy(taskKind, taskSubtype, {
      configuredProviderName: this.getCurrentConversationalProvider(),
      isProviderUsable: (name) => this.isProviderReady(name),
      workspaceMemory: options.workspaceMemory,
    });
    const profiles = this.listProfiles();
    const preferredProfileOrder = this.getPreferredProfileOrder(taskKind, taskSubtype);
    const selectedProfile = profiles
      .slice()
      .sort((left, right) => {
        const leftPreferredIndex = preferredProfileOrder.indexOf(left.id);
        const rightPreferredIndex = preferredProfileOrder.indexOf(right.id);
        if (leftPreferredIndex !== rightPreferredIndex) {
          if (leftPreferredIndex === -1) return 1;
          if (rightPreferredIndex === -1) return -1;
          return leftPreferredIndex - rightPreferredIndex;
        }
        const leftIndex = this.getProfileProviderRank(left, strategy.providerName);
        const rightIndex = this.getProfileProviderRank(right, strategy.providerName);
        return leftIndex - rightIndex;
      })[0] || profiles[0];
    const selectedModelSelection = this.resolveSelectedModelProfile({
      includeAdvanced: true,
      selectedTarget: strategy.providerName,
      selectedModelId: strategy.modelName,
      requestedCapability: this.resolveTaskCapability(taskKind, taskSubtype),
      requireReady: false,
      fallbackOrder: strategy.fallbackOrder,
    });

    return {
      profile: selectedProfile,
      strategy: {
        providerName: strategy.providerName,
        modelName: strategy.modelName,
        fallbackOrder: strategy.fallbackOrder,
      },
      selectedModelProfile: selectedModelSelection.primary,
      selectionExplanation: selectedModelSelection.explanation,
      fallbackProfiles: selectedModelSelection.fallbacks,
    };
  }

  public isProviderReady(name: string): boolean {
    const normalized = normalizeProviderId(name);
    return this.listProviders({ includeAdvanced: true }).some((entry) => {
      return normalizeProviderId(entry.id) === normalized
        || normalizeProviderId(entry.effectiveProviderName) === normalized
        || entry.aliases.map(normalizeProviderId).includes(normalized)
        ? entry.readiness === 'ready'
        : false;
    });
  }

  private resolveBaseSelectedModelProfile(input: {
    selectedTarget?: string | null;
    profileId?: string | null;
    providers: ProviderCatalogEntry[];
    profiles: ProviderProfile[];
  }): SelectedModelProfile {
    const targetSelection = String(input.selectedTarget || '').trim()
      ? this.resolveSelection(String(input.selectedTarget || '').trim())
      : null;
    if (targetSelection) {
      return this.toSelectedProfile({
        source: 'target-selection',
        selection: targetSelection,
        providers: input.providers,
        fallbackOrder: [],
        explanation: [`Selecao solicitada: ${targetSelection.replyLabel}.`],
      });
    }

    const profileSelection = String(input.profileId || '').trim()
      ? this.resolveProfileSelection(String(input.profileId || '').trim())
      : null;
    if (profileSelection) {
      const skipped = profileSelection.skippedCandidates
        .map((candidate) => `${candidate.id}: ${candidate.issue || candidate.readiness}`)
        .slice(0, 3);
      return this.toSelectedProfile({
        source: 'profile-selection',
        selection: profileSelection.selection,
        providers: input.providers,
        fallbackOrder: profileSelection.profile.preferredOrder,
        explanation: [
          `Perfil ${profileSelection.profile.label} selecionou ${profileSelection.target.label}.`,
          ...(skipped.length > 0 ? [`Fallbacks ignorados: ${skipped.join(' | ')}.`] : []),
        ],
      });
    }

    const providerName = this.getCurrentConversationalProvider();
    const modelName = this.getCurrentConversationalModel();
    const currentProvider = this.findProviderEntry(input.providers, providerName);
    return this.toSelectedProfile({
      source: 'current-config',
      selection: {
        selectionKind: 'provider',
        requestedTarget: providerName,
        replyLabel: currentProvider?.label || providerName,
        effectiveProviderName: providerName,
        modelName,
      },
      providers: input.providers,
      fallbackOrder: input.profiles[0]?.preferredOrder || [],
      explanation: [`Configuracao atual seleciona ${providerName}${modelName ? `/${modelName}` : ''}.`],
    });
  }

  private toSelectedProfile(input: {
    source: SelectedModelProfile['source'];
    selection: ProviderControlPlaneSelection;
    providers: ProviderCatalogEntry[];
    fallbackOrder: string[];
    explanation: string[];
  }): SelectedModelProfile {
    const provider = this.findProviderEntry(input.providers, input.selection.effectiveProviderName)
      || this.findProviderEntry(input.providers, input.selection.requestedTarget);
    const modelName = input.selection.modelName
      || this.getCurrentModelForProvider(input.selection.effectiveProviderName)
      || provider?.currentModel
      || null;
    return toSelectedModelProfile({
      source: input.source,
      selection: input.selection,
      providers: input.providers,
      fallbackOrder: input.fallbackOrder,
      explanation: input.explanation,
      modelName,
    });
  }

  private findProviderEntry(providers: ProviderCatalogEntry[], target: string): ProviderCatalogEntry | null {
    const normalized = normalizeProviderId(target);
    return providers.find((entry) => {
      return normalizeProviderId(entry.id) === normalized
        || normalizeProviderId(entry.effectiveProviderName) === normalized
        || entry.aliases.map(normalizeProviderId).includes(normalized);
    }) || null;
  }

  private readConfiguredModelSelection(): {
    selectedFamilyId: string | null;
    selectedRouteId: string | null;
    selectedModelId: string | null;
  } {
    return {
      selectedFamilyId: this.readConfigString('modelSelectionFamilyId') || null,
      selectedRouteId: this.readConfigString('modelSelectionRouteId') || null,
      selectedModelId: this.readConfigString('modelSelectionModelId') || null,
    };
  }

  private resolveTaskCapability(
    taskKind: WorkspaceTaskKind,
    taskSubtype: WorkspaceTaskSubtype,
  ): ModelCapabilityKind | null {
    if (taskKind === 'code') {
      return 'coding';
    }
    if (taskKind === 'research') {
      return 'research';
    }
    if (taskKind === 'automation') {
      return 'tool_use';
    }
    if (taskSubtype === 'summarization') {
      return 'long_context';
    }
    return null;
  }

  private buildProviderEntries(): ProviderCatalogEntry[] {
    const geminiReady = config.geminiApiKeys.length > 0;
    const geminiIssue = geminiReady ? null : 'Falta configurar GEMINI_API_KEY.';
    const AIGatewayBaseUrl = String(config.AIGatewayBaseUrl || '').trim();
    const AIGatewayGatewayStatus = this.readAIGatewayGatewayStatus();
    const AIGatewayUsesDefault = AIGatewayBaseUrl === DEFAULT_AIGateway_GATEWAY_BASE_URL;
    const AIGatewayReady = Boolean(
      AIGatewayBaseUrl
      && (
        config.zavorthAIGatewayGatewayEnabled
          ? AIGatewayGatewayStatus?.ready
          : false
      ),
    );
    const AIGatewayIssue = !AIGatewayBaseUrl
      ? 'Falta definir AIGateway_BASE_URL.'
      : AIGatewayReady
        ? null
        : config.zavorthAIGatewayGatewayEnabled
          ? (
            String(AIGatewayGatewayStatus?.message || '').trim()
            || `Gateway proprio do AIGateway ainda nao esta pronto (${AIGatewayUsesDefault ? 'rota local padrao do Zavorth' : AIGatewayBaseUrl}).`
          )
          : `Precisa de probe no runtime (${AIGatewayUsesDefault ? 'endpoint local padrao' : AIGatewayBaseUrl}).`;

    const entries: ProviderCatalogEntry[] = [
      {
        id: 'gemini',
        kind: 'provider',
        label: 'Gemini',
        effectiveProviderName: 'gemini',
        aliases: [],
        visibility: 'public',
        mode: 'cloud',
        summary: 'Provider cloud padrao do Zavorth para conversa, resumo e multimodal.',
        currentModel: String(config.geminiModel || config.geminiDefaultModel || '').trim() || null,
        requirements: ['GEMINI_API_KEY'],
        readiness: geminiReady ? 'ready' : 'needs_config',
        ready: geminiReady,
        issue: geminiIssue,
      },
      {
        id: 'gemma',
        kind: 'alias',
        label: 'Gemma via Gemini API',
        effectiveProviderName: 'gemini',
        aliases: [],
        visibility: 'public',
        mode: 'alias',
        summary: 'Atalho para rodar Gemma hospedado pelo provider Gemini.',
        currentModel: String(config.gemmaModel || 'gemma-2-27b-it').trim() || null,
        requirements: ['GEMINI_API_KEY'],
        readiness: geminiReady ? 'ready' : 'needs_config',
        ready: geminiReady,
        issue: geminiIssue,
      },
      {
        id: 'deepseek',
        kind: 'provider',
        label: 'DeepSeek',
        effectiveProviderName: 'deepseek',
        aliases: [],
        visibility: 'public',
        mode: 'cloud',
        summary: 'Provider OpenAI-compatible orientado a custo e coding geral.',
        currentModel: String(config.deepseekModel || '').trim() || null,
        requirements: ['DEEPSEEK_API_KEY'],
        readiness: config.deepseekApiKey ? 'ready' : 'needs_config',
        ready: Boolean(config.deepseekApiKey),
        issue: config.deepseekApiKey ? null : 'Falta configurar DEEPSEEK_API_KEY.',
      },
      {
        id: 'openai',
        kind: 'provider',
        label: 'OpenAI',
        effectiveProviderName: 'openai',
        aliases: [],
        visibility: 'public',
        mode: 'cloud',
        summary: 'Provider de uso geral para coding, revisao e automacao mais sensivel.',
        currentModel: String(config.openaiModel || '').trim() || null,
        requirements: ['OPENAI_API_KEY'],
        readiness: (config.openaiApiKey || config.openaiApiKeys?.length > 0) ? 'ready' : 'needs_config',
        ready: Boolean(config.openaiApiKey || config.openaiApiKeys?.length > 0),
        issue: (config.openaiApiKey || config.openaiApiKeys?.length > 0) ? null : 'Falta configurar OPENAI_API_KEY.',
      },
      {
        id: 'minimax',
        kind: 'provider',
        label: 'MiniMax',
        effectiveProviderName: 'minimax',
        aliases: [],
        visibility: 'public',
        mode: 'cloud',
        summary: 'Provider direto OpenAI-compatible do MiniMax para coding e tarefas agentic.',
        currentModel: String(config.minimaxModel || '').trim() || null,
        requirements: ['MINIMAX_API_KEY'],
        readiness: config.minimaxApiKey ? 'ready' : 'needs_config',
        ready: Boolean(config.minimaxApiKey),
        issue: config.minimaxApiKey ? null : 'Falta configurar MINIMAX_API_KEY.',
      },
      {
        id: 'AIGateway',
        kind: 'provider',
        label: 'AIGateway',
        effectiveProviderName: 'AIGateway',
        aliases: [],
        visibility: 'public',
        mode: 'hybrid',
        summary: 'Rota local/hibrida OpenAI-compatible boa para coding e sidecars.',
        currentModel: String(config.AIGatewayModel || '').trim() || null,
        requirements: ['AIGateway_BASE_URL'],
        readiness: !AIGatewayBaseUrl ? 'needs_config' : (AIGatewayReady ? 'ready' : 'needs_probe'),
        ready: AIGatewayReady,
        issue: AIGatewayIssue,
      },
      {
        id: 'qwen',
        kind: 'provider',
        label: 'Qwen via Puter',
        effectiveProviderName: 'qwen',
        aliases: ['puter'],
        visibility: 'public',
        mode: 'cloud',
        summary: 'Usa a camada OpenAI-compatible da Puter para modelos Qwen.',
        currentModel: String(config.qwenModel || '').trim() || null,
        requirements: ['PUTER_AUTH_TOKEN'],
        readiness: config.puterAuthToken ? 'ready' : 'needs_config',
        ready: Boolean(config.puterAuthToken),
        issue: config.puterAuthToken ? null : 'Falta configurar PUTER_AUTH_TOKEN.',
      },
      {
        id: 'openrouter',
        kind: 'provider',
        label: 'OpenRouter',
        effectiveProviderName: 'openrouter',
        aliases: [],
        visibility: 'public',
        mode: 'cloud',
        summary: 'Agrega varios modelos cloud com fallback amplo e uso forte em research.',
        currentModel: String(config.openRouterModel || '').trim() || null,
        requirements: ['OPENROUTER_API_KEY'],
        readiness: config.openRouterApiKey ? 'ready' : 'needs_config',
        ready: Boolean(config.openRouterApiKey),
        issue: config.openRouterApiKey ? null : 'Falta configurar OPENROUTER_API_KEY.',
      },
      {
        id: 'opencode',
        kind: 'provider',
        label: 'OpenCode',
        effectiveProviderName: 'opencode',
        aliases: [],
        visibility: 'advanced',
        mode: 'cloud',
        summary: 'Provider especializado e ainda menos exposto nas superfices principais.',
        currentModel: String(config.openCodeModel || '').trim() || null,
        requirements: ['OPENCODE_API_KEY'],
        readiness: config.openCodeApiKey ? 'ready' : 'needs_config',
        ready: Boolean(config.openCodeApiKey),
        issue: config.openCodeApiKey ? null : 'Falta configurar OPENCODE_API_KEY.',
      },
    ];
    return this.enrichProviderEntries(entries);
  }

  private enrichProviderEntries(entries: ProviderCatalogEntry[]): ProviderCatalogEntry[] {
    const routes = this.resolveAccessRoutes({ includeAdvanced: true }).routes;
    return entries.map((entry) => {
      const route = routes.find((candidate) => {
        const routeKeys = [
          candidate.id,
          candidate.providerId,
          candidate.providerName,
          ...candidate.aliases,
        ].map(normalizeProviderId);
        const entryKeys = [
          entry.id,
          entry.effectiveProviderName,
          ...entry.aliases,
        ].map(normalizeProviderId);
        return entryKeys.some((key) => routeKeys.includes(key));
      });
      if (!route) {
        return entry;
      }

      return {
        ...entry,
        aliases: uniqueStrings([...entry.aliases, ...route.aliases]),
        mode: route.mode,
        currentModel: entry.currentModel || route.currentModelName,
        requirements: [...route.requirements],
        readiness: route.readiness,
        ready: route.ready,
        issue: route.issue,
      };
    });
  }

  private buildCredentialReadiness(): Record<string, boolean> {
    return {
      GEMINI_API_KEY: config.geminiApiKeys.length > 0 || Boolean(config.geminiApiKey),
      DEEPSEEK_API_KEY: Boolean(config.deepseekApiKey),
      OPENAI_API_KEY: Boolean(config.openaiApiKey || config.openaiApiKeys?.length > 0),
      MINIMAX_API_KEY: Boolean(config.minimaxApiKey),
      PUTER_AUTH_TOKEN: Boolean(config.puterAuthToken),
      OPENROUTER_API_KEY: Boolean(config.openRouterApiKey),
      GROQ_API_KEY: Boolean(process.env.GROQ_API_KEY),
      COHERE_API_KEY: Boolean(process.env.COHERE_API_KEY || process.env.CO_API_KEY),
      CO_API_KEY: Boolean(process.env.CO_API_KEY || process.env.COHERE_API_KEY),
      SAMBANOVA_API_KEY: Boolean(process.env.SAMBANOVA_API_KEY),
      FALCON_API_KEY: Boolean(process.env.FALCON_API_KEY || process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN),
      JAIS_API_KEY: Boolean(process.env.JAIS_API_KEY || process.env.CORE42_API_KEY || process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN),
      CORE42_API_KEY: Boolean(process.env.CORE42_API_KEY || process.env.JAIS_API_KEY),
      CEREBRAS_API_KEY: Boolean(process.env.CEREBRAS_API_KEY),
      GITHUB_MODELS_TOKEN: Boolean(process.env.GITHUB_MODELS_TOKEN || process.env.GITHUB_TOKEN),
      TOGETHER_API_KEY: Boolean(process.env.TOGETHER_API_KEY),
      HUGGINGFACE_API_KEY: Boolean(process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN),
      ELEVENLABS_API_KEY: Boolean(process.env.ELEVENLABS_API_KEY || process.env.XI_API_KEY),
      OPENCODE_API_KEY: Boolean(config.openCodeApiKey),
      DEEPGRAM_API_KEY: Boolean(config.deepgramApiKey),
      ANTHROPIC_API_KEY: Boolean(this.readConfigString('anthropicApiKey') || process.env.ANTHROPIC_API_KEY),
      CLAUDE_OAUTH_TOKEN: Boolean(process.env.CLAUDE_OAUTH_TOKEN),
      CUSTOM_OPENAI_COMPATIBLE_API_KEY: Boolean(process.env.CUSTOM_OPENAI_COMPATIBLE_API_KEY),
      KILO_GATEWAY_API_KEY: Boolean(process.env.KILO_GATEWAY_API_KEY),
      NANOBANANA_API_KEY: Boolean(process.env.NANOBANANA_API_KEY),
    };
  }

  private buildBaseUrlReadiness(): Record<string, string> {
    return {
      AIGateway_BASE_URL: String(config.AIGatewayBaseUrl || '').trim(),
      AIGateway_UPSTREAM_BASE_URL: String(config.AIGatewayUpstreamBaseUrl || '').trim(),
      cohere: String(process.env.COHERE_BASE_URL || 'https://api.cohere.ai/compatibility/v1').trim(),
      COHERE_BASE_URL: String(process.env.COHERE_BASE_URL || 'https://api.cohere.ai/compatibility/v1').trim(),
      sambanova: String(process.env.SAMBANOVA_BASE_URL || 'https://api.sambanova.ai/v1').trim(),
      SAMBANOVA_BASE_URL: String(process.env.SAMBANOVA_BASE_URL || 'https://api.sambanova.ai/v1').trim(),
      falcon: String(process.env.FALCON_BASE_URL || process.env.HUGGINGFACE_BASE_URL || 'https://router.huggingface.co/v1').trim(),
      FALCON_BASE_URL: String(process.env.FALCON_BASE_URL || process.env.HUGGINGFACE_BASE_URL || 'https://router.huggingface.co/v1').trim(),
      jais: String(process.env.JAIS_BASE_URL || process.env.HUGGINGFACE_BASE_URL || 'https://router.huggingface.co/v1').trim(),
      JAIS_BASE_URL: String(process.env.JAIS_BASE_URL || process.env.HUGGINGFACE_BASE_URL || 'https://router.huggingface.co/v1').trim(),
      cerebras: String(process.env.CEREBRAS_BASE_URL || 'https://api.cerebras.ai/v1').trim(),
      CEREBRAS_BASE_URL: String(process.env.CEREBRAS_BASE_URL || 'https://api.cerebras.ai/v1').trim(),
      'github-models': String(process.env.GITHUB_MODELS_BASE_URL || 'https://models.github.ai/inference').trim(),
      GITHUB_MODELS_BASE_URL: String(process.env.GITHUB_MODELS_BASE_URL || 'https://models.github.ai/inference').trim(),
      together: String(process.env.TOGETHER_BASE_URL || 'https://api.together.xyz/v1').trim(),
      TOGETHER_BASE_URL: String(process.env.TOGETHER_BASE_URL || 'https://api.together.xyz/v1').trim(),
      groq: String(process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1').trim(),
      GROQ_BASE_URL: String(process.env.GROQ_BASE_URL || '').trim(),
      huggingface: String(process.env.HUGGINGFACE_BASE_URL || 'https://router.huggingface.co/v1').trim(),
      HUGGINGFACE_BASE_URL: String(process.env.HUGGINGFACE_BASE_URL || 'https://router.huggingface.co/v1').trim(),
      ELEVENLABS_BASE_URL: String(process.env.ELEVENLABS_BASE_URL || '').trim(),
      CUSTOM_OPENAI_COMPATIBLE_BASE_URL: String(process.env.CUSTOM_OPENAI_COMPATIBLE_BASE_URL || '').trim(),
      OLLAMA_BASE_URL: String(process.env.OLLAMA_BASE_URL || '').trim(),
    };
  }

  private buildRouteHealth(): Record<string, AccessRouteHealthInput> {
    const providerHealth = new ZavorthProviderLiveProofStoreService().readFreshHealthMap();
    const AIGatewayBaseUrl = String(config.AIGatewayBaseUrl || '').trim();
    if (!AIGatewayBaseUrl) {
      return providerHealth;
    }

    const AIGatewayGatewayStatus = this.readAIGatewayGatewayStatus();
    const AIGatewayUsesDefault = AIGatewayBaseUrl === DEFAULT_AIGateway_GATEWAY_BASE_URL;
    const messageFallback = config.zavorthAIGatewayGatewayEnabled
      ? `Gateway proprio do AIGateway ainda nao esta pronto (${AIGatewayUsesDefault ? 'rota local padrao do Zavorth' : AIGatewayBaseUrl}).`
      : `Precisa de probe no runtime (${AIGatewayUsesDefault ? 'endpoint local padrao' : AIGatewayBaseUrl}).`;
    const health: AccessRouteHealthInput = AIGatewayGatewayStatus?.ready === true
      ? {
        ready: true,
        status: 'healthy',
        message: AIGatewayGatewayStatus.message || null,
        checkedAt: AIGatewayGatewayStatus.checkedAt || null,
      }
      : AIGatewayGatewayStatus
        ? {
          ready: false,
          status: 'unhealthy',
          message: AIGatewayGatewayStatus.message || messageFallback,
          checkedAt: AIGatewayGatewayStatus.checkedAt || null,
        }
        : {
          ready: null,
          status: 'needs_probe',
          message: messageFallback,
          checkedAt: null,
        };

    return {
      ...providerHealth,
      AIGateway: health,
      aigateway: health,
      'ai-gateway': health,
    };
  }

  private buildCurrentModelMap(): Record<string, string | null> {
    return {
      gemini: this.getCurrentModelForProvider('gemini'),
      gemma: String(config.gemmaModel || 'gemma-2-27b-it').trim() || null,
      deepseek: this.getCurrentModelForProvider('deepseek'),
      openai: this.getCurrentModelForProvider('openai'),
      minimax: this.getCurrentModelForProvider('minimax'),
      AIGateway: this.getCurrentModelForProvider('AIGateway'),
      aigateway: this.getCurrentModelForProvider('AIGateway'),
      qwen: this.getCurrentModelForProvider('qwen'),
      puter: this.getCurrentModelForProvider('qwen'),
      openrouter: this.getCurrentModelForProvider('openrouter'),
      opencode: this.getCurrentModelForProvider('opencode'),
    };
  }

  private readConfigString(key: string): string {
    const value = (config as typeof config & Record<string, unknown>)[key];
    return typeof value === 'string' ? value.trim() : '';
  }

  private findSelectableProvider(rawTarget: string): ProviderCatalogEntry | null {
    const normalized = String(rawTarget || '').trim().toLowerCase();
    return this.listProviders({ includeAdvanced: true }).find((entry) => {
      return entry.id === normalized || entry.aliases.includes(normalized);
    }) || null;
  }

  private getProfileProviderRank(profile: ProviderProfile, providerName: string): number {
    const normalized = String(providerName || '').trim().toLowerCase();
    const directRank = profile.preferredOrder.indexOf(normalized);
    if (directRank !== -1) {
      return directRank;
    }
    if (normalized === 'gemini') {
      const gemmaRank = profile.preferredOrder.indexOf('gemma');
      if (gemmaRank !== -1) {
        return gemmaRank + 1;
      }
    }
    return Number.MAX_SAFE_INTEGER;
  }

  private isDirectGeminiModel(rawTarget: string): boolean {
    return /^gemini-[a-z0-9][a-z0-9._-]*$/i.test(rawTarget)
      || /^gemma-[a-z0-9][a-z0-9._-]*$/i.test(rawTarget);
  }

  private getPreferredProfileOrder(
    taskKind: WorkspaceTaskKind,
    taskSubtype: WorkspaceTaskSubtype,
  ): ProviderProfileId[] {
    if (taskKind === 'research') {
      return ['research', 'balanced', 'budget', 'coding', 'local-first'];
    }
    if (taskKind === 'code') {
      if (taskSubtype === 'debugging' || taskSubtype === 'review' || taskSubtype === 'testing') {
        return ['coding', 'balanced', 'local-first', 'research', 'budget'];
      }
      return ['coding', 'balanced', 'budget', 'local-first', 'research'];
    }
    if (taskKind === 'automation') {
      return ['balanced', 'local-first', 'coding', 'budget', 'research'];
    }
    return ['balanced', 'coding', 'research', 'budget', 'local-first'];
  }

  private readAIGatewayGatewayStatus(): AIGatewayProxyStatus | null {
    try {
      if (!config.AIGatewayGatewayStatusFile || !fs.existsSync(config.AIGatewayGatewayStatusFile)) {
        return null;
      }
      const parsed = JSON.parse(fs.readFileSync(config.AIGatewayGatewayStatusFile, 'utf8')) as Partial<AIGatewayProxyStatus>;
      return {
        enabled: parsed.enabled === true,
        ready: parsed.ready === true,
        running: parsed.running === true,
        pid: typeof parsed.pid === 'number' ? parsed.pid : null,
        host: String(parsed.host || config.zavorthAIGatewayGatewayHost || '').trim(),
        port: Number(parsed.port || config.zavorthAIGatewayGatewayPort || 0),
        baseUrl: String(parsed.baseUrl || config.zavorthAIGatewayGatewayBaseUrl || '').trim(),
        upstreamBaseUrl: String(parsed.upstreamBaseUrl || config.AIGatewayUpstreamBaseUrl || '').trim(),
        localOnly: parsed.localOnly !== false,
        overlayFile: typeof parsed.overlayFile === 'string' ? parsed.overlayFile : config.AIGatewayOverlayFile,
        checkedAt: String(parsed.checkedAt || '').trim(),
        message: String(parsed.message || '').trim(),
      };
    } catch (error) { logger.warn('[Control Plane] parsing failed', error); return null; }
  }
}
