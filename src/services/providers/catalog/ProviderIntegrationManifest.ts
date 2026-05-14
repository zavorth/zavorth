import type {
  ModelCapabilityKind,
  ModelModality,
  ModelPickerRouteMode,
  ModelPickerVisibility,
  ProviderCatalogSource,
  ProviderCredentialKind,
  ProviderRouteKind,
} from './ProviderCatalogContracts.js';

export type ProviderIntegrationManifestSource =
  | 'curated'
  | 'current_constants'
  | 'runtime'
  | 'operator'
  | 'custom';

export type ProviderIntegrationModelManifest = {
  modelId: string;
  label: string;
  aliases?: string[];
  primary?: boolean;
  capabilities?: ModelCapabilityKind[];
  modalities?: ModelModality[];
};

export type ProviderIntegrationFamilyManifest = {
  familyId: string;
  label: string;
  vendorId: string;
  providerIds: string[];
  summary: string;
  aliases?: string[];
  defaultModelName?: string | null;
  secondaryModelNames?: string[];
  fallbackModelNames?: string[];
  capabilities: ModelCapabilityKind[];
  modalities: ModelModality[];
  visibility?: ModelPickerVisibility;
  catalogSource?: ProviderCatalogSource;
};

export type ProviderIntegrationRouteManifest = {
  routeId: string;
  label: string;
  vendorId: string;
  providerId: string;
  providerName: string;
  familyIds: string[];
  routeKind: ProviderRouteKind;
  mode: ModelPickerRouteMode;
  aliases?: string[];
  authKind: ProviderCredentialKind;
  credentialRefs?: string[];
  capabilities: ModelCapabilityKind[];
  modalities: ModelModality[];
  models?: ProviderIntegrationModelManifest[];
  fallbackRouteIds?: string[];
  passthroughModels?: boolean;
  visibility?: ModelPickerVisibility;
  catalogSource?: ProviderCatalogSource;
  limitations?: string[];
  website?: string;
};

export type ProviderIntegrationManifest = {
  schemaVersion: 1;
  id: string;
  label: string;
  vendorId: string;
  providerId: string;
  providerName: string;
  source: ProviderIntegrationManifestSource;
  aliases?: string[];
  website?: string;
  routeKind: ProviderRouteKind;
  authKind: ProviderCredentialKind;
  capabilities: ModelCapabilityKind[];
  modalities: ModelModality[];
  families: ProviderIntegrationFamilyManifest[];
  routes: ProviderIntegrationRouteManifest[];
  notes?: string[];
};

export type ProviderIntegrationMinimalManifestInput = {
  id: string;
  label: string;
  vendorId?: string;
  providerId?: string;
  providerName?: string;
  aliases?: string[];
  website?: string;
  routeKind?: ProviderRouteKind;
  mode?: ModelPickerRouteMode;
  authKind?: ProviderCredentialKind;
  credentialRefs?: string[];
  capabilities?: ModelCapabilityKind[];
  modalities?: ModelModality[];
  defaultModelName?: string | null;
  source?: ProviderIntegrationManifestSource;
};

export function createMinimalProviderIntegrationManifest(
  input: ProviderIntegrationMinimalManifestInput,
): ProviderIntegrationManifest {
  const id = normalizeId(input.id);
  const providerId = normalizeId(input.providerId || id);
  const vendorId = normalizeId(input.vendorId || providerId);
  const providerName = normalizeId(input.providerName || providerId);
  const capabilities: ModelCapabilityKind[] = unique(
    input.capabilities && input.capabilities.length > 0 ? input.capabilities : ['chat'],
  );
  const modalities: ModelModality[] = unique(
    input.modalities && input.modalities.length > 0 ? input.modalities : ['text'],
  );
  const routeKind = input.routeKind || 'custom_compatible';
  const mode = input.mode || (routeKind === 'local_runtime' ? 'local' : 'cloud');
  const authKind = input.authKind || 'api_key';

  return {
    schemaVersion: 1,
    id,
    label: input.label,
    vendorId,
    providerId,
    providerName,
    source: input.source || 'custom',
    aliases: unique([...(input.aliases || []), id, providerId]),
    website: input.website,
    routeKind,
    authKind,
    capabilities,
    modalities,
    families: [
      {
        familyId: id,
        label: input.label,
        vendorId,
        providerIds: [providerId],
        summary: `Manifesto minimo para ${input.label}.`,
        defaultModelName: input.defaultModelName || null,
        secondaryModelNames: [],
        fallbackModelNames: [],
        capabilities,
        modalities,
        catalogSource: input.source === 'operator' ? 'operator' : 'static',
      },
    ],
    routes: [
      {
        routeId: id,
        label: input.label,
        vendorId,
        providerId,
        providerName,
        familyIds: [id],
        routeKind,
        mode,
        aliases: unique([...(input.aliases || []), id, providerId]),
        authKind,
        credentialRefs: input.credentialRefs || [],
        capabilities,
        modalities,
        models: input.defaultModelName
          ? [{ modelId: input.defaultModelName, label: input.defaultModelName, primary: true }]
          : [],
        fallbackRouteIds: [],
        catalogSource: input.source === 'operator' ? 'operator' : 'static',
      },
    ],
  };
}

function normalizeId(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values.filter(Boolean)));
}
