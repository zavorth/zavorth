/**
 * Gateway message resolution backed by the unified localization system.
 *
 * The AI-gateway HTTP surface catalogs (seeded by
 * scripts/sync-gateway-i18n-catalogs.mjs under the `gateway` namespace) resolve
 * through the same catalog chain as every other section: exact locale tag,
 * then base language, then one-shot AI translation persisted by
 * ZavorthOnDemandTranslationService, then English.
 */

import type { GatewayCatalogSection, LocalizationCatalog } from './localeContracts.js';
import { ZavorthLocalizationService } from './ZavorthLocalizationService.js';
import { createLegacyAwareLocalizationService } from './legacySupport.js';
import { ZavorthOnDemandTranslationService } from './ZavorthOnDemandTranslationService.js';
import {
  GATEWAY_CATALOG_EXTENSIONS,
  GATEWAY_DYNAMIC_CATALOG_TAGS,
  GATEWAY_SEED_CATALOGS,
} from './catalogs/gateway/index.js';

let gatewayAwareService: ZavorthLocalizationService | null = null;
let onDemandService: ZavorthOnDemandTranslationService | null = null;

/**
 * Build a localization service that also carries the seeded gateway sections:
 * base-language seeds layer onto the resolved builtin/legacy catalogs while
 * gateway-only and regional-variant tags register under their exact keys.
 */
export function createGatewayAwareLocalizationService(): ZavorthLocalizationService {
  const service = createLegacyAwareLocalizationService();

  for (const [localeTag, extension] of Object.entries(GATEWAY_CATALOG_EXTENSIONS)) {
    const base = service.getCatalog(localeTag);
    service.registerDynamicCatalog(localeTag, { ...base, ...extension });
  }

  for (const tag of GATEWAY_DYNAMIC_CATALOG_TAGS) {
    const gatewaySection: GatewayCatalogSection | undefined = GATEWAY_SEED_CATALOGS[tag];
    if (!gatewaySection) continue;
    const existing: LocalizationCatalog = service.getCatalog(tag);
    service.registerDynamicCatalog(tag, { ...existing, gateway: gatewaySection });
  }

  return service;
}

function getGatewayAwareService(): ZavorthLocalizationService {
  if (!gatewayAwareService) {
    gatewayAwareService = createGatewayAwareLocalizationService();
  }
  return gatewayAwareService;
}

async function getOnDemandService(): Promise<ZavorthOnDemandTranslationService> {
  if (!onDemandService) {
    const { ZavorthLlmTranslationBridge } = await import('./ZavorthLlmTranslationBridge.js');
    onDemandService = new ZavorthOnDemandTranslationService({
      providerBridge: new ZavorthLlmTranslationBridge(),
    });
  }
  return onDemandService;
}

function resolveGatewaySection(service: ZavorthLocalizationService, tag: string): GatewayCatalogSection | undefined {
  const direct = service.getCatalog(tag).gateway;
  if (direct) return direct;

  const baseLanguage = tag.split('-')[0];
  if (baseLanguage === tag) return undefined;
  return service.getCatalog(baseLanguage).gateway;
}

/**
 * Resolve the full next-intl message tree for a gateway locale. Seeded locales
 * resolve synchronously; unknown locales fall back to one-shot AI translation
 * with permanent persistence, degrading to English when no provider is
 * available.
 */
export async function resolveGatewayMessages(localeTag: string): Promise<GatewayCatalogSection | null> {
  const normalized = localeTag.trim().toLowerCase();
  if (!normalized) return null;

  const service = getGatewayAwareService();
  const seeded = resolveGatewaySection(service, normalized);
  if (seeded) return seeded;

  const englishSeed = GATEWAY_SEED_CATALOGS.en;
  if (!englishSeed) return null;

  const onDemand = await getOnDemandService();
  const synthesized = await onDemand.getOrTranslateSection(normalized, 'gateway', englishSeed);
  return synthesized ?? englishSeed;
}
