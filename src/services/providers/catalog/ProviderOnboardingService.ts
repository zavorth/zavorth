import {
  CustomCompatibleProviderOnboardingInput,
  CustomCompatibleProviderOnboardingService,
} from './CustomCompatibleProviderOnboardingService.js';
import {
  ExternalImportInput,
  ProviderExternalImportService,
} from './ProviderExternalImportService.js';
import {
  ProviderAutoDiscoveryInput,
  ProviderAutoDiscoveryService,
} from './ProviderAutoDiscoveryService.js';
import type { ProviderIntegrationManifest } from './ProviderIntegrationManifest.js';

export type ProviderOnboardingSource = 'custom' | 'import' | 'discovery';

export type ProviderOnboardingResult = {
  schemaVersion: 1;
  providerId: string;
  label: string;
  source: ProviderOnboardingSource;
  manifest: ProviderIntegrationManifest;
  models: string[];
  env: {
    baseUrlRef: string | null;
    apiKeyRef: string | null;
  };
  runtime: {
    providerName: string;
    adapter: string;
    defaultModelName: string | null;
    supported: boolean;
  };
  warnings: string[];
  explanation: string[];
};

function envPrefix(providerId: string): string {
  return providerId.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export class ProviderOnboardingService {
  private readonly customOnboarding: CustomCompatibleProviderOnboardingService;
  private readonly externalImport: ProviderExternalImportService;
  private readonly autoDiscovery: ProviderAutoDiscoveryService;

  constructor(runtime?: {
    customOnboarding?: CustomCompatibleProviderOnboardingService;
    externalImport?: ProviderExternalImportService;
    autoDiscovery?: ProviderAutoDiscoveryService;
  }) {
    this.customOnboarding = runtime?.customOnboarding || new CustomCompatibleProviderOnboardingService();
    this.externalImport = runtime?.externalImport || new ProviderExternalImportService();
    this.autoDiscovery = runtime?.autoDiscovery || new ProviderAutoDiscoveryService();
  }

  public async onboardCustom(input: CustomCompatibleProviderOnboardingInput): Promise<ProviderOnboardingResult> {
    const draft = this.customOnboarding.createDraft(input);
    return {
      schemaVersion: 1,
      providerId: draft.manifest.id,
      label: draft.manifest.label,
      source: 'custom',
      manifest: draft.manifest,
      models: input.modelId ? [input.modelId] : [],
      env: {
        baseUrlRef: draft.env.baseUrlRef,
        apiKeyRef: draft.env.apiKeyRef,
      },
      runtime: {
        providerName: draft.runtime.providerName,
        adapter: draft.runtime.adapter,
        defaultModelName: draft.runtime.modelName,
        supported: draft.runtime.supported,
      },
      warnings: draft.warnings,
      explanation: draft.explanation,
    };
  }

  public async importExternal(input: ExternalImportInput): Promise<ProviderOnboardingResult> {
    const result = await this.externalImport.import(input);
    if (!result.success || result.manifests.length === 0) {
      throw new Error(result.errors.join('; ') || 'No providers found to import.');
    }
    const manifest = result.manifests[0];
    const route = manifest.routes[0];
    return {
      schemaVersion: 1,
      providerId: manifest.id,
      label: manifest.label,
      source: 'import',
      manifest,
      models: route?.models?.map((model) => model.modelId) ?? [],
      env: {
        baseUrlRef: null,
        apiKeyRef: route?.credentialRefs?.[0] ?? null,
      },
      runtime: {
        providerName: manifest.providerName,
        adapter: 'openai_compatible',
        defaultModelName: route?.models?.[0]?.modelId ?? null,
        supported: true,
      },
      warnings: result.warnings,
      explanation: [`Imported provider "${manifest.id}" from the external source.`],
    };
  }

  public async discover(input: ProviderAutoDiscoveryInput): Promise<ProviderOnboardingResult> {
    const result = await this.autoDiscovery.discover(input);
    const manifest = result.manifest;
    const prefix = envPrefix(manifest.id);
    return {
      schemaVersion: 1,
      providerId: manifest.id,
      label: manifest.label,
      source: 'discovery',
      manifest,
      models: result.models.map((model) => model.id),
      env: {
        baseUrlRef: `${prefix}_BASE_URL`,
        apiKeyRef: `${prefix}_API_KEY`,
      },
      runtime: {
        providerName: manifest.providerName,
        adapter: 'openai_compatible',
        defaultModelName: result.models[0]?.id ?? null,
        supported: result.success,
      },
      warnings: result.warnings,
      explanation: [`Auto-discovered ${result.models.length} model(s) for "${manifest.id}".`],
    };
  }
}
