import type {
  ProviderIntegrationFamilyManifest,
  ProviderIntegrationManifest,
  ProviderIntegrationRouteManifest,
} from './ProviderIntegrationManifest.js';
import { DEFAULT_PROVIDER_INTEGRATION_MANIFESTS } from './manifests/index.js';

export type ProviderIntegrationRouteResolution = {
  manifest: ProviderIntegrationManifest;
  route: ProviderIntegrationRouteManifest;
  matchedBy: 'routeId' | 'providerId' | 'providerName' | 'alias' | 'prefix';
  matchedValue: string;
};

export type ProviderIntegrationFamilyResolution = {
  manifest: ProviderIntegrationManifest;
  family: ProviderIntegrationFamilyManifest;
  matchedBy: 'familyId' | 'providerId' | 'alias';
  matchedValue: string;
};

export type ProviderIntegrationProviderResolution = {
  manifest: ProviderIntegrationManifest;
  primaryRoute: ProviderIntegrationRouteManifest | null;
  matchedBy: 'manifestId' | 'providerId' | 'providerName' | 'alias' | 'routeId' | 'prefix';
  matchedValue: string;
};

export type ProviderIntegrationRegistrySnapshot = {
  schemaVersion: 1;
  manifestCount: number;
  familyCount: number;
  routeCount: number;
  aliases: Record<string, string>;
  routeKinds: string[];
  authKinds: string[];
};

type ProviderRouteLookupInput = {
  id?: string | null;
  effectiveProviderName?: string | null;
  providerName?: string | null;
  aliases?: string[] | null;
};

