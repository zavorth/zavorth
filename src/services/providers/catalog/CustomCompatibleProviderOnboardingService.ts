import type {
  ModelCapabilityKind,
  ModelModality,
  ProviderCredentialKind,
  ProviderRouteKind,
} from '../../../contracts/ModelPickerContract.js';
import {
  createMinimalProviderIntegrationManifest,
  type ProviderIntegrationManifest,
} from './ProviderIntegrationManifest.js';
import {
  ProviderCompatibilityClassifier,
  type ProviderCompatibilityClassification,
  type ProviderCompatibilityKind,
} from './ProviderCompatibilityClassifier.js';

export type CustomCompatibleProviderOnboardingInput = {
  id: string;
  label: string;
  compatibility: ProviderCompatibilityKind;
  authKind: ProviderCredentialKind;
  baseUrl: string;
  apiKeyEnv?: string | null;
  baseUrlEnv?: string | null;
  modelId?: string | null;
  vendorId?: string | null;
  aliases?: string[];
  capabilities?: ModelCapabilityKind[];
  modalities?: ModelModality[];
};

export type CustomCompatibleProviderOnboardingResult = {
  schemaVersion: 1;
  manifest: ProviderIntegrationManifest;
  classification: ProviderCompatibilityClassification;
  env: {
    baseUrlRef: string;
    apiKeyRef: string | null;
  };
  runtime: {
    providerName: string;
    routeId: string;
    modelName: string | null;
    supported: boolean;
    adapter: string;
  };
  warnings: string[];
  explanation: string[];
};

function normalizeId(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function normalizeEnvKey(value: unknown): string {
  return String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export class CustomCompatibleProviderOnboardingService {
  private readonly classifier: ProviderCompatibilityClassifier;

  constructor(runtime: { classifier?: ProviderCompatibilityClassifier | null } = {}) {
    this.classifier = runtime.classifier || new ProviderCompatibilityClassifier();
  }

  public createDraft(input: CustomCompatibleProviderOnboardingInput): CustomCompatibleProviderOnboardingResult {
    const id = normalizeId(input.id);
    if (!id) {
      throw new Error('Provider compativel precisa de id.');
    }
    if (!input.compatibility) {
      throw new Error('Provider compativel precisa declarar compatibility.');
    }
    if (!input.authKind) {
      throw new Error('Provider compativel precisa declarar authKind.');
    }
    const baseUrl = String(input.baseUrl || '').trim();
    if (!baseUrl) {
      throw new Error('Provider compativel precisa declarar baseUrl.');
    }
    this.assertValidBaseUrl(baseUrl);

    const envPrefix = normalizeEnvKey(id);
    const baseUrlRef = normalizeEnvKey(input.baseUrlEnv || `${envPrefix}_BASE_URL`);
    const apiKeyRef = input.authKind === 'none' || input.authKind === 'local_endpoint'
      ? null
      : normalizeEnvKey(input.apiKeyEnv || `${envPrefix}_API_KEY`);
    const routeKind = this.routeKindForCompatibility(input.compatibility);
    const mode = input.compatibility === 'local_self_hosted'
      ? 'local'
      : input.compatibility === 'gateway'
        ? 'hybrid'
        : 'cloud';
    const capabilities = input.capabilities && input.capabilities.length > 0
      ? input.capabilities
      : this.defaultCapabilities(input.compatibility);
    const modalities: ModelModality[] = input.modalities && input.modalities.length > 0 ? input.modalities : ['text'];
    const manifest = createMinimalProviderIntegrationManifest({
      id,
      label: input.label,
      vendorId: input.vendorId || id,
      providerId: id,
      providerName: id,
      aliases: unique([...(input.aliases || []), id]),
      routeKind,
      mode,
      authKind: input.authKind,
      credentialRefs: unique([baseUrlRef, apiKeyRef || '']),
      capabilities,
      modalities,
      defaultModelName: String(input.modelId || '').trim() || null,
      source: 'operator',
    });
    manifest.routes = manifest.routes.map((route) => ({
      ...route,
      catalogSource: input.modelId ? 'custom_model' : 'fallback_catalog',
      limitations: [
        ...(route.limitations || []),
        'Provider criado por onboarding custom-compatible; requer validacao antes de virar default.',
      ],
    }));
    manifest.families = manifest.families.map((family) => ({
      ...family,
      catalogSource: input.modelId ? 'custom_model' : 'fallback_catalog',
    }));
    manifest.notes = [
      `Base URL declarada por ${baseUrlRef}.`,
      apiKeyRef ? `Credencial declarada por ${apiKeyRef}.` : 'Sem API key declarada para esta rota.',
    ];

    const classification = this.classifier.classify(manifest);
    return {
      schemaVersion: 1,
      manifest,
      classification,
      env: {
        baseUrlRef,
        apiKeyRef,
      },
      runtime: {
        providerName: id,
        routeId: manifest.routes[0]?.routeId || id,
        modelName: input.modelId || null,
        supported: classification.runtimeSupported,
        adapter: classification.runtimeAdapter,
      },
      warnings: this.buildWarnings(input, classification),
      explanation: [
        `Onboarding preparou ${input.label} como ${input.compatibility}.`,
        ...classification.explanation,
        'O manifesto declara authKind, base URL e origem de catalogo antes de chegar ao runtime.',
      ],
    };
  }

  private assertValidBaseUrl(baseUrl: string): void {
    try {
      const parsed = new URL(baseUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('protocol');
      }
    } catch (error: unknown) {throw new Error('baseUrl precisa ser uma URL http(s) valida.');
    }
  }

  private routeKindForCompatibility(compatibility: ProviderCompatibilityKind): ProviderRouteKind {
    if (compatibility === 'local_self_hosted') return 'local_runtime';
    if (compatibility === 'anthropic_compatible') return 'partner';
    return 'custom_compatible';
  }

  private defaultCapabilities(compatibility: ProviderCompatibilityKind): ModelCapabilityKind[] {
    if (compatibility === 'local_self_hosted') {
      return ['chat', 'coding', 'streaming', 'local'];
    }
    if (compatibility === 'anthropic_compatible') {
      return ['chat', 'coding', 'reasoning', 'tool_use', 'long_context'];
    }
    return ['chat', 'coding', 'reasoning', 'streaming', 'tool_use'];
  }

  private buildWarnings(
    input: CustomCompatibleProviderOnboardingInput,
    classification: ProviderCompatibilityClassification,
  ): string[] {
    const warnings: string[] = [];
    if (classification.kind === 'anthropic_compatible' && !classification.runtimeSupported) {
      warnings.push('Anthropic-compatible foi catalogado, mas ainda nao possui adapter generico ativo no runtime.');
    }
    if (!input.modelId) {
      warnings.push('Nenhum modelo principal informado; catalogo ficara como fallback ate discovery/validacao.');
    }
    if (classification.baseUrlRequired) {
      warnings.push('Base URL precisa permanecer declarada e auditavel antes do uso.');
    }
    return warnings;
  }
}
