import {
  resolveWorkspaceLlmStrategy,
  type WorkspaceLlmStrategy,
} from './WorkspaceLlmProfile.js';
import {
  ProviderControlPlaneService,
  type ProviderProfile,
  type ProviderProfileId,
} from './ProviderControlPlaneService.js';
import { ProviderFactory } from '../providers/ProviderFactory.js';


import type { WorkspaceTaskKind, WorkspaceTaskSubtype } from './WorkspaceTaskKind.js';
import type { SelectedModelProfile } from '../contracts/ModelPickerContract.js';

export type ProviderStrategyDecision = WorkspaceLlmStrategy & {
  profileId: ProviderProfileId | null;
  profileLabel: string | null;
  selectedModelProfile: SelectedModelProfile | null;
  routeId: string | null;
  familyId: string | null;
  providerId: string | null;
  fallbackProfiles: SelectedModelProfile[];
  modelSelectionExplanation: string[];
  selectionSource: 'learned' | 'profile' | 'configured';
  configuredProviderName: string;
  learnedProviderName: string | null;
  rationale: string[];
};

type ResolveProviderStrategyInput = {
  taskKind: WorkspaceTaskKind;
  taskSubtype: WorkspaceTaskSubtype;
  configuredProviderName?: string;
  isProviderUsable?: (name: string) => boolean;
  workspaceMemory?: Record<string, any> | null | undefined;
};

type ProviderStrategyRuntime = {
  providerControlPlaneService?: Pick<ProviderControlPlaneService, 'recommendProfileForTask'>;
};

export class ProviderStrategyService {
  private readonly providerControlPlaneService: Pick<ProviderControlPlaneService, 'recommendProfileForTask'>;

  constructor(runtime: ProviderStrategyRuntime = {}) {
    this.providerControlPlaneService = runtime.providerControlPlaneService || new ProviderControlPlaneService();
  }

  public resolve(input: ResolveProviderStrategyInput): ProviderStrategyDecision {
    const configuredProviderName = ProviderFactory.normalizeProviderName(input.configuredProviderName || 'gemini');
    const strategy = resolveWorkspaceLlmStrategy(input.taskKind, input.taskSubtype, {
      configuredProviderName,
      isProviderUsable: input.isProviderUsable,
      workspaceMemory: input.workspaceMemory,
    });
    const profileRecommendation = this.providerControlPlaneService.recommendProfileForTask(
      input.taskKind,
      input.taskSubtype,
      {
        workspaceMemory: input.workspaceMemory,
      },
    );
    const learnedRecommendation = this.resolveLearnedRecommendation(
      input.workspaceMemory,
      input.taskKind,
      input.taskSubtype,
    );
    const learnedProviderName = learnedRecommendation?.preferred_provider
      ? ProviderFactory.normalizeProviderName(learnedRecommendation.preferred_provider)
      : null;
    const profile = profileRecommendation?.profile || null;
    const selectedModelProfile = profileRecommendation?.selectedModelProfile || null;
    const fallbackProfiles = profileRecommendation?.fallbackProfiles || [];
    const modelSelectionExplanation = profileRecommendation?.selectionExplanation || selectedModelProfile?.explanation || [];
    const selectionSource = this.resolveSelectionSource(
      strategy.providerName,
      configuredProviderName,
      learnedRecommendation,
      profile,
    );
    const rationale = this.buildRationale({
      taskKind: input.taskKind,
      taskSubtype: input.taskSubtype,
      configuredProviderName,
      strategy,
      profile,
      selectedModelProfile,
      fallbackProfiles,
      modelSelectionExplanation,
      learnedRecommendation,
      selectionSource,
    });

    return {
      providerName: selectedModelProfile?.providerName || strategy.providerName,
      modelName: selectedModelProfile?.modelName || strategy.modelName,
      allowFallback: strategy.allowFallback,
      fallbackOrder: strategy.fallbackOrder,
      profileId: profile?.id || null,
      profileLabel: profile?.label || null,
      selectedModelProfile,
      routeId: selectedModelProfile?.routeId || null,
      familyId: selectedModelProfile?.familyId || null,
      providerId: selectedModelProfile?.providerId || null,
      fallbackProfiles,
      modelSelectionExplanation,
      selectionSource,
      configuredProviderName,
      learnedProviderName,
      rationale,
    };
  }