function normalizeId(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function hasWildcardAlias(alias: string): boolean {
  return alias.endsWith('*');
}

function matchesWildcardAlias(alias: string, target: string): boolean {
  if (!hasWildcardAlias(alias)) {
    return false;
  }
  return target.startsWith(alias.slice(0, -1));
}

export class ProviderIntegrationRegistry {
  private readonly manifests: ProviderIntegrationManifest[];

  constructor(manifests: ProviderIntegrationManifest[] = DEFAULT_PROVIDER_INTEGRATION_MANIFESTS) {
    this.manifests = manifests.map((manifest) => this.normalizeManifest(manifest));
  }

  public listManifests(): ProviderIntegrationManifest[] {
    return this.manifests.map((manifest) => this.cloneManifest(manifest));
  }

  public listFamilies(): ProviderIntegrationFamilyManifest[] {
    return this.manifests.flatMap((manifest) => manifest.families.map((family) => ({ ...family })));
  }

  public listRoutes(): ProviderIntegrationRouteManifest[] {
    return this.manifests.flatMap((manifest) => manifest.routes.map((route) => ({ ...route })));
  }

  public resolveProvider(target: string): ProviderIntegrationProviderResolution | null {
    const normalized = normalizeId(target);
    if (!normalized) {
      return null;
    }

    for (const manifest of this.manifests) {
      if (normalizeId(manifest.id) === normalized) {
        return this.toProviderResolution(manifest, 'manifestId', target);
      }
      if (normalizeId(manifest.providerId) === normalized) {
        return this.toProviderResolution(manifest, 'providerId', target);
      }
      if (normalizeId(manifest.providerName) === normalized) {
        return this.toProviderResolution(manifest, 'providerName', target);
      }
      if ((manifest.aliases || []).some((alias) => normalizeId(alias) === normalized)) {
        return this.toProviderResolution(manifest, 'alias', target);
      }
      if ((manifest.aliases || []).some((alias) => matchesWildcardAlias(normalizeId(alias), normalized))) {
        return this.toProviderResolution(manifest, 'prefix', target);
      }
      if (manifest.routes.some((route) => normalizeId(route.routeId) === normalized)) {
        return this.toProviderResolution(manifest, 'routeId', target);
      }
      if (manifest.routes.some((route) => (route.aliases || []).some((alias) => matchesWildcardAlias(normalizeId(alias), normalized)))) {
        return this.toProviderResolution(manifest, 'prefix', target);
      }
    }

    return null;
  }

  public resolveFamily(target: string): ProviderIntegrationFamilyResolution | null {
    const normalized = normalizeId(target);
    if (!normalized) {
      return null;
    }

    for (const manifest of this.manifests) {
      for (const family of manifest.families) {
        if (normalizeId(family.familyId) === normalized) {
          return { manifest, family: { ...family }, matchedBy: 'familyId', matchedValue: target };
        }
        if (family.providerIds.map(normalizeId).includes(normalized)) {
          return { manifest, family: { ...family }, matchedBy: 'providerId', matchedValue: target };
        }
        if ((family.aliases || []).map(normalizeId).includes(normalized)) {
          return { manifest, family: { ...family }, matchedBy: 'alias', matchedValue: target };
        }
      }
    }

    return null;
  }

  public resolveRoute(target: string): ProviderIntegrationRouteResolution | null {
    const normalized = normalizeId(target);
    if (!normalized) {
      return null;
    }

    for (const manifest of this.manifests) {
      for (const route of manifest.routes) {
        if (normalizeId(route.routeId) === normalized) {
          return this.toRouteResolution(manifest, route, 'routeId', target);
        }
        if (normalizeId(route.providerId) === normalized) {
          return this.toRouteResolution(manifest, route, 'providerId', target);
        }
        if (normalizeId(route.providerName) === normalized) {
          return this.toRouteResolution(manifest, route, 'providerName', target);
        }
        if ((route.aliases || []).some((alias) => normalizeId(alias) === normalized)) {
          return this.toRouteResolution(manifest, route, 'alias', target);
        }
        if ((route.aliases || []).some((alias) => matchesWildcardAlias(normalizeId(alias), normalized))) {
          return this.toRouteResolution(manifest, route, 'prefix', target);
        }
      }
    }

    return null;
  }

  public resolveRouteForProvider(input: ProviderRouteLookupInput): ProviderIntegrationRouteResolution | null {
    const candidates = unique([
      input.id || '',
      input.effectiveProviderName || '',
      input.providerName || '',
      ...(input.aliases || []),
    ]);
    for (const candidate of candidates) {
      const resolved = this.resolveRoute(candidate);
      if (resolved) {
        return resolved;
      }
    }
    return null;
  }

  public resolveAlias(aliasOrId: string): string | null {
    const resolved = this.resolveProvider(aliasOrId);
    return resolved?.manifest.providerId || null;
  }

  public buildSnapshot(): ProviderIntegrationRegistrySnapshot {
    const aliases: Record<string, string> = {};
    for (const manifest of this.manifests) {
      for (const alias of manifest.aliases || []) {
        aliases[normalizeId(alias)] = manifest.providerId;
      }
      for (const route of manifest.routes) {
        for (const alias of route.aliases || []) {
          aliases[normalizeId(alias)] = route.providerId;
        }
      }
    }

    return {
      schemaVersion: 1,
      manifestCount: this.manifests.length,
      familyCount: this.listFamilies().length,
      routeCount: this.listRoutes().length,
      aliases,
      routeKinds: unique(this.listRoutes().map((route) => route.routeKind)).sort(),
      authKinds: unique(this.listRoutes().map((route) => route.authKind)).sort(),
    };
  }

  private normalizeManifest(manifest: ProviderIntegrationManifest): ProviderIntegrationManifest {
    const aliases = unique([...(manifest.aliases || []), manifest.id, manifest.providerId, manifest.providerName]);
    return {
      ...manifest,
      aliases,
      families: manifest.families.map((family) => ({
        ...family,
        providerIds: unique(family.providerIds),
        aliases: unique([...(family.aliases || []), family.familyId]),
        secondaryModelNames: family.secondaryModelNames || [],
        fallbackModelNames: family.fallbackModelNames || [],
        visibility: family.visibility || 'public',
        catalogSource: family.catalogSource || 'static',
      })),
      routes: manifest.routes.map((route) => ({
        ...route,
        aliases: unique([...(route.aliases || []), route.routeId, route.providerId, route.providerName]),
        credentialRefs: route.credentialRefs || [],
        models: route.models || [],
        fallbackRouteIds: route.fallbackRouteIds || [],
        visibility: route.visibility || 'public',
        catalogSource: route.catalogSource || 'static',
        limitations: route.limitations || [],
      })),
    };
  }

  private toProviderResolution(
    manifest: ProviderIntegrationManifest,
    matchedBy: ProviderIntegrationProviderResolution['matchedBy'],
    matchedValue: string,
  ): ProviderIntegrationProviderResolution {
    return {
      manifest: this.cloneManifest(manifest),
      primaryRoute: manifest.routes[0] ? { ...manifest.routes[0] } : null,
      matchedBy,
      matchedValue,
    };
  }

  private toRouteResolution(
    manifest: ProviderIntegrationManifest,
    route: ProviderIntegrationRouteManifest,
    matchedBy: ProviderIntegrationRouteResolution['matchedBy'],
    matchedValue: string,
  ): ProviderIntegrationRouteResolution {
    return {
      manifest: this.cloneManifest(manifest),
      route: { ...route },
      matchedBy,
      matchedValue,
    };
  }

  private cloneManifest(manifest: ProviderIntegrationManifest): ProviderIntegrationManifest {
    return {
      ...manifest,
      aliases: [...(manifest.aliases || [])],
      capabilities: [...manifest.capabilities],
      modalities: [...manifest.modalities],
      families: manifest.families.map((family) => ({
        ...family,
        providerIds: [...family.providerIds],
        aliases: [...(family.aliases || [])],
        secondaryModelNames: [...(family.secondaryModelNames || [])],
        fallbackModelNames: [...(family.fallbackModelNames || [])],
        capabilities: [...family.capabilities],
        modalities: [...family.modalities],
      })),
      routes: manifest.routes.map((route) => ({
        ...route,
        familyIds: [...route.familyIds],
        aliases: [...(route.aliases || [])],
        credentialRefs: [...(route.credentialRefs || [])],
        capabilities: [...route.capabilities],
        modalities: [...route.modalities],
        models: (route.models || []).map((model) => ({
          ...model,
          aliases: [...(model.aliases || [])],
          capabilities: model.capabilities ? [...model.capabilities] : undefined,
          modalities: model.modalities ? [...model.modalities] : undefined,
        })),
        fallbackRouteIds: [...(route.fallbackRouteIds || [])],
        limitations: [...(route.limitations || [])],
      })),
      notes: manifest.notes ? [...manifest.notes] : undefined,
    };
  }
}

let defaultProviderIntegrationRegistry: ProviderIntegrationRegistry | null = null;

export function getDefaultProviderIntegrationRegistry(): ProviderIntegrationRegistry {
  if (!defaultProviderIntegrationRegistry) {
    defaultProviderIntegrationRegistry = new ProviderIntegrationRegistry();
  }
  return defaultProviderIntegrationRegistry;
}
