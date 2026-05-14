import type {
  AccessRouteCatalogEntry,
  ProviderCatalogSource,
  ProviderCredentialKind,
  ProviderRouteKind,
  SelectedModelProfile,
} from '../../../contracts/ModelPickerContract.js';
import type {
  ProviderIntegrationManifest,
  ProviderIntegrationRouteManifest,
} from './ProviderIntegrationManifest.js';

export type ProviderCompatibilityKind =
  | 'bespoke'
  | 'openai_compatible'
  | 'anthropic_compatible'
  | 'local_self_hosted'
  | 'gateway';

export type ProviderRuntimeAdapterKind =
  | 'bespoke'
  | 'openai_compatible'
  | 'anthropic_compatible'
  | 'local_openai_compatible'
  | 'gateway';

export type ProviderCompatibilityClassifierInput =
  | SelectedModelProfile
  | AccessRouteCatalogEntry
  | ProviderIntegrationManifest
  | ProviderIntegrationRouteManifest
  | {
      providerName?: string | null;
      providerId?: string | null;
      routeId?: string | null;
      routeKind?: ProviderRouteKind | null;
      credentialKind?: ProviderCredentialKind | null;
      catalogSource?: ProviderCatalogSource | null;
      routeClass?: string | null;
      mode?: string | null;
      aliases?: string[] | null;
      familyId?: string | null;
      vendorId?: string | null;
    };

export type ProviderCompatibilityClassification = {
  schemaVersion: 1;
  kind: ProviderCompatibilityKind;
  runtimeAdapter: ProviderRuntimeAdapterKind;
  providerName: string;
  providerId: string;
  routeId: string;
  routeKind: ProviderRouteKind | 'unknown';
  credentialKind: ProviderCredentialKind | 'unknown';
  catalogSource: ProviderCatalogSource | 'unknown';
  genericCompatible: boolean;
  firstClassProvider: boolean;
  baseUrlRequired: boolean;
  credentialRequired: boolean;
  runtimeSupported: boolean;
  explanation: string[];
};

const FIRST_CLASS_PROVIDERS = new Set([
  'gemini',
  'deepseek',
  'openai',
  'minimax',
  'aigateway',
  'qwen',
  'puter',
  'openrouter',
  'opencode',
  'ollama',
]);

function normalizeId(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map(normalizeId).filter(Boolean)));
}

