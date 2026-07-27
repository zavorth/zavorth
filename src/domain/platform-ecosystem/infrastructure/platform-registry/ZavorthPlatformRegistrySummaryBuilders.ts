import type {
  ZavorthPlatformRegistryCollection,
  ZavorthPlatformRegistryEntry,
  ZavorthPlatformRegistryRecipe,
  ZavorthPlatformRegistrySnapshot,
  ZavorthPlatformRegistryStatusSummarySnapshot,
} from '../../../../services/ZavorthPlatformRegistryService.js';

export function buildPlatformRegistrySummary(
  entries: ZavorthPlatformRegistryEntry[],
  collections: ZavorthPlatformRegistryCollection[],
  recipes: ZavorthPlatformRegistryRecipe[],
): ZavorthPlatformRegistrySnapshot['summary'] {
  return {
    total: entries.length,
    plugins: entries.filter((entry) => entry.kind === 'plugin').length,
    skills: entries.filter((entry) => entry.kind === 'skill').length,
    mcps: entries.filter((entry) => entry.kind === 'mcp').length,
    ready: entries.filter((entry) => entry.readiness === 'ready').length,
    partial: entries.filter((entry) => entry.readiness === 'partial').length,
    planned: entries.filter((entry) => entry.readiness === 'planned').length,
    disabled: entries.filter((entry) => entry.readiness === 'disabled').length,
    trusted: entries.filter((entry) => entry.trust === 'trusted').length,
    enabled: entries.filter((entry) => entry.installState === 'enabled').length,
    catalogBacked: entries.filter((entry) => Boolean(entry.registrySource)).length,
    discoveryOnly: entries.filter((entry) => entry.discoveryOnly).length,
    featured: entries.filter((entry) => entry.featured).length,
    official: entries.filter((entry) => entry.origin === 'official').length,
    trustedThirdParty: entries.filter((entry) => entry.origin === 'trusted-third-party').length,
    learnedLocal: entries.filter((entry) => entry.origin === 'learned-local').length,
    quarantined: entries.filter((entry) => entry.origin === 'quarantined').length,
    reviewPending: entries.filter((entry) => entry.reviewState === 'pending').length,
    collections: collections.length,
    featuredCollections: collections.filter((entry) => entry.featured).length,
    recipes: recipes.length,
    featuredRecipes: recipes.filter((entry) => entry.featured).length,
  };
}

export function buildPlatformRegistrySummaryNarrative(
  summary: ZavorthPlatformRegistrySnapshot['summary'],
): ZavorthPlatformRegistrySnapshot['narrative'] {
  return {
    headline: `Platform plane unifica ${summary.total} item(s) entre plugins, skills e MCPs.`,
    operatorSummary: `${summary.plugins} plugin(s), ${summary.skills} skill(s), ${summary.mcps} MCP(s); `
      + `${summary.ready} ready(s), ${summary.partial} parcial(is), ${summary.planned} planejado(s), `
      + `${summary.discoveryOnly} descoberta(s) pura(s), ${summary.trusted} trusted, `
      + `${summary.reviewPending} under review, ${summary.learnedLocal} learned-local e ${summary.quarantined} quarantined, `
      + `${summary.collections} collection(oes) e ${summary.recipes} recipe(s).`,
  };
}

export function buildPlatformRegistryStatusNarrative(
  summary: ZavorthPlatformRegistryStatusSummarySnapshot['summary'],
): ZavorthPlatformRegistryStatusSummarySnapshot['narrative'] {
  return {
    headline: `Platform plane resume ${summary.total} item(s) para o fast path da CLI.`,
    operatorSummary: `${summary.plugins} plugin(s), ${summary.skills} skill(s), ${summary.mcps} MCP(s), `
      + `${summary.collections} collection(oes) e ${summary.recipes} recipe(s).`,
  };
}
