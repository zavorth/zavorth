import { ZavorthLocalizationService } from './ZavorthLocalizationService.js';
import { BUILTIN_CATALOGS } from './catalogs/index.js';
import {
  LEGACY_CATALOG_EXTENSIONS,
  registerLegacyDynamicCatalogs,
} from './catalogs/legacy/index.js';

/**
 * Build a localization service that also resolves the migrated legacy surface
 * catalogs and plugin-tip sections layered over the builtin locale catalogs.
 */
export function createLegacyAwareLocalizationService(): ZavorthLocalizationService {
  const service = new ZavorthLocalizationService();
  for (const [localeTag, extension] of Object.entries(LEGACY_CATALOG_EXTENSIONS)) {
    const base = BUILTIN_CATALOGS[localeTag as keyof typeof BUILTIN_CATALOGS];
    if (!base) continue;
    service.registerDynamicCatalog(localeTag, { ...base, ...extension });
  }
  registerLegacyDynamicCatalogs(service);
  return service;
}

/** Namespaces present in the migrated English legacy catalog. */
export function getLegacyEnglishNamespaces(): string[] {
  const englishLegacy = LEGACY_CATALOG_EXTENSIONS.en?.legacy;
  return englishLegacy ? Object.keys(englishLegacy) : [];
}