export class ProviderCompatibilityClassifier {
  public classify(input: ProviderCompatibilityClassifierInput): ProviderCompatibilityClassification {
    const facts = this.readFacts(input);
    const tokens = unique([
      facts.providerName,
      facts.providerId,
      facts.routeId,
      facts.familyId,
      facts.vendorId,
      ...facts.aliases,
    ]);
    const providerName = facts.providerName || facts.providerId || facts.routeId || 'unknown';
    const providerId = facts.providerId || providerName;
    const routeId = facts.routeId || providerId;
    const routeKind = facts.routeKind || 'unknown';
    const credentialKind = facts.credentialKind || 'unknown';
    const catalogSource = facts.catalogSource || 'unknown';
    const isFirstClass = tokens.some((token) => FIRST_CLASS_PROVIDERS.has(token));
    const isGateway = tokens.includes('aigateway')
      || tokens.includes('ai-gateway')
      || facts.routeClass === 'gateway';
    const isLocal = routeKind === 'local_runtime'
      || facts.mode === 'local'
      || tokens.includes('ollama')
      || credentialKind === 'local_endpoint';
    const isAnthropic = tokens.some((token) => token.includes('anthropic') || token.includes('claude'));
    const isOpenAiCompatible = routeKind === 'custom_compatible'
      || facts.routeClass === 'custom_compatible'
      || tokens.some((token) => token.includes('openai-compatible') || token.includes('openai_compatible'));

    if (isFirstClass && !isOpenAiCompatible && !isLocal) {
      return this.build({
        kind: 'bespoke',
        runtimeAdapter: 'bespoke',
        providerName,
        providerId,
        routeId,
        routeKind,
        credentialKind,
        catalogSource,
        genericCompatible: false,
        firstClassProvider: true,
        baseUrlRequired: false,
        credentialRequired: credentialKind !== 'none',
        runtimeSupported: true,
        explanation: [
          `${providerName} possui provider first-class no runtime atual.`,
          'A rota preserva o adapter bespoke antes de cair em compat generico.',
        ],
      });
    }

    if (isGateway) {
      return this.build({
        kind: 'gateway',
        runtimeAdapter: 'gateway',
        providerName,
        providerId,
        routeId,
        routeKind,
        credentialKind,
        catalogSource,
        genericCompatible: true,
        firstClassProvider: isFirstClass,
        baseUrlRequired: true,
        credentialRequired: credentialKind !== 'none',
        runtimeSupported: true,
        explanation: [
          `${providerName} usa rota gateway/OpenAI-compatible governada.`,
          'Runtime bridge deve usar GatewayProvider com base URL declarada.',
        ],
      });
    }

    if (isLocal) {
      return this.build({
        kind: 'local_self_hosted',
        runtimeAdapter: 'local_openai_compatible',
        providerName,
        providerId,
        routeId,
        routeKind,
        credentialKind,
        catalogSource,
        genericCompatible: true,
        firstClassProvider: isFirstClass,
        baseUrlRequired: true,
        credentialRequired: false,
        runtimeSupported: true,
        explanation: [
          `${providerName} foi classificado como local/self-hosted.`,
          'Runtime bridge deve usar adapter OpenAI-compatible local.',
        ],
      });
    }

    if (isAnthropic && !isOpenAiCompatible) {
      return this.build({
        kind: 'anthropic_compatible',
        runtimeAdapter: 'anthropic_compatible',
        providerName,
        providerId,
        routeId,
        routeKind,
        credentialKind,
        catalogSource,
        genericCompatible: true,
        firstClassProvider: false,
        baseUrlRequired: routeKind !== 'official',
        credentialRequired: credentialKind !== 'none',
        runtimeSupported: true,
        explanation: [
          `${providerName} usa a trilha Anthropic-compatible governada.`,
          'Runtime bridge deve usar adapter Anthropic-compatible com rota e credenciais declaradas.',
        ],
      });
    }

    if (isOpenAiCompatible || !isFirstClass) {
      return this.build({
        kind: 'openai_compatible',
        runtimeAdapter: 'openai_compatible',
        providerName,
        providerId,
        routeId,
        routeKind,
        credentialKind,
        catalogSource,
        genericCompatible: true,
        firstClassProvider: false,
        baseUrlRequired: true,
        credentialRequired: !['none', 'local_endpoint'].includes(String(credentialKind)),
        runtimeSupported: true,
        explanation: [
          `${providerName} entra pela trilha OpenAI-compatible generica.`,
          'Base URL, auth kind e origem do catalogo precisam continuar visiveis.',
        ],
      });
    }

    return this.build({
      kind: 'bespoke',
      runtimeAdapter: 'bespoke',
      providerName,
      providerId,
      routeId,
      routeKind,
      credentialKind,
      catalogSource,
      genericCompatible: false,
      firstClassProvider: isFirstClass,
      baseUrlRequired: false,
      credentialRequired: credentialKind !== 'none',
      runtimeSupported: isFirstClass,
      explanation: [
        `${providerName} permaneceu na rota bespoke por seguranca.`,
        'Nenhuma compatibilidade generica foi inferida sem sinal explicito.',
      ],
    });
  }

  private build(input: Omit<ProviderCompatibilityClassification, 'schemaVersion'>): ProviderCompatibilityClassification {
    return {
      schemaVersion: 1,
      ...input,
    };
  }

  private readFacts(input: ProviderCompatibilityClassifierInput): {
    providerName: string;
    providerId: string;
    routeId: string;
    routeKind: ProviderRouteKind | null;
    credentialKind: ProviderCredentialKind | null;
    catalogSource: ProviderCatalogSource | null;
    routeClass: string;
    mode: string;
    aliases: string[];
    familyId: string;
    vendorId: string;
  } {
    const value = input as Record<string, any>;
    const route = Array.isArray(value.routes) ? value.routes[0] || {} : {};
    const primaryRoute = value.primaryRoute || route;
    const identity = value.identity || {};
    return {
      providerName: normalizeId(value.providerName || primaryRoute.providerName || identity.providerId || value.providerId),
      providerId: normalizeId(value.providerId || primaryRoute.providerId || identity.providerId || value.id),
      routeId: normalizeId(value.routeId || primaryRoute.routeId || primaryRoute.id || identity.routeId || value.id),
      routeKind: (value.routeKind || primaryRoute.routeKind || identity.routeKind || null) as ProviderRouteKind | null,
      credentialKind: (value.credentialKind || value.authKind || primaryRoute.credentialKind || primaryRoute.authKind || identity.credentialKind || null) as ProviderCredentialKind | null,
      catalogSource: (value.catalogSource || primaryRoute.catalogSource || identity.catalogSource || null) as ProviderCatalogSource | null,
      routeClass: normalizeId(value.routeClass || primaryRoute.routeClass),
      mode: normalizeId(value.mode || primaryRoute.mode),
      aliases: [
        ...(Array.isArray(value.aliases) ? value.aliases : []),
        ...(Array.isArray(primaryRoute.aliases) ? primaryRoute.aliases : []),
      ],
      familyId: normalizeId(value.familyId || identity.familyId || primaryRoute.familyIds?.[0]),
      vendorId: normalizeId(value.vendorId || primaryRoute.vendorId || identity.vendorId),
    };
  }
}
