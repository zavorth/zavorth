import type { WorkspaceTaskKind, WorkspaceTaskSubtype } from './WorkspaceTaskKind.js';
import type { ModelPickerContract } from '../contracts/ModelPickerContract.js';
import { ModelPickerContractService } from '../domain/providers/index.js';
import {
  ProviderControlPlaneService,
  type ProviderCatalogEntry,
  type ProviderProfile,
  type ProviderProfileRecommendation,
} from './ProviderControlPlaneService.js';

export type ProviderDoctorReport = {
  activeProviderName: string;
  activeModelName: string;
  preferredZavorthBridgeModel: string | null;
  providers: ProviderCatalogEntry[];
  readyProviders: ProviderCatalogEntry[];
  pendingConfigProviders: ProviderCatalogEntry[];
  probeProviders: ProviderCatalogEntry[];
  profiles: ProviderProfile[];
  recommendedProfile: ProviderProfileRecommendation;
  modelPicker: ModelPickerContract;
  recommendations: string[];
};

type ProviderDoctorRuntime = {
  providerControlPlane?: ProviderControlPlaneService;
};

export class ProviderDoctorService {
  private readonly providerControlPlane: ProviderControlPlaneService;

  constructor(runtime: ProviderDoctorRuntime = {}) {
    this.providerControlPlane = runtime.providerControlPlane || new ProviderControlPlaneService();
  }

  public inspect(
    options: {
      taskKind?: WorkspaceTaskKind;
      taskSubtype?: WorkspaceTaskSubtype;
      workspaceMemory?: Record<string, any> | null | undefined;
      preferredZavorthBridgeModel?: string | null;
      includeAdvanced?: boolean;
    } = {},
  ): ProviderDoctorReport {
    const taskKind = options.taskKind || 'code';
    const taskSubtype = options.taskSubtype || 'general';
    const providers = this.providerControlPlane.listProviders({
      includeAdvanced: options.includeAdvanced,
    });
    const readyProviders = providers.filter((entry) => entry.readiness === 'ready');
    const pendingConfigProviders = providers.filter((entry) => entry.readiness === 'needs_config');
    const probeProviders = providers.filter((entry) => entry.readiness === 'needs_probe');
    const profiles = this.providerControlPlane.listProfiles();
    const recommendedProfile = this.providerControlPlane.recommendProfileForTask(taskKind, taskSubtype, {
      workspaceMemory: options.workspaceMemory,
    });
    const modelPicker = new ModelPickerContractService({
      providerControlPlane: this.providerControlPlane,
    }).buildContract({
      includeAdvanced: options.includeAdvanced === true,
    });
    const activeProviderName = this.providerControlPlane.getCurrentConversationalProvider();
    const activeModelName = this.providerControlPlane.getCurrentConversationalModel();
    const preferredZavorthBridgeModel = String(options.preferredZavorthBridgeModel || '').trim() || null;

    return {
      activeProviderName,
      activeModelName,
      preferredZavorthBridgeModel,
      providers,
      readyProviders,
      pendingConfigProviders,
      probeProviders,
      profiles,
      recommendedProfile,
      modelPicker,
      recommendations: this.buildRecommendations({
        activeProviderName,
        readyProviders,
        pendingConfigProviders,
        probeProviders,
        recommendedProfile,
      }),
    };
  }

  public renderStatusReport(
    options: {
      taskKind?: WorkspaceTaskKind;
      taskSubtype?: WorkspaceTaskSubtype;
      workspaceMemory?: Record<string, any> | null | undefined;
      preferredZavorthBridgeModel?: string | null;
      includeAdvanced?: boolean;
    } = {},
  ): string {
    const report = this.inspect(options);
    const lines = [
      'Zavorth models and providers',
      '',
      `Current primary provider: ${report.activeProviderName}`,
      `Current conversational model: ${report.activeModelName}`,
      `Preferred ZavorthBridge model: ${report.preferredZavorthBridgeModel || 'not set yet'}`,
      '',
      `Providers ready now: ${this.formatProviderList(report.readyProviders)}`,
      `Providers needing configuration: ${this.formatProviderList(report.pendingConfigProviders)}`,
      `Providers needing local/runtime probe: ${this.formatProviderList(report.probeProviders)}`,
      '',
      `Recommended profile for this stage: ${report.recommendedProfile.profile.label}`,
      `Suggested route: ${this.formatPreferredOrder(report.recommendedProfile.profile)}`,
      `Current learned strategy: ${report.recommendedProfile.strategy.providerName}${report.recommendedProfile.strategy.modelName ? `/${report.recommendedProfile.strategy.modelName}` : ''}`,
      '',
      'Useful profiles:',
    ];

    for (const profile of report.profiles) {
      lines.push(`- ${profile.label}: ${profile.summary} | order ${profile.preferredOrder.join(' -> ')}`);
    }

    if (report.recommendations.length > 0) {
      lines.push('', 'Recommendations:');
      for (const recommendation of report.recommendations) {
        lines.push(`- ${recommendation}`);
      }
    }

    return lines.join('\n');
  }

  private buildRecommendations(input: {
    activeProviderName: string;
    readyProviders: ProviderCatalogEntry[];
    pendingConfigProviders: ProviderCatalogEntry[];
    probeProviders: ProviderCatalogEntry[];
    recommendedProfile: ProviderProfileRecommendation;
  }): string[] {
    const lines: string[] = [];
    const activeReady = input.readyProviders.some((entry) => {
      return entry.id === input.activeProviderName || entry.effectiveProviderName === input.activeProviderName;
    });

    if (!input.readyProviders.length) {
      lines.push('Nenhum provider cloud esta pronto agora; configure GEMINI_API_KEY ou OPENAI_API_KEY primeiro.');
    } else if (!activeReady) {
      const fallback = input.readyProviders[0];
      lines.push(
        `O provider atual nao esta pronto; considere trocar para ${fallback.label.toLowerCase()} com /model ${fallback.id}.`,
      );
    }

    if (input.probeProviders.length > 0) {
      lines.push('Rotas locais/hibridas precisam de probe operacional antes de virarem default no runtime.');
    }

    if (input.pendingConfigProviders.some((entry) => entry.id === 'openrouter')) {
      lines.push(
        'Se voce precisa de research mais amplo, vale configurar OPENROUTER_API_KEY e ligar /model openrouter.',
      );
    }

    if (input.pendingConfigProviders.some((entry) => entry.id === 'minimax')) {
      lines.push(
        'Se voce quer MiniMax direto sem passar pelo OpenRouter, configure MINIMAX_API_KEY e ligue /model minimax.',
      );
    }

    if (input.recommendedProfile.profile.id === 'coding') {
      lines.push('Para coding pesado, mantenha AIGateway ou OpenAI como primeira linha e Gemini como fallback seguro.');
    }

    if (input.recommendedProfile.profile.id === 'budget') {
      lines.push('Para custo baixo, Gemini/Gemma e Qwen via Puter formam a trilha mais economica.');
    }

    return lines;
  }

  private formatProviderList(entries: ProviderCatalogEntry[]): string {
    if (!entries.length) {
      return 'nenhum';
    }

    return entries
      .map((entry) => {
        const alias = entry.aliases.length ? ` (alias: ${entry.aliases.join(', ')})` : '';
        const model = entry.currentModel ? `/${entry.currentModel}` : '';
        return `${entry.id}${model}${alias}`;
      })
      .join(', ');
  }

  private formatPreferredOrder(profile: ProviderProfile): string {
    return profile.preferredOrder.join(' -> ');
  }
}
