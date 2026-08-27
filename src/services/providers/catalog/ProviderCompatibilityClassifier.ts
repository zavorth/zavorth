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
import { providerCatalogRegistry } from './ProviderCatalogRegistry.js';
import { getFirstClassProvidersSet, getAnthropicRouteIdsSet, getOpenAiCompatibleRouteIdsSet } from '../../../config/index.js';

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

function normalizeId(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map(normalizeId).filter(Boolean)));
}

function factsRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

function firstArrayItem(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : undefined;
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
    const isFirstClass = tokens.some((token) => getFirstClassProvidersSet().has(token));
    const isGateway = tokens.includes('aigateway')
      || tokens.includes('ai-gateway')
      || facts.routeClass === 'gateway';
    const isLocal = routeKind === 'local_runtime'
      || facts.mode === 'local'
      || tokens.includes('ollama')
      || credentialKind === 'local_endpoint';
    const isAnthropic = tokens.some((token) => {
      if (getAnthropicRouteIdsSet().has(token)) {
        return true;
      }
      const catalogEntry = providerCatalogRegistry.get(token);
      return catalogEntry !== null && (catalogEntry.protocol === 'claude_native' || catalogEntry.protocol === 'anthropic');
    });
    const isOpenAiCompatible = routeKind === 'custom_compatible'
      || facts.routeClass === 'custom_compatible'
      || tokens.some((token) => getOpenAiCompatibleRouteIdsSet().has(token));

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
          `${providerName} is a first-class provider in the current runtime.`,
          'The route keeps the bespoke adapter before falling back to generic compatibility.',
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
          `${providerName} uses a governed gateway/OpenAI-compatible route.`,
          'Runtime bridge must use GatewayProvider with a declared base URL.',
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
          `${providerName} was classified as local/self-hosted.`,
          'Runtime bridge must use the local OpenAI-compatible adapter.',
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
          `${providerName} uses the governed Anthropic-compatible path.`,
          'Runtime bridge must use an Anthropic-compatible adapter with declared route and credentials.',
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
          `${providerName} goes through the generic OpenAI-compatible path.`,
          'Base URL, auth kind, and catalog source must remain visible.',
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
        `${providerName} remained on the bespoke route for safety.`,
        'No generic compatibility was inferred without an explicit signal.',
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
    const value = input as Record<string, unknown>;
    const primaryRoute = factsRecord(value.primaryRoute || (Array.isArray(value.routes) ? value.routes[0] : undefined));
    const identity = factsRecord(value.identity);
    return {
      providerName: normalizeId(firstString(value.providerName, primaryRoute.providerName, identity.providerId, value.providerId)),
      providerId: normalizeId(firstString(value.providerId, primaryRoute.providerId, identity.providerId, value.id)),
      routeId: normalizeId(firstString(value.routeId, primaryRoute.routeId, primaryRoute.id, identity.routeId, value.id)),
      routeKind: (firstString(value.routeKind, primaryRoute.routeKind, identity.routeKind) as ProviderRouteKind | null) ?? null,
      credentialKind: (firstString(value.credentialKind, value.authKind, primaryRoute.credentialKind, primaryRoute.authKind, identity.credentialKind) as ProviderCredentialKind | null) ?? null,
      catalogSource: (firstString(value.catalogSource, primaryRoute.catalogSource, identity.catalogSource) as ProviderCatalogSource | null) ?? null,
      routeClass: normalizeId(firstString(value.routeClass, primaryRoute.routeClass)),
      mode: normalizeId(firstString(value.mode, primaryRoute.mode)),
      aliases: [
        ...(Array.isArray(value.aliases) ? value.aliases : []),
        ...(Array.isArray(primaryRoute.aliases) ? primaryRoute.aliases : []),
      ],
      familyId: normalizeId(firstString(value.familyId, identity.familyId, firstArrayItem(primaryRoute.familyIds))),
      vendorId: normalizeId(firstString(value.vendorId, primaryRoute.vendorId, identity.vendorId)),
    };
  }
}
