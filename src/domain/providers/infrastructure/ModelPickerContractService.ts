import type {
  AccessRouteCatalog,
  ModelFamilyCatalog,
  ModelPickerContract,
  ModelPickerContractBuildOptions,
  ModelPickerSelectionInput,
  ModelPickerSelectionResult,
  SelectedModelProfile,
} from '../../../contracts/ModelPickerContract.js';
import type {
  ProviderCatalogEntry,
  ProviderControlPlaneSelection,
  ProviderProfile,
  ProviderProfileSelection,
} from '../../../services/ProviderControlPlaneService.js';
import { ProviderControlPlaneService } from '../../../services/ProviderControlPlaneService.js';

import {
  buildProviderCatalogContract,
  selectModelFromPickerContract,
  toAccessRouteCatalog,
  toModelFamilyCatalog,
  toSelectedModelProfile,
} from '../../../services/providers/catalog/ProviderCatalogCompat.js';

type ProviderControlPlaneForModelPicker = Pick<
  ProviderControlPlaneService,
  | 'listProviders'
  | 'listProfiles'
  | 'getCurrentConversationalProvider'
  | 'getCurrentConversationalModel'
  | 'getCurrentModelForProvider'
  | 'resolveSelection'
  | 'resolveProfileSelection'
> & Partial<Pick<ProviderControlPlaneService, 'resolveAccessRoutes'>>;

export type ModelPickerContractServiceRuntime = {
  now?: () => Date;
  providerControlPlane?: ProviderControlPlaneForModelPicker | null;
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeId(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

export class ModelPickerContractService {
  private readonly now: () => Date;
  private readonly providerControlPlane: ProviderControlPlaneForModelPicker;

  constructor(runtime: ModelPickerContractServiceRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.providerControlPlane = runtime.providerControlPlane || new ProviderControlPlaneService();
  }

  public buildContract(options: ModelPickerContractBuildOptions = {}): ModelPickerContract {
    const generatedAt = this.now().toISOString();
    const providers = this.providerControlPlane.listProviders({
      includeAdvanced: options.includeAdvanced === true,
    });
    const allProviders = this.providerControlPlane.listProviders({ includeAdvanced: true });
    const profiles = this.providerControlPlane.listProfiles();
    const selected = this.resolveSelectedModelProfile(options, allProviders, profiles);
    const routes = this.providerControlPlane.resolveAccessRoutes
      ? {
        schemaVersion: 1 as const,
        generatedAt,
        routes: this.providerControlPlane.resolveAccessRoutes({
          includeAdvanced: options.includeAdvanced === true,
          generatedAt,
        }).routes,
      }
      : null;

    return buildProviderCatalogContract({
      generatedAt,
      providers,
      profiles,
      selected,
      routes,
    });
  }

  public buildFamilyCatalog(options: { includeAdvanced?: boolean } = {}): ModelFamilyCatalog {
    const generatedAt = this.now().toISOString();
    const providers = this.providerControlPlane.listProviders({
      includeAdvanced: options.includeAdvanced === true,
    });
    return toModelFamilyCatalog(providers, generatedAt);
  }

  public buildAccessRouteCatalog(options: { includeAdvanced?: boolean } = {}): AccessRouteCatalog {
    const generatedAt = this.now().toISOString();
    const providers = this.providerControlPlane.listProviders({
      includeAdvanced: options.includeAdvanced === true,
    });
    if (this.providerControlPlane.resolveAccessRoutes) {
      return {
        schemaVersion: 1,
        generatedAt,
        routes: this.providerControlPlane.resolveAccessRoutes({
          includeAdvanced: options.includeAdvanced === true,
          generatedAt,
        }).routes,
      };
    }
    return toAccessRouteCatalog(providers, generatedAt);
  }

  public selectModel(input: ModelPickerSelectionInput = {}): ModelPickerSelectionResult {
    const contract = this.buildContract({
      includeAdvanced: input.includeAdvanced,
      selectedTarget: input.selectedTarget,
      profileId: input.preferredProfileId,
    });
    return selectModelFromPickerContract(contract, input);
  }

  private resolveSelectedModelProfile(
    options: ModelPickerContractBuildOptions,
    providers: ProviderCatalogEntry[],
    profiles: ProviderProfile[],
  ): SelectedModelProfile {
    const targetSelection = normalizeText(options.selectedTarget)
      ? this.providerControlPlane.resolveSelection(normalizeText(options.selectedTarget))
      : null;
    if (targetSelection) {
      return this.toSelectedModelProfile({
        source: 'target-selection',
        selection: targetSelection,
        providers,
        fallbackOrder: [],
        explanation: [`Selecao solicitada: ${targetSelection.replyLabel}.`],
      });
    }

    const profileSelection = normalizeText(options.profileId)
      ? this.providerControlPlane.resolveProfileSelection(normalizeText(options.profileId))
      : null;
    if (profileSelection) {
      return this.toSelectedModelProfile({
        source: 'profile-selection',
        selection: profileSelection.selection,
        providers,
        fallbackOrder: profileSelection.profile.preferredOrder,
        explanation: this.describeProfileSelection(profileSelection),
      });
    }

    const providerName = this.providerControlPlane.getCurrentConversationalProvider();
    const modelName = this.providerControlPlane.getCurrentConversationalModel();
    const currentProvider = this.findProvider(providers, providerName);
    return this.toSelectedModelProfile({
      source: 'current-config',
      selection: {
        selectionKind: 'provider',
        requestedTarget: providerName,
        replyLabel: currentProvider?.label || providerName,
        effectiveProviderName: providerName,
        modelName,
      },
      providers,
      fallbackOrder: profiles[0]?.preferredOrder || [],
      explanation: [`Configuraction current seleciona ${providerName}${modelName ? `/${modelName}` : ''}.`],
    });
  }

  private toSelectedModelProfile(input: {
    source: SelectedModelProfile['source'];
    selection: ProviderControlPlaneSelection;
    providers: ProviderCatalogEntry[];
    fallbackOrder: string[];
    explanation: string[];
  }): SelectedModelProfile {
    const provider = this.findProvider(input.providers, input.selection.effectiveProviderName)
      || this.findProvider(input.providers, input.selection.requestedTarget);
    const modelName = input.selection.modelName
      || this.providerControlPlane.getCurrentModelForProvider(input.selection.effectiveProviderName)
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

  private findProvider(providers: ProviderCatalogEntry[], target: string): ProviderCatalogEntry | null {
    const normalized = normalizeId(target);
    return providers.find((entry) => {
      return normalizeId(entry.id) === normalized
        || normalizeId(entry.effectiveProviderName) === normalized
        || entry.aliases.map(normalizeId).includes(normalized);
    }) || null;
  }

  private describeProfileSelection(selection: ProviderProfileSelection): string[] {
    const skipped = selection.skippedCandidates
      .map((candidate) => `${candidate.id}: ${candidate.issue || candidate.readiness}`)
      .slice(0, 3);
    return [
      `Perfil ${selection.profile.label} selecionou ${selection.target.label}.`,
      ...(skipped.length > 0 ? [`Fallbacks ignorados: ${skipped.join(' | ')}.`] : []),
    ];
  }
}