  private resolveSelectionSource(
    providerName: string,
    configuredProviderName: string,
    learnedRecommendation: ReturnType<ProviderStrategyService['resolveLearnedRecommendation']>,
    profile: ProviderProfile | null,
  ): ProviderStrategyDecision['selectionSource'] {
    const learnedProviderName = learnedRecommendation?.preferred_provider
      ? ProviderFactory.normalizeProviderName(learnedRecommendation.preferred_provider)
      : '';
    if (
      learnedProviderName
      && providerName === learnedProviderName
      && (
        Number(learnedRecommendation?.success_count || 0) >= 2
        || learnedRecommendation?.confidence === 'high'
      )
    ) {
      return 'learned';
    }

    if (
      profile
      && profile.preferredOrder.some((entry) => ProviderFactory.normalizeProviderName(entry) === providerName)
      && providerName !== configuredProviderName
    ) {
      return 'profile';
    }

    return 'configured';
  }

  private buildRationale(input: {
    taskKind: WorkspaceTaskKind;
    taskSubtype: WorkspaceTaskSubtype;
    configuredProviderName: string;
    strategy: WorkspaceLlmStrategy;
    profile: ProviderProfile | null;
    selectedModelProfile: SelectedModelProfile | null;
    fallbackProfiles: SelectedModelProfile[];
    modelSelectionExplanation: string[];
    learnedRecommendation: ReturnType<ProviderStrategyService['resolveLearnedRecommendation']>;
    selectionSource: ProviderStrategyDecision['selectionSource'];
  }): string[] {
    const rationale: string[] = [
      `Provider configurado no workspace: ${input.configuredProviderName}.`,
    ];

    if (input.profile) {
      rationale.push(`Perfil sugerido para a tarefa: ${input.profile.label}.`);
    }

    if (input.learnedRecommendation?.preferred_provider) {
      const learnedModel = String(input.learnedRecommendation.preferred_model || '').trim();
      rationale.push(
        `Memoria operacional recomenda ${input.learnedRecommendation.preferred_provider}${learnedModel ? `/${learnedModel}` : ''} para ${input.taskKind}${input.taskSubtype !== 'general' && input.taskSubtype !== 'unknown' ? `/${input.taskSubtype}` : ''}.`,
      );
    }

    rationale.push(
      `Selecao final: ${input.strategy.providerName}${input.strategy.modelName ? `/${input.strategy.modelName}` : ''} (${input.selectionSource}).`,
    );
    if (input.selectedModelProfile) {
      rationale.push(
        `Selecao canonica: familia ${input.selectedModelProfile.familyId}, rota ${input.selectedModelProfile.routeId}, modelo ${input.selectedModelProfile.modelLabel}.`,
      );
    }
    if (input.modelSelectionExplanation.length > 0) {
      rationale.push(`Explicabilidade do picker: ${input.modelSelectionExplanation.slice(0, 2).join(' ')}`);
    }
    if (input.fallbackProfiles.length > 0) {
      rationale.push(`Fallbacks canonicos: ${input.fallbackProfiles.map((entry) => entry.routeId).join(', ')}.`);
    }
    if (input.strategy.allowFallback && input.strategy.fallbackOrder.length > 0) {
      rationale.push(`Fallback habilitado: ${input.strategy.fallbackOrder.join(', ')}.`);
    } else {
      rationale.push('Fallback desabilitado para esta execucao.');
    }

    return rationale;
  }

  private resolveLearnedRecommendation(
    workspaceMemory: Record<string, any> | null | undefined,
    taskKind: WorkspaceTaskKind,
    taskSubtype: WorkspaceTaskSubtype,
  ): {
    kind: WorkspaceTaskKind;
    subtype: WorkspaceTaskSubtype | 'general';
    preferred_provider: string;
    preferred_model: string | null;
    success_count: number;
    confidence: 'low' | 'medium' | 'high';
  } | null {
    const subtypeRecommendations = Array.isArray(workspaceMemory?.task_subtype_llm_recommendations)
      ? workspaceMemory!.task_subtype_llm_recommendations
      : [];
    const kindRecommendations = Array.isArray(workspaceMemory?.task_kind_llm_recommendations)
      ? workspaceMemory!.task_kind_llm_recommendations
      : [];

    const subtypeRecommendation = subtypeRecommendations.find((entry: any) => {
      return String(entry?.kind || '').trim().toLowerCase() === taskKind
        && String(entry?.subtype || '').trim().toLowerCase() === taskSubtype;
    });
    if (subtypeRecommendation) {
      return subtypeRecommendation;
    }

    return kindRecommendations.find((entry: any) => {
      return String(entry?.kind || '').trim().toLowerCase() === taskKind
        && String(entry?.subtype || '').trim().toLowerCase() === 'general';
    }) || null;
  }
}
